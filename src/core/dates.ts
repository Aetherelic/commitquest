export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const distance = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - distance);
  return result;
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function isoWeekKey(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}
export function isQuestEligible(activityAt: string, campaignAddedAt: string): boolean {
  const activityTime = new Date(activityAt).getTime();
  const campaignTime = new Date(campaignAddedAt).getTime();

  if (!Number.isFinite(activityTime) || !Number.isFinite(campaignTime)) return false;

  // Git timestamps are only precise to whole seconds, while campaign timestamps
  // include milliseconds. Compare at Git's precision so a commit made in the
  // same second as `cq add` is not incorrectly treated as historical.
  return Math.floor(activityTime / 1000) >= Math.floor(campaignTime / 1000);
}

