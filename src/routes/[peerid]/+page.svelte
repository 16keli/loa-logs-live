<script lang="ts">
  import { base } from "$app/paths";
  import { page, updated } from "$app/state";
  import BossBar from "$lib/components/BossBar.svelte";
  import EncounterHeader from "$lib/components/EncounterHeader.svelte";
  import MeterTable from "$lib/components/MeterTable.svelte";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
  import SkillBreakdown from "$lib/components/SkillBreakdown.svelte";
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
    const clock = setInterval(() => viewer.tick(), 1000);
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
  let boss = $derived(viewer.shownBoss);
  // The meter stays up through a reconnect once there is something to show, so a dropped connection
  // during a pull does not wipe the numbers off the screen.
  let showMeter = $derived(status === "connected" || (status === "reconnecting" && viewer.encounter !== null));

  // Reload onto a new deploy, but not in the middle of a pull: wait until the fight's clock stops (or
  // there is no fight, or the tab is hidden). The reload reconnects to the same host, which sends the
  // current encounter to every new connection, so nothing is lost; settings live in localStorage.
  let hidden = $state(false);
  $effect(() => {
    if (!updated.current) return;
    if (viewer.clockRunning && status === "connected" && !hidden) return;
    location.reload();
  });
</script>

<!-- Back to the home page, to enter a different link when this one can't be reached. -->
{#snippet homeLink()}
  <a class="text-sm text-neutral-400 underline underline-offset-2 hover:text-neutral-100" href="{base}/">
    Watch a different link
  </a>
{/snippet}

<svelte:document onvisibilitychange={() => (hidden = document.visibilityState === "hidden")} />

<svelte:head>
  <title>{viewer.encounter?.currentBossName || "LOA Logs Live"}</title>
</svelte:head>

<main class="mx-auto flex h-dvh max-w-4xl flex-col">
  {#if showMeter}
    {#if status === "reconnecting"}
      <!-- Reconnecting with the last frame still on screen. -->
      <div class="flex h-6 shrink-0 items-center justify-center gap-2 bg-amber-900/60 text-xs text-amber-100">
        <span class="size-1.5 animate-pulse rounded-full bg-amber-400"></span>
        Reconnecting…
        <button class="underline underline-offset-2 hover:text-white" onclick={reconnect}>Retry now</button>
      </div>
    {/if}

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
        <SkillBreakdown
          row={viewer.selectedRow}
          onback={() => viewer.closeBreakdown()}
          onsort={(sort) => (viewer.skillSort = sort)}
        />
      {:else}
        <MeterTable {viewer} />
      {/if}
    </div>

    <footer class="flex h-8 shrink-0 items-center gap-3 border-t border-neutral-800 px-3 text-xs text-neutral-500">
      <span class="truncate">Watching {peerId}</span>
      <span class="flex-1"></span>
      {#if viewer.viewerCount !== null}
        <!-- Counted by the host, so everyone watching sees the same number. -->
        <span class="shrink-0" title="Viewers connected to this host">
          {viewer.viewerCount}
          {viewer.viewerCount === 1 ? "viewer" : "viewers"}
        </span>
      {/if}
      <SettingsPanel />
    </footer>
  {:else}
    <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {#if status === "connecting"}
        <p class="animate-pulse text-neutral-400">Connecting…</p>
      {:else}
        <div>
          <p class="font-medium">
            {status === "reconnecting" ? "Reconnecting…" : "Couldn't connect."}
          </p>
          <p class="mt-1 text-sm text-neutral-400">
            {connection.error ?? "The host may have stopped sharing."}
          </p>
          {#if connection.attempts > 1}
            <p class="mt-1 text-xs text-neutral-500">
              {connection.attempts} attempts so far. Keeps trying while this page is open.
            </p>
          {/if}
        </div>
        <button
          class="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500"
          onclick={reconnect}
        >
          Try again now
        </button>
        {@render homeLink()}
      {/if}
    </div>
  {/if}
</main>
