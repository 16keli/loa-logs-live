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
  splitParties = $state(defaults.splitParties);
  classColorBars = $state(defaults.classColorBars);

  constructor() {
    if (!browser) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ViewerSettings>;
        this.columns = { ...defaults.columns, ...parsed.columns };
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
