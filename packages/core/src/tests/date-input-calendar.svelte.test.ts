/** PORTS: DateInput/DateInput.calendar.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import type { DateInputProps } from '$lib/components/date-input/date-input.svelte';
import { formatCalendarDateHint } from '$lib/utils/calendar-date-parser.js';
import type { ISODateString } from '$lib/utils/date-types.js';
import { plainDateFromISO } from '$lib/utils/plain-date.js';
import DateInputCalendarProbe from './fixtures/date-input-calendar-probe.svelte';

/**
 * Astryx's `DateInput/DateInput.calendar.test.tsx`, ported case for case.
 *
 * The harness translations are the ones `date-input.svelte.test.ts` already
 * documents:
 * - upstream wraps `<DateInput>` in `InternationalizationProvider` inline; the
 *   provider's `children` is a snippet here, so `date-input-calendar-probe`
 *   carries the pair and a caller-supplied `onChange`.
 * - `fireEvent.change` is React's `onChange`, which is the native `input`
 *   event this port binds: assignment plus a bubbling `input` event.
 * - `fireEvent.blur`/`focus` are the native events; a state write flushes on
 *   its own, so the `tick()` between change and blur is upstream's second
 *   render, not a workaround.
 * - `toHaveAccessibleDescription` becomes the same matcher over the ids in
 *   `aria-describedby`, as `date-time-input.svelte.test.ts` does.
 *
 * The hint cases keep upstream's fake `Date`, which `plainDateToday()` reads.
 */

function inputIn(container: HTMLElement): HTMLInputElement {
	const input = container.querySelector<HTMLInputElement>('input[role="combobox"]');
	if (input == null) {
		throw new Error('no combobox input');
	}
	return input;
}

function describedText(el: HTMLElement): string {
	return (el.getAttribute('aria-describedby') ?? '')
		.split(' ')
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent ?? '')
		.join(' ');
}

async function changeValue(input: HTMLInputElement, value: string): Promise<void> {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
}

async function blur(input: HTMLInputElement): Promise<void> {
	input.dispatchEvent(new FocusEvent('blur'));
	await tick();
}

async function focus(input: HTMLInputElement): Promise<void> {
	input.focus();
	await tick();
}

async function keyDown(input: HTMLInputElement, init: KeyboardEventInit): Promise<void> {
	input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
	await tick();
}

/** Types text one character at a time, as a person does. */
async function typeSlowly(input: HTMLInputElement, text: string): Promise<void> {
	let typed = '';
	for (const ch of text) {
		typed += ch;
		input.value = typed;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	await tick();
}

// A shown status describes the input and announces itself; the alert stays
// empty, so nothing is spoken twice.
function expectShown(input: HTMLInputElement, box: HTMLElement, text: string): void {
	expect(describedText(input)).toContain(text);
	const alert = box.querySelector('[role="alert"]');
	expect(alert?.textContent ?? '').toBe('');
}

async function renderField(
	locale: string,
	props: Partial<DateInputProps> = {},
	providerCalendar?: 'persian'
) {
	const onChange = vi.fn();
	const view = await render(DateInputCalendarProbe, {
		props: { locale, props, providerCalendar, onChange }
	});
	const input = inputIn(view.container);
	return { view, input, onChange };
}

const iso = (value: string): ISODateString => value as ISODateString;

describe('DateInput typed entry with a calendar', () => {
	it('reports one Persian date typed in Persian digits, only when complete', async () => {
		const { input, onChange } = await renderField('fa-IR', { calendar: 'persian' });
		await typeSlowly(input, '۱۴۰۵/۸/۱۱');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-11-02');
	});

	it('takes the calendar from the provider', async () => {
		const { input, onChange } = await renderField('fa-IR', {}, 'persian');
		await typeSlowly(input, '1405/8/11');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-11-02');
	});

	it('writes the committed value in the calendar and keeps ISO values', async () => {
		const { view } = await renderField('en', { calendar: 'persian', value: '2026-11-02' });
		await expect.element(view.getByRole('combobox')).toHaveValue('Aban 11, 1405 AP');
	});

	it('keeps system_date ISO and reads ISO input with it', async () => {
		const { input, onChange } = await renderField('fa-IR', {
			calendar: 'persian',
			format: 'system_date',
			value: '2026-11-02'
		});
		expect(input.value).toBe('2026-11-02');
		await changeValue(input, '2026-11-03');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-11-03');
	});

	it('reads a plain Adar in a Hebrew leap year as Adar II', async () => {
		const { input, onChange } = await renderField('en', { calendar: 'hebrew' });
		await changeValue(input, '1 Adar 5784');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2024-03-11');
	});

	it('reads Japanese era dates and rejects a year outside its era', async () => {
		const { input, onChange, view } = await renderField('en', { calendar: 'japanese' });
		await changeValue(input, 'May 1, 1 Reiwa');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2019-05-01');

		await changeValue(input, 'May 1, 31 Heisei');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expectShown(input, view.container, 'This date does not exist in the Japanese Calendar');
	});

	it('rejects a date the calendar does not have and keeps it on blur', async () => {
		const { input, onChange, view } = await renderField('en', {
			calendar: 'persian',
			value: '2026-11-02',
			status: { type: 'warning', message: 'Check the date' }
		});
		await changeValue(input, '12/30/1404 AP');
		expectShown(input, view.container, 'This date does not exist in the Persian Calendar');
		await blur(input);
		expect(input.value).toBe('12/30/1404 AP');
		expectShown(input, view.container, 'This date does not exist in the Persian Calendar');
		expect(onChange).not.toHaveBeenCalled();
	});

	it('shows an out-of-range error with the bounds in the calendar', async () => {
		const { input, onChange, view } = await renderField('en', {
			calendar: 'buddhist',
			min: '2026-01-01',
			max: '2026-12-31'
		});
		// A Gregorian year typed into a Buddhist field is Buddhist year 2026.
		await changeValue(input, '11/2/2026');
		expect(onChange).not.toHaveBeenCalled();
		expectShown(
			input,
			view.container,
			'Enter a date from January 1, 2569 BE to December 31, 2569 BE'
		);
		await changeValue(input, '11/2/2569');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-11-02');
	});

	it('announces a different message for each kind of rejection', async () => {
		const { input, view } = await renderField('en', {
			calendar: 'persian',
			max: '2026-12-31'
		});
		await changeValue(input, 'abc');
		expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Invalid date');
		await changeValue(input, '12/30/1404 AP');
		expectShown(input, view.container, 'does not exist in the Persian Calendar');
		await changeValue(input, '1/1/1406 AP');
		expectShown(input, view.container, 'on or before Dey 10, 1405 AP');
	});

	it('reports nothing for partial input and stays silent while it grows', async () => {
		const { input, onChange, view } = await renderField('fa-IR', { calendar: 'persian' });
		for (const text of ['۱', '۱۴۰۵', '۱۴۰۵/', '۱۴۰۵/۸', '۱۴۰۵/۸/', '۱۴۰۵/۸/۱']) {
			await changeValue(input, text);
			expect(input).not.toHaveAttribute('aria-invalid');
			expect(view.container.querySelector('[role="alert"]')?.textContent ?? '').toBe('');
		}
		expect(onChange).not.toHaveBeenCalled();
	});

	it('commits a partial-looking date on blur', async () => {
		const { input, onChange } = await renderField('fa-IR', { calendar: 'persian' });
		await changeValue(input, '۱۴۰۵/۸/۱');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-10-23');
	});

	it('shows a format hint in the empty focused field', async () => {
		const { input } = await renderField('en', { calendar: 'persian' });
		expect(input).toHaveAttribute('placeholder', 'Select a date');
		await focus(input);
		expect(input.getAttribute('placeholder')).toMatch(/^e\.g\., \d+\/\d+\/\d+ AP$/);
		await blur(input);
		expect(input).toHaveAttribute('placeholder', 'Select a date');
	});

	describe('format hint example date', () => {
		// 2026-11-07 is a Saturday.
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2026, 10, 7, 12));
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		async function hintFor(props: Partial<DateInputProps>) {
			const { input } = await renderField('en', { calendar: 'persian', ...props });
			await focus(input);
			return input.getAttribute('placeholder');
		}
		const hintOf = (isoDate: ISODateString) =>
			`e.g., ${formatCalendarDateHint(plainDateFromISO(isoDate), 'en', 'persian')}`;

		it('uses max when max is before today', async () => {
			expect(await hintFor({ max: '2026-03-15' })).toBe(hintOf(iso('2026-03-15')));
		});

		it('uses min when min is after today', async () => {
			expect(await hintFor({ min: '2027-02-01' })).toBe(hintOf(iso('2027-02-01')));
		});

		it('uses the nearest weekday when today is a disabled Saturday', async () => {
			expect(
				await hintFor({
					dateConstraints: [(date) => date.getDay() !== 0 && date.getDay() !== 6]
				})
			).toBe(hintOf(iso('2026-11-06')));
		});
	});

	it('shows a caller placeholder instead of the format hint', async () => {
		const { input } = await renderField('en', {
			calendar: 'persian',
			placeholder: 'Pick a day'
		});
		await focus(input);
		expect(input.value).toBe('');
		expect(input).toHaveAttribute('placeholder', 'Pick a day');
	});

	it('opens its calendar in the same calendar', async () => {
		const { input } = await renderField('en', {
			calendar: 'persian',
			value: '2026-11-02'
		});
		await keyDown(input, { key: 'ArrowDown' });
		const grid = document.querySelector('[role="grid"]');
		expect(grid?.getAttribute('aria-label')).toBe('Aban 1405 AP');
	});

	it('names the calendar in the description', async () => {
		const { input } = await renderField('en', { calendar: 'hebrew' });
		expect(describedText(input)).toBe('Dates use the Hebrew Calendar');
	});

	it('names no calendar when the field uses the provider calendar', async () => {
		const { input } = await renderField('fa-IR', {}, 'persian');
		expect(input).not.toHaveAttribute('aria-describedby');
		await focus(input);
		expect(input.getAttribute('placeholder')).toMatch(/^e\.g\./);
	});

	it('names the Gregorian calendar inside a Persian provider', async () => {
		const { input } = await renderField('en', { calendar: 'gregory' }, 'persian');
		expect(describedText(input)).toBe('Dates use the Gregorian Calendar');
		await focus(input);
		expect(input).toHaveAttribute('placeholder', 'Select a date');
	});

	it('names no calendar for an iso8601 field in a Gregorian provider', async () => {
		const { input } = await renderField('en', { calendar: 'iso8601' });
		expect(input).not.toHaveAttribute('aria-describedby');
	});

	it('names the Persian calendar without a provider calendar', async () => {
		const { input } = await renderField('en', { calendar: 'persian' });
		expect(describedText(input)).toBe('Dates use the Persian Calendar');
	});

	it('keeps the Gregorian field free of a hint and a calendar description', async () => {
		const { input } = await renderField('en');
		await focus(input);
		expect(input).toHaveAttribute('placeholder', 'Select a date');
		expect(input).not.toHaveAttribute('aria-describedby');
	});
});

describe('DateInput onChange while typing a Gregorian date', () => {
	it('fires once for a day-first date typed one key at a time', async () => {
		const { input, onChange } = await renderField('en-GB');
		await typeSlowly(input, '12/01/2026');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-01-12');
	});

	it('commits a two-digit year in the locale order on blur', async () => {
		const { input, onChange } = await renderField('en-GB');
		await typeSlowly(input, '12/01/90');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('1990-01-12');
	});

	it('commits Gregorian text that only parseDateInput reads, on blur only', async () => {
		const { input, onChange, view } = await renderField('en-US');
		await changeValue(input, '2026-01-25 10:00');
		expect(onChange).not.toHaveBeenCalled();
		expect(input).not.toHaveAttribute('aria-invalid');
		expect(view.container.querySelector('[role="alert"]')?.textContent ?? '').toBe('');
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-01-25');
	});

	it('commits a day-first date that parseDateInput reads, on Enter only', async () => {
		const { input, onChange } = await renderField('en-US');
		await changeValue(input, '25/1/2026');
		expect(onChange).not.toHaveBeenCalled();
		await keyDown(input, { key: 'Enter' });
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-01-25');
	});

	it('commits a day-first date that does not exist month-first, on blur only', async () => {
		const { input, onChange } = await renderField('en-US');
		await typeSlowly(input, '13/5/2026');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-05-13');
	});

	it('commits a month-first date that does not exist day-first, on blur', async () => {
		const { input, onChange } = await renderField('en-GB');
		await changeValue(input, '5/13/2026');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-05-13');
	});

	it('never falls back to a month-first reading in a day-first locale', async () => {
		const { input, onChange } = await renderField('en-GB');
		await changeValue(input, '12/01/2026 10:00');
		await blur(input);
		expect(onChange).not.toHaveBeenCalled();
		expect(input.value).toBe('');
	});

	it.each(['blur', 'Enter'])(
		'keeps a one-digit year on %s and announces it as invalid',
		async (commit) => {
			const { input, onChange, view } = await renderField('en-US');
			await typeSlowly(input, '1/5/2');
			const alert = view.container.querySelector('[role="alert"]');
			expect(alert?.textContent ?? '').toBe('');
			if (commit === 'blur') {
				await blur(input);
			} else {
				await keyDown(input, { key: 'Enter' });
			}
			expect(input.value).toBe('1/5/2');
			expect(input).toHaveAttribute('aria-invalid', 'true');
			expectShown(input, view.container, 'Invalid date');
			expect(onChange).not.toHaveBeenCalled();
		}
	);

	it.each([
		['en-GB', '31/02/2026'],
		['en-US', '2/30/2026']
	])(
		'still rejects a Gregorian date that does not exist in either order (%s %s)',
		async (locale, text) => {
			const { input, onChange, view } = await renderField(locale);
			await changeValue(input, text);
			await blur(input);
			expect(input.value).toBe(text);
			expectShown(input, view.container, 'This date does not exist in the Gregorian Calendar');
			expect(onChange).not.toHaveBeenCalled();
		}
	);

	it('never reads a date that does not exist in another calendar with parseDateInput', async () => {
		const { input, onChange, view } = await renderField('en', { calendar: 'persian' });
		await changeValue(input, '13/5/1405 AP');
		await blur(input);
		expect(input.value).toBe('13/5/1405 AP');
		expectShown(input, view.container, 'This date does not exist in the Persian Calendar');
		expect(onChange).not.toHaveBeenCalled();
	});

	it.each([
		['fa-IR', 'persian', '1404/12/30'],
		['sv-SE', 'gregory', '2026-02-30']
	] as const)(
		'reports no date while %s %s text grows to a day the month lacks',
		async (locale, calendar, text) => {
			const { input, onChange } = await renderField(locale, { calendar });
			await typeSlowly(input, text);
			expect(onChange).not.toHaveBeenCalled();
		}
	);

	it('reports a retyped date again after the caller keeps its value', async () => {
		const { input, onChange } = await renderField('en-US', { value: '2026-01-01' });
		for (let round = 1; round <= 2; round += 1) {
			await typeSlowly(input, '11/2/2026');
			await blur(input);
			expect(onChange).toHaveBeenCalledTimes(round);
		}
	});

	it('does not fire again on blur for a date it already reported', async () => {
		const { input, onChange } = await renderField('en-US');
		await changeValue(input, '11/2/2026');
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('2026-11-02');
	});
});
