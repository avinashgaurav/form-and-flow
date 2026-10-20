import { shortDay, type Restriction, type RestrictionCode } from '@ff/engines';

/** Each safety limit in words a person would use. */
const LIMIT_TEXT: Record<Exclude<RestrictionCode, `region:${string}`>, string> = {
  red_flag: 'Training paused until a doctor checks you',
  pregnancy: 'Pregnancy-safe training only',
  clearance_required: 'Waiting for a doctor’s go-ahead',
  intensity_cap_moderate: 'Light to moderate effort only',
  no_deficit: 'No calorie cutting',
  no_high_protein: 'No high-protein targets',
  no_fasted_training: 'No training on an empty stomach',
  non_numeric_only: 'Plate guidance instead of numbers',
};

/** "Leaving out moves that load your knee until 26 Oct". */
export function limitText(r: Pick<Restriction, 'code' | 'expiresAt'>): string {
  const base = r.code.startsWith('region:')
    ? `Leaving out moves that load your ${r.code.slice(7).replace('_', ' ')}`
    : LIMIT_TEXT[r.code as keyof typeof LIMIT_TEXT] ?? r.code;
  return r.expiresAt ? `${base} until ${shortDay(r.expiresAt)}` : base;
}

/** A saved moment ("2026-10-20T08:30:00Z") as the day it was on this phone: "20 Oct". */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** A workout's state in words. */
export const SESSION_STATUS = { planned: 'not started', in_progress: 'in progress', completed: 'done', partial: 'ended early' } as const;

/** A reason as a sentence with exactly one full stop (some engine reasons already end in one). */
export function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export const TONE_NAME = { gentle: 'Gentle and encouraging', direct: 'Short and direct', data: 'Numbers first' } as const;
export const PLACE_NAME = { home: 'Home', gym: 'Gym', both: 'Home and gym' } as const;
