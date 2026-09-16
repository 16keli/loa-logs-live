<script lang="ts">
  import { bossHpBarColors, withAlpha } from "$lib/constants";
  import { abbreviateNumberSplit } from "$lib/format";
  import type { BossStatus } from "$lib/protocol";
  import { untrack } from "svelte";
  import { linear } from "svelte/easing";
  import { Tween } from "svelte/motion";

  let { boss }: { boss: BossStatus } = $props();

  // Clamped: the host sends currentHp raw, and it can go negative on the killing blow.
  let hp = $derived(Math.max(0, boss.currentHp));
  let shield = $derived(boss.currentShield);
  let totalBars = $derived(Math.max(1, boss.totalBars));

  // Recomputed rather than trusting the host's currentBars, so the bar and the label agree.
  let currentBars = $derived.by(() => {
    if (boss.isDead) return 0;
    if (hp >= boss.maxHp) return totalBars;
    if (shield > 0) return Math.round(((hp + shield) / boss.maxHp) * totalBars);
    return Math.ceil((hp / boss.maxHp) * totalBars);
  });

  let barColor = $derived([
    bossHpBarColors[currentBars % bossHpBarColors.length],
    bossHpBarColors[(currentBars - 1 + bossHpBarColors.length) % bossHpBarColors.length]
  ]);

  /** Share of the boss's total health left, as the meter shows beside the numbers. */
  let hpPercent = $derived(boss.isDead || hp <= 0 || boss.maxHp <= 0 ? 0 : (hp / boss.maxHp) * 100);

  let hpSplit = $derived(abbreviateNumberSplit(boss.isDead ? 0 : hp));
  let maxHpSplit = $derived(abbreviateNumberSplit(boss.maxHp));
  let shieldSplit = $derived(abbreviateNumberSplit(shield));

  // Fill of the *current* bar only, matching the meter.
  let fillTarget = $derived.by(() => {
    if (boss.isDead || hp <= 0) return 0;
    if (hp >= boss.maxHp) return 100;
    const hpPerBar = boss.maxHp / totalBars;
    return ((hp % hpPerBar) / hpPerBar) * 100;
  });

  // Starts where the boss is rather than full, so a remounted bar doesn't sweep down from 100%.
  const fill = new Tween(
    untrack(() => fillTarget),
    { duration: 200, easing: linear }
  );

  $effect(() => {
    fill.set(fillTarget);
  });
</script>

<div class="relative isolate flex h-8 items-center border-y border-black bg-neutral-900/70 select-none">
  {#if hp > 0}
    {#if shield > 0}
      <!-- Colors are important inline so Dark Reader can't blank them; see PlayerRow.svelte. -->
      <div class="absolute inset-0 -z-10" style:background-color|important="rgba(163, 163, 163, 0.95)"></div>
    {:else}
      <div
        class="absolute inset-y-0 left-0 -z-10 transition-none"
        style:background-color|important={withAlpha(barColor[0], 0.8)}
        style:width="{fill.current}%"
      ></div>
      {#if totalBars > 1 && currentBars > 1}
        <!-- The bar underneath, revealed as the current one drains. -->
        <div class="absolute inset-0 -z-20" style:background-color|important={withAlpha(barColor[1], 0.8)}></div>
      {/if}
    {/if}
  {/if}

  <span class="z-10 min-w-0 flex-1 truncate px-3 text-sm font-medium">
    {boss.name}
  </span>

  <span class="tabular z-10 px-3 text-sm">
    {hpSplit[0]}<span class="text-xs opacity-70">{hpSplit[1]}</span>
    <span class="opacity-50">/</span>
    {maxHpSplit[0]}<span class="text-xs opacity-70">{maxHpSplit[1]}</span>
    {#if shield > 0}
      <span class="ml-1 text-neutral-800">
        (+{shieldSplit[0]}{shieldSplit[1]})
      </span>
    {/if}
    <span class="ml-1">({hpPercent.toFixed(1)}<span class="text-xs">%</span>)</span>
  </span>

  {#if currentBars > 0 && totalBars > 1}
    <span class="tabular z-10 pr-3 text-sm opacity-80">x{currentBars}</span>
  {/if}
</div>
