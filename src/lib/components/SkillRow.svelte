<script lang="ts">
  import { SKILL_ICON_PLACEHOLDER } from "$lib/constants";
  import { abbreviateNumberSplit, formatPercent } from "$lib/format";
  import { type BreakdownColumnKey, settings } from "$lib/settings.svelte";
  import type { SkillRow } from "$lib/viewer.svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";

  let { skill, color, visibleColumns }: { skill: SkillRow; color: string; visibleColumns: BreakdownColumnKey[] } =
    $props();

  const width = new Tween(0, { duration: 400, easing: cubicOut });

  $effect(() => {
    width.set(skill.barWidth);
  });

  function abbreviated(n: number): { value: string; unit: string; title: string } {
    const [value, unit] = abbreviateNumberSplit(n);
    return { value: String(value), unit, title: Math.round(n).toLocaleString() };
  }

  /** Special skills ignore crits, positionals and buffs, so those columns read "-" as in the meter. */
  function unlessSpecial(value: number, decimals?: number): { value: string } {
    return { value: skill.isSpecial ? "-" : formatPercent(value, decimals) };
  }

  function cell(column: BreakdownColumnKey): { value: string; unit?: string; title?: string } {
    switch (column) {
      case "damage":
        return abbreviated(skill.damage);
      case "dps":
        return abbreviated(skill.dps);
      case "damagePercent":
        return { value: formatPercent(skill.damagePercent) };
      case "crit":
        return unlessSpecial(skill.critPercent, 0);
      case "critDamage":
        return unlessSpecial(skill.critDamagePercent, 0);
      case "frontAttack":
        return unlessSpecial(skill.frontAttackPercent, 0);
      case "backAttack":
        return unlessSpecial(skill.backAttackPercent, 0);
      case "supportBuff":
        return unlessSpecial(skill.supportBuffPercent);
      case "brand":
        return unlessSpecial(skill.brandPercent);
      case "identity":
        return unlessSpecial(skill.identityPercent);
      case "hat":
        // The T skill buffs hyper awakening damage too; the meter only blanks truly special skills here.
        return { value: skill.skill.special ? "-" : formatPercent(skill.hatPercent) };
      case "avgPerHit":
        return abbreviated(skill.avgPerHit);
      case "avgPerCast":
        return abbreviated(skill.avgPerCast);
      case "maxHit":
        return abbreviated(skill.maxHit);
      case "casts":
        return { value: String(skill.casts) };
      case "cpm":
        return { value: skill.castsPerMinute.toFixed(1) };
      case "hits":
        return { value: String(skill.hits) };
      case "hpm":
        return { value: skill.hitsPerMinute.toFixed(1) };
    }
  }
</script>

<tr class="relative isolate h-7 text-sm">
  <td class="max-w-0 pr-2 pl-1.5">
    <div class="flex items-center gap-1.5">
      <img
        class="size-5 shrink-0"
        src={skill.icon}
        alt=""
        onerror={(event) => {
          // Game data names icons the CDN doesn't have; show the placeholder, not a broken image.
          const img = event.currentTarget as HTMLImageElement;
          if (!img.src.endsWith(SKILL_ICON_PLACEHOLDER)) img.src = SKILL_ICON_PLACEHOLDER;
        }}
      />
      <span class="truncate" title={skill.name}>{skill.name}</span>
    </div>
  </td>

  {#each visibleColumns as column (column)}
    {@const c = cell(column)}
    <td class="tabular w-14 px-1 text-right whitespace-nowrap" title={c.title}>
      {c.value}{#if c.unit}<span class="text-xs opacity-70">{c.unit}</span>{/if}
    </td>
  {/each}

  <!-- Skill bar; must stay the last cell, for the reason given in PlayerRow.svelte. -->
  <td
    class="absolute left-0 -z-10 h-7 rounded-r-xs"
    style="background-color: rgb(from {settings.classColorBars
      ? color
      : '#525252'} r g b / 0.6); width: {width.current}%;"
  ></td>
</tr>
