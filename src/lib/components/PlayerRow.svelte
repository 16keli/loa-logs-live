<script lang="ts">
  import { classIcon, withAlpha } from "$lib/constants";
  import { abbreviateNumber, abbreviateNumberSplit, formatPercent } from "$lib/format";
  import { type ColumnKey, settings } from "$lib/settings.svelte";
  import type { PlayerRow } from "$lib/viewer.svelte";
  import { untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";

  /** A player's cells. The `<tr>` belongs to MeterTable, so it can animate reordering. */
  let { row, visibleColumns }: { row: PlayerRow; visibleColumns: ColumnKey[] } = $props();

  // Starts at the current width rather than 0. A row that gets rebuilt (it changed table, or the view
  // switched) would otherwise flash empty and regrow, which reads as the bar blanking out.
  const width = new Tween(
    untrack(() => row.barWidth),
    { duration: 400, easing: cubicOut }
  );

  $effect(() => {
    width.set(row.barWidth);
  });

  type Cell = { value: string; unit?: string; title?: string };

  function amount(n: number, title?: string): Cell {
    const [value, unit] = abbreviateNumberSplit(n);
    return { value: String(value), unit, title: title ?? Math.round(n).toLocaleString() };
  }

  // Values and tooltips follow the snippets in the meter's DamageMeterColumns.svelte.
  function cell(column: ColumnKey): Cell {
    switch (column) {
      case "deadFor": {
        const seconds = row.deadForSeconds;
        return { value: seconds === null ? "" : `${seconds.toFixed(0)}s` };
      }
      case "deaths":
        return { value: row.deaths > 0 ? String(row.deaths) : "-" };
      case "incapacitated": {
        const { total, knockDown, cc } = row.incapacitatedMs;
        return {
          value: `${(total / 1000).toFixed(1)}s`,
          title: `Knockdowns: ${(knockDown / 1000).toFixed(1)}s\nCrowd control: ${(cc / 1000).toFixed(1)}s`
        };
      }
      case "damage":
        return amount(row.damage);
      case "damagePercent":
        return { value: formatPercent(row.damagePercent) };
      case "unbuffedDamage":
        if (row.isSupport)
          return amount(row.totalDamageBuffed, `Total Damage Buffed: ${abbreviateNumber(row.totalDamageBuffed)}`);
        if (!row.anyUnbuffedDamage) return { value: "-" };
        return amount(
          row.unbuffedDamage,
          `Base: ${abbreviateNumber(row.unbuffedDamage)}\nBuffed: ${abbreviateNumber(row.damage - row.unbuffedDamage)}`
        );
      case "ndmg":
        return amount(row.baseDamage);
      case "rdmg":
        return amount(row.raidDamage);
      case "dps":
        return amount(row.dps);
      case "ndps":
        return amount(
          row.ndps,
          `nDPS: ${Math.round(row.ndps).toLocaleString()}\nSelf DMG: ${abbreviateNumber(row.baseDamage)}`
        );
      case "rdps":
        return amount(
          row.rdps,
          `rDPS: ${Math.round(row.rdps).toLocaleString()}\nSelf DMG: ${abbreviateNumber(row.baseDamage)}\n` +
            `Outgoing: ${abbreviateNumber(row.entity.damageStats.rdpsDamageGiven)}`
        );
      case "unbuffedDps":
        if (row.isSupport) return amount(row.totalDpsBuffed, `Buff DPS: ${abbreviateNumber(row.totalDpsBuffed)}`);
        if (!row.anyUnbuffedDamage) return { value: "-" };
        return amount(row.unbuffedDps);
      case "supportContrib":
        if (row.isSupport) {
          const pct = formatPercent(row.supportContribPercent);
          return { value: pct, title: `The support contributed ${pct} damage to the party with primary buffs` };
        }
        if (row.anyUnbuffedDamage) {
          const pct = formatPercent(row.buffedShareOfOwnDamage);
          return { value: pct, title: `The support contributed ${pct} of the damage from primary buffs` };
        }
        return { value: "-" };
      case "rdpsContrib":
        if (row.rdpsContribDamage <= 0) return { value: "-" };
        return {
          value: formatPercent(row.rdpsContribPercent),
          title: `${row.isSupport ? "Given" : "Received"}: ${abbreviateNumber(row.rdpsContribDamage)}`
        };
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
      case "stagger":
        return row.stagger > 0 ? amount(row.stagger) : { value: "-" };
      case "counters":
        return { value: String(row.counters) };
    }
  }
</script>

<td class="max-w-0 pr-2 pl-1.5">
  <div class="flex items-center gap-1.5">
    <img class="size-5 shrink-0" src={classIcon(row.entity.classId)} alt={row.entity.class} title={row.entity.class} />
    <span
      class="truncate"
      class:font-semibold={row.isLocalPlayer}
      class:text-accent-400={row.isLocalPlayer}
      title={row.name}
    >
      {row.name}
    </span>
  </div>
</td>

{#each visibleColumns as column (column)}
  {@const c = cell(column)}
  <td class="tabular w-14 px-1 text-right whitespace-nowrap" title={c.title}>
    {c.value}{#if c.unit}<span class="text-xs opacity-70">{c.unit}</span>{/if}
  </td>
{/each}

<!--
  Damage bar, behind the row content: an absolutely positioned cell, as in the meter. It must stay
  last. Chromium still gives it a column slot, so anywhere earlier it shifts every cell after it one
  column right of its header.
  The color is `!important` because Dark Reader's fallback sheet paints every element's background
  with `!important`, which blanks the bars; only an important inline declaration outranks it.
-->
<td
  class="absolute left-0 -z-10 h-7 rounded-r-xs"
  style:background-color|important={withAlpha(settings.classColorBars ? row.color : "#525252", 0.6)}
  style:width="{width.current}%"
></td>
