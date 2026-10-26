import { describe, expect, it } from 'vitest';
import pilots from '../../src/data/pilots.json';
import races from '../../src/data/races.json';
import fixture from '../fixtures/season.json';
import {
  ABSENCE_RANKING_MODE,
  computeChampionship,
  scoreSession,
  type AbsenceRankingMode,
} from '../../src/lib/scoring';
import type { Race, RaceResult, ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const ORDER = ['emidio', 'p-queiros', 'joel', 'dinis'];

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

describe('scoreSession', () => {
  it('defaults to compact absence mode', () => {
    expect(ABSENCE_RANKING_MODE).toBe('compact');
  });

  it('normal race: ranks by average lap and awards 8/6/4/0 + VR to the winner', () => {
    const s = scoreSession(
      {
        raceId: 'gp1',
        entries: [
          at('joel', 50.3, 49.9, 50.0),
          at('emidio', 50.1, 49.5, 49.8),
          at('dinis', 51.0, 50.2, 50.4),
          at('p-queiros', 50.2, 49.7, 49.9),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints, e.bonusPoints])).toEqual([
      ['emidio', 1, 8, 4],
      ['p-queiros', 2, 6, 0],
      ['joel', 3, 4, 0],
      ['dinis', 4, 0, 0],
    ]);
    expect(s.winnerId).toBe('emidio');
    expect(s.entries[0].totalPoints).toBe(12);
    expect(s.fastestLapPilotIds).toEqual(['emidio']);
    expect(s.fastestLapTime).toBe(49.5);
  });

  it('fastest-lap bonus goes to a non-winner', () => {
    const pts = pointsOf({
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
      ],
    });
    expect(pts).toEqual({ emidio: 8, 'p-queiros': 10, joel: 4, dinis: 0 });
  });

  it('awards the VR bonus to every pilot sharing the exact fastest lap', () => {
    const s = scoreSession({
      raceId: 'gp1',
      entries: [at('emidio', 50.0, 49.5, 49.7), at('joel', 50.4, 49.5, 49.6)],
    });
    expect(s.fastestLapPilotIds.sort()).toEqual(['emidio', 'joel']);
  });

  const withAbsence: RaceResult = {
    raceId: 'gp2',
    entries: [
      at('emidio', 50.0, 49.6, 49.7),
      absent('p-queiros'),
      at('joel', 50.5, 49.4, 49.9),
      at('dinis', 51.0, 50.1, 50.3),
    ],
  };

  it('absence (compact): attendees take the top positions, absent pilot scores 0', () => {
    const s = scoreSession(withAbsence, ORDER, 'compact');
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints])).toEqual([
      ['emidio', 1, 8],
      ['joel', 2, 6],
      ['dinis', 3, 4],
      ['p-queiros', null, 0],
    ]);
    expect(pointsOf(withAbsence, 'compact')).toEqual({
      emidio: 8,
      joel: 10,
      dinis: 4,
      'p-queiros': 0,
    });
  });

  it('absence (fixed): the slowest attendee keeps the 4th-place 0 points', () => {
    expect(pointsOf(withAbsence, 'fixed')).toEqual({
      emidio: 8,
      joel: 10,
      dinis: 0,
      'p-queiros': 0,
    });
    // Two attendees: 8/0.
    const two: RaceResult = {
      raceId: 'gp2',
      entries: [
        at('emidio', 50, 49, 49.5),
        absent('p-queiros'),
        at('joel', 51, 50, 50.5),
        absent('dinis'),
      ],
    };
    expect(pointsOf(two, 'fixed')).toEqual({ emidio: 12, joel: 0, 'p-queiros': 0, dinis: 0 });
    expect(pointsOf(two, 'compact')).toEqual({ emidio: 12, joel: 6, 'p-queiros': 0, dinis: 0 });
  });

  it('fixed and compact are identical with full attendance', () => {
    const full: RaceResult = {
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
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
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => e.pilotId)).toEqual(['joel', 'p-queiros', 'dinis', 'emidio']);
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
    ]);
    for (const row of c.standings) {
      expect(row.perGp).toHaveLength(7);
      expect(row.perGp.every((cell) => cell.state === 'not-run')).toBe(true);
      expect([row.wins, row.fastestLaps, row.absences]).toEqual([0, 0, 0]);
    }
  });

  it('championship tie-break chain: wins, then fastest laps, then fewer absences', () => {
    // Points are engineered so that each pair is tied on total.
    const results: RaceResult[] = [
      // GP1: emidio 8+4=12, p-queiros 6, joel 4, dinis 0
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          at('p-queiros', 50.5, 49.6, 49.8),
          at('joel', 51.0, 49.7, 49.9),
          at('dinis', 51.5, 49.8, 50.0),
        ],
      },
      // GP2: joel 8, dinis 6+4=10, p-queiros 4, emidio absent
      {
        raceId: 'gp2',
        entries: [
          absent('emidio'),
          at('p-queiros', 51.0, 50.3, 50.5),
          at('joel', 50.0, 49.5, 49.7),
          at('dinis', 50.5, 49.2, 49.9),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.emidio).toMatchObject({ total: 12, wins: 1, fastestLaps: 1, absences: 1 });
    expect(byId.joel).toMatchObject({ total: 12, wins: 1, fastestLaps: 0, absences: 0 });
    expect(byId.dinis).toMatchObject({ total: 10, wins: 0, fastestLaps: 1, absences: 0 });
    expect(byId['p-queiros']).toMatchObject({ total: 10, wins: 0, fastestLaps: 0, absences: 0 });
    // emidio vs joel: tied on points and wins -> more VR wins.
    // dinis vs p-queiros: tied on points, no wins -> more VR wins.
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['joel', 2],
      ['dinis', 3],
      ['p-queiros', 4],
    ]);
    expect(c.leaderIds).toEqual(['emidio']);
    expect(byId.emidio.perGp[1]).toEqual({ raceId: 'gp2', state: 'absent', points: 0 });
    expect(byId.emidio.perGp[2]).toEqual({ raceId: 'gp3', state: 'not-run' });
  });

  it('fewer absences breaks a tie on points, wins and fastest laps', () => {
    const results: RaceResult[] = [
      // GP1: emidio 12 (win+VR), joel 6, dinis 4, p-queiros absent
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          absent('p-queiros'),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
        ],
      },
      // GP2: p-queiros 12 (win+VR), joel 6, dinis 4, emidio 0 (4th, attended)
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 52.0, 50.5, 50.6),
          at('p-queiros', 50.0, 49.0, 49.5),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const top = c.standings
      .slice(0, 2)
      .map((r) => [r.pilotId, r.total, r.wins, r.fastestLaps, r.absences]);
    expect(top).toEqual([
      ['emidio', 12, 1, 1, 0],
      ['p-queiros', 12, 1, 1, 1],
    ]);
    expect(c.standings[1].position).toBe(2);
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
        ],
      },
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 51, 50, 50.5),
          at('p-queiros', 50, 49, 49.5),
          absent('joel'),
          absent('dinis'),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    expect(c.standings.slice(0, 2).map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 18],
      ['p-queiros', 1, 18],
    ]);
    expect(c.leaderIds).toEqual(['emidio', 'p-queiros']);
  });

  it('fixture season computes the expected standings', () => {
    const season = validateSeason({ pilots, races: fixture.races, results: fixture.results });
    const c = computeChampionship(season.pilots, season.races, season.results);
    expect(c.standings.map((r) => [r.pilotId, r.total, r.position])).toEqual([
      ['emidio', 22, 1],
      ['p-queiros', 20, 2],
      ['dinis', 12, 3],
      ['joel', 12, 4],
    ]);
    expect(c.completedRaces).toBe(3);
  });
});
