import { describe, expect, it } from 'vitest';
import pilots from '../fixtures/pilots.json';
import races from '../../src/data/races.json';
import fixture from '../fixtures/season.json';
import {
  ABSENCE_RANKING_MODE,
  computeChampionship,
  lapPointsTable,
  positionPoints,
  scoreSession,
  startGrid,
  type AbsenceRankingMode,
} from '../../src/lib/scoring';
import type { Race, RaceResult, ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const ORDER = ['emidio', 'p-queiros', 'joel', 'dinis', 'torres'];

const at = (pilotId: string, avg: number, best: number, second: number): ResultEntry => ({
  pilotId,
  attended: true,
  avgLapTime: avg,
  bestLap: best,
  secondBestLap: second,
});
const absent = (pilotId: string): ResultEntry => ({
  pilotId,
  attended: false,
  avgLapTime: null,
  bestLap: null,
  secondBestLap: null,
});

const pointsOf = (result: RaceResult, mode?: AbsenceRankingMode) =>
  Object.fromEntries(
    scoreSession(result, ORDER, mode).entries.map((e) => [e.pilotId, e.totalPoints]),
  );

const completedRaces = (n: number): Race[] =>
  (races as Race[]).map((r) => ({ ...r, status: r.round <= n ? 'completed' : 'scheduled' }));

describe('points table derived from the number of pilots', () => {
  it.each([
    [2, [4, 2], [2, 1]],
    [5, [10, 8, 6, 4, 2], [5, 4, 3, 2, 1]],
    [6, [12, 10, 8, 6, 4, 2], [6, 5, 4, 3, 2, 1]],
  ])('%i pilots => average %j, best lap %j', (n, table, laps) => {
    expect(positionPoints(n)).toEqual(table);
    expect(lapPointsTable(n)).toEqual(laps);
  });
});

describe('scoreSession', () => {
  it('defaults to compact absence mode', () => {
    expect(ABSENCE_RANKING_MODE).toBe('compact');
  });

  it('normal race: 10/8/6/4/2 by average lap plus 5/4/3/2/1 by best lap', () => {
    const s = scoreSession(
      {
        raceId: 'gp1',
        entries: [
          at('joel', 50.3, 49.9, 50.0),
          at('emidio', 50.1, 49.5, 49.8),
          at('dinis', 51.0, 50.2, 50.4),
          at('torres', 51.5, 50.5, 50.7),
          at('p-queiros', 50.2, 49.7, 49.9),
        ],
      },
      ORDER,
    );
    expect(
      s.entries.map((e) => [e.pilotId, e.position, e.positionPoints, e.lapRank, e.lapPoints]),
    ).toEqual([
      ['emidio', 1, 10, 1, 5],
      ['p-queiros', 2, 8, 2, 4],
      ['joel', 3, 6, 3, 3],
      ['dinis', 4, 4, 4, 2],
      ['torres', 5, 2, 5, 1],
    ]);
    expect(s.winnerId).toBe('emidio');
    expect(s.entries[0].totalPoints).toBe(15);
    expect(s.fastestLapPilotIds).toEqual(['emidio']);
    expect(s.fastestLapTime).toBe(49.5);
  });

  it('best-lap points rank every pilot independently of the average', () => {
    const pts = pointsOf({
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
        at('torres', 51.6, 50.6, 50.8),
      ],
    });
    // Average 10/8/6/4/2; best laps: p-queiros 5, emidio 4, joel 3, dinis 2, torres 1.
    expect(pts).toEqual({ emidio: 14, 'p-queiros': 13, joel: 9, dinis: 6, torres: 3 });
  });

  it('equal best laps share the higher points and the next pilot skips a place', () => {
    const s = scoreSession({
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.5, 49.7),
        at('joel', 50.4, 49.5, 49.6),
        at('dinis', 50.6, 49.8, 49.9),
      ],
    });
    expect(s.entries.map((e) => [e.pilotId, e.lapRank, e.lapPoints, e.totalPoints])).toEqual([
      ['emidio', 1, 3, 9],
      ['joel', 1, 3, 7],
      ['dinis', 3, 1, 3],
    ]);
    expect(s.fastestLapPilotIds.sort()).toEqual(['emidio', 'joel']);
  });

  const withAbsence: RaceResult = {
    raceId: 'gp2',
    entries: [
      at('emidio', 50.0, 49.6, 49.7),
      absent('p-queiros'),
      at('joel', 50.5, 49.4, 49.9),
      at('dinis', 51.0, 50.1, 50.3),
      at('torres', 51.5, 50.5, 50.7),
    ],
  };

  it('absence (compact): attendees take the top positions, absent pilot scores 0', () => {
    const s = scoreSession(withAbsence, ORDER, 'compact');
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints])).toEqual([
      ['emidio', 1, 10],
      ['joel', 2, 8],
      ['dinis', 3, 6],
      ['torres', 4, 4],
      ['p-queiros', null, 0],
    ]);
    // Best laps among attendees: joel 5, emidio 4, dinis 3, torres 2.
    expect(pointsOf(withAbsence, 'compact')).toEqual({
      emidio: 14,
      joel: 13,
      dinis: 9,
      torres: 6,
      'p-queiros': 0,
    });
  });

  it('absence (fixed): the slowest attendee keeps the last-place points (2 + 1)', () => {
    expect(pointsOf(withAbsence, 'fixed')).toEqual({
      emidio: 14,
      joel: 13,
      dinis: 9,
      torres: 3,
      'p-queiros': 0,
    });
    // Two attendees: 10/2 + 5/1.
    const two: RaceResult = {
      raceId: 'gp2',
      entries: [
        at('emidio', 50, 49, 49.5),
        absent('p-queiros'),
        at('joel', 51, 50, 50.5),
        absent('dinis'),
        absent('torres'),
      ],
    };
    expect(pointsOf(two, 'fixed')).toEqual({
      emidio: 15,
      joel: 3,
      'p-queiros': 0,
      dinis: 0,
      torres: 0,
    });
    expect(pointsOf(two, 'compact')).toEqual({
      emidio: 15,
      joel: 12,
      'p-queiros': 0,
      dinis: 0,
      torres: 0,
    });
  });

  it('fixed and compact are identical with full attendance', () => {
    const full: RaceResult = {
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
        at('torres', 51.6, 50.6, 50.8),
      ],
    };
    expect(pointsOf(full, 'fixed')).toEqual(pointsOf(full, 'compact'));
  });

  it('session tie on average: better best lap, then better second-best lap', () => {
    const s = scoreSession(
      {
        raceId: 'gp3',
        entries: [
          at('emidio', 50.0, 49.5, 49.9),
          at('p-queiros', 50.0, 49.5, 49.7),
          at('joel', 50.0, 49.3, 49.95),
          at('dinis', 50.0, 49.5, 49.8),
          at('torres', 50.0, 49.5, 49.85),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => e.pilotId)).toEqual([
      'joel',
      'p-queiros',
      'dinis',
      'torres',
      'emidio',
    ]);
  });

  it('scores attendees without a second-best lap; it ranks behind a recorded one on a tie', () => {
    const s = scoreSession(
      {
        raceId: 'gp3',
        entries: [
          { ...at('emidio', 50.0, 49.5, 0), secondBestLap: null },
          at('p-queiros', 50.0, 49.5, 49.9),
          { ...at('joel', 51.0, 49.0, 0), secondBestLap: null },
          absent('dinis'),
          absent('torres'),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => [e.pilotId, e.position])).toEqual([
      ['p-queiros', 1],
      ['emidio', 2],
      ['joel', 3],
      ['dinis', null],
      ['torres', null],
    ]);
    expect(s.fastestLapPilotIds).toEqual(['joel']);
  });
});

describe('computeChampionship', () => {
  it('empty season: everyone on zero, no leader, all GPs not run, no crash', () => {
    const c = computeChampionship(pilots, races as Race[], []);
    expect(c.completedRaces).toBe(0);
    expect(c.leaderIds).toEqual([]);
    expect(c.sessions).toEqual([]);
    expect(c.standings.map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 0],
      ['p-queiros', 1, 0],
      ['joel', 1, 0],
      ['dinis', 1, 0],
      ['torres', 1, 0],
    ]);
    for (const row of c.standings) {
      expect(row.perGp).toHaveLength(7);
      expect(row.perGp.every((cell) => cell.state === 'not-run')).toBe(true);
      expect([row.wins, row.fastestLaps, row.absences]).toEqual([0, 0, 0]);
    }
  });

  it('more wins breaks a tie on points, even against more fastest laps', () => {
    // Both GPs: emidio 10+3=13, p-queiros 8+5=13, joel 6+4=10, dinis 4+2=6, torres 2+1=3
    const gp = (raceId: string): RaceResult => ({
      raceId,
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.4),
        at('joel', 51.0, 49.5, 49.9),
        at('dinis', 51.5, 49.9, 50.2),
        at('torres', 52.0, 50.0, 50.3),
      ],
    });
    const c = computeChampionship(pilots, completedRaces(2), [gp('gp1'), gp('gp2')]);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.emidio).toMatchObject({
      total: 26,
      positionTotal: 20,
      lapTotal: 6,
      wins: 2,
      fastestLaps: 0,
    });
    expect(byId['p-queiros']).toMatchObject({ total: 26, wins: 0, fastestLaps: 2 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['p-queiros', 2],
      ['joel', 3],
      ['dinis', 4],
      ['torres', 5],
    ]);
    expect(c.leaderIds).toEqual(['emidio']);
  });

  it('more fastest laps breaks a tie on points and wins', () => {
    // Both GPs: emidio 10+4=14, p-queiros 8+3=11, joel 6+5=11, dinis 4+2=6, torres 2+1=3
    const gp = (raceId: string): RaceResult => ({
      raceId,
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.7, 49.8),
        at('joel', 51.0, 49.2, 50.6),
        at('dinis', 51.5, 49.9, 50.2),
        at('torres', 52.0, 50.0, 50.3),
      ],
    });
    const c = computeChampionship(pilots, completedRaces(2), [gp('gp1'), gp('gp2')]);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.joel).toMatchObject({ total: 22, wins: 0, fastestLaps: 2 });
    expect(byId['p-queiros']).toMatchObject({ total: 22, wins: 0, fastestLaps: 0 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['joel', 2],
      ['p-queiros', 3],
      ['dinis', 4],
      ['torres', 5],
    ]);
    expect(byId.emidio.perGp[2]).toEqual({ raceId: 'gp3', state: 'not-run' });
  });

  it('fewer absences breaks a tie on points, wins and fastest laps', () => {
    const results: RaceResult[] = [
      // GP1 (p-queiros absent): emidio 10+5, joel 8+4, dinis 6+3, torres 4+2
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          absent('p-queiros'),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
          at('torres', 51.5, 49.8, 50.0),
        ],
      },
      // GP2: emidio 10+5, p-queiros 8+4, joel 6+3, torres 4+2, dinis 2+1
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          at('p-queiros', 50.5, 49.6, 49.8),
          at('joel', 51.0, 49.7, 49.9),
          at('torres', 51.5, 49.8, 50.0),
          at('dinis', 52.0, 50.5, 50.6),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const tied = c.standings
      .filter((r) => r.total === 12)
      .map((r) => [r.pilotId, r.position, r.wins, r.fastestLaps, r.absences]);
    expect(tied).toEqual([
      ['dinis', 3, 0, 0, 0],
      ['torres', 3, 0, 0, 0],
      ['p-queiros', 5, 0, 0, 1],
    ]);
    const pq = c.standings.find((r) => r.pilotId === 'p-queiros');
    expect(pq?.perGp[0]).toEqual({ raceId: 'gp1', state: 'absent', points: 0 });
  });

  it('pilots tied on every criterion share the position and the lead', () => {
    const results: RaceResult[] = [
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50, 49, 49.5),
          at('p-queiros', 51, 50, 50.5),
          absent('joel'),
          absent('dinis'),
          absent('torres'),
        ],
      },
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 51, 50, 50.5),
          at('p-queiros', 50, 49, 49.5),
          absent('joel'),
          absent('dinis'),
          absent('torres'),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    expect(c.standings.slice(0, 2).map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 27],
      ['p-queiros', 1, 27],
    ]);
    expect(c.leaderIds).toEqual(['emidio', 'p-queiros']);
  });

  it('fixture season computes the expected standings', () => {
    const season = validateSeason({ pilots, races: fixture.races, results: fixture.results });
    const c = computeChampionship(season.pilots, season.races, season.results);
    expect(c.standings.map((r) => [r.pilotId, r.total, r.position])).toEqual([
      ['emidio', 40, 1],
      ['p-queiros', 33, 2],
      ['dinis', 27, 3],
      ['joel', 20, 4],
      ['torres', 9, 5],
    ]);
    expect(c.completedRaces).toBe(3);
  });

  it('a GP keeps the points table of the pilot count it was run with', () => {
    const gp: RaceResult = {
      raceId: 'gp1',
      pilotCount: 4,
      entries: [
        at('emidio', 50.0, 49.0, 49.5),
        at('p-queiros', 50.5, 49.6, 49.8),
        at('joel', 51.0, 49.7, 49.9),
        at('dinis', 51.5, 49.8, 50.0),
        absent('torres'),
      ],
    };
    expect(pointsOf(gp)).toEqual({ emidio: 12, 'p-queiros': 9, joel: 6, dinis: 3, torres: 0 });
    expect(pointsOf({ ...gp, pilotCount: undefined })).toEqual({
      emidio: 15,
      'p-queiros': 12,
      joel: 9,
      dinis: 6,
      torres: 0,
    });
  });

  it('start grid reverses the standings (leader last, tie-breaks kept), empty before any GP', () => {
    expect(startGrid(computeChampionship(pilots, races as Race[], []))).toEqual([]);
    const season = validateSeason({ pilots, races: fixture.races, results: fixture.results });
    const c = computeChampionship(season.pilots, season.races, season.results);
    expect(startGrid(c)).toEqual(['torres', 'joel', 'dinis', 'p-queiros', 'emidio']);
  });
});
