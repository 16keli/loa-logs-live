<script lang="ts">
  import PlayerRowView from "$lib/components/PlayerRow.svelte";
  import { type ColumnKey, columnLabels, columnTooltips, settings } from "$lib/settings.svelte";
  import type { ViewerState } from "$lib/viewer.svelte";
  import { flip } from "svelte/animate";

  let { viewer }: { viewer: ViewerState } = $props();

  /**
   * A column shows when the viewer wants it *and* somebody has data for it — the host doesn't send
   * its aggregate flags, so emptiness is the only signal that a column is irrelevant to this fight.
   */
  let visibleColumns = $derived.by(() => {
    const a = viewer.aggregates;
    // Mirrors each column's show() in the meter's DamageMeterColumns.svelte.
    const hasData: Record<ColumnKey, boolean> = {
      deadFor: a.deadFor,
      deaths: a.deaths,
      incapacitated: a.incapacitated,
      damage: true,
      damagePercent: a.notSolo,
      unbuffedDamage: a.unbuffed,
      ndmg: a.rdps,
      rdmg: a.rdps,
      dps: true,
      ndps: a.rdps,
      rdps: a.rdps,
      unbuffedDps: a.unbuffed,
      supportContrib: a.supportContrib,
      rdpsContrib: a.rdps,
      crit: a.crit,
      critDamage: a.crit,
      frontAttackHits: a.frontAttack,
      frontAttack: a.frontAttack,
      backAttackHits: a.backAttack,
      backAttack: a.backAttack,
      supportBuff: a.supportBuff,
      brand: a.brand,
      identity: a.identity,
      hat: a.hat,
      stagger: a.stagger,
      counters: a.counters
    };

    return (Object.keys(columnLabels) as ColumnKey[]).filter((c) => settings.columns[c] && hasData[c]);
  });

  let groups = $derived(settings.splitParties ? viewer.parties : [viewer.players]);
</script>

{#if viewer.players.length === 0}
  <p class="p-6 text-center text-sm text-neutral-500">Waiting for combat data…</p>
{:else}
  <div class="flex flex-col gap-3 p-1">
    {#each groups as group, i (i)}
      <!--
        In a fixed layout the name column only gets what the w-14 value columns leave, which is nothing
        once they outgrow the page (many columns, or a phone). The minimum width keeps it at 10rem and
        lets the scroll container scroll sideways instead.
      -->
      <table
        class="w-full table-fixed border-separate border-spacing-y-px"
        style="min-width: calc(10rem + {visibleColumns.length} * 3.5rem)"
      >
        <thead>
          <!-- No uppercase: the meter's labels are case-sensitive (nDPS, uDMG, rCon%). -->
          <tr class="h-6 text-xs text-neutral-400 select-none">
            <th class="max-w-0 pl-1.5 text-left font-medium tracking-wide uppercase">
              {#if settings.splitParties && groups.length > 1}
                Party {i + 1}
              {/if}
            </th>
            {#each visibleColumns as column (column)}
              <th class="w-14 px-1 text-right font-medium" title={columnTooltips[column]}>{columnLabels[column]}</th>
            {/each}
            <!--
              Claims the column slot of each row's absolutely positioned damage bar. Without it, the fixed
              layout treats that slot as a second auto column and gives it half the name column's width.
            -->
            <th class="w-0 p-0" aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {#each group as row (row.key)}
            <!-- Rows slide to their new place when the order changes, as in the meter. -->
            <tr
              animate:flip={{ duration: 200 }}
              class="relative isolate h-7 cursor-pointer text-sm outline-accent-500 hover:bg-white/5 focus-visible:outline"
              role="button"
              tabindex="0"
              aria-label="Show {row.name}'s skill breakdown"
              onclick={() => viewer.selectPlayer(row.entity.name)}
              onkeydown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                viewer.selectPlayer(row.entity.name);
              }}
            >
              <PlayerRowView {row} {visibleColumns} />
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
{/if}
