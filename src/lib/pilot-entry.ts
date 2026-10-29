import { collectSeasonIssues, type Season } from './validate';
import { isAvatarColourAccessible } from './colour';
import type { Pilot, RaceResult } from './schemas';
import { sessionPilotCount } from './scoring';

/** AA-safe avatar colours (dark initials on top), suggested in order when adding a pilot. */
export const SUGGESTED_COLOURS = [
  '#fb7185',
  '#38bdf8',
  '#a78bfa',
  '#fb923c',
  '#34d399',
  '#facc15',
  '#f472b6',
  '#2dd4bf',
  '#a3e635',
  '#e879f9',
  '#60a5fa',
  '#f87171',
] as const;

/** "P. Queirós" -> "p-queiros". */
export function slugifyId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "Torres" -> "TO", "P. Queirós" -> "PQ", "Ana Rita Sousa" -> "AS". */
export function defaultInitials(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function nextNumber(pilots: Pilot[]): number {
  return pilots.reduce((max, p) => Math.max(max, p.number), 0) + 1;
}

/** First suggested colour not used by another pilot. */
export function suggestColour(pilots: Pilot[]): string {
  const used = new Set(pilots.map((p) => p.color.toLowerCase()));
  return SUGGESTED_COLOURS.find((c) => !used.has(c)) ?? SUGGESTED_COLOURS[0];
}

export function normaliseHex(input: string): string | null {
  const v = input.trim().toLowerCase().replace(/^#?/, '#');
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`;
  return null;
}

export interface NewPilotInput {
  name: string;
  color: string;
  initials?: string;
  /** File name in src/assets/pilots/ (already copied there). */
  photo?: string;
}

export interface AddPilotOutcome {
  season: Season;
  pilot: Pilot;
  /** GPs already run in which the new pilot is recorded as absent. */
  absentRaceIds: string[];
}

/** Validates the human input; returns a list of problems (empty if OK). */
export function checkNewPilot(pilots: Pilot[], input: NewPilotInput): string[] {
  const problems: string[] = [];
  const name = input.name.trim();
  const id = slugifyId(name);
  if (!name || !id) problems.push('O nome do piloto é obrigatório.');
  if (pilots.some((p) => p.id === id)) problems.push(`Já existe um piloto com o id "${id}".`);
  if (pilots.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    problems.push(`Já existe um piloto chamado "${name}".`);
  const colour = normaliseHex(input.color);
  if (!colour) problems.push(`Cor inválida: "${input.color}" (usa #rrggbb).`);
  else {
    if (pilots.some((p) => p.color.toLowerCase() === colour))
      problems.push(`A cor ${colour} já é usada por outro piloto.`);
    if (!isAvatarColourAccessible(colour))
      problems.push(`A cor ${colour} é demasiado escura (contraste AA insuficiente).`);
  }
  const initials = (input.initials ?? defaultInitials(name)).trim();
  if (!initials || initials.length > 3) problems.push('As iniciais têm de ter 1 a 3 caracteres.');
  return problems;
}

/**
 * Returns a new season with the pilot appended (next number). Every GP already run is frozen with
 * the pilot count it had (`pilotCount`) and the newcomer is recorded as absent there (0 pts).
 * Throws with all problems if the input or the resulting season is invalid.
 */
export function addPilot(season: Season, input: NewPilotInput): AddPilotOutcome {
  const problems = checkNewPilot(season.pilots, input);
  if (problems.length) throw new Error(`Piloto inválido:\n- ${problems.join('\n- ')}`);

  const name = input.name.trim();
  const pilot: Pilot = {
    id: slugifyId(name),
    name,
    number: nextNumber(season.pilots),
    color: normaliseHex(input.color)!,
    initials: (input.initials ?? defaultInitials(name)).trim().toUpperCase(),
    ...(input.photo ? { photo: input.photo } : {}),
  };

  const results: RaceResult[] = season.results.map((r) => ({
    raceId: r.raceId,
    pilotCount: sessionPilotCount(r),
    entries: [
      ...r.entries,
      { pilotId: pilot.id, attended: false, avgLapTime: null, bestLap: null, secondBestLap: null },
    ],
  }));

  const { issues, season: next } = collectSeasonIssues({
    pilots: [...season.pilots, pilot],
    races: season.races,
    results,
  });
  if (!next) throw new Error(`Piloto inválido:\n- ${issues.join('\n- ')}`);
  return { season: next, pilot, absentRaceIds: results.map((r) => r.raceId) };
}
