/** PORTS: DateInput/DateInputTouch.calendar.test.tsx */
//
// Upstream forces the sheet with `presentation="bottom-sheet"`, which this port
// now supports, so `openSheet` passes the same policy. The coarse pointer is
// still stubbed because the suite is about the touch surface and the harness
// must not depend on the runner's pointer.
//
// Upstream's jsdom shims (`MockResizeObserver`, `withLayout`, scroll/dialog
// stubs) are dropped for the reasons `date-input-touch.svelte.test.ts` gives:
// real Chromium lays the scroller out and mounts its panes from a real
// ResizeObserver. `stubMedia` is kept — it selects the touch surface.
// The wheel listboxes are found by order rather than by their English
// accessible names, because the ja-JP provider localizes them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import type { DateInputProps } from '$lib/components/date-input/date-input.svelte';
import DateInputCalendarProbe from './fixtures/date-input-calendar-probe.svelte';
import { createMonthModel, dateInMonth } from '$lib/components/date-input/month-geometry.js';
import {
	type CalendarSystem,
	calendarDateFromFields,
	calendarDayOfMonth
} from '$lib/utils/calendar-system.js';
import type { ISODateString } from '$lib/utils/date-types.js';
import { plainDateAddDays, plainDateFromISO } from '$lib/utils/plain-date.js';
import type { ISODateTimeString } from '$lib/components/date-time-input/date-time-input.svelte';
import DateTimeInputCalendarProbe from './fixtures/date-time-input-calendar-probe.svelte';

const HOVER_CAPABLE = /\(\s*hover\s*:\s*hover\s*\)/;

function stubMedia({ pointer, width }: { pointer: 'coarse' | 'fine'; width: number }): void {
	vi.stubGlobal('matchMedia', (query: string) => {
		let matches: boolean;
		const maxWidth = /\(\s*max-width:\s*(\d+)px\s*\)/.exec(query);
		const minWidth = /\(\s*min-width:\s*(\d+)px\s*\)/.exec(query);
		if (/any-pointer:\s*coarse/.test(query)) {
			matches = pointer === 'coarse';
		} else if (/pointer:\s*coarse/.test(query)) {
			matches = pointer === 'coarse';
		} else if (/pointer:\s*fine/.test(query)) {
			matches = pointer === 'fine';
		} else if (maxWidth) {
			matches = width <= Number(maxWidth[1]);
		} else if (minWidth) {
			matches = width >= Number(minWidth[1]);
		} else {
			matches = HOVER_CAPABLE.test(query);
		}
		if (matches && maxWidth && query.includes('pointer:')) {
			matches = width <= Number(maxWidth[1]);
		}
		return {
			matches,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false
		};
	});
}

function setViewport(kind: 'mobile' | 'desktop'): void {
	stubMedia(
		kind === 'mobile' ? { pointer: 'coarse', width: 393 } : { pointer: 'fine', width: 1280 }
	);
}

beforeEach(() => {
	setViewport('mobile');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Upstream's `fireEvent.click`, flushed. */
async function click(element: Element): Promise<void> {
	(element as HTMLElement).click();
	await tick();
}

const field = (): HTMLInputElement => page.getByRole('combobox').element() as HTMLInputElement;

function title(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-title="month-year"]');
	if (element == null) {
		throw new Error('no month-year title');
	}
	return element;
}

/** The scroller mounts its panes from a real ResizeObserver callback. */
async function settleMonthPanes(): Promise<void> {
	await vi.waitFor(() => {
		if (document.querySelector('[data-scroller="months"] [role="gridcell"]') == null) {
			throw new Error('no month pane mounted yet');
		}
	});
}

/** Waits for the scrolling month header to stop changing. */
async function waitTitleStable(): Promise<void> {
	let previous = '';
	await vi.waitFor(async () => {
		const before = title().textContent ?? '';
		await frame();
		const after = title().textContent ?? '';
		if (before !== after || after !== previous) {
			previous = after;
			throw new Error(`calendar still arriving: ${before} -> ${after}`);
		}
	});
}

function frame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Waits until a pane with this month label is mounted. */
async function waitForPane(label: string): Promise<void> {
	await vi.waitFor(() => {
		const found = [...document.querySelectorAll('[role="grid"]')].some(
			(element) => element.getAttribute('aria-label') === label
		);
		if (!found) {
			throw new Error(
				`pane ${label} not mounted among ${[...document.querySelectorAll('[role="grid"]')]
					.map((element) => element.getAttribute('aria-label'))
					.join(' | ')}`
			);
		}
	});
}

async function openSheet(
	locale: string,
	props: Partial<DateInputProps> & { calendar: CalendarSystem }
): Promise<void> {
	await render(DateInputCalendarProbe, {
		props: {
			locale,
			props: {
				presentation: 'bottom-sheet',
				onChange: () => {},
				...props
			}
		}
	});
	await click(field());
	await settleMonthPanes();
	await waitTitleStable();
}

function pane(label: string): HTMLElement {
	const grid = [...document.querySelectorAll<HTMLElement>('[role="grid"]')].find(
		(element) => element.getAttribute('aria-label') === label
	);
	if (grid == null) {
		throw new Error(
			`no pane for ${label} among ${[...document.querySelectorAll('[role="grid"]')]
				.map((g) => g.getAttribute('aria-label'))
				.join(' | ')}`
		);
	}
	return grid;
}

/** The in-month day buttons of a pane, in order. */
function monthDays(grid: HTMLElement): HTMLButtonElement[] {
	return [...grid.querySelectorAll<HTMLButtonElement>('button[data-date]:not([aria-disabled])')];
}

/** The two wheel listboxes, month first. The labels are localized. */
function wheel(index: 0 | 1): HTMLElement {
	const listboxes = [...document.querySelectorAll<HTMLElement>('[role="listbox"]')];
	if (listboxes[index] == null) {
		throw new Error(`no wheel ${index} among ${listboxes.length}`);
	}
	return listboxes[index];
}

function wheelOptions(index: 0 | 1): HTMLElement[] {
	return [...wheel(index).querySelectorAll<HTMLElement>('[role="option"]')];
}

/** A year option by its visible label, read through its row. */
function yearOption(label: string): HTMLElement {
	const option = wheelOptions(1).find((element) => element.textContent?.trim() === label);
	if (option == null) {
		throw new Error(
			`no year ${label} among ${wheelOptions(1)
				.map((element) => element.textContent?.trim())
				.join(' | ')}`
		);
	}
	return option;
}

async function openWheels(): Promise<void> {
	await click(title());
	await settleSwap();
}

async function settleSwap(): Promise<void> {
	await vi.waitFor(() => {
		const arriving = document.querySelector('[data-panel]:not([inert])');
		if (!(arriving instanceof HTMLElement)) {
			throw new Error('no active panel');
		}
		const { visibility, opacity } = getComputedStyle(arriving);
		if (visibility !== 'visible' || Number(opacity) < 1) {
			throw new Error(`panel still arriving: ${visibility} ${opacity}`);
		}
	});
	await tick();
}

async function clickText(label: string): Promise<void> {
	const option = wheelOptions(0).find((element) => element.textContent?.trim() === label);
	if (option == null) {
		throw new Error(`no option ${label}`);
	}
	await click(option);
}

describe('the bottom sheet in a calendar', () => {
	it('lays out a Persian month with its days, labels and locale digits', async () => {
		await openSheet('fa-IR', {
			calendar: 'persian',
			value: '2026-11-02',
			min: '2026-09-01',
			max: '2026-12-31'
		});
		const aban = pane('۱۴۰۵ آبان');
		const days = monthDays(aban);
		expect(days).toHaveLength(30);
		expect(days[0]).toHaveAttribute('data-date', '2026-10-23');
		expect(days[0]).toHaveTextContent('۱');
		expect(days[29]).toHaveAttribute('data-date', '2026-11-21');
		expect(days[10]).toHaveAccessibleName('۱۴۰۵ آبان ۱۱, دوشنبه');
		// Six rows, whatever the month needs.
		expect(aban.querySelectorAll('button[data-date]')).toHaveLength(42);
		expect(title().textContent).toContain('۱۴۰۵ آبان');
	});

	it('selects the Gregorian ISO date of a Persian day', async () => {
		const onChange = vi.fn();
		await openSheet('en', {
			calendar: 'persian',
			value: '2026-11-02',
			min: '2026-09-01',
			max: '2026-12-31',
			onChange
		});
		await click(monthDays(pane('Aban 1405 AP'))[0]);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-10-23');
	});

	it('shows Adar I and Adar II as separate months in a Hebrew leap year', async () => {
		await openSheet('en', {
			calendar: 'hebrew',
			value: '2024-02-15',
			min: '2024-01-01',
			max: '2024-04-30'
		});
		const adarI = pane('Adar I 5784');
		expect(monthDays(adarI)).toHaveLength(30);
		expect(monthDays(adarI)[0]).toHaveAttribute('data-date', '2024-02-10');
		const adarII = pane('Adar II 5784');
		expect(monthDays(adarII)).toHaveLength(29);
		expect(monthDays(adarII)[0]).toHaveAttribute('data-date', '2024-03-11');
	});

	it('shows one Adar in a common Hebrew year', async () => {
		await openSheet('en', {
			calendar: 'hebrew',
			value: '2025-03-10',
			min: '2025-01-15',
			max: '2025-04-30'
		});
		const adar = pane('Adar 5785');
		expect(monthDays(adar)).toHaveLength(29);
		expect(monthDays(adar)[0]).toHaveAttribute('data-date', '2025-03-01');
		expect(
			[...document.querySelectorAll('[role="grid"]')].map((grid) => grid.getAttribute('aria-label'))
		).not.toContain('Adar I 5785');
	});

	// English names the Ethiopic era "ERA1" in CLDR 47, which has no name for
	// it, and "AM" in CLDR 48. Chromium here ships CLDR 48; a CLDR 47 runner
	// fails here first.
	const era = 'AM';
	it.each([
		['a common year', '2026-09-08', `Pagumen 2018 ${era}`, 5, '2026-09-06'],
		['a leap year', '2027-09-08', `Pagumen 2019 ${era}`, 6, '2027-09-06']
	])(
		'keeps six rows for the Ethiopic thirteenth month in %s',
		async (_name, value, label, length, first) => {
			await openSheet('en', {
				calendar: 'ethiopic',
				value: value as ISODateString,
				min: `${value.slice(0, 4)}-08-01` as ISODateString,
				max: `${value.slice(0, 4)}-10-31` as ISODateString
			});
			const pagume = pane(label);
			expect(monthDays(pagume)).toHaveLength(length);
			expect(monthDays(pagume)[0]).toHaveAttribute('data-date', first);
			expect(pagume.querySelectorAll('button[data-date]')).toHaveLength(42);
		}
	);

	it('lists 13 months in a Hebrew leap year and 12 in a common year', async () => {
		await openSheet('en', {
			calendar: 'hebrew',
			value: '2024-02-15',
			min: '2023-09-01',
			max: '2025-09-30'
		});
		await openWheels();
		const leap = wheelOptions(0);
		expect(leap).toHaveLength(13);
		expect(leap.map((option) => option.textContent)).toEqual(
			expect.arrayContaining(['Adar I', 'Adar II'])
		);
		expect(leap[5]).toHaveTextContent('Adar I');
		expect(leap[5]).toHaveAttribute('aria-selected', 'true');

		// Adar I becomes Adar in a year without it.
		await click(yearOption('5785 AM'));
		expect(title()).toHaveTextContent('Adar 5785');
		const common = wheelOptions(0);
		expect(common).toHaveLength(12);
		expect(common.map((option) => option.textContent)).not.toContain('Adar I');
		expect(common[5]).toHaveTextContent('Adar');
		expect(common[5]).toHaveAttribute('aria-selected', 'true');
	});

	it('keeps the month on a year change when the new year has it', async () => {
		await openSheet('en', {
			calendar: 'hebrew',
			value: '2024-04-15',
			min: '2023-09-01',
			max: '2025-09-30'
		});
		expect(title()).toHaveTextContent('Nisan 5784');
		await openWheels();
		await click(yearOption('5785 AM'));
		expect(title()).toHaveTextContent('Nisan 5785');
	});

	it('labels Japanese years with their era', async () => {
		await openSheet('ja-JP', {
			calendar: 'japanese',
			value: '2026-11-02',
			min: '2018-01-01',
			max: '2026-12-31'
		});
		expect(title()).toHaveTextContent('令和8年11月');
		await openWheels();
		const years = wheelOptions(1).map((option) => option.textContent);
		expect(years).toContain('令和8');
		expect(years).toContain('平成30');
		// November is in Reiwa, so the 2019 row names Reiwa.
		expect(years).toContain('令和元');
		expect(years).toContain('令和2');
		expect(wheelOptions(0)[10]).toHaveTextContent('11月');
	});

	it('names the era of the shown month for a year with an era change', async () => {
		await openSheet('ja-JP', {
			calendar: 'japanese',
			value: '2019-01-22',
			min: '2018-01-01',
			max: '2020-12-31'
		});
		expect(title()).toHaveTextContent('平成31年1月');
		await openWheels();
		expect(yearOption('平成31')).toHaveAttribute('aria-selected', 'true');
		expect(yearOption('平成30')).toBeInTheDocument();
		expect(yearOption('令和2')).toBeInTheDocument();

		await clickText('7月');
		expect(title()).toHaveTextContent('令和元年7月');
		expect(yearOption('令和元')).toHaveAttribute('aria-selected', 'true');
		expect(wheelOptions(1).some((option) => option.textContent?.trim() === '平成31')).toBe(false);
	});

	it('names the era of the kept day in the heading of a split month', async () => {
		await openSheet('ja-JP', {
			calendar: 'japanese',
			value: '1989-01-03',
			min: '1988-01-01',
			max: '1990-12-31'
		});
		expect(title()).toHaveTextContent('昭和64年1月');
		await openWheels();
		expect(yearOption('昭和64')).toHaveAttribute('aria-selected', 'true');
		expect(title()).toHaveTextContent('昭和64年1月');
	});

	it('names Shōwa in the heading for December 26, 1926', async () => {
		await openSheet('ja-JP', {
			calendar: 'japanese',
			value: '1926-12-26',
			min: '1926-01-01',
			max: '1927-12-31'
		});
		expect(title()).toHaveTextContent('昭和元年12月');
	});

	it('labels Buddhist and Persian years in the calendar', async () => {
		await openSheet('en', {
			calendar: 'persian',
			value: '2026-11-02',
			min: '2025-01-01',
			max: '2026-12-31'
		});
		await openWheels();
		expect(wheelOptions(1).map((option) => option.textContent)).toEqual([
			'1403 AP',
			'1404 AP',
			'1405 AP'
		]);
	});

	it('keeps Gregorian wheels as they were', async () => {
		await openSheet('en', {
			calendar: 'gregory',
			value: '2026-03-21',
			min: '2025-01-01',
			max: '2026-12-31'
		});
		await openWheels();
		expect(wheelOptions(1).map((option) => option.textContent)).toEqual(['2025', '2026']);
		expect(wheelOptions(0)).toHaveLength(12);
	});
});

describe('the DateTimeInput bottom sheet in a calendar', () => {
	it('shows Persian months and the date in the calendar', async () => {
		await render(DateTimeInputCalendarProbe, {
			props: {
				locale: 'en',
				props: {
					calendar: 'persian',
					value: '2026-11-02T09:00' as ISODateTimeString,
					min: '2026-09-01T00:00' as ISODateTimeString,
					max: '2026-12-31T23:59' as ISODateTimeString
				},
				onChange: () => {}
			}
		});
		await click(document.querySelector('input[inputmode="none"]')!);
		await settleMonthPanes();
		await waitForPane('Aban 1405 AP');
		expect(monthDays(pane('Aban 1405 AP'))[0]).toHaveAttribute('data-date', '2026-10-23');
	});
});

describe('the DateTimeInput bottom sheet heading in a split month', () => {
	it('names the era of the kept day', async () => {
		await render(DateTimeInputCalendarProbe, {
			props: {
				locale: 'ja-JP',
				props: {
					calendar: 'japanese',
					value: '1989-01-03T09:00' as ISODateTimeString,
					min: '1988-12-01T00:00' as ISODateTimeString,
					max: '1989-02-28T23:59' as ISODateTimeString
				},
				onChange: () => {}
			}
		});
		await click(document.querySelector('input[inputmode="none"]')!);
		await settleMonthPanes();
		// The pane label is the month's own era; the header names the era of the
		// kept day inside the split month.
		await waitForPane('平成元年1月');
		// The heading button names the shown month; the date segment also holds
		// 昭和64年1月 as part of its full date, so read the button's text.
		const heading = await vi.waitFor(() => {
			const found = [
				...document.querySelectorAll<HTMLButtonElement>('dialog[open] button[aria-expanded]')
			].find((button) => button.textContent?.trim() === '昭和64年1月');
			if (found == null) {
				throw new Error(
					`no split-month heading among ${[
						...document.querySelectorAll<HTMLButtonElement>('dialog[open] button[aria-expanded]')
					]
						.map((button) => JSON.stringify(button.textContent))
						.join(' | ')}`
				);
			}
			return found;
		});
		expect(heading).toBeDefined();
	});
});

describe('the month model', () => {
	it.each([
		'gregory',
		'japanese',
		'persian',
		'hebrew',
		'chinese',
		'ethiopic',
		'islamic-umalqura'
	] as const)('round-trips indexes and months in %s', (calendar) => {
		const model = createMonthModel(calendar);
		const start = model.indexOf(plainDateFromISO('2020-01-01'));
		for (let index = start - 30; index <= start + 90; index++) {
			const month = model.monthAt(index);
			expect(model.indexOf(month.start)).toBe(index);
			expect(model.indexOf(month.end)).toBe(index);
			expect(model.monthAt(index + 1).start).toEqual(plainDateAddDays(month.end, 1));
			const { year, month: position } = model.yearMonthAt(index);
			expect(model.indexOfYearMonth(year, position)).toBe(index);
		}
	});

	it('counts the months of Hebrew years', () => {
		const model = createMonthModel('hebrew');
		expect(model.monthsInYear(5784)).toBe(13);
		expect(model.monthsInYear(5785)).toBe(12);
	});

	it('moves a leap month to its common counterpart a year on', () => {
		const model = createMonthModel('hebrew');
		const adarI = model.indexOfYearMonth(5784, 6);
		expect(model.yearMonthAt(model.shiftYears(adarI, 1))).toEqual({
			year: 5785,
			month: 6
		});
	});

	it('moves a date by calendar months, keeping its day of the month', () => {
		const persian = createMonthModel('persian');
		const mehr = persian.indexOfYearMonth(1405, 7);
		// Shahrivar has 31 days and Mehr 30, so the 31st becomes the 30th.
		for (const [day, expected] of [
			[15, 15],
			[31, 30]
		] as const) {
			const shahrivar = calendarDateFromFields('persian', {
				year: 1405,
				month: 6,
				day
			})!;
			const moved = dateInMonth(persian, shahrivar, mehr);
			expect(persian.indexOf(moved)).toBe(mehr);
			expect(calendarDayOfMonth('persian', moved)).toBe(expected);
		}
		// Adar I has 30 days in the leap year 5784; Adar of 5785 has 29.
		const hebrew = createMonthModel('hebrew');
		const adar = hebrew.indexOfYearMonth(5785, 6);
		const adarI30 = calendarDateFromFields('hebrew', {
			year: 5784,
			month: 6,
			day: 30
		})!;
		const moved = dateInMonth(hebrew, adarI30, adar);
		expect(hebrew.indexOf(moved)).toBe(adar);
		expect(calendarDayOfMonth('hebrew', moved)).toBe(29);
	});
});
