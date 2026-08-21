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
import {
  colors,
  interaction,
  radii,
  spacing,
  typography,
} from '../../design-system/tokens';
import { getExpirationItems } from '../expiration/expirationApi';
import { ExpirationItem } from '../expiration/types';
import { RecipeCard } from './RecipeCard';
import { generateRecipeSuggestions } from './recipeApi';
import {
  deleteSavedRecipe,
  getSavedRecipes,
  recipeIdentity,
  saveRecipe,
} from './savedRecipeApi';
import { RecipeSuggestion, RecipeSuggestionResult } from './types';

const SERVING_OPTIONS = [1, 2, 3, 4] as const;
const COOKING_TIME_OPTIONS = [20, 30, 45, 60] as const;
const MAX_SELECTED_ITEMS = 12;

type Props = {
  isActive: boolean;
};

export function RecipeSuggestionScreen({ isActive }: Props) {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsLoadFailed, setItemsLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [servings, setServings] = useState(2);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(30);
  const [assumeBasicSeasonings, setAssumeBasicSeasonings] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<RecipeSuggestionResult>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [savedRecipeIds, setSavedRecipeIds] = useState<Record<string, string>>({});
  const [savingRecipeKeys, setSavingRecipeKeys] = useState<Set<string>>(new Set());

  const loadItems = useCallback(async () => {
    setIsLoadingItems(true);
    setItemsLoadFailed(false);
    try {
      const loadedItems = await getExpirationItems();
      const availableIds = new Set(loadedItems.map(({ id }) => id));
      setItems(loadedItems);
      setSelectedIds((current) =>
        new Set([...current].filter((id) => availableIds.has(id))),
      );
    } catch {
      setItemsLoadFailed(true);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const loadSavedRecipeIds = useCallback(async () => {
    try {
      const savedRecipes = await getSavedRecipes();
      setSavedRecipeIds(
        Object.fromEntries(
          savedRecipes.map(({ id, recipe }) => [recipeIdentity(recipe), id]),
        ),
      );
    } catch {
      // Bookmark actions still show their own error when the saved list is unavailable.
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      void loadItems();
      void loadSavedRecipeIds();
    }
  }, [isActive, loadItems, loadSavedRecipeIds]);

  const toggleItem = (item: ExpirationItem) => {
    if (isGenerating) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        if (next.size >= MAX_SELECTED_ITEMS) {
          Alert.alert(
            '재료를 너무 많이 선택했어요',
            `한 번에 최대 ${MAX_SELECTED_ITEMS}개까지 선택할 수 있어요.`,
          );
          return current;
        }
        next.add(item.id);
      }
      return next;
    });
    setResult(undefined);
    setErrorMessage(undefined);
  };

  const generate = async () => {
    if (isGenerating || selectedIds.size === 0) return;
    setIsGenerating(true);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      setResult(
        await generateRecipeSuggestions({
          itemIds: [...selectedIds],
          servings,
          maxCookingMinutes,
          assumeBasicSeasonings,
        }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'AI 레시피를 만들지 못했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleBookmark = async (recipe: RecipeSuggestion) => {
    const key = recipeIdentity(recipe);
    if (savingRecipeKeys.has(key)) return;
    setSavingRecipeKeys((current) => new Set(current).add(key));
    try {
      const savedId = savedRecipeIds[key];
      if (savedId) {
        await deleteSavedRecipe(savedId);
        setSavedRecipeIds((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      } else {
        const saved = await saveRecipe(recipe);
        setSavedRecipeIds((current) => ({
          ...current,
          [recipeIdentity(saved.recipe)]: saved.id,
          [key]: saved.id,
        }));
      }
    } catch (error) {
      Alert.alert(
        '북마크를 변경하지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setSavingRecipeKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>MYDISH AI</Text>
        <Text style={styles.title}>어떤 재료로 요리할까요?</Text>
        <Text style={styles.description}>
          사용할 재료를 고르면 지금 바로 만들 수 있는 요리부터 알려드려요.
        </Text>

        <View style={styles.selectionHeader}>
          <Text style={styles.sectionTitle}>냉장고 재료</Text>
          {itemsLoadFailed ? (
            <Pressable accessibilityRole="button" onPress={() => void loadItems()}>
              <Text style={styles.retry}>다시 불러오기</Text>
            </Pressable>
          ) : (
            <Text style={styles.selectionCount}>{selectedIds.size}개 선택</Text>
          )}
        </View>
        {isLoadingItems && items.length === 0 ? (
          <ActivityIndicator color={colors.brand.action} style={styles.itemsLoader} />
        ) : items.length === 0 ? (
          <View style={styles.emptyIngredients}>
            <Text style={styles.emptyIngredientsTitle}>선택할 재료가 없어요</Text>
            <Text style={styles.emptyIngredientsDescription}>
              냉장고 탭에서 식품을 먼저 등록해주세요.
            </Text>
          </View>
        ) : (
          <View style={styles.ingredientGrid}>
            {items.map((item) => {
              const selected = selectedIds.has(item.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={item.id}
                  onPress={() => toggleItem(item)}
                  style={({ pressed }) => [
                    styles.ingredientCard,
                    selected && styles.ingredientCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text numberOfLines={2} style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientMeta}>
                    {item.quantity} {unitLabel(item.unit)}
                  </Text>
                  {item.expirationDate && (
                    <Text style={item.section === 'USE_SOON' ? styles.useSoonDate : styles.date}>
                      {item.expirationDate.replaceAll('-', '.')}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.optionsCard}>
          <OptionRow
            label="인원"
            onSelect={(value) => {
              setServings(value);
              setResult(undefined);
              setErrorMessage(undefined);
            }}
            options={SERVING_OPTIONS}
            selected={servings}
            suffix="명"
          />
          <OptionRow
            label="최대 조리 시간"
            onSelect={(value) => {
              setMaxCookingMinutes(value);
              setResult(undefined);
              setErrorMessage(undefined);
            }}
            options={COOKING_TIME_OPTIONS}
            selected={maxCookingMinutes}
            suffix="분"
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: assumeBasicSeasonings }}
            onPress={() => {
              setAssumeBasicSeasonings((current) => !current);
              setResult(undefined);
              setErrorMessage(undefined);
            }}
            style={styles.seasoningRow}
          >
            <View style={styles.seasoningCopy}>
              <Text style={styles.optionLabel}>기본 양념은 있다고 가정</Text>
              <Text style={styles.optionDescription}>물, 소금, 후추, 식용유</Text>
            </View>
            <View style={[styles.toggle, assumeBasicSeasonings && styles.toggleOn]}>
              <View style={[styles.toggleKnob, assumeBasicSeasonings && styles.toggleKnobOn]} />
            </View>
          </Pressable>
        </View>

        <Button
          accessibilityLabel={isGenerating ? 'AI 레시피 생성 중' : undefined}
          disabled={selectedIds.size === 0}
          label={selectedIds.size === 0 ? '재료를 먼저 선택해주세요' : 'AI 레시피 만들기'}
          loading={isGenerating}
          onPress={() => void generate()}
          style={styles.generateButton}
        />

        {isGenerating && (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            style={styles.generatingCard}
          >
            <ActivityIndicator color={colors.brand.action} size="small" />
            <View style={styles.generatingCopy}>
              <Text style={styles.generatingTitle}>AI 레시피 생성 중</Text>
              <Text style={styles.generatingDescription}>
                선택한 재료를 분석하고 있어요. 약 30초 정도 걸릴 수 있어요.
              </Text>
            </View>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>레시피를 만들지 못했어요</Text>
            <Text style={styles.errorDescription}>{errorMessage}</Text>
          </View>
        )}

        {result && (
          <View style={styles.results}>
            <RecipeGroup
              emptyMessage="선택한 재료만으로 만들 수 있는 레시피를 찾지 못했어요."
              onToggleBookmark={toggleBookmark}
              recipes={result.availableOnly}
              savedRecipeIds={savedRecipeIds}
              savingRecipeKeys={savingRecipeKeys}
              subtitle="추가 장보기 없이 바로 만들 수 있어요."
              title="지금 있는 재료로 만들기"
            />
            <RecipeGroup
              emptyMessage="재료 1~3개를 더해 만들 수 있는 레시피를 찾지 못했어요."
              onToggleBookmark={toggleBookmark}
              recipes={result.needsFewMore}
              savedRecipeIds={savedRecipeIds}
              savingRecipeKeys={savingRecipeKeys}
              subtitle="추가할 재료를 3개 이하로 제한했어요."
              title="조금만 추가해서 만들기"
            />
            <Text style={styles.aiNotice}>
              AI가 만든 제안이에요. 알레르기와 재료 상태를 확인하고 육류·달걀·해산물은 충분히 익혀주세요.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionRow<T extends number>({
  label,
  onSelect,
  options,
  selected,
  suffix,
}: {
  label: string;
  onSelect(value: T): void;
  options: readonly T[];
  selected: number;
  suffix: string;
}) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionChips}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === option }}
            key={option}
            onPress={() => onSelect(option)}
            style={[
              styles.optionChip,
              selected === option && styles.optionChipSelected,
            ]}
          >
            <Text style={selected === option ? styles.optionChipTextSelected : styles.optionChipText}>
              {option}{suffix}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecipeGroup({
  emptyMessage,
  onToggleBookmark,
  recipes,
  savedRecipeIds,
  savingRecipeKeys,
  subtitle,
  title,
}: {
  emptyMessage: string;
  onToggleBookmark(recipe: RecipeSuggestion): Promise<void>;
  recipes: RecipeSuggestion[];
  savedRecipeIds: Record<string, string>;
  savingRecipeKeys: Set<string>;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.recipeGroup}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultSubtitle}>{subtitle}</Text>
      {recipes.length > 0 ? (
        recipes.map((recipe, index) => {
          const key = recipeIdentity(recipe);
          return (
            <RecipeCard
              bookmarkState={
                savingRecipeKeys.has(key)
                  ? 'loading'
                  : savedRecipeIds[key]
                    ? 'saved'
                    : 'idle'
              }
              key={`${recipe.title}-${index}`}
              onBookmarkPress={() => void onToggleBookmark(recipe)}
              recipe={recipe}
            />
          );
        })
      ) : (
        <View style={styles.emptyResult}>
          <Text style={styles.emptyResultText}>{emptyMessage}</Text>
        </View>
      )}
    </View>
  );
}

function unitLabel(unit: ExpirationItem['unit']) {
  const labels: Record<ExpirationItem['unit'], string> = {
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
  return labels[unit];
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.xxl, paddingBottom: spacing.giant },
  eyebrow: { color: colors.brand.action, ...typography.caption, fontWeight: '800', letterSpacing: 1.6, marginTop: spacing.lg },
  title: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xs },
  description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  selectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xxxl },
  sectionTitle: { color: colors.text.primary, ...typography.heading2 },
  selectionCount: { color: colors.brand.action, ...typography.label },
  retry: { color: colors.brand.action, ...typography.label, paddingVertical: spacing.sm },
  itemsLoader: { minHeight: 120 },
  emptyIngredients: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.xxl },
  emptyIngredientsTitle: { color: colors.text.primary, ...typography.bodyStrong },
  emptyIngredientsDescription: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  ingredientCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, minHeight: 126, padding: spacing.lg, width: '48%' },
  ingredientCardSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary, borderWidth: 2, padding: 15 },
  checkbox: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: radii.full, borderWidth: 1.5, height: 24, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, width: 24 },
  checkboxSelected: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  checkmark: { color: colors.text.inverse, fontSize: 13, fontWeight: '900' },
  ingredientName: { color: colors.text.primary, fontSize: 16, fontWeight: '800', lineHeight: 22, paddingRight: spacing.xxl },
  ingredientMeta: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.md },
  date: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs },
  useSoonDate: { color: colors.danger, ...typography.caption, fontWeight: '700', marginTop: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
  optionsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, gap: spacing.xl, marginTop: spacing.xxl, padding: spacing.lg },
  optionBlock: { gap: spacing.sm },
  optionLabel: { color: colors.text.primary, ...typography.label },
  optionDescription: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionChip: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.full, borderWidth: 1, minHeight: interaction.minimumTouchSize, minWidth: 58, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionChipSelected: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  optionChipText: { color: colors.text.secondary, ...typography.label },
  optionChipTextSelected: { color: colors.text.inverse, ...typography.label },
  seasoningRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: interaction.minimumTouchSize },
  seasoningCopy: { flex: 1, paddingRight: spacing.md },
  toggle: { backgroundColor: colors.borderStrong, borderRadius: radii.full, height: 30, justifyContent: 'center', padding: 3, width: 52 },
  toggleOn: { backgroundColor: colors.brand.action },
  toggleKnob: { backgroundColor: colors.surface, borderRadius: radii.full, height: 24, width: 24 },
  toggleKnobOn: { alignSelf: 'flex-end' },
  generateButton: { marginTop: spacing.xl },
  generatingCard: { alignItems: 'center', backgroundColor: colors.brand.soft, borderColor: colors.brand.primary, borderRadius: radii.large, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, padding: spacing.lg },
  generatingCopy: { flex: 1 },
  generatingTitle: { color: colors.brand.action, ...typography.bodyStrong },
  generatingDescription: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.xl, padding: spacing.lg },
  errorTitle: { color: colors.danger, ...typography.bodyStrong },
  errorDescription: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  results: { gap: spacing.xxxl, marginTop: spacing.huge },
  recipeGroup: { gap: spacing.md },
  resultTitle: { color: colors.text.primary, ...typography.heading2 },
  resultSubtitle: { color: colors.text.secondary, ...typography.caption, marginTop: -spacing.sm },
  emptyResult: { backgroundColor: colors.surfaceMuted, borderRadius: radii.large, padding: spacing.lg },
  emptyResultText: { color: colors.text.muted, ...typography.caption, textAlign: 'center' },
  aiNotice: { color: colors.text.muted, ...typography.caption, textAlign: 'center' },
});
