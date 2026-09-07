// Emit a real index.html for the site root, so the landing page returns 200 rather than being
// served through the 404.html SPA fallback. With ssr = false this is just a client-boot shell.
export const prerender = true;
