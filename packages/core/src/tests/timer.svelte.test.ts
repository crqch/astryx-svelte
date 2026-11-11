/** PORTS: Timer/Timer.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { tick } from 'svelte';
import Timer from '$lib/components/timer/timer.svelte';

/**
 * Ported from Astryx's `Timer/Timer.test.tsx` at the **0.7.13** pin.
 *
 * ## The two React-only cases
 *
 * Upstream declares 19 cases across `Timer` and `Timer hardening guards`.
 * Seventeen are here, plus the SSR case in `timer-ssr.test.ts`; the two that
 * remain are about React's commit model and have no Svelte counterpart:
 *
 * - `does not schedule React update commits as time advances` wraps Timer in
 *   `Profiler` and counts commits. Svelte has no `Profiler`, and the behavior it
 *   protects — the elapsed text is written to the owned `<time>` node rather
 *   than driving a render — is what every format case here observes.
 * - `owns one timer resource and cleans up under StrictMode replay` asserts
 *   React's `StrictMode` double-invocation (two `setTimeout`, one
 *   `clearTimeout`, then a second on unmount). Svelte does not replay effects,
 *   so the counterpart asserts **one** timer and one clear on unmount; the
 *   resource contract that matters — no timer survives the component — is the
 *   same.
 *
 * The ref half of `forwards its time ref and preserves Timestamp-style root
 * styling and time props` is dropped: Svelte's counterpart is `bind:ref`, and
 * observing a bound value from a test needs a one-off probe wrapper. The
 * pass-through half is ported here unchanged.
 *
 * `act()` has no counterpart; a direct DOM write needs no flush. `waitFor`
 * becomes `expect.element`, which retries the same way.
 */
describe('Timer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('renders deterministic zero-duration markup for each standard format', async () => {
		const screen = await render(Timer, { props: { 'data-testid': 'timer' } });
		const timer = screen.getByTestId('timer');

		await expect.element(timer).toHaveTextContent('0s');
		expect(timer.element().tagName).toBe('TIME');
		expect(timer.element()).toHaveAttribute('datetime', 'PT0S');

		await screen.rerender({ format: 'clock', 'data-testid': 'timer' });
		await expect.element(timer).toHaveTextContent('0:00');
		expect(timer.element()).toHaveAttribute('datetime', 'PT0S');
	});

	it('derives elapsed time from the clock without accumulating callback count', async () => {
		let scheduledTick: (() => void) | undefined;
		let timerCalls = 0;
		vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
			if (delay === 1000) {
				timerCalls += 1;
				scheduledTick = callback as () => void;
			}
			return 1 as unknown as ReturnType<typeof setTimeout>;
		});

		const screen = await render(Timer, { props: { 'data-testid': 'timer' } });

		vi.setSystemTime(new Date('2026-09-22T00:00:08.750Z'));
		scheduledTick?.();
		await tick();

		await expect.element(screen.getByTestId('timer')).toHaveTextContent('8s');
		expect(screen.getByTestId('timer').element()).toHaveAttribute('datetime', 'PT8S');
		expect(timerCalls).toBe(1);
	});

	it('formats elapsed durations across seconds, minutes, and hours', async () => {
		const now = Date.now();
		const screen = await render(Timer, {
			props: { startTime: now - 34_000, 'data-testid': 'timer' }
		});
		const timer = screen.getByTestId('timer');
		await expect.element(timer).toHaveTextContent('34s');
		expect(timer.element()).toHaveAttribute('datetime', 'PT34S');

		await screen.rerender({ startTime: now - 128_000, 'data-testid': 'timer' });
		await expect.element(timer).toHaveTextContent('2m 08s');
		expect(timer.element()).toHaveAttribute('datetime', 'PT128S');

		await screen.rerender({ startTime: now - 3_753_000, 'data-testid': 'timer' });
		await expect.element(timer).toHaveTextContent('1h 02m');
		expect(timer.element()).toHaveAttribute('datetime', 'PT3720S');
	});

	it('formats clock durations across minutes and hours', async () => {
		const now = Date.now();
		const screen = await render(Timer, {
			props: { format: 'clock', startTime: now - 128_000, 'data-testid': 'timer' }
		});
		const timer = screen.getByTestId('timer');
		await expect.element(timer).toHaveTextContent('2:08');
		expect(timer.element()).toHaveAttribute('datetime', 'PT128S');

		await screen.rerender({
			format: 'clock',
			startTime: now - 3_753_000,
			'data-testid': 'timer'
		});
		await expect.element(timer).toHaveTextContent('1:02:33');
		expect(timer.element()).toHaveAttribute('datetime', 'PT3753S');
	});

	it('uses second cadence until elapsed format reaches an hour, then minute cadence', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const startTime = Date.now() - 3_599_000;
		const screen = await render(Timer, { props: { startTime, 'data-testid': 'timer' } });
		const timer = screen.getByTestId('timer');

		await expect.element(timer).toHaveTextContent('59m 59s');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

		vi.advanceTimersByTime(1000);
		await tick();
		await expect.element(timer).toHaveTextContent('1h 00m');
		expect(timer.element()).toHaveAttribute('datetime', 'PT3600S');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
	});

	it('keeps clock format on second cadence after an hour', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const screen = await render(Timer, {
			props: {
				format: 'clock',
				startTime: Date.now() - 3_723_000,
				'data-testid': 'timer'
			}
		});

		await expect.element(screen.getByTestId('timer')).toHaveTextContent('1:02:03');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
	});

	it('counts from a finite caller-provided start time', async () => {
		const now = Date.now();
		const screen = await render(Timer, {
			props: { startTime: now - 12_400, 'data-testid': 'timer' }
		});

		await expect.element(screen.getByTestId('timer')).toHaveTextContent('12s');
		expect(screen.getByTestId('timer').element()).toHaveAttribute('datetime', 'PT12S');
	});

	it('returns to the original mount origin when startTime is removed', async () => {
		const mountedAt = Date.now();
		const screen = await render(Timer, {
			props: { startTime: mountedAt - 10_000, 'data-testid': 'timer' }
		});

		vi.advanceTimersByTime(2000);
		await tick();
		await screen.rerender({ startTime: undefined, 'data-testid': 'timer' });

		await expect.element(screen.getByTestId('timer')).toHaveTextContent(/^2s$/);
		expect(screen.getByTestId('timer').element()).toHaveAttribute('datetime', 'PT2S');
	});

	it('falls back to mount time for a non-finite start time', async () => {
		const screen = await render(Timer, {
			props: { startTime: Number.NaN, 'data-testid': 'timer' }
		});

		vi.advanceTimersByTime(2000);
		await tick();

		await expect.element(screen.getByTestId('timer')).toHaveTextContent('2s');
	});

	it('clamps a future origin to zero and schedules its first visible change directly', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const screen = await render(Timer, {
			props: { startTime: Date.now() + 5000, 'data-testid': 'timer' }
		});
		const timer = screen.getByTestId('timer');

		await expect.element(timer).toHaveTextContent('0s');
		expect(timer.element()).toHaveAttribute('datetime', 'PT0S');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 6000);

		vi.advanceTimersByTime(6000);
		await tick();
		await expect.element(timer).toHaveTextContent('1s');
		expect(timer.element()).toHaveAttribute('datetime', 'PT1S');
	});

	it('updates format without remounting or losing current elapsed time', async () => {
		const now = Date.now();
		const screen = await render(Timer, {
			props: { startTime: now - 3_723_000, 'data-testid': 'timer' }
		});
		const timer = screen.getByTestId('timer');
		const before = timer.element();
		await expect.element(timer).toHaveTextContent('1h 02m');
		expect(before).toHaveAttribute('datetime', 'PT3720S');

		await screen.rerender({
			format: 'clock',
			startTime: now - 3_723_000,
			'data-testid': 'timer'
		});
		expect(screen.getByTestId('timer').element()).toBe(before);
		await expect.element(timer).toHaveTextContent('1:02:03');
		expect(before).toHaveAttribute('datetime', 'PT3723S');
	});

	it('matches Timestamp typography defaults and accepts overrides', async () => {
		const screen = await render(Timer, { props: { 'data-testid': 'timer' } });
		const timer = screen.getByTestId('timer');
		const text = timer.element().parentElement;

		expect(text).toHaveClass('astryx-text');
		expect(text).toHaveClass('astryx-timer');
		expect(text).toHaveAttribute('data-type', 'supporting');
		expect(text).toHaveAttribute('data-color', 'secondary');

		await screen.rerender({
			type: 'body',
			size: 'lg',
			color: 'primary',
			weight: 'bold',
			'data-testid': 'timer'
		});
		expect(text).toHaveAttribute('data-type', 'body');
		expect(text).toHaveAttribute('data-size', 'lg');
		expect(text).toHaveAttribute('data-color', 'primary');
	});

	it('preserves Timestamp-style root styling and time props', async () => {
		const onClick = vi.fn();
		const screen = await render(Timer, {
			props: {
				id: 'elapsed',
				class: 'custom-class',
				style: 'color: rgb(1, 2, 3)',
				'aria-live': 'polite',
				onclick: onClick,
				'data-testid': 'timer'
			}
		});

		const timer = screen.getByTestId('timer');
		const text = timer.element().parentElement;
		expect(timer.element()).toHaveAttribute('id', 'elapsed');
		expect(text).toHaveClass('astryx-timer');
		expect(text).toHaveClass('custom-class');
		expect(text).toHaveStyle({ color: 'rgb(1, 2, 3)' });
		expect(timer.element()).toHaveAttribute('aria-live', 'polite');

		await userEvent.click(timer);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('does not add live-region semantics by default', async () => {
		const screen = await render(Timer, { props: { 'data-testid': 'timer' } });
		const timer = screen.getByTestId('timer');

		expect(timer.element()).not.toHaveAttribute('aria-live');
		expect(timer.element()).not.toHaveAttribute('role');
	});

	it('clears its timer on unmount', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
		const screen = await render(Timer, { props: { 'data-testid': 'timer' } });

		expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
		screen.unmount();
		expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
	});

	it('caps the wait for a distant future origin at the 32-bit timeout ceiling', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		await render(Timer, {
			props: { startTime: Date.now() + 30 * 24 * 60 * 60 * 1000, 'data-testid': 'timer' }
		});

		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2_147_483_647);
	});

	it('coerces an unknown format to elapsed', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const now = Date.now();
		const screen = await render(Timer, {
			props: {
				format: 'stopwatch' as never,
				startTime: now - 3_723_000,
				'data-testid': 'timer'
			}
		});

		await expect.element(screen.getByTestId('timer')).toHaveTextContent('1h 02m');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 57_000);

		await screen.rerender({
			format: 'clock',
			startTime: now - 3_723_000,
			'data-testid': 'timer'
		});
		await expect.element(screen.getByTestId('timer')).toHaveTextContent('1:02:03');
	});
});
