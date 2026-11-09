import { parseLapTime } from './results-entry';
import type { Pilot, ResultEntry } from './schemas';
import { scoreSession, type SessionEntry, type SessionResult } from './scoring';

/** One markdown table: header cells and body rows (cells trimmed, separator row dropped). */
interface MdTable {
  title: string;
  header: string[];
  rows: string[][];
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/** Splits a markdown report into the first table under each `## heading`. */
export function parseMarkdownTables(md: string): MdTable[] {
  const tables: MdTable[] = [];
  let title = '';
  let current: MdTable | null = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      title = heading[1].trim();
      current = null;
      continue;
    }
    if (!line.startsWith('|')) {
      current = null;
      continue;
    }
    const row = cells(line);
    if (!current) {
      current = { title, header: row, rows: [] };
      tables.push(current);
    } else if (!row.every((c) => /^:?-+:?$/.test(c))) {
      current.rows.push(row);
    }
  }
  return tables;
}

export const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Whether a timesheet name refers to a championship pilot. Accent/case-insensitive; matches the
 * full name, a single-word pilot name against any word ("Andre Torres" → "Torres") and an
 * initial + surname ("Pedro Oliveira" → "P. Oliveira").
 */
export function nameMatches(reportName: string, pilotName: string): boolean {
  const r = normalizeName(reportName);
  const p = normalizeName(pilotName);
  if (!r.length || !p.length) return false;
  if (r.join(' ') === p.join(' ')) return true;
  if (p.length === 1) return r.includes(p[0]);
  const surname = p[p.length - 1];
  if (r[r.length - 1] !== surname) return false;
  // Every other word in the pilot name must be the same word or its initial.
  return p.slice(0, -1).every((w, i) => r[i] !== undefined && r[i].startsWith(w));
}

export interface PilotMatch {
  matched: Map<string, string>;
  /** Report names that aren't championship pilots. */
  ignored: string[];
}

/**
 * Maps report names to pilot ids. `overrides` maps a report name to a pilot id or to "ignore".
 * Throws when a name matches more than one pilot or two names match the same pilot.
 */
export function matchPilots(
  names: string[],
  pilots: Pilot[],
  overrides: Record<string, string> = {},
): PilotMatch {
  const matched = new Map<string, string>();
  const ignored: string[] = [];
  const overrideFor = (name: string) =>
    Object.entries(overrides).find(
      ([k]) => normalizeName(k).join(' ') === normalizeName(name).join(' '),
    )?.[1];
  for (const name of names) {
    const override = overrideFor(name);
    if (override === 'ignore') {
      ignored.push(name);
      continue;
    }
    const candidates = override
      ? pilots.filter((p) => p.id === override)
      : pilots.filter((p) => nameMatches(name, p.name));
    if (override && !candidates.length) throw new Error(`--map: piloto desconhecido "${override}"`);
    if (candidates.length > 1)
      throw new Error(
        `"${name}" corresponde a vários pilotos (${candidates.map((p) => p.id).join(', ')}). Usa --map "${name}=<id>".`,
      );
    if (!candidates.length) {
      ignored.push(name);
      continue;
    }
    const id = candidates[0].id;
    const other = [...matched].find(([, v]) => v === id);
    if (other)
      throw new Error(
        `"${other[0]}" e "${name}" correspondem ambos a "${id}". Usa --map para desambiguar.`,
      );
    matched.set(name, id);
  }
  return { matched, ignored };
}

export interface ParsedReport {
  /** Track session number, e.g. "23". */
  session: string | null;
  /** Points per report name as printed in the championship table. */
  reportedPoints: Map<string, number>;
  /** Report names flagged with the fastest lap in the championship table. */
  reportedFastestLap: string[];
  rows: Map<
    string,
    {
      avg?: number;
      best?: number;
      topSpeed?: number;
      stdDev?: number;
      spread?: number;
      kart?: number;
    }
  >;
}

const findTable = (tables: MdTable[], ...keywords: RegExp[]) =>
  tables.find((t) => keywords.some((k) => k.test(t.title)));

const col = (t: MdTable, name: RegExp) => t.header.findIndex((h) => name.test(h));

function num(value: string, what: string): number {
  const n = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`${what}: valor inválido "${value}"`);
  return n;
}

function lap(value: string, what: string): number {
  const s = parseLapTime(value.replace(/\s*s$/, ''));
  if (s === null) throw new Error(`${what}: tempo inválido "${value}"`);
  return s;
}

/**
 * Parses the session report (sections: championship, fastest lap, best mean time, top speed,
 * most consistent pilot). The best mean time and fastest lap tables are required.
 */
export function parseReport(md: string): ParsedReport {
  const tables = parseMarkdownTables(md);
  const champ = findTable(tables, /championship/i, /classifica/i);
  const fastest = findTable(tables, /fastest lap/i, /volta mais r/i);
  const mean = findTable(tables, /mean time/i, /average/i, /m[eé]dia/i);
  const speed = findTable(tables, /top speed/i, /velocidade/i);
  const consistent = findTable(tables, /consistent/i, /consist/i);
  if (!mean) throw new Error('Relatório: falta a tabela "Best mean time".');
  if (!fastest) throw new Error('Relatório: falta a tabela "Fastest lap".');

  const rows: ParsedReport['rows'] = new Map();
  const row = (name: string) => {
    if (!rows.has(name)) rows.set(name, {});
    return rows.get(name)!;
  };
  const pilotCol = (t: MdTable) => {
    const i = col(t, /^pilot|piloto/i);
    if (i < 0) throw new Error(`Relatório [${t.title}]: falta a coluna "Pilot".`);
    return i;
  };

  let session: string | null = null;
  const sessionFrom = (t: MdTable, r: string[]) => {
    const i = col(t, /^session|sess/i);
    const m = i >= 0 ? /(\d+)/.exec(r[i]) : null;
    if (m && !session) session = m[1];
  };

  for (const r of mean.rows) {
    const value = r[col(mean, /avg|m[eé]dia/i)];
    row(r[pilotCol(mean)]).avg = lap(value, `Best mean time [${r[pilotCol(mean)]}]`);
    sessionFrom(mean, r);
  }
  for (const r of fastest.rows) {
    const value = r[col(fastest, /best lap|melhor/i)];
    row(r[pilotCol(fastest)]).best = lap(value, `Fastest lap [${r[pilotCol(fastest)]}]`);
    sessionFrom(fastest, r);
  }
  if (speed) {
    for (const r of speed.rows)
      row(r[pilotCol(speed)]).topSpeed = num(r[col(speed, /speed|veloc/i)], 'Top speed');
  }
  if (consistent) {
    const sd = col(consistent, /std|desvio/i);
    const spread = col(consistent, /spread|amplitude/i);
    for (const r of consistent.rows) {
      const entry = row(r[pilotCol(consistent)]);
      if (sd >= 0) entry.stdDev = num(r[sd], 'Std dev');
      if (spread >= 0) entry.spread = num(r[spread], 'Spread');
    }
  }

  // Optional: any table with a "Kart" column (e.g. the raw session table).
  for (const t of tables) {
    const k = col(t, /^kart$/i);
    if (k < 0 || col(t, /^pilot|piloto/i) < 0) continue;
    for (const r of t.rows) if (/^\d+$/.test(r[k])) row(r[pilotCol(t)]).kart = Number(r[k]);
  }

  const reportedPoints = new Map<string, number>();
  const reportedFastestLap: string[] = [];
  if (champ) {
    const total = col(champ, /^total|pontos/i);
    const fl = col(champ, /^fl$|^vr$/i);
    for (const r of champ.rows) {
      const name = r[pilotCol(champ)];
      if (total >= 0 && r[total] !== '') reportedPoints.set(name, num(r[total], 'Total'));
      if (fl >= 0 && r[fl] !== '' && r[fl] !== '0') reportedFastestLap.push(name);
    }
  }
  return { session, reportedPoints, reportedFastestLap, rows };
}

export interface ImportedGp {
  entries: ResultEntry[];
  session: string | null;
  ignored: string[];
  matched: Map<string, string>;
  scored: SessionResult;
  /** Differences between the report and the rules (average-time order or fastest lap); empty if consistent. */
  mismatches: string[];
}

/**
 * Builds the results of one GP from a report. Registered pilots missing from the report are
 * absent. Points are always computed from the rules; any disagreement is listed in `mismatches`.
 */
export function importReport(
  md: string,
  pilots: Pilot[],
  overrides: Record<string, string> = {},
): ImportedGp {
  const report = parseReport(md);
  const names = [...new Set([...report.rows.keys(), ...report.reportedPoints.keys()])];
  const { matched, ignored } = matchPilots(names, pilots, overrides);
  const nameOf = new Map([...matched].map(([name, id]) => [id, name]));

  const entries: ResultEntry[] = [...pilots]
    .sort((a, b) => a.number - b.number)
    .map((pilot) => {
      const name = nameOf.get(pilot.id);
      const r = name ? report.rows.get(name) : undefined;
      if (!r || r.avg === undefined || r.best === undefined) {
        return {
          pilotId: pilot.id,
          attended: false,
          avgLapTime: null,
          bestLap: null,
          secondBestLap: null,
        };
      }
      const entry: ResultEntry = {
        pilotId: pilot.id,
        attended: true,
        avgLapTime: r.avg,
        bestLap: r.best,
        secondBestLap: null,
      };
      if (r.kart !== undefined) entry.kart = r.kart;
      if (r.topSpeed !== undefined) entry.topSpeed = r.topSpeed;
      if (r.stdDev !== undefined) entry.lapStdDev = r.stdDev;
      if (r.spread !== undefined) entry.lapSpread = r.spread;
      return entry;
    });

  const order = [...pilots].sort((a, b) => a.number - b.number).map((p) => p.id);
  const scored = scoreSession({ raceId: 'import', pilotCount: pilots.length, entries }, order);

  // Only the average-time order is checked: the points are always computed here. Reports in the
  // legacy format add a single fastest-lap bonus (N−1, flagged in the FL column) to the total, so
  // it is removed before ranking; reports whose totals already follow the rules are accepted.
  const legacyBonus = pilots.length - 1;
  const reportedFlNames = new Set(report.reportedFastestLap);
  const mismatches: string[] = [];
  const reportedOf = (e: SessionEntry) => {
    const name = nameOf.get(e.pilotId);
    return name !== undefined ? report.reportedPoints.get(name) : undefined;
  };
  const ranked = scored.entries
    .filter((e) => e.attended && reportedOf(e) !== undefined)
    .map((e) => {
      const name = nameOf.get(e.pilotId)!;
      const reported = reportedOf(e)!;
      return {
        name,
        position: e.position!,
        reported,
        totalPoints: e.totalPoints,
        avgPoints: reported - (reportedFlNames.has(name) ? legacyBonus : 0),
      };
    });
  if (!ranked.every((r) => r.reported === r.totalPoints)) {
    for (const a of ranked)
      for (const b of ranked)
        if (a.avgPoints > b.avgPoints && a.position > b.position)
          mismatches.push(
            `${a.name}: relatório à frente de ${b.name} no tempo médio, regulamento ${a.position}.º vs ${b.position}.º`,
          );
  }
  for (const e of scored.entries) {
    const name = nameOf.get(e.pilotId);
    if (name && !e.attended && reportedOf(e))
      mismatches.push(`${name}: tem pontos no relatório mas falta o tempo médio ou a melhor volta`);
  }
  const reportedFl = report.reportedFastestLap
    .map((n) => matched.get(n))
    .filter((id): id is string => !!id)
    .sort();
  if (
    report.reportedFastestLap.length &&
    reportedFl.join() !== [...scored.fastestLapPilotIds].sort().join()
  )
    mismatches.push(
      `Volta mais rápida: relatório ${reportedFl.join(', ') || '—'}, calculada ${scored.fastestLapPilotIds.join(', ')}`,
    );

  return { entries, session: report.session, ignored, matched, scored, mismatches };
}
