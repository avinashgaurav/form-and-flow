/**
 * Weekly review (plan/05 J3, plan/07 S14, F-18). Separates measured facts from estimates, proposes
 * at most two changes, each with a reason and rule IDs, and proposes nothing when data is thin.
 * Declined changes are not proposed again for two weeks.
 */

export type ChangeKind = 'deload_next_week' | 'shorten_sessions' | 'add_volume';

export interface ProposedChange {
  kind: ChangeKind;
  title: string;
  reason: string;
  ruleIds: string[];
}

export interface ReviewInput {
  plannedSessions: number;
  completedSessions: number;
  partialSessions: number;
  feels: ('too_easy' | 'right' | 'too_hard')[];
  energies: number[];
  setsLogged: number;
  weeksSinceDeload: number;
  sessionMinutes: number;
  volumeBonus: number;
  /** ISO date keys of when each kind was last declined. */
  declined: Partial<Record<ChangeKind, string>>;
  today: string;
}

export interface WeeklyReview {
  facts: { label: string; value: string }[];
  estimates: { label: string; value: string }[];
  changes: ProposedChange[];
  insufficient: boolean;
  note: string;
}

const daysSince = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function weeklyReview(i: ReviewInput): WeeklyReview {
  const facts = [
    { label: 'Sessions done', value: `${i.completedSessions} of ${i.plannedSessions}` },
    { label: 'Ended early', value: String(i.partialSessions) },
    { label: 'Sets logged', value: String(i.setsLogged) },
    { label: 'Check-ins', value: String(i.energies.length) },
  ];
  const estimates: WeeklyReview['estimates'] = [];
  if (i.energies.length >= 3) {
    const avg = i.energies.reduce((a, b) => a + b, 0) / i.energies.length;
    estimates.push({ label: 'Average energy (self-rated)', value: `${avg.toFixed(1)} of 5` });
  }

  const started = i.completedSessions + i.partialSessions;
  if (i.plannedSessions === 0 || (started === 0 && i.energies.length === 0)) {
    return { facts, estimates, changes: [], insufficient: true, note: 'Not enough data this week to suggest changes. That is fine: the plan stays as it is.' };
  }

  const recentlyDeclined = (k: ChangeKind) => {
    const d = i.declined[k];
    return d !== undefined && daysSince(d, i.today) < 14;
  };
  const candidates: ProposedChange[] = [];

  const tooHard = i.feels.filter((f) => f === 'too_hard').length;
  const lowEnergy = i.energies.length >= 3 && i.energies.reduce((a, b) => a + b, 0) / i.energies.length <= 2;
  if (tooHard >= 2 || lowEnergy) {
    candidates.push({
      kind: 'deload_next_week',
      title: 'Lighter week next week',
      reason: tooHard >= 2 ? `${tooHard} sessions felt too hard this week.` : 'Your energy has been low most days.',
      ruleIds: ['TR-04'],
    });
  } else if (i.weeksSinceDeload >= 5) {
    candidates.push({ kind: 'deload_next_week', title: 'Planned lighter week', reason: `It has been ${i.weeksSinceDeload} weeks since a lighter week.`, ruleIds: ['TR-04'] });
  }

  if (i.plannedSessions >= 2 && i.completedSessions < i.plannedSessions / 2 && i.sessionMinutes > 15) {
    candidates.push({
      kind: 'shorten_sessions',
      title: `Shorter sessions: ${Math.max(15, i.sessionMinutes - 10)} min`,
      reason: `You finished ${i.completedSessions} of ${i.plannedSessions} sessions. Shorter sessions you finish beat longer ones you skip.`,
      ruleIds: ['TR-06'],
    });
  }

  const allEasy = i.feels.length >= 2 && i.feels.every((f) => f === 'too_easy');
  if (i.completedSessions === i.plannedSessions && allEasy && i.volumeBonus < 2 && !candidates.some((c) => c.kind === 'deload_next_week')) {
    candidates.push({ kind: 'add_volume', title: 'One more set on your main lifts', reason: 'Every session felt too easy and you finished them all.', ruleIds: ['TR-05'] });
  }

  const changes = candidates.filter((c) => !recentlyDeclined(c.kind)).slice(0, 2);
  return {
    facts,
    estimates,
    changes,
    insufficient: false,
    note: changes.length ? 'Accept or decline each change. Declining is always fine.' : 'No changes needed: keep going with the same plan.',
  };
}
