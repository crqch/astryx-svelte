/** PORTS: gestures/__tests__/passiveByDefault.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { GestureHost } from '$lib/gestures/gesture-host.js';
import { createPressTracker } from '$lib/gestures/press-tracker.js';
import { ManualClock } from './gestures/harness.js';
import { coarsePrimaryPointer } from './gestures/pointer-query.js';
import PassiveDefaultProbe from './fixtures/passive-default-probe.svelte';

/**
 * Astryx's `gestures/__tests__/passiveByDefault.test.tsx`, both declarations.
 * The first case renders this port's Button and Item instead of React's; the
 * second uses the host directly, as upstream does.
 */

function touchStart(target: Element): void {
	const event = new Event('touchstart', { bubbles: true, cancelable: true });
	const entry = { identifier: 1, clientX: 5, clientY: 5, target };
	Object.defineProperty(event, 'changedTouches', { value: [entry] });
	Object.defineProperty(event, 'touches', { value: [entry] });
	target.dispatchEvent(event);
}

function blockingTouchMoves(spy: { mock: { calls: unknown[][] } }): number {
	return spy.mock.calls.filter(
		([type, , options]) =>
			type === 'touchmove' && (options as AddEventListenerOptions | undefined)?.passive === false
	).length;
}

let restorePointer: () => void;

beforeEach(() => {
	Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
	restorePointer = coarsePrimaryPointer();
});

afterEach(() => {
	restorePointer();
	delete (window as { ontouchstart?: unknown }).ontouchstart;
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('blocking touchmove listeners', () => {
	it('never come with a plain Button or an Item cell', async () => {
		const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
		const screen = await render(PassiveDefaultProbe);
		const button = screen.container.querySelector('button');
		const row = [...screen.container.querySelectorAll('*')].find(
			(element) => element.textContent === 'Row' && element !== screen.container
		);
		if (!(button instanceof Element) || !(row instanceof Element)) {
			throw new Error('expected a button and an item row');
		}
		touchStart(button);
		touchStart(row);
		expect(blockingTouchMoves(spy)).toBe(0);
	});

	it('come only with a press tracker that keeps its touch', () => {
		document.body.innerHTML = '<div id="plain"></div><div id="stepper"></div>';
		const plain = document.getElementById('plain') as HTMLElement;
		const stepper = document.getElementById('stepper') as HTMLElement;
		const host = new GestureHost(document, { clock: new ManualClock() });
		const onPlain = vi.spyOn(plain, 'addEventListener');
		const onStepper = vi.spyOn(stepper, 'addEventListener');
		const detachPlain = host.attachConsumer(plain, createPressTracker({ getBounds: () => null }));
		const detachStepper = host.attachConsumer(
			stepper,
			createPressTracker({ getBounds: () => null, keepsTouch: true })
		);
		touchStart(plain);
		expect(blockingTouchMoves(onPlain)).toBe(0);
		expect(blockingTouchMoves(onStepper)).toBe(1);
		detachPlain();
		detachStepper();
	});
});
