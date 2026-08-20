import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, interaction, radii, spacing, typography } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function Button({
  disabled,
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
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
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
  primaryLabel: { color: colors.text.inverse },
  secondaryLabel: { color: colors.text.secondary },
  dangerLabel: { color: colors.danger },
  ghostLabel: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
  disabled: { opacity: interaction.disabledOpacity },
});
