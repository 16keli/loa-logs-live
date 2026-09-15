import { base } from "$app/paths";

/**
 * Values copied from the LOA Logs desktop app so the viewer looks like the meter.
 *
 * The desktop app lets users edit their class colors, but those settings are not broadcast, so the
 * viewer ships the defaults from `src/lib/stores.svelte.ts`.
 */

/** Boss HP bar palette, cycled per bar. From `src/lib/constants/encounters.ts`. */
export const bossHpBarColors = ["#D16F23", "#9F3930", "#582469", "#2B3A63", "#246977", "#798816", "#E7B826"];

export const classColors: Record<string, string> = {
  Local: "#FFC9ED",
  Berserker: "#ee2e48",
  Destroyer: "#7b9aa2",
  Gunlancer: "#e1907e",
  Paladin: "#ff9900",
  Slayer: "#db6a42",
  Valkyrie: "#ffbf00",
  Arcanist: "#b38915",
  Summoner: "#22aa99",
  Bard: "#674598",
  Sorceress: "#66aa00",
  Wardancer: "#aaaa11",
  Scrapper: "#990099",
  Soulfist: "#316395",
  Glaivier: "#f6da6a",
  Striker: "#994499",
  Breaker: "#4de3d1",
  Deathblade: "#a91a16",
  Shadowhunter: "#0099c6",
  Reaper: "#109618",
  Souleater: "#c16ed0",
  Sharpshooter: "#dd4477",
  Deadeye: "#4442a8",
  Artillerist: "#33670b",
  Machinist: "#3b4292",
  Gunslinger: "#6bcec2",
  Artist: "#a34af0",
  Aeromancer: "#084ba3",
  Wildsoul: "#3a945e",
  Guardianknight: "#f4554b"
};

export const UNKNOWN_CLASS_COLOR = "#9ca3af";

export function classColor(className: string): string {
  return classColors[className] ?? UNKNOWN_CLASS_COLOR;
}

/**
 * A hex color at the given opacity, as plain `rgba()`.
 *
 * The meter writes `rgb(from <hex> r g b / <alpha>)` instead, which is fine in its WebView2, but that
 * is relative color syntax: Safari before 18, Chrome before 119 and Firefox before 128 drop the whole
 * declaration, so every bar goes transparent. The viewer runs in whatever browser a viewer has.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;

  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join("") : match[1];
  const value = parseInt(digits, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Support specializations. From `SUPPORT_SPECS` in `src/lib/utils.ts`. */
const SUPPORT_SPECS = ["Desperate Salvation", "Full Bloom", "Blessed Aura", "Liberator"];

export function isSupportSpec(spec?: string): boolean {
  return !!spec && SUPPORT_SPECS.includes(spec);
}

export function classIcon(classId: number): string {
  // `base` is empty in dev and on a root deployment, and "/<repo>" on GitHub project pages.
  return `${base}/images/classes/${classId}.png`;
}

/** Character profiles and loadout snapshots. `LOA_BIBLE_URL` in the meter's `src/lib/utils.ts`. */
export const LOA_BIBLE_URL = "https://lostark.bible";

/** Bar color for sidereal (Esther) rows. From `EntityState.color` in `src/lib/entity.svelte.ts`. */
export const SIDEREAL_COLOR = "#4dc8d0";

/** Sidereal icon by the name the host sends. From `estherNameToIcon` in `src/lib/constants/esthers.ts`. */
const siderealIcons: Record<string, string> = {
  Thirain: "esther_0",
  Wei: "esther_1",
  Balthorr: "esther_2",
  Nineveh: "esther_3",
  Inanna: "esther_4",
  Azena: "esther_5",
  Shandi: "esther_6",
  "Kadan Attack": "esther_7",
  "Kadan Defense": "esther_8",
  Avele: "combined_3",
  Thar: "combined_2",
  Ephernia: "combined_4",
  Bastian: "combined_6",
  Ealyn: "combined_7",
  Jederico: "combined_8",
  Gustaven: "combined_9",
  Mystic: "combined_13",
  Mariu: "combined_14",
  Azakiel: "combined_15",
  Kharmine: "combined_17",
  Kadan: "esther_7",
  Armen: "combined_18",
  "Armen Attack": "combined_18",
  "Armen Defense": "combined_19"
};

export function siderealIcon(name: string): string {
  const icon = siderealIcons[name];
  return icon ? `${base}/images/sidereals/${icon}.png` : SKILL_ICON_PLACEHOLDER;
}

/** Shown for skills with no icon, or one the CDN doesn't have. Bundled, since the CDN has no placeholder. */
export const SKILL_ICON_PLACEHOLDER = `${base}/images/unknown-skill.png`;

/**
 * Skill icons come from the CDN rather than a bundled copy of the meter's 3,000+ images; it serves
 * the same file names the host sends. The host sends "" when a skill has no icon.
 */
export function skillIcon(icon: string): string {
  return icon ? `https://cdn.ags.lol/icon/${icon}` : SKILL_ICON_PLACEHOLDER;
}

/** Hyper awakening skills, two per class. From `hyperAwakeningIds` in `src/lib/utils/buffs.ts`. */
export const hyperAwakeningIds: ReadonlySet<number> = new Set([
  16720,
  16730, // berserker
  18240,
  18250, // destroyer
  17250,
  17260, // gunlancer
  36230,
  36240, // paladin
  45820,
  45830, // slayer
  19360,
  19370, // arcanist
  20370,
  20350, // summoner
  21320,
  21330, // bard
  37380,
  37390, // sorceress
  22360,
  22370, // wardancer
  23400,
  23410, // scrapper
  24300,
  24310, // soulfist
  34620,
  34630, // glaivier
  39340,
  39350, // striker
  47300,
  47310, // breaker
  25410,
  25420, // deathblade
  28260,
  28270, // sharpshooter
  27910,
  27920, // shadowhunter
  26940,
  26950, // reaper
  46620,
  46630, // souleater
  29360,
  29370, // deadeye
  30320,
  30330, // artillerist
  35810,
  35890, // machinist
  38320,
  38330, // gunslinger
  31920,
  31930, // artist
  32290,
  32300, // aeromancer
  33520,
  33530 // wildsoul
]);

/**
 * Arcanist card skills, hidden from the breakdown as the meter does. From `cardIds` in
 * `src/lib/constants/cards.ts`, which deliberately leaves out Emperor and Knight of the Empress.
 */
export const arcanistCardIds: ReadonlySet<number> = new Set([
  19090, 19091, 19092, 19093, 19094, 19095, 19096, 19097, 19098, 19099, 19280, 19281, 19284, 19285, 19286, 19287
]);

/** The status effect group every brand debuff shares. */
export const BRAND_UNIQUE_GROUP = 210230;

/**
 * Support identity skills whose brand the game credits to the identity rather than to brand. From
 * `supportSkills.identityBrandSources` in `src/lib/utils/buffs.ts`.
 */
export const identityBrandSourceIds: ReadonlySet<number> = new Set([
  21140,
  21141,
  21142,
  21143, // Bard Serenade of Courage
  31050,
  31051, // Artist Moonfall
  36800, // Paladin Blessed Aura / Holy Aura
  48040,
  48041,
  48042 // Valkyrie Release Light
]);

/** Id of the breakdown row that carries a support's identity brand. From `src/lib/entity.svelte.ts`. */
export const IDENTITY_BRAND_SKILL_ID = -210230;

/** Name and icon of that row, per class. From `src/lib/entity.svelte.ts`. */
export const identityBrandRows: Record<string, { name: string; icon: string }> = {
  Artist: { name: "Brand Enhancement (Moonfall Brand)", icon: "ark_passive_yy_6.png" },
  Paladin: { name: "Light's Vestige (Blessed Aura Brand)", icon: "ark_passive_hk_7.png" },
  Bard: { name: "Serenade of Branding (Serenade Brand)", icon: "ark_passive_bd_9.png" },
  Valkyrie: { name: "Liberator's Sign (Release Light Brand)", icon: "ark_passive_hkf_10.png" }
};

/** Bosses whose HP bar count is fixed rather than derived. From `src/lib/constants/encounters.ts`. */
export const bossHpMap: Record<string, number> = {
  "Dark Mountain Predator": 50,
  "Destroyer Lucas": 50,
  "Leader Lugaru": 50,
  "Demon Beast Commander Valtan": 160,
  "Ravaged Tyrant of Beasts": 40,
  "Incubus Morphe": 60,
  "Nightmarish Morphe": 60,
  "Covetous Devourer Vykas": 160,
  "Covetous Legion Commander Vykas": 180,
  Saydon: 160,
  Kakul: 140,
  "Kakul-Saydon": 180,
  "Encore-Desiring Kakul-Saydon": 77,
  "Gehenna Helkasirs": 120,
  Ashtarot: 170,
  "Primordial Nightmare": 190,
  "Brelshaza, Monarch of Nightmares": 200,
  "Imagined Primordial Nightmare": 20,
  "Pseudospace Primordial Nightmare": 20,
  "Phantom Legion Commander Brelshaza": 250,
  "Griefbringer Maurug": 150,
  "Evolved Maurug": 30,
  "Lord of Degradation Akkan": 190,
  "Plague Legion Commander Akkan": 220,
  "Lord of Kartheon Akkan": 300,
  Tienis: 110,
  "Celestial Sentinel": 60,
  Prunya: 90,
  Lauriel: 200,
  "Kaltaya, the Blooming Chaos": 120,
  "Rakathus, the Lurking Arrogance": 160,
  "Firehorn, Trampler of Earth": 160,
  "Lazaram, the Trailblazer": 200,
  "Killineza the Dark Worshipper": 180,
  "Valinak, Knight of Darkness": 180,
  "Valinak, Taboo Usurper": 180,
  "Valinak, Herald of the End": 180,
  "Thaemine the Lightqueller": 300,
  "Dark Greatsword": 40,
  "Darkness Legion Commander Thaemine": 350,
  "Thaemine Prokel": 35,
  "Thaemine, Conqueror of Stars": 350,
  "Red Doom Narkiel": 180,
  Agris: 100,
  Echidna: 285,
  "Covetous Master Echidna": 285,
  "Alcaone, the Twisted Venom": 86,
  "Agris, the Devouring Bog": 103,
  "Behemoth, the Storm Commander": 500,
  "Behemoth, Cruel Storm Slayer": 705,
  "Akkan, Lord of Death": 220,
  "Aegir, the Oppressor": 300,
  "Narok the Butcher": 300,
  "Phantom Manifester Brelshaza": 420,
  "Thaemine, Master of Darkness": 300,
  Infernas: 300,
  "Blossoming Fear, Naitreya": 300,
  "Mordum, the Abyssal Punisher": 500,
  "Flash of Punishment": 350,
  "Abyssal Beast, Narhash": 100,
  "Flame of Darkness, Tarkal": 300,
  "Act 4: Covetous Master Echidna": 300,
  "Brelshaza, Ember in the Ashes": 450,
  "Armoche, Sentinel of the Abyss": 450,
  "Abyss Lord Kazeros": 999,
  "Archdemon Kazeros": 999,
  "Death Incarnate Kazeros": 777
};

/** Number of HP bars a boss shows. Mirrors `getBossHpBars` in the desktop app's `src/lib/utils.ts`. */
export function getBossHpBars(boss: { name: string; maxHp: number; hpBars?: number }): number {
  if (boss.hpBars) return boss.hpBars;
  if (boss.name === "Phantom Legion Commander Brelshaza") {
    return boss.maxHp > 100_000_000_000 ? 420 : 250;
  }
  return bossHpMap[boss.name] ?? 1;
}
