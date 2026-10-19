import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { color, font } from './theme';

/**
 * Small charts for Progress (S25 to S27). They draw only logged data, never a projection. Each one
 * is a single accessible image whose label carries the same information as text.
 */

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

const PAD = { top: 18, right: 8, bottom: 22, left: 36 };

export interface TrendPoint {
  /** Days since the first point; gaps stay gaps. */
  x: number;
  value: number;
  /** Null where no trend is shown yet (less than a week of data in that stretch). */
  trend: number | null;
  segment: number;
}

/** Raw entries as dots, the smoothed trend as a line that breaks between segments. */
export function TrendChart({ points, summary, firstLabel, lastLabel, height = 170 }: { points: TrendPoint[]; summary: string; firstLabel: string; lastLabel: string; height?: number }) {
  const [width, onLayout] = useWidth();
  const values = points.flatMap((p) => (p.trend === null ? [p.value] : [p.value, p.trend]));
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const maxX = Math.max(1, ...points.map((p) => p.x));
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (x / maxX) * w;
  const sy = (v: number) => PAD.top + (1 - (v - lo) / Math.max(1, hi - lo)) * h;
  const segments = [...new Set(points.map((p) => p.segment))];
  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height} pointerEvents="none">
          {[lo, hi].map((v) => (
            <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={sy(v)} y2={sy(v)} stroke={color.lineSoft} strokeWidth={1} />
          ))}
          {[lo, hi].map((v) => (
            <SvgText key={`t${v}`} x={PAD.left - 6} y={sy(v) + 4} fontSize={11} fontFamily={font.medium} fill={color.muted} textAnchor="end">{String(v)}</SvgText>
          ))}
          {segments.map((seg) => {
            const pts = points.filter((p): p is TrendPoint & { trend: number } => p.segment === seg && p.trend !== null);
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.trend).toFixed(1)}`).join(' ');
            return pts.length > 1 ? <Path key={seg} d={d} stroke={color.primary} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null;
          })}
          {points.map((p) => (
            <Circle key={`${p.x}`} cx={sx(p.x)} cy={sy(p.value)} r={3.5} fill={color.surface} stroke={color.ink} strokeWidth={1.5} />
          ))}
          <SvgText x={PAD.left} y={height - 6} fontSize={11} fontFamily={font.medium} fill={color.muted}>{firstLabel}</SvgText>
          <SvgText x={width - PAD.right} y={height - 6} fontSize={11} fontFamily={font.medium} fill={color.muted} textAnchor="end">{lastLabel}</SvgText>
        </Svg>
      )}
    </View>
  );
}

export interface DayBar {
  label: string;
  value: number | null;
  /** Drawn lighter, for example a day with only some meals logged. */
  faded?: boolean;
}

/** One bar per day or week, with an optional target band behind them. */
export function Bars({ bars, band, summary, height = 150, showValues = true }: { bars: DayBar[]; band?: [number, number]; summary: string; height?: number; showValues?: boolean }) {
  const [width, onLayout] = useWidth();
  const top = Math.max(1, ...bars.map((b) => b.value ?? 0), band?.[1] ?? 0) * 1.1;
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const slot = bars.length ? w / bars.length : 0;
  const sy = (v: number) => PAD.top + (1 - v / top) * h;
  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height} pointerEvents="none">
          {band && <Rect x={PAD.left} width={w} y={sy(band[1])} height={Math.max(2, sy(band[0]) - sy(band[1]))} fill={color.okWash} />}
          {band && <SvgText x={PAD.left - 6} y={sy(band[1]) + 4} fontSize={11} fontFamily={font.medium} fill={color.muted} textAnchor="end">{String(band[1])}</SvgText>}
          {band && <SvgText x={PAD.left - 6} y={sy(band[0]) + 4} fontSize={11} fontFamily={font.medium} fill={color.muted} textAnchor="end">{String(band[0])}</SvgText>}
          <Line x1={PAD.left} x2={width - PAD.right} y1={sy(0)} y2={sy(0)} stroke={color.ink} strokeWidth={1.5} />
          {bars.map((b, i) => {
            const bw = Math.min(28, slot * 0.6);
            const x = PAD.left + i * slot + (slot - bw) / 2;
            return (
              <G key={i}>
                {b.value !== null && b.value > 0 && (
                  <Rect x={x} y={sy(b.value)} width={bw} height={sy(0) - sy(b.value)} fill={color.primary} opacity={b.faded ? 0.35 : 1} stroke={color.ink} strokeWidth={1.5} rx={3} />
                )}
                {showValues && b.value !== null && b.value > 0 && (
                  <SvgText x={x + bw / 2} y={sy(b.value) - 4} fontSize={10} fontFamily={font.medium} fill={color.ink} textAnchor="middle">{b.value.toLocaleString('en-IN')}</SvgText>
                )}
                <SvgText x={x + bw / 2} y={height - 6} fontSize={11} fontFamily={font.medium} fill={color.muted} textAnchor="middle">{b.label}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
