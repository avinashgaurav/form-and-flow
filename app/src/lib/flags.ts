/**
 * Build flags. Each is read once at build time (Expo inlines EXPO_PUBLIC_ variables).
 *
 * EXPO_PUBLIC_SAFETY_SCREEN=1 turns on the AI safety screen in the coach. Off by default, so a build
 * never depends on a server function that is not deployed yet. Off: the safety word list, then the
 * rules and the coach, as before. On: the screen runs before every rules answer or coach reply and
 * fails closed. Turn it on only after migration 0006 and the safety-screen function are deployed and
 * the live smoke test passes (supabase/SETUP.md).
 */
export const SAFETY_SCREEN_ON = process.env.EXPO_PUBLIC_SAFETY_SCREEN === '1';
