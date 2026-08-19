import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
        {editingItem ? '식재료 정보 수정' : '인식 결과 확인 및 등록'}
      </Text>
      <Text style={styles.helper}>
        {editingItem
          ? '저장하면 냉장고 목록에 바로 반영됩니다.'
          : '구매일은 등록하는 오늘 날짜로 자동 저장됩니다.'}
      </Text>

      <Text style={styles.label}>식재료 이름</Text>
      <TextInput
        editable={!isSaving}
        maxLength={100}
        onChangeText={setName}
        placeholder="예: 우유"
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
            style={styles.input}
            value={purchasedAt}
          />
        </>
      )}

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <View style={editingItem ? styles.editActions : undefined}>
        {editingItem && (
          <Pressable
            disabled={isSaving}
            onPress={props.onCancel}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void save()}
          style={[
            styles.saveButton,
            editingItem && styles.editSaveButton,
            isSaving && styles.disabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {editingItem ? '수정 내용 저장' : '냉장고에 등록'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { backgroundColor: '#ffffff', borderColor: '#dfe8df', borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 18 },
  title: { color: '#253b2e', fontSize: 18, fontWeight: '800' },
  helper: { color: '#67746b', fontSize: 13, lineHeight: 19, marginTop: 5 },
  label: { color: '#34463a', fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 17 },
  input: { backgroundColor: '#faf9f6', borderColor: '#d8ddd8', borderRadius: 12, borderWidth: 1, color: '#203027', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  quantityRow: { flexDirection: 'row', gap: 10 },
  quantityInput: { flex: 1 },
  unitButton: { alignItems: 'center', backgroundColor: '#edf4ed', borderRadius: 12, justifyContent: 'center', minWidth: 86, paddingHorizontal: 14 },
  unitButtonText: { color: '#2f6b45', fontSize: 16, fontWeight: '800' },
  unitOptions: { backgroundColor: '#ffffff', borderColor: '#d8ddd8', borderRadius: 12, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, padding: 10 },
  unitOption: { backgroundColor: '#f3f3f0', borderRadius: 9, minWidth: 48, paddingHorizontal: 10, paddingVertical: 9 },
  unitOptionSelected: { backgroundColor: '#2f6b45' },
  unitText: { color: '#465249', fontWeight: '700', textAlign: 'center' },
  unitSelectedText: { color: '#ffffff', fontWeight: '700', textAlign: 'center' },
  labelRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  clearAction: { color: '#2f6b45', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  candidates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  dateCandidate: { backgroundColor: '#f3f3f0', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  dateCandidateSelected: { backgroundColor: '#dcecdc' },
  dateCandidateText: { color: '#36513f', fontSize: 13, fontWeight: '700' },
  error: { color: '#9b4037', fontSize: 14, lineHeight: 20, marginTop: 12 },
  saveButton: { alignItems: 'center', backgroundColor: '#2f6b45', borderRadius: 14, marginTop: 18, padding: 15 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  editSaveButton: { flex: 1, marginTop: 0 },
  cancelButton: { alignItems: 'center', borderColor: '#b8c4ba', borderRadius: 14, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 22 },
  cancelButtonText: { color: '#536159', fontSize: 16, fontWeight: '800' },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
