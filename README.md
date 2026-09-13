# LOA Logs Live

Web viewer for the LOA Logs live-sharing feature. Open `/<peer-id>` and follow someone's damage
meter in the browser.

## How it works

The LOA Logs desktop app hosts a [PeerJS](https://peerjs.com) peer and broadcasts meter state over
WebRTC. This page connects to that peer id and renders what it receives. There is no server holding
any of this data — the stream goes host → viewer directly, and this site only serves static files.

To share, a host enables **Experimental Features** in LOA Logs settings and presses the share button
in the live meter, which copies `https://live.lostark.bible/<peer-id>` to their clipboard.

### Relay (TURN)

A direct connection is impossible for some viewers: carrier-grade NAT on mobile data and hotspots,
school and office firewalls, some VPNs. Those viewers connect through a Cloudflare TURN relay, which
forwards the stream without being able to read it (WebRTC data is end-to-end encrypted). PeerJS's
built-in relays no longer exist, so this is required, not optional.

Relay credentials are short-lived and come from the Worker in [`turn-credentials/`](turn-credentials),
which keeps the Cloudflare API token off the static site. Setup:

1. In the Cloudflare dashboard, go to **Realtime → TURN Server** and create a TURN key. Note its
   **Key ID** and **API token**.
2. From `turn-credentials/`, run `npx wrangler secret put TURN_KEY_ID`, then
   `npx wrangler secret put TURN_KEY_API_TOKEN`, then `npx wrangler deploy`. Check that
   `ALLOWED_ORIGINS` in `wrangler.toml` lists the origin the viewer is served from.
3. In this repository's **Settings → Secrets and variables → Actions → Variables**, add
   `TURN_CREDENTIALS_URL` set to the deployed Worker URL, then redeploy.

Without that variable the viewer still works, but only for viewers who can connect directly. For local
development, put `VITE_TURN_CREDENTIALS_URL=<worker url>` in `.env.local`.

## Protocol

All messages are `{ type, data }`, host → viewer only. The viewer never sends anything back.

| `type`          | `data`                              | Cadence      |
| --------------- | ----------------------------------- | ------------ |
| `bossStatus`    | boss HP snapshot, or `null`         | ~5 Hz        |
| `encounterInfo` | gzipped JSON `Encounter`, or `null` | 1 Hz         |
| `partyUpdate`   | `string[][]`, or `null`             | 1 Hz         |
| `meterStatus`   | `{ raidInProgress }`                | 1 Hz         |

`null` data means "cleared" — the encounter was reset or the host stopped sharing.

Unknown message types are logged and ignored, in both directions of version skew. That is what makes
it safe for the desktop app to add types without breaking already-deployed viewers.

### Encounter frames are compressed

`encounterInfo` carries gzipped JSON rather than the object itself, and binarypack delivers it as an
`ArrayBuffer`. Measured on real raid logs this is **66–82% smaller** — a trimmed frame drops from
~250 KB to ~77 KB, and from 22 wire chunks to about 5.

The bigger reason is CPU on the host. Letting binarypack serialize the object costs 20–70 ms **per
connection**, where `JSON.stringify` costs 1–3 ms and gzip a few more — once, shared by every
viewer. Handing peerjs an opaque byte array leaves it nothing to walk, so additional viewers are
nearly free.

### Buff registries are sent once per fight

`encounterDamageStats.buffs`, `debuffs` and `appliedShieldBuffs` are encounter-wide lookup tables
carrying a full localized description per status effect. Measured against real raid logs they are
roughly a **third of every frame** (110–250 KB of a 270–700 KB payload), and they barely change once
a fight is underway.

So the host sends them on a given viewer's **first frame of each fight** and `null` thereafter.
`LiveConnection` caches the last copy and splices it back in, so everything downstream sees them as
always present. A viewer that connects mid-fight is treated as new and gets a full frame.

### Coupling with the desktop app

The host sends its `Encounter` object **verbatim**, with no version negotiation — there is
deliberately no protocol version on the wire. `src/lib/types.ts` here is a hand-maintained copy of
the desktop app's `src/lib/types.ts`, and `src/lib/constants.ts` copies its class colors and boss HP
bar table.

**When the desktop app changes the shape of its live snapshot, both repos must be updated.** Since
nothing signals a mismatch, render defensively: treat every field as possibly absent rather than
assuming the host is the build this viewer was written against.

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
