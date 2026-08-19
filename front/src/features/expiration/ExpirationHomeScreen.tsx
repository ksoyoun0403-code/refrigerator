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
import { getExpirationItems } from './expirationApi';
import { ExpirationItem } from './types';

export function ExpirationHomeScreen() {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

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

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const startScan = () => {
    Alert.alert(
      '이미지 선택 연결 지점',
      '다음 구현 단계에서 카메라·앨범 선택 후 인식 결과 확인 화면으로 이어집니다.',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>MYDISH</Text>
        <Text style={styles.title}>유통기한을 사진 한 장으로</Text>
        <Text style={styles.description}>
          식품 사진을 인식한 뒤 날짜를 확인하고 냉장고 목록에 저장합니다.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={startScan}
          style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        >
          <Text style={styles.scanButtonText}>사진으로 추가</Text>
        </Pressable>

        <View style={styles.flowCard}>
          <Text style={styles.sectionTitle}>핵심 구현 순서</Text>
          <Text style={styles.flowText}>1. 이미지 선택</Text>
          <Text style={styles.flowText}>2. 식품명·유통기한 인식</Text>
          <Text style={styles.flowText}>3. 인식 결과 확인 및 수정</Text>
          <Text style={styles.flowText}>4. 냉장고 목록 저장</Text>
        </View>

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
            <Text style={styles.emptyTitle}>아직 등록된 식품이 없어요</Text>
            <Text style={styles.emptyDescription}>
              첫 번째 이미지 인식 결과가 여기에 표시됩니다.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDate}>{item.expirationDate}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fffaf2' },
  container: { padding: 24, paddingBottom: 48 },
  eyebrow: { color: '#2f6b45', fontSize: 13, fontWeight: '800', letterSpacing: 1.6, marginTop: 20 },
  title: { color: '#193426', fontSize: 34, fontWeight: '800', lineHeight: 43, marginTop: 10 },
  description: { color: '#5d685f', fontSize: 16, lineHeight: 24, marginTop: 10 },
  scanButton: { alignItems: 'center', backgroundColor: '#2f6b45', borderRadius: 16, marginTop: 26, padding: 17 },
  pressed: { opacity: 0.8 },
  scanButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  flowCard: { backgroundColor: '#edf4ed', borderRadius: 18, gap: 8, marginTop: 28, padding: 20 },
  sectionTitle: { color: '#253b2e', fontSize: 19, fontWeight: '700' },
  flowText: { color: '#526158', fontSize: 15 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, marginTop: 30 },
  retry: { color: '#2f6b45', fontSize: 14, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e7e1d7', borderRadius: 18, borderWidth: 1, padding: 28 },
  emptyTitle: { color: '#34443a', fontSize: 16, fontWeight: '700' },
  emptyDescription: { color: '#7b837e', fontSize: 14, marginTop: 7, textAlign: 'center' },
  itemRow: { backgroundColor: '#ffffff', borderBottomColor: '#ede7de', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  itemName: { color: '#26382e', fontSize: 16, fontWeight: '600' },
  itemDate: { color: '#667169', fontSize: 15 },
});
