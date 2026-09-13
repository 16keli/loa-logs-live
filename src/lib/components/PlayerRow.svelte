<script lang="ts">
  import { classIcon } from "$lib/constants";
  import { abbreviateNumberSplit, formatPercent } from "$lib/format";
  import { type ColumnKey, settings } from "$lib/settings.svelte";
  import type { PlayerRow } from "$lib/viewer.svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";

  let {
    row,
    visibleColumns,
    onselect
  }: { row: PlayerRow; visibleColumns: ColumnKey[]; onselect: (row: PlayerRow) => void } = $props();

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onselect(row);
  }

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
      case "supportBuff":
        return { value: formatPercent(row.supportBuffPercent) };
      case "brand":
        return { value: formatPercent(row.brandPercent) };
      case "identity":
        return { value: formatPercent(row.identityPercent) };
      case "hat":
        return { value: formatPercent(row.hatPercent) };
      case "deaths":
        return { value: row.deaths > 0 ? String(row.deaths) : "-" };
    }
  }
</script>

<tr
  class="relative isolate h-7 cursor-pointer text-sm outline-accent-500 hover:bg-white/5 focus-visible:outline"
  role="button"
  tabindex="0"
  aria-label="Show {row.name}'s skill breakdown"
  onclick={() => onselect(row)}
  {onkeydown}
>
  <td class="max-w-0 pr-2 pl-1.5">
    <div class="flex items-center gap-1.5">
      <img
        class="size-5 shrink-0"
        src={classIcon(row.entity.classId)}
        alt={row.entity.class}
        title={row.entity.class}
      />
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
  -->
  <td
    class="absolute left-0 -z-10 h-7 rounded-r-xs"
    style="background-color: rgb(from {settings.classColorBars
      ? row.color
      : '#525252'} r g b / 0.6); width: {width.current}%;"
  ></td>
</tr>
