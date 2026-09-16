import {
  arcanistCardIds,
  BRAND_UNIQUE_GROUP,
  classColor,
  classIcon,
  getBossHpBars,
  hyperAwakeningIds,
  IDENTITY_BRAND_SKILL_ID,
  identityBrandRows,
  identityBrandSourceIds,
  isSupportSpec,
  LOA_BIBLE_URL,
  SIDEREAL_COLOR,
  siderealIcon,
  skillIcon
} from "./constants";
import { isNameValid, normalizeIlvl, percent, timestampToMinutesAndSeconds } from "./format";
import type { BossStatus, MeterStatus } from "./protocol";
import { settings } from "./settings.svelte";
import { type Encounter, type Entity, EntityType, type IncapacitatedEvent, type Skill } from "./types";

/**
 * The viewer's derived view of the stream.
 *
 * The host broadcasts raw encounter state once a second and sends no settings, so everything the
 * meter derives locally has to be re-derived here. Row values are plain getters rather than
 * `$derived` fields because the rows are rebuilt inside a derived on every frame; reading `$state`
 * through a getter during render tracks it just the same, without creating throwaway signals.
 *
 * Formulas follow the desktop app's `src/lib/entity.svelte.ts`, `src/lib/skill.svelte.ts` and the
 * column definitions in `DamageMeterColumns.svelte` / `PlayerBreakdownColumns.svelte`.
 */
export type SkillSort = "damage" | "buffed" | "stagger";

/** A support's identity brand: see `ViewerState.identityBrandByPlayer`. */
interface IdentityBrand {
  /** Estimated brand damage credited to the identity skills. */
  damage: number;
  /** Those skills' identity contribution (type 1), which `damage` is split across. */
  identityContributed: number;
  casts: number;
}

export class ViewerState {
  // `$state.raw` throughout: every frame replaces these wholesale and nothing mutates them in
  // place, so there is no reason to pay for deep proxying of a several-hundred-KB encounter.
  encounter = $state.raw<Encounter | null>(null);
  bossStatus = $state.raw<BossStatus | null>(null);
  partyInfo = $state.raw<string[][] | null>(null);
  meterStatus = $state.raw<MeterStatus>({ raidInProgress: false });

  /** Viewers watching this host, as the host counts them; null until it says. */
  viewerCount = $state.raw<number | null>(null);

  /** Local wall clock, advanced once a second by `tick` so the duration moves between frames. */
  now = $state(Date.now());

  /** The last tick at which the fight clock was running, so it can freeze there. */
  #lastRunningAt = $state.raw<{ fightStart: number; at: number } | null>(null);

  fightStart = $derived(this.encounter?.fightStart ?? 0);

  boss = $derived(this.encounter?.currentBoss ?? null);

  /**
   * The encounter's boss has been killed. The host marks `currentBoss.isDead` in the frame; the
   * faster bossStatus stream counts too, but only while it describes that same boss.
   */
  bossDead = $derived.by(() => {
    if (this.encounter?.currentBoss?.isDead) return true;
    const status = this.bossStatus;
    return !!status?.isDead && status.name === this.encounter?.currentBossName;
  });

  /**
   * Where the clock last stopped: the fight, and the last combat packet it had seen by then.
   *
   * A zone change (a restart vote teleporting the party, leaving the raid) stops the meter's clock
   * but turns `raidInProgress` back on six seconds later so the next pull is caught, while the meter
   * keeps showing the finished fight. Without this the viewer's clock would pick that old fight back
   * up and count forever.
   */
  #haltedAt = $state.raw<{ fightStart: number; lastCombatPacket: number } | null>(null);

  /**
   * The fight clock runs while a raid is in progress and its boss is alive, as in the meter, and
   * once stopped it stays stopped until the fight shows new combat. A new pull has a new fightStart,
   * so it starts clean.
   */
  clockRunning = $derived.by(() => {
    if (!this.meterStatus.raidInProgress || this.bossDead) return false;
    const halted = this.#haltedAt;
    return !(
      halted &&
      halted.fightStart === this.fightStart &&
      (this.encounter?.lastCombatPacket ?? 0) <= halted.lastCombatPacket
    );
  });

  /**
   * Time since the pull. While the clock runs it follows the wall clock; once it stops (boss
   * killed, wipe, zone change) it freezes at the last running tick, like the meter's timer does. A
   * viewer who joined after the clock stopped never saw it run, and gets the last combat packet.
   */
  duration = $derived.by(() => {
    if (!this.encounter || !this.fightStart) return 0;

    let end: number;
    if (this.clockRunning) end = this.now;
    else if (this.#lastRunningAt?.fightStart === this.fightStart) end = this.#lastRunningAt.at;
    else end = this.encounter.lastCombatPacket;

    return Math.max(0, end - this.fightStart);
  });

  durationSeconds = $derived(this.duration / 1000);

  /** Advance the local clock; called once a second. */
  tick(now = Date.now()) {
    if (this.fightStart && this.encounter) {
      if (this.clockRunning) {
        this.#lastRunningAt = { fightStart: this.fightStart, at: now };
      } else if (this.#lastRunningAt?.fightStart === this.fightStart) {
        // It ran during this fight and has now stopped: hold it there until combat moves on.
        this.#haltedAt = { fightStart: this.fightStart, lastCombatPacket: this.encounter.lastCombatPacket };
      }
    }
    this.now = now;
  }

  /**
   * Damage dealt by sidereal (Esther) skills, damage descending; empty when they're hidden.
   * `players` in the meter's `encounter.svelte.ts`, with showEsther.
   */
  siderealEntities = $derived.by(() => {
    if (!this.encounter || !settings.showSidereals) return [] as Entity[];

    return Object.values(this.encounter.entities)
      .filter((e) => e.entityType === EntityType.ESTHER && e.damageStats.damageDealt > 0)
      .sort((a, b) => b.damageStats.damageDealt - a.damageStats.damageDealt);
  });

  /** The encounter's damage, plus the sidereals' when they're shown, as the meter counts it. */
  /** The host's region, for profile links; "CE" stands in for "EUC" as in the meter. */
  region = $derived.by(() => {
    const region = this.encounter?.encounterDamageStats.misc?.region ?? this.encounter?.region ?? "";
    return region === "EUC" ? "CE" : region;
  });

  contributionSplitByName = $derived(
    new Map((this.encounter?.encounterDamageStats.misc?.contributionSplits ?? []).map((split) => [split.name, split]))
  );

  totalDamageDealt = $derived(
    (this.encounter?.encounterDamageStats.totalDamageDealt ?? 0) +
      this.siderealEntities.reduce((sum, e) => sum + e.damageStats.damageDealt, 0)
  );

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
      .filter((e) => e.entityType === EntityType.PLAYER && e.classId !== 0 && e.damageStats.damageDealt > 0)
      .sort((a, b) => b.damageStats.damageDealt - a.damageStats.damageDealt);
  });

  topDamage = $derived(this.playerEntities[0]?.damageStats.damageDealt ?? 0);

  #playerOrder = new StableOrder<string>();

  /**
   * Rows in display order: players and any shown sidereals, damage descending, with near-ties held
   * in place. Sidereals mix into the list as in the live meter; the party split gives them a table.
   */
  players = $derived(
    this.#playerOrder
      .arrange(
        [...this.playerEntities, ...this.siderealEntities].sort(
          (a, b) => b.damageStats.damageDealt - a.damageStats.damageDealt
        ),
        (e) => e.name,
        (e) => e.damageStats.damageDealt,
        this.fightStart
      )
      .map((entity) => new PlayerRow(entity, this))
  );

  #skillOrder = new StableOrder<number>();

  /** A breakdown's skills in display order, descending by `sort`, with near-ties held in place. */
  orderSkills(player: string, sort: SkillSort, skills: Skill[]): Skill[] {
    const context = `${this.fightStart}:${player}:${sort}`;
    return this.#skillOrder.arrange(
      skills,
      (skill) => skill.id,
      (skill) => skillSortValue(skill, sort),
      context
    );
  }

  /** Players whose skills contributed buff damage to others: the meter's definition of a support. */
  supportNames = $derived.by(() => {
    const names = new Set<string>();
    for (const player of this.playerEntities) {
      if (Object.values(player.skills).some((skill) => sumContributed(skill, BUFF_TYPES) > 0)) names.add(player.name);
    }
    return names;
  });

  /** Raid contribution (rDPS) data is present and the host hasn't flagged it as unreliable. */
  anyRdpsContributions = $derived(
    this.encounter?.encounterDamageStats.misc?.rdpsValid !== false &&
      this.playerEntities.some((e) => e.damageStats.rdpsDamageGiven > 0 || e.damageStats.rdpsDamageReceived > 0)
  );

  /** Which optional list columns have any data, mirroring each column's `show()` in the meter. */
  aggregates = $derived.by(() => {
    const entities = this.playerEntities;
    const anyUnbuffed = entities.some((e) => hasUnbuffedDamage(e)) || this.supportNames.size > 0;
    return {
      deadFor: entities.some((e) => e.isDead),
      deaths: entities.some((e) => e.damageStats.deaths > 0 && !e.isDead),
      incapacitated: entities.some((e) => (e.damageStats.incapacitations?.length ?? 0) > 0),
      notSolo: entities.length !== 1,
      unbuffed: anyUnbuffed,
      rdps: this.anyRdpsContributions,
      supportContrib: this.supportNames.size > 0,
      crit: entities.some((e) => e.skillStats.hits > 0),
      frontAttack: entities.some((e) => e.skillStats.frontAttacks > 0),
      backAttack: entities.some((e) => e.skillStats.backAttacks > 0),
      supportBuff: entities.some((e) => e.damageStats.buffedBySupport > 0),
      brand: entities.some((e) => e.damageStats.debuffedBySupport > 0),
      identity: entities.some((e) => e.damageStats.buffedByIdentity > 0),
      hat: entities.some((e) => (e.damageStats.buffedByHat ?? 0) > 0),
      stagger: entities.some((e) => e.damageStats.stagger > 0),
      counters: entities.some((e) => e.skillStats.counters > 0)
    };
  });

  /** Party assignments seen so far this fight. Not reactive: it only carries names between updates. */
  #partyMemory = { fightStart: 0, parties: new Map<string, number>() };

  /**
   * Party index by player name, for the party-split view.
   *
   * Sticky for the fight: the host builds its party list from the players the game currently has
   * loaded, so someone can drop out of it for an update or two. Moving them to the unknown group and
   * back would rebuild their row each time, blanking the bar. They keep their last known party until
   * a list puts them somewhere else, or a new fight starts.
   */
  partyByName = $derived.by(() => {
    if (this.#partyMemory.fightStart !== this.fightStart) {
      this.#partyMemory = { fightStart: this.fightStart, parties: new Map() };
    }
    const known = this.#partyMemory.parties;
    this.partyInfo?.forEach((party, index) => {
      for (const name of party) known.set(name, index);
    });
    return new Map(known);
  });

  /**
   * Players grouped into parties, or a single flat group when party info hasn't arrived yet. `party`
   * is the host's party index, -1 for players it hasn't placed, or `SIDEREAL_PARTY` for the
   * sidereals' table after the parties (as in the meter's log view). It keys each group's table, so a
   * group appearing or going doesn't shift the other tables' rows into different ones.
   */
  parties = $derived.by(() => {
    const rows = this.players;
    if (this.partyByName.size === 0) return [{ party: -1, rows }];

    const groups = new Map<number, PlayerRow[]>();
    for (const row of rows) {
      const party = row.isSidereal ? SIDEREAL_PARTY : (row.party ?? -1);
      const group = groups.get(party);
      if (group) group.push(row);
      else groups.set(party, [row]);
    }

    return [...groups.entries()].sort(([a], [b]) => a - b).map(([party, group]) => ({ party, rows: group }));
  });

  /** Last boss shown this fight, so a gap in the host's boss data doesn't blank the bar. Not reactive. */
  #lastBoss: { fightStart: number; boss: BossStatus } | null = null;

  /**
   * The boss HP bar's data.
   *
   * bossStatus arrives at ~5 Hz and drives the animated bar; the encounter's own copy is the 1 Hz
   * fallback that fills the gap for a viewer who joined between boss updates, or a host that isn't
   * rendering its boss bar. The host can briefly send neither (its boss bar unmounts, or a snapshot
   * lacks the boss), so within a fight the last known boss is held rather than removing the bar.
   */
  shownBoss = $derived.by((): BossStatus | null => {
    const current = this.#liveBoss();
    if (current) {
      if (this.encounter) this.#lastBoss = { fightStart: this.fightStart, boss: current };
      return current;
    }
    return this.encounter && this.#lastBoss?.fightStart === this.fightStart ? this.#lastBoss.boss : null;
  });

  #liveBoss(): BossStatus | null {
    if (this.bossStatus) return this.bossStatus;

    const fallback = this.boss;
    if (!fallback) return null;

    const totalBars = getBossHpBars(fallback);
    return {
      name: fallback.name,
      isDead: fallback.isDead,
      currentHp: fallback.currentHp,
      maxHp: fallback.maxHp,
      currentShield: fallback.currentShield,
      totalBars,
      currentBars: totalBars
    };
  }

  /**
   * How long the boss would take to die at the damage the living players have averaged so far, as
   * `timeToKill` in the meter's `encounter.svelte.ts`: `mm:ss`, or "∞" beyond an hour.
   *
   * Null when it means nothing: no boss, a dead boss, a stopped clock, or nobody dealing damage.
   */
  timeToKill = $derived.by((): string | null => {
    const boss = this.shownBoss;
    if (!boss || boss.isDead || !this.clockRunning || this.duration <= 0) return null;

    const damagePerMs =
      this.playerEntities
        .filter((e) => !e.isDead && e.damageStats.damageDealt > 0)
        .reduce((sum, e) => sum + e.damageStats.damageDealt, 0) / this.duration;
    if (damagePerMs <= 0) return null;

    const remaining = Math.max(0, boss.currentHp) + boss.currentShield;
    const millis = Math.max(remaining / damagePerMs, 0);
    return millis > 3.6e6 ? "∞" : timestampToMinutesAndSeconds(millis);
  });

  /**
   * The non-support players a support's contribution is measured against: their own party when
   * party info is known, otherwise everyone. `getContributionScopeDpsPlayers` in the meter.
   */
  contributionScopeDps(name: string): Entity[] {
    const partyIndex = this.partyByName.get(name);
    const scope =
      partyIndex === undefined
        ? this.playerEntities
        : this.playerEntities.filter((e) => this.partyByName.get(e.name) === partyIndex);
    return scope.filter((e) => !this.supportNames.has(e.name));
  }

  /**
   * Per support, the brand damage the game credited to their identity skill instead of to brand.
   *
   * Some identities (Serenade of Courage, Moonfall, Blessed Aura, Release Light) also apply brand,
   * and the game reports that bonus under the identity's contribution. As the meter does in
   * `identityBrandContextByPlayer`, this estimates it by scaling the support's regular brand damage
   * by how much party damage landed under identity brand versus regular brand. Supports it doesn't
   * apply to are absent. Needs the host's debuff registry, which a host only keeps current for
   * viewers when it resends the registries as they grow.
   */
  identityBrandByPlayer = $derived.by(() => {
    const result = new Map<string, IdentityBrand>();
    const debuffs = this.encounter?.encounterDamageStats.debuffs;
    if (!this.encounter || !debuffs) return result;

    for (const name of this.supportNames) {
      const entity = this.encounter.entities[name];
      if (!entity) continue;

      // This support's class's brand debuffs, split by whether an identity skill applies them.
      const identityBrandIds = new Set<number>();
      const regularBrandIds = new Set<number>();
      for (const [id, debuff] of Object.entries(debuffs)) {
        const skill = debuff.source.skill;
        if (debuff.uniqueGroup !== BRAND_UNIQUE_GROUP || !skill || skill.classId !== entity.classId) continue;
        (identityBrandSourceIds.has(skill.id) ? identityBrandIds : regularBrandIds).add(Number(id));
      }
      if (identityBrandIds.size === 0) continue;

      // Damage the DPS in their party dealt under each kind of brand.
      let identityWindow = 0;
      let regularWindow = 0;
      for (const player of this.contributionScopeDps(name)) {
        for (const [id, damage] of Object.entries(player.damageStats.debuffedBy)) {
          if (identityBrandIds.has(Number(id))) identityWindow += damage;
          else if (regularBrandIds.has(Number(id))) regularWindow += damage;
        }
      }
      if (identityWindow === 0 || regularWindow === 0) continue;

      // The support's regular brand damage: contribution type 3, boss debuffs.
      const skills = Object.values(entity.skills);
      const regularBrandDamage = skills.reduce((sum, skill) => sum + (skill.rdpsContributed?.[3] ?? 0), 0);
      if (regularBrandDamage === 0) continue;

      const damage = Math.round(regularBrandDamage * (identityWindow / regularWindow));
      if (damage <= 0) continue;

      // The identity skills' own contribution (type 1), which the brand damage is taken back out of.
      let identityContributed = 0;
      let casts = 0;
      for (const skill of skills) {
        if (!identityBrandSourceIds.has(skill.id)) continue;
        identityContributed += skill.rdpsContributed?.[1] ?? 0;
        casts += skill.casts;
      }
      if (identityContributed === 0) continue;

      result.set(name, { damage, identityContributed, casts });
    }

    return result;
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

  /**
   * How the open breakdown orders its skills. Every breakdown opens on "buffed", as in the meter:
   * supports see their skills by damage buffed, and everyone else falls back to damage.
   */
  skillSort = $state<SkillSort>("buffed");

  selectPlayer(name: string) {
    this.#selection = { name, fightStart: this.fightStart };
    this.skillSort = "buffed";
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
    this.#lastRunningAt = null;
    this.#haltedAt = null;
    this.#lastBoss = null;
    this.viewerCount = null;
  }
}

/** Group key for the sidereals' table in `ViewerState.parties`; sorts after every real party. */
export const SIDEREAL_PARTY = Number.MAX_SAFE_INTEGER;

/** How far ahead a row must get before it passes the one above it: 0.5% of that row's value. */
const REORDER_MARGIN = 0.005;

/**
 * Remembers the order a list was last shown in, so near-ties don't trade places on every frame.
 *
 * The host sends a frame a second, and two players or skills within a hair of each other would
 * otherwise swap rows back and forth each time, which reads as flicker. Neighbours only swap once the
 * lower one leads by `REORDER_MARGIN`. Not reactive: it only carries the last result between frames.
 */
class StableOrder<K> {
  #context: unknown;
  #keys: K[] = [];

  /**
   * `items` descending by `value`, except that near-ties keep the order they were last shown in.
   * A different `context` (a new fight, another player, another sort) starts from a plain sort.
   */
  arrange<T>(items: T[], key: (item: T) => K, value: (item: T) => number, context: unknown): T[] {
    const byKey = new Map(items.map((item) => [key(item), item]));
    const previous = context === this.#context ? this.#keys.filter((k) => byKey.has(k)) : [];
    const shown = new Set(previous);
    const added = items.filter((item) => !shown.has(key(item))).sort((a, b) => value(b) - value(a));
    const order = [...previous.map((k) => byKey.get(k)!), ...added];

    // Swap neighbours only on a clear lead. Each swap removes an inversion, so the passes end.
    for (let swapped = true; swapped; ) {
      swapped = false;
      for (let i = 0; i + 1 < order.length; i++) {
        const upper = value(order[i]);
        const lower = value(order[i + 1]);
        if (lower - upper > Math.abs(upper) * REORDER_MARGIN) {
          [order[i], order[i + 1]] = [order[i + 1], order[i]];
          swapped = true;
        }
      }
    }

    this.#context = context;
    this.#keys = order.map(key);
    return order;
  }
}

export class PlayerRow {
  readonly entity: Entity;
  readonly #viewer: ViewerState;

  constructor(entity: Entity, viewer: ViewerState) {
    this.entity = entity;
    this.#viewer = viewer;
  }

  /** Damage from a sidereal (Esther) skill rather than a player. */
  get isSidereal(): boolean {
    return this.entity.entityType === EntityType.ESTHER;
  }

  /**
   * The displayed name, as `formatPlayerName` in the meter: the class name stands in for a
   * placeholder name, the item level goes first when that's on, and a skull marks the dead.
   * Sidereals keep their own name.
   */
  get name(): string {
    if (this.isSidereal) return this.entity.name;
    let name = isNameValid(this.entity.name) ? this.entity.name : this.entity.class || "Unknown";
    if (settings.showItemLevel && this.entity.gearScore > 0) name = `${normalizeIlvl(this.entity.gearScore)} ${name}`;
    return this.entity.isDead ? `💀 ${name}` : name;
  }

  /** The character's lostark.bible page, when the setting is on and the name and region are real. */
  get profileUrl(): string | null {
    const region = this.#viewer.region;
    if (!settings.profileShortcut || this.isSidereal || !region || !isNameValid(this.entity.name)) return null;
    return `${LOA_BIBLE_URL}/character/${encodeURIComponent(region)}/${encodeURIComponent(this.entity.name)}`;
  }

  /** The loadout snapshot the host resolved for this character, linked from the name tooltip. */
  get loadoutUrl(): string | null {
    return this.entity.loadoutHash ? `${LOA_BIBLE_URL}/character/snapshot/${this.entity.loadoutHash}` : null;
  }

  /** Received dark grenade contribution, when the frame carries contribution splits (saved logs do). */
  get darkGrenadeDamageReceived(): number {
    return this.#viewer.contributionSplitByName.get(this.entity.name)?.damageSplitByName["DarkGrenadeSynergy"] ?? 0;
  }

  /** Class icon, or the sidereal's own. */
  get icon(): string {
    return this.isSidereal ? siderealIcon(this.entity.name) : classIcon(this.entity.classId);
  }

  /** What the icon shows, for its tooltip. */
  get iconLabel(): string {
    return this.isSidereal ? this.entity.name : this.entity.class;
  }

  get key(): string {
    return this.entity.name || String(this.entity.id);
  }

  get isLocalPlayer(): boolean {
    return this.entity.name === this.#viewer.encounter?.localPlayer;
  }

  get color(): string {
    return this.isSidereal ? SIDEREAL_COLOR : classColor(this.entity.class);
  }

  get damage(): number {
    return this.entity.damageStats.damageDealt;
  }

  /** Recomputed locally so it keeps climbing between the host's 1 Hz frames. */
  get dps(): number {
    return perSecond(this.damage, this.#viewer.durationSeconds);
  }

  get damagePercent(): number {
    return percent(this.damage, this.#viewer.totalDamageDealt);
  }

  /** Row bars are scaled against the top player, as the meter does. */
  get barWidth(): number {
    const top = this.#viewer.topDamage;
    return top > 0 ? (this.damage / top) * 100 : 0;
  }

  #withoutSpecial: { damage: number; hits: number } | undefined;

  /**
   * Damage without special skills, and hits without special or hyper awakening skills: the
   * denominators the meter uses for crit, positional and support percentages. Cached because many
   * columns read them, and a row's entity never changes: rows are rebuilt for every frame.
   */
  get #special(): { damage: number; hits: number } {
    if (this.#withoutSpecial === undefined) {
      let damage = this.damage;
      let hits = this.entity.skillStats.hits;
      for (const skill of Object.values(this.entity.skills)) {
        if (skill.special) damage -= skill.totalDamage;
        if (isSpecialSkill(skill)) hits -= skill.hits;
      }
      this.#withoutSpecial = { damage, hits };
    }
    return this.#withoutSpecial;
  }

  get damageWithoutSpecial(): number {
    return this.#special.damage;
  }

  get #damageWithoutSpecialOrHa(): number {
    return this.damageWithoutSpecial - (this.entity.damageStats.hyperAwakeningDamage ?? 0);
  }

  get #hitsWithoutSpecial(): number {
    return this.#special.hits;
  }

  get critPercent(): number {
    return percent(this.entity.skillStats.crits, this.#hitsWithoutSpecial);
  }

  get critDamagePercent(): number {
    if (this.#hitsWithoutSpecial <= 0) return 0;
    return percent(this.entity.damageStats.critDamage, this.#damageWithoutSpecialOrHa);
  }

  get frontAttackHitPercent(): number {
    return percent(this.entity.skillStats.frontAttacks, this.#hitsWithoutSpecial);
  }

  get backAttackHitPercent(): number {
    return percent(this.entity.skillStats.backAttacks, this.#hitsWithoutSpecial);
  }

  get frontAttackPercent(): number {
    return percent(this.entity.damageStats.frontAttackDamage, this.#damageWithoutSpecialOrHa);
  }

  get backAttackPercent(): number {
    return percent(this.entity.damageStats.backAttackDamage, this.#damageWithoutSpecialOrHa);
  }

  // Support uptimes leave hyper awakening damage out of every denominator except T%.

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

  get deaths(): number {
    return this.entity.damageStats.deaths;
  }

  /** Seconds since death, measured to the last combat packet; null while alive. */
  get deadForSeconds(): number | null {
    if (!this.entity.isDead) return null;
    const end = this.#viewer.encounter?.lastCombatPacket ?? 0;
    return Math.abs((end - this.entity.damageStats.deathTime) / 1000);
  }

  #incapacitated: { total: number; knockDown: number; cc: number } | undefined;

  /** Milliseconds spent knocked down or crowd controlled, overlaps merged. */
  get incapacitatedMs(): { total: number; knockDown: number; cc: number } {
    if (this.#incapacitated === undefined) {
      const events = this.entity.damageStats.incapacitations ?? [];
      const end = this.#viewer.encounter?.lastCombatPacket ?? 0;
      this.#incapacitated = {
        total: incapacitatedTime(events, end),
        knockDown: incapacitatedTime(
          events.filter((e) => e.type === "FALL_DOWN"),
          end
        ),
        cc: incapacitatedTime(
          events.filter((e) => e.type === "CROWD_CONTROL"),
          end
        )
      };
    }
    return this.#incapacitated;
  }

  /** Neutral damage: own damage with incoming synergies and buffs removed. */
  get baseDamage(): number {
    return this.damage - this.entity.damageStats.rdpsDamageReceived;
  }

  /** Raid damage: neutral damage plus what this player's synergies and buffs gave others. */
  get raidDamage(): number {
    return this.baseDamage + this.entity.damageStats.rdpsDamageGiven;
  }

  get ndps(): number {
    return perSecond(this.baseDamage, this.#viewer.durationSeconds);
  }

  get rdps(): number {
    return perSecond(this.raidDamage, this.#viewer.durationSeconds);
  }

  get isSupport(): boolean {
    return this.#viewer.supportNames.has(this.entity.name);
  }

  get isSupportSpec(): boolean {
    return isSupportSpec(this.entity.spec);
  }

  get anyUnbuffedDamage(): boolean {
    return hasUnbuffedDamage(this.entity);
  }

  get unbuffedDamage(): number {
    return this.entity.damageStats.unbuffedDamage;
  }

  get unbuffedDps(): number {
    if (this.unbuffedDamage === 0) return this.dps;
    return perSecond(this.unbuffedDamage, this.#viewer.durationSeconds);
  }

  /** Damage a support's buffs added to others, summed over their breakdown skills as in the meter. */
  get totalDamageBuffed(): number {
    if (!this.isSupport) return 0;
    return this.breakdownSkills.reduce((sum, skill) => sum + sumContributed(skill, BUFF_TYPES), 0);
  }

  get totalDpsBuffed(): number {
    return perSecond(this.totalDamageBuffed, this.#viewer.durationSeconds);
  }

  /** A support's buffed damage as a share of the whole encounter's damage. */
  get totalDamageBuffedPercent(): number {
    return percent(this.totalDamageBuffed, this.#viewer.totalDamageDealt);
  }

  /** Whether raid contribution data is usable for this encounter. */
  get encounterHasRdps(): boolean {
    return this.#viewer.anyRdpsContributions;
  }

  get totalDamageReduced(): number {
    return Object.values(this.entity.skills).reduce((sum, skill) => sum + sumContributed(skill, DR_TYPES), 0);
  }

  /** Share of buffed damage in this player's own damage. */
  get buffedShareOfOwnDamage(): number {
    return percent(this.damage - this.unbuffedDamage, this.damage);
  }

  /**
   * A support's buff contribution to their party: weighted over DPS players with unbuffed data,
   * i.e. sum(buffed) / sum(damage).
   */
  get supportContribPercent(): number {
    const scope = this.#viewer.contributionScopeDps(this.entity.name).filter((e) => hasUnbuffedDamage(e));
    const total = scope.reduce((sum, e) => sum + e.damageStats.damageDealt, 0);
    const unbuffed = scope.reduce((sum, e) => sum + e.damageStats.unbuffedDamage, 0);
    return percent(total - unbuffed, total);
  }

  /** Raid contribution: given, for supports, against their party's DPS damage; received otherwise. */
  get rdpsContribDamage(): number {
    return this.isSupport ? this.entity.damageStats.rdpsDamageGiven : this.entity.damageStats.rdpsDamageReceived;
  }

  get rdpsContribPercent(): number {
    if (this.isSupport) {
      const partyDamage = this.#viewer
        .contributionScopeDps(this.entity.name)
        .reduce((sum, e) => sum + e.damageStats.damageDealt, 0);
      return percent(this.entity.damageStats.rdpsDamageGiven, partyDamage);
    }
    return percent(this.entity.damageStats.rdpsDamageReceived, this.damage);
  }

  get stagger(): number {
    return this.entity.damageStats.stagger;
  }

  get counters(): number {
    return this.entity.skillStats.counters;
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

  /** The breakdown sort in effect: "buffed" only means something for supports, "stagger" only with stagger. */
  get skillSort(): SkillSort {
    const sort = this.#viewer.skillSort;
    if (sort === "buffed" && !this.isSupport) return "damage";
    if (sort === "stagger" && this.stagger <= 0) return "damage";
    return sort;
  }

  #breakdownSkills: { brand: IdentityBrand | undefined; skills: Skill[] } | undefined;

  /**
   * The player's skills as the breakdown counts them, as `EntityState.skills` does in the meter:
   * Arcanist cards hidden, and a support's identity brand moved off the identity skills into a row
   * of its own. Unsorted.
   *
   * Cached against the identity brand it was built from, which is looked up on every call so that a
   * party update that changes it (without a new frame) is still picked up.
   */
  get breakdownSkills(): Skill[] {
    const brand = this.#viewer.identityBrandByPlayer.get(this.entity.name);
    if (this.#breakdownSkills?.brand !== brand || this.#breakdownSkills === undefined) {
      let skills = Object.values(this.entity.skills);
      if (this.entity.class === "Arcanist") skills = skills.filter((skill) => !arcanistCardIds.has(skill.id));
      else if (brand) skills = withIdentityBrand(skills, brand, this.entity.class);
      this.#breakdownSkills = { brand, skills };
    }
    return this.#breakdownSkills.skills;
  }

  #skills: { sort: SkillSort; source: Skill[]; rows: SkillRow[] } | undefined;

  /**
   * Skills for the breakdown, descending by the sort in effect. Cached per sort for the same reason
   * as the special-skill totals.
   */
  get skills(): SkillRow[] {
    const sort = this.skillSort;
    const source = this.breakdownSkills;
    if (this.#skills?.sort !== sort || this.#skills.source !== source) {
      const skills = this.#viewer.orderSkills(this.entity.name, sort, source);
      // The top value rather than the first row's: a held near-tie can put a slightly smaller one first.
      const top = Math.max(0, ...skills.map((skill) => skillSortValue(skill, sort)));
      this.#skills = {
        sort,
        source,
        rows: skills.map((skill) => new SkillRow(skill, this, this.#viewer, top, sort))
      };
    }
    return this.#skills.rows;
  }
}

/**
 * One skill in a player's breakdown. As in the meter's `PlayerBreakdownColumns.svelte`, every
 * per-skill percentage is taken against that skill's own damage or hits.
 */
export class SkillRow {
  readonly skill: Skill;
  readonly #player: PlayerRow;
  readonly #viewer: ViewerState;
  readonly #topValue: number;
  readonly #sort: SkillSort;

  constructor(skill: Skill, player: PlayerRow, viewer: ViewerState, topValue: number, sort: SkillSort) {
    this.skill = skill;
    this.#player = player;
    this.#viewer = viewer;
    this.#topValue = topValue;
    this.#sort = sort;
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
    return isSpecialSkill(this.skill);
  }

  get damage(): number {
    return this.skill.totalDamage;
  }

  get dps(): number {
    return perSecond(this.damage, this.#viewer.durationSeconds);
  }

  get damagePercent(): number {
    return percent(this.damage, this.#player.damage);
  }

  /** Bars are scaled against the top skill by the value being sorted on, as the meter does. */
  get barWidth(): number {
    return this.#topValue > 0 ? (skillSortValue(this.skill, this.#sort) / this.#topValue) * 100 : 0;
  }

  get critPercent(): number {
    return percent(this.skill.crits, this.skill.hits);
  }

  get critDamagePercent(): number {
    return percent(this.skill.critDamage, this.damage);
  }

  get frontAttackHitPercent(): number {
    return percent(this.skill.frontAttacks, this.skill.hits);
  }

  get backAttackHitPercent(): number {
    return percent(this.skill.backAttacks, this.skill.hits);
  }

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

  /** Whether the skill received any buffs, which is what makes unbuffed damage meaningful. */
  get hasReceivedBuffs(): boolean {
    return Object.keys(this.skill.rdpsReceived ?? {}).length > 0;
  }

  get unbuffedDamage(): number {
    return this.damage - sumReceived(this.skill, BUFF_TYPES);
  }

  get unbuffedDps(): number {
    const unbuffed = this.unbuffedDamage;
    if (unbuffed === 0 || unbuffed === this.damage) return this.dps;
    return perSecond(unbuffed, this.#viewer.durationSeconds);
  }

  /** Neutral damage (incoming buffs removed), or null when the skill received none. */
  get neutralDamage(): number | null {
    const received = this.skill.rdpsDamageReceived ?? 0;
    return received > 0 ? this.damage - received : null;
  }

  get neutralDps(): number | null {
    const neutral = this.neutralDamage;
    return neutral === null ? null : perSecond(neutral, this.#viewer.durationSeconds);
  }

  /** Damage this (support) skill's buffs added to others. */
  get buffedDamage(): number {
    return sumContributed(this.skill, BUFF_TYPES);
  }

  get buffedDps(): number {
    return perSecond(this.buffedDamage, this.#viewer.durationSeconds);
  }

  get buffedDamagePercent(): number {
    return percent(this.buffedDamage, this.#player.totalDamageBuffed);
  }

  get damageReduced(): number {
    return sumContributed(this.skill, DR_TYPES);
  }

  /** Share of the fight the skill spent on cooldown, or null without cooldown data. */
  get cooldownRatio(): number | null {
    const available = this.skill.timeAvailable;
    const duration = this.#viewer.duration;
    if (!available || available > duration) return null;
    return (1 - available / duration) * 100;
  }

  get stagger(): number {
    return this.skill.stagger ?? 0;
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

/** Contribution types: 1 support AP buff and identity, 3 brand, 5 hyper awakening (T) skill. */
const BUFF_TYPES = [1, 3, 5];
/** Contribution types: 4 damage reduction on a character, 6 boss attack-power debuff. */
const DR_TYPES = [4, 6];

/** `sumUdpsContributed` in the meter. */
/**
 * A support's skills with their identity brand split out, as `EntityState.skills` does in the meter:
 * each identity skill gives up its share of the brand damage, which becomes a row of its own.
 */
function withIdentityBrand(skills: Skill[], brand: IdentityBrand, className: string): Skill[] {
  const adjusted = skills.map((skill) => {
    const identity = skill.rdpsContributed?.[1] ?? 0;
    if (!identityBrandSourceIds.has(skill.id) || identity <= 0) return skill;

    const reduction = Math.round(brand.damage * (identity / brand.identityContributed));
    return { ...skill, rdpsContributed: { ...skill.rdpsContributed, 1: Math.max(0, identity - reduction) } };
  });

  const row = identityBrandRows[className] ?? { name: "Identity Brand", icon: "" };
  adjusted.push({
    id: IDENTITY_BRAND_SKILL_ID,
    name: row.name,
    icon: row.icon,
    totalDamage: 0,
    maxDamage: 0,
    casts: brand.casts,
    hits: 0,
    crits: 0,
    critDamage: 0,
    backAttacks: 0,
    frontAttacks: 0,
    backAttackDamage: 0,
    frontAttackDamage: 0,
    buffedBySupport: 0,
    debuffedBySupport: 0,
    buffedByIdentity: 0,
    buffedByHat: 0,
    dps: 0,
    stagger: 0,
    rdpsReceived: {},
    // Stored as brand (type 3, a boss debuff), which is what it is.
    rdpsContributed: { 3: brand.damage },
    rdpsDamageReceived: 0
  });

  return adjusted;
}

function skillSortValue(skill: Skill, sort: SkillSort): number {
  if (sort === "stagger") return skill.stagger ?? 0;
  if (sort === "buffed") return sumContributed(skill, BUFF_TYPES);
  return skill.totalDamage;
}

function sumContributed(skill: Skill, types: number[]): number {
  const contributed = skill.rdpsContributed;
  if (!contributed) return 0;
  return types.reduce((sum, type) => sum + (contributed[type] ?? 0), 0);
}

/** `sumBdpsReceived` in the meter. */
function sumReceived(skill: Skill, types: number[]): number {
  const received = skill.rdpsReceived;
  if (!received) return 0;
  let sum = 0;
  for (const type of types) {
    for (const amount of Object.values(received[type] ?? {})) sum += amount;
  }
  return sum;
}

function isSpecialSkill(skill: Skill): boolean {
  return !!skill.special || !!skill.isHyperAwakening || hyperAwakeningIds.has(skill.id);
}

function hasUnbuffedDamage(entity: Entity): boolean {
  const { unbuffedDamage, damageDealt } = entity.damageStats;
  return unbuffedDamage > 0 && unbuffedDamage !== damageDealt;
}

/**
 * Total time covered by incapacitation events, merging overlaps and ignoring anything after the
 * last combat packet. Events arrive sorted by start. `computeIncapacitatedTime` in the meter.
 */
function incapacitatedTime(events: IncapacitatedEvent[], end: number): number {
  if (events.length === 0) return 0;

  let total = 0;
  const add = (start: number, stop: number) => (total += Math.max(0, Math.min(stop, end) - Math.min(start, end)));

  let start = events[0]!.timestamp;
  let stop = start + events[0]!.duration;
  for (const event of events.slice(1)) {
    if (event.timestamp > stop) {
      add(start, stop);
      start = event.timestamp;
      stop = event.timestamp + event.duration;
    } else {
      stop = Math.max(stop, event.timestamp + event.duration);
    }
  }
  add(start, stop);
  return total;
}

function perSecond(amount: number, seconds: number): number {
  return seconds > 0 ? amount / seconds : 0;
}

function perMinute(count: number, seconds: number): number {
  return seconds > 0 ? count / (seconds / 60) : 0;
}
