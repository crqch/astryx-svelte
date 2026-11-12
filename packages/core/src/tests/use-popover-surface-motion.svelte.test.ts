/** PORTS: Popover/usePopoverSurfaceMotion.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PopoverSurfaceMotionProbe from './fixtures/popover-surface-motion-probe.svelte';
import { findPopoverExitCopy } from '$lib/private-attributes/popover-exit.stylex.js';
import { TOUCH_QUERY } from '$lib/utils/touch-queries.js';

/**
 * Ported from Astryx's `Popover/usePopoverSurfaceMotion.test.tsx` — all 4
 * cases, in upstream's order and under upstream's titles.
 *
 * Upstream mocks `createPopoverSurfaceMotion` and counts `enter`, `exit` and
 * `dispose` calls. This port's client setup imports the whole barrel before any
 * test file runs, so a hoisted module mock is the wrong instrument (see
 * `native-date-field.svelte.test.ts`'s header). Each case therefore drives the
 * real motion and observes the same decision at its observable edge: a fine
 * pointer leaves the layer without a style write and shows no exit copy; a
 * coarse one promotes the layer and places the exit copy on close; a later fine
 * open takes all of that back; and an unmount leaves nothing behind.
 *
 * `renderHook` has no Svelte counterpart; the probe fixture exposes
 * `present`/`closeStart` as instance members.
 */

let isTouch = false;

beforeEach(() => {
	isTouch = false;
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query === TOUCH_QUERY ? isTouch : false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

/** Two frames plus a task: the motion's scheduled read has run. */
async function presented(): Promise<void> {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await Promise.resolve();
}

function layerAndTrigger() {
	const layer = document.createElement('div');
	layer.setAttribute('popover', 'auto');
	layer.innerHTML = '<div role="dialog" aria-label="Filters"></div>';
	const trigger = document.createElement('button');
	document.body.append(layer, trigger);
	return { layer, trigger };
}

describe('usePopoverSurfaceMotion', () => {
	it('leaves a fine-pointer open untouched: nothing created, nothing promoted, and its close start plays nothing', async () => {
		const { layer, trigger } = layerAndTrigger();
		const screen = await render(PopoverSurfaceMotionProbe);

		screen.component.present(layer, trigger);
		screen.component.closeStart();
		await presented();

		expect(layer.getAttribute('style')).toBeNull();
		expect(findPopoverExitCopy(document)).toBeNull();
	});

	it('under a coarse pointer, grows the popover as it opens and shrinks it as its close starts', async () => {
		isTouch = true;
		const { layer, trigger } = layerAndTrigger();
		const screen = await render(PopoverSurfaceMotionProbe);

		screen.component.present(layer, trigger);
		await presented();
		expect(layer.style.getPropertyValue('scale')).not.toBe('');
		expect(findPopoverExitCopy(document)).toBeNull();

		screen.component.closeStart();
		expect(findPopoverExitCopy(document)).not.toBeNull();
	});

	it('a fine-pointer open after a touch one releases the touch motion, and its close start plays nothing', async () => {
		isTouch = true;
		const { layer, trigger } = layerAndTrigger();
		const screen = await render(PopoverSurfaceMotionProbe);

		screen.component.present(layer, trigger);
		await presented();
		expect(layer.style.getPropertyValue('scale')).not.toBe('');

		// The pointer turns fine (a keyboard attached) for the next open.
		isTouch = false;
		screen.component.present(layer, trigger);
		expect(layer.style.getPropertyValue('scale')).toBe('');
		screen.component.closeStart();
		expect(findPopoverExitCopy(document)).toBeNull();
	});

	it('releases the motion at unmount', async () => {
		isTouch = true;
		const { layer, trigger } = layerAndTrigger();
		const screen = await render(PopoverSurfaceMotionProbe);

		screen.component.present(layer, trigger);
		await presented();
		expect(layer.style.getPropertyValue('scale')).not.toBe('');
		screen.unmount();
		await Promise.resolve();
		expect(layer.style.getPropertyValue('scale')).toBe('');
		expect(findPopoverExitCopy(document)).toBeNull();
	});
});
