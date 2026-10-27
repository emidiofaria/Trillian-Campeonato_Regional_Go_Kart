/** 52.341 -> "52.341"; 72.5 -> "1:12.500". */
export function formatLap(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const secs = rest.toFixed(3).padStart(6, '0');
  return minutes > 0 ? `${minutes}:${secs}` : rest.toFixed(3);
}

/** ISO date (YYYY-MM-DD) -> "14 de março de 2026". */
export function formatDate(iso: string | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatPoints(points: number): string {
  return `${points} ${points === 1 ? 'ponto' : 'pontos'}`;
}

const LISBON_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Whole calendar days from `now` (Europe/Lisbon) until the ISO date; negative once passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const [ty, tm, td] = LISBON_DAY.format(now).split('-').map(Number);
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/** "Faltam 12 dias" / "É amanhã!" / "É hoje!"; null once the date has passed. */
export function countdownLabel(days: number): string | null {
  if (days < 0) return null;
  if (days === 0) return 'É hoje!';
  if (days === 1) return 'É amanhã!';
  return `Faltam ${days} dias`;
}
