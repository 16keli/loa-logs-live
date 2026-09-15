/**
 * Ark Passive and Ark Grid details for the name tooltip, following the meter's
 * `src/lib/components/tooltips/ArkPassiveTooltip.svelte` and `src/lib/utils/arkGrid.ts`.
 */
import { arkGridOrderNames, arkPassiveNodes } from "./arkPassiveData";
import type { ArkPassiveData, ArkPassiveNode } from "./types";

/** The enlightenment node that identifies each spec. From `getSpecFromArkPassive` in the tooltip. */
const specByNode: Record<number, string> = {
  2160000: "Berserker Technique",
  2160010: "Mayhem",
  2170000: "Lone Knight",
  2170010: "Combat Readiness",
  2180000: "Rage Hammer",
  2180010: "Gravity Training",
  2360000: "Judgement",
  2360010: "Blessed Aura",
  2450000: "Punisher",
  2450010: "Predator",
  2480000: "Shining Knight",
  2480100: "Liberator",
  2230000: "Ultimate Skill: Taijutsu",
  2230100: "Shock Training",
  2220000: "First Intention",
  2220100: "Esoteric Skill Enhancement",
  2240000: "Energy Overflow",
  2240100: "Robust Spirit",
  2340000: "Control",
  2340100: "Pinnacle",
  2470000: "Brawl King Storm",
  2470100: "Asura's Path",
  2390000: "Esoteric Flurry",
  2390010: "Deathblow",
  2300000: "Barrage Enhancement",
  2300100: "Firepower Enhancement",
  2290000: "Enhanced Weapon",
  2290100: "Pistoleer",
  2280000: "Death Strike",
  2280100: "Loyal Companion",
  2350000: "Evolutionary Legacy",
  2350100: "Arthetinean Skill",
  2380000: "Peacemaker",
  2380100: "Time to Hunt",
  2370000: "Igniter",
  2370100: "Reflux",
  2190000: "Grace of the Empress",
  2190100: "Order of the Emperor",
  2200000: "Communication Overflow",
  2200100: "Master Summoner",
  2210000: "Desperate Salvation",
  2210100: "True Courage",
  2270000: "Demonic Impulse",
  2270600: "Perfect Suppression",
  2250000: "Surge",
  2250600: "Remaining Energy",
  2260000: "Lunar Voice",
  2260600: "Hunger",
  2460000: "Full Moon Harvester",
  2460600: "Night's Edge",
  2320000: "Wind Fury",
  2320600: "Drizzle",
  2310000: "Full Bloom",
  2310600: "Recurrence",
  2330000: "Ferality",
  2330100: "Phantom Beast Awakening",
  2490000: "Hellfire Successor",
  2490100: "Dreadful Roar"
};

/** The spec the enlightenment tree belongs to, or "" when none of its nodes identify one. */
export function arkPassiveSpec(data: ArkPassiveData | null | undefined): string {
  for (const node of data?.enlightenment ?? []) {
    const spec = specByNode[node.id];
    if (spec) return spec;
  }
  return "";
}

export interface ArkGridRow {
  /** 1-3, or undefined when that core type isn't set. */
  index: number | undefined;
  name: string | undefined;
}

/** Sun, moon and star Order cores, with names when the class's cores are known. */
export function arkGridRows(data: ArkPassiveData | null | undefined): ArkGridRow[] {
  const order = data?.arkGridOrder;
  const names = (data?.enlightenment ?? []).map((node) => arkGridOrderNames[node.id]).find(Boolean);
  const row = (index: number | undefined, coreType: 0 | 1 | 2): ArkGridRow => ({
    index,
    name: index ? names?.[coreType][index - 1] : undefined
  });
  return [row(order?.sun, 0), row(order?.moon, 1), row(order?.star, 2)];
}

export interface ArkPassiveTree {
  label: string;
  /** Tailwind text color, as `AP` in the meter's `constants/classes.ts`. */
  color: string;
  nodes: { tier: number; name: string; level: number }[];
}

const TREES: [keyof ArkPassiveData, string, string][] = [
  ["evolution", "Evolution", "text-amber-200"],
  ["enlightenment", "Enlightenment", "text-sky-300"],
  ["leap", "Leap", "text-lime-300"]
];

/** The three trees with their known nodes; empty trees are left out. */
export function arkPassiveTrees(data: ArkPassiveData | null | undefined): ArkPassiveTree[] {
  if (!data) return [];
  return TREES.map(([key, label, color]) => ({
    label,
    color,
    nodes: ((data[key] as ArkPassiveNode[] | undefined) ?? [])
      .filter((node) => arkPassiveNodes[node.id])
      .map((node) => ({ tier: arkPassiveNodes[node.id][1] + 1, name: arkPassiveNodes[node.id][0], level: node.lv }))
  })).filter((tree) => tree.nodes.length > 0);
}
