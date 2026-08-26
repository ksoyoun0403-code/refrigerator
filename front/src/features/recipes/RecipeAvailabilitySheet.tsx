import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { checkRecipeAvailability } from './recipeConsumptionApi';
import { RecipeConsumptionPreview, RecipeSuggestion } from './types';

export function RecipeAvailabilitySheet({ onClose, recipe, visible }: { onClose(): void; recipe: RecipeSuggestion; visible: boolean }) {
  const [preview, setPreview] = useState<RecipeConsumptionPreview>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setPreview(undefined); setError(undefined); setIsLoading(true);
    void checkRecipeAvailability(recipe)
      .then(setPreview)
      .catch((reason) => setError(reason instanceof Error ? reason.message : '재료 보유 현황을 확인하지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, [recipe, visible]);

  const counts = useMemo(() => ({
    available: preview?.lines.filter((line) => line.status === 'MATCHED').length ?? 0,
    attention: preview?.lines.filter((line) => line.status !== 'MATCHED').length ?? 0,
  }), [preview]);
  const canCook = Boolean(preview?.lines.length && counts.attention === 0);

  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.modalBackdrop}>
    <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && styles.webSafeArea]}>
      <View style={styles.header}><Text style={styles.title}>보유 재료 확인</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        {isLoading && <ActivityIndicator color={colors.brand.action} style={styles.loader} />}
        {error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>}
        {preview && <>
          <View style={[styles.resultBox, canCook ? styles.successBox : styles.warningBox]}>
            <Text style={canCook ? styles.successTitle : styles.warningTitle}>{canCook ? '현재 재료로 만들 수 있어요' : '확인이 필요한 재료가 있어요'}</Text>
            <Text style={styles.resultSummary}>사용 가능 {counts.available}개 · 확인 필요 {counts.attention}개</Text>
          </View>
          <View style={styles.list}>{preview.lines.map((line) => {
            const presentation = statusPresentation(line.status, Boolean(line.manualItems?.length));
            return <View key={line.id} style={styles.line}>
              <View style={styles.lineHeader}><Text style={styles.ingredient}>{line.ingredientName}</Text><Text style={[styles.badge, { color: presentation.color, backgroundColor: presentation.background }]}>{presentation.label}</Text></View>
              <Text style={styles.recipeAmount}>레시피 필요량: {line.recipeAmount}</Text>
              {line.itemId ? <Text style={styles.inventory}>보관 중: {line.itemName} {line.currentQuantity}{unitLabel(line.unit)}{line.expirationDate ? ` · ${line.expirationDate}` : ''}</Text>
                : line.manualItems?.length ? <Text style={styles.inventory}>보관 중: {line.manualItems.map((item) => `${item.itemName} ${item.currentQuantity}${unitLabel(item.unit)}`).join(' · ')}</Text>
                  : <Text style={styles.missing}>냉장고에 같은 이름의 재료가 없어요.</Text>}
              {line.message && line.status !== 'MATCHED' && <Text style={styles.message}>{line.message}</Text>}
            </View>;
          })}</View>
        </>}
      </ScrollView>
      <View style={styles.footer}><Button label="확인" onPress={onClose} /></View>
    </SafeAreaView>
    </View>
  </Modal>;
}

function statusPresentation(status: string, hasManualItem: boolean) {
  if (status === 'MATCHED') return { label: '충분함', color: colors.success, background: colors.successSoft };
  if (status === 'INSUFFICIENT') return { label: '수량 부족', color: colors.danger, background: colors.dangerSoft };
  if (status === 'NOT_FOUND') return { label: '보관 재료 없음', color: colors.danger, background: colors.dangerSoft };
  return { label: hasManualItem ? '직접 확인 필요' : '확인 필요', color: colors.warning, background: colors.warningSoft };
}
function unitLabel(unit?: string) { return ({ COUNT: '개', G: 'g', KG: 'kg', ML: 'ml', L: 'L', PACK: '팩', BAG: '봉', BOTTLE: '병', CAN: '캔' } as Record<string, string>)[unit ?? ''] ?? ''; }

const styles = StyleSheet.create({
  modalBackdrop: { alignItems: 'center', backgroundColor: '#EDE7DF', flex: 1 },
  webSafeArea: { maxWidth: 430, width: '100%' },
  safeArea: { backgroundColor: colors.canvas, flex: 1 }, header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md }, title: { color: colors.text.primary, ...typography.title }, close: { color: colors.text.secondary, fontSize: 30, lineHeight: 34, paddingHorizontal: spacing.sm },
  content: { padding: spacing.xl, paddingBottom: spacing.giant }, recipeTitle: { color: colors.text.primary, ...typography.heading2 }, loader: { marginTop: spacing.xxl }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radii.medium, marginTop: spacing.lg, padding: spacing.md }, error: { color: colors.danger, ...typography.caption },
  resultBox: { borderRadius: radii.large, marginTop: spacing.lg, padding: spacing.lg }, successBox: { backgroundColor: colors.successSoft }, warningBox: { backgroundColor: colors.warningSoft }, successTitle: { color: colors.success, ...typography.title }, warningTitle: { color: colors.warning, ...typography.title }, resultSummary: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  list: { gap: spacing.md, marginTop: spacing.lg }, line: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.lg }, lineHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }, ingredient: { color: colors.text.primary, ...typography.bodyStrong, flex: 1 }, badge: { borderRadius: radii.full, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, ...typography.caption, fontWeight: '800' }, recipeAmount: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.sm }, inventory: { color: colors.success, ...typography.caption, marginTop: spacing.xs }, missing: { color: colors.danger, ...typography.caption, marginTop: spacing.xs }, message: { color: colors.warning, ...typography.caption, marginTop: spacing.sm }, footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.xl },
});
