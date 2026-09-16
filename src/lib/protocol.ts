/** Boss HP, broadcast at ~5 Hz. Predates the full-encounter stream; shape is fixed. */
export interface BossStatus {
  name: string;
  isDead: boolean;
  currentHp: number;
  maxHp: number;
  currentShield: number;
  totalBars: number;
  currentBars: number;
}

export interface MeterStatus {
  raidInProgress: boolean;
}

/**
 * An encounter frame: gzipped JSON of an `Encounter`, or `null` when the host clears it.
 *
 * The host compresses because it is both smaller and cheaper than letting binarypack walk the
 * object — see `compressFrame` in the desktop app's `src/lib/utils/live.svelte.ts`. Binarypack
 * hands the bytes back as an `ArrayBuffer`.
 */
export type EncounterFrame = ArrayBuffer | Uint8Array | null;

export type LiveMessage =
  | { type: "bossStatus"; data: BossStatus | null }
  | { type: "encounterInfo"; data: EncounterFrame }
  | { type: "partyUpdate"; data: string[][] | null }
  | { type: "meterStatus"; data: MeterStatus }
  /** How many viewers the host currently has, sent as they come and go. */
  | { type: "viewerCount"; data: number };

/**
 * Narrow an arbitrary DataConnection payload to a message we understand.
 *
 * Unknown types are not an error: older and newer hosts are expected to send things this viewer
 * does not handle, and the deployed viewer has always just logged them.
 */
export function asLiveMessage(raw: unknown): LiveMessage | null {
  if (typeof raw !== "object" || raw === null) return null;

  const { type } = raw as { type?: unknown };
  if (
    type === "bossStatus" ||
    type === "encounterInfo" ||
    type === "partyUpdate" ||
    type === "meterStatus" ||
    type === "viewerCount"
  ) {
    return raw as LiveMessage;
  }

  return null;
}
