/** PORTS: hooks/useAnnounce.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnnounce, __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';

/**
 * Ported from Astryx's `hooks/useAnnounce.test.tsx` at the 0.7.13 pin.
 *
 * This hook holds no state of its own and touches no component context, so the
 * test calls it directly where upstream reaches for `result.current`. It does
 * need a document, which is why it is a `.svelte.test.ts` and runs in the
 * browser project.
 *
 * `waitFor` becomes `expect.element`, which retries the same way. The one
 * assertion that must *not* retry is the synchronous "cleared" check in the
 * re-announce case: the region is refilled on the next frame, so a retrying
 * matcher would race the rAF it is meant to observe. That one reads
 * `textContent` directly.
 *
 * Upstream's `act(() => …)` wrappers have no counterpart here: a plain DOM
 * mutation needs no flush. What the frame cases *do* need is a faked
 * `requestAnimationFrame`. Upstream gets one for free — its jsdom rAF is built
 * on `setTimeout`, so faking timers fakes it too — but these run in a real
 * browser, where rAF is native and vitest 4 does not fake it by default.
 * `withFakeTimers` names it explicitly, so `advanceTimersByTime` drives both
 * the announce's rAF and the clear's timeout as one clock.
 */

afterEach(() => {
	__resetLiveRegionsForTest();
});

/** Run `body` under a fake clock that also drives `requestAnimationFrame`. */
function withFakeTimers(body: () => void): void {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
	});
	try {
		body();
	} finally {
		vi.useRealTimers();
	}
}

function politeRegion(): HTMLElement | null {
	return document.querySelector('[data-astryx-live-region="polite"]');
}
function assertiveRegion(): HTMLElement | null {
	return document.querySelector('[data-astryx-live-region="assertive"]');
}
function regionFor(politeness: 'polite' | 'assertive'): HTMLElement | null {
	return politeness === 'polite' ? politeRegion() : assertiveRegion();
}

describe('useAnnounce', () => {
	it.each(['polite', 'assertive'] as const)(
		'cancels every queued %s write when cleared',
		(politeness) => {
			withFakeTimers(() => {
				const announce = useAnnounce();
				announce('First', politeness);
				announce('Second', politeness);
				const region = regionFor(politeness)!;
				const write = vi.spyOn(region, 'textContent', 'set');
				announce('', politeness);
				vi.advanceTimersByTime(50);
				expect(write.mock.calls).toEqual([['']]);
				write.mockRestore();
			});
		}
	);

	it.each(['polite', 'assertive'] as const)(
		'joins %s messages announced in the same frame, in order (AST-086 FR9)',
		(politeness) => {
			withFakeTimers(() => {
				const announce = useAnnounce();
				announce('3 results', politeness);
				announce('Filter applied', politeness);
				const region = regionFor(politeness)!;
				const write = vi.spyOn(region, 'textContent', 'set');
				vi.advanceTimersByTime(50);
				// One write exposes both; neither is dropped or exposed alone.
				expect(write.mock.calls).toEqual([['3 results Filter applied']]);
				write.mockRestore();
			});
		}
	);

	it('keeps an identical message repeated in the same frame once (AST-086 FR9)', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('1 result');
			announce('Filter applied');
			announce('1 result');
			vi.advanceTimersByTime(50);
			expect(politeRegion()!.textContent).toBe('1 result Filter applied');
		});
	});

	it('starts a new announcement for a message after the joined one is exposed (AST-086 FR9)', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('First');
			announce('Second');
			vi.advanceTimersByTime(50);
			expect(politeRegion()).toHaveTextContent('First Second');
			announce('Third');
			vi.advanceTimersByTime(50);
			expect(politeRegion()!.textContent).toBe('Third');
		});
	});

	it('clears messages joined but not yet exposed (AST-086 FR9)', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('First');
			announce('Second');
			announce('');
			announce('Third');
			vi.advanceTimersByTime(50);
			// The clear dropped First and Second; only the later message is exposed.
			expect(politeRegion()!.textContent).toBe('Third');
		});
	});

	it('cancels queued writes on reset', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('Saved');
			announce('Failed', 'assertive');
			const polite = politeRegion()!;
			const assertive = assertiveRegion()!;
			__resetLiveRegionsForTest();
			vi.advanceTimersByTime(50);
			expect(polite.textContent).toBe('');
			expect(assertive.textContent).toBe('');
		});
	});

	it('mounts empty polite and assertive live regions on first announce', () => {
		const announce = useAnnounce();
		// Regions do not exist until first use.
		expect(politeRegion()).toBeNull();

		announce('Saved');

		// Both regions exist after the first announce, before content settles.
		expect(politeRegion()).not.toBeNull();
		expect(assertiveRegion()).not.toBeNull();
		expect(politeRegion()).toHaveAttribute('aria-live', 'polite');
		expect(politeRegion()).toHaveAttribute('aria-atomic', 'true');
		expect(politeRegion()).toHaveAttribute('role', 'status');
		expect(assertiveRegion()).toHaveAttribute('aria-live', 'assertive');
		expect(assertiveRegion()).toHaveAttribute('role', 'alert');
	});

	it('announces a polite message into the polite region', async () => {
		const announce = useAnnounce();
		announce('12 results');
		await expect.element(politeRegion()).toHaveTextContent('12 results');
		// Assertive region stays empty.
		expect(assertiveRegion()).toHaveTextContent('');
	});

	it('routes assertive messages to the assertive region', async () => {
		const announce = useAnnounce();
		announce('Upload failed', 'assertive');
		await expect.element(assertiveRegion()).toHaveTextContent('Upload failed');
		expect(politeRegion()).toHaveTextContent('');
	});

	it('re-announces an identical message (clears then re-sets)', async () => {
		const announce = useAnnounce();
		announce('No results found');
		await expect.element(politeRegion()).toHaveTextContent('No results found');
		// Second identical announce should still land (region is cleared first).
		announce('No results found');
		expect(politeRegion()).toHaveTextContent('');
		await expect.element(politeRegion()).toHaveTextContent('No results found');
	});

	it('ignores empty messages', () => {
		const announce = useAnnounce();
		announce('');
		// No regions created for an empty announce.
		expect(politeRegion()).toBeNull();
	});

	it('clears the region after the clear delay, but not before', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('Saved');
			// Flush the rAF that re-sets the message.
			vi.advanceTimersByTime(50);
			expect(politeRegion()?.textContent).toBe('Saved');

			// The message survives long enough for AT to finish reading it.
			vi.advanceTimersByTime(1000);
			expect(politeRegion()?.textContent).toBe('Saved');

			// After the clear delay, stale status text is removed from the DOM.
			vi.advanceTimersByTime(10_000);
			expect(politeRegion()?.textContent).toBe('');
		});
	});

	it('resets the clear timer on each announce', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('first');
			vi.advanceTimersByTime(1500);
			// Announcing again must reset the pending clear, not inherit it.
			announce('second');
			vi.advanceTimersByTime(1900);
			// 3.4s after 'first' (past its clear point) but only 1.9s after
			// 'second' — the newer message must still be present.
			expect(politeRegion()?.textContent).toBe('second');
			vi.advanceTimersByTime(10_000);
			expect(politeRegion()?.textContent).toBe('');
		});
	});

	it('re-announces normally after a clear', () => {
		withFakeTimers(() => {
			const announce = useAnnounce();
			announce('gone soon');
			vi.advanceTimersByTime(10_000);
			expect(politeRegion()?.textContent).toBe('');

			// The clear-then-rAF re-announce pattern still works after a clear.
			announce('back again');
			vi.advanceTimersByTime(50);
			expect(politeRegion()?.textContent).toBe('back again');
		});
	});

	it('reuses the same singleton regions across hook instances', async () => {
		const a = useAnnounce();
		a('first');
		const region = politeRegion();

		const b = useAnnounce();
		b('second');
		await expect.element(politeRegion()).toHaveTextContent('second');
		// Same DOM node, not a duplicate.
		expect(politeRegion()).toBe(region);
		expect(document.querySelectorAll('[data-astryx-live-region="polite"]').length).toBe(1);
	});
});
