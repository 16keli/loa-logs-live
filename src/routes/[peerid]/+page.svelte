<script lang="ts">
  import { page } from "$app/state";
  import BossBar from "$lib/components/BossBar.svelte";
  import EncounterHeader from "$lib/components/EncounterHeader.svelte";
  import MeterTable from "$lib/components/MeterTable.svelte";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
  import SkillBreakdown from "$lib/components/SkillBreakdown.svelte";
  import { getBossHpBars } from "$lib/constants";
  import { LiveConnection } from "$lib/peer.svelte";
  import { ViewerState } from "$lib/viewer.svelte";
  import { onMount } from "svelte";

  let peerId = $derived(page.params.peerid ?? "");

  const viewer = new ViewerState();
  // Built here rather than inside the effect below, so its reactive fields aren't owned by an
  // effect that re-runs whenever the route parameter changes.
  const connection = new LiveConnection(viewer);

  onMount(() => {
    // Local clock for the duration and DPS, so numbers move between the host's 1 Hz frames.
    const clock = setInterval(() => (viewer.now = Date.now()), 1000);
    return () => clearInterval(clock);
  });

  $effect(() => {
    const id = peerId;
    if (!id) return;

    viewer.clear();
    connection.connect(id);

    return () => connection.destroy();
  });

  function reconnect() {
    viewer.clear();
    connection.connect();
  }

  let scroller = $state<HTMLDivElement>();
  let inBreakdown = $derived(viewer.selectedRow !== null);

  // Start each view from the top, as the meter does when switching between the list and a breakdown.
  $effect(() => {
    void inBreakdown;
    if (scroller) scroller.scrollTop = 0;
  });

  /** Right-click backs out of a breakdown, as in the meter; in the list it keeps the browser's menu. */
  function oncontextmenu(event: MouseEvent) {
    if (!inBreakdown) return;
    event.preventDefault();
    viewer.closeBreakdown();
  }

  let status = $derived(connection.status);
  // bossStatus arrives at ~5 Hz and drives the animated bar; the encounter's own copy is the 1 Hz
  // fallback that fills the gap for a viewer who joined between boss updates.
  let boss = $derived.by(() => {
    if (viewer.bossStatus) return viewer.bossStatus;

    const fallback = viewer.boss;
    if (!fallback) return null;

    const totalBars = getBossHpBars(fallback);
    return {
      name: fallback.name,
      isDead: fallback.isDead,
      currentHp: fallback.currentHp,
      maxHp: fallback.maxHp,
      currentShield: fallback.currentShield,
      totalBars,
      currentBars: totalBars
    };
  });
</script>

<svelte:head>
  <title>{viewer.encounter?.currentBossName || "LOA Logs Live"}</title>
</svelte:head>

<main class="mx-auto flex h-dvh max-w-4xl flex-col">
  {#if status === "connected"}
    {#if boss}
      <BossBar {boss} />
    {/if}

    <EncounterHeader {viewer} />

    <div
      class="min-h-0 flex-1 overflow-x-auto overflow-y-auto"
      role="region"
      aria-label={inBreakdown ? "Skill breakdown" : "Damage meter"}
      bind:this={scroller}
      {oncontextmenu}
    >
      {#if viewer.selectedRow}
        <SkillBreakdown row={viewer.selectedRow} onback={() => viewer.closeBreakdown()} />
      {:else}
        <MeterTable {viewer} />
      {/if}
    </div>

    <footer class="flex h-8 shrink-0 items-center gap-3 border-t border-neutral-800 px-3 text-xs text-neutral-500">
      <span class="truncate">Watching {peerId}</span>
      <span class="flex-1"></span>
      <SettingsPanel />
    </footer>
  {:else}
    <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {#if status === "connecting"}
        <p class="animate-pulse text-neutral-400">Connecting…</p>
      {:else if status === "error"}
        <div>
          <p class="font-medium">Couldn't connect.</p>
          <p class="mt-1 text-sm text-neutral-400">
            {connection.error ?? "The host may have stopped sharing."}
          </p>
        </div>
        <button
          class="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500"
          onclick={reconnect}
        >
          Try again
        </button>
      {:else}
        <p class="font-medium">Disconnected.</p>
        <button
          class="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500"
          onclick={reconnect}
        >
          Reconnect
        </button>
      {/if}
    </div>
  {/if}
</main>
