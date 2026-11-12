/** PORTS: internal/calendar-system.test.ts */

import { describe, expect, it } from 'vitest';

/**
 * Astryx's `internal/calendar-system.test.ts`, ported case for case.
 *
 * The suite proves the internal entry re-exports core's own calendar
 * resolution by name and that the public i18n barrel keeps the hook out. This
 * port publishes the same entry at `./internal/calendar-system`; the module is
 * `$lib/internal/calendar-system.ts`, and the public barrel is
 * `$lib/i18n/index.js`.
 */

describe('internal/calendar-system', () => {
	it('re-exports the hook and the helpers that Core date components use, and nothing else', async () => {
		const entry: Record<string, unknown> = await import('$lib/internal/calendar-system.js');
		const hook = await import('$lib/i18n/use-calendar-system.svelte.js');
		const helpers = await import('$lib/utils/calendar-system.js');
		expect(entry.useCalendarSystem).toBe(hook.useCalendarSystem);
		expect(entry.calendarMonthLabelDay).toBe(helpers.calendarMonthLabelDay);
		expect(entry.calendarMonthOf).toBe(helpers.calendarMonthOf);
		expect(entry.formatCalendarDate).toBe(helpers.formatCalendarDate);
		expect(entry.formatCalendarDateToParts).toBe(helpers.formatCalendarDateToParts);
		expect(entry.formatCalendarInstantRange).toBe(helpers.formatCalendarInstantRange);
		expect(Object.keys(entry).sort()).toEqual([
			'calendarMonthLabelDay',
			'calendarMonthOf',
			'formatCalendarDate',
			'formatCalendarDateToParts',
			'formatCalendarInstantRange',
			'useCalendarSystem'
		]);
	});

	it('the public i18n barrel does not export the hook', async () => {
		const pub: Record<string, unknown> = await import('$lib/i18n/index.js');
		expect(pub).not.toHaveProperty('useCalendarSystem');
	});
});
