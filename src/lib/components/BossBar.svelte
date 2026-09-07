<script lang="ts">
  import { bossHpBarColors } from "$lib/constants";
  import { abbreviateNumberSplit } from "$lib/format";
  import type { BossStatus } from "$lib/protocol";
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

  let hpSplit = $derived(abbreviateNumberSplit(boss.isDead ? 0 : hp));
  let maxHpSplit = $derived(abbreviateNumberSplit(boss.maxHp));
  let shieldSplit = $derived(abbreviateNumberSplit(shield));

  // Fill of the *current* bar only, matching the meter.
  const fill = new Tween(100, { duration: 200, easing: linear });

  $effect(() => {
    if (boss.isDead || hp <= 0) {
      fill.set(0);
    } else if (hp < boss.maxHp) {
      const hpPerBar = boss.maxHp / totalBars;
      fill.set(((hp % hpPerBar) / hpPerBar) * 100);
    } else {
      fill.set(100);
    }
  });
</script>

<div class="relative isolate flex h-8 items-center border-y border-black bg-neutral-900/70 select-none">
  {#if hp > 0}
    {#if shield > 0}
      <div class="absolute inset-0 -z-10 bg-neutral-400/95"></div>
    {:else}
      <div
        class="absolute inset-y-0 left-0 -z-10 transition-none"
        style="background-color: rgb(from {barColor[0]} r g b / 0.8); width: {fill.current}%;"
      ></div>
      {#if totalBars > 1 && currentBars > 1}
        <!-- The bar underneath, revealed as the current one drains. -->
        <div class="absolute inset-0 -z-20" style="background-color: rgb(from {barColor[1]} r g b / 0.8);"></div>
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
  </span>

  {#if currentBars > 0 && totalBars > 1}
    <span class="tabular z-10 pr-3 text-sm opacity-80">x{currentBars}</span>
  {/if}
</div>
