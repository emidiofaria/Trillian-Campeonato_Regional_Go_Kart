import { describe, expect, it } from 'vitest';
import pilots from '../fixtures/pilots.json';
import prodPilots from '../../src/data/pilots.json';
import races from '../../src/data/races.json';
import results from '../../src/data/results.json';
import fixture from '../fixtures/season.json';
import { collectSeasonIssues, validateSeason } from '../../src/lib/validate';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('season validation', () => {
  it('production data is valid and contains no results yet', () => {
    expect(() => validateSeason({ pilots: prodPilots, races, results })).not.toThrow();
    expect(results).toEqual([]);
  });

  it('fixture is valid', () => {
    expect(
      collectSeasonIssues({ pilots, races: fixture.races, results: fixture.results }).issues,
    ).toEqual([]);
  });

  it('rejects best lap slower than average', () => {
    const bad = clone(fixture.results);
    bad[0].entries[0].bestLap = 60;
    bad[0].entries[0].secondBestLap = 61;
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    expect(issues.join('\n')).toMatch(/maior que o tempo médio/);
  });

  it('rejects best lap slower than second-best lap', () => {
    const bad = clone(fixture.results);
    bad[0].entries[0].secondBestLap = 50;
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    expect(issues.join('\n')).toMatch(/maior que a 2.ª melhor/);
  });

  it('rejects duplicate pilots and missing attendance', () => {
    const bad = clone(fixture.results);
    bad[0].entries[1].pilotId = 'emidio';
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    expect(issues).toContain('results.json [gp1]: piloto duplicado "emidio"');
    expect(issues).toContain('results.json [gp1]: falta a presença de "p-queiros"');
  });

  it('rejects times for an absent pilot and missing times for an attendee', () => {
    const bad = clone(fixture.results);
    bad[1].entries[2].avgLapTime = 50 as unknown as null;
    bad[0].entries[0].avgLapTime = null as unknown as number;
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    const text = issues.join('\n');
    expect(text).toMatch(/ausente não pode ter tempos/);
    expect(text).toMatch(/presente tem de ter tempo médio/);
  });

  it('rejects results/status mismatches and multiple "next" GPs', () => {
    const badRaces = clone(fixture.races);
    badRaces[0].status = 'scheduled';
    badRaces[4].status = 'next';
    const { issues } = collectSeasonIssues({ pilots, races: badRaces, results: fixture.results });
    expect(issues).toContain(
      'results.json [gp1]: há resultados mas o GP não está marcado como "completed"',
    );
    expect(issues.join('\n')).toMatch(/só pode haver um GP com estado "next"/);
  });

  it('rejects unknown races', () => {
    const bad = clone(fixture.results);
    bad[0].raceId = 'gp9';
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    expect(issues).toContain('results.json [gp9]: GP inexistente');
  });

  it('rejects non-contiguous numbers, duplicate or low-contrast colours, too few pilots', () => {
    const bad = clone(pilots);
    bad[4].number = 7;
    bad[1].color = bad[0].color;
    bad[2].color = '#1e3a8a';
    const { issues } = collectSeasonIssues({ pilots: bad, races, results: [] });
    const text = issues.join('\n');
    expect(text).toMatch(/consecutivos de #1 a #5/);
    expect(text).toMatch(/cor duplicada/);
    expect(text).toMatch(/joel.*contraste/);
    expect(
      collectSeasonIssues({ pilots: pilots.slice(0, 1), races, results: [] }).issues,
    ).not.toEqual([]);
  });

  it('rejects a pilotCount larger than the number of entries', () => {
    const bad = clone(fixture.results) as Array<{ pilotCount?: number }>;
    bad[0].pilotCount = 9;
    const { issues } = collectSeasonIssues({ pilots, races: fixture.races, results: bad });
    expect(issues.join('\n')).toMatch(/pilotCount \(9\) maior/);
  });
});
