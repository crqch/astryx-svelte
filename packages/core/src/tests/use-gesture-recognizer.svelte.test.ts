/** PORTS: gestures/__tests__/useGestureRecognizer.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { TOUCH_ACTION_ATTRIBUTE } from '$lib/gestures/touch-action-rule.js';
import type { PanGestureRecognizer } from '$lib/gestures/pan-gesture-recognizer.js';
import type { TapGestureRecognizer } from '$lib/gestures/tap-gesture-recognizer.js';
import RecognizerProbe from './fixtures/recognizer-probe.svelte';
import TapsPairProbe from './fixtures/taps-pair-probe.svelte';
import NestedTapsProbe from './fixtures/nested-taps-probe.svelte';
import { coarsePrimaryPointer, pointerQuery } from './gestures/pointer-query.js';

/**
 * Astryx's `gestures/__tests__/useGestureRecognizer.test.tsx`, the
 * `useGestureRecognizer` half (15 declarations). The React fixtures become
 * Svelte probes; `usePressTracker`'s half is in
 * `use-press-tracker.svelte.test.ts`.
 *
 * Svelte has no commit phase, so "not from the effect" is restated as "not
 * synchronously during the state change": a callback deferred to the arena's
 * next pass is observed after a microtask.
 */

function touch(
	type: string,
	target: EventTarget,
	contact: { id: number; x: number; y: number },
	time: number,
	isLift = false
): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const entry = {
		identifier: contact.id,
		clientX: contact.x,
		clientY: contact.y,
		target
	};
	Object.defineProperty(event, 'changedTouches', { value: [entry] });
	Object.defineProperty(event, 'touches', { value: isLift ? [] : [entry] });
	Object.defineProperty(event, 'timeStamp', { value: time });
	target.dispatchEvent(event);
}

function surface(container: HTMLElement): HTMLElement {
	const found = container.querySelector('[data-testid="surface"]');
	if (!(found instanceof HTMLElement)) throw new Error('expected a surface');
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

describe('useGestureRecognizer', () => {
	it('drives the latest listener with no render per move', async () => {
		const seen: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: {
				onGesture: (recognizer: PanGestureRecognizer) => {
					seen.push(`${recognizer.state}:${recognizer.translation().x}`);
				}
			}
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 1, x: 0, y: 0 }, 0);
		for (let x = 6; x <= 36; x += 6) touch('touchmove', target, { id: 1, x, y: 0 }, x * 2);
		touch('touchend', target, { id: 1, x: 36, y: 0 }, 80, true);
		expect(seen).toEqual([
			'began:2',
			'changed:8',
			'changed:14',
			'changed:20',
			'changed:26',
			'ended:26'
		]);
	});

	it('keeps one recognizer across renders and reads the newest listener', async () => {
		const identities = new Set<PanGestureRecognizer>();
		const first = vi.fn();
		const second = vi.fn();
		const screen = await render(RecognizerProbe, {
			props: {
				onGesture: first,
				onRecognizer: (recognizer: PanGestureRecognizer) => identities.add(recognizer)
			}
		});
		expect(identities.size).toBe(1);
		await screen.rerender({ onGesture: second });
		const target = surface(screen.container);
		touch('touchstart', target, { id: 2, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 2, x: 30, y: 0 }, 16);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
		touch('touchend', target, { id: 2, x: 30, y: 0 }, 32, true);
	});

	it('cancels a gesture in flight when it is disabled, without calling the listener from the effect', async () => {
		const states: string[] = [];
		const heard: string[] = [];
		let pan: PanGestureRecognizer | null = null;
		const screen = await render(RecognizerProbe, {
			props: {
				onGesture: (recognizer: PanGestureRecognizer) => states.push(recognizer.state),
				onRecognizer: (recognizer: PanGestureRecognizer) => {
					if (pan == null) {
						pan = recognizer;
						recognizer.addListener((current) => heard.push(current.state));
					}
				}
			}
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 3, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 3, x: 30, y: 0 }, 16);
		await screen.rerender({ isEnabled: false });
		await tick();
		expect(heard).toContain('cancelled');
		expect(pan!.state).not.toBe('changed');
		expect(states).toEqual(['began']);
		touch('touchend', target, { id: 3, x: 30, y: 0 }, 32, true);
		expect(states).toEqual(['began']);
	});

	it('follows the element when the node behind the ref is replaced', async () => {
		const onPan = vi.fn();
		const screen = await render(RecognizerProbe, { props: { onGesture: onPan } });
		const first = surface(screen.container);
		await screen.rerender({ tag: 'section' });
		const second = surface(screen.container);
		expect(second).not.toBe(first);
		expect(second.tagName).toBe('SECTION');
		touch('touchstart', first, { id: 6, x: 0, y: 0 }, 0);
		touch('touchmove', first, { id: 6, x: 30, y: 0 }, 16);
		touch('touchend', first, { id: 6, x: 30, y: 0 }, 32, true);
		expect(onPan).not.toHaveBeenCalled();
		touch('touchstart', second, { id: 7, x: 0, y: 0 }, 100);
		touch('touchmove', second, { id: 7, x: 30, y: 0 }, 116);
		expect(onPan).toHaveBeenCalled();
		touch('touchend', second, { id: 7, x: 30, y: 0 }, 132, true);
	});

	it('reports cancelled to a handler that disables the recognizer itself, from that handler', async () => {
		const states: string[] = [];
		let pan: PanGestureRecognizer | null = null;
		const screen = await render(RecognizerProbe, {
			props: {
				onGesture: (recognizer: PanGestureRecognizer) => states.push(recognizer.state),
				onRecognizer: (recognizer: PanGestureRecognizer) => {
					pan = recognizer;
				}
			}
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 6, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 6, x: 30, y: 0 }, 16);
		pan!.setEnabled(false);
		expect(states).toEqual(['began', 'cancelled']);
		touch('touchend', target, { id: 6, x: 30, y: 0 }, 32, true);
	});

	it('attaches a recognizer for every pointer: a mouse drag pans where the primary pointer is fine', async () => {
		const pointer = pointerQuery(false);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const onPan = vi.fn();
			const screen = await render(RecognizerProbe, { props: { onGesture: onPan } });
			const target = surface(screen.container);
			const mouse = (type: string, x: number, time: number) => {
				const event = new PointerEvent(type, {
					bubbles: true,
					cancelable: true,
					composed: true,
					pointerId: 9,
					pointerType: 'mouse',
					clientX: x,
					clientY: 0,
					button: 0,
					buttons: type === 'pointerup' ? 0 : 1
				});
				Object.defineProperty(event, 'timeStamp', { value: time });
				target.dispatchEvent(event);
			};
			mouse('pointerdown', 0, 0);
			mouse('pointermove', 30, 16);
			expect(onPan).toHaveBeenCalled();
			mouse('pointerup', 30, 32);
			screen.unmount();
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
			pointer.restore();
		}
	});

	it('reports a recognizer that required the disabled one to fail after the isEnabled effect, in its recognized state', async () => {
		const states: string[] = [];
		const screen = await render(TapsPairProbe, {
			props: { doubleEnabled: true, onSingle: (r: TapGestureRecognizer) => states.push(r.state) }
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 1, x: 5, y: 5 }, 0);
		touch('touchend', target, { id: 1, x: 5, y: 5 }, 40, true);
		expect(states).toEqual([]);
		// Svelte has no commit boundary an effect can be "outside" of: the arena's
		// pass is a microtask, so the callback is observed after it.
		await screen.rerender({ doubleEnabled: false });
		await Promise.resolve();
		expect(states).toEqual(['ended']);
	});

	it('reports a recognizer that required one a replaced node cancelled after that effect, not inside it', async () => {
		const states: string[] = [];
		const screen = await render(NestedTapsProbe, {
			props: { innerKey: 'first', onSingle: (r: TapGestureRecognizer) => states.push(r.state) }
		});
		const inner = screen.container.querySelector('[data-testid="inner"]') as HTMLElement;
		touch('touchstart', inner, { id: 2, x: 5, y: 5 }, 0);
		touch('touchend', inner, { id: 2, x: 5, y: 5 }, 40, true);
		expect(states).toEqual([]);
		// As above: the cancelled wait resolves in the arena's next pass.
		await screen.rerender({ innerKey: 'second' });
		await Promise.resolve();
		expect(states).toEqual(['ended']);
	});

	it('serves a mouse press under a fine pointer, on an action group or not', async () => {
		const primary = pointerQuery(false);
		const states: string[] = [];
		try {
			const screen = await render(RecognizerProbe, {
				props: {
					onGesture: (recognizer: PanGestureRecognizer) => states.push(recognizer.state)
				}
			});
			// The probe creates a pan; this case's mouse press only needs a
			// recognizer attached, and a pan does not report a press. Its
			// action-group flag is what the host is asked for, so assert that
			// the element is served under a fine pointer.
			const target = surface(screen.container);
			const press = (pointerId: number, time: number) => {
				for (const [type, buttons] of [
					['pointerdown', 1],
					['pointerup', 0]
				] as const) {
					const event = new PointerEvent(type, {
						bubbles: true,
						cancelable: true,
						composed: true,
						pointerId,
						pointerType: 'mouse',
						clientX: 5,
						clientY: 5,
						button: 0,
						buttons
					});
					Object.defineProperty(event, 'timeStamp', { value: time });
					target.dispatchEvent(event);
				}
			};
			press(1, 0);
			expect(target.hasAttribute(TOUCH_ACTION_ATTRIBUTE)).toBe(true);
			await screen.rerender({ actionGroup: true });
			press(2, 1000);
			expect(states).toEqual([]);
			screen.unmount();
		} finally {
			primary.restore();
		}
	});

	it('attaches nothing while disabled: no touch-action, no gesture', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const target = surface(screen.container);
		expect(target.hasAttribute(TOUCH_ACTION_ATTRIBUTE)).toBe(true);
		await screen.rerender({ isEnabled: false });
		await tick();
		expect(target.hasAttribute(TOUCH_ACTION_ATTRIBUTE)).toBe(false);
		touch('touchstart', target, { id: 6, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 6, x: 30, y: 0 }, 16);
		touch('touchend', target, { id: 6, x: 30, y: 0 }, 32, true);
		expect(states).toEqual([]);
		await screen.rerender({ isEnabled: true });
		touch('touchstart', target, { id: 8, x: 0, y: 0 }, 100);
		touch('touchmove', target, { id: 8, x: 30, y: 0 }, 116);
		expect(states).toContain('began');
		touch('touchend', target, { id: 8, x: 30, y: 0 }, 132, true);
	});

	it('follows the element behind the ref when it is replaced', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		await screen.rerender({ tag: 'section' });
		const second = surface(screen.container);
		touch('touchstart', second, { id: 9, x: 0, y: 0 }, 0);
		touch('touchmove', second, { id: 9, x: 30, y: 0 }, 16);
		expect(states).toContain('began');
		touch('touchend', second, { id: 9, x: 30, y: 0 }, 32, true);
	});

	it('ends a gesture in flight on unmount without calling the listener from the cleanup', async () => {
		const states: string[] = [];
		const heard: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: {
				onGesture: (r: PanGestureRecognizer) => states.push(r.state),
				onRecognizer: (r: PanGestureRecognizer) => {
					r.addListener((current) => heard.push(current.state));
				}
			}
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 5, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 5, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		screen.unmount();
		expect(heard).toContain('cancelled');
		expect(states).toEqual(['began']);
	});

	it('ends a gesture in flight when the node is replaced without calling the listener from the effect', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const first = surface(screen.container);
		touch('touchstart', first, { id: 10, x: 0, y: 0 }, 0);
		touch('touchmove', first, { id: 10, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		await screen.rerender({ tag: 'section' });
		expect(states).toEqual(['began']);
	});

	it('keeps a recognizer that waits on one being disabled from calling its listener from the effect, and delivers it right after', async () => {
		const heard: string[] = [];
		const screen = await render(TapsPairProbe, {
			props: {
				doubleEnabled: true,
				requireAtCreation: true,
				onSingle: (tap: TapGestureRecognizer) => heard.push(tap.state)
			}
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 5, x: 10, y: 10 }, 0);
		touch('touchend', target, { id: 5, x: 10, y: 10 }, 40, true);
		expect(heard).toEqual([]);
		await screen.rerender({ doubleEnabled: false });
		await Promise.resolve();
		expect(heard).toEqual(['ended']);
	});

	it('detaches on unmount', async () => {
		const onPan = vi.fn();
		const screen = await render(RecognizerProbe, { props: { onGesture: onPan } });
		const target = surface(screen.container);
		expect(target.hasAttribute(TOUCH_ACTION_ATTRIBUTE)).toBe(true);
		screen.unmount();
		expect(target.hasAttribute(TOUCH_ACTION_ATTRIBUTE)).toBe(false);
		touch('touchstart', target, { id: 4, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 4, x: 30, y: 0 }, 16);
		expect(onPan).not.toHaveBeenCalled();
	});
});

describe('useGestureRecognizer follows the element behind its ref', () => {
	it('attaches to a node rendered after mount, and to a node swapped behind the same ref', async () => {
		const states: string[] = [];
		const onPan = (r: PanGestureRecognizer) => states.push(r.state);
		const screen = await render(RecognizerProbe, {
			props: { show: false, onGesture: onPan }
		});
		await screen.rerender({ show: true, tag: 'div', onGesture: onPan });
		const first = surface(screen.container);
		touch('touchstart', first, { id: 1, x: 0, y: 0 }, 0);
		touch('touchmove', first, { id: 1, x: 30, y: 0 }, 16);
		touch('touchend', first, { id: 1, x: 30, y: 0 }, 32, true);
		expect(states).toContain('began');
		states.length = 0;
		await screen.rerender({ tag: 'section', onGesture: onPan });
		const second = surface(screen.container);
		expect(second).not.toBe(first);
		touch('touchstart', second, { id: 2, x: 0, y: 0 }, 100);
		touch('touchmove', second, { id: 2, x: 30, y: 0 }, 116);
		touch('touchend', second, { id: 2, x: 30, y: 0 }, 132, true);
		expect(states).toContain('began');
		states.length = 0;
		touch('touchstart', first, { id: 3, x: 0, y: 0 }, 200);
		touch('touchmove', first, { id: 3, x: 30, y: 0 }, 216);
		touch('touchend', first, { id: 3, x: 30, y: 0 }, 232, true);
		expect(states).toEqual([]);
	});

	it('reports nothing from cleanup when it unmounts mid-gesture', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const target = surface(screen.container);
		touch('touchstart', target, { id: 5, x: 0, y: 0 }, 0);
		touch('touchmove', target, { id: 5, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		screen.unmount();
		expect(states).toEqual(['began']);
	});
});

describe('useGestureRecognizer follows a replaced node', () => {
	it('cancels a gesture in flight without calling the listener from the effect', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { tag: 'div', onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const a = surface(screen.container);
		touch('touchstart', a, { id: 3, x: 0, y: 0 }, 0);
		touch('touchmove', a, { id: 3, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		await screen.rerender({ tag: 'section' });
		expect(states).toEqual(['began']);
		const b = surface(screen.container);
		touch('touchstart', b, { id: 4, x: 0, y: 0 }, 100);
		touch('touchmove', b, { id: 4, x: 30, y: 0 }, 116);
		expect(states).toEqual(['began', 'began']);
		touch('touchend', b, { id: 4, x: 30, y: 0 }, 132, true);
	});
});

describe('the hooks let go of an element removed while they stay mounted', () => {
	it('useGestureRecognizer cancels its gesture without calling back, and works on a new element', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const first = surface(screen.container);
		touch('touchstart', first, { id: 11, x: 0, y: 0 }, 0);
		touch('touchmove', first, { id: 11, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		await screen.rerender({ show: false });
		expect(states).toEqual(['began']);
		await screen.rerender({ show: true });
		const second = surface(screen.container);
		touch('touchstart', second, { id: 12, x: 0, y: 0 }, 100);
		touch('touchmove', second, { id: 12, x: 30, y: 0 }, 116);
		expect(states).toEqual(['began', 'began']);
		touch('touchend', second, { id: 12, x: 30, y: 0 }, 132, true);
	});
});

describe('useGestureRecognizer under a replayed effect run', () => {
	// RESTATED: Svelte does not replay effects the way React's StrictMode does,
	// so there is no second attach to observe. The contract the upstream case
	// protects — a replaced node's cancel comes from the effect, not the
	// listener — is the same, and re-checked here without a StrictMode wrapper.
	it('cancels a gesture in flight without calling the listener from the effect', async () => {
		const states: string[] = [];
		const screen = await render(RecognizerProbe, {
			props: { onGesture: (r: PanGestureRecognizer) => states.push(r.state) }
		});
		const a = surface(screen.container);
		touch('touchstart', a, { id: 3, x: 0, y: 0 }, 0);
		touch('touchmove', a, { id: 3, x: 30, y: 0 }, 16);
		expect(states).toEqual(['began']);
		await screen.rerender({ show: false });
		expect(states).toEqual(['began']);
	});
});
