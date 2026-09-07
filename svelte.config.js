import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Project pages are served from https://<user>.github.io/<repo>/, so every URL the app builds needs
// that prefix. The deploy workflow sets BASE_PATH; local dev leaves it empty and serves from root.
const base = process.env.BASE_PATH ?? "";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // GitHub Pages has no rewrite rules, so the 404 page doubles as the SPA entry point: any
    // unmatched path (i.e. every /<peer-id>) is served this file, which then routes client-side.
    adapter: adapter({ fallback: "404.html" }),
    paths: { base }
  }
};

export default config;
