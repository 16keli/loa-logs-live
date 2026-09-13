<script lang="ts">
  import SkillRowView from "$lib/components/SkillRow.svelte";
  import { classIcon } from "$lib/constants";
  import { abbreviateNumberSplit, formatPercent } from "$lib/format";
  import {
    type BreakdownColumnKey,
    breakdownColumnLabels,
    breakdownColumnTooltips,
    settings
  } from "$lib/settings.svelte";
  import type { PlayerRow } from "$lib/viewer.svelte";

  let { row, onback }: { row: PlayerRow; onback: () => void } = $props();

  /** Same rule as the player list: a column shows when it's wanted *and* some skill has data for it. */
  let visibleColumns = $derived.by(() => {
    const skills = row.skills.map((s) => s.skill);
    const any = (pick: (skill: (typeof skills)[number]) => number | undefined) =>
      skills.some((s) => (pick(s) ?? 0) > 0);

    const hasData: Record<BreakdownColumnKey, boolean> = {
      damage: true,
      dps: true,
      damagePercent: true,
      crit: any((s) => s.hits),
      critDamage: any((s) => s.critDamage),
      frontAttack: any((s) => s.frontAttackDamage),
      backAttack: any((s) => s.backAttackDamage),
      supportBuff: any((s) => s.buffedBySupport),
      brand: any((s) => s.debuffedBySupport),
      identity: any((s) => s.buffedByIdentity),
      hat: any((s) => s.buffedByHat),
      avgPerHit: any((s) => s.hits),
      avgPerCast: any((s) => s.casts),
      maxHit: any((s) => s.maxDamage),
      casts: true,
      cpm: true,
      hits: true,
      hpm: true
    };

    return (Object.keys(breakdownColumnLabels) as BreakdownColumnKey[]).filter(
      (c) => settings.breakdownColumns[c] && hasData[c]
    );
  });

  function abbreviated(n: number): { value: string; unit: string; title: string } {
    const [value, unit] = abbreviateNumberSplit(n);
    return { value: String(value), unit, title: Math.round(n).toLocaleString() };
  }

  /** The player's totals. Per-skill-only columns read "-", as in the meter's breakdown header row. */
  function totalCell(column: BreakdownColumnKey): { value: string; unit?: string; title?: string } {
    switch (column) {
      case "damage":
        return abbreviated(row.damage);
      case "dps":
        return abbreviated(row.dps);
      case "damagePercent":
        return { value: formatPercent(row.damagePercent) };
      case "crit":
        return { value: formatPercent(row.critPercent, 0) };
      case "critDamage":
        return { value: formatPercent(row.critDamagePercent, 0) };
      case "frontAttack":
        return { value: formatPercent(row.frontAttackPercent, 0) };
      case "backAttack":
        return { value: formatPercent(row.backAttackPercent, 0) };
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
      <tr class="h-6 text-xs tracking-wide text-neutral-400 uppercase select-none">
        <th class="max-w-0 pl-1.5 text-left font-medium">
          <button
            class="flex items-center gap-1 tracking-normal text-neutral-200 normal-case hover:text-white"
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
          <th class="w-14 px-1 text-right font-medium" title={breakdownColumnTooltips[column]}>
            {breakdownColumnLabels[column]}
          </th>
        {/each}
        <!-- Claims the bar cell's column slot; see MeterTable.svelte. -->
        <th class="w-0 p-0" aria-hidden="true"></th>
      </tr>
    </thead>
    <tbody>
      <tr class="relative isolate h-7 text-sm">
        <td class="max-w-0 pr-2 pl-1.5">
          <div class="flex items-center gap-1.5">
            <img
              class="size-5 shrink-0"
              src={classIcon(row.entity.classId)}
              alt={row.entity.class}
              title={row.entity.class}
            />
            <span class="truncate font-medium" class:text-accent-400={row.isLocalPlayer} title={row.name}>
              {row.name}
            </span>
          </div>
        </td>

        {#each visibleColumns as column (column)}
          {@const c = totalCell(column)}
          <td class="tabular w-14 px-1 text-right whitespace-nowrap" title={c.title}>
            {c.value}{#if c.unit}<span class="text-xs opacity-70">{c.unit}</span>{/if}
          </td>
        {/each}

        <td
          class="absolute left-0 -z-10 h-7 w-full"
          style="background-color: rgb(from {settings.classColorBars ? row.color : '#525252'} r g b / 0.6);"
        ></td>
      </tr>

      {#each row.skills as skill (skill.key)}
        <SkillRowView {skill} color={row.color} {visibleColumns} />
      {/each}
    </tbody>
  </table>
</div>
