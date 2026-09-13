import { classColor } from "./constants";
import { isNameValid, percent } from "./format";
import type { BossStatus, MeterStatus } from "./protocol";
import { type Encounter, type Entity, EntityType } from "./types";

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

  clear() {
    this.encounter = null;
    this.bossStatus = null;
    this.partyInfo = null;
    this.meterStatus = { raidInProgress: false };
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

  get deaths(): number {
    return this.entity.damageStats.deaths;
  }

  get counters(): number {
    return this.entity.skillStats.counters;
  }

  get party(): number | undefined {
    return this.#viewer.partyByName.get(this.entity.name);
  }
}
