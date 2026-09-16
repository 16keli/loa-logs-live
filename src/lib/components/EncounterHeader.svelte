<script lang="ts">
  import { abbreviateNumberSplit, timestampToMinutesAndSeconds } from "$lib/format";
  import type { ViewerState } from "$lib/viewer.svelte";

  let { viewer }: { viewer: ViewerState } = $props();

  let totalDamage = $derived(abbreviateNumberSplit(viewer.totalDamageDealt));
  let dps = $derived(abbreviateNumberSplit(viewer.dps));
</script>

<div class="flex h-8 items-center gap-4 border-b border-neutral-800 bg-neutral-900/60 px-3 text-sm select-none">
  <span class="tabular font-medium">{timestampToMinutesAndSeconds(viewer.duration)}</span>

  <span class="tabular" title={viewer.totalDamageDealt.toLocaleString()}>
    <span class="mr-1 text-xs tracking-wide text-neutral-400 uppercase">T. DMG</span>
    {totalDamage[0]}<span class="text-xs opacity-70">{totalDamage[1]}</span>
  </span>

  <span class="tabular">
    <span class="mr-1 text-xs tracking-wide text-neutral-400 uppercase">T. DPS</span>
    {dps[0]}<span class="text-xs opacity-70">{dps[1]}</span>
  </span>

  {#if viewer.timeToKill}
    <span class="tabular" title="Time to Kill">
      <span class="mr-1 text-xs tracking-wide text-neutral-400 uppercase">TTK</span>
      {viewer.timeToKill}
    </span>
  {/if}

  <span class="flex-1"></span>

  {#if viewer.encounter?.currentBossName}
    <span class="min-w-0 truncate text-neutral-400">{viewer.encounter.currentBossName}</span>
  {/if}

  {#if viewer.meterStatus.raidInProgress}
    <span class="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
      <span class="size-1.5 animate-pulse rounded-full bg-red-500"></span>
      LIVE
    </span>
  {/if}
</div>
