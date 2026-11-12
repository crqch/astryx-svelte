/** PORTS: Layer/presentationHold.test.tsx */

import { describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import * as core from '$lib/index.js';
import barrelSource from '$lib/index.ts?raw';
import pkgSource from '../../package.json?raw';
import {
	createPresentationHold,
	usePresentationHold
} from '$lib/components/layer/presentation-hold.svelte.js';
import PresentationHoldProbe from './fixtures/presentation-hold-probe.svelte';

/**
 * Ported from Astryx's `Layer/presentationHold.test.tsx` — 5 cases, 5 here.
 *
 * Svelte has no `renderHook`, so the `usePresentationHold` cases use the probe
 * fixture that renders the hook's getters. `release()` is called through the
 * probe's button (or its exported handle), and every assertion reads the DOM
 * after a flush, which is what a consumer observes.
 *
 * The "stays internal" case reads `src/lib/index.ts` through Vite's `?raw`
 * instead of `fs`, because this runs in the browser project; the package
 * export map is the same JSON upstream reads.
 */
describe('createPresentationHold', () => {
	it('holds what the opening chose until it is released', () => {
		const hold = createPresentationHold<'touch' | 'pointer'>();
		expect(hold.isHeld()).toBe(false);
		expect(hold.current()).toBeUndefined();
		hold.take('touch');
		expect(hold.current()).toBe('touch');
		expect(hold.isHeld()).toBe(true);
		hold.release();
		expect(hold.isHeld()).toBe(false);
		expect(hold.current()).toBeUndefined();
	});

	it('holds a false choice as held', () => {
		const hold = createPresentationHold<boolean>();
		hold.take(false);
		expect(hold.isHeld()).toBe(true);
		expect(hold.current()).toBe(false);
	});
});

describe('usePresentationHold', () => {
	it('holds the presentation from the render that opens it, whatever it becomes, until release', async () => {
		const screen = await render(PresentationHoldProbe, {
			props: { isOpen: false, presentation: 'sheet' }
		});
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('null');
		await expect.element(screen.getByTestId('is-held')).toHaveTextContent('false');

		await screen.rerender({ isOpen: true, presentation: 'sheet' });
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('sheet');
		await expect.element(screen.getByTestId('is-held')).toHaveTextContent('true');

		// The screen stops being compact while it is open: the hold keeps the
		// opening's choice, and keeps it through the close.
		await screen.rerender({ isOpen: true, presentation: 'anchored' });
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('sheet');

		await screen.rerender({ isOpen: false, presentation: 'anchored' });
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('sheet');
		await expect.element(screen.getByTestId('is-held')).toHaveTextContent('true');

		await screen.getByTestId('release').click();
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('null');
		await expect.element(screen.getByTestId('is-held')).toHaveTextContent('false');

		// The next opening chooses again.
		await screen.rerender({ isOpen: true, presentation: 'anchored' });
		await expect.element(screen.getByTestId('presentation')).toHaveTextContent('anchored');
	});

	it('keeps release stable across renders', async () => {
		const screen = await render(PresentationHoldProbe, { props: { isOpen: true } });
		const first = screen.component.getRelease();
		await screen.rerender({ isOpen: false });
		await tick();
		expect(screen.component.getRelease()).toBe(first);
	});

	it('stays internal: not exported from the package or the Layer barrel', () => {
		expect(core).not.toHaveProperty('usePresentationHold');
		expect(core).not.toHaveProperty('createPresentationHold');
		expect(barrelSource).not.toMatch(/presentationHold/);
		const pkg = JSON.parse(pkgSource) as { exports: Record<string, unknown> };
		expect(Object.keys(pkg.exports).filter((key) => key.includes('presentationHold'))).toEqual([]);
	});
});
