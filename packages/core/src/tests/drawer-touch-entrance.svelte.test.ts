/** PORTS: Drawer/DrawerTouchEntrance.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { TOUCH_QUERY } from '$lib/utils/touch-queries.js';
import DrawerTouchProbe from './fixtures/drawer-touch-probe.svelte';

/**
 * Astryx's `Drawer/DrawerTouchEntrance.test.tsx`, all four declarations.
 *
 * Upstream stubs `getAnimations` because jsdom runs no CSS transition; this
 * browser has real ones, but a deterministic hold is the contract under test,
 * so the same stand-in is installed and its `finished` promise is resolved by
 * the case. `matchMedia` is stubbed the same way to choose the primary pointer.
 */
let finishEntrance: () => void = () => {};

function stubPointer(coarse: boolean): void {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: coarse && query === TOUCH_QUERY,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		}))
	);
}

beforeEach(() => {
	const finished = new Promise<void>((resolve) => {
		finishEntrance = resolve;
	});
	Object.defineProperty(Element.prototype, 'getAnimations', {
		configurable: true,
		value: () => [
			{
				playState: 'running',
				finished,
				effect: { getComputedTiming: () => ({ endTime: 250 }) }
			}
		]
	});
});

afterEach(() => {
	delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const INIT = { bubbles: true, cancelable: true, composed: true };

/** A press and its click, as a browser sends them for `pointerType`. */
function tap(element: Element, pointerType: string, pointerId: number): void {
	element.dispatchEvent(new PointerEvent('pointerdown', { ...INIT, pointerId, pointerType }));
	element.dispatchEvent(new PointerEvent('pointerup', { ...INIT, pointerId, pointerType }));
	element.dispatchEvent(
		new MouseEvent('click', { ...INIT, pointerType, detail: 1 } as MouseEventInit)
	);
}

function buttonIn(container: HTMLElement, name: string): HTMLElement {
	const found = [...container.querySelectorAll('button')].find(
		(button) => button.textContent?.trim() === name
	);
	if (!(found instanceof HTMLElement)) throw new Error(`expected a ${name} button`);
	return found;
}

describe('Drawer slide-in (spec:AST-094 FR35)', () => {
	it("holds a finger's tap while it slides in, and lets one through once the slide-in ends", async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DrawerTouchProbe, { props: { isOpen: true, onact } });
		const act = buttonIn(screen.container, 'Act');
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		tap(act, 'touch', 1);
		expect(onact).not.toHaveBeenCalled();

		finishEntrance();
		await new Promise((resolve) => setTimeout(resolve, 20));
		tap(act, 'touch', 2);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it("holds only a non-modal drawer's panel: a finger's tap on the page beside it acts", async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DrawerTouchProbe, {
			props: { isOpen: true, hasScrim: false, onact }
		});
		const act = buttonIn(screen.container, 'Act');
		const outside = buttonIn(screen.container, 'Outside');
		await vi.waitFor(() =>
			expect(document.querySelector('dialog')?.matches(':popover-open')).toBe(true)
		);

		tap(act, 'touch', 1);
		expect(onact).not.toHaveBeenCalled();
		tap(outside, 'touch', 2);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it('lets input through again when it closes mid-slide', async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DrawerTouchProbe, { props: { isOpen: true, onact } });
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		await screen.rerender({ isOpen: false, onact });
		await new Promise((resolve) => setTimeout(resolve, 20));
		tap(buttonIn(screen.container, 'Outside'), 'touch', 1);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it("leaves a mouse's click alone, even where the primary pointer is a finger", async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DrawerTouchProbe, { props: { isOpen: true, onact } });
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		tap(buttonIn(screen.container, 'Act'), 'mouse', 1);
		expect(onact).toHaveBeenCalledTimes(1);
	});
});
