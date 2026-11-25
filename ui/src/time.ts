// A running turn shows how long it has been going, so a slow turn is visible at a glance.
export function formatElapsed(startedAt: string | undefined, now: number) {
  const started = startedAt ? new Date(startedAt).getTime() : NaN;
  if (Number.isNaN(started)) return "";
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  // "2h 03m" stays readable for a long turn; seconds only matter under a minute.
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return seconds > 0 ? `${seconds}s` : "just started";
}
