<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";

  let input = $state("");

  /**
   * Accept a full share URL or a bare peer id, so people can paste whatever they were sent.
   *
   * The last path segment is the id in both shapes that matter: the desktop app's
   * `https://live.lostark.bible/<id>` and a project-page URL like
   * `https://<user>.github.io/<repo>/<id>` that someone copied out of their own address bar.
   */
  function peerIdFrom(value: string): string {
    const trimmed = value.trim();
    try {
      const url = new URL(trimmed);
      return url.pathname.split("/").filter(Boolean).pop() ?? "";
    } catch {
      return trimmed;
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const id = peerIdFrom(input);
    if (id) goto(`${base}/${id}`);
  }
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
  <div>
    <h1 class="text-xl font-semibold">LOA Logs Live</h1>
    <p class="mt-1 text-sm text-neutral-400">
      Follow someone's damage meter in your browser. Paste the link they shared with you.
    </p>
  </div>

  <form class="flex gap-2" onsubmit={submit}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-accent-500"
      placeholder="https://live.lostark.bible/…"
      autofocus
      bind:value={input}
    />
    <button
      class="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-40"
      disabled={!input.trim()}
    >
      Watch
    </button>
  </form>

  <p class="text-xs text-neutral-500">
    In LOA Logs, enable Experimental Features in settings, then press the share button in the live meter to copy your
    link.
  </p>
</main>
