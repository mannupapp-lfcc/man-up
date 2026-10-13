// How often a group meets (groups.meeting_every_weeks, 0017). Shared by the admin
// website and the app so both say it the same way.
export const MEETING_EVERY = [1, 2, 3, 4] as const;

export function everyLabel(every: number) {
  return every <= 1 ? "Every week" : every === 2 ? "Every other week" : `Every ${every} weeks`;
}

// "Tuesdays at 7:00 PM", "Every other Tuesday at 7:00 PM", "Every 3 weeks on Tuesday".
// `time` is already formatted for display (or empty).
export function scheduleText(day: string, time: string, every: number) {
  const at = time ? ` at ${time}` : "";
  if (every <= 1) return `${day}s${at}`;
  if (every === 2) return `Every other ${day}${at}`;
  return `Every ${every} weeks on ${day}${at}`;
}

// Same rule as fn_is_meeting_week: the start date's week and every Nth week from it
// (weeks start Monday). Dates are local calendar days as "YYYY-MM-DD".
export function isMeetingWeek(day: string, every: number, start: string | null) {
  if (every <= 1 || !start) return true;
  const monday = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000;
  };
  const weeks = Math.round((monday(day) - monday(start)) / (7 * 86_400_000));
  return ((weeks % every) + every) % every === 0;
}
