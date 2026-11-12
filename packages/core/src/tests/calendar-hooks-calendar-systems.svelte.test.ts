/** PORTS: Calendar/hooks/calendarHooks.calendarSystems.test.tsx */
//
// Upstream installs `temporal-polyfill/full/global`. This port uses the
// runtime's own `Temporal` in Chromium; the polyfill is not a dependency. The
// without-Temporal cases delete the runtime global for their duration, as
// upstream does.
//
// Upstream's `renderHook` has no Svelte counterpart. The probes under
// `fixtures/` call the hooks and export their results; Svelte writes state
// without `act`, so a navigation is followed with `tick()`.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import CalendarDaysProbe from './fixtures/calendar-days-probe.svelte';
import CalendarNavigationProbe from './fixtures/calendar-navigation-probe.svelte';
import CalendarHooksPairProbe from './fixtures/calendar-hooks-pair-probe.svelte';
import Calendar from '$lib/components/calendar/calendar.svelte';
import { getWeekdayHeaderNames } from '$lib/components/calendar/get-weekday-header-names.js';
import type {
	CalendarDay,
	UseCalendarDaysOptions
} from '$lib/components/calendar/use-calendar-days.svelte.js';
import type { UseCalendarNavigationOptions } from '$lib/components/calendar/use-calendar-navigation.svelte.js';
import type { CalendarSystem } from '$lib/utils/calendar-system.js';
import type { DayOfWeek, ISODateString } from '$lib/utils/date-types.js';
import {
	type PlainDate,
	getDaysInMonth,
	plainDateAddDays,
	plainDateAddMonths,
	plainDateDayOfWeek,
	plainDateFormatStandaloneMonthYear,
	plainDateToISO
} from '$lib/utils/plain-date.js';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';

afterEach(() => {
	__resetDevWarnings();
	vi.restoreAllMocks();
});

// The day grid of the released hook, kept verbatim so that a change to the
// shared code path cannot move the Gregorian output.
function releasedDays(
	year: number,
	month: number,
	weekStartsOn: DayOfWeek,
	hasVariableRowCount: boolean
): CalendarDay[] {
	const totalDaysInMonth = getDaysInMonth(year, month);
	let startingDayOfWeek = plainDateDayOfWeek({ year, month, day: 1 }) - weekStartsOn;
	if (startingDayOfWeek < 0) {
		startingDayOfWeek += 7;
	}
	const totalDays = totalDaysInMonth + startingDayOfWeek;
	const totalRows = hasVariableRowCount ? Math.ceil(totalDays / 7) : 6;
	const firstOfMonth: PlainDate = { year, month, day: 1 };
	const result: CalendarDay[] = [];
	for (let i = 0; i < totalRows * 7; i++) {
		const dayOffset = i - startingDayOfWeek + 1;
		const isOutside = dayOffset < 1 || dayOffset > totalDaysInMonth;
		const pd: PlainDate = isOutside
			? plainDateAddDays(firstOfMonth, dayOffset - 1)
			: { year, month, day: dayOffset };
		result.push({
			date: pd,
			iso: plainDateToISO(pd),
			isOutside,
			dayNumber: pd.day
		});
	}
	return result;
}

function inMonth(days: CalendarDay[]): CalendarDay[] {
	return days.filter((day) => !day.isOutside);
}

const persianProvider = { locale: 'en', calendar: 'persian' as const };

async function renderDays(
	options: UseCalendarDaysOptions,
	provider?: { locale: string; calendar?: CalendarSystem }
) {
	const screen = await render(CalendarDaysProbe, { props: { options, provider } });
	return { screen, grid: screen.component.getGrid() };
}

async function renderNavigation(
	options: UseCalendarNavigationOptions,
	provider?: { locale: string; calendar?: CalendarSystem }
) {
	const screen = await render(CalendarNavigationProbe, { props: { options, provider } });
	return { screen, nav: screen.component.getNavigation() };
}

describe('useCalendarDays without calendar', () => {
	const cases: [string, UseCalendarDaysOptions][] = [
		// May 2026 starts on a Friday, so its 31 days reach a sixth row.
		['a six-row month', { year: 2026, month: 5 }],
		['a 28-day month on weekStartsOn', { year: 2026, month: 2 }],
		['a leap February', { year: 2024, month: 2, weekStartsOn: 1 }],
		['a variable-row month', { year: 2026, month: 2, hasVariableRowCount: true }],
		['a variable-row month with six rows', { year: 2026, month: 8, hasVariableRowCount: true }],
		['a month across a year end', { year: 2025, month: 12, weekStartsOn: 6 }]
	];

	it.each(cases)('matches the released output for %s', async (_name, options) => {
		const { grid } = await renderDays(options);
		const weekStartsOn = options.weekStartsOn ?? 0;
		const expected = releasedDays(
			options.year,
			options.month,
			weekStartsOn,
			options.hasVariableRowCount ?? false
		);
		expect(grid.days).toEqual(expected);
		expect(grid.totalCells).toBe(expected.length);
		expect(grid.weeks.flat()).toEqual(expected);
		expect(grid.dayNames).toEqual(getWeekdayHeaderNames('en', weekStartsOn));
	});

	it('includes the six-row and variable-row shapes', async () => {
		const { grid: fixed } = await renderDays({ year: 2026, month: 8 });
		const { grid: variable } = await renderDays({
			year: 2026,
			month: 2,
			hasVariableRowCount: true
		});
		// August 2026 starts on a Saturday: its 30th and 31st fill the sixth row.
		expect(inMonth(fixed.weeks[5])).toHaveLength(2);
		expect(variable.weeks).toHaveLength(4);
	});

	it('gives the same output with calendar gregory', async () => {
		const options = { year: 2026, month: 5, weekStartsOn: 1 } as const;
		const { grid: plain } = await renderDays(options);
		const { grid: gregory } = await renderDays({ ...options, calendar: 'gregory' });
		expect(gregory.days).toEqual(plain.days);
		expect(gregory.weeks).toEqual(plain.weeks);
		expect(gregory.dayNames).toEqual(plain.dayNames);
		expect(gregory.totalCells).toBe(plain.totalCells);
	});
});

describe('useCalendarDays with calendar', () => {
	it('lays out Aban 1405 in the Persian calendar', async () => {
		const { grid } = await renderDays({ year: 1405, month: 8, calendar: 'persian' });
		const days = inMonth(grid.days);
		expect(days.map((day) => day.dayNumber)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
		expect(days[0]).toEqual({
			date: { year: 2026, month: 10, day: 23 },
			iso: '2026-10-23',
			isOutside: false,
			dayNumber: 1
		});
		expect(days[29].iso).toBe('2026-11-21');
		// 2026-10-23 is a Friday: five Mehr days lead the first row.
		expect(grid.days[0]).toMatchObject({
			iso: '2026-10-18',
			isOutside: true,
			dayNumber: 26
		});
		expect(grid.totalCells).toBe(42);
		expect(grid.dayNames).toEqual(getWeekdayHeaderNames('en', 0));
	});

	it('reads Hebrew leap-year months as Temporal numbers them', async () => {
		const month = async (n: number) =>
			inMonth((await renderDays({ year: 5784, month: n, calendar: 'hebrew' })).grid.days);
		const adarI = await month(6);
		const adarII = await month(7);
		const elul = await month(13);
		expect([adarI[0].iso, adarI.length]).toEqual(['2024-02-10', 30]);
		expect([adarII[0].iso, adarII.length]).toEqual(['2024-03-11', 29]);
		expect([elul[0].iso, elul.length]).toEqual(['2024-09-04', 29]);
		expect(elul.map((day) => day.dayNumber).at(-1)).toBe(29);
	});

	it('reads the year numbers of the Buddhist and Minguo calendars', async () => {
		const buddhist = (await renderDays({ year: 2569, month: 10, calendar: 'buddhist' })).grid;
		const roc = (await renderDays({ year: 115, month: 10, calendar: 'roc' })).grid;
		const expected = releasedDays(2026, 10, 0, false);
		expect(buddhist.days).toEqual(expected);
		expect(roc.days).toEqual(expected);
	});

	it('ignores the provider calendar', async () => {
		const { grid } = await renderDays({ year: 2026, month: 10 }, persianProvider);
		expect(grid.days).toEqual(releasedDays(2026, 10, 0, false));
	});
});

describe('useCalendarNavigation without calendar', () => {
	it.each(['en', 'th-TH', 'fa-IR', 'ca'])(
		'matches the released months and label in %s',
		async (locale) => {
			const options: UseCalendarNavigationOptions = {
				initialValue: '2026-01-15',
				numberOfMonths: 2
			};
			const { nav } = await renderNavigation(options, { locale });
			const first = { year: 2026, month: 1, day: 1 };
			const months = [first, plainDateAddMonths(first, 1)];
			expect(nav.baseMonth).toEqual(first);
			expect(nav.visibleMonths).toEqual(months);
			expect(nav.visibleCalendarMonths).toEqual([
				{ year: 2026, month: 1 },
				{ year: 2026, month: 2 }
			]);
			expect(nav.monthYearLabel).toBe(
				months.map((m) => plainDateFormatStandaloneMonthYear(m, locale)).join(' – ')
			);
		}
	);

	it('ignores the provider calendar', async () => {
		const { nav } = await renderNavigation({ initialValue: '2026-10-30' }, persianProvider);
		expect(nav.baseMonth).toEqual({ year: 2026, month: 10, day: 1 });
		expect(nav.monthYearLabel).toBe('October 2026');
		nav.navigateMonth(1);
		await tick();
		expect(nav.baseMonth).toEqual({ year: 2026, month: 11, day: 1 });
	});
});

describe('useCalendarNavigation with calendar', () => {
	it('steps Persian months and labels them in the calendar', async () => {
		const { nav } = await renderNavigation({
			initialValue: '2026-10-30',
			calendar: 'persian'
		});
		expect(nav.baseMonth).toEqual({ year: 2026, month: 10, day: 23 });
		expect(nav.visibleCalendarMonths).toEqual([{ year: 1405, month: 8 }]);
		expect(nav.monthYearLabel).toBe('Aban 1405 AP');

		nav.navigateMonth(1);
		await tick();
		expect(nav.baseMonth).toEqual({ year: 2026, month: 11, day: 22 });
		expect(nav.visibleCalendarMonths).toEqual([{ year: 1405, month: 9 }]);
		expect(nav.monthYearLabel).toBe('Azar 1405 AP');

		nav.navigateMonth(-9);
		await tick();
		expect(nav.visibleCalendarMonths).toEqual([{ year: 1404, month: 12 }]);
	});

	it('steps through Adar I, Adar II, and the thirteenth month', async () => {
		const { nav } = await renderNavigation({
			initialValue: '2024-02-15',
			calendar: 'hebrew'
		});
		expect(nav.visibleCalendarMonths).toEqual([{ year: 5784, month: 6 }]);
		expect(nav.monthYearLabel).toBe('Adar I 5784');
		nav.navigateMonth(1);
		await tick();
		expect(nav.monthYearLabel).toBe('Adar II 5784');
		nav.navigateMonth(6);
		await tick();
		expect(nav.visibleCalendarMonths).toEqual([{ year: 5784, month: 13 }]);
		expect(nav.baseMonth).toEqual({ year: 2024, month: 9, day: 4 });
	});

	it('reports a controlled month change as the Gregorian first day', async () => {
		const onFocusDateChange = vi.fn();
		const { nav } = await renderNavigation({
			focusDate: '2026-10-30',
			onFocusDateChange,
			calendar: 'persian'
		});
		nav.navigateMonth(-1, '2026-10-24', 7);
		await tick();
		expect(onFocusDateChange).toHaveBeenCalledWith('2026-09-23');
		expect(nav.pendingFocus).toBe('2026-10-17');
	});

	it.each<[CalendarSystem, ISODateString, 1 | 2]>([
		['persian', '2026-10-30', 2],
		['hebrew', '2024-02-15', 2],
		['japanese', '2019-04-30', 1],
		['buddhist', '2026-10-30', 1]
	])('labels %s months as Calendar heads them', async (calendar, iso, n) => {
		const { nav } = await renderNavigation({
			initialValue: iso,
			numberOfMonths: n,
			calendar
		});
		const view = await render(Calendar, {
			props: { calendar, focusDate: iso, numberOfMonths: n }
		});
		await expect.element(view.getByText(nav.monthYearLabel, { exact: true })).toBeInTheDocument();
	});

	it.each<[CalendarSystem, ISODateString]>([
		['persian', '2026-10-30'],
		['hebrew', '2024-08-15'],
		['ethiopic', '2026-09-08'],
		['chinese', '2025-07-01'],
		['roc', '2026-10-30']
	])('feeds visibleCalendarMonths into useCalendarDays in %s', async (calendar, iso) => {
		const screen = await render(CalendarHooksPairProbe, {
			props: { options: { initialValue: iso, numberOfMonths: 2, calendar } }
		});
		const { nav, grids } = screen.component.getPair();
		grids.forEach((grid, i) => {
			const days = inMonth(grid.days);
			expect(days[0].date).toEqual(nav.visibleMonths[i]);
			expect(days[0].dayNumber).toBe(1);
		});
		// The second grid starts the day after the first grid ends.
		expect(plainDateAddDays(inMonth(grids[0].days).at(-1)!.date, 1)).toEqual(nav.visibleMonths[1]);
	});
});

/** Runs `run` with `globalThis.Temporal` deleted, as an app with no polyfill. */
async function withoutTemporal(run: () => Promise<void>): Promise<void> {
	const globals = globalThis as { Temporal?: unknown };
	const saved = globals.Temporal;
	delete globals.Temporal;
	try {
		await run();
	} finally {
		globals.Temporal = saved;
	}
}

describe('the calendar hooks without Temporal', () => {
	it('fall back to Gregorian months and warn once', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await withoutTemporal(async () => {
			const days = (await renderDays({ year: 2026, month: 10, calendar: 'persian' })).grid;
			expect(days.days).toEqual(releasedDays(2026, 10, 0, false));
			const { nav } = await renderNavigation({
				initialValue: '2026-10-30',
				calendar: 'persian'
			});
			expect(nav.monthYearLabel).toBe('October 2026');
			expect(nav.visibleCalendarMonths).toEqual([{ year: 2026, month: 10 }]);
		});
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toContain('needs a Temporal that supports it');
	});

	it('keeps Gregorian-aligned calendars without a warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await withoutTemporal(async () => {
			const { nav } = await renderNavigation({
				initialValue: '2026-10-30',
				calendar: 'buddhist'
			});
			expect(nav.visibleCalendarMonths).toEqual([{ year: 2569, month: 10 }]);
			expect(nav.monthYearLabel).toContain('2569');
		});
		expect(warn).not.toHaveBeenCalled();
	});

	it('constrains a month past the end of the fallback year to its last month', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await withoutTemporal(async () => {
			const past = (await renderDays({ year: 5784, month: 13, calendar: 'hebrew' })).grid;
			expect(past.days).toEqual(releasedDays(5784, 12, 0, false));
			const gregorian = (await renderDays({ year: 2026, month: 13 })).grid;
			expect(gregorian.days).toEqual(releasedDays(2026, 12, 0, false));
		});
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
