import { planReminders } from '@ff/engines';
import { useEffect } from 'react';
import { useStore } from '../store/store';
import { scheduleReminders } from './notify';
import { currentPlan, todayKey } from './plan';

/** Re-plans local reminders whenever the plan, progress or preferences change. Renders nothing. */
export function ReminderSync() {
  const { state } = useStore();
  const plan = state.onboarded ? currentPlan(state) : undefined;
  const key = JSON.stringify([state.reminders, plan?.weekStart, plan?.week.sessions.map((s) => [s.id, state.sessions[s.id]?.status])]);
  useEffect(() => {
    if (!plan || !state.profile) return;
    const today = todayKey(state.profile.timezone);
    const reminders = planReminders(state.reminders, {
      weekStart: plan.weekStart,
      today,
      sessions: plan.week.paused ? [] : plan.week.sessions.map((s) => ({ day: s.day, title: s.title, done: state.sessions[s.id]?.status === 'completed' })),
    });
    void scheduleReminders(reminders).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
