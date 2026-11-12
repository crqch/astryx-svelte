/** PORTS: hooks/useMenuPress.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import {
	__resetMenuPressForTest,
	MENU_PRESS_AUTOSCROLL_ZONE_PX,
	MENU_PRESS_LONG_PRESS_MS,
	MENU_PRESS_STRAY_CLICK_MS
} from '$lib/hooks/use-menu-press.svelte.js';
import { MENU_PRESS_HANDOFF_PX, MENU_PRESS_SETTLE_MS } from '$lib/hooks/menu-press-gesture.js';
import { holdInput, isInputShield } from '$lib/components/layer/input-hold.js';
import {
	isMenuPressLit,
	isMenuPressPaintHeld
} from '$lib/private-attributes/menu-press-lit.stylex.js';
import Probe from './fixtures/menu-press-probe.svelte';
import PublicProbe from './fixtures/menu-press-public-probe.svelte';
import itemSource from '$lib/components/dropdown-menu/dropdown-menu-item.stylex.ts?raw';
import checkboxSource from '$lib/components/dropdown-menu/dropdown-menu-checkbox-item.stylex.ts?raw';
import radioSource from '$lib/components/dropdown-menu/dropdown-menu-radio-item.stylex.ts?raw';
import subMenuSource from '$lib/components/dropdown-menu/dropdown-menu-sub-menu.stylex.ts?raw';

/**
 * Astryx's `hooks/useMenuPress.test.tsx`, ported case for case at the **0.7.13**
 * pin: all 55 cases, in upstream's order, with its titles and assertions. None
 * dropped. (Two of the 55 are `it.each` pairs; as upstream's own count does,
 * each `it.each` counts once.)
 *
 * ## Harness translations
 *
 * - **jsdom has no `elementFromPoint`; the hook falls back to the event target
 *   there.** The browser project has a real one, and the synthetic
 *   `PointerEvent`s in this file carry no meaningful point (0, 0), so the
 *   fallback is restored explicitly: `beforeEach` makes `document`'s
 *   `elementFromPoint` / `elementsFromPoint` own `undefined` properties, which
 *   is the exact condition the hook's fallback tests. The two cases that
 *   exercise hit-testing install the functions themselves, as upstream's do,
 *   and `afterEach` reveals Chromium's real methods again.
 * - `fireEvent.pointerDown/pointerMove/pointerUp/pointerCancel/click` become
 *   direct `dispatchEvent(new PointerEvent/MouseEvent(...))` calls, with
 *   `bubbles`, `cancelable` and `composed` set the way Testing Library's
 *   synthetic events are. `fireEvent.click` carries `detail`.
 * - `vi.spyOn(row, 'focus')` becomes a small wrapper that records its options
 *   and calls the bound original through: `focus` lives on
 *   `HTMLElement.prototype`, so an own wrapper is the same observation the spy
 *   makes. The asserted options are unchanged.
 * - `act()` has no counterpart: a Svelte `$state` write flushes on its own.
 *   Where a case reads rendered output after a timer or an event, it awaits
 *   `tick()` first.
 * - The shadow-root case renders with `render`'s `baseElement` inside the
 *   shadow root (the library always mounts into a new child of it), then
 *   queries through that container.
 * - The autoscroll case needs a scroller that really scrolls: Chromium leaves
 *   `scrollTop` at 0 on an element with no overflow, where jsdom accepts any
 *   value. The probe's `isScrollable` gives the menu a 20px scroll box; the
 *   case's faked `getBoundingClientRect` still supplies upstream's 100px box
 *   for the edge math.
 * - The row-family source case reads the four `.stylex.ts` modules with
 *   `?raw`: this port keeps a row's styles there, not in its `.tsx`
 *   counterpart. The claim is unchanged — each family composes
 *   `menuPressLitRowStyle` and reads `--_menu-row-focus-paint`, and the one
 *   family with an `:active` background reads `--_menu-row-active-paint`.
 *
 * Everything else is upstream's, including the fake clocks: `Date.now` must
 * advance with the timers because the settle rule reads it. Svelte schedules
 * its own work on microtasks, which Vitest's fake timers leave alone.
 */

interface PointerSpec {
	pointerType: 'touch' | 'mouse' | 'pen';
	pointerId: number;
	button?: number;
	clientX?: number;
	clientY?: number;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
}

const touch = (pointerId = 1): PointerSpec => ({ pointerType: 'touch', pointerId });
const mouse = (pointerId = 1): PointerSpec => ({ pointerType: 'mouse', pointerId, button: 0 });
const pen = (pointerId = 1): PointerSpec => ({ pointerType: 'pen', pointerId, button: 0 });

function dispatchPointer(
	target: EventTarget,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	init: PointerSpec
): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			button: 0,
			...init
		})
	);
}

function dispatchClick(target: EventTarget, detail: number): MouseEvent {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail });
	target.dispatchEvent(event);
	return event;
}

/** A cancelable `touchend` at `target`, as a browser fires it after the touch's `pointerup`. */
function fireTouchEnd(target: Element): Event {
	const event = new Event('touchend', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

/**
 * The jsdom condition the hook's event-target fallback exists for. An own
 * `undefined` shadows `Document.prototype.elementFromPoint`, and
 * `Reflect.deleteProperty` reveals the real method again.
 */
function hideElementFromPoint(): void {
	Object.defineProperty(document, 'elementFromPoint', {
		configurable: true,
		writable: true,
		value: undefined
	});
	Object.defineProperty(document, 'elementsFromPoint', {
		configurable: true,
		writable: true,
		value: undefined
	});
}

function restoreElementFromPoint(): void {
	Reflect.deleteProperty(document, 'elementFromPoint');
	Reflect.deleteProperty(document, 'elementsFromPoint');
}

function menuIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[role="menu"]');
	if (!(el instanceof HTMLElement)) throw new Error('expected a role="menu" element');
	return el;
}

function rowIn(container: HTMLElement, label: string): HTMLElement {
	const el = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(candidate) => candidate.textContent === label
	);
	if (!el) throw new Error(`no menuitem named "${label}"`);
	return el;
}

function triggerIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('button[aria-expanded]');
	if (!(el instanceof HTMLElement)) throw new Error('expected the trigger button');
	return el;
}

function outsideIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[data-testid="outside"]');
	if (!(el instanceof HTMLElement)) throw new Error('expected the outside button');
	return el;
}

function dividerIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[data-testid="divider"]');
	if (!(el instanceof HTMLElement)) throw new Error('expected the divider');
	return el;
}

type ProbeProps = {
	onSelect?: (label: string) => void;
	onDismiss?: () => void;
	onOpenChange?: (isOpen: boolean) => void;
	hitTest?: (x: number, y: number) => Element | null;
	getScroller?: () => HTMLElement | null;
	onHighlight?: (row: HTMLElement | null) => void;
	touchModel?: 'pointer' | 'uikit';
	longPressDelayMs?: number;
	isScrollable?: boolean;
};

async function harness(props: ProbeProps = {}) {
	const screen = await render(Probe, { props });
	return {
		screen,
		container: screen.container,
		menu: menuIn(screen.container),
		trigger: triggerIn(screen.container),
		outside: outsideIn(screen.container),
		divider: dividerIn(screen.container),
		row: (label: string) => rowIn(screen.container, label)
	};
}

beforeEach(() => {
	__resetMenuPressForTest();
	hideElementFromPoint();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	restoreElementFromPoint();
});

describe('useMenuPress — an input hold over the menu', () => {
	afterEach(() => {
		restoreElementFromPoint();
	});

	it('its shield does not hide the rows from the finger already in the gesture (spec:AST-094 FR29, FR35)', async () => {
		const onSelect = vi.fn();
		const { menu, row } = await harness({ onSelect });
		// The finger is pressed before the hold starts, as the finger that opened
		// the menu is.
		dispatchPointer(row('A'), 'pointerdown', touch());
		// The layer runtime's hold covers the viewport while the menu enters. A
		// hit test there answers with its shield, which is not content.
		const release = holdInput(menu, {
			until: new Promise(() => {}),
			scope: 'viewport'
		});
		try {
			const shield = [...menu.children].find(isInputShield);
			expect(shield).toBeDefined();
			Object.defineProperty(document, 'elementFromPoint', {
				configurable: true,
				value: () => shield
			});
			Object.defineProperty(document, 'elementsFromPoint', {
				configurable: true,
				value: () => [shield, row('B'), menu, document.body]
			});
			dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 5, clientY: 20 });
			expect(row('B')).toHaveFocus();
			dispatchPointer(row('A'), 'pointerup', { ...touch(), clientX: 5, clientY: 20 });
			expect(onSelect).toHaveBeenCalledWith('B');
		} finally {
			release();
		}
	});

	it('anything else over the menu still covers it: only a hold\u2019s shield is seen through', async () => {
		const onSelect = vi.fn();
		const { menu, row } = await harness({ onSelect });
		const overlay = document.createElement('div');
		document.body.append(overlay);
		try {
			Object.defineProperty(document, 'elementFromPoint', {
				configurable: true,
				value: () => overlay
			});
			Object.defineProperty(document, 'elementsFromPoint', {
				configurable: true,
				value: () => [overlay, row('B'), menu, document.body]
			});
			dispatchPointer(row('A'), 'pointerdown', touch());
			dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 5, clientY: 20 });
			expect(row('B')).not.toHaveFocus();
			dispatchPointer(row('A'), 'pointerup', { ...touch(), clientX: 5, clientY: 20 });
			expect(onSelect).not.toHaveBeenCalled();
		} finally {
			overlay.remove();
		}
	});
});

describe('useMenuPress — tracking inside the menu', () => {
	it('acts on the row under the RELEASE, not the row the press began on', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('B'), 'pointermove', touch());
		dispatchPointer(row('B'), 'pointerup', touch());
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith('B');
	});

	it('resolves the row through the hit test, not the event target (a finger stays with the element it landed on)', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({
			onSelect,
			hitTest: (_x, y) => (y > 50 ? row('C') : row('A'))
		});
		// Every event is aimed at A, as a real finger's would be.
		dispatchPointer(row('A'), 'pointerdown', { ...touch(), clientY: 10 });
		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientY: 80 });
		expect(row('C')).toHaveFocus();
		dispatchPointer(row('A'), 'pointerup', { ...touch(), clientY: 80 });
		expect(onSelect).toHaveBeenCalledWith('C');
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it('hit-tests in the shadow root that holds the menu, not the document', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		const shadow = host.attachShadow({ mode: 'open' });
		const base = document.createElement('div');
		shadow.append(base);
		const onSelect = vi.fn();
		const screen = await render(Probe, { props: { onSelect } }, { baseElement: base });
		const inShadow = (label: string) => rowIn(screen.container, label);
		// As in a browser: the document answers with the shadow host; only the
		// shadow root knows the row under the point.
		Object.assign(document, { elementFromPoint: () => host });
		Object.assign(shadow, { elementFromPoint: () => inShadow('C') });
		try {
			const events = { ...mouse(), composed: true, bubbles: true };
			dispatchPointer(inShadow('A'), 'pointerdown', events as PointerSpec);
			dispatchPointer(inShadow('A'), 'pointerup', events as PointerSpec);
			expect(onSelect).toHaveBeenCalledWith('C');
			expect(onSelect).toHaveBeenCalledTimes(1);
		} finally {
			delete (document as { elementFromPoint?: unknown }).elementFromPoint;
			host.remove();
		}
	});

	it('moves the highlight as focus with preventScroll and without :focus-visible', async () => {
		const { row } = await harness();
		const b = row('B');
		const calls: (FocusOptions | undefined)[] = [];
		const original = b.focus.bind(b);
		b.focus = (options?: FocusOptions) => {
			calls.push(options);
			original(options);
		};
		dispatchPointer(row('A'), 'pointerdown', touch());
		expect(row('A')).toHaveFocus();
		dispatchPointer(b, 'pointermove', touch());
		expect(b).toHaveFocus();
		expect(calls.at(-1)).toEqual({ preventScroll: true, focusVisible: false });
	});

	it('clears the highlight over a disabled row or a divider and acts on nothing there', async () => {
		const onSelect = vi.fn();
		const { divider, menu, row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('D (disabled)'), 'pointermove', touch());
		expect(menu).toHaveFocus();
		dispatchPointer(divider, 'pointermove', touch());
		expect(menu).toHaveFocus();
		dispatchPointer(divider, 'pointerup', touch());
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('drives a custom highlight callback instead of focus when given one (a picker)', async () => {
		const onHighlight = vi.fn<(row: HTMLElement | null) => void>();
		const { divider, row } = await harness({ onHighlight });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('B'), 'pointermove', touch());
		dispatchPointer(divider, 'pointermove', touch());
		expect(onHighlight.mock.calls.map(([el]) => el?.textContent ?? null)).toEqual(['A', 'B', null]);
		expect(row('A')).not.toHaveFocus();
	});

	it('carries the release button and modifiers on the dispatched activation', async () => {
		const clicks: MouseEvent[] = [];
		const { row } = await harness();
		const b = row('B');
		b.addEventListener('click', (event) => clicks.push(event));
		dispatchPointer(row('A'), 'pointerdown', mouse());
		dispatchPointer(b, 'pointerup', { ...mouse(), metaKey: true, shiftKey: true });
		expect(clicks).toHaveLength(1);
		expect(clicks[0].metaKey).toBe(true);
		expect(clicks[0].shiftKey).toBe(true);
		expect(clicks[0].detail).toBe(0);
	});
});

describe('useMenuPress — the row a held press lights (spec:AST-094 FR27, FR43)', () => {
	const lit = (container: HTMLElement) =>
		Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'))
			.filter((each) => isMenuPressLit(each))
			.map((each) => each.textContent);

	it.each([
		['finger', touch()],
		['pen', { pointerType: 'pen', pointerId: 1 }]
	] as const)(
		'marks the row under a held %s as it moves, no row off the rows, and none once the press ends',
		async (_name, pointer) => {
			const { container, divider, row } = await harness();
			dispatchPointer(row('A'), 'pointerdown', pointer);
			expect(lit(container)).toEqual(['A']);
			dispatchPointer(row('B'), 'pointermove', pointer);
			expect(lit(container)).toEqual(['B']);
			dispatchPointer(row('C'), 'pointermove', pointer);
			expect(lit(container)).toEqual(['C']);
			dispatchPointer(divider, 'pointermove', pointer);
			expect(lit(container)).toEqual([]);
			dispatchPointer(row('D (disabled)'), 'pointermove', pointer);
			expect(lit(container)).toEqual([]);
			dispatchPointer(row('B'), 'pointermove', pointer);
			expect(lit(container)).toEqual(['B']);
			dispatchPointer(divider, 'pointerup', pointer);
			expect(lit(container)).toEqual([]);
			expect(row('B')).toHaveFocus();
		}
	);

	it.each([
		['finger', touch()],
		['pen', { pointerType: 'pen', pointerId: 1 }]
	] as const)(
		'holds the rows off their own pressed paint while a held %s presses, and gives it back once the press ends',
		async (_name, pointer) => {
			const { divider, menu, row } = await harness();
			expect(isMenuPressPaintHeld(menu)).toBe(false);
			dispatchPointer(row('A'), 'pointerdown', pointer);
			expect(isMenuPressPaintHeld(menu)).toBe(true);
			dispatchPointer(divider, 'pointermove', pointer);
			expect(isMenuPressPaintHeld(menu)).toBe(true);
			dispatchPointer(divider, 'pointerup', pointer);
			expect(isMenuPressPaintHeld(menu)).toBe(false);
		}
	);

	it('leaves the rows their own pressed paint under a held mouse', async () => {
		const { divider, menu, row } = await harness();
		dispatchPointer(row('A'), 'pointerdown', mouse());
		dispatchPointer(row('B'), 'pointermove', mouse());
		expect(isMenuPressPaintHeld(menu)).toBe(false);
		dispatchPointer(divider, 'pointerup', mouse());
		expect(isMenuPressPaintHeld(menu)).toBe(false);
	});

	it('lights the row under a held mouse with focus alone, so it keeps the hover tint', async () => {
		const { container, divider, row } = await harness();
		dispatchPointer(row('A'), 'pointerdown', mouse());
		expect(row('A')).toHaveFocus();
		expect(lit(container)).toEqual([]);
		dispatchPointer(row('B'), 'pointermove', mouse());
		expect(row('B')).toHaveFocus();
		expect(lit(container)).toEqual([]);
		dispatchPointer(divider, 'pointerup', mouse());
		expect(lit(container)).toEqual([]);
	});

	it('marks the row under the finger that opened the menu once it hands off, and clears it at the lift', async () => {
		vi.useFakeTimers();
		const { container, trigger, row } = await harness({ touchModel: 'uikit' });
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 0, clientY: 4 });
		expect(lit(container)).toEqual([]);
		const past = { ...touch(), clientX: 0, clientY: 4 + MENU_PRESS_HANDOFF_PX };
		dispatchPointer(row('A'), 'pointermove', past);
		expect(lit(container)).toEqual(['A']);
		dispatchPointer(row('B'), 'pointermove', { ...past, clientY: past.clientY + 30 });
		expect(lit(container)).toEqual(['B']);
		dispatchPointer(row('B'), 'pointercancel', past);
		expect(lit(container)).toEqual([]);
	});

	it('paints every menu row family: each composes the lit style and reads its variable', () => {
		for (const source of [itemSource, checkboxSource, radioSource, subMenuSource]) {
			expect(source).toContain('menuPressLitRowStyle,');
			expect(source).toContain('var(--_menu-row-focus-paint, ');
		}
		// The one family with an :active background reads its variable there.
		expect(itemSource).toContain('var(--_menu-row-active-paint, ');
	});
});

describe('useMenuPress — one gesture, one activation', () => {
	it('a tap on a row acts once even though the browser also reports a click', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		// The WebKit tail: a click at the touch-start point.
		dispatchClick(row('A'), 1);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith('A');
	});

	it('swallows the stray click at the window before any document listener sees it', async () => {
		const onSelect = vi.fn();
		const documentListener = vi.fn();
		document.addEventListener('click', documentListener, true);
		try {
			const { row } = await harness({ onSelect });
			dispatchPointer(row('A'), 'pointerdown', touch());
			dispatchPointer(row('B'), 'pointermove', touch());
			dispatchPointer(row('B'), 'pointerup', touch());
			documentListener.mockClear();
			const clickEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				detail: 1
			});
			row('A').dispatchEvent(clickEvent);
			expect(clickEvent.defaultPrevented).toBe(true);
			expect(documentListener).not.toHaveBeenCalled();
			expect(onSelect).toHaveBeenCalledTimes(1);
			expect(onSelect).toHaveBeenCalledWith('B');
		} finally {
			document.removeEventListener('click', documentListener, true);
		}
	});

	it('lets a click with detail 0 (a keyboard or screen reader activation) through', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		dispatchClick(row('B'), 0);
		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(onSelect).toHaveBeenLastCalledWith('B');
	});

	it('lets a click with no tracked gesture behind it act as it always did', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchClick(row('A'), 1);
		expect(onSelect).toHaveBeenCalledWith('A');
	});

	it('disarms the swallower at the next pointer press, so a later tap is never eaten', async () => {
		const onSelect = vi.fn();
		const { outside, row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		// A new gesture begins elsewhere before the stray click ever arrived.
		dispatchPointer(outside, 'pointerdown', touch(2));
		dispatchClick(row('B'), 1);
		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(onSelect).toHaveBeenLastCalledWith('B');
	});

	it('disarms the swallower after the short window', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		vi.advanceTimersByTime(MENU_PRESS_STRAY_CLICK_MS + 1);
		dispatchClick(row('B'), 1);
		expect(onSelect).toHaveBeenCalledTimes(2);
	});
});

describe("useMenuPress — a finger's touchend (spec:AST-094 FR21)", () => {
	// A phone or tablet (a coarse primary pointer), or a touchscreen laptop
	// (a fine one): FR21 covers a finger on every device (spec:AST-094 FR43).
	const stubPrimaryPointer = (kind: 'coarse' | 'fine') => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: kind === 'coarse' && query === '(pointer: coarse)',
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false
		}));
	};
	beforeEach(() => {
		stubPrimaryPointer('coarse');
	});

	it("a finger's tap on a row cancels that touch's touchend, so the browser sends no click", async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(true);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith('A');
	});

	it('a finger that slides onto another row and lifts there cancels its touchend', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('B'), 'pointermove', touch());
		dispatchPointer(row('B'), 'pointerup', touch());
		// The touch's events stay with the element it landed on.
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(true);
		expect(onSelect).toHaveBeenCalledWith('B');
	});

	it('a finger released outside the menu cancels its touchend, and the menu stays open', async () => {
		const onDismiss = vi.fn();
		const { outside, row } = await harness({ onDismiss });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(outside, 'pointermove', touch());
		dispatchPointer(outside, 'pointerup', touch());
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(true);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('the finger that opened the menu from the trigger cancels its touchend at the lift', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const { trigger, row } = await harness({ onSelect });
		dispatchPointer(trigger, 'pointerdown', touch());
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		dispatchPointer(row('C'), 'pointermove', touch());
		dispatchPointer(row('C'), 'pointerup', touch());
		expect(fireTouchEnd(trigger).defaultPrevented).toBe(true);
		expect(onSelect).toHaveBeenCalledWith('C');
	});

	it("a finger's tap on the trigger keeps its touchend: its click opens the menu", async () => {
		const onOpenChange = vi.fn();
		const { trigger } = await harness({ onOpenChange });
		dispatchPointer(trigger, 'pointerdown', touch());
		dispatchPointer(trigger, 'pointerup', touch());
		expect(fireTouchEnd(trigger).defaultPrevented).toBe(false);
		dispatchClick(trigger, 1);
		await tick();
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
	});

	it('a mouse or a pen release cancels no touchend; its stray click is still swallowed', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		for (const pointer of [mouse, pen]) {
			dispatchPointer(row('A'), 'pointerdown', pointer());
			dispatchPointer(row('A'), 'pointerup', pointer());
			expect(fireTouchEnd(row('A')).defaultPrevented).toBe(false);
			dispatchClick(row('A'), 1);
		}
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it('a touch the browser took (pointercancel) has its touchend left alone', async () => {
		const { row } = await harness();
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointercancel', touch());
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(false);
	});

	it('once the touchend is cancelled, the swallower stands down: a later click with no press behind it acts (module FR5)', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(true);
		// Well inside the stray-click window, a click that no tracked gesture
		// explains, a script's say.
		dispatchClick(row('B'), 1);
		expect(onSelect.mock.calls).toEqual([['A'], ['B']]);
	});

	it('where the primary pointer is fine too, a finger\u2019s tracked release cancels its touchend, and its stray click acts on nothing (spec:AST-094 FR21, FR43)', async () => {
		stubPrimaryPointer('fine');
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('B'), 'pointermove', touch());
		dispatchPointer(row('B'), 'pointerup', touch());
		expect(fireTouchEnd(row('B')).defaultPrevented).toBe(true);
		expect(onSelect.mock.calls).toEqual([['B']]);
	});

	it('where the primary pointer is fine too, a finger that lifts outside the menu has its touchend cancelled, and the menu stays open (spec:AST-094 FR21, FR28, FR43)', async () => {
		stubPrimaryPointer('fine');
		const onDismiss = vi.fn();
		const { outside, row } = await harness({ onDismiss });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(outside, 'pointermove', touch());
		dispatchPointer(outside, 'pointerup', touch());
		expect(fireTouchEnd(outside).defaultPrevented).toBe(true);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('cancels only that touch: the next press ends the wait, and a later touchend passes', async () => {
		const { outside, row } = await harness();
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('A'), 'pointerup', touch());
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(true);
		expect(fireTouchEnd(row('A')).defaultPrevented).toBe(false);
		dispatchPointer(row('B'), 'pointerdown', touch(2));
		dispatchPointer(row('B'), 'pointerup', touch(2));
		dispatchPointer(outside, 'pointerdown', touch(3));
		expect(fireTouchEnd(row('B')).defaultPrevented).toBe(false);
	});
});

describe('useMenuPress — release outside and cancellation', () => {
	it('a mouse released outside acts on nothing and dismisses the menu', async () => {
		const onSelect = vi.fn();
		const onDismiss = vi.fn();
		const { outside, row } = await harness({ onSelect, onDismiss });
		dispatchPointer(row('A'), 'pointerdown', mouse());
		dispatchPointer(outside, 'pointermove', mouse());
		dispatchPointer(outside, 'pointerup', mouse());
		expect(onSelect).not.toHaveBeenCalled();
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('a finger released outside acts on nothing and leaves the menu open', async () => {
		const onSelect = vi.fn();
		const onDismiss = vi.fn();
		const { outside, row } = await harness({ onSelect, onDismiss });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(outside, 'pointermove', touch());
		dispatchPointer(outside, 'pointerup', touch());
		expect(onSelect).not.toHaveBeenCalled();
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('a pointercancel ends the gesture without acting', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch());
		dispatchPointer(row('B'), 'pointermove', touch());
		dispatchPointer(row('A'), 'pointercancel', touch());
		dispatchPointer(row('B'), 'pointerup', touch());
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('a second pointer ends the gesture and does not start another', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch(1));
		dispatchPointer(row('B'), 'pointerdown', touch(2));
		dispatchPointer(row('B'), 'pointerup', touch(2));
		dispatchPointer(row('C'), 'pointerup', touch(1));
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('ignores a pointer of another id while one is tracked', async () => {
		const onSelect = vi.fn();
		const { row } = await harness({ onSelect });
		dispatchPointer(row('A'), 'pointerdown', touch(1));
		dispatchPointer(row('C'), 'pointermove', touch(7));
		expect(row('A')).toHaveFocus();
		dispatchPointer(row('C'), 'pointerup', touch(7));
		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('useMenuPress — the trigger', () => {
	it('a mouse released back on the trigger acts on nothing and leaves the menu open', async () => {
		const onSelect = vi.fn();
		const onDismiss = vi.fn();
		const { trigger, row } = await harness({ onSelect, onDismiss });
		dispatchPointer(row('A'), 'pointerdown', mouse());
		dispatchPointer(trigger, 'pointermove', mouse());
		dispatchPointer(trigger, 'pointerup', mouse());
		expect(onSelect).not.toHaveBeenCalled();
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('a mouse press on the trigger opens the menu, and that gesture\u2019s click does not toggle it', async () => {
		const onOpenChange = vi.fn();
		const { trigger } = await harness({ onOpenChange });
		dispatchPointer(trigger, 'pointerdown', mouse());
		await tick();
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		dispatchPointer(trigger, 'pointerup', mouse());
		dispatchClick(trigger, 1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('a mouse press on the trigger of an open menu closes it and does not reopen it in the same gesture', async () => {
		const onOpenChange = vi.fn();
		const { trigger } = await harness({ onOpenChange });
		dispatchPointer(trigger, 'pointerdown', mouse());
		dispatchPointer(trigger, 'pointerup', mouse());
		dispatchClick(trigger, 1);
		await tick();
		dispatchPointer(trigger, 'pointerdown', mouse());
		await tick();
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		dispatchPointer(trigger, 'pointerup', mouse());
		dispatchClick(trigger, 1);
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('a drag from the trigger into the menu that releases over a row acts on it', async () => {
		const onSelect = vi.fn();
		const { trigger, row } = await harness({ onSelect });
		dispatchPointer(trigger, 'pointerdown', mouse());
		dispatchPointer(row('B'), 'pointermove', mouse());
		expect(row('B')).toHaveFocus();
		dispatchPointer(row('B'), 'pointerup', mouse());
		expect(onSelect).toHaveBeenCalledWith('B');
	});

	it('the opening release before the settle time acts on nothing; after it, it acts', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const { trigger, row } = await harness({ onSelect });
		dispatchPointer(trigger, 'pointerdown', mouse());
		vi.advanceTimersByTime(MENU_PRESS_SETTLE_MS - 1);
		dispatchPointer(row('B'), 'pointerup', mouse());
		await tick();
		expect(onSelect).not.toHaveBeenCalled();
		expect(trigger).toHaveAttribute('aria-expanded', 'true');

		dispatchPointer(trigger, 'pointerdown', mouse());
		await tick();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		dispatchPointer(trigger, 'pointerup', mouse());
		dispatchPointer(trigger, 'pointerdown', mouse());
		await tick();
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		vi.advanceTimersByTime(MENU_PRESS_SETTLE_MS);
		dispatchPointer(row('B'), 'pointerup', mouse());
		expect(onSelect).toHaveBeenCalledWith('B');
	});

	it('a finger held on the trigger opens after the long-press delay and then tracks', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const onOpenChange = vi.fn();
		const { trigger, row } = await harness({ onSelect, onOpenChange });
		dispatchPointer(trigger, 'pointerdown', touch());
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS - 1);
		expect(onOpenChange).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		dispatchPointer(row('C'), 'pointermove', touch());
		expect(row('C')).toHaveFocus();
		dispatchPointer(row('C'), 'pointerup', touch());
		expect(onSelect).toHaveBeenCalledWith('C');
	});

	it('a finger that lifts before the delay is a tap: the browser click opens the menu', async () => {
		vi.useFakeTimers();
		const onOpenChange = vi.fn();
		const { trigger } = await harness({ onOpenChange });
		dispatchPointer(trigger, 'pointerdown', touch());
		dispatchPointer(trigger, 'pointerup', touch());
		dispatchClick(trigger, 1);
		await tick();
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});

	it('a finger that travels on the trigger is a scroll, not a held press', async () => {
		vi.useFakeTimers();
		const onOpenChange = vi.fn();
		const { trigger } = await harness({ onOpenChange });
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		dispatchPointer(trigger, 'pointermove', { ...touch(), clientX: 0, clientY: 40 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("a finger held on the trigger may drift 12 pt and still opens under every primary pointer; past FR29's 13 pt drift allowance it is a scroll (spec:AST-094 FR29, FR43; useMenuPress FR9)", async () => {
		vi.useFakeTimers();
		const original = window.matchMedia;
		const pointerIs = (coarse: boolean) => {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				writable: true,
				value: (query: string) =>
					({
						matches: coarse && query === '(pointer: coarse)',
						media: query,
						onchange: null,
						addEventListener: () => {},
						removeEventListener: () => {},
						addListener: () => {},
						removeListener: () => {},
						dispatchEvent: () => false
					}) as MediaQueryList
			});
		};
		const hold = async (drift: number) => {
			const onOpenChange = vi.fn();
			const screen = await render(Probe, { props: { onOpenChange } });
			const trigger = triggerIn(screen.container);
			dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
			dispatchPointer(trigger, 'pointermove', { ...touch(), clientX: 0, clientY: drift });
			vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
			const opened = onOpenChange.mock.calls.some(([open]) => open === true);
			dispatchPointer(trigger, 'pointerup', touch());
			await screen.unmount();
			return opened;
		};
		try {
			for (const coarse of [true, false]) {
				pointerIs(coarse);
				expect(await hold(12)).toBe(true);
				expect(await hold(14)).toBe(false);
			}
		} finally {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				writable: true,
				value: original
			});
		}
	});

	it("measures FR29's drift allowance on each axis where the primary pointer is fine, as on a phone: a finger's (12, 12) settle on the trigger still opens, a 14 px drift does not (useMenuPress FR9)", async () => {
		vi.useFakeTimers();
		const original = window.matchMedia;
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			writable: true,
			value: (query: string) =>
				({
					matches: false,
					media: query,
					onchange: null,
					addEventListener: () => {},
					removeEventListener: () => {},
					addListener: () => {},
					removeListener: () => {},
					dispatchEvent: () => false
				}) as MediaQueryList
		});
		const hold = async (dx: number, dy: number) => {
			const onOpenChange = vi.fn();
			const screen = await render(Probe, { props: { onOpenChange } });
			const trigger = triggerIn(screen.container);
			dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
			dispatchPointer(trigger, 'pointermove', { ...touch(), clientX: dx, clientY: dy });
			vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
			const opened = onOpenChange.mock.calls.some(([open]) => open === true);
			dispatchPointer(trigger, 'pointerup', touch());
			await screen.unmount();
			return opened;
		};
		try {
			expect(await hold(12, 12)).toBe(true);
			expect(await hold(0, 14)).toBe(false);
		} finally {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				writable: true,
				value: original
			});
		}
	});

	it('reads no pointer query from a menu, its rows or its trigger, a press on the trigger included: its drift allowance is the same under every primary pointer (spec:AST-094 FR24, FR43)', async () => {
		vi.useFakeTimers();
		const original = window.matchMedia;
		const listening: string[] = [];
		const read: string[] = [];
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			writable: true,
			value: (query: string) =>
				read.push(query) &&
				({
					matches: false,
					media: query,
					onchange: null,
					addEventListener: () => listening.push(query),
					removeEventListener: () => {},
					addListener: () => listening.push(query),
					removeListener: () => {},
					dispatchEvent: () => false
				} as MediaQueryList)
		});
		try {
			const screen = await render(Probe);
			const trigger = triggerIn(screen.container);
			dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
			vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
			dispatchPointer(trigger, 'pointerup', touch());
			expect(listening.filter((query) => query.includes('pointer'))).toEqual([]);
			expect(read.filter((query) => query.includes('pointer'))).toEqual([]);
			await screen.unmount();
		} finally {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				writable: true,
				value: original
			});
		}
	});

	it('marks the menu root as carrying the press model', async () => {
		const { menu } = await harness();
		expect(menu).toHaveAttribute('data-astryx-menu-press');
	});
});

describe('useMenuPress — the opening finger hands off (DropdownMenu\u2019s touch model, spec:AST-094 FR29)', () => {
	it('the finger that opened the menu from the trigger picks only once it travels the handoff from the first sample', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const onOpenChange = vi.fn();
		const { trigger, row } = await harness({
			touchModel: 'uikit',
			onSelect,
			onOpenChange
		});
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		// The first sample after the open is where the distance counts from.
		dispatchPointer(row('C'), 'pointermove', { ...touch(), clientX: 0, clientY: 4 });
		dispatchPointer(row('C'), 'pointermove', {
			...touch(),
			clientX: 0,
			clientY: 4 + MENU_PRESS_HANDOFF_PX - 1
		});
		expect(row('C')).not.toHaveFocus();
		dispatchPointer(row('C'), 'pointermove', {
			...touch(),
			clientX: 0,
			clientY: 4 + MENU_PRESS_HANDOFF_PX
		});
		expect(row('C')).toHaveFocus();
		dispatchPointer(row('C'), 'pointerup', {
			...touch(),
			clientX: 0,
			clientY: 4 + MENU_PRESS_HANDOFF_PX
		});
		expect(onSelect).toHaveBeenCalledWith('C');
	});

	it('the finger that opened the menu lifts without travelling the handoff: nothing acts and the menu stays', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const onOpenChange = vi.fn();
		const { trigger, row } = await harness({
			touchModel: 'uikit',
			onSelect,
			onOpenChange
		});
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		vi.advanceTimersByTime(2000);
		await tick();
		// The row under the finger is not highlighted however long it rests.
		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 0, clientY: 1 });
		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 0, clientY: 9 });
		expect(row('A')).not.toHaveFocus();
		dispatchPointer(row('A'), 'pointerup', { ...touch(), clientX: 0, clientY: 9 });
		// The browser's click for the press is spent too.
		dispatchClick(row('A'), 1);
		expect(onSelect).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('the pointer model (the public hook\u2019s) keeps the settle rule: once the press has settled, a still finger\u2019s lift over a row acts', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const { trigger, row } = await harness({ onSelect });
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS + MENU_PRESS_SETTLE_MS);
		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientX: 0, clientY: 2 });
		dispatchPointer(row('A'), 'pointerup', { ...touch(), clientX: 0, clientY: 2 });
		expect(onSelect).toHaveBeenCalledWith('A');
	});
});

describe('useMenuPress — the public hook takes no touch model option', () => {
	it('the opening finger keeps the settle rule, though an untyped caller passes the touch model', async () => {
		vi.useFakeTimers();
		const onSelect = vi.fn();
		const screen = await render(PublicProbe, { props: { onSelect } });
		const trigger = screen.container.querySelector('button');
		if (!(trigger instanceof HTMLElement)) throw new Error('expected the trigger button');
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 0, clientY: 0 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS + MENU_PRESS_SETTLE_MS);
		await tick();
		const row = rowIn(screen.container, 'A');
		// No handoff: the settled press's still lift acts, as released.
		dispatchPointer(row, 'pointermove', { ...touch(), clientX: 0, clientY: 2 });
		dispatchPointer(row, 'pointerup', { ...touch(), clientX: 0, clientY: 2 });
		expect(onSelect).toHaveBeenCalledWith('A');
	});
});

describe('useMenuPress — edge autoscroll', () => {
	it('a pointer resting near the bottom edge scrolls the menu down and stops when it leaves the zone', async () => {
		vi.useFakeTimers();
		let scroller: HTMLElement | null = null;
		const screen = await harness({ isScrollable: true, getScroller: () => scroller });
		const { menu, row } = screen;
		scroller = menu;
		menu.getBoundingClientRect = () =>
			({
				top: 0,
				bottom: 100,
				left: 0,
				right: 200,
				width: 200,
				height: 100,
				x: 0,
				y: 0,
				toJSON: () => ({})
			}) as DOMRect;
		dispatchPointer(row('A'), 'pointerdown', { ...touch(), clientY: 50 });
		expect(menu.scrollTop).toBe(0);
		dispatchPointer(row('A'), 'pointermove', {
			...touch(),
			clientY: 100 - MENU_PRESS_AUTOSCROLL_ZONE_PX / 2
		});
		const afterFirst = menu.scrollTop;
		expect(afterFirst).toBeGreaterThan(0);
		vi.advanceTimersByTime(100);
		expect(menu.scrollTop).toBeGreaterThan(afterFirst);

		dispatchPointer(row('A'), 'pointermove', { ...touch(), clientY: 50 });
		const atRest = menu.scrollTop;
		vi.advanceTimersByTime(100);
		expect(menu.scrollTop).toBe(atRest);

		dispatchPointer(row('A'), 'pointerup', { ...touch(), clientY: 50 });
		vi.advanceTimersByTime(100);
		expect(menu.scrollTop).toBe(atRest);
	});

	it('gives the page back its scroll when a held finger is cancelled', async () => {
		// A held finger installs a document-level touchmove preventer so the page
		// does not scroll under the opening menu. Only the end of a gesture takes
		// it off again, and a pointercancel is ordinary on touch — an incoming
		// call, a system gesture. Cancelling used to leave the preventer live and
		// the page unable to scroll at all.
		vi.useFakeTimers();
		const { trigger } = await harness();
		dispatchPointer(trigger, 'pointerdown', { ...touch(), clientX: 10, clientY: 10 });
		vi.advanceTimersByTime(MENU_PRESS_LONG_PRESS_MS);
		await tick();
		expect(trigger).toHaveAttribute('aria-expanded', 'true');

		const held = new Event('touchmove', { bubbles: true, cancelable: true });
		document.dispatchEvent(held);
		expect(held.defaultPrevented).toBe(true);

		dispatchPointer(trigger, 'pointercancel', touch());

		const afterCancel = new Event('touchmove', {
			bubbles: true,
			cancelable: true
		});
		document.dispatchEvent(afterCancel);
		expect(afterCancel.defaultPrevented).toBe(false);
	});
});
