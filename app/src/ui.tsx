import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icons';
import { BORDER, MIN_TOUCH, SHADOW, color, font, radius, space } from './theme';

/* ---------- Text ---------- */

type Variant = 'title' | 'h1' | 'h2' | 'body' | 'small' | 'label' | 'num';
const textStyles: Record<Variant, TextStyle> = {
  title: { fontFamily: font.heavy, fontSize: 32, lineHeight: 36, color: color.ink },
  h1: { fontFamily: font.heavy, fontSize: 24, lineHeight: 28, color: color.ink },
  h2: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, color: color.ink },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: color.ink },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: color.muted },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: color.muted },
  num: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, color: color.ink, fontVariant: ['tabular-nums'] },
};

export function T({ v = 'body', style, children, ...rest }: { v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; accessibilityRole?: 'header' | 'text'; numberOfLines?: number; selectable?: boolean }) {
  return (
    <Text style={[textStyles[v], style]} accessibilityRole={rest.accessibilityRole ?? (v === 'title' || v === 'h1' ? 'header' : undefined)} {...rest}>
      {children}
    </Text>
  );
}

/* ---------- Layout ---------- */

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[{ gap: space.lg }, padded && { padding: space.lg, paddingBottom: space.xxl }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Card with the Block Party hard offset shadow, drawn as a second view because RN shadows blur. */
export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'ok' | 'warn' | 'danger' | 'sunken' }) {
  const bg = { surface: color.surface, ok: color.okWash, warn: color.warnWash, danger: color.dangerWash, sunken: color.sunken }[tone];
  return (
    <View style={{ marginRight: SHADOW, marginBottom: SHADOW }}>
      <View style={[s.shadow, { borderRadius: radius.card }]} />
      <View style={[s.card, { backgroundColor: bg }, style]}>{children}</View>
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <View style={s.eyebrow}>
      <Text style={s.eyebrowText}>{children}</Text>
    </View>
  );
}

/* ---------- Controls ---------- */

export function Button({
  label, onPress, kind = 'primary', icon, disabled, accessibilityHint, tall,
}: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName; disabled?: boolean; accessibilityHint?: string; tall?: boolean }) {
  const bg = { primary: color.primary, secondary: color.surface, danger: color.danger, ghost: 'transparent' }[kind];
  const fg = kind === 'primary' || kind === 'danger' ? color.onPrimary : color.ink;
  const shadow = kind === 'primary' || kind === 'danger';
  return (
    <View style={shadow ? { marginRight: 3, marginBottom: 3 } : undefined}>
      {shadow && !disabled && <View style={[s.shadow, { top: 3, left: 3, right: -3, bottom: -3, borderRadius: radius.card }]} />}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          s.button,
          { backgroundColor: bg, minHeight: tall ? 56 : MIN_TOUCH, borderWidth: kind === 'ghost' ? 0 : BORDER, opacity: disabled ? 0.45 : 1 },
          pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        ]}
      >
        {icon && <Icon name={icon} size={18} stroke={fg} />}
        <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

export function Chip({ label, selected, onPress, accessibilityLabel }: { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      style={[s.chip, selected && { backgroundColor: color.primary }]}
      hitSlop={6}
    >
      <Text style={[s.chipText, selected && { color: color.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string | number>({ options, value, onChange, multi }: {
  options: { value: T; label: string }[];
  value: T | T[] | undefined;
  onChange: (v: T) => void;
  multi?: boolean;
}) {
  const isOn = (v: T) => (multi ? Array.isArray(value) && value.includes(v) : value === v);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {options.map((o) => <Chip key={String(o.value)} label={o.label} selected={isOn(o.value)} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

export function Stepper({ value, onChange, min, max, step, label, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string; unit?: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <Row gap={space.sm}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => set(value - step)} style={s.stepBtn}>
        <Icon name="minus" size={18} />
      </Pressable>
      <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value, text: `${value}${unit ? ' ' + unit : ''}` }} style={{ minWidth: 48, alignItems: 'center' }}>
        <T v="num">{Number.isInteger(value) ? value : value.toFixed(1)}</T>
        {unit && <T v="small">{unit}</T>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => set(value + step)} style={s.stepBtn}>
        <Icon name="plus" size={18} />
      </Pressable>
    </Row>
  );
}

export function Field({ label, value, onChangeText, keyboardType = 'default', placeholder, error, hint, autoCapitalize, multiline, maxLength, autoComplete }: {
  label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric' | 'email-address' | 'number-pad'; placeholder?: string; error?: string; hint?: string;
  autoCapitalize?: 'none' | 'sentences'; multiline?: boolean; maxLength?: number; autoComplete?: 'email' | 'one-time-code' | 'off';
}) {
  return (
    <View style={{ gap: space.xs }}>
      <T v="label">{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={color.muted}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        multiline={multiline}
        maxLength={maxLength}
        style={[s.input, multiline ? { minHeight: 96, textAlignVertical: 'top', paddingTop: space.sm } : null, error ? { borderColor: color.danger } : null]}
      />
      {hint && !error && <T v="small">{hint}</T>}
      {error && <T v="small" style={{ color: color.danger }}>{error}</T>}
    </View>
  );
}

/* ---------- Feedback ---------- */

export function Banner({ tone = 'info', title, body, icon }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; title: string; body?: string; icon?: IconName }) {
  const map = {
    info: { bg: color.sunken, fg: color.ink, i: 'info' as IconName },
    warn: { bg: color.warnWash, fg: color.warn, i: 'alert' as IconName },
    danger: { bg: color.dangerWash, fg: color.danger, i: 'alert' as IconName },
    ok: { bg: color.okWash, fg: color.ok, i: 'check' as IconName },
  }[tone];
  return (
    <View style={[s.banner, { backgroundColor: map.bg }]} accessibilityRole="alert">
      <Icon name={icon ?? map.i} size={18} stroke={map.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: map.fg }}>{title}</Text>
        {body && <Text style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: color.ink }}>{body}</Text>}
      </View>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <T v="h2">{title}</T>
        <T v="small">{body}</T>
        {action}
      </View>
    </Card>
  );
}

/** A progress bar with an optional target band, used for ranges (never a single fake-precise number). */
export function Bar({ value, band }: { value: number; band?: [number, number] }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={s.bar} aria-hidden>
      {band && <View style={[s.band, { left: `${band[0] * 100}%`, width: `${(band[1] - band[0]) * 100}%` }]} />}
      <View style={[s.fill, { width: `${v * 100}%` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  shadow: { position: 'absolute', top: SHADOW, left: SHADOW, right: -SHADOW, bottom: -SHADOW, backgroundColor: color.ink },
  card: { borderWidth: BORDER, borderColor: color.line, borderRadius: radius.card, padding: space.md, gap: space.sm },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: color.pink, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  eyebrowText: { fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: color.ink },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderColor: color.line, borderRadius: radius.card, paddingHorizontal: space.lg },
  buttonText: { fontFamily: font.bold, fontSize: 15 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.chip, borderWidth: BORDER, borderColor: color.line, backgroundColor: color.surface },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: color.ink },
  stepBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.chip, borderWidth: BORDER, borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: color.sunken },
  input: { minHeight: MIN_TOUCH, borderWidth: BORDER, borderColor: color.line, borderRadius: radius.card, paddingHorizontal: space.md, fontFamily: font.regular, fontSize: 16, color: color.ink, backgroundColor: color.surface },
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: BORDER, borderColor: color.line, alignItems: 'flex-start' },
  bar: { height: 14, borderRadius: 99, borderWidth: BORDER, borderColor: color.line, backgroundColor: color.sunken, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.lineSoft },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: color.primary },
});
