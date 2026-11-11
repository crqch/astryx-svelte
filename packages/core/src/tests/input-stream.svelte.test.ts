/** PORTS: utils/inputStream.test.ts */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getDownPresses,
	getLastMousePoint,
	getLastPointerType,
	subscribeInput
} from '$lib/utils/input-stream.js';

/**
 * Astryx's `utils/inputStream.test.ts`, ten of its twelve declarations.
 *
 * Every case runs against a fresh same-origin iframe's window: the stream's
 * state and native listeners are per-window, and the page is shared by every
 * test file in the browser project, so the iframe is this port's counterpart to
 * upstream's per-file jsdom instance.
 *
 * Two cases are not here, each named rather than dropped:
 *
 * - `registers no non-passive listener for a page of pressables, and none that
 *   holds a scroll for the gesture host` covers `installPressFeedback` and
 *   `getGestureHost`, neither of which is ported.
 * - `keeps the press feedback controller free of the gesture system` walks
 *   `pressFeedback.ts`'s import graph, and that module is not ported.
 */

type Registration = {
	type: string;
	options: AddEventListenerOptions | boolean | undefined;
};

let frame: HTMLIFrameElement;
let win: Window;
let doc: Document;
const unsubscribers: (() => void)[] = [];

beforeEach(() => {
	frame = document.createElement('iframe');
	document.body.append(frame);
	win = frame.contentWindow!;
	doc = frame.contentDocument!;
});

afterEach(() => {
	for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
	vi.restoreAllMocks();
	frame.remove();
});

function subscribe(...args: Parameters<typeof subscribeInput>): () => void {
	const unsubscribe = subscribeInput(...args);
	unsubscribers.push(unsubscribe);
	return unsubscribe;
}

function spyRegistrations() {
	const added: Registration[] = [];
	const removed: Registration[] = [];
	const originalAdd = win.addEventListener.bind(win);
	const originalRemove = win.removeEventListener.bind(win);
	vi.spyOn(win, 'addEventListener').mockImplementation((...args) => {
		added.push({ type: args[0] as string, options: args[2] });
		originalAdd(...args);
	});
	vi.spyOn(win, 'removeEventListener').mockImplementation((...args) => {
		removed.push({ type: args[0] as string, options: args[2] });
		originalRemove(...args);
	});
	return { added, removed };
}

function pointerDown(target: EventTarget): Event {
	const event = new Event('pointerdown', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

describe('inputStream', () => {
	it('registers one capture listener per event type, however many subscribe, and removes it with the last', () => {
		const { added, removed } = spyRegistrations();
		const first = subscribe(win, 'pointerdown', () => {});
		const second = subscribe(win, 'pointerdown', () => {});
		subscribe(win, 'pointerup', () => {});
		expect(added.map((r) => r.type)).toEqual(['pointerdown', 'pointerup']);
		expect(added[0].options).toEqual({ capture: true, passive: true });
		first();
		expect(removed).toEqual([]);
		second();
		second();
		expect(removed.map((r) => r.type)).toEqual(['pointerdown']);
	});

	it('runs a first subscriber before the others, even subscribed after them, and its true ends the dispatch', () => {
		const calls: string[] = [];
		let isHeld = false;
		subscribe(win, 'pointerdown', () => {
			calls.push('press feedback');
			return true;
		});
		subscribe(
			win,
			'pointerdown',
			() => {
				calls.push('hold');
				return isHeld;
			},
			{ first: true }
		);
		subscribe(win, 'pointerdown', () => calls.push('gesture host'));
		pointerDown(doc.body);
		expect(calls).toEqual(['hold', 'press feedback', 'gesture host']);
		calls.length = 0;
		isHeld = true;
		pointerDown(doc.body);
		expect(calls).toEqual(['hold']);
	});

	it('delivers to every subscriber in subscription order, each isolated from another that throws', () => {
		const reported = vi.fn();
		vi.stubGlobal('reportError', reported);
		const calls: string[] = [];
		subscribe(win, 'pointerdown', () => calls.push('press feedback'));
		subscribe(win, 'pointerdown', () => {
			calls.push('throws');
			throw new Error('a subscriber failed');
		});
		subscribe(win, 'pointerdown', () => calls.push('gesture host'));
		pointerDown(doc.body);
		expect(calls).toEqual(['press feedback', 'throws', 'gesture host']);
		expect(reported).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});

	it('stays passive unless a subscriber cancels, and turns passive again when it leaves', () => {
		const { added, removed } = spyRegistrations();
		subscribe(win, 'touchmove', () => {});
		const blocking = subscribe(win, 'touchmove', () => {}, { cancels: true });
		expect(added.map((r) => r.options)).toEqual([
			{ capture: true, passive: true },
			{ capture: true, passive: false }
		]);
		blocking();
		expect(removed).toHaveLength(2);
		expect(added.at(-1)?.options).toEqual({ capture: true, passive: true });
		subscribe(
			win,
			'pointerdown',
			(event) => {
				event.preventDefault();
			},
			{ cancels: true }
		);
		expect(pointerDown(doc.body).defaultPrevented).toBe(true);
	});

	it.each([
		['stopPropagation on the document', 'document', 'stopPropagation'],
		['stopImmediatePropagation on the document', 'document', 'stopImmediatePropagation'],
		['stopPropagation on the window, registered first', 'window', 'stopPropagation']
	] as const)(
		"still reaches every subscriber under an app's capture-phase %s",
		(_name, where, stop) => {
			// Resolved inside the case: `it.each` rows are built at collection time,
			// before `beforeEach` has made the frame's window and document.
			const node = where === 'document' ? doc : win;
			const button = doc.createElement('button');
			doc.body.append(button);
			const listener = (event: Event) => event[stop]();
			node.addEventListener('pointerdown', listener, { capture: true });
			const pressFeedback = vi.fn();
			const gestureHost = vi.fn();
			subscribe(win, 'pointerdown', pressFeedback);
			subscribe(win, 'pointerdown', gestureHost);
			pointerDown(button);
			node.removeEventListener('pointerdown', listener, { capture: true });
			expect(pressFeedback).toHaveBeenCalledTimes(1);
			expect(gestureHost).toHaveBeenCalledTimes(1);
		}
	);

	it("reaches events fired at the document and an element's scroll", () => {
		const visibility = vi.fn();
		const scroll = vi.fn();
		subscribe(win, 'visibilitychange', visibility);
		subscribe(win, 'scroll', scroll);
		doc.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
		const scroller = doc.createElement('div');
		doc.body.append(scroller);
		scroller.dispatchEvent(new Event('scroll'));
		expect(visibility).toHaveBeenCalledTimes(1);
		expect(scroll).toHaveBeenCalledTimes(1);
		expect((scroll.mock.calls[0][0] as Event).target).toBe(scroller);
	});

	it('delivers an event to the subscribers present when it arrived', () => {
		const late = vi.fn();
		let unsubscribeLate: (() => void) | null = null;
		subscribe(win, 'pointerdown', () => {
			unsubscribeLate?.();
		});
		unsubscribeLate = subscribe(win, 'pointerdown', late);
		pointerDown(doc.body);
		expect(late).not.toHaveBeenCalled();
	});

	it("records the latest delivered pointer event's type, before its subscribers run, and only while one hears pointer events", () => {
		const heard: (string | null)[] = [];
		const stop = subscribeInput(win, 'pointermove', () => {
			heard.push(getLastPointerType(win));
		});
		doc.body.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' })
		);
		expect(getLastPointerType(win)).toBe('mouse');
		doc.body.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch' })
		);
		expect(heard).toEqual(['mouse', 'touch']);
		stop();

		doc.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'pen' }));
		expect(getLastPointerType(win)).toBe('touch');
	});

	it("records where each finger's or pen's press that is down was last, while one hears pointer presses, and forgets them when the last listener for their end goes", () => {
		const press = (type: string, pointerType: string, pointerId: number, x: number, y: number) =>
			doc.body.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerType,
					pointerId,
					clientX: x,
					clientY: y
				})
			);
		const stops = (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const).map(
			(type) => subscribeInput(win, type, () => {})
		);
		press('pointerdown', 'touch', 31, 10, 20);
		press('pointerdown', 'pen', 32, 30, 40);
		press('pointerdown', 'mouse', 33, 50, 60);
		press('pointermove', 'touch', 34, 70, 80);
		press('pointermove', 'touch', 31, 12, 22);
		expect([...getDownPresses(win)]).toEqual([
			[31, { x: 12, y: 22 }],
			[32, { x: 30, y: 40 }]
		]);
		press('pointerup', 'touch', 31, 12, 22);
		press('pointercancel', 'pen', 32, 30, 40);
		press('pointerup', 'mouse', 33, 50, 60);
		expect([...getDownPresses(win)]).toEqual([]);
		press('pointerdown', 'touch', 35, 1, 2);
		expect([...getDownPresses(win)]).toEqual([[35, { x: 1, y: 2 }]]);
		for (const stop of stops) stop();
		expect([...getDownPresses(win)]).toEqual([]);
	});

	it("records where the latest delivered mouse pointer event was, and keeps it through a finger's events", () => {
		const stop = subscribeInput(win, 'pointermove', () => {});
		doc.body.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				pointerType: 'mouse',
				clientX: 40,
				clientY: 60
			})
		);
		expect(getLastMousePoint(win)).toEqual({ x: 40, y: 60 });
		doc.body.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				pointerType: 'touch',
				clientX: 200,
				clientY: 10
			})
		);
		expect(getLastMousePoint(win)).toEqual({ x: 40, y: 60 });
		stop();
	});
});
