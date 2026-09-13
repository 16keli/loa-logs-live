import { browser } from "$app/environment";

const STORAGE_KEY = "loa-logs-live:settings";

// Columns mirror the desktop live meter: same order, labels and tooltips (`DamageMeterColumns.svelte`
// and `PlayerBreakdownColumns.svelte`). The meter picks between hit-based F.A/B.A and damage-based
// F.AD%/B.AD% with a setting; here both are columns. Existing keys keep their names so saved
// preferences carry over: `frontAttack`/`backAttack` are the damage-based pair.

export type ColumnKey =
  | "deadFor"
  | "deaths"
  | "incapacitated"
  | "damage"
  | "damagePercent"
  | "unbuffedDamage"
  | "ndmg"
  | "rdmg"
  | "dps"
  | "ndps"
  | "rdps"
  | "unbuffedDps"
  | "supportContrib"
  | "rdpsContrib"
  | "crit"
  | "critDamage"
  | "frontAttackHits"
  | "frontAttack"
  | "backAttackHits"
  | "backAttack"
  | "supportBuff"
  | "brand"
  | "identity"
  | "hat"
  | "stagger"
  | "counters";

/** Header text, in display order. */
export const columnLabels: Record<ColumnKey, string> = {
  deadFor: "Dead",
  deaths: "Deaths",
  incapacitated: "INCAP",
  damage: "DMG",
  damagePercent: "D%",
  unbuffedDamage: "uDMG",
  ndmg: "nDMG",
  rdmg: "rDMG",
  dps: "DPS",
  ndps: "nDPS",
  rdps: "rDPS",
  unbuffedDps: "uDPS",
  supportContrib: "Con%",
  rdpsContrib: "rCon%",
  crit: "CRIT",
  critDamage: "CDMG",
  frontAttackHits: "F.A",
  frontAttack: "F.AD%",
  backAttackHits: "B.A",
  backAttack: "B.AD%",
  supportBuff: "Buff%",
  brand: "B%",
  identity: "Iden%",
  hat: "T%",
  stagger: "STAG",
  counters: "CTR"
};

export const columnTooltips: Record<ColumnKey, string> = {
  deadFor: "Dead for",
  deaths: "Death Count",
  incapacitated: "Time spent in the air, on the floor, or affected by crowd control effects.",
  damage: "Damage Dealt",
  damagePercent: "Damage %",
  unbuffedDamage: "Unbuffed Damage Dealt (damage dealt excluding buffs or debuffs from the support)",
  ndmg: "Neutral Damage (self damage with incoming buffs removed)",
  rdmg: "Raid Damage (self damage + damage given to others from synergies and buffs)",
  dps: "Damage per second",
  ndps: "Neutral Damage per second (self damage with incoming buffs removed)",
  rdps: "Raid Damage per second (self damage + damage given to others from synergies and buffs)",
  unbuffedDps: "Unbuffed Damage per second (DPS excluding buffs or debuffs from the support)",
  supportContrib: "Support's % contribution to total party damage via buffs",
  rdpsContrib: "Contribution % from all party members' buffs and synergies",
  crit: "Crit %",
  critDamage: "% Damage that Crit",
  frontAttackHits: "Front Attack %",
  frontAttack: "Front Attack Damage %",
  backAttackHits: "Back Attack %",
  backAttack: "Back Attack Damage %",
  supportBuff: "% Damage buffed by Support Atk. Power buff",
  brand: "% Damage buffed by Brand",
  identity: "% Damage buffed by Support Identity",
  hat: "% Damage buffed by Support Hyper Awakening Skill (T Skill)",
  stagger: "Total Stagger Damage",
  counters: "Counters"
};

export type BreakdownColumnKey =
  | "damage"
  | "unbuffedDamage"
  | "ndmg"
  | "buffedDamage"
  | "dps"
  | "unbuffedDps"
  | "ndps"
  | "buffedDps"
  | "damagePercent"
  | "buffedDamagePercent"
  | "crit"
  | "critDamage"
  | "frontAttackHits"
  | "frontAttack"
  | "backAttackHits"
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
  | "hpm"
  | "cooldownRatio"
  | "stagger"
  | "damageReduced";

/** Per-skill breakdown header text, in display order. aCRIT and MaxC are logs-only in the meter. */
export const breakdownColumnLabels: Record<BreakdownColumnKey, string> = {
  damage: "DMG",
  unbuffedDamage: "uDMG",
  ndmg: "nDMG",
  buffedDamage: "bDMG",
  dps: "DPS",
  unbuffedDps: "uDPS",
  ndps: "nDPS",
  buffedDps: "bDPS",
  damagePercent: "D%",
  buffedDamagePercent: "bD%",
  crit: "CRIT",
  critDamage: "CDMG",
  frontAttackHits: "F.A",
  frontAttack: "F.AD%",
  backAttackHits: "B.A",
  backAttack: "B.AD%",
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
  hpm: "HPM",
  cooldownRatio: "CDR%",
  stagger: "STAG",
  damageReduced: "DR"
};

export const breakdownColumnTooltips: Record<BreakdownColumnKey, string> = {
  damage: "Damage Dealt",
  unbuffedDamage: "Unbuffed Damage Dealt (damage dealt excluding buffs or debuffs from the support)",
  ndmg: "Neutral Damage (self damage with incoming buffs removed)",
  buffedDamage: "Total Damage Buffed",
  dps: "Damage per second",
  unbuffedDps: "Unbuffed Damage per second (DPS excluding buffs or debuffs from the support)",
  ndps: "Neutral Damage per second (self damage with incoming buffs removed)",
  buffedDps: "Damage Per Second Buffed",
  damagePercent: "Damage %",
  buffedDamagePercent: "Percentage of Total Buffed",
  crit: "Crit %",
  critDamage: "% Damage that Crit",
  frontAttackHits: "Front Attack %",
  frontAttack: "Front Attack Damage %",
  backAttackHits: "Back Attack %",
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
  hpm: "Hits per minute",
  cooldownRatio: "Cooldown Ratio % - Percentage of time a skill was on cooldown",
  stagger: "Total Stagger Damage",
  damageReduced: "Total Damage Reduced by Skill"
};

const defaults = {
  // The viewer's original columns stay on; everything added for meter parity starts off.
  columns: {
    deadFor: false,
    deaths: true,
    incapacitated: false,
    damage: true,
    damagePercent: true,
    unbuffedDamage: false,
    ndmg: false,
    rdmg: false,
    dps: true,
    ndps: false,
    rdps: false,
    unbuffedDps: false,
    supportContrib: false,
    rdpsContrib: false,
    crit: true,
    critDamage: false,
    frontAttackHits: false,
    frontAttack: true,
    backAttackHits: false,
    backAttack: true,
    supportBuff: true,
    brand: true,
    identity: true,
    hat: true,
    stagger: false,
    counters: false
  } satisfies Record<ColumnKey, boolean>,
  // The desktop meter's breakdown defaults, plus the support uptimes.
  breakdownColumns: {
    damage: true,
    unbuffedDamage: false,
    ndmg: false,
    buffedDamage: false,
    dps: true,
    unbuffedDps: false,
    ndps: false,
    buffedDps: false,
    damagePercent: true,
    buffedDamagePercent: false,
    crit: true,
    critDamage: false,
    frontAttackHits: false,
    frontAttack: true,
    backAttackHits: false,
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
    hpm: false,
    cooldownRatio: false,
    stagger: false,
    damageReduced: false
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
