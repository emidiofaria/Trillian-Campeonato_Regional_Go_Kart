import type { Pilot, Race, RaceResult, ResultEntry } from './schemas';

/**
 * How session positions are awarded when a pilot is absent (not defined in docs/rules.md):
 * - 'compact': attendees take the top positions in order (4 attendees => 8/6/4/2).
 * - 'fixed':   the slowest attendee always takes the table's last slot (0 pts),
 *              the others take the table from the top (4 attendees => 8/6/4/0).
 */
export type AbsenceRankingMode = 'compact' | 'fixed';
export const ABSENCE_RANKING_MODE: AbsenceRankingMode = 'compact';

/**
 * Points for 1st..Nth with N registered pilots (docs/rules.md section 5): 2×(N−1), …, 2, 0.
 * Absent = 0. E.g. 5 pilots => [8, 6, 4, 2, 0].
 */
export function positionPoints(pilotCount: number): number[] {
  return Array.from({ length: pilotCount }, (_, i) => 2 * (pilotCount - 1 - i));
}

/** Fastest-lap (VR) bonus: half the winner's points, i.e. N−1 (5 pilots => +4). */
export function fastestLapBonus(pilotCount: number): number {
  return pilotCount - 1;
}

/** Points table for the current pilot list (used by the UI and the CLIs). */
export function currentPointsTable(pilots: readonly unknown[]): {
  positionPoints: number[];
  fastestLapBonus: number;
} {
  return {
    positionPoints: positionPoints(pilots.length),
    fastestLapBonus: fastestLapBonus(pilots.length),
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
  positionPoints: number;
  fastestLap: boolean;
  bonusPoints: number;
  totalPoints: number;
}

export interface SessionResult {
  raceId: string;
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
      bonusPoints: number;
      fastestLap: boolean;
    };

export interface StandingRow {
  /** Championship position (pilots fully tied on all criteria share it). */
  position: number;
  pilotId: string;
  total: number;
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

type Attendee = ResultEntry & { avgLapTime: number; bestLap: number; secondBestLap: number };

function isAttendee(e: ResultEntry): e is Attendee {
  return e.attended && e.avgLapTime !== null && e.bestLap !== null && e.secondBestLap !== null;
}

/** Session order: avg lap asc, then best lap asc, then second-best lap asc (rules section 7). */
export function compareSession(a: Attendee, b: Attendee): number {
  return a.avgLapTime - b.avgLapTime || a.bestLap - b.bestLap || a.secondBestLap - b.secondBestLap;
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
  const bonus = fastestLapBonus(pilotCount);

  const fastestLapTime = attendees.length ? Math.min(...attendees.map((a) => a.bestLap)) : null;
  // Exact ties on the absolute fastest lap: every pilot who set it gets the bonus.
  const fastestLapPilotIds =
    fastestLapTime === null
      ? []
      : attendees.filter((a) => a.bestLap === fastestLapTime).map((a) => a.pilotId);

  const entries: SessionEntry[] = [
    ...attendees.map((a, i) => {
      const positionPoints = pointsFor(table, i, attendees.length, mode);
      const fastestLap = fastestLapPilotIds.includes(a.pilotId);
      const bonusPoints = fastestLap ? bonus : 0;
      return {
        pilotId: a.pilotId,
        attended: true,
        position: i + 1,
        avgLapTime: a.avgLapTime,
        bestLap: a.bestLap,
        secondBestLap: a.secondBestLap,
        positionPoints,
        fastestLap,
        bonusPoints,
        totalPoints: positionPoints + bonusPoints,
      };
    }),
    ...absentees.map((e) => ({
      pilotId: e.pilotId,
      attended: false,
      position: null,
      avgLapTime: null,
      bestLap: null,
      secondBestLap: null,
      positionPoints: 0,
      fastestLap: false,
      bonusPoints: 0,
      totalPoints: 0,
    })),
  ];

  return {
    raceId: result.raceId,
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
        if (entry.position === 1) row.wins += 1;
        if (entry.fastestLap) row.fastestLaps += 1;
        row.perGp.push({
          raceId: race.id,
          state: 'scored',
          position: entry.position,
          points: entry.totalPoints,
          positionPoints: entry.positionPoints,
          bonusPoints: entry.bonusPoints,
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
