/** Number and time formatting, matching the desktop meter's `src/lib/utils.ts`. */

export function abbreviateNumber(n: number, round = 2): string {
  if (n >= 1e3 && n < 1e6) return (n / 1e3).toFixed(1) + "k";
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + "m";
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(round) + "b";
  if (n >= 1e12) return +(n / 1e12).toFixed(round) + "t";
  return Math.trunc(n || 0).toFixed(0);
}

/** Truncated number and its unit, kept separate so the unit can be styled down. */
export function abbreviateNumberSplit(n: number): [number, string] {
  if (n >= 1e3 && n < 1e6) return [+(n / 1e3).toFixed(1), "k"];
  if (n >= 1e6 && n < 1e9) return [+(n / 1e6).toFixed(1), "m"];
  if (n >= 1e9 && n < 1e12) return [+(n / 1e9).toFixed(2), "b"];
  if (n >= 1e12) return [+(n / 1e12).toFixed(2), "t"];
  return [+(n || 0).toFixed(0), ""];
}

/** Milliseconds as `mm:ss`. */
export function timestampToMinutesAndSeconds(millis: number): string {
  const safe = Math.max(0, millis);
  const minutes = Math.floor((safe % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((safe % (60 * 1000)) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return (value / total) * 100;
}

/** Item level or combat power without trailing zeros, e.g. 1745.83 or 1740. `normalizeIlvl` in the meter. */
export function normalizeIlvl(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + "%";
}

/**
 * Names the meter would consider real. Unknown players arrive with placeholder names, and the
 * desktop app falls back to the class name for those.
 */
export function isNameValid(value: unknown): value is string {
  return typeof value === "string" && value.length >= 2 && !/\d/.test(value);
}
