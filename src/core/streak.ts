import { localDateKey } from "./dates.js";

export interface StreakResult {
  current: number;
  longest: number;
}

export function calculateStreak(dateValues: string[], now = new Date()): StreakResult {
  const uniqueDates = [...new Set(dateValues.map(localDateKey))].sort();
  if (uniqueDates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let running = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDates[index]}T00:00:00`);
    const distance = Math.round((current.getTime() - previous.getTime()) / 86400000);
    running = distance === 1 ? running + 1 : 1;
    longest = Math.max(longest, running);
  }

  const dates = new Set(uniqueDates);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor: Date;
  if (dates.has(localDateKey(today))) cursor = today;
  else if (dates.has(localDateKey(yesterday))) cursor = yesterday;
  else return { current: 0, longest };

  let current = 0;
  while (dates.has(localDateKey(cursor))) {
    current += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}
