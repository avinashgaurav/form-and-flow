/**
 * Skin 09 "Block Party" (design/skins.html), chosen 19 October 2026.
 * Rule: green and amber are status colours only (done, needs attention). Never decorative.
 */

export const color = {
  canvas: '#FFF6E5',
  surface: '#FFFFFF',
  sunken: '#F3EBDA',
  ink: '#111111',
  muted: '#4A4A4A',
  primary: '#2B59FF',
  onPrimary: '#FFFFFF',
  pink: '#FF4FA3',
  line: '#111111',
  lineSoft: '#E2D8C3',

  // Status. Semantic only.
  ok: '#2E7D4F',
  okWash: '#E4F1E9',
  warn: '#8A5A00',
  warnWash: '#FAEEDB',
  danger: '#B3261E',
  dangerWash: '#FBE4E2',
} as const;

export const font = {
  regular: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  heavy: 'BricolageGrotesque_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { chip: 8, card: 12, sheet: 20 } as const;
export const BORDER = 2;
export const SHADOW = 4;
/** Android 48 dp; the player uses 56 for sweaty hands (plan/09). */
export const MIN_TOUCH = 48;
