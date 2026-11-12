/** PORTS: DateTimeInput/DateTimeInput.calendar.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import type { DateTimeInputProps } from '$lib/components/date-time-input/date-time-input.svelte';
import type { ISODateTimeString } from '$lib/components/date-time-input/date-time-input.svelte';
import DateTimeInputCalendarProbe from './fixtures/date-time-input-calendar-probe.svelte';

/**
 * Astryx's `DateTimeInput/DateTimeInput.calendar.test.tsx`, ported case for
 * case.
 *
 * The harness translations are `date-input-calendar.svelte.test.ts`'s:
 * `date-time-input-calendar-probe` carries the provider the React tree nested
 * inline, `fireEvent.change` is the native `input` event this port binds, and
 * the matcher reads the ids in `aria-describedby`.
 *
 * The date half is the first combobox; the time half is a textbox unless
 * `timeOptionInterval` gives it a listbox.
 */

function dateInputIn(container: HTMLElement): HTMLInputElement {
	const input = container.querySelector<HTMLInputElement>('input[role="combobox"]');
	if (input == null) {
		throw new Error('no date combobox');
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

async function typeSlowly(input: HTMLInputElement, text: string): Promise<void> {
	let typed = '';
	for (const ch of text) {
		typed += ch;
		input.value = typed;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	await tick();
}

// A shown status describes the input and announces itself; no alert repeats
// it.
function expectShown(input: HTMLInputElement, box: HTMLElement, text: string): void {
	expect(describedText(input)).toContain(text);
	const alerts = [...box.querySelectorAll('[role="alert"]')].map(
		(alert) => alert.textContent ?? ''
	);
	expect(alerts).not.toContain(text);
}

async function renderField(
	locale: string,
	props: Partial<DateTimeInputProps> = {},
	providerCalendar?: 'persian'
) {
	const onChange = vi.fn();
	const view = await render(DateTimeInputCalendarProbe, {
		props: { locale, props, providerCalendar, onChange }
	});
	const input = dateInputIn(view.container);
	return { view, input, onChange };
}

const dt = (value: string): ISODateTimeString => value as ISODateTimeString;

describe('DateTimeInput typed date entry with a calendar', () => {
	it('reports one Persian date typed in Persian digits, only when complete', async () => {
		const { input, onChange } = await renderField('fa-IR', { calendar: 'persian' });
		await typeSlowly(input, '۱۴۰۵/۸/۱۱');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toMatch(/^2026-11-02T/);
	});

	it('writes the committed date in the calendar', async () => {
		const { view } = await renderField('en', {
			calendar: 'hebrew',
			value: dt('2024-03-11T09:30')
		});
		await expect.element(view.getByRole('combobox')).toHaveValue('1 Adar II 5784 AM');
	});

	it('rejects a date the calendar does not have and names the calendar', async () => {
		const { input, onChange, view } = await renderField('en', {
			calendar: 'hebrew',
			status: { type: 'warning', message: 'Check the date' }
		});
		await changeValue(input, '1 Adar I 5785');
		await blur(input);
		expect(onChange).not.toHaveBeenCalled();
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expectShown(input, view.container, 'This date does not exist in the Hebrew Calendar');
		expect(input.value).toBe('1 Adar I 5785');
	});

	it('shows an out-of-range error with the bounds in the calendar', async () => {
		const { input, onChange, view } = await renderField('en', {
			calendar: 'japanese',
			min: dt('2019-05-01T00:00')
		});
		await changeValue(input, 'April 30, 31 Heisei');
		expect(onChange).not.toHaveBeenCalled();
		expectShown(input, view.container, 'Enter a date on or after May 1, 1 Reiwa');
	});

	it('names the calendar and shows the hint when focused and empty', async () => {
		const { input } = await renderField('en', { calendar: 'persian' });
		expect(describedText(input)).toBe('Dates use the Persian Calendar');
		await focus(input);
		expect(input.getAttribute('placeholder')).toMatch(/^e\.g\., .+ AP$/);
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

	it('names no calendar when the field uses the provider calendar', async () => {
		const { input } = await renderField('fa-IR', {}, 'persian');
		expect(input).not.toHaveAttribute('aria-describedby');
		await focus(input);
		expect(input.getAttribute('placeholder')).toMatch(/^e\.g\./);
	});

	it('names the Gregorian calendar inside a Persian provider', async () => {
		const { input } = await renderField('en', { calendar: 'gregory' }, 'persian');
		expect(describedText(input)).toBe('Dates use the Gregorian Calendar');
	});

	it('commits Gregorian text that only parseDateInput reads on blur', async () => {
		const { input, onChange } = await renderField('en-US');
		await changeValue(input, '2026-01-25 10:00');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toMatch(/^2026-01-25T/);
	});

	it('commits a day-first date that does not exist month-first, on blur only', async () => {
		const { input, onChange } = await renderField('en-US');
		await typeSlowly(input, '13/5/2026');
		expect(onChange).not.toHaveBeenCalled();
		await blur(input);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toMatch(/^2026-05-13T/);
	});

	it('fires once for a day-first Gregorian date typed one key at a time', async () => {
		const { input, onChange } = await renderField('en-GB');
		await typeSlowly(input, '12/01/2026');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toMatch(/^2026-01-12T/);
	});
});
