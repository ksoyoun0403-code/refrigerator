import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { consumeRecipeIngredients, previewRecipeConsumption } from './recipeConsumptionApi';
import { RecipeConsumptionPreview, RecipeConsumptionResult, RecipeSuggestion } from './types';

type ConsumptionChange =
  | { itemId: string; quantity: string }
  | { itemId: string; remainingQuantity: string; unit: string };

export function RecipeConsumptionSheet({ onClose, onConsumed, recipe, visible }: { onClose(): void; onConsumed?(result: RecipeConsumptionResult): void; recipe: RecipeSuggestion; visible: boolean }) {
  const [preview, setPreview] = useState<RecipeConsumptionPreview>();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [manualItemIds, setManualItemIds] = useState<Record<string, string>>({});
  const [manualRemaining, setManualRemaining] = useState<Record<string, string>>({});
  const [manualUnits, setManualUnits] = useState<Record<string, string>>({});
  const [openUnitLineId, setOpenUnitLineId] = useState<string>();
  const [editingAutomaticIds, setEditingAutomaticIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setOpenUnitLineId(undefined);
    setEditingAutomaticIds(new Set());
    setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
    setIsLoading(true); setError(undefined); setPreview(undefined);
    void previewRecipeConsumption(recipe).then((value) => {
      setPreview(value);
      setQuantities(Object.fromEntries(value.lines.filter((line) => line.itemId && line.suggestedQuantity).map((line) => [line.id, line.suggestedQuantity!])))
      const manualLines = value.lines.filter((line) => !line.itemId && line.manualItems?.length);
      setManualItemIds(Object.fromEntries(manualLines.map((line) => [line.id, line.manualItems![0].itemId])));
      setManualRemaining(Object.fromEntries(manualLines.map((line) => [line.id, line.manualItems![0].currentQuantity])));
      setManualUnits(Object.fromEntries(manualLines.map((line) => [line.id, line.manualItems![0].unit])));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : '차감 정보를 확인하지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, [recipe, visible]);

  const deductions = useMemo<ConsumptionChange[]>(() => preview?.lines.flatMap<ConsumptionChange>((line) => {
    if (line.itemId) {
      const quantity = quantities[line.id]?.trim();
      return isValidQuantity(quantity, line.currentQuantity) ? [{ itemId: line.itemId, quantity: quantity! }] : [];
    }
    const selected = line.manualItems?.find((item) => item.itemId === manualItemIds[line.id]);
    const remaining = manualRemaining[line.id]?.trim();
    const unit = manualUnits[line.id];
    if (!selected || !isValidManualRemaining(remaining, selected.currentQuantity, selected.unit, unit)) return [];
    const changed = unit !== selected.unit || Number(remaining) !== Number(selected.currentQuantity);
    return changed ? [{ itemId: selected.itemId, remainingQuantity: remaining!, unit }] : [];
  }) ?? [], [manualItemIds, manualRemaining, manualUnits, preview, quantities]);

  const summary = useMemo(() => {
    if (!preview) return { applied: 0, removed: 0, unresolved: 0 };
    let applied = 0; let removed = 0; let unresolved = 0;
    for (const line of preview.lines) {
      if (line.itemId) {
        const quantity = quantities[line.id];
        if (isValidQuantity(quantity, line.currentQuantity)) {
          applied += 1;
          if (Number(quantity) === Number(line.currentQuantity)) removed += 1;
        } else unresolved += 1;
        continue;
      }
      const selected = line.manualItems?.find((item) => item.itemId === manualItemIds[line.id]);
      const remaining = manualRemaining[line.id];
      const unit = manualUnits[line.id];
      if (selected && isValidManualRemaining(remaining, selected.currentQuantity, selected.unit, unit) && (unit !== selected.unit || Number(remaining) !== Number(selected.currentQuantity))) {
        applied += 1;
        if (Number(remaining) === 0) removed += 1;
      } else unresolved += 1;
    }
    return { applied, removed, unresolved };
  }, [manualItemIds, manualRemaining, manualUnits, preview, quantities]);

  const confirm = () => Alert.alert('요리를 완료하고 재료를 반영할까요?', '레시피는 그대로 유지되고 냉장고 수량과 단위만 변경됩니다.', [
    { text: '취소', style: 'cancel' },
    { text: '반영하기', onPress: () => void save() },
  ]);

  const save = async () => {
    if (!deductions.length || !idempotencyKey || isSaving) return;
    setIsSaving(true);
    try {
      const result = await consumeRecipeIngredients(recipe.title, idempotencyKey, deductions);
      onConsumed?.(result);
      const removed = result.updatedItems.filter((item) => item.removed).length;
      Alert.alert('재료 반영 완료', `냉장고 재료 ${result.updatedItems.length}개의 수량을 반영했습니다.${removed ? `\n모두 사용한 재료 ${removed}개는 냉장고에서 제거했습니다.` : ''}`);
      onClose();
    } catch (reason) {
      Alert.alert('재료를 차감하지 못했어요', reason instanceof Error ? reason.message : '다시 시도해주세요.');
    } finally { setIsSaving(false); }
  };

  return <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><Text style={styles.title}>재료 반영 확인</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.description}>자동으로 연결된 재료의 실제 사용량을 확인해주세요. 레시피는 차감 후에도 그대로 남습니다.</Text>
        {isLoading && <ActivityIndicator color={colors.brand.action} style={styles.loader} />}
        {error && <View style={styles.notice}><Text style={styles.error}>{error}</Text></View>}
        {preview?.lines.map((line) => {
          const editable = Boolean(line.itemId && line.currentQuantity);
          const quantity = quantities[line.id] ?? '';
          const invalid = editable && !isValidQuantity(quantity, line.currentQuantity);
          const automaticExpanded = line.status !== 'MATCHED' || editingAutomaticIds.has(line.id);
          const selectedManualItem = line.manualItems?.find((item) => item.itemId === manualItemIds[line.id]);
          const remaining = manualRemaining[line.id] ?? '';
          const manualUnit = manualUnits[line.id] ?? selectedManualItem?.unit ?? '';
          const manualInvalid = Boolean(selectedManualItem && !isValidManualRemaining(remaining, selectedManualItem.currentQuantity, selectedManualItem.unit, manualUnit));
          return <View key={line.id} style={styles.lineCard}>
            <Text style={styles.ingredient}>{line.ingredientName} · 레시피 {line.recipeAmount}</Text>
            {editable && !automaticExpanded ? <>
              <Text style={styles.current}>냉장고: {line.itemName} {line.currentQuantity}{unitLabel(line.unit)}{line.expirationDate ? ` · ${line.expirationDate}` : ''}</Text>
              <View style={styles.autoResultRow}>
                <Text style={styles.autoResult}>{quantity}{unitLabel(line.unit)} 사용 → {roundDisplay(Number(line.currentQuantity) - Number(quantity))}{unitLabel(line.unit)} 남음</Text>
                <Pressable onPress={() => setEditingAutomaticIds((current) => new Set(current).add(line.id))}><Text style={styles.editAction}>수정</Text></Pressable>
              </View>
            </> : editable ? <>
              <Text style={styles.current}>냉장고: {line.itemName} {line.currentQuantity}{unitLabel(line.unit)}{line.expirationDate ? ` · ${line.expirationDate}` : ''}</Text>
              <View style={styles.quantityBlock}>
                <Text style={styles.quantityLabel}>차감량</Text>
                <View style={styles.inputControlRow}><TextInput keyboardType="decimal-pad" onChangeText={(value) => setQuantities((current) => ({ ...current, [line.id]: value }))} style={[styles.input, invalid && styles.inputError]} value={quantity} /><Text style={styles.unit}>{unitLabel(line.unit)}</Text></View>
              </View>
              <Text style={invalid ? styles.error : styles.remaining}>차감 후 {invalid ? '현재 수량 이하로 입력해주세요.' : `${Math.max(0, Number(line.currentQuantity) - Number(quantity || 0)).toFixed(3).replace(/\.?0+$/, '')}${unitLabel(line.unit)}`}</Text>
            </> : line.manualItems?.length ? <>
              <Text style={styles.manualGuide}>{line.message}</Text>
              {line.manualItems.length > 1 && <View style={styles.itemOptions}>{line.manualItems.map((item) => <Pressable
                key={item.itemId}
                onPress={() => {
                  setManualItemIds((current) => ({ ...current, [line.id]: item.itemId }));
                  setManualRemaining((current) => ({ ...current, [line.id]: item.currentQuantity }));
                  setManualUnits((current) => ({ ...current, [line.id]: item.unit }));
                  setOpenUnitLineId(undefined);
                }}
                style={[styles.itemOption, selectedManualItem?.itemId === item.itemId && styles.itemOptionSelected]}
              ><Text style={selectedManualItem?.itemId === item.itemId ? styles.itemOptionTextSelected : styles.itemOptionText}>{item.currentQuantity}{unitLabel(item.unit)} · {item.expirationDate ?? '기한 없음'}</Text></Pressable>)}</View>}
              {selectedManualItem && <>
                <Text style={styles.current}>냉장고: {selectedManualItem.itemName} {selectedManualItem.currentQuantity}{unitLabel(selectedManualItem.unit)}{selectedManualItem.expirationDate ? ` · ${selectedManualItem.expirationDate}` : ''}</Text>
                <View style={styles.quantityBlock}>
                  <Text style={styles.quantityLabel}>요리 후 남은 양</Text>
                  <View style={styles.inputControlRow}>
                    <TextInput keyboardType="decimal-pad" onChangeText={(value) => setManualRemaining((current) => ({ ...current, [line.id]: value }))} style={[styles.input, manualInvalid && styles.inputError]} value={remaining} />
                    <Pressable accessibilityLabel={`저장 단위 ${unitLabel(manualUnit)}`} onPress={() => setOpenUnitLineId((current) => current === line.id ? undefined : line.id)} style={styles.inlineUnitButton}>
                      <Text style={styles.inlineUnitButtonText}>{unitLabel(manualUnit)}</Text>
                      <Text style={styles.inlineUnitHint}>변경</Text>
                    </Pressable>
                  </View>
                </View>
                {openUnitLineId === line.id && <View style={styles.unitOptions}>{UNIT_OPTIONS.map((unit) => <Pressable key={unit} onPress={() => {
                  setManualUnits((current) => ({ ...current, [line.id]: unit }));
                  setOpenUnitLineId(undefined);
                }} style={[styles.unitOptionButton, manualUnit === unit && styles.unitOptionButtonSelected]}><Text style={manualUnit === unit ? styles.unitOptionTextSelected : styles.unitOptionText}>{unitLabel(unit)}</Text></Pressable>)}</View>}
                <Text style={manualInvalid ? styles.error : styles.remaining}>{manualInvalid ? manualUnit === selectedManualItem.unit ? '0 이상 현재 수량 이하로 입력해주세요.' : '변경할 단위의 남은 양을 입력해주세요.' : manualUnit !== selectedManualItem.unit ? `저장 후 ${remaining}${unitLabel(manualUnit)}` : Number(remaining) === Number(selectedManualItem.currentQuantity) ? '남은 양을 줄이면 차감에 포함됩니다.' : `${roundDisplay(Number(selectedManualItem.currentQuantity) - Number(remaining))}${unitLabel(selectedManualItem.unit)} 차감 예정`}</Text>
              </>}
            </> : <Text style={styles.skipped}>{line.message}</Text>}
          </View>;
        })}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.summaryRow}><Text style={styles.summaryText}>반영 예정 {summary.applied}개</Text><Text style={styles.summaryText}>모두 사용 {summary.removed}개</Text><Text style={styles.summaryMuted}>제외·확인 필요 {summary.unresolved}개</Text></View>
        <Button disabled={!deductions.length} label="요리 완료 및 재료 반영" loading={isSaving} onPress={confirm} />
      </View>
    </SafeAreaView>
  </Modal>;
}

function unitLabel(unit?: string) { return ({ COUNT: '개', G: 'g', KG: 'kg', ML: 'ml', L: 'L', PACK: '팩', BAG: '봉', BOTTLE: '병', CAN: '캔' } as Record<string, string>)[unit ?? ''] ?? ''; }
const UNIT_OPTIONS = ['COUNT', 'G', 'KG', 'ML', 'L', 'PACK', 'BAG', 'BOTTLE', 'CAN'] as const;
function isValidQuantity(quantity?: string, currentQuantity?: string) { return Boolean(quantity && /^\d{1,6}(?:\.\d{1,3})?$/.test(quantity) && Number(quantity) > 0 && Number(quantity) <= Number(currentQuantity)); }
function isValidManualRemaining(quantity?: string, currentQuantity?: string, currentUnit?: string, nextUnit?: string) { return Boolean(quantity && /^\d{1,6}(?:\.\d{1,3})?$/.test(quantity) && Number(quantity) >= 0 && (currentUnit !== nextUnit || Number(quantity) <= Number(currentQuantity))); }
function roundDisplay(value: number) { return String(Math.round(value * 1000) / 1000); }

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 }, header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  title: { color: colors.text.primary, ...typography.title }, close: { color: colors.text.secondary, fontSize: 30, lineHeight: 34, paddingHorizontal: spacing.sm }, content: { padding: spacing.xl, paddingBottom: spacing.giant },
  recipeTitle: { color: colors.text.primary, ...typography.heading2 }, description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm }, loader: { marginTop: spacing.xxl }, notice: { backgroundColor: colors.dangerSoft, borderRadius: radii.medium, marginTop: spacing.lg, padding: spacing.md },
  error: { color: colors.danger, ...typography.caption }, lineCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.md, padding: spacing.lg }, ingredient: { color: colors.text.primary, ...typography.bodyStrong }, current: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.sm },
  quantityBlock: { marginTop: spacing.md }, inputControlRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }, quantityLabel: { color: colors.text.secondary, ...typography.label }, input: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.medium, borderWidth: 1, color: colors.text.primary, flex: 1, minHeight: 44, minWidth: 0, paddingHorizontal: spacing.md, ...typography.body }, inputError: { borderColor: colors.danger }, unit: { color: colors.text.primary, ...typography.label, minWidth: 24 },
  remaining: { color: colors.success, ...typography.caption, marginTop: spacing.sm }, skipped: { color: colors.warning, ...typography.caption, marginTop: spacing.sm }, footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.xl },
  autoResultRow: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radii.medium, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, padding: spacing.md }, autoResult: { color: colors.success, ...typography.label, flex: 1 }, editAction: { color: colors.brand.action, ...typography.label, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }, summaryText: { color: colors.text.primary, ...typography.caption, fontWeight: '800' }, summaryMuted: { color: colors.text.muted, ...typography.caption },
  manualGuide: { color: colors.warning, ...typography.caption, marginTop: spacing.sm }, itemOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }, itemOption: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.full, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, itemOptionSelected: { backgroundColor: colors.brand.action, borderColor: colors.brand.action }, itemOptionText: { color: colors.text.secondary, ...typography.caption }, itemOptionTextSelected: { color: colors.text.inverse, ...typography.caption, fontWeight: '800' },
  inlineUnitButton: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: radii.medium, justifyContent: 'center', minHeight: 44, minWidth: 64, paddingHorizontal: spacing.sm }, inlineUnitButtonText: { color: colors.brand.action, ...typography.bodyStrong, fontWeight: '800' }, inlineUnitHint: { color: colors.brand.action, fontSize: 10, fontWeight: '700' }, unitOptions: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm }, unitOptionButton: { backgroundColor: colors.surfaceMuted, borderRadius: radii.small, minHeight: 44, minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.md }, unitOptionButtonSelected: { backgroundColor: colors.brand.action }, unitOptionText: { color: colors.text.secondary, fontWeight: '700', textAlign: 'center' }, unitOptionTextSelected: { color: colors.text.inverse, fontWeight: '700', textAlign: 'center' },
});
