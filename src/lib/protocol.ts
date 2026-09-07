import type { Encounter } from "./types";

/**
 * Must match `LIVE_PROTOCOL_VERSION` in the desktop app's `src/lib/utils/live.svelte.ts`.
 *
 * The host sends its `Encounter` verbatim, so a desktop build that changed the snapshot shape would
 * otherwise render as silently wrong numbers rather than an obvious error.
 */
export const LIVE_PROTOCOL_VERSION = 1;

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

export type LiveMessage =
  | { type: "bossStatus"; data: BossStatus | null }
  | { type: "encounterInfo"; protocol?: number; data: Encounter | null }
  | { type: "partyUpdate"; data: string[][] | null }
  | { type: "meterStatus"; data: MeterStatus };

/**
 * Narrow an arbitrary DataConnection payload to a message we understand.
 *
 * Unknown types are not an error: older and newer hosts are expected to send things this viewer
 * does not handle, and the deployed viewer has always just logged them.
 */
export function asLiveMessage(raw: unknown): LiveMessage | null {
  if (typeof raw !== "object" || raw === null) return null;

  const { type } = raw as { type?: unknown };
  if (type === "bossStatus" || type === "encounterInfo" || type === "partyUpdate" || type === "meterStatus") {
    return raw as LiveMessage;
  }

  return null;
}
