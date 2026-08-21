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
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { RecipeCard } from './RecipeCard';
import { deleteSavedRecipe, getSavedRecipes } from './savedRecipeApi';
import { SavedRecipe } from './types';

export function MyRecipeScreen({ isActive }: { isActive: boolean }) {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadRecipes = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      setSavedRecipes(await getSavedRecipes());
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void loadRecipes();
  }, [isActive, loadRecipes]);

  const confirmRemove = (savedRecipe: SavedRecipe) => {
    Alert.alert(
      '북마크를 삭제할까요?',
      `${savedRecipe.recipe.title} 레시피를 MyRecipe에서 삭제합니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => void remove(savedRecipe),
        },
      ],
    );
  };

  const remove = async (savedRecipe: SavedRecipe) => {
    if (deletingIds.has(savedRecipe.id)) return;
    setDeletingIds((current) => new Set(current).add(savedRecipe.id));
    try {
      await deleteSavedRecipe(savedRecipe.id);
      setSavedRecipes((current) =>
        current.filter(({ id }) => id !== savedRecipe.id),
      );
    } catch (error) {
      Alert.alert(
        '북마크를 삭제하지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(savedRecipe.id);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>MYDISH</Text>
        <Text style={styles.title}>MyRecipe</Text>
        <Text style={styles.description}>
          AI가 만든 레시피 중 다시 보고 싶은 요리를 모아두는 공간이에요.
        </Text>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>저장한 레시피</Text>
          {loadFailed ? (
            <Pressable accessibilityRole="button" onPress={() => void loadRecipes()}>
              <Text style={styles.retry}>다시 불러오기</Text>
            </Pressable>
          ) : (
            <Text style={styles.count}>{savedRecipes.length}개</Text>
          )}
        </View>

        {isLoading && savedRecipes.length === 0 ? (
          <ActivityIndicator color={colors.brand.action} style={styles.loader} />
        ) : savedRecipes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 저장한 레시피가 없어요</Text>
            <Text style={styles.emptyDescription}>
              레시피 생성 탭에서 마음에 드는 레시피의 ☆ 저장 버튼을 눌러보세요.
            </Text>
          </View>
        ) : (
          <View style={styles.recipeList}>
            {savedRecipes.map((savedRecipe) => (
              <RecipeCard
                bookmarkState={deletingIds.has(savedRecipe.id) ? 'loading' : 'saved'}
                key={savedRecipe.id}
                onBookmarkPress={() => confirmRemove(savedRecipe)}
                recipe={savedRecipe.recipe}
                savedAt={savedRecipe.createdAt}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.xxl, paddingBottom: spacing.giant },
  eyebrow: { color: colors.brand.action, ...typography.caption, fontWeight: '800', letterSpacing: 1.6, marginTop: spacing.xl },
  title: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xs },
  description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xxxl },
  sectionTitle: { color: colors.text.primary, ...typography.heading2 },
  count: { color: colors.brand.action, ...typography.label },
  retry: { color: colors.brand.action, ...typography.label, paddingVertical: spacing.sm },
  loader: { minHeight: 160 },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.xxxl },
  emptyTitle: { color: colors.text.primary, ...typography.bodyStrong },
  emptyDescription: { color: colors.text.muted, ...typography.caption, marginTop: spacing.sm, textAlign: 'center' },
  recipeList: { gap: spacing.xl },
});
