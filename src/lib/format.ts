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
