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

export function classIcon(classId: number): string {
  // `base` is empty in dev and on a root deployment, and "/<repo>" on GitHub project pages.
  return `${base}/images/classes/${classId}.png`;
}

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
