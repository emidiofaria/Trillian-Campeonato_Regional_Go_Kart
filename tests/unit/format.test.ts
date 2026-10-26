import { describe, expect, it } from 'vitest';
import { formatDate, formatLap } from '../../src/lib/format';

describe('format', () => {
  it('formats lap times', () => {
    expect(formatLap(52.341)).toBe('52.341');
    expect(formatLap(72.5)).toBe('1:12.500');
    expect(formatLap(60.0451)).toBe('1:00.045');
    expect(formatLap(null)).toBe('—');
  });

  it('formats pt-PT dates', () => {
    expect(formatDate('2026-03-14')).toBe('14 de março de 2026');
    expect(formatDate(undefined)).toBe('');
  });
});
