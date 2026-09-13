import { browser } from "$app/environment";

const STORAGE_KEY = "loa-logs-live:settings";

export type ColumnKey =
  | "damage"
  | "damagePercent"
  | "dps"
  | "crit"
  | "frontAttack"
  | "backAttack"
  | "supportBuff"
  | "brand"
  | "identity"
  | "hat"
  | "deaths";

/** Header text, in display order. The support columns use the desktop meter's labels. */
export const columnLabels: Record<ColumnKey, string> = {
  damage: "DMG",
  damagePercent: "D%",
  dps: "DPS",
  crit: "CRIT",
  frontAttack: "F.A",
  backAttack: "B.A",
  supportBuff: "Buff%",
  brand: "B%",
  identity: "Iden%",
  hat: "T%",
  deaths: "DEAD"
};

/** Header tooltips for the labels that don't explain themselves, worded as in the desktop meter. */
export const columnTooltips: Partial<Record<ColumnKey, string>> = {
  supportBuff: "% Damage buffed by Support Atk. Power buff",
  brand: "% Damage buffed by Brand",
  identity: "% Damage buffed by Support Identity",
  hat: "% Damage buffed by Support Hyper Awakening Skill (T Skill)"
};

export type BreakdownColumnKey =
  | "damage"
  | "dps"
  | "damagePercent"
  | "crit"
  | "critDamage"
  | "frontAttack"
  | "backAttack"
  | "supportBuff"
  | "brand"
  | "identity"
  | "hat"
  | "avgPerHit"
  | "avgPerCast"
  | "maxHit"
  | "casts"
  | "cpm"
  | "hits"
  | "hpm";

/** Per-skill breakdown header text, in display order, following the desktop meter's breakdown. */
export const breakdownColumnLabels: Record<BreakdownColumnKey, string> = {
  damage: "DMG",
  dps: "DPS",
  damagePercent: "D%",
  crit: "CRIT",
  critDamage: "CDMG",
  frontAttack: "F.A",
  backAttack: "B.A",
  supportBuff: "Buff%",
  brand: "B%",
  identity: "Iden%",
  hat: "T%",
  avgPerHit: "APH",
  avgPerCast: "APC",
  maxHit: "MaxH",
  casts: "Casts",
  cpm: "CPM",
  hits: "Hits",
  hpm: "HPM"
};

/** Breakdown header tooltips, worded as in the desktop meter's `PlayerBreakdownColumns.svelte`. */
export const breakdownColumnTooltips: Record<BreakdownColumnKey, string> = {
  damage: "Damage Dealt",
  dps: "Damage per second",
  damagePercent: "Damage %",
  crit: "Crit %",
  critDamage: "% Damage that Crit",
  frontAttack: "Front Attack Damage %",
  backAttack: "Back Attack Damage %",
  supportBuff: "% Damage buffed by Support Atk. Power Buff",
  brand: "% Damage buffed by Brand",
  identity: "% Damage buffed by Support Identity",
  hat: "% Damage buffed by Support Hyper Awakening Skill (T Skill)",
  avgPerHit: "Skill Average Damage per Hit",
  avgPerCast: "Skill Average Damage per Cast",
  maxHit: "Skill Max Hit Damage",
  casts: "Number of casts",
  cpm: "Casts per minute",
  hits: "Number of hits",
  hpm: "Hits per minute"
};

const defaults = {
  columns: {
    damage: true,
    damagePercent: true,
    dps: true,
    crit: true,
    frontAttack: true,
    backAttack: true,
    supportBuff: true,
    brand: true,
    identity: true,
    hat: true,
    deaths: true
  } satisfies Record<ColumnKey, boolean>,
  // The desktop meter's breakdown defaults, plus the support uptimes.
  breakdownColumns: {
    damage: true,
    dps: true,
    damagePercent: true,
    crit: true,
    critDamage: false,
    frontAttack: true,
    backAttack: true,
    supportBuff: true,
    brand: true,
    identity: true,
    hat: true,
    avgPerHit: false,
    avgPerCast: false,
    maxHit: true,
    casts: true,
    cpm: true,
    hits: false,
    hpm: false
  } satisfies Record<BreakdownColumnKey, boolean>,
  splitParties: true,
  classColorBars: true
};

export type ViewerSettings = typeof defaults;

/**
 * Viewer-local display preferences.
 *
 * The host does not broadcast its meter settings, so these belong to whoever is watching. Kept in
 * localStorage rather than the URL so a shared link never carries one viewer's column choices.
 */
class Settings {
  columns = $state({ ...defaults.columns });
  breakdownColumns = $state({ ...defaults.breakdownColumns });
  splitParties = $state(defaults.splitParties);
  classColorBars = $state(defaults.classColorBars);

  constructor() {
    if (!browser) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ViewerSettings>;
        this.columns = { ...defaults.columns, ...parsed.columns };
        this.breakdownColumns = { ...defaults.breakdownColumns, ...parsed.breakdownColumns };
        this.splitParties = parsed.splitParties ?? defaults.splitParties;
        this.classColorBars = parsed.classColorBars ?? defaults.classColorBars;
      }
    } catch {
      // Corrupt or unavailable storage is not worth failing the page over.
    }

    $effect.root(() => {
      $effect(() => {
        const snapshot: ViewerSettings = {
          columns: { ...this.columns },
          breakdownColumns: { ...this.breakdownColumns },
          splitParties: this.splitParties,
          classColorBars: this.classColorBars
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
          // Private browsing, quota, etc. Preferences just won't persist.
        }
      });
    });
  }
}

export const settings = new Settings();
