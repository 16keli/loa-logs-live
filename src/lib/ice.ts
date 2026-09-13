/**
 * ICE servers for the viewer's WebRTC connection.
 *
 * Direct connections fail on carrier-grade NAT, school and office firewalls, and some VPNs; those
 * viewers can only reach a host through a TURN relay. PeerJS's defaults still name its own relays,
 * which no longer exist, so the viewer supplies servers itself: Cloudflare TURN credentials from the
 * Worker in `turn-credentials/`, whose URL is set at build time.
 */

const CREDENTIALS_URL: string | undefined = import.meta.env.VITE_TURN_CREDENTIALS_URL || undefined;

/** Don't hold up connecting for long; most viewers never need the relay. */
const FETCH_TIMEOUT_MS = 5_000;

/** Credentials last 12 hours; reusing them for an hour saves a Worker call on every reconnect. */
const REUSE_FOR_MS = 60 * 60 * 1000;

/** Without a relay, STUN alone still lets most viewers connect directly. */
const STUN_ONLY: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

let cached: { servers: RTCIceServer[]; fetchedAt: number } | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!CREDENTIALS_URL) return STUN_ONLY;
  if (cached && Date.now() - cached.fetchedAt < REUSE_FOR_MS) return cached.servers;

  try {
    const response = await fetch(CREDENTIALS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { iceServers } = (await response.json()) as { iceServers?: RTCIceServer[] };
    if (!Array.isArray(iceServers) || iceServers.length === 0) throw new Error("response had no iceServers");

    cached = { servers: iceServers, fetchedAt: Date.now() };
    return iceServers;
  } catch (e) {
    // A relay outage shouldn't lock out the viewers who can connect directly.
    console.warn("live: could not get TURN credentials; connecting without a relay", e);
    return STUN_ONLY;
  }
}
