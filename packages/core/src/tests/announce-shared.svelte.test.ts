/** PORTS: hooks/useAnnounce.shared.test.ts */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSharedStateForTest } from '$lib/utils/shared-realm.js';

/**
 * Ported from Astryx's `hooks/useAnnounce.shared.test.ts` (0.7.13).
 *
 * Two loads of the announce module stand in for the package and a swizzled
 * copy. The channel itself comes from `sharedState`, so both loads write to the
 * one pair of live regions and join the one frame of messages.
 *
 * `vi.resetModules()` + dynamic import is the browser project's equivalent of
 * upstream's two import calls; the shared value lives on `globalThis`, which
 * module isolation does not reset, so only the reset helper below can.
 */

/** One load of the announcement channel, as the package or a copy has. */
async function load() {
	vi.resetModules();
	return import('$lib/hooks/use-announce.js');
}

afterEach(async () => {
	(await import('$lib/hooks/use-announce.js')).__resetLiveRegionsForTest();
	resetSharedStateForTest('hooks/');
	for (const region of document.querySelectorAll('[data-astryx-live-region]')) {
		region.remove();
	}
	vi.useRealTimers();
	vi.resetModules();
});

describe('one announcement channel for the package and a swizzled copy', () => {
	it('writes both loads to one pair of live regions', async () => {
		const pkg = await load();
		const copy = await load();
		pkg.announceMessage('Saved', 'polite');
		copy.announceMessage('Synced', 'polite');
		expect(document.querySelectorAll('[data-astryx-live-region]')).toHaveLength(2);
	});

	it("joins a copy's message into the package's pending frame", async () => {
		vi.useFakeTimers({
			toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout']
		});
		const pkg = await load();
		const copy = await load();
		pkg.announceMessage('Saved', 'polite');
		copy.announceMessage('Synced', 'polite');
		vi.advanceTimersToNextFrame();
		const texts = [...document.querySelectorAll('[data-astryx-live-region]')].map(
			(region) => region.textContent
		);
		expect(texts).toContain('Saved Synced');
	});
});
