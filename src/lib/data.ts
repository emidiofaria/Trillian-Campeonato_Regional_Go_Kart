import pilotsJson from '../data/pilots.json';
import racesJson from '../data/races.json';
import resultsJson from '../data/results.json';
import { computeChampionship } from './scoring';
import { validateSeason, type Season } from './validate';

/**
 * Loads and validates the season at build time. Set KARTCUP_FIXTURE=1 to render the site with
 * the test fixture instead of the production data (used only by tests, never deployed).
 */
async function loadRaw(): Promise<{ pilots: unknown; races: unknown; results: unknown }> {
  if (import.meta.env.KARTCUP_FIXTURE === '1' || process.env.KARTCUP_FIXTURE === '1') {
    const fixture = await import('../../tests/fixtures/season.json');
    const { pilots, races, results } = fixture.default;
    return { pilots, races, results };
  }
  return { pilots: pilotsJson, races: racesJson, results: resultsJson };
}

export const season: Season = validateSeason(await loadRaw());
export const championship = computeChampionship(season.pilots, season.races, season.results);

export const pilotById = new Map(season.pilots.map((p) => [p.id, p]));
export const raceById = new Map(season.races.map((r) => [r.id, r]));
export const sortedRaces = [...season.races].sort((a, b) => a.round - b.round);
export const nextRace = sortedRaces.find((r) => r.status === 'next') ?? null;
