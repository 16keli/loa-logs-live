<script lang="ts">
  import "@fontsource-variable/inter";
  import "@fontsource-variable/geist-mono";
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>LOA Logs Live</title>
  <meta name="description" content="Follow a LOA Logs damage meter live in your browser." />
</svelte:head>

{@render children()}
