/**
 * Wire types for the live-sharing stream.
 *
 * These mirror `src/lib/types.ts` in the LOA Logs desktop app. The desktop app broadcasts its
 * `Encounter` verbatim with no version negotiation, so this file is hand-maintained and must be
 * kept in sync whenever the meter's live snapshot changes shape. Render defensively: a field that
 * an older or newer host does not send arrives as `undefined`.
 *
 * Only the fields the viewer actually reads are typed precisely; the rest are kept for fidelity.
 */

export enum EntityType {
  UNKNOWN = "UNKNOWN",
  MONSTER = "MONSTER",
  BOSS = "BOSS",
  GUARDIAN = "GUARDIAN",
  PLAYER = "PLAYER",
  NPC = "NPC",
  ESTHER = "ESTHER",
  DARK_GRENADE = "DARK_GRENADE"
}

export interface Encounter {
  lastCombatPacket: number;
  fightStart: number;
  localPlayer: string;
  entities: Record<string, Entity>;
  currentBossName: string;
  currentBoss: Entity | null;
  encounterDamageStats: EncounterDamageStats;
  duration: number;
  difficulty?: string;
  favorite: boolean;
  cleared: boolean;
  bossOnlyDamage: boolean;
  region?: string;
}

export interface EncounterDamageStats {
  totalDamageDealt: number;
  topDamageDealt: number;
  totalDamageTaken: number;
  topDamageTaken: number;
  dps: number;
  totalShielding: number;
  totalEffectiveShielding: number;

  /**
   * Encounter-wide status effect lookups.
   *
   * The host sends these only on a viewer's first frame of a fight — they are roughly a third of
   * the payload and barely change — and `null` thereafter. `LiveConnection` splices the last known
   * copy back in, so by the time this reaches the UI they are populated again.
   */
  buffs: Record<number, StatusEffect> | null;
  debuffs: Record<number, StatusEffect> | null;
  appliedShieldBuffs: Record<number, StatusEffect> | null;
  misc?: EncounterMisc;
}

export interface EncounterMisc {
  /** False when the host couldn't attribute raid contributions reliably; rDPS columns stay hidden. */
  rdpsValid?: boolean;
}

export interface Entity {
  lastUpdate: number;
  id: number;
  npcId: number;
  hpBars?: number;
  name: string;
  characterId: string;
  entityType: EntityType;
  classId: number;
  class: string;
  gearScore: number;
  currentHp: number;
  maxHp: number;
  currentShield: number;
  isDead: boolean;
  skills: Record<number, Skill>;
  damageStats: DamageStats;
  skillStats: SkillStats;
  engravingData?: Array<string>;
  arkPassiveActive?: boolean;
  spec?: string;
  loadoutHash?: string;
  combatPower?: number;
}

export interface DamageStats {
  damageDealt: number;
  damageTaken: number;
  hyperAwakeningDamage?: number;
  buffedBy: Record<number, number>;
  debuffedBy: Record<number, number>;
  buffedBySupport: number;
  buffedByIdentity: number;
  buffedByHat?: number;
  debuffedBySupport: number;
  backAttackDamage: number;
  frontAttackDamage: number;
  critDamage: number;
  shieldsGiven: number;
  shieldsReceived: number;
  damageAbsorbed: number;
  damageAbsorbedOnOthers: number;
  deaths: number;
  deathTime: number;
  dps: number;
  rdpsDamageReceived: number;
  rdpsDamageReceivedSupport: number;
  rdpsDamageGiven: number;
  incapacitations?: IncapacitatedEvent[];
  stagger: number;
  unbuffedDamage: number;
  unbuffedDps: number;
}

export interface IncapacitatedEvent {
  type: "FALL_DOWN" | "CROWD_CONTROL";
  timestamp: number;
  duration: number;
}

export interface SkillStats {
  casts: number;
  hits: number;
  crits: number;
  backAttacks: number;
  frontAttacks: number;
  counters: number;
}

export interface Skill {
  id: number;
  name: string;
  icon: string;
  totalDamage: number;
  maxDamage: number;
  casts: number;
  hits: number;
  crits: number;
  critDamage: number;
  backAttacks: number;
  frontAttacks: number;
  backAttackDamage: number;
  frontAttackDamage: number;
  buffedBySupport: number;
  debuffedBySupport: number;
  buffedByIdentity: number;
  buffedByHat?: number;
  dps: number;
  stagger?: number;
  /** Set on skills that buffs and crits cannot modify; absent otherwise. */
  special?: boolean;
  isHyperAwakening?: boolean;
  /** Milliseconds the skill was off cooldown, when the host tracks it. */
  timeAvailable?: number;
  /** Buff damage received, by contribution type, then by source. */
  rdpsReceived?: Record<number, Record<number, number>>;
  /** Buff damage this skill gave others, by contribution type. */
  rdpsContributed?: Record<number, number>;
  rdpsDamageReceived?: number;
}

export interface StatusEffect {
  target: string;
  category: string;
  buffCategory: string;
  buffType: number;
  uniqueGroup: number;
  source: StatusEffectSource;
}

export interface StatusEffectSource {
  name: string;
  desc: string;
  icon: string;
  skill?: unknown;
  setName?: string;
}
