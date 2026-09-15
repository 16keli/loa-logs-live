<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A hover tooltip styled after the meter's QuickTooltip.
   *
   * The popup is moved to <body> while open: rows are stacking contexts and slide with a transform
   * when they reorder, either of which would clip or misplace a popup left inside the table. The
   * pointer can move onto the popup (for its links) without it closing.
   */
  let {
    tooltip,
    delay = 0,
    class: className = "",
    children
  }: {
    /** Text (newlines start new lines) or a snippet; nothing shows when empty. */
    tooltip: string | Snippet | null | undefined;
    delay?: number;
    class?: string;
    children: Snippet;
  } = $props();

  let trigger = $state<HTMLElement>();
  let open = $state(false);
  let position = $state({ left: 0, top: 0, above: true });
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function show() {
    clearTimeout(closeTimer);
    if (open || !tooltip) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const above = rect.top > window.innerHeight / 2;
      position = { left: rect.left + rect.width / 2, top: above ? rect.top : rect.bottom, above };
      open = true;
    }, delay);
  }

  function hide() {
    clearTimeout(openTimer);
    // A short grace period lets the pointer cross the gap onto the popup.
    closeTimer = setTimeout(() => (open = false), 80);
  }

  /** Mount the node on <body>, then nudge it back inside the viewport. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    const rect = node.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - 8);
    if (overflowRight > 0) node.style.marginLeft = `${-overflowRight}px`;
    else if (rect.left < 8) node.style.marginLeft = `${8 - rect.left}px`;
    return { destroy: () => node.remove() };
  }

  $effect(() => () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });
</script>

{#if tooltip}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={trigger}
    class={className}
    onpointerenter={show}
    onpointerleave={hide}
    onfocusin={show}
    onfocusout={hide}
  >
    {@render children()}
  </div>
{:else}
  {@render children()}
{/if}

{#if open && tooltip}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:portal
    role="tooltip"
    class="fixed z-50 max-w-80 -translate-x-1/2 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-left text-sm font-normal whitespace-pre-line text-neutral-100 shadow-xl"
    class:-translate-y-full={position.above}
    style:left="{position.left}px"
    style:top="{position.above ? position.top - 6 : position.top + 6}px"
    onpointerenter={show}
    onpointerleave={hide}
  >
    {#if typeof tooltip === "string"}
      {tooltip}
    {:else}
      {@render tooltip()}
    {/if}
  </div>
{/if}
