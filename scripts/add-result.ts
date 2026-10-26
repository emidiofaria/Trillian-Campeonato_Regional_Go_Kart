import * as p from '@clack/prompts';
import { applyResult, parseLapTime } from '../src/lib/results-entry';
import { formatLap } from '../src/lib/format';
import { computeChampionship } from '../src/lib/scoring';
import type { ResultEntry } from '../src/lib/schemas';
import { validateSeason } from '../src/lib/validate';
import { readRawSeason, writeSeason } from './season-files';

function cancelled(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Operação cancelada. Nada foi gravado.');
    process.exit(0);
  }
}

async function askLap(message: string, validate?: (seconds: number) => string | undefined) {
  const value = await p.text({
    message,
    placeholder: '52.341 ou 0:52.341',
    validate: (input) => {
      const seconds = parseLapTime(input ?? '');
      if (seconds === null) return 'Formato inválido. Usa 52.341 ou 0:52.341.';
      return validate?.(seconds);
    },
  });
  cancelled(value);
  return parseLapTime(value as string)!;
}

async function main() {
  p.intro('Kart Cup 2026 · Adicionar resultado de um GP');

  const season = validateSeason(readRawSeason());
  const races = [...season.races].sort((a, b) => a.round - b.round);
  const hasResult = new Set(season.results.map((r) => r.raceId));
  const suggested =
    races.find((r) => r.status === 'next') ?? races.find((r) => !hasResult.has(r.id));

  const raceId = await p.select({
    message: 'Que GP queres registar?',
    initialValue: suggested?.id,
    options: races.map((r) => ({
      value: r.id,
      label: `GP${r.round} · ${r.circuit}`,
      hint: hasResult.has(r.id)
        ? 'já tem resultados (serão substituídos)'
        : r.status === 'next'
          ? 'próximo'
          : undefined,
    })),
  });
  cancelled(raceId);
  const race = races.find((r) => r.id === raceId)!;

  if (hasResult.has(race.id)) {
    const overwrite = await p.confirm({
      message: `O GP${race.round} já tem resultados. Substituir?`,
      initialValue: false,
    });
    cancelled(overwrite);
    if (!overwrite) {
      p.cancel('Nada foi gravado.');
      return;
    }
  }

  const date = await p.text({
    message: 'Data do GP (AAAA-MM-DD, opcional)',
    placeholder: race.date ?? 'deixar vazio',
    defaultValue: race.date ?? '',
    validate: (v) =>
      !v || /^\d{4}-\d{2}-\d{2}$/.test(v) ? undefined : 'Usa o formato AAAA-MM-DD.',
  });
  cancelled(date);

  const timesheetUrl = await p.text({
    message: 'Link da folha de tempos oficial (opcional)',
    placeholder: race.timesheetUrl ?? 'https://…',
    defaultValue: race.timesheetUrl ?? '',
    validate: (v) => {
      if (!v) return undefined;
      try {
        new URL(v);
        return undefined;
      } catch {
        return 'URL inválido.';
      }
    },
  });
  cancelled(timesheetUrl);

  const entries: ResultEntry[] = [];
  for (const pilot of [...season.pilots].sort((a, b) => a.number - b.number)) {
    const attended = await p.confirm({
      message: `${pilot.name} esteve presente?`,
      initialValue: true,
    });
    cancelled(attended);
    if (!attended) {
      entries.push({
        pilotId: pilot.id,
        attended: false,
        avgLapTime: null,
        bestLap: null,
        secondBestLap: null,
      });
      continue;
    }
    const bestLap = await askLap(`${pilot.name} · melhor volta`);
    const secondBestLap = await askLap(`${pilot.name} · 2.ª melhor volta`, (s) =>
      s < bestLap ? `Tem de ser ≥ à melhor volta (${formatLap(bestLap)}).` : undefined,
    );
    const avgLapTime = await askLap(`${pilot.name} · tempo médio`, (s) =>
      s < bestLap ? `Tem de ser ≥ à melhor volta (${formatLap(bestLap)}).` : undefined,
    );
    entries.push({ pilotId: pilot.id, attended: true, avgLapTime, bestLap, secondBestLap });
  }

  let updated;
  try {
    updated = applyResult(season, race.id, entries, {
      date: (date as string) || undefined,
      timesheetUrl: (timesheetUrl as string) || undefined,
    });
  } catch (error) {
    p.cancel((error as Error).message);
    process.exit(1);
  }

  const champ = computeChampionship(updated.pilots, updated.races, updated.results);
  const session = champ.sessions.find((s) => s.raceId === race.id)!;
  const name = (id: string) => updated.pilots.find((x) => x.id === id)!.name;
  p.note(
    session.entries
      .map((e) =>
        e.attended
          ? `${e.position}.º ${name(e.pilotId)} · média ${formatLap(e.avgLapTime)} · ${e.totalPoints} pts${e.fastestLap ? ' (VR)' : ''}`
          : `F  ${name(e.pilotId)} · falta · 0 pts`,
      )
      .join('\n'),
    `Resultado do GP${race.round}`,
  );

  const save = await p.confirm({ message: 'Gravar em src/data?', initialValue: true });
  cancelled(save);
  if (!save) {
    p.cancel('Nada foi gravado.');
    return;
  }
  writeSeason(updated);

  const next = updated.races.find((r) => r.status === 'next');
  p.outro(
    `Gravado. ${next ? `Próximo GP: GP${next.round} · ${next.circuit}. ` : 'Temporada concluída! '}` +
      'Agora: git add src/data && git commit -m "results: GP' +
      race.round +
      '" && git push',
  );
}

main().catch((error) => {
  p.cancel((error as Error).message);
  process.exit(1);
});
