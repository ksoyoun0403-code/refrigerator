import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import {
  deleteExpirationItem,
  getExpirationItems,
  updateExpirationItem,
} from './expirationApi';
import { ExpirationImageScanner } from './ExpirationImageScanner';
import { ExpirationRegistrationForm } from './ExpirationRegistrationForm';
import { ExpirationItem } from './types';

type ManageMode = 'idle' | 'editing' | 'deleting';

type PreviousPlacement = {
  id: string;
  section: ExpirationItem['section'];
};

export function ExpirationHomeScreen() {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ExpirationItem>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [manageMode, setManageMode] = useState<ManageMode>('idle');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const [previousPlacement, setPreviousPlacement] = useState<PreviousPlacement[]>();

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      setItems(await getExpirationItems());
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!previousPlacement) return;
    const timer = setTimeout(() => setPreviousPlacement(undefined), 5000);
    return () => clearTimeout(timer);
  }, [previousPlacement]);

  const itemRegistered = async (item: ExpirationItem) => {
    setItems((current) => sortItemsForDisplay([...current, item]));
    await loadItems();
  };

  const removeItem = async (item: ExpirationItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteExpirationItem(item.id);
      setItems((current) => current.filter(({ id }) => id !== item.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    } catch (error) {
      Alert.alert(
        '삭제하지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setDeletingId(undefined);
    }
  };

  const confirmDelete = (item: ExpirationItem) => {
    Alert.alert(
      '식재료 삭제',
      `${item.name}을(를) 삭제할까요? 연결된 스캔 기록도 함께 삭제합니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void removeItem(item) },
      ],
    );
  };

  const enterManageMode = (mode: Exclude<ManageMode, 'idle'>) => {
    setManageMode(mode);
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const exitManageMode = () => {
    if (isMovingSelection || deletingId) return;
    setManageMode('idle');
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const toggleSelection = (item: ExpirationItem) => {
    if (isMovingSelection) return;
    if (!selectedIds.has(item.id)) {
      const firstSelectedItem = items.find(({ id }) => selectedIds.has(id));
      if (firstSelectedItem && firstSelectedItem.section !== item.section) {
        Alert.alert(
          '같은 영역의 재료만 선택할 수 있어요',
          '현재 선택을 취소한 뒤 다른 영역의 재료를 선택해주세요.',
        );
        return;
      }
    }
    setPreviousPlacement(undefined);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const clearSelection = () => {
    if (isMovingSelection) return;
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const moveSelection = async (section: ExpirationItem['section']) => {
    if (isMovingSelection || selectedIds.size === 0) return;
    const movingItems = items.filter(
      (item) => selectedIds.has(item.id) && item.section !== section,
    );
    if (movingItems.length === 0) {
      Alert.alert('이동할 재료가 없어요', '선택한 재료가 이미 해당 영역에 있습니다.');
      return;
    }

    setIsMovingSelection(true);
    const updatedItems: ExpirationItem[] = [];
    const failedItems: ExpirationItem[] = [];
    for (const item of movingItems) {
      try {
        updatedItems.push(await updateExpirationItem(item.id, { section }));
      } catch {
        failedItems.push(item);
      }
    }

    const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
    setItems((current) => sortItemsForDisplay(
      current.map((item) => updatedById.get(item.id) ?? item),
    ));
    setSelectedIds(new Set(failedItems.map((item) => item.id)));
    setPreviousPlacement(
      updatedItems.length > 0
        ? updatedItems.map((item) => ({
            id: item.id,
            section: movingItems.find(({ id }) => id === item.id)!.section,
          }))
        : undefined,
    );
    setIsMovingSelection(false);

    if (failedItems.length > 0) {
      Alert.alert(
        '일부 재료를 이동하지 못했어요',
        `${updatedItems.length}개는 이동했고 ${failedItems.length}개는 이동하지 못했습니다. 다시 시도해주세요.`,
      );
    }
  };

  const undoMove = async () => {
    if (!previousPlacement || isMovingSelection) return;
    const placement = previousPlacement;
    setPreviousPlacement(undefined);
    setIsMovingSelection(true);
    const restoredItems: ExpirationItem[] = [];
    let failureCount = 0;
    for (const previous of placement) {
      try {
        restoredItems.push(
          await updateExpirationItem(previous.id, { section: previous.section }),
        );
      } catch {
        failureCount += 1;
      }
    }
    const restoredById = new Map(restoredItems.map((item) => [item.id, item]));
    setItems((current) => sortItemsForDisplay(
      current.map((item) => restoredById.get(item.id) ?? item),
    ));
    setIsMovingSelection(false);
    if (failureCount > 0) {
      Alert.alert('일부 이동을 되돌리지 못했어요', '목록을 새로 불러와 상태를 확인해주세요.');
      await loadItems();
    }
  };

  const itemUpdated = async (updatedItem: ExpirationItem) => {
    setSelectedItem(undefined);
    setItems((current) =>
      current.map((item) => item.id === updatedItem.id ? updatedItem : item),
    );
    await loadItems();
    Alert.alert('수정 완료', `${updatedItem.name} 정보를 수정했습니다.`);
  };

  if (selectedItem) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.editContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>MYDISH</Text>
          <Text style={styles.editPageTitle}>식재료 정보</Text>
          <ExpirationRegistrationForm
            item={selectedItem}
            onCancel={() => setSelectedItem(undefined)}
            onUpdated={itemUpdated}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const useSoonItems = items.filter((item) => item.section === 'USE_SOON');
  const defaultItems = items.filter((item) => item.section === 'DEFAULT');
  const selectedSection = items.find((item) => selectedIds.has(item.id))?.section;
  const targetSection = selectedSection === 'DEFAULT' ? 'USE_SOON' : 'DEFAULT';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          manageMode === 'editing' && styles.containerWithSelectionBar,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>MYDISH</Text>
        <Text style={styles.title}>유통기한을 사진 한 장으로</Text>
        <Text style={styles.description}>
          사진을 찍으면 인식 결과를 확인한 뒤 냉장고 목록에 바로 저장할 수 있어요.
        </Text>

        <ExpirationImageScanner onRegistered={itemRegistered} />

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>냉장고 목록</Text>
          {manageMode === 'idle' ? (
            <View style={styles.manageActions}>
              {loadFailed && (
                <Pressable onPress={() => void loadItems()}>
                  <Text style={styles.retry}>다시 불러오기</Text>
                </Pressable>
              )}
              {items.length > 0 && (
                <>
                  <Pressable onPress={() => enterManageMode('editing')} style={styles.manageButton}>
                    <Text style={styles.manageButtonText}>편집</Text>
                  </Pressable>
                  <Pressable onPress={() => enterManageMode('deleting')} style={styles.deleteModeButton}>
                    <Text style={styles.deleteModeButtonText}>삭제</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <Pressable disabled={isMovingSelection || Boolean(deletingId)} onPress={exitManageMode}>
              <Text style={styles.doneAction}>완료</Text>
            </Pressable>
          )}
        </View>

        {manageMode === 'editing' && (
          <Text style={styles.modeDescription}>
            옮길 재료를 선택한 뒤 이동할 영역을 눌러주세요.
          </Text>
        )}
        {manageMode === 'deleting' && (
          <Text style={styles.modeDescription}>
            카드 오른쪽 위의 ×를 누르면 재료를 삭제할 수 있어요.
          </Text>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.brand.action} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 등록한 식품이 없어요</Text>
            <Text style={styles.emptyDescription}>첫 번째 사진을 찍어서 재료를 추가해보세요.</Text>
          </View>
        ) : (
          <View style={styles.itemGroups}>
            <View>
              <Text style={styles.groupTitle}>사용 임박</Text>
              {useSoonItems.length > 0 ? (
                <ItemGroup
                  deletingId={deletingId}
                  items={useSoonItems}
                  manageMode={manageMode}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onSelect={toggleSelection}
                  selectedIds={selectedIds}
                />
              ) : (
                <View style={styles.emptyDropZone}>
                  <Text style={styles.emptyDropText}>사용 임박 재료가 없어요</Text>
                </View>
              )}
            </View>

            {defaultItems.length > 0 && (
              <View>
                <Text style={styles.groupTitle}>일반 냉장고</Text>
                <ItemGroup
                  deletingId={deletingId}
                  items={defaultItems}
                  manageMode={manageMode}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onSelect={toggleSelection}
                  selectedIds={selectedIds}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {manageMode === 'editing' && (
        <View style={styles.selectionBar}>
          {previousPlacement && previousPlacement.length > 0 ? (
            <View style={styles.undoRow}>
              <Text style={styles.undoMessage}>{previousPlacement.length}개 재료를 이동했어요.</Text>
              <Pressable disabled={isMovingSelection} onPress={() => void undoMove()}>
                <Text style={styles.undoAction}>되돌리기</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.selectionCount}>선택 {selectedIds.size}개</Text>
          )}
          {selectedSection && (
            <View style={styles.placementActions}>
              <Button
                disabled={isMovingSelection}
                label="선택 취소"
                onPress={clearSelection}
                style={styles.cancelSelectionButton}
                variant="secondary"
              />
              <Button
                disabled={isMovingSelection}
                label={targetSection === 'USE_SOON'
                  ? '사용 임박으로 이동'
                  : '일반 냉장고로 이동'}
                loading={isMovingSelection}
                onPress={() => void moveSelection(targetSection)}
                style={styles.placementButton}
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function ItemGroup({
  deletingId,
  items,
  manageMode,
  onDelete,
  onEdit,
  onSelect,
  selectedIds,
}: {
  deletingId?: string;
  items: ExpirationItem[];
  manageMode: ManageMode;
  onDelete(item: ExpirationItem): void;
  onEdit(item: ExpirationItem): void;
  onSelect(item: ExpirationItem): void;
  selectedIds: Set<string>;
}) {
  return (
    <View style={styles.cardGrid}>
      {items.map((item) => (
        <ItemCard
          deleting={deletingId === item.id}
          item={item}
          key={item.id}
          manageMode={manageMode}
          onDelete={() => onDelete(item)}
          onEdit={() => onEdit(item)}
          onSelect={() => onSelect(item)}
          selected={selectedIds.has(item.id)}
        />
      ))}
    </View>
  );
}

function ItemCard({
  deleting,
  item,
  manageMode,
  onDelete,
  onEdit,
  onSelect,
  selected,
}: {
  deleting: boolean;
  item: ExpirationItem;
  manageMode: ManageMode;
  onDelete(): void;
  onEdit(): void;
  onSelect(): void;
  selected: boolean;
}) {
  const onPress = manageMode === 'editing' ? onSelect : manageMode === 'idle' ? onEdit : undefined;

  return (
    <Pressable
      accessibilityHint={
        manageMode === 'editing'
          ? '이동할 식재료로 선택합니다'
          : manageMode === 'idle'
            ? '식재료 정보를 수정합니다'
            : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ selected: manageMode === 'editing' ? selected : undefined }}
      disabled={deleting}
      onPress={onPress}
      style={({ pressed }) => [
        styles.itemCard,
        selected && styles.itemCardSelected,
        pressed && styles.itemCardPressed,
      ]}
    >
      {manageMode === 'editing' && (
        <View style={[styles.selectionIndicator, selected && styles.selectionIndicatorSelected]}>
          {selected && <Text style={styles.selectionCheck}>✓</Text>}
        </View>
      )}
      {manageMode === 'deleting' && (
        <Pressable
          accessibilityLabel={`${item.name} 삭제`}
          accessibilityRole="button"
          disabled={deleting}
          hitSlop={8}
          onPress={onDelete}
          style={styles.cardDeleteButton}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={styles.cardDeleteText}>×</Text>
          )}
        </Pressable>
      )}
      <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
      <Text style={[styles.itemDate, !item.expirationDate && styles.missingDate]}>
        {item.expirationDate?.replaceAll('-', '.') ?? '기한 미입력'}
      </Text>
    </Pressable>
  );
}

function sortItemsForDisplay(items: ExpirationItem[]) {
  return [...items].sort((left, right) => {
    if (left.section !== right.section) {
      return left.section === 'USE_SOON' ? -1 : 1;
    }
    if (left.expirationDate !== right.expirationDate) {
      if (!left.expirationDate) return 1;
      if (!right.expirationDate) return -1;
      return left.expirationDate.localeCompare(right.expirationDate);
    }
    return left.purchasedAt.localeCompare(right.purchasedAt) ||
      left.createdAt.localeCompare(right.createdAt);
  });
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.xxl, paddingBottom: spacing.giant },
  containerWithSelectionBar: { paddingBottom: 160 },
  editContainer: { padding: spacing.xxl, paddingBottom: spacing.giant },
  eyebrow: { color: colors.brand.action, ...typography.caption, fontWeight: '800', letterSpacing: 1.6, marginTop: spacing.xl },
  title: { color: colors.text.primary, ...typography.display, marginTop: spacing.sm },
  editPageTitle: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.sm },
  description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xxxl },
  sectionTitle: { color: colors.text.primary, ...typography.heading2 },
  retry: { color: colors.brand.action, ...typography.label, minHeight: interaction.minimumTouchSize, paddingVertical: spacing.md },
  manageActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  manageButton: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: radii.medium, justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  manageButtonText: { color: colors.brand.action, ...typography.caption, fontWeight: '800' },
  deleteModeButton: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.medium, justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  deleteModeButtonText: { color: colors.danger, ...typography.caption, fontWeight: '800' },
  doneAction: { color: colors.brand.action, ...typography.label, fontWeight: '800', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.xs, paddingVertical: spacing.md },
  modeDescription: { color: colors.text.muted, ...typography.caption, marginBottom: spacing.lg, marginTop: -spacing.xs },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.xxxl },
  emptyTitle: { color: colors.text.primary, ...typography.bodyStrong },
  emptyDescription: { color: colors.text.muted, ...typography.label, fontWeight: '400', marginTop: spacing.sm, textAlign: 'center' },
  itemGroups: { gap: spacing.xxl },
  groupTitle: { color: colors.text.secondary, ...typography.label, fontWeight: '800', marginBottom: spacing.xs },
  emptyDropZone: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.large, borderStyle: 'dashed', borderWidth: 1, padding: spacing.xl },
  emptyDropText: { color: colors.text.muted, ...typography.caption, fontWeight: '600' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  itemCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, justifyContent: 'space-between', minHeight: 108, padding: spacing.lg, width: '48%' },
  itemCardSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary, borderWidth: 2, padding: 15 },
  itemCardPressed: { opacity: interaction.pressedOpacity },
  itemName: { color: colors.text.primary, fontSize: 16, fontWeight: '800', lineHeight: 22, paddingRight: spacing.xxl },
  itemDate: { color: colors.text.secondary, ...typography.label, marginTop: spacing.lg },
  missingDate: { color: colors.text.muted, fontWeight: '600' },
  selectionIndicator: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: radii.full, borderWidth: 1.5, height: 24, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, width: 24 },
  selectionIndicatorSelected: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  selectionCheck: { color: colors.text.inverse, fontSize: 13, fontWeight: '900', lineHeight: 17 },
  cardDeleteButton: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.full, height: interaction.minimumTouchSize, justifyContent: 'center', position: 'absolute', right: spacing.xs, top: spacing.xs, width: interaction.minimumTouchSize, zIndex: 1 },
  cardDeleteText: { color: colors.danger, fontSize: 24, fontWeight: '600', lineHeight: 26 },
  selectionBar: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, left: 0, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, position: 'absolute', right: 0 },
  selectionCount: { color: colors.text.secondary, ...typography.caption, fontWeight: '700', marginBottom: spacing.sm },
  placementActions: { flexDirection: 'row', gap: spacing.sm },
  cancelSelectionButton: { borderRadius: radii.medium, flex: 1 },
  placementButton: { borderRadius: radii.medium, flex: 1 },
  undoRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  undoMessage: { color: colors.text.secondary, ...typography.caption, fontWeight: '700' },
  undoAction: { color: colors.brand.action, ...typography.caption, fontWeight: '900', minHeight: interaction.minimumTouchSize, paddingVertical: spacing.md },
});
