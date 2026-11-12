/** PORTS: PowerSearch/PowerSearch.calendarSystems.test.tsx */
//
// Upstream installs `temporal-polyfill/full/global`; this port uses the
// runtime's own Temporal in Chromium and skips nothing. The provider wrapper
// is a fixture because Svelte's provider takes a snippet.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatDateAbsolute } from '$lib/components/power-search/format-filter-value.js';
import type {
	PowerSearchConfig,
	PowerSearchField,
	PowerSearchFilter,
	PowerSearchOperator
} from '$lib/components/power-search/types.js';
import type { CalendarSystem } from '$lib/utils/calendar-system.js';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';
import { withChineseTemporalAheadOfIntl } from './temporal-ahead-of-intl.js';
import PowerSearchCalendarProbe from './fixtures/power-search-calendar-probe.svelte';

const UNIX_SECONDS = Date.parse('2026-10-30T12:00:00Z') / 1000;

const isOperator: PowerSearchOperator = {
	key: 'is',
	label: 'is',
	value: { type: 'date_absolute' }
};

const createdField: PowerSearchField = {
	key: 'created',
	label: 'Created',
	defaultOperator: 'is',
	operators: [isOperator]
};

const config: PowerSearchConfig = { name: 'Dates', fields: [createdField] };

const filter: PowerSearchFilter = {
	field: 'created',
	operator: 'is',
	value: { type: 'date_absolute', unixSeconds: UNIX_SECONDS }
};

async function renderSearch(provider: { locale: string; calendar?: CalendarSystem }) {
	return render(PowerSearchCalendarProbe, {
		props: { provider, mode: 'search', config, filter, field: createdField, operator: isOperator }
	});
}

async function renderToken(provider: { locale: string; calendar?: CalendarSystem }) {
	return render(PowerSearchCalendarProbe, {
		props: { provider, mode: 'token', config, filter, field: createdField, operator: isOperator }
	});
}

afterEach(() => {
	__resetDevWarnings();
	vi.restoreAllMocks();
});

describe('PowerSearch date values in the provider calendar', () => {
	it.each([
		{ calendar: 'persian', locale: 'en', year: '1405' },
		{ calendar: 'persian', locale: 'fa', year: '۱۴۰۵' },
		{ calendar: 'hebrew', locale: 'en', year: '5787' },
		{ calendar: 'hebrew', locale: 'he', year: '5787' },
		{ calendar: 'buddhist', locale: 'en', year: '2569' },
		{ calendar: 'buddhist', locale: 'th', year: '2569' }
	] as const)(
		'writes the token value in $calendar under $locale',
		async ({ calendar, locale, year }) => {
			const view = await renderSearch({ locale, calendar });
			const expected = formatDateAbsolute(UNIX_SECONDS, locale, undefined, true, calendar);
			expect(expected).toContain(year);
			await expect.element(view.getByText(expected, { exact: true })).toBeInTheDocument();
		}
	);

	it('keeps Gregorian dates without a provider calendar', async () => {
		const view = await renderSearch({ locale: 'fa-IR' });
		await expect
			.element(
				view.getByText(formatDateAbsolute(UNIX_SECONDS, 'fa-IR', undefined), { exact: true })
			)
			.toBeInTheDocument();
	});

	it('writes the PowerSearchToken value in the provider calendar', async () => {
		const view = await renderToken({ locale: 'en', calendar: 'persian' });
		await expect.element(view.getByText(/Aban 8, 1405 AP/)).toBeInTheDocument();
	});

	it('writes a date and time on the `chinese` day that Calendar shows', () => {
		const lunarNewYear = Date.parse('2027-02-06T12:00:00Z') / 1000;
		const value = withChineseTemporalAheadOfIntl(() =>
			formatDateAbsolute(lunarNewYear, 'en', 'UTC', false, 'chinese')
		);
		// Intl alone names the 30th day of the Twelfth Month of 2026.
		expect(value).toMatch(/^Mo1 1, 2027, 12:00\sPM$/);
	});

	it('writes a date and time in `iso8601` as in `gregory`', () => {
		expect(formatDateAbsolute(UNIX_SECONDS, 'en', 'UTC', false, 'iso8601')).toBe(
			formatDateAbsolute(UNIX_SECONDS, 'en', 'UTC', false)
		);
	});

	describe('without Temporal', () => {
		const globals = globalThis as { Temporal?: unknown };
		let savedTemporal: unknown;

		beforeAll(() => {
			savedTemporal = globals.Temporal;
			delete globals.Temporal;
		});

		afterAll(() => {
			globals.Temporal = savedTemporal;
		});

		it('shows Gregorian dates for a calendar that needs Temporal', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const view = await renderSearch({ locale: 'en', calendar: 'persian' });
			await expect
				.element(view.getByText(formatDateAbsolute(UNIX_SECONDS, 'en', undefined), { exact: true }))
				.toBeInTheDocument();
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('needs a Temporal that supports it')
			);
		});

		it('still shows the buddhist calendar, which needs no Temporal', async () => {
			const view = await renderSearch({ locale: 'en', calendar: 'buddhist' });
			await expect
				.element(
					view.getByText(formatDateAbsolute(UNIX_SECONDS, 'en', undefined, true, 'buddhist'), {
						exact: true
					})
				)
				.toBeInTheDocument();
		});
	});
});
