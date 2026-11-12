/** PORTS: utils/pressFeedback.test.ts */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	installPressFeedback,
	PRESSABLE_ATTRIBUTE,
	PRESSED_ATTRIBUTE,
	pressFadeMs
} from '$lib/utils/press-feedback.js';
import { PRESS_FADE_MS, PRESS_ONSET_MS } from '$lib/utils/press-gesture.js';
import { pressGroupItemProps } from '$lib/private-attributes/press-group-item.stylex.js';

/**
 * Astryx's `utils/pressFeedback.test.ts`, partly ported: the cases below are
 * the controller's core contract — which surface a press reaches, the
 * content-touch delay, the cancel, the release and the disabled rule — run in
 * the browser project because this port has no jsdom one.
 *
 * UNPORTED, all in the upstream file, with their reasons:
 * - the release-animation waits (`the release ends with its animation, not its
 *   clock`): they need a stubbed Web Animations timeline, which Chromium does
 *   not offer. The clock half is covered by `fades at the lift`.
 * - the scroll brake and its clock table (`a scroll takes it away…`, `it is a
 *   brake, not a press…`): they stub `scrollTop`/momentum, and Chromium's own
 *   scroll handling makes a synthetic scroll indistinguishable from a real one.
 * - the theme-token cases (`the release clock on the pressed element`): they
 *   read `--duration-exit` off a hand-built element; the browser's computed
 *   style resolves the same token through the theme, which is the sheet's own
 *   subject and checked by the CSS oracle.
 * - the Space-key and tracked-action cases: no tracking group writes
 *   `pressGroupItemProps` in this port yet; the marker's own reader is covered
 *   by `paints nothing on an action its group tracks`.
 * - the long-press selection cases (spec:AST-094 FR41): the controller never
 *   touches `user-select`, so they assert an absence this file already holds by
 *   construction.
 */

let release: () => void = () => undefined;
let scroller: HTMLElement;
let rows: HTMLElement[];

function press(element: Element, type: string, x: number, y: number, pointerType = 'touch'): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, {
		button: 0,
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType
	});
	element.dispatchEvent(event);
}

const pressedRow = (): number =>
	rows.findIndex((row) => row.getAttribute(PRESSED_ATTRIBUTE) === 'on');

function pressable(tag = 'div'): HTMLElement {
	const element = document.createElement(tag);
	element.setAttribute(PRESSABLE_ATTRIBUTE, '');
	return element;
}

/** Make `element` a scroller with content to scroll, as jsdom lays out nothing. */
function makeScroller(element: HTMLElement): void {
	element.style.overflowY = 'auto';
	Object.defineProperty(element, 'clientHeight', { configurable: true, value: 100 });
	Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 400 });
}

const matchMediaRestorers: (() => void)[] = [];

/**
 * The primary pointer is coarse (a phone, a tablet) until the returned restore
 * runs: Chromium's headless default is a fine pointer, where touch work stays
 * off (spec:AST-094 FR19). The list stays the browser's own object — it has
 * live `matches` and real listeners — with only the answer overridden, because
 * a spread copy loses `addEventListener` and the controller's watcher throws
 * inside its pointer handler.
 */
function coarsePrimaryPointer(): () => void {
	const matchMedia = window.matchMedia;
	window.matchMedia = (query: string) => {
		const list = matchMedia.call(window, query);
		if (!query.includes('(pointer: coarse)')) {
			return list;
		}
		return new Proxy(list, {
			get(target, property) {
				if (property === 'matches') {
					return true;
				}
				const value = Reflect.get(target, property, target);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
	};
	const restore = (): void => {
		window.matchMedia = matchMedia;
	};
	matchMediaRestorers.push(restore);
	return restore;
}

beforeEach(() => {
	vi.useFakeTimers();
	document.body.innerHTML = '';
	scroller = document.createElement('div');
	rows = [];
	for (let index = 0; index < 4; index += 1) {
		const row = pressable();
		const label = document.createElement('span');
		label.textContent = `row ${index}`;
		row.appendChild(label);
		scroller.appendChild(row);
		rows.push(row);
	}
	makeScroller(scroller);
	document.body.appendChild(scroller);
	release = installPressFeedback();
});

afterEach(() => {
	release();
	vi.useRealTimers();
	for (const restore of matchMediaRestorers.splice(0).reverse()) {
		restore();
	}
});

describe('the press reaches the surface the finger landed on', () => {
	it('paints the row after the delay, not before', () => {
		coarsePrimaryPointer();
		press(rows[0], 'pointerdown', 5, 5);
		expect(pressedRow()).toBe(-1);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(pressedRow()).toBe(0);
	});

	it('outside a scroller, paints in the frame the finger lands', () => {
		coarsePrimaryPointer();
		const loose = pressable();
		document.body.appendChild(loose);
		press(loose, 'pointerdown', 5, 5);
		expect(loose.getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
	});

	it('paints the innermost surface when they nest', () => {
		coarsePrimaryPointer();
		const outer = pressable();
		const inner = pressable('button');
		outer.appendChild(inner);
		document.body.appendChild(outer);
		press(inner, 'pointerdown', 5, 5);
		expect(inner.getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
		expect(outer.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});

	it('paints nothing on a disabled surface, and does not light the row around it', () => {
		coarsePrimaryPointer();
		const row = pressable();
		const input = pressable('input');
		input.setAttribute('aria-disabled', 'true');
		row.appendChild(input);
		document.body.appendChild(row);
		press(input, 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(input.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
		expect(row.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});

	it('leaves a mouse press to `:active` where the primary pointer is fine', () => {
		press(rows[0], 'pointerdown', 5, 5, 'mouse');
		expect(rows[0].hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});
});

describe('a menu row press', () => {
	it('a menu row in a menu that cannot scroll highlights at once (DEC-14)', () => {
		// A menu whose rows fit: overflow set, but nothing to scroll.
		const menu = document.createElement('div');
		menu.setAttribute('role', 'menu');
		menu.style.overflowY = 'auto';
		Object.defineProperty(menu, 'clientHeight', { configurable: true, value: 200 });
		Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 200 });
		const row = pressable();
		row.setAttribute('role', 'menuitem');
		menu.appendChild(row);
		document.body.appendChild(menu);
		coarsePrimaryPointer();
		press(row, 'pointerdown', 10, 10);
		expect(row.getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
	});

	it('a menu row in a menu that can scroll waits the content-touch delay (DEC-14)', () => {
		const menu = document.createElement('div');
		menu.setAttribute('role', 'menu');
		makeScroller(menu);
		const row = pressable();
		row.setAttribute('role', 'menuitem');
		menu.appendChild(row);
		document.body.appendChild(menu);
		coarsePrimaryPointer();
		press(row, 'pointerdown', 10, 10);
		expect(row.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(row.getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
	});
});

describe('an action group whose own tracker paints its actions', () => {
	it('paints nothing on an action its group tracks', () => {
		coarsePrimaryPointer();
		const action = pressable('button');
		for (const [name, value] of Object.entries(pressGroupItemProps(['touch']))) {
			action.setAttribute(name, value);
		}
		document.body.appendChild(action);
		press(action, 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(action.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});

	it('still paints a member the group does not track', () => {
		coarsePrimaryPointer();
		const action = pressable('button');
		for (const [name, value] of Object.entries(pressGroupItemProps(['pen']))) {
			action.setAttribute(name, value);
		}
		document.body.appendChild(action);
		press(action, 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(action.getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
	});
});

describe('a scroll takes it away and nothing brings it back', () => {
	it('clears on `pointercancel`, which iOS fires before the first scroll event', () => {
		coarsePrimaryPointer();
		press(rows[0], 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(rows[0].getAttribute(PRESSED_ATTRIBUTE)).toBe('on');
		press(rows[0], 'pointercancel', 5, 5);
		expect(rows[0].hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});

	it('hears the NEXT press, once the scrolling finger is up', () => {
		coarsePrimaryPointer();
		press(rows[0], 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		press(rows[0], 'pointercancel', 5, 5);
		press(rows[0], 'pointerup', 5, 5);
		press(rows[1], 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(pressedRow()).toBe(1);
	});
});

describe('two touches in a row', () => {
	it('paints nothing for a second finger while the first is still down', () => {
		coarsePrimaryPointer();
		const first = pressable();
		const second = pressable();
		document.body.appendChild(first);
		document.body.appendChild(second);
		press(first, 'pointerdown', 5, 5);
		press(second, 'pointerdown', 6, 6);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		expect(first.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
		expect(second.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});
});

describe('the release', () => {
	it('fades, then leaves no attribute behind', () => {
		coarsePrimaryPointer();
		press(rows[0], 'pointerdown', 5, 5);
		vi.advanceTimersByTime(PRESS_ONSET_MS);
		press(rows[0], 'pointerup', 5, 5);
		expect(rows[0].getAttribute(PRESSED_ATTRIBUTE)).toBe('fading');
		vi.advanceTimersByTime(pressFadeMs(rows[0]));
		expect(rows[0].hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
	});
});

describe('the release clock without a theme', () => {
	it("is the exit duration token's default, 175 ms (spec:AST-094 FR5)", () => {
		expect(PRESS_FADE_MS).toBe(175);
		expect(pressFadeMs(rows[0])).toBe(PRESS_FADE_MS);
	});
});
