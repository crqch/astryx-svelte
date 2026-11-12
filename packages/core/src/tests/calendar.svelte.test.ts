/** PORTS: Calendar/Calendar.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { Locator, LocatorSelectors } from 'vitest/browser';
import { createAttachmentKey } from 'svelte/attachments';
import Calendar from '$lib/components/calendar/calendar.svelte';
import { calendarNavIconAttrs } from '$lib/components/calendar/calendar.stylex.js';
import { weekdayHeaderNamesByLocale } from '$lib/components/calendar/weekday-header-names.generated.js';
import { defineTheme } from '$lib/theme/define-theme.js';
import { generateThemeCss } from '$lib/theme/generate-theme-rules.js';
import type { DateRange, DayOfWeekName, ISODateString } from '$lib/utils/date-types.js';
import { DATE_FORMAT_WITH_WEEKDAY, plainDateFormat } from '$lib/utils/plain-date.js';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';
import { cssIn, forcedColorsCssIn } from './forced-colors.js';
import CalendarI18n from './fixtures/calendar-i18n.svelte';
import CalendarControlledFocus from './fixtures/calendar-controlled-focus.svelte';
import CalendarOwnerAllow from './fixtures/calendar-owner-allow.svelte';
import CalendarOwnerFocusDate from './fixtures/calendar-owner-focus-date.svelte';
import CalendarRefusingOwner from './fixtures/calendar-refusing-owner.svelte';
import CalendarRtl from './fixtures/calendar-rtl-fixture.svelte';

/**
 * Ported case-for-case from Astryx's `Calendar/Calendar.test.tsx` at the 0.7.13
 * pin, in upstream's order and with upstream's titles. Nothing is dropped.
 *
 * Two titles differ deliberately, and neither is a dropped case:
 *
 * - upstream's `uses the provider locale for weekday header names` is spelled
 *   `uses the provider locale for stand-alone short day names` here, because
 *   the later locale cases in the same block are about the short/narrow widths
 *   specifically;
 * - upstream's `wraps both nav chevrons in the navIcon wrapper` is spelled
 *   `wraps both nav chevrons in the RTL-mirroring navIcon wrapper` here, and
 *   says so at the case.
 *
 * `getInitialFocusDate` itself is covered case-for-case by
 * `get-initial-focus-date.test.ts` (the node project — it is a pure function);
 * the six cases in the `opens on a month inside the min/max window` describe
 * below are upstream's own component-level cases over it, not a substitute.
 *
 * ## The 0.7.13 additions this file took with the pin move
 *
 * Provider-locale weekday headers (including the generated CLDR table, the
 * four-character abbreviated-width rule, and the platform fallbacks); provider
 * month labels and their stand-alone capitalization; locale digits for day and
 * week numbers; controlled-null single and range values; the two same-day
 * range commitments; the maxRangeSpan Tab-stop repair; the cleared-range
 * announcement; keyboard month/year paging and the pending-focus rules behind
 * it; and the forced-colors compile check.
 *
 * ## Translations
 *
 * - **`ref` → attachment.** Upstream's "forwards ref to the calendar root
 *   element" has no `ref` here. Its counterpart asserts the element an
 *   attachment passed through rest props receives, which checks more than
 *   upstream's does — it gets the element rather than only proving a callback
 *   ran.
 * - **`handleRef` → instance export.** `CalendarHandle` is not a prop here;
 *   `navigateTo` is an instance export reached through `bind:this`, and
 *   `render(...).component` is that same instance (the `Tokenizer`/`SideNav`
 *   arrangement, driven the way `layer.svelte.test.ts` drives it). The
 *   `handleRef` cases call `screen.component.navigateTo(...)` and are marked
 *   below.
 * - **`act()` disappears.** A `$state` write flushes on its own and
 *   `expect.element`/`expect.poll` retry until it has.
 * - **RTL's `getAllByRole(r)` becomes `screen.getByRole(r).elements()`, and
 *   `within(el)` becomes locator chaining** — the shape `table.svelte.test.ts`
 *   established.
 * - **Inline JSX owners become fixtures.** Upstream's `ControlledFocusCalendar`
 *   and its three refusing/allow-prop owners are small Svelte fixtures:
 *   `calendar-controlled-focus.svelte`, `calendar-refusing-owner.svelte`,
 *   `calendar-owner-allow.svelte`, and `calendar-owner-focus-date.svelte`.
 *   `calendar-i18n.svelte` is the provider wrapper whose `locale` prop
 *   `rerender` swaps (the provider stores a context getter, so the change
 *   propagates); `calendar-rtl-fixture.svelte` is the `<div dir="rtl">` around
 *   the Calendar.
 * - **`document.querySelector` for day buttons becomes `screen.container`.**
 *   Equivalent (RTL renders into `document.body`) and immune to a stray node
 *   from another suite. The live-region queries stay on `document`, because the
 *   region really is appended to `<body>` outside the container.
 * - **`generateThemeTestCSS` becomes `generateThemeCss`**, this port's function
 *   of the same job and shape (as `multi-selector` and `selector` do).
 * - **The clock is pinned** where a case depends on what "today" is. `today` is
 *   resolved once at component init via `plainDateToday()` (upstream does the
 *   same with `useMemo(…, [])`), so a month rollover between render and
 *   assertion would otherwise decide the result. Only `Date` is mocked —
 *   `vi.setSystemTime` without `vi.useFakeTimers()` leaves `setTimeout` and
 *   `queueMicrotask` alone, which is what Svelte schedules on. The expectations
 *   are still computed from `new Date()` exactly as upstream computes them.
 *
 * ## What a real browser forces that jsdom did not
 *
 * None of these changes what is asserted:
 *
 * - **Day lookups build the accessible name instead of hard-coding en-US.**
 *   `plainDateFormat` used to format with `new Intl.DateTimeFormat(undefined,
 *   …)` — the *runtime* default locale — and this Chromium reports en-GB, so
 *   upstream's `/January\s+15,\s+2026/` matched nothing against "Thursday, 15
 *   January 2026". The helper now takes a locale and defaults it to `'en'`, so
 *   upstream's literals would hold; `getDayButton` still keeps upstream's
 *   role+name lookup and computes the name with the component's own formatter,
 *   which additionally survives a provider locale.
 * - **Month-label text queries are scoped to the render container.**
 *   `render()`'s query helpers are bound to `baseElement`, i.e. `document.body`,
 *   which also holds the announce live region — so after a navigation "January
 *   2026" legitimately exists twice and a bare `getByText` is a strict-mode
 *   violation. `monthLabel()` queries inside the calendar, which is the element
 *   upstream means.
 * - **The outside-day click is dispatched directly.** Playwright's
 *   actionability check refuses to click an `aria-disabled="true"` element,
 *   where user-event in jsdom simply fires the click. Dispatching it removes
 *   the browser's guard and leaves only the component's, which is the guard the
 *   case is about.
 * - **The forced-colors scan is scoped to the rendered subtree.** The browser
 *   page carries the package-wide compiled sheet, so upstream's page-wide
 *   substring scan would pass on another component's rule. `forcedColorsCssIn`
 *   / `cssIn` attribute each rule to the classes actually present on the
 *   calendar, which keeps the assertion from becoming vacuous.
 *
 * Two behaviours worth naming because they are upstream's and look wrong:
 *
 * - `numberOfMonths={2}` renders **two** `role="grid"` elements, each with its
 *   own `useGridFocus` and therefore its own roving tab stop. That is upstream's
 *   structure (one `MonthGrid`, one hook), so no case here asserts a single tab
 *   stop across both grids.
 * - The month header reads in the provider locale, defaulted to `'en'`;
 *   "January 2026" is what `'en'` renders, so upstream's literals stand as
 *   written.
 *
 * ## One restatement
 *
 * `omits the marker state for non-today cells`: upstream guards its only
 * assertion behind `if (other)`, so it can pass having checked nothing. The
 * case here asserts the cell exists first. See the comment at the case.
 */

afterEach(() => {
	__resetLiveRegionsForTest();
	// Undoes `vi.setSystemTime` in the two clock-pinned cases; a no-op elsewhere.
	vi.useRealTimers();
});

function politeRegion(): HTMLElement | null {
	return document.querySelector('[data-astryx-live-region="polite"]');
}

/** What `render()` hands back, narrowed to the parts these helpers need. */
interface Screen extends LocatorSelectors {
	container: HTMLElement;
	/** `page.elementLocator(container)` — the container-scoped locator root. */
	locator: Locator;
}

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/**
 * Helper to find a day button by its day number.
 * Day buttons are native <button> elements with aria-labels like
 * "Thursday, January 15, 2026". Each button is the sole child of a
 * role="gridcell" wrapper.
 *
 * Upstream matches that label with `/January\s+15,\s+2026/`; the name is built
 * with the component's own formatter here so the lookup survives a non-en-US
 * default locale (see the file header).
 */
function getDayButton(screen: Screen, day: number, month = 'January', year = 2026): Locator {
	const name = plainDateFormat(
		{ year, month: MONTH_NAMES.indexOf(month) + 1, day },
		DATE_FORMAT_WITH_WEEKDAY
	);
	// Substring, not exact. Upstream matches with `new RegExp(`${month}\\s+${day},
	// \\s+${year}`)`, which is already a substring match, and 0.2.0 relies on
	// that: a selected or in-range day appends a state word (", selected",
	// ", range start") to the name, so an exact match would stop finding exactly
	// the days the selection cases are about. The computed full date stays the
	// needle — day 1's name is not a substring of day 15's, because the weekday
	// prefix differs.
	return screen.getByRole('button', { name, exact: false });
}

/**
 * The same date string `getDayButton` searches by, for the cases that assert on
 * the accessible *name* rather than just finding the button. Upstream writes
 * these out as en-US literals ("Thursday, January 15, 2026, selected"); computing
 * the date half keeps the assertion locale-independent while still pinning the
 * state suffix, which is the part 0.2.0 added.
 */
function dayName(day: number, month = 'January', year = 2026): string {
	return plainDateFormat(
		{ year, month: MONTH_NAMES.indexOf(month) + 1, day },
		DATE_FORMAT_WITH_WEEKDAY
	);
}

function getButton(screen: Screen, name: string): Locator {
	return screen.getByRole('button', { name, exact: true });
}

/**
 * The selected gridcells, the shape upstream asks of
 * `queryAllByRole('gridcell', {selected: true})`. Queried by attribute because
 * Playwright's role `selected` filter is not exposed by the browser locator.
 */
function selectedCells(screen: Screen): HTMLElement[] {
	return Array.from(screen.container.querySelectorAll('[role="gridcell"][aria-selected="true"]'));
}

/**
 * Text inside the calendar itself. Upstream's `screen.getByText`, minus the
 * announce live region that shares `document.body` with the render container.
 */
function monthLabel(screen: Screen, text: string | RegExp): Locator {
	return screen.locator.getByText(text);
}

describe('Calendar', () => {
	it("with week numbers, the header row's corner cell is a named columnheader, so every row child is a grid cell", async () => {
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', hasWeekNumbers: true }
		});
		const grid = screen.getByRole('grid').element();
		const stray = grid.querySelectorAll(
			'[role="row"] > :not([role="gridcell"]):not([role="columnheader"]):not([role="rowheader"])'
		);
		expect(stray).toHaveLength(0);
		// Named from CLDR ("week" in en-US), as visually hidden text.
		await expect
			.element(screen.getByRole('grid').getByRole('columnheader', { name: 'week', exact: true }))
			.toBeInTheDocument();
		expect(screen.getByRole('grid').getByRole('rowheader').elements().length).toBeGreaterThan(0);
	});

	// ─── Basic Rendering ─────────────────────────────────────────

	// Counterpart for upstream's "forwards ref to the calendar root element".
	// There is no `ref` prop here; an attachment through the rest props is how a
	// consumer reaches the root, and it receives the element itself.
	it('forwards ref to the calendar root element', async () => {
		const attached = vi.fn();
		const screen = await render(Calendar, {
			props: { [createAttachmentKey()]: attached }
		});

		expect(attached).toHaveBeenCalledOnce();
		const root = attached.mock.calls[0][0];
		expect(root).toBeInstanceOf(HTMLDivElement);
		expect(root).toBe(screen.container.firstElementChild);
	});

	// Counterpart: `handleRef` has no prop here. `navigateTo` is an instance
	// export, and `render(...).component` is the instance `bind:this` would give.
	it('exposes navigation through handleRef', async () => {
		const screen = await render(Calendar);

		screen.component.navigateTo('2026-03-01');

		await expect.element(monthLabel(screen, 'March 2026')).toBeInTheDocument();
	});

	it('renders current month by default', async () => {
		// Clock pinned: `today` is captured at component init, so a rollover
		// between init and the assertion would decide the result.
		vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
		const screen = await render(Calendar);

		const today = new Date();
		const formatter = new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'long'
		});
		const expectedLabel = formatter.format(today);

		await expect.element(monthLabel(screen, expectedLabel)).toBeInTheDocument();
	});

	it("marks today's cell with aria-current='date'", async () => {
		vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
		const screen = await render(Calendar);

		const now = new Date();
		const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		const todayCell = screen.container.querySelector(`button[data-date="${iso}"]`);
		expect(todayCell).not.toBeNull();
		expect(todayCell).toHaveAttribute('aria-current', 'date');

		// Only today's cell is marked current.
		const others = Array.from(screen.container.querySelectorAll('button[data-date]')).filter(
			(el) => el.getAttribute('data-date') !== iso
		);
		expect(others.length).toBeGreaterThan(0);
		others.forEach((el) => expect(el).not.toHaveAttribute('aria-current'));
	});

	it('displays day names', async () => {
		const screen = await render(Calendar);

		await expect.element(monthLabel(screen, 'Su')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'Mo')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'Tu')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'We')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'Th')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'Fr')).toBeInTheDocument();
		await expect.element(monthLabel(screen, 'Sa')).toBeInTheDocument();
	});

	it('uses the provider locale for stand-alone short day names', async () => {
		const localizedNames = weekdayHeaderNamesByLocale.es;
		const englishNames = weekdayHeaderNamesByLocale.en;
		expect(localizedNames).not.toEqual(englishNames);

		// Upstream re-renders a whole `<Provider locale><Calendar /></Provider>`
		// tree; `rerender` here swaps the fixture's `locale` prop, which the
		// provider's context *getter* republishes — the same observable change.
		const screen = await render(CalendarI18n, { props: { locale: 'es-ES' } });

		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual(localizedNames);

		await screen.rerender({ locale: 'en' });
		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual(englishNames);
	});

	it('rotates localized day names by numeric weekday index', async () => {
		const localizedNames = weekdayHeaderNamesByLocale.es;

		const screen = await render(CalendarI18n, {
			props: { locale: 'es-ES', calendar: { weekStartsOn: 1 } }
		});

		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual([...localizedNames.slice(1), localizedNames[0]]);
	});

	it('shows abbreviated weekday names in a locale where all seven fit in four characters', async () => {
		const screen = await render(CalendarI18n, { props: { locale: 'fr-FR' } });

		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual(['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']);
	});

	it.each([
		['pt-PT', ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']],
		['pl-PL', ['nie', 'pon', 'wto', 'śro', 'czw', 'pią', 'sob']]
	])(
		'keeps short weekday names in %s, where an abbreviated name runs past four characters',
		async (locale, shortNames) => {
			const screen = await render(CalendarI18n, { props: { locale } });

			expect(
				screen
					.getByRole('columnheader')
					.elements()
					.map((el) => el.textContent)
			).toEqual(shortNames);
		}
	);

	it('shows the platform abbreviated names for a locale with no shipped weekday data', async () => {
		const screen = await render(CalendarI18n, { props: { locale: 'id-ID' } });

		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual(['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']);
	});

	it('shows the platform narrow names for an unshipped locale whose abbreviated names run past four characters', async () => {
		const screen = await render(CalendarI18n, { props: { locale: 'sw-KE' } });

		expect(
			screen
				.getByRole('columnheader')
				.elements()
				.map((el) => el.textContent)
		).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
	});

	it('updates the month header and subsequent navigation with provider locale', async () => {
		const renderCalendar = (locale: 'en-US' | 'es-ES') => ({
			locale,
			calendar: { focusDate: '2026-01-01' as ISODateString }
		});
		const screen = await render(CalendarI18n, { props: renderCalendar('en-US') });

		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();

		await screen.rerender(renderCalendar('es-ES'));
		await expect.element(monthLabel(screen, 'Enero de 2026')).toBeInTheDocument();

		const nextButton = screen.container.querySelector<HTMLButtonElement>('[data-nav="next"]');
		expect(nextButton).not.toBeNull();
		await userEvent.click(nextButton!);
		await expect.element(monthLabel(screen, 'Febrero de 2026')).toBeInTheDocument();
	});

	it.each([
		['es-ES', 'Octubre de 2026', 'Noviembre de 2026'],
		['fr-FR', 'Octobre 2026', 'Novembre 2026'],
		['pl-PL', 'Październik 2026', 'Listopad 2026'],
		['ru-RU', 'Октябрь 2026 г.', 'Ноябрь 2026 г.']
	])(
		'starts each stand-alone month label with a capital in %s',
		async (locale, october, november) => {
			const screen = await render(CalendarI18n, {
				props: {
					locale,
					calendar: { mode: 'range', numberOfMonths: 2, focusDate: '2026-10-01' }
				}
			});
			// The heading names both months, each capitalized (FR1).
			await expect.element(monthLabel(screen, `${october} – ${november}`)).toBeInTheDocument();
			// Each grid's name is the same stand-alone label.
			expect(
				screen
					.getByRole('grid')
					.elements()
					.map((grid) => grid.getAttribute('aria-label'))
			).toEqual([october, november]);
		}
	);

	it.each([
		['fa-IR', '۱۵', '۴۲'],
		['ar-EG', '١٥', '٤٢'],
		['en', '15', '42']
	])('shows day and week numbers in the locale digits in %s', async (locale, day15, week42) => {
		const screen = await render(CalendarI18n, {
			props: { locale, calendar: { focusDate: '2026-10-01', hasWeekNumbers: true } }
		});
		const october15 = screen.container.querySelector('button[data-date="2026-10-15"]');
		expect(october15).toHaveTextContent(new RegExp(`^${day15}$`));
		// October 15, 2026 is in ISO week 42.
		const weekHeaders = screen
			.getByRole('rowheader')
			.elements()
			.map((header) => header.textContent);
		expect(weekHeaders).toContain(week42);
	});

	it.each([
		['vi-VN', 'tháng 10 năm 2026'],
		['de-DE', 'Oktober 2026'],
		['en-US', 'October 2026']
	])(
		'leaves the month label as Intl gives it where CLDR does not capitalize in %s',
		async (locale, label) => {
			const screen = await render(CalendarI18n, {
				props: { locale, calendar: { focusDate: '2026-10-01' } }
			});
			await expect.element(monthLabel(screen, label)).toBeInTheDocument();
		}
	);

	it('displays correct number of day cells', async () => {
		const screen = await render(Calendar);

		// 6 rows * 7 days = 42 cells (default fixed row count)
		const buttons = screen.getByRole('gridcell').elements();
		expect(buttons.length).toBe(42);
	});

	// ─── Selection ───────────────────────────────────────────────

	it('highlights selected date', async () => {
		const screen = await render(Calendar, {
			props: { value: '2026-01-15', focusDate: '2026-01-01' }
		});

		const day15 = getDayButton(screen, 15).element();
		// In an ARIA grid, selection state lives on the gridcell, not the button
		// (a plain button role does not permit aria-selected).
		const gridcell15 = day15.closest('[role="gridcell"]');
		expect(gridcell15).toHaveAttribute('aria-selected', 'true');
		expect(day15).not.toHaveAttribute('aria-selected');
	});

	it('calls onChange when date is selected', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { onChange: handleChange, focusDate: '2026-01-01' }
		});

		const day15 = getDayButton(screen, 15);
		await userEvent.click(day15);

		expect(handleChange).toHaveBeenCalledTimes(1);
		expect(handleChange).toHaveBeenCalledWith('2026-01-15', expect.any(Date));
	});

	it('shows years 1-99 as themselves, not as 1900-1999', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { value: '0001-01-15', onChange: handleChange, focusDate: '0001-01-01' }
		});

		await expect
			.element(screen.getByRole('grid', { name: 'January 1', exact: true }))
			.toBeInTheDocument();
		const day15 = getDayButton(screen, 15, 'January', 1);
		await expect.element(day15).toHaveAccessibleName(/^Monday, January 15, 1\b/);
		expect(day15.element().closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');

		await userEvent.click(getDayButton(screen, 20, 'January', 1));
		expect(handleChange).toHaveBeenCalledWith('0001-01-20', expect.any(Date));
		expect(handleChange.mock.calls[0][1].getFullYear()).toBe(1);
	});

	it('keeps null single selection empty until the parent accepts a date', async () => {
		const onChange = vi.fn();
		const calendar = (value: ISODateString | null) => ({
			value,
			onChange,
			defaultValue: '2026-01-10' as ISODateString,
			focusDate: '2026-01-01' as ISODateString
		});
		const screen = await render(Calendar, { props: calendar(null) });
		expect(selectedCells(screen)).toHaveLength(0);

		const day15 = getDayButton(screen, 15);
		await userEvent.click(day15);
		expect(onChange).toHaveBeenCalledWith('2026-01-15', expect.any(Date));
		expect(selectedCells(screen)).toHaveLength(0);

		await screen.rerender(calendar('2026-01-15'));
		expect(selectedCells(screen)).toHaveLength(1);
		expect(selectedCells(screen)[0]).toContainElement(day15.element());

		await screen.rerender(calendar(null));
		expect(selectedCells(screen)).toHaveLength(0);
	});

	it('keeps null range selection controlled while allowing two-click selection', async () => {
		const onChange = vi.fn();
		const calendar = (value: DateRange | null) => ({
			mode: 'range' as const,
			value,
			onChange,
			defaultValue: { start: '2026-01-10', end: '2026-01-12' } as DateRange,
			focusDate: '2026-01-01' as ISODateString
		});
		const screen = await render(Calendar, { props: calendar(null) });
		expect(selectedCells(screen)).toHaveLength(0);

		await userEvent.click(getDayButton(screen, 15));
		await userEvent.click(getDayButton(screen, 17));
		expect(onChange).toHaveBeenCalledWith({
			start: '2026-01-15',
			end: '2026-01-17'
		});
		expect(selectedCells(screen)).toHaveLength(0);

		await screen.rerender(calendar({ start: '2026-01-15', end: '2026-01-17' }));
		expect(selectedCells(screen)).toHaveLength(3);

		await screen.rerender(calendar(null));
		expect(selectedCells(screen)).toHaveLength(0);
	});

	// ─── Navigation ──────────────────────────────────────────────

	it('navigates to previous month', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-02-01' } });

		// Verify we start on February
		await expect.element(monthLabel(screen, 'February 2026')).toBeInTheDocument();

		const prevButton = getButton(screen, 'Previous month');
		await userEvent.click(prevButton);

		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();
	});

	it('navigates to next month', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		// Verify we start on January
		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();

		const nextButton = getButton(screen, 'Next month');
		await userEvent.click(nextButton);

		await expect.element(monthLabel(screen, 'February 2026')).toBeInTheDocument();
	});

	it('still moves the visible month when only onFocusDateChange is given', async () => {
		const handleFocusChange = vi.fn();

		// A listener alone does not make the focus date controlled (that needs
		// focusDate too), so the calendar must keep moving on its own.
		const screen = await render(Calendar, {
			props: { defaultValue: '2026-01-15', onFocusDateChange: handleFocusChange }
		});
		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();

		await userEvent.click(getButton(screen, 'Next month'));

		expect(handleFocusChange).toHaveBeenCalledWith('2026-02-01');
		await expect.element(monthLabel(screen, 'February 2026')).toBeInTheDocument();

		// Crossing a month with the keyboard takes the same path.
		const jan31 = screen.getByRole('button', { name: /January 31/ }).elements();
		expect(jan31).toHaveLength(0);
		const feb28 = screen.getByRole('button', { name: /February 28/ });
		feb28.element().focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(handleFocusChange).toHaveBeenLastCalledWith('2026-03-01');
		await expect.element(monthLabel(screen, 'March 2026')).toBeInTheDocument();
	});

	it('calls onFocusDateChange when navigating', async () => {
		const handleFocusChange = vi.fn();

		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', onFocusDateChange: handleFocusChange }
		});

		const nextButton = getButton(screen, 'Next month');
		await userEvent.click(nextButton);

		expect(handleFocusChange).toHaveBeenCalledWith('2026-02-01');
	});

	// ─── Date Constraints ────────────────────────────────────────

	it('respects min date constraint', async () => {
		const onChange = vi.fn();
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', min: '2026-01-10', onChange }
		});

		// Day 5 should be disabled (before min)
		const day5 = getDayButton(screen, 5);
		await expect.element(day5).toBeDisabled();
		// spec:AST-085 FR1: focusable through aria-disabled, not natively disabled;
		// a click still selects nothing.
		expect(day5.element()).not.toHaveAttribute('disabled');
		day5.element().focus();
		expect(day5.element()).toHaveFocus();
		(day5.element() as HTMLElement).click();
		expect(onChange).not.toHaveBeenCalled();

		// Day 15 should be enabled (after min)
		const day15 = getDayButton(screen, 15);
		await expect.element(day15).not.toBeDisabled();
	});

	it('respects max date constraint', async () => {
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', max: '2026-01-20' }
		});

		const day25 = getDayButton(screen, 25);
		await expect.element(day25).toBeDisabled();

		const day15 = getDayButton(screen, 15);
		await expect.element(day15).not.toBeDisabled();
	});

	describe('opens on a month inside the min/max window', () => {
		// Upstream opens the clock with `vi.useFakeTimers({toFake: ['Date']})`;
		// this file mocks `Date` alone through a bare `setSystemTime` (see the
		// header) and the file-level `afterEach` already restores it.
		beforeEach(() => {
			vi.setSystemTime(new Date(2026, 7, 21, 12, 0, 0));
		});

		it('opens on today when today is inside the window', async () => {
			const screen = await render(Calendar, {
				props: { min: '2026-01-01', max: '2026-12-31' }
			});

			await expect.element(monthLabel(screen, 'August 2026')).toBeInTheDocument();
		});

		it('opens on min when the window is entirely in the future', async () => {
			const screen = await render(Calendar, {
				props: { min: '2027-03-04', max: '2027-06-30' }
			});

			await expect.element(monthLabel(screen, 'March 2027')).toBeInTheDocument();
			await expect.element(getDayButton(screen, 4, 'March', 2027)).not.toBeDisabled();
		});

		it('opens on max when the window is entirely in the past', async () => {
			const screen = await render(Calendar, {
				props: { min: '2019-01-01', max: '2019-04-30' }
			});

			await expect.element(monthLabel(screen, 'April 2019')).toBeInTheDocument();
			await expect.element(getDayButton(screen, 30, 'April', 2019)).not.toBeDisabled();
		});

		it('keeps max in the last pane in the two-month layout', async () => {
			const screen = await render(Calendar, {
				props: { numberOfMonths: 2, min: '2019-01-01', max: '2019-04-30' }
			});

			await expect.element(monthLabel(screen, 'March 2019 – April 2019')).toBeInTheDocument();
		});

		it('still honors an explicit focusDate outside the window', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', min: '2027-03-04', max: '2027-06-30' }
			});

			await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();
		});

		it('still opens on the selected value outside the window', async () => {
			const screen = await render(Calendar, {
				props: { defaultValue: '2031-07-04', min: '2019-01-01' }
			});

			await expect.element(monthLabel(screen, 'July 2031')).toBeInTheDocument();
		});
	});

	it('respects custom dateConstraints', async () => {
		// Only allow weekdays
		const isWeekday = (date: Date) => {
			const day = date.getDay();
			return day !== 0 && day !== 6;
		};

		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', dateConstraints: [isWeekday] }
		});

		// January 4, 2026 is a Sunday - should be disabled
		const sunday = getDayButton(screen, 4);
		await expect.element(sunday).toBeDisabled();
	});

	it('caps the end date to maxRangeSpan once a start is picked', async () => {
		const screen = await render(Calendar, {
			props: { mode: 'range', focusDate: '2026-01-01', maxRangeSpan: 7 }
		});

		// Before a start is picked every day is selectable.
		await expect.element(getDayButton(screen, 20)).not.toBeDisabled();

		// Pick Jan 10 as the start. A 7-day window spans Jan 4–16 (start ± 6).
		await userEvent.click(getDayButton(screen, 10));

		// 6 days after — the edge
		await expect.element(getDayButton(screen, 16)).not.toBeDisabled();
		// 7 days after — beyond the cap
		await expect.element(getDayButton(screen, 17)).toBeDisabled();
		// 6 days before — symmetric
		await expect.element(getDayButton(screen, 4)).not.toBeDisabled();
		// 7 days before — beyond the cap
		await expect.element(getDayButton(screen, 3)).toBeDisabled();
	});

	it('keeps one Tab stop when the span cap disables the day that held it', async () => {
		const screen = await render(Calendar, {
			props: { mode: 'range', focusDate: '2026-01-01', maxRangeSpan: 7 }
		});

		// Arrow from Jan 1 to Jan 25 so Jan 25 holds the grid's Tab stop.
		getDayButton(screen, 1).element().focus();
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
		for (let i = 0; i < 3; i += 1) {
			await userEvent.keyboard('{ArrowRight}');
		}
		expect(getDayButton(screen, 25).element()).toHaveFocus();

		// Picking Jan 10 as the start disables Jan 25 (beyond the 7-day cap).
		await userEvent.click(getDayButton(screen, 10));
		await expect.element(getDayButton(screen, 25)).toBeDisabled();

		// spec:AST-085 FR1: a disabled day stays focusable but never keeps the
		// grid's Tab stop, so the grid still has exactly one, on an enabled day.
		// The repair lands on the hook's MutationObserver tick, so poll.
		const grid = screen.getByRole('grid').element();
		const stops = () =>
			Array.from(grid.querySelectorAll<HTMLElement>('button[data-date][tabindex="0"]'));
		await expect.poll(() => stops().length).toBe(1);
		expect(stops()[0]).not.toHaveAttribute('aria-disabled', 'true');
		await expect.element(getDayButton(screen, 25)).toHaveAttribute('tabindex', '-1');
	});

	it('enforces minRangeSpan once a start is picked', async () => {
		const screen = await render(Calendar, {
			props: { mode: 'range', focusDate: '2026-01-01', minRangeSpan: 3 }
		});

		// Pick Jan 10. A 3-day minimum forbids ends closer than 2 days away.
		await userEvent.click(getDayButton(screen, 10));

		// The picked start itself stays enabled — it is the active selection
		// anchor, not an unreachable end.
		await expect.element(getDayButton(screen, 10)).not.toBeDisabled();
		// 1 day apart — too short
		await expect.element(getDayButton(screen, 11)).toBeDisabled();
		// 3-day span — allowed
		await expect.element(getDayButton(screen, 12)).not.toBeDisabled();
		// 3-day span the other way
		await expect.element(getDayButton(screen, 8)).not.toBeDisabled();
		// 2-day span — too short
		await expect.element(getDayButton(screen, 9)).toBeDisabled();
	});

	it('commits a same-day range with the default minimum', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { mode: 'range', focusDate: '2026-01-01', onChange: handleChange }
		});

		await userEvent.click(getDayButton(screen, 10));
		await userEvent.click(getDayButton(screen, 10));

		expect(handleChange).toHaveBeenCalledWith({
			start: '2026-01-10',
			end: '2026-01-10'
		});
	});

	it('commits a same-day range when the minimum permits it, including with a maximum', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				focusDate: '2026-01-01',
				onChange: handleChange,
				minRangeSpan: 1,
				maxRangeSpan: 7
			}
		});

		await userEvent.click(getDayButton(screen, 10));
		await userEvent.click(getDayButton(screen, 10));

		expect(handleChange).toHaveBeenCalledWith({
			start: '2026-01-10',
			end: '2026-01-10'
		});
	});

	it('clears the in-progress start when the anchor is clicked again', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				focusDate: '2026-01-01',
				onChange: handleChange,
				minRangeSpan: 3
			}
		});

		// Pick Jan 10 as the start, then click it again.
		await userEvent.click(getDayButton(screen, 10));
		await userEvent.click(getDayButton(screen, 10));

		// No zero-length range is committed…
		expect(handleChange).not.toHaveBeenCalled();

		// …and the start is cleared: the days that minRangeSpan disabled around
		// the old anchor are selectable again, so a new start can be placed there.
		await expect.element(getDayButton(screen, 11)).not.toBeDisabled();
		await expect.element(getDayButton(screen, 9)).not.toBeDisabled();
	});

	it('announces the cleared range in the provider locale', async () => {
		const screen = await render(CalendarI18n, {
			props: { locale: 'ja-JP', calendar: { mode: 'range', focusDate: '2026-01-01' } }
		});

		// The day button's own accessible name is already localized through the
		// provider. The announcement has to use the same date string: formatting
		// it without the locale silently falls back to the host locale, so a
		// Japanese user hears an English date.
		const anchor = screen.container.querySelector<HTMLButtonElement>(
			'button[data-date="2026-01-10"]'
		);
		const localizedDate = anchor?.getAttribute('aria-label');
		expect(localizedDate).toBeTruthy();

		await userEvent.click(anchor!);
		await userEvent.click(anchor!);

		await expect.poll(politeRegion).not.toBeNull();
		await expect.element(politeRegion()!).toHaveTextContent(localizedDate!);
	});

	it('does not apply range-span constraints in single mode', async () => {
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', maxRangeSpan: 7 }
		});

		// A picked single date must not disable far-away days.
		await userEvent.click(getDayButton(screen, 10));
		await expect.element(getDayButton(screen, 25)).not.toBeDisabled();
	});

	it('keeps a controlled value that is wider than maxRangeSpan (selection-only)', async () => {
		// The span constraint governs which days are pickable, not validation of
		// an already-set value — so a 15-day value under a 7-day cap stays
		// rendered and is never silently rewritten.
		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				value: { start: '2026-01-05', end: '2026-01-20' },
				focusDate: '2026-01-01',
				maxRangeSpan: 7
			}
		});

		// No selection is in progress (both endpoints are set), so no anchor →
		// every day is pickable and both endpoints render selected.
		await expect.element(getDayButton(screen, 20)).not.toBeDisabled();
		expect(getDayButton(screen, 5).element().closest('[role="gridcell"]')).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(getDayButton(screen, 20).element().closest('[role="gridcell"]')).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	// ─── Multi-Month ─────────────────────────────────────────────

	it('renders two months when numberOfMonths={2}', async () => {
		const screen = await render(Calendar, {
			props: { numberOfMonths: 2, focusDate: '2026-01-01' }
		});

		// The header shows both months
		await expect.element(monthLabel(screen, /January 2026.*February 2026/)).toBeInTheDocument();
	});

	it('navigation advances both months together', async () => {
		const screen = await render(Calendar, {
			props: { numberOfMonths: 2, focusDate: '2026-01-01' }
		});

		const nextButton = getButton(screen, 'Next month');
		await userEvent.click(nextButton);

		await expect.element(monthLabel(screen, /February 2026.*March 2026/)).toBeInTheDocument();
	});

	it('clamps out-of-range numberOfMonths to a single month', async () => {
		// 1000 would otherwise try to render 1000 month grids and lock the page up.
		const screen = await render(Calendar, {
			props: { numberOfMonths: 1000 as unknown as 1 | 2, focusDate: '2026-01-01' }
		});

		// Only the focused month renders — no second month, no range separator.
		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();
		expect(monthLabel(screen, /February 2026/).elements()).toHaveLength(0);
	});

	it('clamps numberOfMonths={0} to a single month', async () => {
		const screen = await render(Calendar, {
			props: { numberOfMonths: 0 as unknown as 1 | 2, focusDate: '2026-01-01' }
		});

		// 0 previously rendered no months at all; now falls back to one.
		await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();
		expect(screen.getByRole('gridcell').elements().length).toBeGreaterThan(0);
	});

	// ─── Display Options ─────────────────────────────────────────

	it('shows week numbers when hasWeekNumbers is true', async () => {
		const screen = await render(Calendar, {
			props: { hasWeekNumbers: true, focusDate: '2026-01-01' }
		});

		// Look for week number cells - they should be in the grid but not buttons
		// Week numbers for January 2026 include week 1, 2, 3, 4, 5
		const weekNumberCells = monthLabel(screen, /^[1-5]$/).elements();
		// Should have more than just day numbers (week numbers add extra cells)
		expect(weekNumberCells.length).toBeGreaterThan(5);
	});

	it('respects weekStartsOn option', async () => {
		const screen = await render(Calendar, { props: { weekStartsOn: 1 } });

		// First day name should be Monday
		const dayNames = monthLabel(screen, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/).elements();
		expect(dayNames[0]).toHaveTextContent('Mon');
	});

	it('accepts a three-letter day name for weekStartsOn', async () => {
		const screen = await render(Calendar, { props: { weekStartsOn: 'mon' } });

		// "mon" should behave exactly like the numeric 1 (Monday first).
		const dayNames = monthLabel(screen, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/).elements();
		expect(dayNames[0]).toHaveTextContent('Mon');
	});

	it('treats weekStartsOn day names case-insensitively', async () => {
		// Upstream writes `{'WED' as 'wed'}`; TS here needs the extra hop because
		// the two string literal types do not overlap.
		const screen = await render(Calendar, {
			props: { weekStartsOn: 'WED' as unknown as DayOfWeekName }
		});

		const dayNames = monthLabel(screen, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/).elements();
		expect(dayNames[0]).toHaveTextContent('Wed');
	});

	// ─── Range Mode ──────────────────────────────────────────────

	it('supports range selection mode', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { mode: 'range', onChange: handleChange, focusDate: '2026-01-01' }
		});

		// Click start date
		const day10 = getDayButton(screen, 10);
		await userEvent.click(day10);

		// Click end date
		const day15 = getDayButton(screen, 15);
		await userEvent.click(day15);

		expect(handleChange).toHaveBeenCalledWith({
			start: '2026-01-10',
			end: '2026-01-15'
		});
	});

	it('handles reverse range selection (end before start)', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { mode: 'range', onChange: handleChange, focusDate: '2026-01-01' }
		});

		// Click later date first
		const day20 = getDayButton(screen, 20);
		await userEvent.click(day20);

		// Click earlier date
		const day10 = getDayButton(screen, 10);
		await userEvent.click(day10);

		// Should swap to ensure start <= end
		expect(handleChange).toHaveBeenCalledWith({
			start: '2026-01-10',
			end: '2026-01-20'
		});
	});

	it('highlights range when value is provided', async () => {
		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				value: { start: '2026-01-10', end: '2026-01-15' },
				focusDate: '2026-01-01'
			}
		});

		const day10 = getDayButton(screen, 10).element();
		const day12 = getDayButton(screen, 12).element();
		const day15 = getDayButton(screen, 15).element();

		// Selection state lives on the gridcell wrapper, not the day button.
		expect(day10.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
		expect(day12.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
		expect(day15.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true');
		expect(day10).not.toHaveAttribute('aria-selected');
		expect(day12).not.toHaveAttribute('aria-selected');
		expect(day15).not.toHaveAttribute('aria-selected');
	});

	it('caps the range highlight next to a disabled mid-range day (#2715)', async () => {
		// Disable Jan 13. With Jan 10–15 selected, day 12 (immediately before the
		// disabled day) should get a rounded end cap on its right edge, and day 14
		// (immediately after) a rounded cap on its left edge — so the highlight
		// reads as terminating at the disabled gap rather than running square-edged
		// into it.
		const disableJan13 = (d: Date) =>
			!(d.getFullYear() === 2026 && d.getMonth() === 0 && d.getDate() === 13);
		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				value: { start: '2026-01-10', end: '2026-01-15' },
				focusDate: '2026-01-01',
				dateConstraints: [disableJan13]
			}
		});

		// The range background is an absolutely-positioned sibling div inside the
		// same gridcell as the day button.
		const rangeBgFor = (day: number): HTMLElement => {
			const button = getDayButton(screen, day).element();
			const cell = button.closest('[role="gridcell"]') as HTMLElement;
			// First child div is the range background (rendered before the button).
			return cell.firstElementChild as HTMLElement;
		};

		const day12Bg = rangeBgFor(12);
		const day14Bg = rangeBgFor(14);

		// Capped edges have a border radius; the un-capped edge stays square.
		expect(getComputedStyle(day12Bg).borderTopRightRadius).not.toBe('');
		expect(getComputedStyle(day12Bg).borderTopRightRadius).not.toBe('0px');
		expect(getComputedStyle(day14Bg).borderTopLeftRadius).not.toBe('');
		expect(getComputedStyle(day14Bg).borderTopLeftRadius).not.toBe('0px');
	});

	it('does not range-highlight adjacent-month spillover days in two-month view', async () => {
		// #2715: with July 1–31 selected and July+August visible, July 26–31 also
		// render as outside days in the August pane. Those spillover copies must
		// not carry the range-highlight state (data-in-range) even though their
		// dates fall inside the selected range.
		const screen = await render(Calendar, {
			props: {
				mode: 'range',
				numberOfMonths: 2,
				focusDate: '2026-07-01',
				value: { start: '2026-07-01', end: '2026-07-31' }
			}
		});

		const spillover = [
			'2026-07-26',
			'2026-07-27',
			'2026-07-28',
			'2026-07-29',
			'2026-07-30',
			'2026-07-31'
		];

		const allDayButtons = Array.from(
			screen.container.querySelectorAll<HTMLButtonElement>('button[data-date]')
		);

		for (const iso of spillover) {
			const matches = allDayButtons.filter((b) => b.getAttribute('data-date') === iso);
			// Renders once in the July pane and once as a spillover in August.
			expect(matches.length).toBeGreaterThanOrEqual(2);
			const outsideCopies = matches.filter((b) => b.getAttribute('aria-disabled') === 'true');
			expect(outsideCopies.length).toBeGreaterThanOrEqual(1);
			for (const b of outsideCopies) {
				expect(b).not.toHaveAttribute('data-in-range');
			}
		}
	});

	// ─── Accessibility ───────────────────────────────────────────

	it('has accessible grid structure', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		await expect.element(screen.getByRole('grid')).toBeInTheDocument();
		expect(screen.getByRole('row').elements().length).toBeGreaterThan(0);
		expect(screen.getByRole('gridcell').elements().length).toBeGreaterThan(0);
	});

	it('renders a valid APG grid: one grid, header row of columnheaders inside it, week rows of gridcells', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		const grids = screen.getByRole('grid').elements();
		expect(grids.length).toBe(1);
		const grid = grids[0];

		// The columnheaders live INSIDE the grid.
		const columnHeaders = screen.getByRole('columnheader').elements();
		expect(columnHeaders.length).toBe(7);
		for (const header of columnHeaders) {
			expect(grid.contains(header)).toBe(true);
		}

		// The grid's rows: first is the header row of columnheaders, the rest are
		// week rows whose direct children are gridcells.
		const rows = screen.getByRole('grid').getByRole('row').elements();
		// 1 header row + 6 week rows (fixed 6-row grid).
		expect(rows.length).toBe(7);

		const [headerRow, ...weekRows] = rows;

		// Header row's direct children are the 7 columnheaders.
		const headerChildren = Array.from(headerRow.children);
		const headerColHeaders = headerChildren.filter(
			(child) => child.getAttribute('role') === 'columnheader'
		);
		expect(headerColHeaders.length).toBe(7);

		// Each week row's direct children are gridcells (7 per row).
		for (const row of weekRows) {
			const gridcellChildren = Array.from(row.children).filter(
				(child) => child.getAttribute('role') === 'gridcell'
			);
			expect(gridcellChildren.length).toBe(7);
		}
	});

	it('renders week-number cells as rowheader when hasWeekNumbers is set', async () => {
		const screen = await render(Calendar, {
			props: { hasWeekNumbers: true, focusDate: '2026-01-01' }
		});

		const rowHeaders = screen.getByRole('grid').getByRole('rowheader').elements();
		// One rowheader (week number) per week row.
		expect(rowHeaders.length).toBeGreaterThanOrEqual(5);
		// Week numbers are numeric.
		for (const header of rowHeaders) {
			expect(header.textContent).toMatch(/^\d+$/);
		}
	});

	it('gridcell wrappers are direct children of week rows, and the button is inside the gridcell', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		const gridcells = screen.getByRole('grid').getByRole('gridcell').elements();
		for (const cell of gridcells) {
			// The gridcell's parent is a role="row".
			const parent = cell.parentElement;
			expect(parent?.getAttribute('role')).toBe('row');
			// The day button (if present) is a descendant of the gridcell.
			const button = cell.querySelector('button');
			if (button) {
				expect(cell.contains(button)).toBe(true);
				expect(button).not.toHaveAttribute('role', 'gridcell');
			}
		}
	});

	it('has navigation buttons with accessible labels', async () => {
		const screen = await render(Calendar);

		await expect.element(getButton(screen, 'Previous month')).toBeInTheDocument();
		await expect.element(getButton(screen, 'Next month')).toBeInTheDocument();
	});

	// ─── Month Change Announcements ──────────────────────────────

	describe('month change announcements', () => {
		it('does not announce on initial render', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });
			// The live region is only created lazily on first announce; mounting the
			// calendar must not speak the initial month.
			expect(politeRegion()).toBeNull();
			// Keeps the render from being unused, and pins that the month it did not
			// announce is the one on screen.
			await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();
		});

		it('announces the new month politely when clicking next', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			await userEvent.click(screen.getByRole('button', { name: 'Next month', exact: true }));

			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('February 2026');
		});

		it('announces the new month politely when clicking previous', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-02-01' } });

			await userEvent.click(screen.getByRole('button', { name: 'Previous month', exact: true }));

			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('January 2026');
		});

		it('moves the focused day by a month with PageDown and PageUp, into the month now shown', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-31' } });

			getDayButton(screen, 31).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('February 2026');
			// A month, not a week: Jan 31 lands on the last day of February.
			await expect
				.poll(() => document.activeElement?.getAttribute('aria-label'))
				.toMatch(/February 28, 2026/);

			await userEvent.keyboard('{PageUp}');
			await expect.element(politeRegion()!).toHaveTextContent('January 2026');
			await expect
				.poll(() => document.activeElement?.getAttribute('aria-label'))
				.toMatch(/January 28, 2026/);
		});

		it('moves the focused day by a year with Shift+PageDown and Shift+PageUp', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-03-01' } });

			getDayButton(screen, 15, 'March').element().focus();
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('March 2027');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2027-03-15');

			await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
			await expect.element(politeRegion()!).toHaveTextContent('March 2026');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-03-15');
		});

		it('a year from February 29 lands on February 28', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2024-02-01' } });

			getDayButton(screen, 29, 'February', 2024).element().focus();
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2025-02-28');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'February 2025');
		});

		it('a year step whose target lies past max changes nothing and keeps focus', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-03-01', max: '2027-03-14' }
			});

			getDayButton(screen, 15, 'March').element().focus();
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'March 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 15, 'March').element());
		});

		it("a year step onto a day disabled by a constraint focuses that month's first enabled day", async () => {
			// March 1–19, 2027 disabled.
			const noEarlyMarch2027 = (date: Date) =>
				!(date.getFullYear() === 2027 && date.getMonth() === 2 && date.getDate() < 20);
			const screen = await render(Calendar, {
				props: { focusDate: '2026-03-01', dateConstraints: [noEarlyMarch2027] }
			});

			getDayButton(screen, 15, 'March').element().focus();
			await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2025-03-15');
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2027-03-20');
		});

		it('in a two-month view a year step forward makes the target month the second one shown', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', numberOfMonths: 2 }
			});

			getDayButton(screen, 15).element().focus();
			await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2027-01-15');
			expect(
				screen
					.getByRole('grid')
					.elements()
					.map((g) => g.getAttribute('aria-label'))
			).toEqual(['December 2026', 'January 2027']);
			const grids = screen.getByRole('grid').elements();
			expect(grids[1].querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
		});

		it("pages from the first of two months onto the right day, not the second grid's fallback", async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', numberOfMonths: 2 }
			});

			getDayButton(screen, 15).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect
				.poll(() => document.activeElement?.getAttribute('aria-label'))
				.toMatch(/February 15, 2026/);
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');

			await userEvent.keyboard('{PageUp}');
			await expect
				.poll(() => document.activeElement?.getAttribute('aria-label'))
				.toMatch(/January 15, 2026/);
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');
		});

		it('skips borrowed adjacent-month days and crosses into their month instead', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// January 1, 2026 is a Thursday: the first row borrows December 28–31.
			getDayButton(screen, 1).element().focus();
			await userEvent.keyboard('{ArrowLeft}');
			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('December 2025');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2025-12-31');
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');
		});

		it('in a two-month view an arrow from the first month lands on the real day, never a borrowed one', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', numberOfMonths: 2 }
			});

			// January 28 (Wednesday) → ArrowDown → February 4, shown in the second
			// grid: no page, and never the first day of a new month.
			getDayButton(screen, 28).element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-02-04');
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');
			// No page happened: January is still the first grid.
			expect(screen.getByRole('grid').elements()).toHaveLength(2);
			await expect.element(getDayButton(screen, 28)).toBeInTheDocument();

			// February 24 (Tuesday) → ArrowDown → March 3: the view pages so March
			// is the second month, and focus lands on the real March 3.
			getDayButton(screen, 24, 'February').element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-03-03');
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');
		});

		it('pages from a borrowed adjacent-month day onto the real day in the month already shown', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// A pointer can still land on the borrowed December 28 in the first
			// row (the keyboard skips it).
			const borrowed = screen.container.querySelector<HTMLElement>(
				'button[data-date="2025-12-28"]'
			)!;
			borrowed.focus();
			expect(document.activeElement).toBe(borrowed);

			// PageDown targets January 28, which January's grid already shows: no
			// month change, focus moves there and never to a borrowed copy.
			await userEvent.keyboard('{PageDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-01-28');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'January 2026');
			expect(document.activeElement).not.toHaveAttribute('aria-disabled');
		});

		it('an arrow past max changes nothing and leaves no pending target behind', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', max: '2026-01-31' }
			});
			const last = getDayButton(screen, 31);
			last.element().focus();
			await userEvent.keyboard('{ArrowRight}');
			// January stays, focus stays on the max day.
			await expect
				.element(screen.getByRole('button', { name: 'Next month', exact: true }))
				.toHaveAttribute('aria-disabled', 'true');
			expect(document.activeElement).toBe(last.element());

			// Later the range widens and the user clicks Next: no stale target
			// pulls focus into the grid.
			await screen.rerender({ focusDate: '2026-01-01', max: '2026-02-28' });
			const next = screen.getByRole('button', { name: 'Next month', exact: true });
			await userEvent.click(next);
			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('February 2026');
			expect(document.activeElement).toBe(next.element());
		});

		it('a page into a month with no enabled day changes nothing and keeps focus', async () => {
			// Only January 1–15 is enabled: February has no enabled day at all.
			const earlyJanuaryOnly = (date: Date) =>
				date.getFullYear() === 2026 && date.getMonth() === 0 && date.getDate() <= 15;
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', dateConstraints: [earlyJanuaryOnly] }
			});
			getDayButton(screen, 10).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'January 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 10).element());
		});

		it('a page onto a day disabled by a constraint moves the month and focuses its first enabled day', async () => {
			// February 1–14 disabled; February 15 onwards enabled.
			const noEarlyFebruary = (date: Date) => !(date.getMonth() === 1 && date.getDate() < 15);
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', dateConstraints: [noEarlyFebruary] }
			});
			getDayButton(screen, 10).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-02-15');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'February 2026');
		});

		it('in a two-month view PageDown from the second month moves both months and a later Next click selects no stale day', async () => {
			const onChange = vi.fn();
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', numberOfMonths: 2, onChange }
			});
			getDayButton(screen, 10, 'February').element().focus();
			await userEvent.keyboard('{PageDown}');
			// March 10 is in no shown grid, so the months move (Feb + Mar) and
			// focus lands on March 10.
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-03-10');
			expect(
				screen
					.getByRole('grid')
					.elements()
					.map((g) => g.getAttribute('aria-label'))
			).toEqual(['February 2026', 'March 2026']);
			// A later Next click pages again without selecting anything.
			await userEvent.click(getButton(screen, 'Next month'));
			await expect
				.poll(() =>
					screen
						.getByRole('grid')
						.elements()
						.map((g) => g.getAttribute('aria-label'))
						.join('|')
				)
				.toBe('March 2026|April 2026');
			expect(onChange).not.toHaveBeenCalled();
		});

		it('an arrow toward a direction where every remaining day is disabled changes nothing', async () => {
			// Only January 2026 is enabled: nothing after January 31 can take focus
			// (the walk looks a year ahead, so the constraint pins the year too).
			const januaryOnly = (date: Date) => date.getFullYear() === 2026 && date.getMonth() === 0;
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', dateConstraints: [januaryOnly] }
			});
			getDayButton(screen, 28).element().focus();
			await userEvent.keyboard('{ArrowDown}');
			// No month change, no focus drop: still January 28.
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'January 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 28).element());
		});

		it('an arrow resolves the next enabled day in its direction first: weekdays-only ArrowRight from Friday January 30 reaches Monday February 2', async () => {
			const weekdaysOnly = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6;
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', dateConstraints: [weekdaysOnly] }
			});
			getDayButton(screen, 30).element().focus();
			await userEvent.keyboard('{ArrowRight}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-02-02');
			// The month paged with it: February's grid is the one shown.
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'February 2026');
		});

		it('an arrow whose next day in range does not exist changes nothing: max January 25, ArrowDown from January 21', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', max: '2026-01-25' }
			});
			getDayButton(screen, 21).element().focus();
			await userEvent.keyboard('{ArrowDown}');
			expect(politeRegion()?.textContent ?? '').not.toContain('February 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 21).element());
		});

		it('a controlled owner that refuses the month change leaves no stale target to steal focus or Enter later', async () => {
			const onChange = vi.fn();
			const screen = await render(CalendarRefusingOwner, { props: { onChange } });
			getDayButton(screen, 15).element().focus();
			// PageDown asks for February; the owner refuses, so January stays and
			// focus does not move.
			await userEvent.keyboard('{PageDown}');
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'January 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 15).element());
			// Later the owner lets February show (through the Next button): the
			// old February 15 target must not grab focus, and Enter on whatever is
			// focused must not pick it.
			await userEvent.click(screen.getByRole('button', { name: 'allow', exact: true }));
			await userEvent.click(getButton(screen, 'Next month'));
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'February 2026');
			expect(document.activeElement).not.toBe(getDayButton(screen, 15, 'February').element());
			expect(onChange).not.toHaveBeenCalled();
		});

		it('a refused target is dropped when focus leaves the day grid, so a later Next click plus Enter picks nothing', async () => {
			const onChange = vi.fn();
			const screen = await render(CalendarOwnerAllow, { props: { allow: false, onChange } });
			getDayButton(screen, 15).element().focus();
			// Refused: January stays, focus stays on January 15.
			await userEvent.keyboard('{PageDown}');
			expect(document.activeElement).toBe(getDayButton(screen, 15).element());
			// Focus moves off the day grid onto the Next button; the owner then
			// allows month changes without any focus change of its own.
			getButton(screen, 'Next month').element().focus();
			await screen.rerender({ allow: true, onChange });
			await userEvent.click(getButton(screen, 'Next month'));
			await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-label', 'February 2026');
			// The stale February 15 target must not have taken focus; Enter on
			// whatever is focused picks nothing.
			expect(document.activeElement).not.toBe(getDayButton(screen, 15, 'February').element());
			await userEvent.keyboard('{Enter}');
			expect(onChange).not.toHaveBeenCalled();
		});

		it('a refused page target is dropped by an arrow to another day, so showing the months later does not select it', async () => {
			const onChange = vi.fn();
			const screen = await render(CalendarOwnerFocusDate, {
				props: { focusDate: '2026-01-01', onChange }
			});
			getDayButton(screen, 10, 'February').element().focus();
			// Declined: Jan–Feb stay; focus stays on February 10.
			await userEvent.keyboard('{PageDown}');
			expect(document.activeElement).toBe(getDayButton(screen, 10, 'February').element());
			// An arrow to February 11 is a focus move to a day other than the
			// target, so the stale March 10 target is dropped.
			await userEvent.keyboard('{ArrowRight}');
			expect(document.activeElement).toBe(getDayButton(screen, 11, 'February').element());
			// The owner now shows February–March without touching focus.
			await screen.rerender({ focusDate: '2026-02-01', onChange });
			await expect
				.poll(() =>
					screen
						.getByRole('grid')
						.elements()
						.map((g) => g.getAttribute('aria-label'))
						.join('|')
				)
				.toBe('February 2026|March 2026');
			expect(document.activeElement).toBe(getDayButton(screen, 11, 'February').element());
			await userEvent.keyboard('{Enter}');
			expect(onChange).not.toHaveBeenCalledWith('2026-03-10');
		});

		it("the pending target becomes the grid's Tab stop: after a page into the second grid and after a page that moves the months, only it has tabindex 0", async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', numberOfMonths: 2 }
			});
			// Per grid: the day buttons with tabindex 0 (each grid keeps at most one;
			// a borrowed copy in the other grid may share the date).
			const stops = (gridName: string) =>
				Array.from(
					screen
						.getByRole('grid', { name: gridName, exact: true })
						.element()
						.querySelectorAll<HTMLElement>('button[data-date]')
				).filter((button) => button.tabIndex === 0);
			// PageDown from January 15 lands on February 15 in the second grid —
			// not February's default stop (its first day), so the stop must move.
			getDayButton(screen, 15).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-02-15');
			expect(stops('February 2026').map((b) => b.getAttribute('data-date'))).toEqual([
				'2026-02-15'
			]);
			expect(stops('January 2026')).toHaveLength(1);
			// PageDown again moves both months; March 15 is March's one stop.
			await userEvent.keyboard('{PageDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-03-15');
			expect(stops('March 2026').map((b) => b.getAttribute('data-date'))).toEqual(['2026-03-15']);
			expect(stops('February 2026')).toHaveLength(1);
		});

		it('a page whose target lies past max changes nothing and keeps focus', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', max: '2026-02-10' }
			});
			getDayButton(screen, 15).element().focus();
			// February 15 is past max: no page, no focus drop.
			await userEvent.keyboard('{PageDown}');
			// No announcement was made (the live region never mounted) and January
			// is still the month shown.
			expect(politeRegion()?.textContent ?? '').not.toContain('February 2026');
			await expect.element(getDayButton(screen, 15)).toHaveAttribute('data-date', '2026-01-15');
			expect(document.activeElement).toBe(getDayButton(screen, 15).element());
		});

		it('in a two-month view a boundary blocks only out-of-range targets, not month movement', async () => {
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-01', min: '2026-01-01', numberOfMonths: 2 }
			});
			// ArrowUp from February 3 reaches January 27 — in range, in the first
			// grid — even though Previous is disabled at the January minimum.
			screen
				.getByRole('grid', { name: 'February 2026', exact: true })
				.getByRole('button', { name: dayName(3, 'February'), exact: false })
				.element()
				.focus();
			await userEvent.keyboard('{ArrowUp}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-01-27');
			// PageDown from January 15 reaches February 15, already visible: no
			// month change, focus moves to it.
			getDayButton(screen, 15).element().focus();
			await userEvent.keyboard('{PageDown}');
			await expect.poll(() => document.activeElement?.getAttribute('data-date')).toBe('2026-02-15');
			await expect.element(getDayButton(screen, 15)).toBeInTheDocument();
		});

		it('announces the next month when paging the grid with PageDown', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// PageDown from a focused day pages the visible grid to the next month.
			getDayButton(screen, 15).element().focus();
			await userEvent.keyboard('{PageDown}');

			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('February 2026');
		});

		// Counterpart: upstream drives `handleRef.current.navigateTo`; here the
		// handle is the component instance.
		it('announces the newly visible month when navigated via the handle', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			screen.component.navigateTo('2026-03-01');

			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('March 2026');
		});

		it('announces both months in a two-month view', async () => {
			const screen = await render(Calendar, {
				props: { numberOfMonths: 2, focusDate: '2026-01-01' }
			});

			await userEvent.click(screen.getByRole('button', { name: 'Next month', exact: true }));

			await expect.poll(politeRegion).not.toBeNull();
			await expect.element(politeRegion()!).toHaveTextContent('February 2026 – March 2026');
		});

		it('does not announce when selecting a date leaves the visible month unchanged', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// Selecting an in-month day does not move the grid, so nothing should be
			// announced (the live region stays uncreated).
			await userEvent.click(getDayButton(screen, 15));

			// Allow the announce rAF a chance to run before asserting silence.
			await new Promise((resolve) => requestAnimationFrame(resolve));
			expect(politeRegion()).toBeNull();
		});
	});

	// ─── Selection Semantics for AT (WCAG 4.1.2 / 1.3.1) ────────

	describe('selection state in day accessible names', () => {
		it("appends 'selected' to the selected day's button name in single mode", async () => {
			const screen = await render(Calendar, {
				props: { value: '2026-01-15', focusDate: '2026-01-01' }
			});

			// Roving focus lands on the day <button>, which cannot carry
			// aria-selected (invalid on role="button") — the selection state must be
			// encoded in the button's accessible name instead.
			expect(getDayButton(screen, 15).element().getAttribute('aria-label')).toBe(
				`${dayName(15)}, selected`
			);
			// Unselected days carry the plain date name.
			expect(getDayButton(screen, 20).element().getAttribute('aria-label')).toBe(dayName(20));
		});

		it('marks range start, end, and in-range days in their accessible names', async () => {
			const screen = await render(Calendar, {
				props: {
					mode: 'range',
					value: { start: '2026-01-10', end: '2026-01-15' },
					focusDate: '2026-01-01'
				}
			});

			expect(getDayButton(screen, 10).element().getAttribute('aria-label')).toBe(
				`${dayName(10)}, range start`
			);
			expect(getDayButton(screen, 15).element().getAttribute('aria-label')).toBe(
				`${dayName(15)}, range end`
			);
			expect(getDayButton(screen, 12).element().getAttribute('aria-label')).toBe(
				`${dayName(12)}, in range`
			);
			// Days outside the range keep the plain date name.
			expect(getDayButton(screen, 20).element().getAttribute('aria-label')).toBe(dayName(20));
		});

		it('labels a one-day range as both range start and range end', async () => {
			const screen = await render(Calendar, {
				props: {
					mode: 'range',
					value: { start: '2026-01-10', end: '2026-01-10' },
					focusDate: '2026-01-01'
				}
			});

			expect(getDayButton(screen, 10).element().getAttribute('aria-label')).toBe(
				`${dayName(10)}, range start and range end`
			);
		});

		it("labels the in-progress first pick as 'range start' only", async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', focusDate: '2026-01-01' }
			});

			await userEvent.click(getDayButton(screen, 10));

			// While the range is in progress the picked day is only the start — not a
			// completed one-day range.
			expect(getDayButton(screen, 10).element().getAttribute('aria-label')).toBe(
				`${dayName(10)}, range start`
			);
		});
	});

	describe('range selection announcements', () => {
		it('announces the start pick and prompts for an end date', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', focusDate: '2026-01-01' }
			});

			await userEvent.click(getDayButton(screen, 10));

			await expect.poll(politeRegion).not.toBeNull();
			await expect
				.element(politeRegion()!)
				.toHaveTextContent(`Start date ${dayName(10)}. Select an end date.`);
		});

		it('announces the completed range after the second pick', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', focusDate: '2026-01-01' }
			});

			await userEvent.click(getDayButton(screen, 10));
			await userEvent.click(getDayButton(screen, 15));

			await expect.poll(politeRegion).not.toBeNull();
			await expect
				.element(politeRegion()!)
				.toHaveTextContent(`Selected range: ${dayName(10)} to ${dayName(15)}.`);
		});

		it('announces the completed range in chronological order for a reverse pick', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', focusDate: '2026-01-01' }
			});

			await userEvent.click(getDayButton(screen, 20));
			await userEvent.click(getDayButton(screen, 10));

			await expect.poll(politeRegion).not.toBeNull();
			await expect
				.element(politeRegion()!)
				.toHaveTextContent(`Selected range: ${dayName(10)} to ${dayName(20)}.`);
		});
	});

	describe('aria-multiselectable', () => {
		it('does not set aria-multiselectable in single mode', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			await expect.element(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable');
		});

		it('sets aria-multiselectable on both grids in a two-month range view', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', numberOfMonths: 2, focusDate: '2026-01-01' }
			});

			const grids = screen.getByRole('grid').elements();
			expect(grids.length).toBe(2);
			for (const grid of grids) {
				expect(grid).toHaveAttribute('aria-multiselectable', 'true');
			}
		});
	});

	// ─── Bug Regression Tests ───────────────────────────────────

	it('day buttons have data-date attribute with ISO string', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		const day15 = getDayButton(screen, 15);
		await expect.element(day15).toHaveAttribute('data-date', '2026-01-15');
	});

	it('ArrowDown moves focus +7 days, not to same day in next month', async () => {
		const handleFocusChange = vi.fn();

		// Upstream's `ControlledFocusCalendar`: the owner follows focus changes.
		const screen = await render(CalendarControlledFocus, {
			props: { onFocusDateChange: handleFocusChange }
		});

		// Focus Jan 28
		const day28 = getDayButton(screen, 28);
		await userEvent.click(day28);
		day28.element().focus();

		// Press ArrowDown — should move to Feb 4 (+7 days), not Feb 28
		await userEvent.keyboard('{ArrowDown}');

		// After navigation, Feb 4 should be focused
		const focusedElement = document.activeElement;
		expect(focusedElement).toHaveAttribute('data-date', '2026-02-04');
	});

	it('ArrowDown lands on the same weekday +7 days even when earlier days are disabled (complex-2)', async () => {
		// min disables Jan 1–4 (HTML-disabled). Jan 8 is a Thursday; ArrowDown must
		// land on Jan 15 (the same weekday, +7 days), not a shifted date caused by
		// the removed enabled cells.
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', min: '2026-01-05' }
		});

		const day1 = getDayButton(screen, 1);
		await expect.element(day1).toBeDisabled();

		const day8 = getDayButton(screen, 8);
		day8.element().focus();

		await userEvent.keyboard('{ArrowDown}');
		expect(document.activeElement).toHaveAttribute('data-date', '2026-01-15');

		await userEvent.keyboard('{ArrowDown}');
		expect(document.activeElement).toHaveAttribute('data-date', '2026-01-22');
	});

	it('ArrowUp skips a disabled cell in the same column to the next enabled row (complex-2)', async () => {
		// max disables Jan 22 onward. Focus Feb 5 handling is out of scope; instead
		// use dateConstraints to disable a single mid-grid day and verify column
		// geometry is preserved (ArrowUp from Jan 15 skips disabled Jan 8 → Jan 1).
		const disableJan8 = (date: Date) =>
			!(date.getFullYear() === 2026 && date.getMonth() === 0 && date.getDate() === 8);

		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', dateConstraints: [disableJan8] }
		});

		const day8 = getDayButton(screen, 8);
		await expect.element(day8).toBeDisabled();

		const day15 = getDayButton(screen, 15);
		day15.element().focus();

		// ArrowUp: same column one row up is Jan 8 (disabled) → skip to Jan 1.
		await userEvent.keyboard('{ArrowUp}');
		expect(document.activeElement).toHaveAttribute('data-date', '2026-01-01');
	});

	it('cross-month arrow nav resolves the focused date from data-date (locale-safe)', async () => {
		// Regression for complex-4: getFocusedDate must read the machine-readable
		// data-date attribute, not parse the human-readable aria-label with
		// new Date() (which is locale-dependent). We prove the resolution path by
		// corrupting the aria-label to something new Date() cannot parse — cross-
		// month navigation must still report the correct ISO date.
		const handleFocusChange = vi.fn();

		const screen = await render(CalendarControlledFocus, {
			props: { onFocusDateChange: handleFocusChange }
		});

		const day28 = getDayButton(screen, 28).element();
		await userEvent.click(day28);
		day28.focus();
		// Simulate a non-English/unparseable aria-label while keeping data-date.
		day28.setAttribute('aria-label', '2026年1月28日 水曜日');

		await userEvent.keyboard('{ArrowDown}');

		// Feb 4 (+7 days) — resolved via data-date despite the unparseable label.
		expect(document.activeElement).toHaveAttribute('data-date', '2026-02-04');
	});

	it('prev button is disabled when focusDate month contains min', async () => {
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', min: '2026-01-15' }
		});

		const prevButton = getButton(screen, 'Previous month');
		await expect.element(prevButton).toBeDisabled();
	});

	it('next button is disabled when focusDate month contains max', async () => {
		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', max: '2026-01-15' }
		});

		const nextButton = getButton(screen, 'Next month');
		await expect.element(nextButton).toBeDisabled();
	});

	it('outside days are not clickable when hasOutsideDays is true', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { focusDate: '2026-01-01', hasOutsideDays: true, onChange: handleChange }
		});

		// January 2026 starts on Thursday, so Dec 28-31 are outside days
		// Find an outside day button (December day visible in January grid)
		const outsideDays = screen
			.getByRole('gridcell')
			.elements()
			.filter((cell) => {
				const button = cell.querySelector('button');
				return button?.getAttribute('aria-disabled') === 'true';
			});

		// RESTATED. Upstream guards the click behind `if (outsideDays[0])` and
		// `if (button)`, so the case passes green having clicked nothing at all.
		// Assert the outside days exist, then click unconditionally — which is what
		// the title claims is being tested.
		expect(outsideDays.length).toBeGreaterThan(0);
		const button = outsideDays[0].querySelector('button');
		expect(button).not.toBeNull();
		// Dispatched rather than driven through `userEvent`: Playwright's
		// actionability check refuses to click an `aria-disabled="true"` element,
		// where user-event in jsdom fires the click regardless. Going direct
		// removes the *browser's* guard and leaves only the component's, which is
		// the one this case is about.
		button!.click();

		expect(handleChange).not.toHaveBeenCalled();
	});

	it('Escape cancels range selection in progress', async () => {
		const handleChange = vi.fn();

		const screen = await render(Calendar, {
			props: { mode: 'range', onChange: handleChange, focusDate: '2026-01-01' }
		});

		// Click start date to begin range selection
		const day10 = getDayButton(screen, 10);
		await userEvent.click(day10);

		// Press Escape to cancel
		await userEvent.keyboard('{Escape}');

		// Click another date — should start a NEW range, not complete the old one
		const day20 = getDayButton(screen, 20);
		await userEvent.click(day20);

		// onChange should NOT have been called (no range completed)
		expect(handleChange).not.toHaveBeenCalled();
	});

	it('day name headers have role="columnheader"', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		const columnHeaders = screen.getByRole('columnheader').elements();
		expect(columnHeaders.length).toBe(7);

		// Verify they contain day name abbreviations
		const dayNames = columnHeaders.map((h) => h.textContent);
		expect(dayNames).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
	});

	it('button inside gridcell does not duplicate role="gridcell"', async () => {
		const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

		const gridcells = screen.getByRole('gridcell').elements();
		for (const cell of gridcells) {
			const button = cell.querySelector('button');
			if (button) {
				expect(button).not.toHaveAttribute('role', 'gridcell');
			}
		}
	});

	// ─── RTL (#3388) ─────────────────────────────────────────────

	describe('RTL month navigation', () => {
		// Upstream's note is that jsdom does not apply compiled StyleX CSS, so the
		// scaleX(-1) mirror is only observable in a browser. These run in a real
		// Chromium, but the case is ported as upstream wrote it: it pins the
		// structure the fix depends on — both nav chevrons render inside the navIcon
		// wrapper that carries the ':is([dir="rtl"] *)' conditional transform.
		it('wraps both nav chevrons in the RTL-mirroring navIcon wrapper', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// Our style module exposes attribute helpers rather than raw style
			// objects, so this is `calendarNavIconAttrs()` where upstream writes
			// `stylex.props(calendarStyles.navIcon)`. Same class, same assertion.
			const { class: navIconClass } = calendarNavIconAttrs();
			expect(navIconClass).toBeTruthy();

			for (const name of ['Previous month', 'Next month']) {
				const button = getButton(screen, name).element();
				const wrappers = Array.from(button.querySelectorAll('span')).filter(
					(span) => span.className === navIconClass
				);
				expect(wrappers.length).toBe(1);
			}
		});

		it('keeps navigation semantics unchanged under dir="rtl"', async () => {
			const screen = await render(CalendarRtl, {
				props: { calendar: { focusDate: '2026-02-01' } }
			});

			await expect.element(monthLabel(screen, 'February 2026')).toBeInTheDocument();

			// DOM order and handlers must not change in RTL: flexbox already
			// places "Previous month" at the visual right; only the glyph mirrors.
			await userEvent.click(getButton(screen, 'Previous month'));
			await expect.element(monthLabel(screen, 'January 2026')).toBeInTheDocument();

			await userEvent.click(getButton(screen, 'Next month'));
			await expect.element(monthLabel(screen, 'February 2026')).toBeInTheDocument();
		});
	});

	describe('day-cell marker theme state', () => {
		// Pin "today" to a mid-month date so the ±2-day range helpers below stay
		// within a single rendered month. With the real clock, running near a month
		// boundary (e.g. the 1st) pushed today-2 into the previous month, so the
		// rendered grid didn't contain today's cell and the marker assertions
		// flaked. Fake only Date (timers stay real; these tests are synchronous) —
		// which is also this file's standing rule, because `queueMicrotask` is what
		// Svelte schedules on. The file's `afterEach` restores real timers.
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
		});
		// Tests use the (now-pinned) "today" since Calendar derives it internally.
		// Helpers pin the exact ISO strings.
		function todayISO(): ISODateString {
			const n = new Date();
			return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` as ISODateString;
		}
		function isoOffsetFromToday(deltaDays: number): ISODateString {
			const n = new Date();
			n.setDate(n.getDate() + deltaDays);
			return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` as ISODateString;
		}
		// Upstream's document-wide `document.querySelector`, scoped to the render
		// container — which is what RTL's freshly-cleaned `document` amounts to.
		function todayCell(screen: Screen): HTMLElement {
			const el = screen.container.querySelector<HTMLElement>(`button[data-date="${todayISO()}"]`);
			expect(el).not.toBeNull();
			return el as HTMLElement;
		}

		it('reflects marker="today-only" for a plain today cell (no selection)', async () => {
			const screen = await render(Calendar);
			const cell = todayCell(screen);
			expect(cell).toHaveAttribute('data-marker', 'today-only');
			expect(cell).toHaveAttribute('data-today', 'today');
			expect(cell).not.toHaveAttribute('data-selected');
			expect(cell).not.toHaveAttribute('data-in-range');
		});

		it('reflects marker="today-in-range" when today is strictly inside a range', async () => {
			const screen = await render(Calendar, {
				props: {
					mode: 'range',
					value: { start: isoOffsetFromToday(-2), end: isoOffsetFromToday(2) }
				}
			});
			const cell = todayCell(screen);
			// Today is inside the range but not an endpoint: the today-in-range ring
			// is shown, so `marker` reflects that compound state precisely.
			expect(cell).toHaveAttribute('data-marker', 'today-in-range');
			expect(cell).toHaveAttribute('data-in-range', 'in-range');
			expect(cell).not.toHaveAttribute('data-selected');
		});

		it('shows no marker state when today is the single-selected date', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'single', value: todayISO() }
			});
			const cell = todayCell(screen);
			// A single-mode selected cell shows no ring by default — `marker` is
			// absent, while `selected` (which owns the selected treatment) is present.
			expect(cell).not.toHaveAttribute('data-marker');
			expect(cell).toHaveAttribute('data-selected', 'selected');
			expect(cell).toHaveAttribute('data-today', 'today');
		});

		it('preserves the today-in-range ring on a today range endpoint', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'range', value: { start: todayISO(), end: isoOffsetFromToday(3) } }
			});
			const cell = todayCell(screen);
			// A range endpoint is NOT `isSelected` (that flag is single-mode only),
			// so by default the today-in-range ring IS drawn on a today endpoint
			// alongside the endpoint styling. `marker` mirrors that exactly — this
			// asserts the default rendering is preserved, byte-for-byte.
			expect(cell).toHaveAttribute('data-marker', 'today-in-range');
			expect(cell).toHaveAttribute('data-in-range', 'in-range');
		});

		it('omits the marker state for non-today cells', async () => {
			const screen = await render(Calendar);
			const other = screen.container.querySelector(`button[data-date="${isoOffsetFromToday(1)}"]`);
			// RESTATED. Upstream guards this with `if (other)`, against the +1 day
			// landing in an adjacent month with outside days hidden — so on the wrong
			// day of the month its only assertion never runs and the case passes
			// having checked nothing. The clock is pinned to the 15th two lines
			// above, which makes the cell's presence a fact rather than a hope, so it
			// is asserted instead of guarded.
			expect(other).not.toBeNull();
			expect(other).not.toHaveAttribute('data-marker');
		});

		it('exposes the marker states as themeable defineTheme targets', () => {
			// A browser cannot resolve the @layer cascade from JS, so the
			// DOM-reflection tests above cover that the right state renders; this
			// asserts the state is reachable by a theme via the sanctioned
			// defineTheme channel. `generateThemeCss` is this port's counterpart to
			// upstream's `generateThemeTestCSS` — both return the flat stylesheet
			// string.
			const theme = defineTheme({
				name: 'calendar-marker-test',
				components: {
					'calendar-day': {
						'marker:today-only': {
							boxShadow: 'inset 0 0 0 2px var(--color-accent)'
						},
						'marker:today-in-range': {
							boxShadow: 'inset 0 0 0 2px var(--color-text-primary)'
						}
					}
				}
			});
			const css = generateThemeCss(theme);
			expect(css).toContain('.astryx-calendar-day[data-marker="today-only"]');
			expect(css).toContain('.astryx-calendar-day[data-marker="today-in-range"]');
			expect(css).toContain('box-shadow: inset 0 0 0 2px var(--color-accent)');
			expect(css).toContain('box-shadow: inset 0 0 0 2px var(--color-text-primary)');
		});
	});

	// ─── Theming targets ─────────────────────────────────────────
	describe('theming targets', () => {
		it('renders the astryx-calendar-nav target on both month-nav buttons', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			const prev = getButton(screen, 'Previous month');
			const next = getButton(screen, 'Next month');

			// Dedicated, stable theme target — scoped to the nav controls, not the
			// global astryx-button handle that hits every Button in the app.
			await expect.element(prev).toHaveClass('astryx-calendar-nav');
			await expect.element(next).toHaveClass('astryx-calendar-nav');

			// Direction is reflected so a theme can target one arrow alone.
			await expect.element(prev).toHaveAttribute('data-nav', 'prev');
			await expect.element(next).toHaveAttribute('data-nav', 'next');
		});

		it('reflects the disabled nav state as a data attribute at the range edges', async () => {
			// Clamp navigation so "Previous month" is disabled and "Next" is not.
			const screen = await render(Calendar, {
				props: { focusDate: '2026-01-15', min: '2026-01-01', max: '2026-03-31' }
			});

			const prev = getButton(screen, 'Previous month');
			const next = getButton(screen, 'Next month');

			await expect.element(prev).toHaveAttribute('data-disabled', 'disabled');
			await expect.element(next).not.toHaveAttribute('data-disabled');
		});

		it('keeps the default nav rendering unchanged (still a ghost icon button)', async () => {
			const screen = await render(Calendar, { props: { focusDate: '2026-01-01' } });

			// The new target is additive — the nav still carries the stock Button
			// classes, so default appearance is preserved.
			const prev = getButton(screen, 'Previous month');
			await expect.element(prev).toHaveClass('astryx-button');
			await expect.element(prev).toHaveClass('ghost');
			expect(prev.element().tagName).toBe('BUTTON');
		});

		it('renders the astryx-calendar-day target with its reflected states', async () => {
			const screen = await render(Calendar, {
				props: { mode: 'single', value: '2026-01-15', focusDate: '2026-01-01' }
			});

			const selected = getDayButton(screen, 15);
			await expect.element(selected).toHaveClass('astryx-calendar-day');
			await expect.element(selected).toHaveAttribute('data-selected', 'selected');

			// A non-selected weekday cell still carries the base target and no
			// selected/today reflection.
			const plain = getDayButton(screen, 20);
			await expect.element(plain).toHaveClass('astryx-calendar-day');
			await expect.element(plain).not.toHaveAttribute('data-selected');
		});

		it('exposes calendar-nav as a themeable defineTheme target', () => {
			// The generated CSS is what proves the target is reachable by a theme:
			// the @layer cascade is not observable from JS, so the DOM-class
			// assertions above and this generation assertion together cover the seam.
			const theme = defineTheme({
				name: 'calendar-nav-test',
				components: {
					'calendar-nav': {
						base: { color: 'var(--color-accent)' },
						'nav:next': { backgroundColor: 'var(--color-accent-muted)' }
					}
				}
			});
			const css = generateThemeCss(theme);
			expect(css).toContain('.astryx-calendar-nav {');
			expect(css).toContain('color: var(--color-accent)');
			expect(css).toContain('.astryx-calendar-nav[data-nav="next"]');
			expect(css).toContain('background-color: var(--color-accent-muted)');
		});
	});
});

// Neither jsdom nor a Chromium test page can emulate forced-colors rendering, so
// this asserts that the compiled output includes the forced-colors rules; visual
// behavior needs manual verification under Windows High Contrast. The scan is
// scoped to this subtree, since the browser page carries the package-wide sheet.
describe('forced colors (WCAG 1.4.11)', () => {
	it('compiles a forced-colors fill so the selected date survives Windows High Contrast', async () => {
		const screen = await render(Calendar, {
			props: { mode: 'single', value: '2026-01-15', focusDate: '2026-01-01' }
		});

		const css = forcedColorsCssIn(screen.container);
		// Without these the accent fill is stripped and the selected date renders
		// identically to every other day in the month.
		expect(css).toContain('background-color: highlight;');
		expect(css).toContain('color: highlighttext;');
		// A <button> keeps the native ButtonFace surface and ignores the authored
		// Highlight fill unless it opts out of UA remapping.
		expect(cssIn(screen.container)).toContain('forced-color-adjust: none;');
	});
});
