export const colors = {
  brand: {
    primary: '#F97316',
    action: '#C2410C',
    pressed: '#9A3412',
    soft: '#FFF0E6',
    onPrimary: '#2B1B15',
  },
  canvas: '#FFF9F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F4F1',
  border: '#E9DED7',
  borderStrong: '#CDBBAF',
  text: {
    primary: '#2B1B15',
    secondary: '#5F4B43',
    muted: '#81736D',
    inverse: '#FFFFFF',
  },
  success: '#2F6B45',
  successSoft: '#EAF3EC',
  warning: '#7A5700',
  warningSoft: '#FFF8DF',
  warningBorder: '#EAD794',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

export const radii = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 43, fontWeight: '800' },
  heading1: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  heading2: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
} as const;

export const interaction = {
  minimumTouchSize: 44,
  disabledOpacity: 0.45,
  pressedOpacity: 0.82,
} as const;
