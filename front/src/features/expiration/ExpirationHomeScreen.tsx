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
import {
  deleteExpirationItem,
  getExpirationItems,
  updateExpirationItem,
} from './expirationApi';
import { ExpirationImageScanner } from './ExpirationImageScanner';
import { ExpirationRegistrationForm } from './ExpirationRegistrationForm';
import { ExpirationItem } from './types';

const UNIT_LABELS: Record<ExpirationItem['unit'], string> = {
  COUNT: '개', G: 'g', KG: 'kg', ML: 'ml', L: 'L', PACK: '팩',
  BAG: '봉', BOTTLE: '병', CAN: '캔',
};

export function ExpirationHomeScreen() {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ExpirationItem>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [movingId, setMovingId] = useState<string>();

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

  const removeItem = async (item: ExpirationItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteExpirationItem(item.id);
      setItems((current) => current.filter(({ id }) => id !== item.id));
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

  const moveItem = async (item: ExpirationItem) => {
    if (movingId) return;
    const section = item.section === 'DEFAULT' ? 'USE_SOON' : 'DEFAULT';
    setMovingId(item.id);
    setItems((current) => {
      const lastUseSoonOrder = current
        .filter(({ section: currentSection }) => currentSection === 'USE_SOON')
        .reduce((maximum, currentItem) => Math.max(maximum, currentItem.sortOrder), -1);
      return sortItemsForDisplay(
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                section,
                sortOrder: section === 'USE_SOON'
                  ? lastUseSoonOrder + 1
                  : currentItem.sortOrder,
              }
            : currentItem,
        ),
      );
    });
    try {
      const updatedItem = await updateExpirationItem(item.id, { section });
      setItems((current) => sortItemsForDisplay(
        current.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      ));
    } catch (error) {
      setItems((current) => sortItemsForDisplay(
        current.map((currentItem) => currentItem.id === item.id ? item : currentItem),
      ));
      Alert.alert(
        '이동하지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setMovingId(undefined);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>MYDISH</Text>
        <Text style={styles.title}>유통기한을 사진 한 장으로</Text>
        <Text style={styles.description}>
          식품 사진을 인식하고 정보를 확인한 뒤 냉장고 목록에 저장합니다.
        </Text>

        <ExpirationImageScanner onRegistered={loadItems} />

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>냉장고 목록</Text>
          {loadFailed && (
            <Pressable onPress={() => void loadItems()}>
              <Text style={styles.retry}>다시 불러오기</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color="#2f6b45" />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 등록한 식품이 없어요</Text>
            <Text style={styles.emptyDescription}>첫 번째 식품 사진을 등록해보세요.</Text>
          </View>
        ) : (
          <View style={styles.itemGroups}>
            <View>
              <Text style={styles.groupTitle}>사용 임박</Text>
              {useSoonItems.length > 0 ? (
                <ItemGroup
                  deletingId={deletingId}
                  items={useSoonItems}
                  movingId={movingId}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onMove={moveItem}
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
                  movingId={movingId}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onMove={moveItem}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ItemGroup({
  deletingId,
  items,
  movingId,
  onDelete,
  onEdit,
  onMove,
}: {
  deletingId?: string;
  items: ExpirationItem[];
  movingId?: string;
  onDelete(item: ExpirationItem): void;
  onEdit(item: ExpirationItem): void;
  onMove(item: ExpirationItem): void;
}) {
  return (
    <View style={styles.groupCard}>
      {items.map((item) => (
        <ItemRow
          deleting={deletingId === item.id}
          item={item}
          key={item.id}
          moving={movingId === item.id}
          onDelete={() => onDelete(item)}
          onEdit={() => onEdit(item)}
          onMove={() => onMove(item)}
        />
      ))}
    </View>
  );
}

function ItemRow({
  deleting,
  item,
  moving,
  onDelete,
  onEdit,
  onMove,
}: {
  deleting: boolean;
  item: ExpirationItem;
  moving: boolean;
  onDelete(): void;
  onEdit(): void;
  onMove(): void;
}) {
  return (
    <View style={styles.itemRow}>
      <Pressable
        accessibilityHint="식재료 정보를 수정합니다"
        accessibilityRole="button"
        disabled={deleting || moving}
        onPress={onEdit}
        style={styles.itemSummary}
      >
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemQuantity}>
          {item.quantity}{UNIT_LABELS[item.unit]} · 구매 {item.purchasedAt}
        </Text>
      </Pressable>
      <View style={styles.itemActions}>
        <Text style={styles.itemDate}>
          {item.expirationDate ?? '유통기한 없음'}
        </Text>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityRole="button"
            disabled={deleting || moving}
            onPress={onMove}
            style={styles.moveButton}
          >
            {moving ? (
              <ActivityIndicator color="#2f6b45" size="small" />
            ) : (
              <Text style={styles.moveAction}>
                {item.section === 'DEFAULT' ? '사용 임박' : '일반으로'}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={deleting || moving}
            onPress={onDelete}
          >
            {deleting ? (
              <ActivityIndicator color="#a54d42" size="small" />
            ) : (
              <Text style={styles.deleteAction}>삭제</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function sortItemsForDisplay(items: ExpirationItem[]) {
  return [...items].sort((left, right) => {
    if (left.section !== right.section) {
      return left.section === 'USE_SOON' ? -1 : 1;
    }
    if (left.section === 'USE_SOON') {
      return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
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
  safeArea: { backgroundColor: '#fffaf2', flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  editContainer: { padding: 24, paddingBottom: 48 },
  eyebrow: { color: '#2f6b45', fontSize: 13, fontWeight: '800', letterSpacing: 1.6, marginTop: 20 },
  title: { color: '#193426', fontSize: 34, fontWeight: '800', lineHeight: 43, marginTop: 10 },
  editPageTitle: { color: '#193426', fontSize: 30, fontWeight: '800', marginTop: 10 },
  description: { color: '#5d685f', fontSize: 16, lineHeight: 24, marginTop: 10 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, marginTop: 30 },
  sectionTitle: { color: '#253b2e', fontSize: 19, fontWeight: '700' },
  retry: { color: '#2f6b45', fontSize: 14, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e7e1d7', borderRadius: 18, borderWidth: 1, padding: 28 },
  emptyTitle: { color: '#34443a', fontSize: 16, fontWeight: '700' },
  emptyDescription: { color: '#7b837e', fontSize: 14, marginTop: 7, textAlign: 'center' },
  itemGroups: { gap: 24 },
  groupTitle: { color: '#496052', fontSize: 15, fontWeight: '800', marginBottom: 5 },
  emptyDropZone: { alignItems: 'center', backgroundColor: '#f7f8f4', borderColor: '#d8e1d7', borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, padding: 20 },
  emptyDropText: { color: '#78847b', fontSize: 13, fontWeight: '600' },
  groupCard: { borderColor: '#e7e1d7', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  itemRow: { alignItems: 'center', backgroundColor: '#ffffff', borderBottomColor: '#ede7de', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  itemSummary: { flex: 1, paddingRight: 12 },
  itemName: { color: '#26382e', fontSize: 16, fontWeight: '700' },
  itemQuantity: { color: '#7a827d', fontSize: 12, marginTop: 5 },
  itemDate: { color: '#516157', fontSize: 14, fontWeight: '600' },
  itemActions: { alignItems: 'flex-end', gap: 9 },
  rowActions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  moveButton: { backgroundColor: '#edf4ed', borderRadius: 9, minWidth: 72, paddingHorizontal: 9, paddingVertical: 7 },
  moveAction: { color: '#2f6b45', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  deleteAction: { color: '#a54d42', fontSize: 13, fontWeight: '800' },
});
