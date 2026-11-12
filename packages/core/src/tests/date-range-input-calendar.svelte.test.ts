/** PORTS: DateRangeInput/DateRangeInput.calendar.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { DateRangeInputProps } from '$lib/components/date-range-input/date-range-input.svelte';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';
import DateRangeInputCalendarProbe from './fixtures/date-range-input-calendar-probe.svelte';

/**
 * Astryx's `DateRangeInput/DateRangeInput.calendar.test.tsx`, ported case for
 * case. The provider wrapper is a fixture because Svelte's provider takes a
 * snippet; the real Chromium clock is pinned exactly as upstream pins jsdom's.
 */

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 10, 2, 12));
	__resetDevWarnings();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

async function renderRange(
	locale: string,
	props: Partial<DateRangeInputProps>,
	providerCalendar?: 'persian'
) {
	const onChange = vi.fn();
	await render(DateRangeInputCalendarProbe, {
		props: { locale, props, providerCalendar, onChange }
	});
	return { onChange };
}

/** The range trigger: the button that shows the range. */
function triggerText(): string {
	return (
		document.querySelector<HTMLElement>('button[aria-haspopup="dialog"]:not([tabindex="-1"])')
			?.textContent ?? ''
	);
}

describe('DateRangeInput in a calendar', () => {
	it('writes the trigger text and its accessible name in the Persian calendar', async () => {
		await renderRange('en', { calendar: 'persian' });
		expect(triggerText()).toContain('Aban 8 – Aban 11');
		await expect
			.element(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
			.toHaveAccessibleName('Stay: Aban 8 – Aban 11');
	});

	it('takes the calendar from the provider', async () => {
		await renderRange('fa-IR', {}, 'persian');
		expect(triggerText()).toContain('۸ آبان – ۱۱ آبان');
	});

	it('shows the year when the range leaves the current calendar year', async () => {
		// Both dates are in Gregorian 2026, but Nowruz falls between them.
		await renderRange('en', {
			calendar: 'persian',
			value: { start: '2026-03-15', end: '2026-03-25' }
		});
		expect(triggerText()).toContain('Esfand 24, 1404 AP');
		expect(triggerText()).toContain('Farvardin 5, 1405 AP');
	});

	it('opens a Persian popover calendar and reports Gregorian ISO dates', async () => {
		const { onChange } = await renderRange('en', { calendar: 'persian', value: null });
		await userEvent.click(
			document.querySelector('button[aria-label="Open calendar"]') as HTMLElement
		);
		const grid = await vi.waitFor(() => {
			const element = document.querySelector('[role="grid"]');
			if (element == null) {
				throw new Error('calendar not open yet');
			}
			return element as HTMLElement;
		});
		expect(grid.getAttribute('aria-label')).toContain('1405');
		const first = grid.querySelector<HTMLButtonElement>('button[data-date="2026-10-23"]');
		const last = grid.querySelector<HTMLButtonElement>('button[data-date="2026-10-25"]');
		await userEvent.click(first!);
		await userEvent.click(last!);
		expect(onChange).toHaveBeenLastCalledWith({
			start: '2026-10-23',
			end: '2026-10-25'
		});
	});

	it('keeps Gregorian text by default', async () => {
		await renderRange('en', {});
		expect(triggerText()).toContain('Oct 30 – Nov 2');
	});

	it('writes Buddhist years', async () => {
		await renderRange('th-TH', {
			calendar: 'buddhist',
			value: { start: '2025-12-30', end: '2026-01-02' }
		});
		expect(triggerText()).toContain('2568');
		expect(triggerText()).toContain('2569');
	});
});

describe('DateRangeInput in a calendar without Temporal', () => {
	const saved = (globalThis as { Temporal?: unknown }).Temporal;
	beforeEach(() => {
		delete (globalThis as { Temporal?: unknown }).Temporal;
	});
	afterEach(() => {
		(globalThis as { Temporal?: unknown }).Temporal = saved;
	});

	it('shows Gregorian dates for Persian and warns', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await renderRange('en', { calendar: 'persian' });
		expect(triggerText()).toContain('Oct 30 – Nov 2');
		expect(String(warn.mock.calls[0]?.[0])).toContain('needs a Temporal that supports it');
	});

	it('still writes Buddhist years', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await renderRange('th-TH', {
			calendar: 'buddhist',
			value: { start: '2025-12-30', end: '2026-01-02' }
		});
		expect(triggerText()).toContain('2569');
		expect(warn).not.toHaveBeenCalled();
	});
});
