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
import { deleteExpirationItem, getExpirationItems } from './expirationApi';
import { ExpirationImageScanner } from './ExpirationImageScanner';
import { ExpirationItem } from './types';

const UNIT_LABELS: Record<ExpirationItem['unit'], string> = {
  COUNT: '개', G: 'g', KG: 'kg', ML: 'ml', L: 'L', PACK: '팩',
  BAG: '봉', BOTTLE: '병', CAN: '캔',
};

export function ExpirationHomeScreen() {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();

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

  const confirmDelete = (item: ExpirationItem) => {
    Alert.alert(
      '식재료 삭제',
      `${item.name}을(를) 삭제할까요? 저장된 사진과 스캔 기록도 함께 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => void removeItem(item),
        },
      ],
    );
  };

  const removeItem = async (item: ExpirationItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteExpirationItem(item.id);
      setItems((current) => current.filter(({ id }) => id !== item.id));
    } catch (error) {
      Alert.alert(
        '삭제하지 못했어요',
        error instanceof Error
          ? error.message
          : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setDeletingId(undefined);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MYDISH</Text>
        <Text style={styles.title}>유통기한을 사진 한 장으로</Text>
        <Text style={styles.description}>
          식품 사진을 인식한 뒤 정보를 확인하고 냉장고 목록에 저장합니다.
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
          items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>
                  {item.quantity}{UNIT_LABELS[item.unit]} · 구매 {item.purchasedAt}
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Text style={styles.itemDate}>
                  {item.expirationDate ?? '유통기한 없음'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(deletingId)}
                  onPress={() => confirmDelete(item)}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator color="#a54d42" size="small" />
                  ) : (
                    <Text style={styles.deleteAction}>삭제</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fffaf2', flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  eyebrow: { color: '#2f6b45', fontSize: 13, fontWeight: '800', letterSpacing: 1.6, marginTop: 20 },
  title: { color: '#193426', fontSize: 34, fontWeight: '800', lineHeight: 43, marginTop: 10 },
  description: { color: '#5d685f', fontSize: 16, lineHeight: 24, marginTop: 10 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, marginTop: 30 },
  sectionTitle: { color: '#253b2e', fontSize: 19, fontWeight: '700' },
  retry: { color: '#2f6b45', fontSize: 14, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e7e1d7', borderRadius: 18, borderWidth: 1, padding: 28 },
  emptyTitle: { color: '#34443a', fontSize: 16, fontWeight: '700' },
  emptyDescription: { color: '#7b837e', fontSize: 14, marginTop: 7, textAlign: 'center' },
  itemRow: { alignItems: 'center', backgroundColor: '#ffffff', borderBottomColor: '#ede7de', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  itemName: { color: '#26382e', fontSize: 16, fontWeight: '700' },
  itemQuantity: { color: '#7a827d', fontSize: 12, marginTop: 5 },
  itemDate: { color: '#516157', fontSize: 14, fontWeight: '600' },
  itemActions: { alignItems: 'flex-end', gap: 9 },
  deleteAction: { color: '#a54d42', fontSize: 13, fontWeight: '800' },
});
