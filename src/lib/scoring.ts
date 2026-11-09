import type { Pilot, Race, RaceResult, ResultEntry } from './schemas';

/**
 * How session positions are awarded when a pilot is absent (applies to both the average-time and
 * the best-lap tables):
 * - 'compact': attendees take the top positions in order (4 of 5 attend => 10/8/6/4).
 * - 'fixed':   the slowest attendee always takes the table's last slot (2 pts),
 *              the others take the table from the top (4 of 5 attend => 10/8/6/2).
 */
export type AbsenceRankingMode = 'compact' | 'fixed';
export const ABSENCE_RANKING_MODE: AbsenceRankingMode = 'compact';

/**
 * Points for 1st..Nth with N registered pilots (docs/rules.md section 5): 2×N, …, 4, 2.
 * Absent = 0. E.g. 6 pilots => [12, 10, 8, 6, 4, 2].
 */
export function positionPoints(pilotCount: number): number[] {
  return Array.from({ length: pilotCount }, (_, i) => 2 * (pilotCount - i));
}

/**
 * Best-lap points for the 1st..Nth best lap of a GP (docs/rules.md section 5): N, …, 2, 1.
 * Absent = 0. E.g. 6 pilots => [6, 5, 4, 3, 2, 1].
 */
export function lapPointsTable(pilotCount: number): number[] {
  return Array.from({ length: pilotCount }, (_, i) => pilotCount - i);
}

/** Points tables for the current pilot list (used by the UI and the CLIs). */
export function currentPointsTable(pilots: readonly unknown[]): {
  positionPoints: number[];
  lapPoints: number[];
} {
  return {
    positionPoints: positionPoints(pilots.length),
    lapPoints: lapPointsTable(pilots.length),
  };
}

/**
 * Number of registered pilots a GP is scored with. Stored on the result so past GPs stay frozen
 * when a pilot joins mid-season; falls back to the number of entries.
 */
export function sessionPilotCount(result: RaceResult): number {
  return result.pilotCount ?? result.entries.length;
}

export interface SessionEntry {
  pilotId: string;
  attended: boolean;
  /** 1-based finishing position among attendees; null when absent. */
  position: number | null;
  avgLapTime: number | null;
  bestLap: number | null;
  secondBestLap: number | null;
  kart: number | null;
  topSpeed: number | null;
  lapStdDev: number | null;
  lapSpread: number | null;
  positionPoints: number;
  /** 1-based rank of the best lap among attendees (equal times share it); null when absent. */
  lapRank: number | null;
  /** Set the GP's absolute fastest lap (lapRank 1). */
  fastestLap: boolean;
  lapPoints: number;
  totalPoints: number;
}

export interface SessionResult {
  raceId: string;
  /** Track session number on the official timesheet, when known. */
  session: string | null;
  /** Attendees by finishing position, then absentees (by pilot order). */
  entries: SessionEntry[];
  winnerId: string | null;
  fastestLapPilotIds: string[];
  fastestLapTime: number | null;
}

export type GpCell =
  | { raceId: string; state: 'not-run' }
  | { raceId: string; state: 'absent'; points: 0 }
  | {
      raceId: string;
      state: 'scored';
      position: number;
      points: number;
      positionPoints: number;
      lapPoints: number;
      lapRank: number;
      fastestLap: boolean;
    };

export interface StandingRow {
  /** Championship position (pilots fully tied on all criteria share it). */
  position: number;
  pilotId: string;
  total: number;
  /** Points from the average-time classification. */
  positionTotal: number;
  /** Points from the best-lap ranking. */
  lapTotal: number;
  wins: number;
  fastestLaps: number;
  absences: number;
  /** One cell per race, in race order. */
  perGp: GpCell[];
}

export interface ChampionshipResult {
  sessions: SessionResult[];
  standings: StandingRow[];
  completedRaces: number;
  /** Pilots in 1st place (more than one only if tied on every criterion). Empty before any GP. */
  leaderIds: string[];
}

type Attendee = ResultEntry & { avgLapTime: number; bestLap: number };

function isAttendee(e: ResultEntry): e is Attendee {
  return e.attended && e.avgLapTime !== null && e.bestLap !== null;
}

/** A missing second-best lap ranks behind any recorded one. */
function compareSecondBest(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Session order: avg lap asc, then best lap asc, then second-best lap asc (rules section 7). */
export function compareSession(a: Attendee, b: Attendee): number {
  return (
    a.avgLapTime - b.avgLapTime ||
    a.bestLap - b.bestLap ||
    compareSecondBest(a.secondBestLap, b.secondBestLap)
  );
}

function pointsFor(
  table: number[],
  index: number,
  attendeeCount: number,
  mode: AbsenceRankingMode,
): number {
  if (mode === 'fixed' && attendeeCount > 1 && index === attendeeCount - 1) {
    return table[table.length - 1];
  }
  return table[index] ?? 0;
}

/**
 * Scores a single GP session. `pilotOrder` (pilot ids) is used only to order absentees and to
 * break exact ties deterministically.
 */
export function scoreSession(
  result: RaceResult,
  pilotOrder: string[] = [],
  mode: AbsenceRankingMode = ABSENCE_RANKING_MODE,
): SessionResult {
  const orderIndex = (id: string) => {
    const i = pilotOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const attendees = result.entries
    .filter(isAttendee)
    .sort((a, b) => compareSession(a, b) || orderIndex(a.pilotId) - orderIndex(b.pilotId));
  const absentees = result.entries
    .filter((e) => !isAttendee(e))
    .sort((a, b) => orderIndex(a.pilotId) - orderIndex(b.pilotId));

  const pilotCount = sessionPilotCount(result);
  const table = positionPoints(pilotCount);
  const lapTable = lapPointsTable(pilotCount);

  const fastestLapTime = attendees.length ? Math.min(...attendees.map((a) => a.bestLap)) : null;
  // Exact ties on the absolute fastest lap: every pilot who set it is credited.
  const fastestLapPilotIds =
    fastestLapTime === null
      ? []
      : attendees.filter((a) => a.bestLap === fastestLapTime).map((a) => a.pilotId);

  const entries: SessionEntry[] = [
    ...attendees.map((a, i) => {
      const positionPoints = pointsFor(table, i, attendees.length, mode);
      // Equal best laps share the higher rank; the next pilot skips (6, 6, 4, …).
      const lapRank = 1 + attendees.filter((o) => o.bestLap < a.bestLap).length;
      const lapPoints = pointsFor(lapTable, lapRank - 1, attendees.length, mode);
      const fastestLap = lapRank === 1;
      return {
        pilotId: a.pilotId,
        attended: true,
        position: i + 1,
        avgLapTime: a.avgLapTime,
        bestLap: a.bestLap,
        secondBestLap: a.secondBestLap,
        kart: a.kart ?? null,
        topSpeed: a.topSpeed ?? null,
        lapStdDev: a.lapStdDev ?? null,
        lapSpread: a.lapSpread ?? null,
        positionPoints,
        lapRank,
        fastestLap,
        lapPoints,
        totalPoints: positionPoints + lapPoints,
      };
    }),
    ...absentees.map((e) => ({
      pilotId: e.pilotId,
      attended: false,
      position: null,
      avgLapTime: null,
      bestLap: null,
      secondBestLap: null,
      kart: null,
      topSpeed: null,
      lapStdDev: null,
      lapSpread: null,
      positionPoints: 0,
      lapRank: null,
      fastestLap: false,
      lapPoints: 0,
      totalPoints: 0,
    })),
  ];

  return {
    raceId: result.raceId,
    session: result.session ?? null,
    entries,
    winnerId: attendees[0]?.pilotId ?? null,
    fastestLapPilotIds,
    fastestLapTime,
  };
}

/** Championship order: total desc, wins desc, fastest laps desc, absences asc (rules section 7). */
export function compareStanding(a: StandingRow, b: StandingRow): number {
  return (
    b.total - a.total || b.wins - a.wins || b.fastestLaps - a.fastestLaps || a.absences - b.absences
  );
}

export function computeChampionship(
  pilots: Pilot[],
  races: Race[],
  results: RaceResult[],
  mode: AbsenceRankingMode = ABSENCE_RANKING_MODE,
): ChampionshipResult {
  const orderedPilots = [...pilots].sort((a, b) => a.number - b.number);
  const pilotOrder = orderedPilots.map((p) => p.id);
  const orderedRaces = [...races].sort((a, b) => a.round - b.round);
  const resultByRace = new Map(results.map((r) => [r.raceId, r]));

  const sessions = orderedRaces
    .filter((r) => resultByRace.has(r.id))
    .map((r) => scoreSession(resultByRace.get(r.id)!, pilotOrder, mode));
  const sessionByRace = new Map(sessions.map((s) => [s.raceId, s]));

  const rows: StandingRow[] = orderedPilots.map((pilot) => {
    const row: StandingRow = {
      position: 0,
      pilotId: pilot.id,
      total: 0,
      positionTotal: 0,
      lapTotal: 0,
      wins: 0,
      fastestLaps: 0,
      absences: 0,
      perGp: [],
    };
    for (const race of orderedRaces) {
      const session = sessionByRace.get(race.id);
      const entry = session?.entries.find((e) => e.pilotId === pilot.id);
      if (!session || !entry) {
        row.perGp.push({ raceId: race.id, state: 'not-run' });
      } else if (!entry.attended || entry.position === null) {
        row.absences += 1;
        row.perGp.push({ raceId: race.id, state: 'absent', points: 0 });
      } else {
        row.total += entry.totalPoints;
        row.positionTotal += entry.positionPoints;
        row.lapTotal += entry.lapPoints;
        if (entry.position === 1) row.wins += 1;
        if (entry.fastestLap) row.fastestLaps += 1;
        row.perGp.push({
          raceId: race.id,
          state: 'scored',
          position: entry.position,
          points: entry.totalPoints,
          positionPoints: entry.positionPoints,
          lapPoints: entry.lapPoints,
          lapRank: entry.lapRank!,
          fastestLap: entry.fastestLap,
        });
      }
    }
    return row;
  });

  // Stable sort keeps pilot-number order for pilots tied on every criterion.
  rows.sort(compareStanding);
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.position = prev && compareStanding(prev, row) === 0 ? prev.position : i + 1;
  });

  return {
    sessions,
    standings: rows,
    completedRaces: sessions.length,
    leaderIds: sessions.length ? rows.filter((r) => r.position === 1).map((r) => r.pilotId) : [],
  };
}

/**
 * Inverted start grid for the next GP (docs/rules.md section 8): the championship order reversed,
 * so the leader starts last. Tied pilots keep the tie-break order (wins, fastest laps, absences,
 * pilot number), so the better-placed one starts further back. Empty before any GP.
 */
export function startGrid(championship: ChampionshipResult): string[] {
  if (!championship.completedRaces) return [];
  return championship.standings.map((r) => r.pilotId).reverse();
}
