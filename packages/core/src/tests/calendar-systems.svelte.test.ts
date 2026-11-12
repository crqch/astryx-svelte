/** PORTS: Calendar/Calendar.calendarSystems.test.tsx */
//
// Upstream loads the full Temporal polyfill. This port uses the runtime's own
// Temporal (Chromium and Node 26). Dropped cases, each waiting on Calendar
// keyboard paging rather than on the calendar layer:
// - "pages one calendar month and clamps the day of the month" (Persian)
// - "steps a year from Adar I to Adar with Shift+PageDown" (Hebrew)
// - "steps a year to the same month with Shift+PageUp" (Ethiopic)
// - "moves to the same day a year away with Shift+PageUp and Shift+PageDown"
// - "clamps February 29 to February 28"
// - "changes nothing when the year target lies past max"
// This port's Calendar still pages PageUp/PageDown by a week, so those six
// remain listed in port/status.md.

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import Calendar from '../lib/components/calendar/calendar.svelte';
import CalendarProviderProbe from './fixtures/calendar-provider-probe.svelte';
import DateInputProviderProbe from './fixtures/date-input-provider-probe.svelte';
import DateRangeInputProviderProbe from './fixtures/date-range-input-provider-probe.svelte';
import DateTimeInputProviderProbe from './fixtures/date-time-input-provider-probe.svelte';

function dayButton(iso: string): HTMLElement {
	const button = document.querySelector<HTMLElement>(`button[data-date="${iso}"]`);
	if (button == null) {
		throw new Error(`No day button for ${iso}`);
	}
	return button;
}

function inMonthDates(grid: Element): string[] {
	return Array.from(grid.querySelectorAll('[role="gridcell"] button'))
		.filter((button) => !button.hasAttribute('aria-disabled'))
		.map((button) => button.getAttribute('data-date') ?? '');
}

describe('Calendar in the Persian calendar', () => {
	it('lays out Aban 1405 with its calendar day numbers and labels', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'persian', focusDate: '2026-10-30' }
		});
		const grid = view.getByRole('grid').element();
		expect(grid.getAttribute('aria-label')).toContain('Aban 1405');

		const dates = inMonthDates(grid);
		expect(dates).toHaveLength(30);
		expect(dates[0]).toBe('2026-10-23');
		expect(dates[29]).toBe('2026-11-21');

		expect(dayButton('2026-10-23')).toHaveTextContent(/^1$/);
		expect(dayButton('2026-10-30')).toHaveTextContent(/^8$/);
		expect(dayButton('2026-10-30').getAttribute('aria-label')).toMatch(/Friday, Aban 8, 1405/);
	});

	it('keeps the fixed six-row grid', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'persian', focusDate: '2026-10-30' }
		});
		expect(view.getByRole('grid').element().querySelectorAll('[role="gridcell"]')).toHaveLength(42);
	});

	it('reports a pick as a Gregorian ISO date', async () => {
		const onChange = vi.fn();
		await render(Calendar, {
			props: { calendar: 'persian', focusDate: '2026-10-30', onChange }
		});
		await userEvent.click(dayButton('2026-10-30'));
		expect(onChange).toHaveBeenCalledWith('2026-10-30', expect.any(Date));
	});

	it('steps one calendar month with Previous and Next', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'persian', defaultValue: '2026-10-30' }
		});
		await userEvent.click(view.getByRole('button', { name: 'Next month', exact: true }));
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Azar 1405');
		expect(inMonthDates(view.getByRole('grid').element())[0]).toBe('2026-11-22');

		await userEvent.click(view.getByRole('button', { name: 'Previous month', exact: true }));
		await userEvent.click(view.getByRole('button', { name: 'Previous month', exact: true }));
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Mehr 1405');
	});

	it('bounds the month buttons by day', async () => {
		const view = await render(Calendar, {
			props: {
				calendar: 'persian',
				focusDate: '2026-10-30',
				min: '2026-10-23',
				max: '2026-11-22'
			}
		});
		// min is the first day of Aban: no earlier day is in range.
		await expect
			.element(view.getByRole('button', { name: 'Previous month', exact: true }))
			.toHaveAttribute('aria-disabled', 'true');
		// max is the first day of Azar: a later day is in range.
		await expect
			.element(view.getByRole('button', { name: 'Next month', exact: true }))
			.not.toHaveAttribute('aria-disabled');
	});

	it('shows ISO 8601 week numbers', async () => {
		await render(Calendar, {
			props: {
				calendar: 'persian',
				focusDate: '2026-10-30',
				weekStartsOn: 'mon',
				hasWeekNumbers: true
			}
		});
		const row = dayButton('2026-10-30').closest('[role="row"]');
		expect(row?.querySelector('[role="rowheader"]')?.textContent).toBe('44');
	});

	it('writes day numbers and labels in the locale', async () => {
		const probe = await render(CalendarProviderProbe, {
			props: { locale: 'fa-IR', calendar: 'persian' }
		});
		expect(dayButton('2026-10-30')).toHaveTextContent(/^۸$/);
		expect(probe.getByRole('grid').element().getAttribute('aria-label')).toContain('آبان');
	});
});

describe('Calendar in the Hebrew calendar', () => {
	it('shows Adar I and Adar II as distinct months of a leap year', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'hebrew', focusDate: '2024-02-20' }
		});
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Adar I 5784');
		expect(inMonthDates(view.getByRole('grid').element())).toHaveLength(30);
		await userEvent.click(view.getByRole('button', { name: 'Next month', exact: true }));
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Adar II 5784');
		expect(inMonthDates(view.getByRole('grid').element())).toHaveLength(29);
	});
});

describe('Calendar in the Ethiopic calendar', () => {
	it('keeps six rows for the five-day thirteenth month', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'ethiopic', focusDate: '2026-09-08' }
		});
		const grid = view.getByRole('grid').element();
		expect(grid.getAttribute('aria-label')).toContain('Pagumen 2018');
		expect(inMonthDates(grid)).toEqual([
			'2026-09-06',
			'2026-09-07',
			'2026-09-08',
			'2026-09-09',
			'2026-09-10'
		]);
		expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
	});

	it('gives the thirteenth month only its rows with hasVariableRowCount', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'ethiopic', focusDate: '2026-09-08', hasVariableRowCount: true }
		});
		// 2026-09-06 is a Sunday, so the five days fill one row.
		expect(view.getByRole('grid').element().querySelectorAll('[role="gridcell"]')).toHaveLength(7);
	});
});

describe('Calendar in the Chinese calendar', () => {
	it('names each day by the month and day the grid shows when Intl disagrees', async () => {
		// Native Temporal already places 2027-02-06 one day ahead of Intl, which
		// is the disagreement this case exercises; upstream's helper had to add
		// that day for the polyfill.
		const view = await render(Calendar, {
			props: { calendar: 'chinese', focusDate: '2027-02-06' }
		});
		// Intl alone calls this day "Saturday, Twelfth Month 30, 2026".
		expect(dayButton('2027-02-06')).toHaveTextContent(/^1$/);
		expect(dayButton('2027-02-06').getAttribute('aria-label')).toMatch(
			/^Saturday, First Month 1, 2027/
		);
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('First Month');
		// A day inside the month keeps Intl's own label.
		expect(dayButton('2027-02-20').getAttribute('aria-label')).toMatch(
			/^Saturday, First Month 15, 2027/
		);
	});
});

describe('Calendar in the Japanese calendar', () => {
	it('names the era of each month', async () => {
		const view = await render(Calendar, {
			props: { calendar: 'japanese', focusDate: '2019-04-30' }
		});
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Heisei');
		await userEvent.click(view.getByRole('button', { name: 'Next month', exact: true }));
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('Reiwa');
	});
});

describe('date inputs under a provider calendar', () => {
	it.each([
		['DateInput', DateInputProviderProbe],
		['DateRangeInput', DateRangeInputProviderProbe],
		['DateTimeInput', DateTimeInputProviderProbe]
	] as const)('%s opens its popover calendar in the calendar', async (_name, Probe) => {
		const probe = await render(Probe, {
			props: { locale: 'en', calendar: 'persian' }
		});
		await userEvent.click(probe.getByRole('button', { name: 'Open calendar', exact: true }));
		const grid = document.querySelector('[role="grid"]');
		expect(grid?.getAttribute('aria-label')).toContain('1405');
	});
});
