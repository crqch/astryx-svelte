/** PORTS: gestures/__tests__/useGestureRecognizer.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { getGestureHost } from '$lib/gestures/gesture-host.js';
import { TapGestureRecognizer } from '$lib/gestures/tap-gesture-recognizer.js';
import type { ControlEvent } from '$lib/gestures/press-tracker.js';
import { lockSelection } from '$lib/utils/selection-lock.js';
import PressTrackerProbe from './fixtures/press-tracker-probe.svelte';
import { coarsePrimaryPointer, pointerQuery } from './gestures/pointer-query.js';

/**
 * Astryx's `gestures/__tests__/useGestureRecognizer.test.tsx`, the
 * `usePressTracker` half (13 declarations). The recognizer half is in
 * `use-gesture-recognizer.svelte.test.ts`.
 */

function touch(
	type: string,
	target: EventTarget,
	contact: { id: number; x: number; y: number },
	time: number,
	isLift = false
): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const entry = { identifier: contact.id, clientX: contact.x, clientY: contact.y, target };
	Object.defineProperty(event, 'changedTouches', { value: [entry] });
	Object.defineProperty(event, 'touches', { value: isLift ? [] : [entry] });
	Object.defineProperty(event, 'timeStamp', { value: time });
	target.dispatchEvent(event);
}

function boundsOf(element: HTMLElement, width: number, height: number): void {
	Object.defineProperty(element, 'getBoundingClientRect', {
		configurable: true,
		value: () => ({
			left: 0,
			top: 0,
			right: width,
			bottom: height,
			width,
			height,
			x: 0,
			y: 0,
			toJSON: () => ({})
		})
	});
}

function testId(container: HTMLElement, id: string): HTMLElement {
	const found = container.querySelector(`[data-testid="${id}"]`);
	if (!(found instanceof HTMLElement)) throw new Error(`expected ${id}`);
	return found;
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
	document.body.replaceChildren();
});

describe('usePressTracker', () => {
	it('gives the host no listener while the control is disabled (FR24)', async () => {
		const add = vi.spyOn(window, 'addEventListener');
		const remove = vi.spyOn(window, 'removeEventListener');
		const screen = await render(PressTrackerProbe, { props: { isDisabled: true } });
		const added = () => add.mock.calls.filter(([type]) => type === 'touchstart').length;
		expect(added()).toBe(0);
		await screen.rerender({ isDisabled: false });
		await vi.waitFor(() => expect(added()).toBe(1));
		await screen.rerender({ isDisabled: true });
		await vi.waitFor(() =>
			expect(remove.mock.calls.filter(([type]) => type === 'touchstart').length).toBe(1)
		);
		screen.unmount();
	});

	it('ends a press whose control, the only enabled one, is disabled under the finger', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 11, x: 1, y: 1 }, 0);
		expect(events).toEqual(['touchDown']);
		await screen.rerender({ isDisabled: true });
		await tick();
		expect(events).toEqual(['touchDown']);
		touch('touchend', button, { id: 11, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown']);
	});

	it('ends a press disabled under the finger while another control keeps the host listening', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		const other = document.createElement('div');
		document.body.append(other);
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 12, x: 1, y: 1 }, 0);
		expect(events).toEqual(['touchDown']);
		await screen.rerender({ isDisabled: true });
		await tick();
		expect(events).toEqual(['touchDown']);
		touch('touchend', button, { id: 12, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown']);
	});

	it('reports UIControl events for a tap', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 5, x: 1, y: 1 }, 0);
		touch('touchend', button, { id: 5, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown', 'touchUpInside']);
	});

	it('locks selection and the callout for each press of a control whose hold acts', async () => {
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: () => {}, selectionLock: lockSelection }
		});
		const button = testId(screen.container, 'button');
		const refuses = () => {
			const event = new Event('selectstart', { bubbles: true, cancelable: true });
			button.dispatchEvent(event);
			return event.defaultPrevented;
		};
		touch('touchstart', button, { id: 3, x: 1, y: 1 }, 0);
		expect(refuses()).toBe(true);
		touch('touchend', button, { id: 3, x: 1, y: 1 }, 50, true);
		expect(refuses()).toBe(false);
	});

	it('takes an option changed after mount from the next touch', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		await screen.rerender({ cancelTravel: 5 });
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 7, x: 1, y: 1 }, 0);
		touch('touchmove', button, { id: 7, x: 1, y: 11 }, 16);
		expect(events).toEqual(['touchDown', 'touchCancel']);
		touch('touchend', button, { id: 7, x: 1, y: 11 }, 50, true);
	});

	it('ends a held press on unmount without calling back', async () => {
		const highlights: boolean[] = [];
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				onHighlightChange: (isHighlighted: boolean) => highlights.push(isHighlighted)
			}
		});
		touch('touchstart', testId(screen.container, 'button'), { id: 9, x: 1, y: 1 }, 0);
		const seenHighlights = [...highlights];
		const seenEvents = [...events];
		screen.unmount();
		expect(highlights).toEqual(seenHighlights);
		expect(events).toEqual(seenEvents);
	});

	it('gives a press tracker a mouse press where the primary pointer is fine', async () => {
		const pointer = pointerQuery(false);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const held: ControlEvent[] = [];
			const inactive: ControlEvent[] = [];
			const first = await render(PressTrackerProbe, {
				props: { onEvent: (event: ControlEvent) => held.push(event), perEventPointer: true }
			});
			const activeButton = testId(first.container, 'button');
			boundsOf(activeButton, 44, 44);
			const mouse = (type: string, target: Element, id: number) => {
				const event = new PointerEvent(type, {
					bubbles: true,
					cancelable: true,
					composed: true,
					pointerId: id,
					pointerType: 'mouse',
					clientX: 5,
					clientY: 5,
					button: 0,
					buttons: type === 'pointerdown' ? 1 : 0
				});
				target.dispatchEvent(event);
			};
			mouse('pointerdown', activeButton, 1);
			mouse('pointerup', activeButton, 1);
			expect(held).toEqual(['touchDown', 'touchUpInside']);

			const second = await render(PressTrackerProbe, {
				props: { onEvent: (event: ControlEvent) => inactive.push(event) }
			});
			const other = testId(second.container, 'button');
			boundsOf(other, 44, 44);
			mouse('pointerdown', other, 2);
			mouse('pointerup', other, 2);
			expect(inactive).toEqual(['touchDown', 'touchUpInside']);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
			pointer.restore();
		}
	});

	it('passes isBraking through to the tracker', async () => {
		const events: ControlEvent[] = [];
		const isBraking = vi.fn(() => true);
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event), isBraking }
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 8, x: 1, y: 1 }, 0);
		touch('touchend', button, { id: 8, x: 1, y: 1 }, 50, true);
		expect(isBraking).toHaveBeenCalled();
		expect(events).not.toContain('touchDown');
	});

	it("uses the caller's scroll brake", async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event), isBraking: () => true }
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 8, x: 1, y: 1 }, 0);
		touch('touchend', button, { id: 8, x: 1, y: 1 }, 50, true);
		expect(events).toEqual([]);
	});

	it('tracks the element behind the ref when it is replaced', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		await screen.rerender({ which: 'other' });
		const second = testId(screen.container, 'other');
		touch('touchstart', second, { id: 10, x: 1, y: 1 }, 0);
		touch('touchend', second, { id: 10, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown', 'touchUpInside']);
	});

	it('presses nothing for a touch that brakes a scroll', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		const button = testId(screen.container, 'button');
		const brake = vi.spyOn(getGestureHost(document), 'isScrollBraking').mockReturnValue(true);
		touch('touchstart', button, { id: 7, x: 1, y: 1 }, 0);
		touch('touchend', button, { id: 7, x: 1, y: 1 }, 50, true);
		expect(events).toEqual([]);
		brake.mockRestore();
	});

	it("keeps the tracker's own ancestor veto when the caller gives none", async () => {
		const screen = await render(PressTrackerProbe);
		const tracker = screen.component.getTracker();
		const tap = new TapGestureRecognizer({});
		expect(tracker.allowsAncestorRecognizer(tap)).toBe(false);
		const notATap = {
			kind: 'swipe',
			isDiscrete: true,
			numberOfTapsRequired: 1,
			numberOfTouchesRequired: 1,
			view: null
		};
		expect(tracker.allowsAncestorRecognizer(notATap as never)).toBe(true);
	});
});

describe('usePressTracker follows its element and its options', () => {
	it('tracks a node rendered after mount', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { show: false, onEvent: (event: ControlEvent) => events.push(event) }
		});
		await screen.rerender({ show: true });
		const stepper = testId(screen.container, 'button');
		touch('touchstart', stepper, { id: 1, x: 2, y: 2 }, 0);
		touch('touchend', stepper, { id: 1, x: 2, y: 2 }, 60, true);
		expect(events).toContain('touchUpInside');
	});

	it("uses the caller's brake", async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				isBraking: () => true
			}
		});
		const stepper = testId(screen.container, 'button');
		touch('touchstart', stepper, { id: 1, x: 2, y: 2 }, 0);
		touch('touchend', stepper, { id: 1, x: 2, y: 2 }, 60, true);
		expect(events).not.toContain('touchDown');
		expect(events).not.toContain('touchUpInside');
	});

	it('takes a highlight delay changed after mount from the next touch', async () => {
		vi.useFakeTimers();
		const highlights: boolean[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				highlightDelay: 'never',
				onHighlightChange: (isOn: boolean) => highlights.push(isOn)
			}
		});
		await screen.rerender({ highlightDelay: 'always' });
		const stepper = testId(screen.container, 'button');
		touch('touchstart', stepper, { id: 1, x: 2, y: 2 }, 0);
		expect(highlights).toEqual([]);
		touch('touchend', stepper, { id: 1, x: 2, y: 2 }, 400, true);
		vi.useRealTimers();
	});

	it('calls no callback from cleanup when it unmounts while highlighted', async () => {
		const highlights: boolean[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				highlightDelay: 'never',
				onHighlightChange: (isOn: boolean) => highlights.push(isOn)
			}
		});
		const stepper = testId(screen.container, 'button');
		touch('touchstart', stepper, { id: 1, x: 2, y: 2 }, 0);
		expect(highlights).toEqual([true]);
		screen.unmount();
		expect(highlights).toEqual([true]);
	});
});

describe('usePressTracker hit-tests the element behind its ref now', () => {
	it("judges a lift against the swapped node's bounds", async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: { onEvent: (event: ControlEvent) => events.push(event) }
		});
		await screen.rerender({ which: 'other' });
		const b = testId(screen.container, 'other');
		boundsOf(b, 100, 40);
		touch('touchstart', b, { id: 1, x: 10, y: 10 }, 0);
		touch('touchmove', b, { id: 1, x: 400, y: 400 }, 16);
		touch('touchend', b, { id: 1, x: 400, y: 400 }, 32, true);
		expect(events).toContain('touchDown');
		expect(events).toContain('touchUpOutside');
		expect(events).not.toContain('touchUpInside');
	});
});

describe('usePressTracker keeps its press through an option change', () => {
	it('a press in progress survives a rerender with new options', async () => {
		const events: ControlEvent[] = [];
		const highlights: boolean[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				onHighlightChange: (isOn: boolean) => highlights.push(isOn)
			}
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 6, x: 1, y: 1 }, 0);
		expect(highlights).toEqual([true]);
		await screen.rerender({
			cancelTravel: 50,
			onEvent: (event: ControlEvent) => events.push(event),
			onHighlightChange: (isOn: boolean) => highlights.push(isOn)
		});
		expect(highlights).toEqual([true]);
		touch('touchend', button, { id: 6, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown', 'touchUpInside']);
	});
});

describe('the hooks let go of an element removed while they stay mounted', () => {
	it('usePressTracker ends its press without calling back, and presses a new element', async () => {
		const events: ControlEvent[] = [];
		const highlights: boolean[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				onHighlightChange: (isOn: boolean) => highlights.push(isOn)
			}
		});
		touch('touchstart', testId(screen.container, 'button'), { id: 13, x: 1, y: 1 }, 0);
		expect(highlights).toEqual([true]);
		await screen.rerender({ show: false });
		expect(highlights).toEqual([true]);
		expect(events).toEqual(['touchDown']);
		await screen.rerender({ show: true });
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 14, x: 1, y: 1 }, 100);
		touch('touchend', button, { id: 14, x: 1, y: 1 }, 150, true);
		expect(events).toEqual(['touchDown', 'touchDown', 'touchUpInside']);
	});
});

describe('usePressTracker reads trackingExpansion as it is now', () => {
	it('a smaller expansion takes effect without rebuilding the tracker', async () => {
		const events: ControlEvent[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				trackingExpansion: 70
			}
		});
		const button = testId(screen.container, 'button');
		boundsOf(button, 100, 40);
		touch('touchstart', button, { id: 15, x: 10, y: 10 }, 0);
		touch('touchmove', button, { id: 15, x: 10, y: 70 }, 16);
		expect(events).not.toContain('touchDragExit');
		await screen.rerender({
			trackingExpansion: 10,
			onEvent: (event: ControlEvent) => events.push(event)
		});
		touch('touchmove', button, { id: 15, x: 10, y: 71 }, 32);
		expect(events).toContain('touchDragExit');
		touch('touchend', button, { id: 15, x: 10, y: 71 }, 48, true);
		expect(events).toContain('touchUpOutside');
	});
});

describe('usePressTracker under a replayed effect run', () => {
	// RESTATED: Svelte does not replay effects the way React's StrictMode does.
	// The contract is one tracker for the component's life; an unrelated option
	// change leaves the live press alone.
	it('a press in progress survives a rerender with new options', async () => {
		const events: ControlEvent[] = [];
		const highlights: boolean[] = [];
		const screen = await render(PressTrackerProbe, {
			props: {
				onEvent: (event: ControlEvent) => events.push(event),
				onHighlightChange: (isOn: boolean) => highlights.push(isOn)
			}
		});
		const button = testId(screen.container, 'button');
		touch('touchstart', button, { id: 16, x: 1, y: 1 }, 0);
		expect(highlights).toEqual([true]);
		await screen.rerender({
			cancelTravel: 50,
			onEvent: (event: ControlEvent) => events.push(event),
			onHighlightChange: (isOn: boolean) => highlights.push(isOn)
		});
		expect(highlights).toEqual([true]);
		touch('touchend', button, { id: 16, x: 1, y: 1 }, 50, true);
		expect(events).toEqual(['touchDown', 'touchUpInside']);
	});
});
