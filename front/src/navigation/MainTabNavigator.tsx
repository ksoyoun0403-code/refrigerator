import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, interaction, spacing } from '../design-system/tokens';
import { ExpirationHomeScreen } from '../features/expiration/ExpirationHomeScreen';
import { MyRecipeScreen } from '../features/recipes/MyRecipeScreen';
import { RecipeSuggestionScreen } from '../features/recipes/RecipeSuggestionScreen';

type MainTab = 'refrigerator' | 'recipes' | 'my-recipes';

export function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<MainTab>('refrigerator');

  return (
    <SafeAreaView style={styles.root}>
      <View accessibilityRole="tablist" style={styles.tabBar}>
        <TabButton
          active={activeTab === 'refrigerator'}
          label="냉장고"
          marker="▦"
          onPress={() => setActiveTab('refrigerator')}
        />
        <TabButton
          active={activeTab === 'recipes'}
          label="레시피 생성"
          marker="✦"
          onPress={() => setActiveTab('recipes')}
        />
        <TabButton
          active={activeTab === 'my-recipes'}
          label="MyRecipe"
          marker="★"
          onPress={() => setActiveTab('my-recipes')}
        />
      </View>

      <View
        accessibilityElementsHidden={activeTab !== 'refrigerator'}
        importantForAccessibility={
          activeTab === 'refrigerator' ? 'auto' : 'no-hide-descendants'
        }
        style={[styles.screen, activeTab !== 'refrigerator' && styles.hiddenScreen]}
      >
        <ExpirationHomeScreen />
      </View>
      <View
        accessibilityElementsHidden={activeTab !== 'recipes'}
        importantForAccessibility={activeTab === 'recipes' ? 'auto' : 'no-hide-descendants'}
        style={[styles.screen, activeTab !== 'recipes' && styles.hiddenScreen]}
      >
        <RecipeSuggestionScreen isActive={activeTab === 'recipes'} />
      </View>
      <View
        accessibilityElementsHidden={activeTab !== 'my-recipes'}
        importantForAccessibility={
          activeTab === 'my-recipes' ? 'auto' : 'no-hide-descendants'
        }
        style={[styles.screen, activeTab !== 'my-recipes' && styles.hiddenScreen]}
      >
        <MyRecipeScreen isActive={activeTab === 'my-recipes'} />
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  active,
  label,
  marker,
  onPress,
}: {
  active: boolean;
  label: string;
  marker: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.activeTabButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tabMarker, active && styles.activeTabText]}>{marker}</Text>
      <Text style={[styles.tabLabel, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.canvas, flex: 1 },
  screen: { flex: 1 },
  hiddenScreen: { display: 'none' },
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  activeTabButton: { backgroundColor: colors.brand.soft },
  tabMarker: { color: colors.text.muted, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  tabLabel: { color: colors.text.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  activeTabText: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
});
