/** PORTS: i18n/__tests__/calendarSystem.test.tsx */
//
// Upstream deletes `globalThis.Temporal` for this suite, as an application that
// loads none does; the Gregorian-aligned calendars need no Temporal. The port
// restores the runtime's Temporal after the suite.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Calendar from '../lib/components/calendar/calendar.svelte';
import { CALENDAR_SYSTEMS, type CalendarSystem } from '../lib/utils/calendar-system.js';
import { __resetDevWarnings } from '../lib/utils/dev-warning.js';
import Probe from './fixtures/calendar-system-provider-probe.svelte';

const globals = globalThis as { Temporal?: unknown };
let savedTemporal: unknown;

beforeAll(() => {
	savedTemporal = globals.Temporal;
	delete globals.Temporal;
});

afterAll(() => {
	if (savedTemporal !== undefined) {
		globals.Temporal = savedTemporal;
	}
});

afterEach(() => {
	__resetDevWarnings();
	vi.restoreAllMocks();
});

async function renderProbe(
	provider: { locale: string; calendar?: CalendarSystem } | null,
	calendar?: CalendarSystem
) {
	const view = await render(Probe, { props: { provider, calendar } });
	const requested = view.getByTestId('requested').element().textContent;
	const shown = view.getByTestId('shown').element().textContent;
	view.unmount();
	return { requested, shown };
}

function silenceWarnings() {
	return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

describe('calendar resolution order', () => {
	it('is Gregorian without a provider', async () => {
		expect((await renderProbe(null)).shown).toBe('gregory');
	});

	it("uses the component's calendar over the provider's", async () => {
		expect(
			(await renderProbe({ locale: 'th-TH-u-ca-buddhist', calendar: 'roc' }, 'japanese')).shown
		).toBe('japanese');
	});

	it("uses the provider's calendar over a -u-ca- keyword in its locale", async () => {
		expect((await renderProbe({ locale: 'th-TH-u-ca-buddhist', calendar: 'roc' })).shown).toBe(
			'roc'
		);
	});

	it('ignores a -u-ca- keyword in the provider locale', async () => {
		const result = await renderProbe({ locale: 'th-TH-u-ca-buddhist' });
		expect(result.requested).toBe('gregory');
		expect(result.shown).toBe('gregory');
	});

	it("never applies a locale's default calendar", async () => {
		expect((await renderProbe({ locale: 'fa-IR' })).shown).toBe('gregory');
		expect((await renderProbe({ locale: 'th-TH' })).shown).toBe('gregory');
	});

	it('keeps the calendar independent of the language', async () => {
		expect((await renderProbe({ locale: 'en', calendar: 'buddhist' })).shown).toBe('buddhist');
	});
});

describe('calendar identifiers', () => {
	it.each(CALENDAR_SYSTEMS)('the provider accepts %s', async (calendar) => {
		silenceWarnings();
		expect((await renderProbe({ locale: 'en', calendar })).requested).toBe(calendar);
	});

	it('resolves the islamic identifier to gregory and warns', async () => {
		const warn = silenceWarnings();
		const islamic = 'islamic' as CalendarSystem;
		expect((await renderProbe({ locale: 'ar', calendar: islamic })).requested).toBe('gregory');
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('"islamic"'));
	});

	it('ignores a -u-ca-islamic keyword without a warning', async () => {
		const warn = silenceWarnings();
		expect((await renderProbe({ locale: 'ar-u-ca-islamic' })).requested).toBe('gregory');
		expect(warn).not.toHaveBeenCalled();
	});

	it('resolves an unknown identifier to gregory and warns once', async () => {
		const warn = silenceWarnings();
		const unknown = 'martian' as CalendarSystem;
		expect((await renderProbe({ locale: 'en', calendar: unknown })).shown).toBe('gregory');
		expect((await renderProbe(null, unknown)).shown).toBe('gregory');
		const unsupported = warn.mock.calls.filter(([message]) =>
			String(message).includes('"martian"')
		);
		expect(unsupported).toHaveLength(1);
	});
});

describe('without Temporal', () => {
	it('shows Gregorian for a calendar that needs Temporal and warns once for it', async () => {
		const warn = silenceWarnings();
		expect((await renderProbe({ locale: 'fa-IR', calendar: 'persian' })).shown).toBe('gregory');
		expect((await renderProbe(null, 'persian')).shown).toBe('gregory');
		expect((await renderProbe(null, 'hebrew')).shown).toBe('gregory');

		const messages = warn.mock.calls.map(([message]) => String(message));
		expect(messages.filter((m) => m.includes('"persian"'))).toHaveLength(1);
		expect(messages.filter((m) => m.includes('"hebrew"'))).toHaveLength(1);
		expect(messages[0]).toContain('temporal-polyfill/full/global');
	});

	it('treats a Temporal without the calendar as missing', async () => {
		const warn = silenceWarnings();
		// The default temporal-polyfill build knows only the ISO calendar.
		globals.Temporal = {
			PlainDate: class {
				constructor(_y: number, _m: number, _d: number, calendar: string) {
					if (calendar !== 'iso8601') {
						throw new RangeError(`Unknown calendar ${calendar}`);
					}
				}
			}
		};
		try {
			expect((await renderProbe(null, 'persian')).shown).toBe('gregory');
		} finally {
			delete globals.Temporal;
		}
		expect(String(warn.mock.calls[0]?.[0])).toContain('needs a Temporal that supports it');
	});

	it.each(['gregory', 'iso8601', 'buddhist', 'roc', 'japanese'] as const)(
		'shows %s with no warning',
		async (calendar) => {
			const warn = silenceWarnings();
			expect((await renderProbe(null, calendar)).shown).toBe(calendar);
			expect(warn).not.toHaveBeenCalled();
		}
	);

	it('renders a Persian Calendar as a Gregorian month', async () => {
		silenceWarnings();
		const view = await render(Calendar, {
			props: { calendar: 'persian', focusDate: '2026-10-30' }
		});
		await expect.element(view.getByRole('grid')).toHaveAttribute('aria-label', 'October 2026');
		view.unmount();
	});

	it('renders a Buddhist Calendar with Buddhist years', async () => {
		// The provider case is covered by the resolution tests above; render the
		// Buddhist calendar directly because the probe deletes Temporal and
		// Buddhist needs none.
		const view = await render(Calendar, {
			props: { calendar: 'buddhist', focusDate: '2026-10-30' }
		});
		expect(view.getByRole('grid').element().getAttribute('aria-label')).toContain('2569');
		view.unmount();
	});
});
