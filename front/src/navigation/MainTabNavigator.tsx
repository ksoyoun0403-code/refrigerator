import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, interaction, spacing, typography } from '../design-system/tokens';
import { ExpirationHomeScreen } from '../features/expiration/ExpirationHomeScreen';
import { RecipeSuggestionScreen } from '../features/recipes/RecipeSuggestionScreen';

type MainTab = 'refrigerator' | 'recipes';

export function MainTabNavigator() {
  const [activeTab, setActiveTab] = useState<MainTab>('refrigerator');

  return (
    <View style={styles.root}>
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

      <View accessibilityRole="tablist" style={styles.tabBar}>
        <TabButton
          active={activeTab === 'refrigerator'}
          label="냉장고"
          marker="▦"
          onPress={() => setActiveTab('refrigerator')}
        />
        <TabButton
          active={activeTab === 'recipes'}
          label="AI 레시피"
          marker="✦"
          onPress={() => setActiveTab('recipes')}
        />
      </View>
    </View>
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  activeTabButton: { backgroundColor: colors.brand.soft },
  tabMarker: { color: colors.text.muted, fontSize: 18, fontWeight: '800', lineHeight: 22 },
  tabLabel: { color: colors.text.muted, ...typography.caption, fontWeight: '700' },
  activeTabText: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
});
