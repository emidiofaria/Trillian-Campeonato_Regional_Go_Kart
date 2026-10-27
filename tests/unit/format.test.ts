import { describe, expect, it } from 'vitest';
import { countdownLabel, daysUntil, formatDate, formatLap } from '../../src/lib/format';

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

  it('counts calendar days until a date in Lisbon time', () => {
    expect(daysUntil('2026-11-07', new Date('2026-10-27T10:00:00Z'))).toBe(11);
    expect(daysUntil('2026-11-07', new Date('2026-11-06T23:59:00Z'))).toBe(1);
    expect(daysUntil('2026-11-07', new Date('2026-11-07T00:00:00Z'))).toBe(0);
    expect(daysUntil('2026-11-07', new Date('2026-11-08T12:00:00Z'))).toBe(-1);
    // 23:30 UTC on 31 May is already 1 June in Lisbon (summer time, UTC+1).
    expect(daysUntil('2026-06-01', new Date('2026-05-31T23:30:00Z'))).toBe(0);
  });

  it('labels the countdown', () => {
    expect(countdownLabel(11)).toBe('Faltam 11 dias');
    expect(countdownLabel(1)).toBe('É amanhã!');
    expect(countdownLabel(0)).toBe('É hoje!');
    expect(countdownLabel(-1)).toBeNull();
  });
});
