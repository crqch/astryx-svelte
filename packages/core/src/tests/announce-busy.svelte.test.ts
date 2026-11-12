/** PORTS: hooks/useBusyAnnouncement.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';
import AnnounceBusyProbe from './fixtures/announce-busy-probe.svelte';

/**
 * Ported from Astryx's `hooks/useBusyAnnouncement.test.tsx` at the 0.7.13 pin.
 *
 * Upstream's `renderHook` becomes a probe fixture that exports the settle
 * function as an instance member; `result.current` is `screen.component.settle`.
 * The `act` wrappers have no counterpart (a Svelte rAF callback needs no act),
 * and both fake-timer clocks name `requestAnimationFrame` and
 * `cancelAnimationFrame` explicitly because this is a real browser.
 */

function politeText(): string {
	return document.querySelector('[data-astryx-live-region="polite"]')?.textContent ?? '';
}

async function renderBusy() {
	const screen = await render(AnnounceBusyProbe, { props: { isBusy: true } });
	return screen;
}

function runFrames(): void {
	vi.advanceTimersByTime(50);
}

beforeEach(() => {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
	});
});

afterEach(() => {
	__resetLiveRegionsForTest();
	vi.useRealTimers();
});

describe('useBusyAnnouncement', () => {
	it('announces a busy start a frame after it begins', async () => {
		await renderBusy();
		runFrames();
		expect(politeText()).toBe('Loading');
	});

	it('drops a busy start its owner settled before it was announced (AST-086 FR8)', async () => {
		const screen = await renderBusy();
		screen.component.settle();
		runFrames();
		expect(politeText()).toBe('');
	});

	it('withdraws a busy start written to the channel but not yet exposed (AST-086 FR8)', async () => {
		const screen = await renderBusy();
		// The busy frame writes "Loading" to the channel; its exposing frame has
		// not run yet when the outcome announces and settles.
		vi.advanceTimersToNextFrame();
		screen.component.settle();
		runFrames();
		expect(politeText()).toBe('');
	});

	it('withdraws only its own busy start when another owner wrote the same words (AST-086 FR8, FR9)', async () => {
		const first = await renderBusy();
		const second = await renderBusy();
		// Both busy frames write "Loading" to the channel before it is exposed.
		vi.advanceTimersToNextFrame();
		// The first owner's search settles; the second is still busy.
		first.component.settle();
		runFrames();
		expect(politeText()).toBe('Loading');
		second.unmount();
	});

	it('keeps a settled busy start dropped until the next busy start', async () => {
		const screen = await renderBusy();
		screen.component.settle();
		// Still busy until the settled state commits: nothing is rescheduled,
		// even when the busy message changes (a locale switch, say).
		await screen.rerender({ isBusy: true, message: 'Chargement' });
		runFrames();
		expect(politeText()).toBe('');

		await screen.rerender({ isBusy: false });
		await screen.rerender({ isBusy: true, message: 'Loading' });
		runFrames();
		expect(politeText()).toBe('Loading');
	});
});
