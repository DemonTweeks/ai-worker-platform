import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../formatUtils';

describe('formatDateTime', () => {
  it('formats a fixed UTC timestamp in UTC timezone when requested', () => {
    const result = formatDateTime('2026-06-25T15:08:18.000Z', 'en-GB', { timeZone: 'UTC' });
    expect(result).toBe('25 Jun 2026, 15:08');
  });

  it('formats a fixed UTC timestamp in UTC timezone for en-US when requested', () => {
    const result = formatDateTime('2026-06-25T15:08:18.000Z', 'en-US', { timeZone: 'UTC' });
    expect(result).toContain('15:08');
    expect(result).toContain('2026');
  });

  it('returns Not available for null', () => {
    expect(formatDateTime(null)).toBe('Not available');
  });

  it('returns Not available for invalid value', () => {
    expect(formatDateTime('not-a-date')).toBe('Not available');
  });
});
