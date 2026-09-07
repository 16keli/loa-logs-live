# LOA Logs Live

Web viewer for the LOA Logs live-sharing feature. Open `/<peer-id>` and follow someone's damage
meter in the browser.

## How it works

The LOA Logs desktop app hosts a [PeerJS](https://peerjs.com) peer and broadcasts meter state over
WebRTC. This page connects to that peer id and renders what it receives. There is no server holding
any of this data — the stream goes host → viewer directly, and this site only serves static files.

To share, a host enables **Experimental Features** in LOA Logs settings and presses the share button
in the live meter, which copies `https://live.lostark.bible/<peer-id>` to their clipboard.

## Protocol

All messages are `{ type, data }`, host → viewer only. The viewer never sends anything back.

| `type`          | `data`                       | Cadence      |
| --------------- | ---------------------------- | ------------ |
| `bossStatus`    | boss HP snapshot, or `null`  | ~5 Hz        |
| `encounterInfo` | full `Encounter`, or `null`  | 1 Hz         |
| `partyUpdate`   | `string[][]`, or `null`      | 1 Hz         |
| `meterStatus`   | `{ raidInProgress }`         | 1 Hz         |

`null` data means "cleared" — the encounter was reset or the host stopped sharing.

Unknown message types are logged and ignored, in both directions of version skew. That is what makes
it safe for the desktop app to add types without breaking already-deployed viewers.

### Coupling with the desktop app

The host sends its `Encounter` object **verbatim**, with no schema negotiation. `src/lib/types.ts`
here is a hand-maintained copy of the desktop app's `src/lib/types.ts`, and
`src/lib/constants.ts` copies its class colors and boss HP bar table.

**When the desktop app changes the shape of its live snapshot, both repos must be updated.** Bump
`LIVE_PROTOCOL_VERSION` in the desktop app's `src/lib/utils/live.svelte.ts` and in
`src/lib/protocol.ts` here; a mismatch shows the viewer a warning banner rather than silently
rendering wrong numbers.

The desktop app broadcasts no settings, so anything the meter derives from user preferences —
column choices, class colors, party splitting — is re-derived locally in `src/lib/viewer.svelte.ts`
and `src/lib/settings.svelte.ts`.

### Privacy

The full encounter includes player names, gear score, engravings, ark passive data and loadout
hashes. Anyone with the link sees all of it. The desktop app's "hide names" streamer setting does
**not** apply to the shared stream.

## Development

```sh
npm install
npm run dev
```

Then open `http://localhost:5173/<peer-id>` with a real peer id from a running LOA Logs instance.

```sh
npm run check    # svelte-check
npm run lint     # oxfmt --check
npm run format   # oxfmt --write
npm run build    # static build into ./build
```

## Deployment

Deployed to GitHub Pages as a **project page** — `https://<user>.github.io/<repo>/` — by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`.

Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. A
`package-lock.json` must be committed, since the workflow uses `npm ci`.

Three things are load-bearing for this particular host:

- **`fallback: "404.html"`** in `svelte.config.js`. GitHub Pages has no rewrite rules, so the 404
  page doubles as the SPA entry point — every `/<peer-id>` is served that file, which then routes
  client-side. It arrives with a 404 status, which is harmless here: nothing about a peer id is
  worth indexing.
- **`static/.nojekyll`**. Jekyll strips directories starting with an underscore, which is exactly
  SvelteKit's `_app/`. Without it the page loads and every script 404s. `adapter-static` does not
  create this file.
- **`paths.base`**, set from `BASE_PATH` by the workflow. A project page is not served from the
  root, so any root-absolute URL the app builds itself must be prefixed with `base` from
  `$app/paths` — see `classIcon()` in `src/lib/constants.ts` and the `goto()` in
  `src/routes/+page.svelte`. Assets referenced from `app.html` use `%sveltekit.assets%` and are
  already handled.

Moving to a custom domain later means clearing `BASE_PATH` (base becomes `""`, and the `base`
prefixes above turn into no-ops), and pointing DNS at GitHub. If that domain is on Cloudflare, the
record must be **DNS-only (grey cloud)** while GitHub provisions its certificate — a proxied record
blocks both issuance and, later and more quietly, renewal.
