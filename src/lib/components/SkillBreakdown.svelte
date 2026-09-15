<script lang="ts">
  import SkillRowView from "$lib/components/SkillRow.svelte";
  import { withAlpha } from "$lib/constants";
  import { abbreviateNumberSplit, formatPercent } from "$lib/format";
  import {
    type BreakdownColumnKey,
    breakdownColumnLabels,
    breakdownColumnTooltips,
    settings
  } from "$lib/settings.svelte";
  import type { PlayerRow, SkillSort } from "$lib/viewer.svelte";
  import { flip } from "svelte/animate";

  import PlayerName from "./PlayerName.svelte";
  import Tooltip from "./Tooltip.svelte";

  let { row, onback, onsort }: { row: PlayerRow; onback: () => void; onsort: (sort: SkillSort) => void } = $props();

  /** A support's breakdown leads with what they buffed, per `supportPriority` in the meter's columns. */
  const supportPriority: Partial<Record<BreakdownColumnKey, number>> = {
    buffedDamage: 1,
    buffedDps: 2,
    buffedDamagePercent: 3,
    damage: 4,
    dps: 5,
    damagePercent: 6,
    unbuffedDamage: 7,
    unbuffedDps: 8
  };

  /** The column each sort is driven from; clicking it switches to that sort. */
  const sortColumns: Partial<Record<BreakdownColumnKey, SkillSort>> = {
    damage: "damage",
    buffedDamage: "buffed",
    stagger: "stagger"
  };

  /** Same rule as the player list: a column shows when it's wanted *and* has data, per the meter's show(). */
  let visibleColumns = $derived.by(() => {
    const skills = row.skills;
    const any = (pick: (skill: (typeof skills)[number]) => number | null | undefined) =>
      skills.some((s) => (pick(s) ?? 0) > 0);
    const neutral = !row.isSupportSpec && row.encounterHasRdps;

    const hasData: Record<BreakdownColumnKey, boolean> = {
      damage: true,
      unbuffedDamage: row.anyUnbuffedDamage,
      ndmg: neutral,
      buffedDamage: row.isSupport,
      dps: true,
      unbuffedDps: row.anyUnbuffedDamage,
      ndps: neutral,
      buffedDps: row.isSupport,
      damagePercent: true,
      buffedDamagePercent: row.isSupport,
      crit: any((s) => s.hits),
      critDamage: any((s) => s.skill.critDamage),
      frontAttackHits: any((s) => s.skill.frontAttacks),
      frontAttack: any((s) => s.skill.frontAttacks),
      backAttackHits: any((s) => s.skill.backAttacks),
      backAttack: any((s) => s.skill.backAttacks),
      supportBuff: any((s) => s.skill.buffedBySupport),
      brand: any((s) => s.skill.debuffedBySupport),
      identity: any((s) => s.skill.buffedByIdentity),
      hat: any((s) => s.skill.buffedByHat),
      avgPerHit: any((s) => s.hits),
      avgPerCast: any((s) => s.casts),
      maxHit: any((s) => s.maxHit),
      casts: true,
      cpm: true,
      hits: true,
      hpm: true,
      cooldownRatio: any((s) => s.skill.timeAvailable),
      stagger: row.stagger > 0,
      damageReduced: any((s) => s.damageReduced)
    };

    const columns = (Object.keys(breakdownColumnLabels) as BreakdownColumnKey[]).filter(
      (c) => settings.breakdownColumns[c] && hasData[c]
    );
    if (!row.isSupport) return columns;
    return columns.sort((a, b) => (supportPriority[a] ?? 999) - (supportPriority[b] ?? 999));
  });

  function abbreviated(n: number): { value: string; unit: string; title: string } {
    const [value, unit] = abbreviateNumberSplit(n);
    return { value: String(value), unit, title: Math.round(n).toLocaleString() };
  }

  const dash = { value: "-" };

  /** The player's totals. Per-skill-only columns read "-", as in the meter's breakdown header row. */
  function totalCell(column: BreakdownColumnKey): { value: string; unit?: string; title?: string } {
    const received = row.entity.damageStats.rdpsDamageReceived > 0;
    switch (column) {
      case "damage":
        return abbreviated(row.damage);
      case "unbuffedDamage":
        return row.anyUnbuffedDamage ? abbreviated(row.unbuffedDamage) : dash;
      case "ndmg":
        return received ? abbreviated(row.baseDamage) : dash;
      case "buffedDamage":
        return row.totalDamageBuffed > 0 ? abbreviated(row.totalDamageBuffed) : dash;
      case "dps":
        return abbreviated(row.dps);
      case "unbuffedDps":
        return row.anyUnbuffedDamage ? abbreviated(row.unbuffedDps) : dash;
      case "ndps":
        return received ? abbreviated(row.ndps) : dash;
      case "buffedDps":
        return row.totalDamageBuffed > 0 ? abbreviated(row.totalDpsBuffed) : dash;
      case "damagePercent":
        return { value: formatPercent(row.damagePercent) };
      case "buffedDamagePercent":
        return row.totalDamageBuffed > 0 ? { value: formatPercent(row.totalDamageBuffedPercent) } : dash;
      case "crit":
        return { value: formatPercent(row.critPercent) };
      case "critDamage":
        return { value: formatPercent(row.critDamagePercent) };
      case "frontAttackHits":
        return { value: formatPercent(row.frontAttackHitPercent) };
      case "frontAttack":
        return { value: formatPercent(row.frontAttackPercent) };
      case "backAttackHits":
        return { value: formatPercent(row.backAttackHitPercent) };
      case "backAttack":
        return { value: formatPercent(row.backAttackPercent) };
      case "supportBuff":
        return { value: formatPercent(row.supportBuffPercent) };
      case "brand":
        return { value: formatPercent(row.brandPercent) };
      case "identity":
        return { value: formatPercent(row.identityPercent) };
      case "hat":
        return { value: formatPercent(row.hatPercent) };
      case "avgPerHit":
      case "avgPerCast":
      case "maxHit":
        return { value: "-" };
      case "casts":
        return { value: String(row.casts) };
      case "cpm":
        return { value: row.castsPerMinute.toFixed(1) };
      case "hits":
        return { value: String(row.hits) };
      case "hpm":
        return { value: row.hitsPerMinute.toFixed(1) };
      case "cooldownRatio":
        return dash;
      case "stagger":
        return row.stagger > 0 ? abbreviated(row.stagger) : dash;
      case "damageReduced":
        return row.totalDamageReduced > 0 ? abbreviated(row.totalDamageReduced) : dash;
    }
  }
</script>

<div class="p-1">
  <!-- The minimum width keeps the name column readable; see MeterTable.svelte. -->
  <table
    class="w-full table-fixed border-separate border-spacing-y-px"
    style="min-width: calc(10rem + {visibleColumns.length} * 3.5rem)"
  >
    <thead class="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur">
      <!-- No uppercase: the meter's labels are case-sensitive (nDPS, bD%, MaxH). -->
      <tr class="h-6 text-xs text-neutral-400 select-none">
        <th class="max-w-0 pl-1.5 text-left font-medium">
          <button
            class="flex items-center gap-1 text-neutral-200 hover:text-white"
            title="Back to Overview"
            onclick={onback}
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="14 9 9 4 4 9" />
              <path d="M20 20h-7a4 4 0 0 1-4-4V4" />
            </svg>
            Back
          </button>
        </th>
        {#each visibleColumns as column (column)}
          {@const sort = sortColumns[column]}
          {#if sort}
            <th
              class="w-14 px-1 text-right font-medium"
              style:background-color|important={row.skillSort === sort ? withAlpha(row.color, 0.1) : undefined}
              title={breakdownColumnTooltips[column]}
              aria-sort={row.skillSort === sort ? "descending" : "none"}
            >
              <button
                class="underline underline-offset-2 hover:text-neutral-100"
                class:text-neutral-100={row.skillSort === sort}
                onclick={() => onsort(sort)}
              >
                {breakdownColumnLabels[column]}
              </button>
            </th>
          {:else}
            <th class="w-14 px-1 text-right font-medium" title={breakdownColumnTooltips[column]}>
              {breakdownColumnLabels[column]}
            </th>
          {/if}
        {/each}
        <!-- Claims the bar cell's column slot; see MeterTable.svelte. -->
        <th class="w-0 p-0" aria-hidden="true"></th>
      </tr>
    </thead>
    <tbody>
      <tr class="relative isolate h-7 text-sm">
        <td class="max-w-0 pr-2 pl-1.5">
          <PlayerName {row} bold />
        </td>

        {#each visibleColumns as column (column)}
          {@const c = totalCell(column)}
          <td class="tabular w-14 px-1 text-right whitespace-nowrap">
            <Tooltip tooltip={c.title}>
              {c.value}{#if c.unit}<span class="text-xs opacity-70">{c.unit}</span>{/if}
            </Tooltip>
          </td>
        {/each}

        <td
          class="absolute left-0 -z-10 h-7 w-full"
          style:background-color|important={withAlpha(settings.classColorBars ? row.color : "#525252", 0.6)}
        ></td>
      </tr>

      {#each row.skills as skill (skill.key)}
        <!-- Rows slide to their new place when the order changes, as in the meter. -->
        <tr animate:flip={{ duration: 200 }} class="relative isolate h-7 text-sm">
          <SkillRowView {skill} color={row.color} {visibleColumns} />
        </tr>
      {/each}
    </tbody>
  </table>
</div>
