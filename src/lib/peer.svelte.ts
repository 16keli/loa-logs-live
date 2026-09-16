import { ungzip } from "pako";
import { type DataConnection, Peer } from "peerjs";

import { getIceServers } from "./ice";
import { asLiveMessage, type EncounterFrame } from "./protocol";
import type { Encounter, EncounterDamageStats } from "./types";
import type { ViewerState } from "./viewer.svelte";

type BuffRegistries = Pick<EncounterDamageStats, "buffs" | "debuffs" | "appliedShieldBuffs">;

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

/** Backoff between attempts, in milliseconds; the last value repeats for as long as it takes. */
const RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000];

/**
 * How long the connection may sit in WebRTC "disconnected" before it counts as lost.
 *
 * A brief drop (a wifi blip, a changed route) usually recovers by itself, and tearing the peer down
 * during one would replace a connection that was about to come back.
 */
const DISCONNECTED_GRACE_MS = 6_000;

/**
 * How long one attempt may take before it is abandoned and retried.
 *
 * An attempt can stall with nothing to react to: PeerJS reports an absent host only on the first
 * try, and a signalling socket or an ICE negotiation can hang without ever failing. Without this,
 * such an attempt would wait forever and the viewer would never come back.
 */
const ATTEMPT_TIMEOUT_MS = 12_000;

/**
 * Connects to a LOA Logs host and feeds its messages into a `ViewerState`.
 *
 * The lifecycle mirrors what the desktop app expects: one `Peer`, one `DataConnection` to the
 * host's peer id, and no messages sent back. Unknown message types are logged and ignored, since
 * the host may be a newer build than this viewer.
 *
 * Viewers leave the page open for a whole raid, across host restarts, sleeping laptops and wifi
 * drops, so every failure is retried with backoff until it connects again or the page goes away.
 * The last frame stays on screen meanwhile.
 */
export class LiveConnection {
  status = $state<ConnectionStatus>("connecting");
  error = $state<string | null>(null);

  /** Wall-clock time of the last frame, so the UI can show a stale-stream warning. */
  lastMessageAt = $state<number | null>(null);

  /** Failed attempts since this connection was last up; 0 while connected. */
  attempts = $state(0);

  #peer: Peer | null = null;
  #conn: DataConnection | null = null;
  /** Last registries the host sent, replayed onto the trimmed frames that follow. */
  #registries: BuffRegistries | null = null;
  #viewer: ViewerState;
  #peerId = "";
  /** Bumped by every teardown, so callbacks from a superseded attempt can tell that they are stale. */
  #generation = 0;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #graceTimer: ReturnType<typeof setTimeout> | undefined;
  #attemptTimer: ReturnType<typeof setTimeout> | undefined;
  /** Removes the "machine is awake again" listeners; set while they are installed. */
  #stopWakeListeners: (() => void) | undefined;

  constructor(viewer: ViewerState) {
    this.#viewer = viewer;
  }

  /** Connect, or reconnect to the same host when called with no id. A manual call starts over. */
  connect(peerId: string = this.#peerId) {
    this.attempts = 0;
    this.#start(peerId, "connecting");
  }

  #start(peerId: string, status: ConnectionStatus) {
    this.#teardown();

    this.#peerId = peerId;
    this.status = status;
    if (status === "connecting") this.error = null;
    this.#listenForWake();

    const generation = this.#generation;
    this.#attemptTimer = setTimeout(() => {
      if (generation === this.#generation) this.#lost("Connecting timed out");
    }, ATTEMPT_TIMEOUT_MS);

    void getIceServers().then((iceServers) => {
      // A reconnect or teardown happened while the relay credentials were loading.
      if (generation !== this.#generation) return;

      const peer = new Peer({ config: { iceServers } });
      this.#peer = peer;

      peer.on("error", (e) => {
        if (this.#peer !== peer) return;
        // Every PeerJS error ends the attempt. The fatal ones cannot be retried on this peer, and
        // the transient ones (the host id not registered yet, a signalling hiccup) are retried below.
        this.#lost(e.message || "Signalling server error");
      });

      // The signalling socket dropped. The peer keeps any open connection, but it can no longer make
      // new ones, so without this a later reconnect would never reach the host.
      peer.on("disconnected", () => {
        if (this.#peer !== peer || peer.destroyed) return;
        this.#lost("Lost the connection to the signalling server");
      });

      // The peer may not have an id yet on a fresh page load.
      if (peer.id) this.#open(peer);
      else peer.once("open", () => this.#open(peer));
    });
  }

  #open(peer: Peer) {
    // A reconnect may have replaced this peer while we waited for its id.
    if (this.#peer !== peer) return;

    const conn = peer.connect(this.#peerId);
    this.#conn = conn;

    conn.on("open", () => {
      if (this.#conn !== conn) return;
      this.status = "connected";
      this.error = null;
      this.attempts = 0;
      clearTimeout(this.#attemptTimer);
      // A new connection is sent the whole encounter, registries included.
      this.#registries = null;
      this.#watchConnectionState(conn);
    });

    conn.on("data", (raw) => {
      if (this.#conn !== conn) return;
      this.#handle(raw);
    });

    conn.on("close", () => {
      if (this.#conn !== conn) return;
      this.#lost("The host closed the connection");
    });

    conn.on("error", (e) => {
      if (this.#conn !== conn) return;
      this.#lost(e.message || "Connection error");
    });
  }

  /**
   * Watch the underlying WebRTC connection.
   *
   * A data channel can stop delivering without PeerJS reporting anything — the host sleeps, a VPN
   * comes up, the route changes — leaving the viewer on a frozen meter. The connection state catches
   * that; silence cannot, because a host with nothing new to send is silent by design.
   */
  #watchConnectionState(conn: DataConnection) {
    const pc = conn.peerConnection;
    if (!pc) return;

    pc.addEventListener("connectionstatechange", () => {
      if (this.#conn !== conn) return;

      switch (pc.connectionState) {
        case "failed":
          this.#lost("The connection failed");
          break;
        case "closed":
          this.#lost("The connection closed");
          break;
        case "disconnected":
          // Give it a moment to recover on its own before replacing it.
          clearTimeout(this.#graceTimer);
          this.#graceTimer = setTimeout(() => {
            if (this.#conn === conn && pc.connectionState === "disconnected") this.#lost("The connection dropped");
          }, DISCONNECTED_GRACE_MS);
          break;
        case "connected":
          clearTimeout(this.#graceTimer);
          this.status = "connected";
          break;
      }
    });
  }

  /** This attempt is over: tear it down and schedule the next one. */
  #lost(message: string) {
    console.warn("live:", message);
    this.error = message;
    this.status = "reconnecting";
    this.attempts++;
    this.#teardown();

    const delay = RETRY_DELAYS[Math.min(this.attempts - 1, RETRY_DELAYS.length - 1)];
    // Jitter, so viewers who dropped together (the host restarted) do not all return at once.
    this.#retryTimer = setTimeout(() => this.#start(this.#peerId, "reconnecting"), delay * (0.8 + Math.random() * 0.4));
  }

  /** Retry at once when the machine is back: waiting out the backoff after a sleep is a long stall. */
  #listenForWake() {
    if (this.#stopWakeListeners || typeof window === "undefined") return;

    const wake = () => {
      if (this.status !== "reconnecting" || !navigator.onLine || document.visibilityState === "hidden") return;
      clearTimeout(this.#retryTimer);
      this.#start(this.#peerId, "reconnecting");
    };

    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    this.#stopWakeListeners = () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }

  #handle(raw: unknown) {
    this.lastMessageAt = Date.now();

    const message = asLiveMessage(raw);
    if (!message) {
      // Expected when the host is a newer build. Not an error.
      console.warn("live: ignoring unknown message", raw);
      return;
    }

    switch (message.type) {
      case "encounterInfo": {
        if (message.data === null) {
          this.#viewer.encounter = null;
          this.#registries = null;
          break;
        }
        // A frame that fails to decode is skipped, not treated as a clear.
        const encounter = this.#decodeFrame(message.data);
        if (encounter) this.#viewer.encounter = this.#withRegistries(encounter);
        break;
      }
      case "bossStatus":
        this.#viewer.bossStatus = message.data;
        break;
      case "partyUpdate":
        this.#viewer.partyInfo = message.data;
        break;
      case "meterStatus":
        this.#viewer.meterStatus = message.data;
        break;
      case "viewerCount":
        this.#viewer.viewerCount = typeof message.data === "number" ? message.data : null;
        break;
    }
  }

  /** Inflate a gzipped JSON frame. Binarypack delivers the bytes as an ArrayBuffer. */
  #decodeFrame(data: Exclude<EncounterFrame, null>): Encounter | null {
    try {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      return JSON.parse(ungzip(bytes, { to: "string" })) as Encounter;
    } catch (e) {
      console.error("live: could not decode encounter frame", e);
      return null;
    }
  }

  /**
   * Put the buff registries back on a trimmed frame.
   *
   * The host sends them only on this connection's first frame of a fight and `null` afterwards, so
   * everything downstream can treat them as always present.
   */
  #withRegistries(encounter: Encounter): Encounter {
    const stats = encounter.encounterDamageStats;

    if (stats.buffs) {
      const { buffs, debuffs, appliedShieldBuffs } = stats;
      this.#registries = { buffs, debuffs, appliedShieldBuffs };
      return encounter;
    }

    // Nothing cached yet means we joined before the host sent them; leave the frame as it came.
    if (!this.#registries) return encounter;

    return { ...encounter, encounterDamageStats: { ...stats, ...this.#registries } };
  }

  /** Drop the peer and its connection, without touching the retry schedule or the UI state. */
  #teardown() {
    this.#generation++;
    clearTimeout(this.#retryTimer);
    clearTimeout(this.#graceTimer);
    clearTimeout(this.#attemptTimer);
    const conn = this.#conn;
    const peer = this.#peer;
    this.#conn = null;
    this.#peer = null;
    conn?.close();
    peer?.destroy();
  }

  /** Stop for good: the page is leaving, or switching to another host. */
  destroy() {
    this.#teardown();
    this.#stopWakeListeners?.();
    this.#stopWakeListeners = undefined;
  }
}
