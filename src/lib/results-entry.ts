import { collectSeasonIssues, type Season } from './validate';
import type { Race, RaceResult, ResultEntry } from './schemas';

/**
 * Parses a lap time typed by a human into seconds.
 * Accepts "52.341", "52,341", "0:52.341" and "1:02.5". Returns null if invalid.
 */
export function parseLapTime(input: string): number | null {
  const value = input.trim().replace(',', '.');
  const match = /^(?:(\d{1,2}):)?(\d{1,3}(?:\.\d{1,3})?)$/.exec(value);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  if (match[1] && seconds >= 60) return null;
  const total = Math.round((minutes * 60 + seconds) * 1000) / 1000;
  return total > 0 ? total : null;
}

export interface ResultExtras {
  date?: string;
  timesheetUrl?: string;
}

/**
 * Returns a new season with `entries` stored as the result of `raceId`: the GP becomes
 * 'completed' and the first non-completed GP (by round) becomes 'next'. Existing results for the
 * same GP are replaced. Throws with the validation issues if the outcome is inconsistent.
 */
export function applyResult(
  season: Season,
  raceId: string,
  entries: ResultEntry[],
  extras: ResultExtras = {},
): Season {
  const races: Race[] = season.races.map((r) => {
    if (r.id !== raceId) return { ...r };
    const updated: Race = { ...r, status: 'completed' };
    if (extras.date) updated.date = extras.date;
    if (extras.timesheetUrl) updated.timesheetUrl = extras.timesheetUrl;
    return updated;
  });
  if (!races.some((r) => r.id === raceId)) throw new Error(`GP inexistente: ${raceId}`);

  const upcoming = [...races]
    .filter((r) => r.status !== 'completed')
    .sort((a, b) => a.round - b.round)[0];
  for (const r of races) {
    if (r.status !== 'completed') r.status = r === upcoming ? 'next' : 'scheduled';
  }

  const result: RaceResult = { raceId, pilotCount: season.pilots.length, entries };
  const results = [...season.results.filter((r) => r.raceId !== raceId), result].sort(
    (a, b) =>
      races.find((r) => r.id === a.raceId)!.round - races.find((r) => r.id === b.raceId)!.round,
  );

  const { issues, season: next } = collectSeasonIssues({
    pilots: season.pilots,
    races,
    results,
  });
  if (!next) throw new Error(`Resultado inválido:\n- ${issues.join('\n- ')}`);
  return next;
}
