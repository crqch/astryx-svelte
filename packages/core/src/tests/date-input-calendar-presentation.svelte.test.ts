/** PORTS: DateInput/DateInput.calendarPresentation.test.tsx */
//
// Ported case for case. The `DateTimeInput surface in a calendar` matrix runs
// against the native date/time segments, and its explicit-native warning case
// mounts two fields in one render so the per-calendar `warnOnce` key is what
// the assertion measures.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { DateInputProps } from '$lib/components/date-input/date-input.svelte';
import type {
	DateTimeInputProps,
	ISODateTimeString
} from '$lib/components/date-time-input/date-time-input.svelte';
import { resetDateSegmentProbe } from '$lib/components/date-input/native-date-segments.js';
import type { CalendarSystem } from '$lib/utils/calendar-system.js';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';
import DateInputCalendarProbe from './fixtures/date-input-calendar-probe.svelte';
import DateTimeInputCalendarProbe from './fixtures/date-time-input-calendar-probe.svelte';

const HOVER_CAPABLE = /\(\s*hover\s*:\s*hover\s*\)/;

function stubPointer(pointer: Pointer): void {
	const isCoarse = pointer === 'coarse';
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: /pointer:\s*coarse/.test(query)
			? isCoarse
			: /pointer:\s*fine/.test(query)
				? !isCoarse
				: HOVER_CAPABLE.test(query),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	}));
}

beforeEach(() => {
	__resetDevWarnings();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	resetDateSegmentProbe();
});

type Pointer = 'fine' | 'coarse';
type Surface = 'native' | 'sheet' | 'popover';
type PresentationProps = Pick<DateInputProps, 'presentation' | 'nativePicker'>;

/** The surface on screen, read from the date control the field renders. */
function surfaceShown(): Surface {
	if (document.querySelector('input[type="date"]') != null) {
		return 'native';
	}
	const input = document.querySelector<HTMLInputElement>('input');
	return input?.getAttribute('inputmode') === 'none' ? 'sheet' : 'popover';
}

async function renderField(
	locale: string,
	props: Partial<DateInputProps>,
	providerCalendar?: 'persian'
) {
	await render(DateInputCalendarProbe, {
		props: { locale, props, providerCalendar, onChange: () => {} }
	});
}

async function renderDateTimeField(
	locale: string,
	props: Partial<Omit<DateTimeInputProps, 'label' | 'onChange'>>,
	count = 1
) {
	await render(DateTimeInputCalendarProbe, {
		props: { locale, props, count, onChange: () => {} }
	});
}

// [props, Gregorian fine, Gregorian coarse, Persian fine, Persian coarse]
const MATRIX: ReadonlyArray<[string, PresentationProps, Surface, Surface, Surface, Surface]> = [
	['default', {}, 'popover', 'native', 'popover', 'sheet'],
	['adaptive-native', { presentation: 'adaptive-native' }, 'popover', 'native', 'popover', 'sheet'],
	['native', { presentation: 'native' }, 'native', 'native', 'popover', 'sheet'],
	['popover', { presentation: 'popover' }, 'popover', 'popover', 'popover', 'popover'],
	['bottom-sheet', { presentation: 'bottom-sheet' }, 'sheet', 'sheet', 'sheet', 'sheet'],
	[
		'adaptive-bottom-sheet',
		{ presentation: 'adaptive-bottom-sheet' },
		'popover',
		'sheet',
		'popover',
		'sheet'
	],
	['nativePicker="touch"', { nativePicker: 'touch' }, 'popover', 'native', 'popover', 'sheet'],
	['nativePicker="always"', { nativePicker: 'always' }, 'native', 'native', 'popover', 'sheet'],
	['nativePicker="never"', { nativePicker: 'never' }, 'popover', 'sheet', 'popover', 'sheet']
];

const CASES = MATRIX.flatMap(
	([name, props, gregoryFine, gregoryCoarse, persianFine, persianCoarse]) =>
		[
			['gregory', 'fine', gregoryFine],
			['gregory', 'coarse', gregoryCoarse],
			['persian', 'fine', persianFine],
			['persian', 'coarse', persianCoarse]
		].map(
			([calendar, pointer, surface]) =>
				[name, calendar, pointer, surface, props] as [
					string,
					CalendarSystem,
					Pointer,
					Surface,
					PresentationProps
				]
		)
);

describe('DateInput surface in a calendar', () => {
	it.each(CASES)(
		'%s in %s on a %s pointer shows the %s',
		async (_name, calendar, pointer, surface, props) => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			stubPointer(pointer);
			await renderField('en', { calendar, value: '2026-11-02', ...props });
			expect(surfaceShown()).toBe(surface);
		}
	);

	it('takes the calendar from the provider', async () => {
		stubPointer('coarse');
		await renderField('en', { value: '2026-11-02' }, 'persian');
		expect(surfaceShown()).toBe('sheet');
		expect(document.querySelector('input')).toHaveValue('Aban 11, 1405 AP');
	});

	it('writes the sheet field text in the calendar', async () => {
		stubPointer('coarse');
		await renderField('en', { calendar: 'persian', value: '2026-11-02' });
		expect(document.querySelector('input')).toHaveValue('Aban 11, 1405 AP');
	});

	it('warns once when an explicit native cannot show the calendar', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubPointer('coarse');
		for (let round = 0; round < 2; round += 1) {
			const view = await render(DateInputCalendarProbe, {
				props: {
					locale: 'en',
					props: { calendar: 'persian', presentation: 'native' },
					onChange: () => {}
				}
			});
			view.unmount();
		}
		const messages = warn.mock.calls
			.map(([message]) => String(message))
			.filter((message) => message.includes('presentation="native"'));
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('"persian"');
	});

	it.each([
		['the default', {}],
		['nativePicker="always"', { nativePicker: 'always' }],
		['an explicit native in Gregorian', { presentation: 'native' }]
	] as const)('does not warn for %s', async (_name, props) => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubPointer('coarse');
		await renderField(
			'en',
			{ calendar: 'presentation' in props ? 'gregory' : 'persian', ...props },
			undefined
		);
		expect(
			warn.mock.calls.filter(([message]) => String(message).includes('presentation="native"'))
		).toHaveLength(0);
	});
});

describe('DateTimeInput surface in a calendar', () => {
	/** The date surface on screen; the time segment follows the same policy. */
	function dateTimeSurfaceShown(): Surface {
		if (document.querySelector('input[type="date"]') != null) {
			return 'native';
		}
		return document.querySelector('input[inputmode="none"]') != null ? 'sheet' : 'popover';
	}

	it.each(CASES)(
		'%s in %s on a %s pointer shows the %s',
		async (_name, calendar, pointer, surface, props) => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			stubPointer(pointer);
			await renderDateTimeField('en', {
				calendar,
				value: '2026-11-02T09:00' as ISODateTimeString,
				...props
			});
			expect(dateTimeSurfaceShown()).toBe(surface);
			if (surface !== 'native') {
				expect(document.querySelector('input[type="time"]')).toBeNull();
			}
		}
	);

	it('warns once when an explicit native cannot show the calendar', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubPointer('fine');
		await renderDateTimeField('en', { calendar: 'hebrew', presentation: 'native' }, 2);
		const messages = warn.mock.calls
			.map(([message]) => String(message))
			.filter((message) => message.includes('presentation="native"'));
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('DateTimeInput');
	});

	it.each([
		['en', 'persian', 'Aban 11, 1405 AP'],
		['fa-IR', 'persian', '۱۱ آبان ۱۴۰۵ ه‍.ش.'],
		['th-TH', 'buddhist', '2 พฤศจิกายน พ.ศ. 2569']
	] as const)(
		'writes the sheet date segment in %s %s with its era',
		async (locale, calendar, text) => {
			stubPointer('coarse');
			await render(DateTimeInputCalendarProbe, {
				props: {
					locale,
					props: {
						calendar,
						value: '2026-11-02T09:00' as ISODateTimeString
					},
					onChange: () => {}
				}
			});
			expect(document.querySelector('input[inputmode="none"]')).toHaveValue(text);
		}
	);
});
