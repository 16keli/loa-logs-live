<script lang="ts">
  import {
    type BreakdownColumnKey,
    breakdownColumnLabels,
    type ColumnKey,
    columnLabels,
    settings
  } from "$lib/settings.svelte";

  let open = $state(false);
  let columnKeys = Object.keys(columnLabels) as ColumnKey[];
  let breakdownColumnKeys = Object.keys(breakdownColumnLabels) as BreakdownColumnKey[];
</script>

<div class="relative">
  <button
    class="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    Display
  </button>

  {#if open}
    <!-- Click-away backdrop. -->
    <button class="fixed inset-0 z-10 cursor-default" aria-label="Close display settings" onclick={() => (open = false)}
    ></button>

    <div class="absolute right-0 z-20 mt-1 w-48 rounded border border-neutral-700 bg-neutral-900 p-3 text-sm shadow-lg">
      <p class="mb-2 text-xs tracking-wide text-neutral-400 uppercase">Columns</p>
      <div class="grid grid-cols-2 gap-1">
        {#each columnKeys as column (column)}
          <label class="flex items-center gap-1.5">
            <input type="checkbox" class="accent-accent-500" bind:checked={settings.columns[column]} />
            {columnLabels[column]}
          </label>
        {/each}
      </div>

      <p class="mt-3 mb-2 text-xs tracking-wide text-neutral-400 uppercase">Breakdown columns</p>
      <div class="grid grid-cols-2 gap-1">
        {#each breakdownColumnKeys as column (column)}
          <label class="flex items-center gap-1.5">
            <input type="checkbox" class="accent-accent-500" bind:checked={settings.breakdownColumns[column]} />
            {breakdownColumnLabels[column]}
          </label>
        {/each}
      </div>

      <p class="mt-3 mb-2 text-xs tracking-wide text-neutral-400 uppercase">Layout</p>
      <label class="flex items-center gap-1.5">
        <input type="checkbox" class="accent-accent-500" bind:checked={settings.splitParties} />
        Split parties
      </label>
      <label class="mt-1 flex items-center gap-1.5">
        <input type="checkbox" class="accent-accent-500" bind:checked={settings.classColorBars} />
        Class colors
      </label>
    </div>
  {/if}
</div>
