import {
  formatActivityTimestamp,
  formatDashboardDate,
  formatDueDate,
  formatReturnedDate
} from './AdminDashboard';

describe('dashboard date formatting', () => {
  test('keeps date-only values on their stored calendar day', () => {
    expect(formatDashboardDate('2026-11-17')).toBe('11/17/2026');
  });

  test('formats an ISO timestamp using the dashboard timezone', () => {
    expect(formatDashboardDate('2026-11-16T18:30:00.000Z')).toBe('11/17/2026');
  });

  test('Recent Activity continues to show the same timestamp date and time', () => {
    expect(formatActivityTimestamp(Date.parse('2026-11-16T18:30:00.000Z')))
      .toBe('11/17/2026, 12:00:00 AM');
  });
});

describe('formatDueDate', () => {
  test.each([null, undefined, '', '   ', 0, '0', '0000-00-00', '2026-02-30', 'not-a-date'])(
    'returns a dash for missing or invalid due date %p',
    (value) => {
      expect(formatDueDate(value)).toBe('-');
    }
  );

  test('formats a valid due date without changing its calendar day', () => {
    expect(formatDueDate('2026-03-05')).toBe('3/5/2026');
  });
});

describe('formatReturnedDate', () => {
  test.each([
    ['2026-11-16T18:30:00.000Z', '11/17/2026'],
    ['2026-11-17T18:30:00.000Z', '11/18/2026'],
    ['2026-11-19T18:30:00.000Z', '11/20/2026'],
    ['2026-11-17', '11/17/2026']
  ])('formats saved return value %s as %s', (value, expected) => {
    expect(formatReturnedDate(value)).toBe(expected);
  });

  test.each([null, undefined, ''])('shows a dash when there is no return date (%p)', (value) => {
    expect(formatReturnedDate(value)).toBe('-');
  });
});
