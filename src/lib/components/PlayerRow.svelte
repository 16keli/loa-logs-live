<script lang="ts">
  import { classIcon } from "$lib/constants";
  import { abbreviateNumberSplit, formatPercent } from "$lib/format";
  import { type ColumnKey, settings } from "$lib/settings.svelte";
  import type { PlayerRow } from "$lib/viewer.svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";

  let { row, visibleColumns }: { row: PlayerRow; visibleColumns: ColumnKey[] } = $props();

  const width = new Tween(0, { duration: 400, easing: cubicOut });

  $effect(() => {
    width.set(row.barWidth);
  });

  let damage = $derived(abbreviateNumberSplit(row.damage));
  let dps = $derived(abbreviateNumberSplit(row.dps));

  function cell(column: ColumnKey): { value: string; unit?: string; title?: string } {
    switch (column) {
      case "damage":
        return { value: String(damage[0]), unit: damage[1], title: row.damage.toLocaleString() };
      case "damagePercent":
        return { value: formatPercent(row.damagePercent) };
      case "dps":
        return { value: String(dps[0]), unit: dps[1], title: Math.round(row.dps).toLocaleString() };
      case "crit":
        return { value: formatPercent(row.critPercent, 0) };
      case "frontAttack":
        return { value: formatPercent(row.frontAttackPercent, 0) };
      case "backAttack":
        return { value: formatPercent(row.backAttackPercent, 0) };
      case "deaths":
        return { value: row.deaths > 0 ? String(row.deaths) : "-" };
    }
  }
</script>

<tr class="relative isolate h-7 text-sm">
  <!-- Damage bar, behind the row content. Matches the meter: an absolutely positioned cell. -->
  <td
    class="absolute left-0 -z-10 h-7 rounded-r-xs"
    style="background-color: rgb(from {settings.classColorBars
      ? row.color
      : '#525252'} r g b / 0.6); width: {width.current}%;"
  ></td>

  <td class="w-6 pl-1.5">
    <img class="size-5" src={classIcon(row.entity.classId)} alt={row.entity.class} title={row.entity.class} />
  </td>

  <td class="max-w-0 truncate pr-2 pl-1.5">
    <span class:font-semibold={row.isLocalPlayer} class:text-accent-400={row.isLocalPlayer}>
      {row.name}
    </span>
  </td>

  {#each visibleColumns as column (column)}
    {@const c = cell(column)}
    <td class="tabular w-14 px-1 text-right whitespace-nowrap" title={c.title}>
      {c.value}{#if c.unit}<span class="text-xs opacity-70">{c.unit}</span>{/if}
    </td>
  {/each}
</tr>
