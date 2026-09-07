import { type DataConnection, Peer } from "peerjs";

import { asLiveMessage, LIVE_PROTOCOL_VERSION } from "./protocol";
import type { ViewerState } from "./viewer.svelte";

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
  #viewer: ViewerState;
  #peerId = "";

  constructor(viewer: ViewerState) {
    this.#viewer = viewer;
  }

  /** Connect, or reconnect to the same host when called with no id. */
  connect(peerId: string = this.#peerId) {
    this.destroy();

    this.#peerId = peerId;
    this.status = "connecting";
    this.error = null;

    const peer = new Peer();
    this.#peer = peer;

    peer.on("error", (e) => this.#fail(e.message || "Signalling server error"));

    // The peer may not have an id yet on a fresh page load.
    if (peer.id) this.#open(peer);
    else peer.once("open", () => this.#open(peer));
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
        const protocol = message.protocol ?? LIVE_PROTOCOL_VERSION;
        this.#viewer.protocolMismatch = protocol === LIVE_PROTOCOL_VERSION ? null : protocol;
        this.#viewer.encounter = message.data;
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

  #fail(message: string) {
    console.error("live:", message);
    this.status = "error";
    this.error = message;
  }

  destroy() {
    this.#conn?.close();
    this.#conn = null;
    this.#peer?.destroy();
    this.#peer = null;
  }
}
