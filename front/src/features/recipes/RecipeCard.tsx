import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import { RecipeSuggestion } from './types';

type Props = {
  bookmarkState?: 'idle' | 'saved' | 'loading';
  onBookmarkPress?(): void;
  recipe: RecipeSuggestion;
  savedAt?: string;
};

export function RecipeCard({
  bookmarkState = 'idle',
  onBookmarkPress,
  recipe,
  savedAt,
}: Props) {
  const isSaved = bookmarkState === 'saved';
  const isBookmarkLoading = bookmarkState === 'loading';

  return (
    <View style={styles.recipeCard}>
      <View style={styles.recipeHeaderRow}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <Text style={styles.recipeMeta}>
            {recipe.servings}인분 · 약 {recipe.cookingMinutes}분
          </Text>
          {savedAt && (
            <Text style={styles.savedAt}>{formatSavedAt(savedAt)} 저장</Text>
          )}
        </View>
        {onBookmarkPress && (
          <Pressable
            accessibilityLabel={isSaved ? '북마크 삭제' : '북마크 저장'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBookmarkLoading, selected: isSaved }}
            disabled={isBookmarkLoading}
            hitSlop={8}
            onPress={onBookmarkPress}
            style={({ pressed }) => [
              styles.bookmarkButton,
              isSaved && styles.bookmarkButtonSaved,
              pressed && styles.pressed,
            ]}
          >
            {isBookmarkLoading ? (
              <ActivityIndicator color={colors.brand.action} size="small" />
            ) : (
              <>
                <Text style={[styles.bookmarkIcon, isSaved && styles.bookmarkTextSaved]}>
                  {isSaved ? '★' : '☆'}
                </Text>
                <Text style={[styles.bookmarkLabel, isSaved && styles.bookmarkTextSaved]}>
                  {isSaved ? '저장됨' : '저장'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Text style={styles.recipeSummary}>{recipe.summary}</Text>

      <RecipeSection title="사용할 재료">
        {recipe.usedIngredients.map((ingredient, index) => (
          <Text key={`${ingredient.name}-${index}`} style={styles.listText}>
            • {ingredient.name} {ingredient.amount}
          </Text>
        ))}
        {recipe.basicSeasonings.length > 0 && (
          <Text style={styles.basicSeasoningText}>
            기본 양념: {recipe.basicSeasonings.join(', ')}
          </Text>
        )}
      </RecipeSection>

      {recipe.missingIngredients.length > 0 && (
        <View style={styles.missingSection}>
          <Text style={styles.missingTitle}>추가로 필요한 재료</Text>
          {recipe.missingIngredients.map((ingredient, index) => (
            <Text key={`${ingredient.name}-${index}`} style={styles.missingText}>
              + {ingredient.name} {ingredient.amount}
            </Text>
          ))}
        </View>
      )}

      <RecipeSection title="재료 손질">
        {recipe.preparationSteps.map((step, index) => (
          <Text key={`${step.ingredientName}-${index}`} style={styles.listText}>
            • {step.ingredientName}: {step.instruction}
          </Text>
        ))}
      </RecipeSection>

      <RecipeSection title="조리 순서">
        {recipe.cookingSteps.map((step, index) => (
          <View key={`${index}-${step}`} style={styles.cookingStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </RecipeSection>

      {recipe.safetyNotes.length > 0 && (
        <View style={styles.safetySection}>
          <Text style={styles.safetyTitle}>안전하게 조리하기</Text>
          {recipe.safetyNotes.map((note, index) => (
            <Text key={`${index}-${note}`} style={styles.safetyText}>• {note}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function RecipeSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.recipeSection}>
      <Text style={styles.recipeSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  recipeCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, padding: spacing.xl },
  recipeHeaderRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  recipeHeader: { flex: 1, gap: spacing.xs },
  recipeTitle: { color: colors.text.primary, ...typography.title },
  recipeMeta: { color: colors.brand.action, ...typography.caption, fontWeight: '700' },
  savedAt: { color: colors.text.muted, ...typography.caption },
  bookmarkButton: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: radii.medium, borderWidth: 1, justifyContent: 'center', minHeight: interaction.minimumTouchSize, minWidth: 58, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  bookmarkButtonSaved: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary },
  bookmarkIcon: { color: colors.text.secondary, fontSize: 18, lineHeight: 20 },
  bookmarkLabel: { color: colors.text.secondary, ...typography.caption, fontWeight: '700' },
  bookmarkTextSaved: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
  recipeSummary: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  recipeSection: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.lg, paddingTop: spacing.lg },
  recipeSectionTitle: { color: colors.text.primary, ...typography.label, marginBottom: spacing.sm },
  listText: { color: colors.text.secondary, ...typography.caption, marginBottom: spacing.xs },
  basicSeasoningText: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs },
  missingSection: { backgroundColor: colors.warningSoft, borderRadius: radii.medium, marginTop: spacing.lg, padding: spacing.md },
  missingTitle: { color: colors.warning, ...typography.label, marginBottom: spacing.xs },
  missingText: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  cookingStep: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stepNumber: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: radii.full, height: 24, justifyContent: 'center', width: 24 },
  stepNumberText: { color: colors.brand.action, fontSize: 12, fontWeight: '800' },
  stepText: { color: colors.text.secondary, ...typography.caption, flex: 1 },
  safetySection: { backgroundColor: colors.dangerSoft, borderRadius: radii.medium, marginTop: spacing.lg, padding: spacing.md },
  safetyTitle: { color: colors.danger, ...typography.label, marginBottom: spacing.xs },
  safetyText: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
});
