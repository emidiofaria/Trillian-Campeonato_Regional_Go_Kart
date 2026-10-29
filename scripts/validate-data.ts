import { collectSeasonIssues } from '../src/lib/validate';
import { missingPhotos, readRawSeason } from './season-files';

try {
  const { issues, season } = collectSeasonIssues(readRawSeason());
  if (season) issues.push(...missingPhotos(season));
  if (issues.length) {
    console.error(`✖ Dados do campeonato inválidos:\n- ${issues.join('\n- ')}`);
    process.exit(1);
  }
  console.log('✔ Dados do campeonato válidos (pilots, races, results).');
} catch (error) {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
}
