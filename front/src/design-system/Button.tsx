import { ActivityIndicator, Image, ImageSourcePropType, ImageStyle, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, interaction, radii, spacing, typography } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  iconSource?: ImageSourcePropType;
  iconStyle?: StyleProp<ImageStyle>;
  iconTintColor?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function Button({
  disabled,
  iconSource,
  iconStyle,
  iconTintColor,
  label,
  loading = false,
  style,
  variant = 'primary',
  ...pressableProps
}: Props) {
  const isDisabled = disabled || loading;
  const indicatorColor = variant === 'primary'
    ? colors.text.inverse
    : variant === 'danger'
      ? colors.danger
      : colors.brand.action;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} size="small" />
      ) : (
        <View style={styles.content}>
          {iconSource && <Image resizeMode="contain" source={iconSource} style={[styles.icon, iconStyle, iconTintColor ? { tintColor: iconTintColor } : undefined]} />}
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  secondary: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  label: typography.button,
  content: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  icon: { height: 24, width: 24 },
  primaryLabel: { color: colors.text.inverse },
  secondaryLabel: { color: colors.text.secondary },
  dangerLabel: { color: colors.danger },
  ghostLabel: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
});
