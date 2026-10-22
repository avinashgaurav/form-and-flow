/**
 * Where a saved onboarding draft should be sent, or null to leave it where it is.
 *
 * Steps: 0 welcome, 1 about you, 2 goal and body, 3 safety, 4 safety result, 5 your week,
 * 6 the plan preview. `ready` is the first unfinished step (1, 2, 3, or 5 when all is done).
 * A draft past `ready` goes back to it, so no safety question is skipped. The one exception is
 * the plan preview: once everything is done (ready 5), step 6 is allowed while a plan exists.
 */
export function stepFix(step: number, ready: number, disposition: string, hasPlan: boolean): number | null {
  const cap = ready === 5 ? 6 : ready;
  if (step > cap) return ready;
  if (step === 4 && disposition === 'clear') return 5;
  if (step > 6 || (step === 6 && !hasPlan)) return 5;
  return null;
}
