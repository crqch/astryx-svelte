/** PORTS: Dialog/DialogTouchEntrance.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { TOUCH_QUERY } from '$lib/utils/touch-queries.js';
import DialogTouchProbe from './fixtures/dialog-touch-probe.svelte';

/**
 * Astryx's `Dialog/DialogTouchEntrance.test.tsx`, all four declarations.
 *
 * The same stands-in as upstream: a controllable entrance animation and a
 * coarse or fine primary pointer. The real browser would otherwise decide both
 * by timing and by the machine the suite runs on.
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
				effect: { getComputedTiming: () => ({ endTime: 300 }) }
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

describe('Dialog entrance (spec:AST-094 FR35)', () => {
	it("holds a finger's tap on its action while it enters, and lets one through once it has entered", async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DialogTouchProbe, { props: { isOpen: true, onact } });
		const act = buttonIn(screen.container, 'Act');
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		tap(act, 'touch', 1);
		expect(onact).not.toHaveBeenCalled();

		finishEntrance();
		await new Promise((resolve) => setTimeout(resolve, 20));
		tap(act, 'touch', 2);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it('lets input through again when it closes mid-entrance', async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DialogTouchProbe, { props: { isOpen: true, onact } });
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		await screen.rerender({ isOpen: false, onact });
		await new Promise((resolve) => setTimeout(resolve, 20));
		tap(buttonIn(screen.container, 'Outside'), 'touch', 1);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it("leaves a mouse's click alone, even where the primary pointer is a finger", async () => {
		stubPointer(true);
		const onact = vi.fn();
		const screen = await render(DialogTouchProbe, { props: { isOpen: true, onact } });
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		tap(buttonIn(screen.container, 'Act'), 'mouse', 1);
		expect(onact).toHaveBeenCalledTimes(1);
	});

	it("holds nothing where the primary pointer is a mouse, a finger's tap included (a touchscreen laptop: an implementation gap on FR35's adoption)", async () => {
		stubPointer(false);
		const onact = vi.fn();
		const screen = await render(DialogTouchProbe, { props: { isOpen: true, onact } });
		await vi.waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));

		tap(buttonIn(screen.container, 'Act'), 'touch', 1);
		expect(onact).toHaveBeenCalledTimes(1);
	});
});
