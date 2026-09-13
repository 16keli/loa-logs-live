import { arcanistCardIds, classColor, hyperAwakeningIds, skillIcon } from "./constants";
import { isNameValid, percent } from "./format";
import type { BossStatus, MeterStatus } from "./protocol";
import { type Encounter, type Entity, EntityType, type Skill } from "./types";

/**
 * The viewer's derived view of the stream.
 *
 * The host broadcasts raw encounter state once a second and sends no settings, so everything the
 * meter derives locally has to be re-derived here. Row values are plain getters rather than
 * `$derived` fields because the rows are rebuilt inside a derived on every frame; reading `$state`
 * through a getter during render tracks it just the same, without creating throwaway signals.
 */
export class ViewerState {
  // `$state.raw` throughout: every frame replaces these wholesale and nothing mutates them in
  // place, so there is no reason to pay for deep proxying of a several-hundred-KB encounter.
  encounter = $state.raw<Encounter | null>(null);
  bossStatus = $state.raw<BossStatus | null>(null);
  partyInfo = $state.raw<string[][] | null>(null);
  meterStatus = $state.raw<MeterStatus>({ raidInProgress: false });

  /** Local wall clock, advanced once a second so the duration ticks between frames. */
  now = $state(Date.now());

  fightStart = $derived(this.encounter?.fightStart ?? 0);

  /**
   * A live fight measures against the wall clock; a finished one freezes at the last combat packet,
   * otherwise the timer would keep running after the boss dies.
   */
  duration = $derived.by(() => {
    if (!this.encounter || !this.fightStart) return 0;
    const end = this.meterStatus.raidInProgress ? this.now : this.encounter.lastCombatPacket;
    return Math.max(0, end - this.fightStart);
  });

  durationSeconds = $derived(this.duration / 1000);

  totalDamageDealt = $derived(this.encounter?.encounterDamageStats.totalDamageDealt ?? 0);

  dps = $derived(this.durationSeconds > 0 ? this.totalDamageDealt / this.durationSeconds : 0);

  /**
   * Players, damage descending.
   *
   * The Rust snapshot already drops unconfirmed entities and anything with no damage, but the
   * filter is repeated because the viewer cannot assume which host version it is talking to.
   */
  playerEntities = $derived.by(() => {
    if (!this.encounter) return [] as Entity[];

    return Object.values(this.encounter.entities)
      .filter((e) => e.entityType === EntityType.PLAYER && e.damageStats.damageDealt > 0)
      .sort((a, b) => b.damageStats.damageDealt - a.damageStats.damageDealt);
  });

  topDamage = $derived(this.playerEntities[0]?.damageStats.damageDealt ?? 0);

  players = $derived(this.playerEntities.map((entity) => new PlayerRow(entity, this)));

  /** Which optional columns have any data at all, so empty ones can stay hidden. */
  aggregates = $derived.by(() => {
    const entities = this.playerEntities;
    return {
      crit: entities.some((e) => e.skillStats.hits > 0),
      frontAttack: entities.some((e) => e.damageStats.frontAttackDamage > 0),
      backAttack: entities.some((e) => e.damageStats.backAttackDamage > 0),
      supportBuff: entities.some((e) => e.damageStats.buffedBySupport > 0),
      brand: entities.some((e) => e.damageStats.debuffedBySupport > 0),
      identity: entities.some((e) => e.damageStats.buffedByIdentity > 0),
      hat: entities.some((e) => (e.damageStats.buffedByHat ?? 0) > 0),
      deaths: entities.some((e) => e.damageStats.deaths > 0),
      counters: entities.some((e) => e.skillStats.counters > 0)
    };
  });

  boss = $derived(this.encounter?.currentBoss ?? null);

  /** Party index by player name, for the party-split view. */
  partyByName = $derived.by(() => {
    const map = new Map<string, number>();
    this.partyInfo?.forEach((party, index) => {
      for (const name of party) map.set(name, index);
    });
    return map;
  });

  /** Players grouped into parties, or a single flat group when party info hasn't arrived yet. */
  parties = $derived.by(() => {
    const rows = this.players;
    if (this.partyByName.size === 0) return [rows];

    const groups = new Map<number, PlayerRow[]>();
    for (const row of rows) {
      const party = row.party ?? -1;
      const group = groups.get(party);
      if (group) group.push(row);
      else groups.set(party, [row]);
    }

    return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
  });

  /** The player whose breakdown is open, pinned to the fight it was opened in. */
  #selection = $state.raw<{ name: string; fightStart: number } | null>(null);

  /**
   * The open breakdown's player, looked up again in every frame so it stays live.
   *
   * Null once that fight is cleared or a new one starts, which drops the viewer back to the list as
   * the meter does on a new pull, without an effect having to reset anything.
   */
  selectedRow = $derived.by(() => {
    const selection = this.#selection;
    if (!selection || !this.encounter || this.fightStart !== selection.fightStart) return null;
    return this.players.find((row) => row.entity.name === selection.name) ?? null;
  });

  selectPlayer(name: string) {
    this.#selection = { name, fightStart: this.fightStart };
  }

  closeBreakdown() {
    this.#selection = null;
  }

  clear() {
    this.encounter = null;
    this.bossStatus = null;
    this.partyInfo = null;
    this.meterStatus = { raidInProgress: false };
    this.#selection = null;
  }
}

export class PlayerRow {
  readonly entity: Entity;
  readonly #viewer: ViewerState;

  constructor(entity: Entity, viewer: ViewerState) {
    this.entity = entity;
    this.#viewer = viewer;
  }

  /** The meter falls back to the class name when a name is a placeholder. */
  get name(): string {
    const base = isNameValid(this.entity.name) ? this.entity.name : this.entity.class || "Unknown";
    return this.entity.isDead ? `💀 ${base}` : base;
  }

  get key(): string {
    return this.entity.name || String(this.entity.id);
  }

  get isLocalPlayer(): boolean {
    return this.entity.name === this.#viewer.encounter?.localPlayer;
  }

  get color(): string {
    return classColor(this.entity.class);
  }

  get damage(): number {
    return this.entity.damageStats.damageDealt;
  }

  /** Recomputed locally so it keeps climbing between the host's 1 Hz frames. */
  get dps(): number {
    const seconds = this.#viewer.durationSeconds;
    return seconds > 0 ? this.damage / seconds : 0;
  }

  get damagePercent(): number {
    return percent(this.damage, this.#viewer.totalDamageDealt);
  }

  /** Row bars are scaled against the top player, as the meter does. */
  get barWidth(): number {
    const top = this.#viewer.topDamage;
    return top > 0 ? (this.damage / top) * 100 : 0;
  }

  get critPercent(): number {
    return percent(this.entity.skillStats.crits, this.entity.skillStats.hits);
  }

  get frontAttackPercent(): number {
    return percent(this.entity.damageStats.frontAttackDamage, this.damage);
  }

  get backAttackPercent(): number {
    return percent(this.entity.damageStats.backAttackDamage, this.damage);
  }

  #damageWithoutSpecial: number | undefined;

  /**
   * Damage excluding special skills, which no buff can modify. Cached because the four support
   * columns all read it, and a row's entity never changes: rows are rebuilt for every frame.
   */
  get damageWithoutSpecial(): number {
    if (this.#damageWithoutSpecial === undefined) {
      let special = 0;
      for (const skill of Object.values(this.entity.skills)) {
        if (skill.special) special += skill.totalDamage;
      }
      this.#damageWithoutSpecial = this.damage - special;
    }
    return this.#damageWithoutSpecial;
  }

  // Support uptimes use the desktop meter's denominators (DamageMeterColumns.svelte): hyper awakening
  // damage is left out of every one except T%.

  get supportBuffPercent(): number {
    return percent(this.entity.damageStats.buffedBySupport, this.#damageWithoutSpecialOrHa);
  }

  get brandPercent(): number {
    return percent(this.entity.damageStats.debuffedBySupport, this.#damageWithoutSpecialOrHa);
  }

  get identityPercent(): number {
    return percent(this.entity.damageStats.buffedByIdentity, this.#damageWithoutSpecialOrHa);
  }

  get hatPercent(): number {
    return percent(this.entity.damageStats.buffedByHat ?? 0, this.damageWithoutSpecial);
  }

  get #damageWithoutSpecialOrHa(): number {
    return this.damageWithoutSpecial - (this.entity.damageStats.hyperAwakeningDamage ?? 0);
  }

  get deaths(): number {
    return this.entity.damageStats.deaths;
  }

  get counters(): number {
    return this.entity.skillStats.counters;
  }

  get critDamagePercent(): number {
    return percent(this.entity.damageStats.critDamage, this.damage);
  }

  get casts(): number {
    return this.entity.skillStats.casts;
  }

  get hits(): number {
    return this.entity.skillStats.hits;
  }

  get castsPerMinute(): number {
    return perMinute(this.casts, this.#viewer.durationSeconds);
  }

  get hitsPerMinute(): number {
    return perMinute(this.hits, this.#viewer.durationSeconds);
  }

  get party(): number | undefined {
    return this.#viewer.partyByName.get(this.entity.name);
  }

  #skills: SkillRow[] | undefined;

  /**
   * Skills for the breakdown, damage descending, with Arcanist cards hidden as the meter does
   * (`skills` in the desktop app's `src/lib/entity.svelte.ts`). Cached for the same reason as
   * `damageWithoutSpecial`.
   */
  get skills(): SkillRow[] {
    if (this.#skills === undefined) {
      let skills = Object.values(this.entity.skills);
      if (this.entity.class === "Arcanist") skills = skills.filter((skill) => !arcanistCardIds.has(skill.id));
      skills.sort((a, b) => b.totalDamage - a.totalDamage);

      const top = skills[0]?.totalDamage ?? 0;
      this.#skills = skills.map((skill) => new SkillRow(skill, this, this.#viewer, top));
    }
    return this.#skills;
  }
}

/**
 * One skill in a player's breakdown. Formulas follow the desktop app's `PlayerBreakdownColumns.svelte`,
 * where every per-skill percentage is taken against that skill's own damage or hits.
 */
export class SkillRow {
  readonly skill: Skill;
  readonly #player: PlayerRow;
  readonly #viewer: ViewerState;
  readonly #topDamage: number;

  constructor(skill: Skill, player: PlayerRow, viewer: ViewerState, topDamage: number) {
    this.skill = skill;
    this.#player = player;
    this.#viewer = viewer;
    this.#topDamage = topDamage;
  }

  get key(): number {
    return this.skill.id;
  }

  get name(): string {
    return this.skill.name || String(this.skill.id);
  }

  get icon(): string {
    return skillIcon(this.skill.icon);
  }

  /** Unaffected by crits, positionals and buffs, so the meter shows "-" for those columns. */
  get isSpecial(): boolean {
    return !!this.skill.special || !!this.skill.isHyperAwakening || hyperAwakeningIds.has(this.skill.id);
  }

  get damage(): number {
    return this.skill.totalDamage;
  }

  get dps(): number {
    const seconds = this.#viewer.durationSeconds;
    return seconds > 0 ? this.damage / seconds : 0;
  }

  get damagePercent(): number {
    return percent(this.damage, this.#player.damage);
  }

  /** Bars are scaled against the top skill, as the meter does. */
  get barWidth(): number {
    return this.#topDamage > 0 ? (this.damage / this.#topDamage) * 100 : 0;
  }

  get critPercent(): number {
    return percent(this.skill.crits, this.skill.hits);
  }

  get critDamagePercent(): number {
    return percent(this.skill.critDamage, this.damage);
  }

  // Damage share, matching the viewer's player list rather than the desktop breakdown's hit share.

  get frontAttackPercent(): number {
    return percent(this.skill.frontAttackDamage, this.damage);
  }

  get backAttackPercent(): number {
    return percent(this.skill.backAttackDamage, this.damage);
  }

  get supportBuffPercent(): number {
    return percent(this.skill.buffedBySupport, this.damage);
  }

  get brandPercent(): number {
    return percent(this.skill.debuffedBySupport, this.damage);
  }

  get identityPercent(): number {
    return percent(this.skill.buffedByIdentity, this.damage);
  }

  get hatPercent(): number {
    return percent(this.skill.buffedByHat ?? 0, this.damage);
  }

  get avgPerHit(): number {
    return this.skill.hits > 0 ? this.damage / this.skill.hits : 0;
  }

  get avgPerCast(): number {
    return this.skill.casts > 0 ? this.damage / this.skill.casts : 0;
  }

  get maxHit(): number {
    return this.skill.maxDamage;
  }

  get casts(): number {
    return this.skill.casts;
  }

  get hits(): number {
    return this.skill.hits;
  }

  get castsPerMinute(): number {
    return perMinute(this.skill.casts, this.#viewer.durationSeconds);
  }

  get hitsPerMinute(): number {
    return perMinute(this.skill.hits, this.#viewer.durationSeconds);
  }
}

function perMinute(count: number, seconds: number): number {
  return seconds > 0 ? count / (seconds / 60) : 0;
}
