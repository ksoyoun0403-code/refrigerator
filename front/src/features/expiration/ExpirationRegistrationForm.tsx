import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import { createExpirationItem, updateExpirationItem } from './expirationApi';
import {
  EXPIRATION_ITEM_UNITS,
  ExpirationItem,
  ExpirationItemUnit,
  ExpirationScanResult,
} from './types';

const UNIT_LABELS: Record<ExpirationItemUnit, string> = {
  COUNT: '개',
  G: 'g',
  KG: 'kg',
  ML: 'ml',
  L: 'L',
  PACK: '팩',
  BAG: '봉',
  BOTTLE: '병',
  CAN: '캔',
};

type RegistrationProps = {
  scan: ExpirationScanResult;
  item?: never;
  onRegistered(item: ExpirationItem): void | Promise<void>;
  onUpdated?: never;
  onCancel?: never;
};

type EditProps = {
  scan?: never;
  item: ExpirationItem;
  onRegistered?: never;
  onUpdated(item: ExpirationItem): void | Promise<void>;
  onCancel(): void;
};

type Props = RegistrationProps | EditProps;

export function ExpirationRegistrationForm(props: Props) {
  const editingItem = props.item;
  const scan = props.scan;
  const [name, setName] = useState(editingItem?.name ?? '');
  const [quantity, setQuantity] = useState(editingItem?.quantity ?? '1');
  const [unit, setUnit] = useState<ExpirationItemUnit>(
    editingItem?.unit ?? 'COUNT',
  );
  const [isUnitOpen, setIsUnitOpen] = useState(false);
  const [expirationDate, setExpirationDate] = useState(
    editingItem?.expirationDate ?? scan?.candidates[0]?.expirationDate ?? '',
  );
  const [purchasedAt, setPurchasedAt] = useState(editingItem?.purchasedAt ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const save = async () => {
    if (isSaving) return;
    if (!name.trim()) {
      setErrorMessage('식재료 이름을 입력해주세요.');
      return;
    }
    if (!/^\d{1,6}(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
      setErrorMessage('0보다 큰 수량을 입력해주세요.');
      return;
    }
    if (expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
      setErrorMessage('유통기한은 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(undefined);
    try {
      if (editingItem) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt)) {
          setErrorMessage('구매일은 YYYY-MM-DD 형식으로 입력해주세요.');
          return;
        }
        const item = await updateExpirationItem(editingItem.id, {
          name: name.trim(),
          quantity,
          unit,
          purchasedAt,
          expirationDate: expirationDate || null,
        });
        await props.onUpdated(item);
      } else if (scan) {
        const item = await createExpirationItem({
          scanId: scan.scanId,
          name: name.trim(),
          quantity,
          unit,
          expirationDate: expirationDate || null,
        });
        await props.onRegistered(item);
      } else {
        throw new Error('등록할 스캔 정보가 없습니다.');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '식재료를 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.title}>
        {editingItem ? '??? ?? ??' : '?? ?? ?? ? ??'}
      </Text>
      <Text style={styles.helper}>
        {editingItem
          ? '???? ??? ??? ?? ????.'
          : '???? ?? ??? ?? ????.'}
      </Text>

      <Text style={styles.label}>식재료 이름</Text>
      <TextInput
        editable={!isSaving}
        maxLength={100}
        onChangeText={setName}
        placeholder="예: 우유"
        placeholderTextColor={colors.text.muted}
        selectionColor={colors.brand.primary}
        style={styles.input}
        value={name}
      />

      <Text style={styles.label}>수량</Text>
      <View style={styles.quantityRow}>
        <TextInput
          editable={!isSaving}
          keyboardType="decimal-pad"
          maxLength={10}
          onChangeText={setQuantity}
          selectionColor={colors.brand.primary}
          style={[styles.input, styles.quantityInput]}
          value={quantity}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => setIsUnitOpen((open) => !open)}
          style={styles.unitButton}
        >
          <Text style={styles.unitButtonText}>{UNIT_LABELS[unit]} ⌄</Text>
        </Pressable>
      </View>
      {isUnitOpen && (
        <View style={styles.unitOptions}>
          {EXPIRATION_ITEM_UNITS.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setUnit(option);
                setIsUnitOpen(false);
              }}
              style={[styles.unitOption, option === unit && styles.unitOptionSelected]}
            >
              <Text style={option === unit ? styles.unitSelectedText : styles.unitText}>
                {UNIT_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.labelRow}>
        <Text style={styles.label}>유통기한 (선택)</Text>
        <Pressable disabled={isSaving} onPress={() => setExpirationDate('')}>
          <Text style={styles.clearAction}>입력 안 함</Text>
        </Pressable>
      </View>
      {scan && scan.candidates.length > 0 && (
        <View style={styles.candidates}>
          {scan.candidates.map((candidate) => (
            <Pressable
              key={`${candidate.expirationDate}-${candidate.rawText}`}
              onPress={() => setExpirationDate(candidate.expirationDate)}
              style={[
                styles.dateCandidate,
                expirationDate === candidate.expirationDate && styles.dateCandidateSelected,
              ]}
            >
              <Text style={styles.dateCandidateText}>{candidate.expirationDate}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextInput
        editable={!isSaving}
        maxLength={10}
        onChangeText={setExpirationDate}
        placeholder="YYYY-MM-DD 또는 비워두기"
        placeholderTextColor={colors.text.muted}
        selectionColor={colors.brand.primary}
        style={styles.input}
        value={expirationDate}
      />

      {editingItem && (
        <>
          <Text style={styles.label}>구매일</Text>
          <TextInput
            editable={!isSaving}
            maxLength={10}
            onChangeText={setPurchasedAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            selectionColor={colors.brand.primary}
            style={styles.input}
            value={purchasedAt}
          />
        </>
      )}

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <View style={editingItem ? styles.editActions : undefined}>
        {editingItem && (
          <Button
            disabled={isSaving}
            label="취소"
            onPress={props.onCancel}
            style={styles.cancelButton}
            variant="secondary"
          />
        )}
        <Button
          disabled={isSaving}
          label={editingItem ? '수정 내용 저장' : '냉장고에 등록'}
          loading={isSaving}
          onPress={() => void save()}
          style={[
            styles.saveButton,
            editingItem && styles.editSaveButton,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.lg, padding: spacing.xl },
  title: { color: colors.text.primary, ...typography.title, fontWeight: '800' },
  helper: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  label: { color: colors.text.primary, ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },
  input: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, color: colors.text.primary, fontSize: typography.body.fontSize, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  quantityRow: { flexDirection: 'row', gap: spacing.sm },
  quantityInput: { flex: 1 },
  unitButton: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: radii.medium, justifyContent: 'center', minHeight: 48, minWidth: 86, paddingHorizontal: spacing.md },
  unitButtonText: { color: colors.brand.action, ...typography.bodyStrong, fontWeight: '800' },
  unitOptions: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm },
  unitOption: { backgroundColor: colors.surfaceMuted, borderRadius: radii.small, minHeight: interaction.minimumTouchSize, minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  unitOptionSelected: { backgroundColor: colors.brand.action },
  unitText: { color: colors.text.secondary, fontWeight: '700', textAlign: 'center' },
  unitSelectedText: { color: colors.text.inverse, fontWeight: '700', textAlign: 'center' },
  labelRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  clearAction: { color: colors.brand.action, ...typography.caption, fontWeight: '700', marginBottom: spacing.sm, minHeight: interaction.minimumTouchSize },
  candidates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  dateCandidate: { backgroundColor: colors.surfaceMuted, borderColor: 'transparent', borderRadius: radii.small, borderWidth: 1, minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dateCandidateSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary },
  dateCandidateText: { color: colors.text.secondary, ...typography.caption, fontWeight: '700' },
  error: { color: colors.danger, ...typography.label, marginTop: spacing.md },
  saveButton: { marginTop: spacing.xl },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  editSaveButton: { flex: 1, marginTop: 0 },
  cancelButton: { flex: 1 },
});
