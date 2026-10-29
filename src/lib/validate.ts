import { pilotsSchema, racesSchema, resultsSchema } from './schemas';
import type { Pilot, Race, RaceResult } from './schemas';
import { isAvatarColourAccessible } from './colour';

export interface Season {
  pilots: Pilot[];
  races: Race[];
  results: RaceResult[];
}

export class SeasonValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Dados do campeonato inválidos:\n- ${issues.join('\n- ')}`);
    this.name = 'SeasonValidationError';
  }
}

function duplicates<T>(values: T[]): T[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

/** Returns a list of human-readable issues (empty if the season is valid). */
export function collectSeasonIssues(raw: { pilots: unknown; races: unknown; results: unknown }): {
  issues: string[];
  season?: Season;
} {
  const issues: string[] = [];
  const parsed = {
    pilots: pilotsSchema.safeParse(raw.pilots),
    races: racesSchema.safeParse(raw.races),
    results: resultsSchema.safeParse(raw.results),
  };

  for (const [file, res] of Object.entries(parsed)) {
    if (!res.success) {
      for (const issue of res.error.issues) {
        issues.push(`${file}.json [${issue.path.join('.') || 'raiz'}]: ${issue.message}`);
      }
    }
  }
  if (!parsed.pilots.success || !parsed.races.success || !parsed.results.success) {
    return { issues };
  }

  const pilots = parsed.pilots.data;
  const races = parsed.races.data;
  const results = parsed.results.data;

  for (const d of duplicates(pilots.map((p) => p.id)))
    issues.push(`pilots.json: id duplicado "${d}"`);
  for (const d of duplicates(pilots.map((p) => p.number)))
    issues.push(`pilots.json: número duplicado #${d}`);
  const numbers = [...new Set(pilots.map((p) => p.number))].sort((x, y) => x - y);
  if (numbers.some((n, i) => n !== i + 1))
    issues.push(`pilots.json: os números têm de ser consecutivos de #1 a #${pilots.length}`);
  for (const d of duplicates(pilots.map((p) => p.color.toLowerCase())))
    issues.push(`pilots.json: cor duplicada ${d}`);
  for (const p of pilots) {
    if (!isAvatarColourAccessible(p.color))
      issues.push(
        `pilots.json [${p.id}]: cor ${p.color} sem contraste suficiente (AA) com o texto do avatar`,
      );
  }

  for (const d of duplicates(races.map((r) => r.id)))
    issues.push(`races.json: id duplicado "${d}"`);
  for (const d of duplicates(races.map((r) => r.round)))
    issues.push(`races.json: ronda duplicada ${d}`);
  for (const r of races) {
    if (r.id !== `gp${r.round}`)
      issues.push(`races.json: id "${r.id}" não corresponde à ronda ${r.round}`);
  }
  const nextCount = races.filter((r) => r.status === 'next').length;
  if (nextCount > 1)
    issues.push(`races.json: só pode haver um GP com estado "next" (há ${nextCount})`);

  const pilotIds = new Set(pilots.map((p) => p.id));
  const raceById = new Map(races.map((r) => [r.id, r]));

  for (const d of duplicates(results.map((r) => r.raceId)))
    issues.push(`results.json: resultados duplicados para "${d}"`);

  for (const result of results) {
    const where = `results.json [${result.raceId}]`;
    const race = raceById.get(result.raceId);
    if (!race) issues.push(`${where}: GP inexistente`);
    else if (race.status !== 'completed')
      issues.push(`${where}: há resultados mas o GP não está marcado como "completed"`);

    const ids = result.entries.map((e) => e.pilotId);
    for (const d of duplicates(ids)) issues.push(`${where}: piloto duplicado "${d}"`);
    for (const id of ids)
      if (!pilotIds.has(id)) issues.push(`${where}: piloto desconhecido "${id}"`);
    for (const id of pilotIds)
      if (!ids.includes(id)) issues.push(`${where}: falta a presença de "${id}"`);
    if (!result.entries.some((e) => e.attended)) issues.push(`${where}: nenhum piloto presente`);
    if (result.pilotCount !== undefined && result.pilotCount > result.entries.length)
      issues.push(`${where}: pilotCount (${result.pilotCount}) maior que o número de entradas`);
  }

  const withResults = new Set(results.map((r) => r.raceId));
  for (const r of races) {
    if (r.status === 'completed' && !withResults.has(r.id))
      issues.push(`races.json [${r.id}]: marcado como "completed" mas sem resultados`);
  }

  return { issues, season: issues.length ? undefined : { pilots, races, results } };
}

export function validateSeason(raw: { pilots: unknown; races: unknown; results: unknown }): Season {
  const { issues, season } = collectSeasonIssues(raw);
  if (!season) throw new SeasonValidationError(issues);
  return season;
}
