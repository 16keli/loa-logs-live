/**
 * Hands short-lived Cloudflare TURN credentials to the LOA Logs Live viewer.
 *
 * Viewers on networks that block direct WebRTC (carrier-grade NAT, school and office firewalls, some
 * VPNs) can only reach a host through a relay. PeerJS's built-in relays no longer exist, so the viewer
 * asks this Worker for Cloudflare TURN servers instead. The API token has to stay server-side, which
 * is the only reason this Worker exists; the viewer itself is a static site.
 *
 * Secrets (set with `npx wrangler secret put <NAME>`): TURN_KEY_ID, TURN_KEY_API_TOKEN.
 * Vars (wrangler.toml): ALLOWED_ORIGINS, a comma-separated list of origins allowed to fetch credentials.
 */

const CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys";

/**
 * How long a credential stays valid. A relayed connection stops working once its credential expires,
 * so this has to outlast a long raid night rather than a single pull.
 */
const TTL_SECONDS = 12 * 60 * 60;

export default {
  /**
   * @param {Request} request
   * @param {{ TURN_KEY_ID?: string, TURN_KEY_API_TOKEN?: string, ALLOWED_ORIGINS?: string }} env
   */
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get("Origin"), env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, origin, { Allow: "GET, OPTIONS" });
    }
    // Browsers always send Origin on cross-origin fetches. This keeps other sites from using the
    // relay quota, but it is not authentication: a non-browser client can send any Origin it likes.
    if (!origin) {
      return json({ error: "Origin not allowed" }, 403, null);
    }
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
      console.error("TURN_KEY_ID or TURN_KEY_API_TOKEN secret is not set");
      return json({ error: "TURN is not configured" }, 500, origin);
    }

    const upstream = await fetch(`${CLOUDFLARE_TURN_API}/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: TTL_SECONDS })
    });
    if (!upstream.ok) {
      console.error(`Cloudflare TURN API returned ${upstream.status}: ${await upstream.text()}`);
      return json({ error: "Could not generate TURN credentials" }, 502, origin);
    }

    const { iceServers } = /** @type {{ iceServers: RTCIceServer[] }} */ (await upstream.json());
    return json({ iceServers: withoutPort53(iceServers), ttl: TTL_SECONDS }, 200, origin, {
      "Cache-Control": "no-store"
    });
  }
};

/**
 * The request's Origin if it is on the allowlist, otherwise null.
 *
 * @param {string | null} origin
 * @param {string | undefined} allowList
 */
export function allowedOrigin(origin, allowList) {
  if (!origin) return null;
  const allowed = (allowList ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

/**
 * Cloudflare also offers TURN on port 53, which browsers block; without trickle ICE those URLs just
 * time out and delay the connection. See https://developers.cloudflare.com/realtime/turn/generate-credentials/
 *
 * @param {RTCIceServer[]} iceServers
 * @returns {RTCIceServer[]}
 */
export function withoutPort53(iceServers) {
  return iceServers
    .map((server) => {
      const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url) => !/:53(\?|$)/.test(url));
      return { ...server, urls };
    })
    .filter((server) => server.urls.length > 0);
}

/** @param {string | null} origin */
function corsHeaders(origin) {
  /** @type {Record<string, string>} */
  const headers = { Vary: "Origin" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string | null} origin
 * @param {Record<string, string>} [extraHeaders]
 */
function json(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin), ...extraHeaders }
  });
}
