import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from './theme';

/** Line icons at one stroke weight. No emoji anywhere in the product (plan/09). */
export type IconName =
  | 'home' | 'train' | 'eat' | 'coach' | 'progress' | 'info' | 'check' | 'back' | 'swap' | 'timer'
  | 'alert' | 'user' | 'phone' | 'plus' | 'minus' | 'close' | 'chevron' | 'search' | 'shield' | 'saved';

export function Icon({ name, size = 20, stroke = color.ink, width = 2 }: { name: IconName; size?: number; stroke?: string; width?: number }) {
  const p = { stroke, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <View aria-hidden pointerEvents="none">
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
      {name === 'train' && <Path {...p} d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" />}
      {name === 'eat' && <Path {...p} d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />}
      {name === 'coach' && <><Path {...p} d="M4 5h16v11H9l-5 4z" /><Path {...p} d="M8 9.5h8M8 12.5h5" /></>}
      {name === 'progress' && <Path {...p} d="M4 20V4M4 20h16M8 16l4-5 3 3 5-6" />}
      {name === 'info' && <><Circle {...p} cx="12" cy="12" r="9" /><Path {...p} d="M12 11v5M12 8h.01" /></>}
      {name === 'check' && <Path {...p} d="m5 12.5 4.5 4.5L19 7.5" />}
      {name === 'back' && <Path {...p} d="m15 5-7 7 7 7" />}
      {name === 'chevron' && <Path {...p} d="m9 5 7 7-7 7" />}
      {name === 'swap' && <Path {...p} d="M7 7h11l-3-3M17 17H6l3 3" />}
      {name === 'timer' && <><Circle {...p} cx="12" cy="13" r="8" /><Path {...p} d="M12 9v4l2.5 2.5M9 2h6" /></>}
      {name === 'alert' && <><Path {...p} d="M12 3 2 20h20z" /><Path {...p} d="M12 10v4M12 17h.01" /></>}
      {name === 'user' && <><Circle {...p} cx="12" cy="8" r="4" /><Path {...p} d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>}
      {name === 'phone' && <Path {...p} d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'minus' && <Path {...p} d="M5 12h14" />}
      {name === 'close' && <Path {...p} d="M6 6l12 12M18 6 6 18" />}
      {name === 'search' && <><Circle {...p} cx="11" cy="11" r="7" /><Path {...p} d="m20 20-4-4" /></>}
      {name === 'shield' && <Path {...p} d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />}
      {name === 'saved' && <><Rect {...p} x="4" y="5" width="16" height="14" rx="2" /><Path {...p} d="m8.5 12 2.5 2.5 4.5-5" /></>}
    </Svg>
    </View>
  );
}

/** Simple line figure used as the demo placeholder until licensed media exists (plan/09 section 6). */
export function Figure({ size = 96 }: { size?: number }) {
  const p = { stroke: color.primary, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <View aria-hidden pointerEvents="none">
    <Svg width={size} height={size} viewBox="0 0 90 96">
      <Circle {...p} cx="46" cy="14" r="8" />
      <Path {...p} d="M46 22v26M46 30l-14 10M46 30l14 10M32 40h28M46 48l-16 12 6 20M46 48l16 12-6 20" />
    </Svg>
    </View>
  );
}
