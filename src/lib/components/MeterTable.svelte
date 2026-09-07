<script lang="ts">
  import PlayerRowView from "$lib/components/PlayerRow.svelte";
  import { type ColumnKey, columnLabels, settings } from "$lib/settings.svelte";
  import type { ViewerState } from "$lib/viewer.svelte";

  let { viewer }: { viewer: ViewerState } = $props();

  /**
   * A column shows when the viewer wants it *and* somebody has data for it — the host doesn't send
   * its aggregate flags, so emptiness is the only signal that a column is irrelevant to this fight.
   */
  let visibleColumns = $derived.by(() => {
    const { crit, frontAttack, backAttack, deaths } = viewer.aggregates;
    const hasData: Record<ColumnKey, boolean> = {
      damage: true,
      damagePercent: true,
      dps: true,
      crit,
      frontAttack,
      backAttack,
      deaths
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
      <table class="w-full table-fixed border-separate border-spacing-y-px">
        <thead>
          <tr class="h-6 text-xs tracking-wide text-neutral-400 uppercase select-none">
            <th class="w-6"></th>
            <th class="max-w-0 pl-1.5 text-left font-medium">
              {#if settings.splitParties && groups.length > 1}
                Party {i + 1}
              {/if}
            </th>
            {#each visibleColumns as column (column)}
              <th class="w-14 px-1 text-right font-medium">{columnLabels[column]}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each group as row (row.key)}
            <PlayerRowView {row} {visibleColumns} />
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
{/if}
