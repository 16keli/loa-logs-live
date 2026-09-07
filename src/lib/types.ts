/**
 * Wire types for the live-sharing stream.
 *
 * These mirror `src/lib/types.ts` in the LOA Logs desktop app. The desktop app broadcasts its
 * `Encounter` verbatim with no schema negotiation, so this file is hand-maintained and must be kept
 * in sync whenever the meter's live snapshot changes shape. `LIVE_PROTOCOL_VERSION` in
 * `src/lib/protocol.ts` guards against silently rendering against an incompatible build.
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
  buffs: Record<number, StatusEffect>;
  debuffs: Record<number, StatusEffect>;
  totalShielding: number;
  totalEffectiveShielding: number;
  appliedShieldBuffs: Record<number, StatusEffect>;
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
  stagger: number;
  unbuffedDamage: number;
  unbuffedDps: number;
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
  backAttacks: number;
  frontAttacks: number;
  dps: number;
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
