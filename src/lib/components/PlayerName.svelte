<script lang="ts">
  import { arkGridRows, arkPassiveSpec, arkPassiveTrees } from "$lib/arkPassive";
  import { isSupportSpec } from "$lib/constants";
  import { normalizeIlvl } from "$lib/format";
  import type { PlayerRow } from "$lib/viewer.svelte";

  import Tooltip from "./Tooltip.svelte";

  /**
   * Icon, name and profile link, with the meter's tooltips: `ClassTooltip` on the icon, and
   * `ArkPassiveTooltip` (combat power, Ark Grid, Ark Passive) on the name.
   */
  let { row, bold = false }: { row: PlayerRow; bold?: boolean } = $props();

  let entity = $derived(row.entity);
  let data = $derived(entity.arkPassiveData);
  let grid = $derived(data?.arkGridOrder ? arkGridRows(data) : []);
  let trees = $derived(arkPassiveTrees(data));
  // The meter only lists the trees when their spec matches the one the host reported.
  let specMatches = $derived(!!entity.spec && arkPassiveSpec(data) === entity.spec);

  const INDEX_COLORS = ["bg-sky-500/80", "bg-green-600/80", "bg-amber-600/80"];
</script>

{#snippet classTooltip()}
  {#if row.isSidereal}
    {entity.name}
  {:else}
    {#if entity.arkPassiveActive}<span class="mr-1 text-purple-400">[Ark Passive]</span>{/if}{entity.spec
      ? `${entity.spec} ${entity.class}`
      : entity.class}
  {/if}
{/snippet}

{#snippet nameTooltip()}
  <div class="flex flex-col whitespace-normal">
    <div class="flex items-center gap-1">
      <span>{row.name}</span>
      {#if row.loadoutUrl}
        <a
          class="text-xs text-neutral-300 underline hover:text-neutral-100"
          href={row.loadoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View Loadout Snapshot"
        >
          Loadout Snapshot
        </a>
      {/if}
    </div>
    {#if entity.combatPower}
      <p class="text-xs {isSupportSpec(entity.spec) ? 'text-green-400' : 'text-red-400'}">
        {normalizeIlvl(entity.combatPower)} Combat Power
      </p>
    {/if}
    <div class="text-xs">
      {#if grid.length}
        <div class="mb-1">
          <div class="text-purple-400">[Ark Grid]</div>
          <div class="flex flex-col gap-0.5">
            {#each grid as core, i (i)}
              <div class="flex h-4 items-center gap-1">
                <span
                  class="flex size-4 items-center justify-center rounded-sm font-mono text-white {core.index
                    ? INDEX_COLORS[core.index - 1]
                    : 'bg-neutral-700/80'}"
                >
                  {core.index}
                </span>
                {#if core.name}<span class="text-neutral-200">{core.name}</span>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
      {#if trees.length && entity.spec}
        {#if specMatches}
          {#each trees as tree (tree.label)}
            <div class="text-purple-400">[{tree.label}]</div>
            {#each tree.nodes as node, i (i)}
              <div class="flex items-center gap-1">
                <span class={tree.color}>T{node.tier} {node.name}</span>
                <span class="text-white">Lv. {node.level}</span>
              </div>
            {/each}
          {/each}
        {:else}
          <div class="text-violet-400">Mismatched Ark Passive Data</div>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

<div class="flex min-w-0 items-center gap-1.5">
  <Tooltip tooltip={classTooltip} class="shrink-0">
    <img class="size-5" src={row.icon} alt={row.iconLabel} />
  </Tooltip>
  <!-- Sidereals have no character details, so their name has no tooltip. -->
  <Tooltip tooltip={row.isSidereal ? null : nameTooltip} delay={500} class="min-w-0">
    <span
      class="block truncate"
      class:font-semibold={row.isLocalPlayer}
      class:font-medium={bold}
      class:text-accent-400={row.isLocalPlayer}
    >
      {row.name}
    </span>
  </Tooltip>
  {#if row.profileUrl}
    <a
      class="shrink-0 text-neutral-400 hover:text-neutral-100"
      href={row.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="View Character Profile"
      aria-label="View {entity.name}'s profile on lostark.bible"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <!-- External link icon, as the meter's IconExternalLink. -->
      <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path
          d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        />
      </svg>
    </a>
  {/if}
</div>
