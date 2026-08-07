import { describe, expect, it } from 'vitest';
import { formatCompactDateTime, formatDateTime } from '../formatUtils';

describe('formatUtils date and time formatting', () => {
  const timestamp = '2026-08-07T06:29:20.286Z';

  it('renders ISO timestamps as readable browser-local date and time values', () => {
    const detailed = formatDateTime(timestamp);
    const compact = formatCompactDateTime(timestamp);

    expect(detailed).not.toBe(timestamp);
    expect(compact).not.toBe(timestamp);
    expect(detailed).toContain('2026');
    expect(compact).toContain('2026');
    expect(detailed).not.toContain('T06:29:20.286Z');
  });

  it('supports contextual fallbacks and preserves invalid source text', () => {
    expect(formatDateTime('', 'No live update yet')).toBe('No live update yet');
    expect(formatCompactDateTime(null, 'Just now')).toBe('Just now');
    expect(formatDateTime('Pending worker clock')).toBe('Pending worker clock');
  });
});