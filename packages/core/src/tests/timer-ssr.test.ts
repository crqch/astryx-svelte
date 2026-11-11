/** PORTS: Timer/Timer.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import Timer from '$lib/components/timer/timer.svelte';

/**
 * The SSR half of Astryx's `Timer/Timer.test.tsx` — the same suite as
 * `timer.svelte.test.ts`, split out because `renderToString` only exists in the
 * server project. One case, ported verbatim in intent: the server's markup is
 * zero-duration whatever the clock says, and the client effect is what makes it
 * move.
 */
describe('Timer (server)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps server markup independent of the clock', () => {
		const firstMarkup = render(Timer, { props: { startTime: 0 } }).body;
		const firstClockMarkup = render(Timer, {
			props: { startTime: 0, format: 'clock' }
		}).body;

		vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
		const secondMarkup = render(Timer, { props: { startTime: 0 } }).body;
		const secondClockMarkup = render(Timer, {
			props: { startTime: 0, format: 'clock' }
		}).body;

		expect(firstMarkup).toBe(secondMarkup);
		expect(firstMarkup).toContain('datetime="PT0S"');
		expect(firstMarkup).toContain('>0s</time>');
		expect(firstClockMarkup).toBe(secondClockMarkup);
		expect(firstClockMarkup).toContain('>0:00</time>');
	});
});
