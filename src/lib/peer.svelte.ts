import { ungzip } from "pako";
import { type DataConnection, Peer } from "peerjs";

import { getIceServers } from "./ice";
import { asLiveMessage, type EncounterFrame } from "./protocol";
import type { Encounter, EncounterDamageStats } from "./types";
import type { ViewerState } from "./viewer.svelte";

type BuffRegistries = Pick<EncounterDamageStats, "buffs" | "debuffs" | "appliedShieldBuffs">;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Connects to a LOA Logs host and feeds its messages into a `ViewerState`.
 *
 * The lifecycle mirrors what the desktop app expects: one `Peer`, one `DataConnection` to the
 * host's peer id, and no messages sent back. Unknown message types are logged and ignored, since
 * the host may be a newer build than this viewer.
 */
export class LiveConnection {
  status = $state<ConnectionStatus>("connecting");
  error = $state<string | null>(null);

  /** Wall-clock time of the last frame, so the UI can show a stale-stream warning. */
  lastMessageAt = $state<number | null>(null);

  #peer: Peer | null = null;
  #conn: DataConnection | null = null;
  /** Last registries the host sent, replayed onto the trimmed frames that follow. */
  #registries: BuffRegistries | null = null;
  #viewer: ViewerState;
  #peerId = "";
  /** Bumped by every teardown, so a connect still waiting on ICE servers knows it was superseded. */
  #attempt = 0;

  constructor(viewer: ViewerState) {
    this.#viewer = viewer;
  }

  /** Connect, or reconnect to the same host when called with no id. */
  connect(peerId: string = this.#peerId) {
    this.destroy();

    this.#peerId = peerId;
    this.status = "connecting";
    this.error = null;

    const attempt = this.#attempt;
    void getIceServers().then((iceServers) => {
      // A reconnect or teardown happened while the relay credentials were loading.
      if (attempt !== this.#attempt) return;

      const peer = new Peer({ config: { iceServers } });
      this.#peer = peer;

      peer.on("error", (e) => this.#fail(e.message || "Signalling server error"));

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
    });

    conn.on("data", (raw) => {
      if (this.#conn !== conn) return;
      this.#handle(raw);
    });

    conn.on("close", () => {
      if (this.#conn !== conn) return;
      this.status = "disconnected";
    });

    conn.on("error", (e) => this.#fail(e.message || "Connection error"));
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

  #fail(message: string) {
    console.error("live:", message);
    this.status = "error";
    this.error = message;
  }

  destroy() {
    this.#attempt++;
    this.#conn?.close();
    this.#conn = null;
    this.#peer?.destroy();
    this.#peer = null;
  }
}
