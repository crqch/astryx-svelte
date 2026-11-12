// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file use-menu-press.svelte.ts
 * @input The menu root, its trigger, the enabled-row selector, and callbacks
 *   for opening, highlighting, activating and dismissing
 * @output useMenuPress, the marker attributes, the activation mark, and the
 *   internal useDropdownMenuPress entry with its touch model
 * @position Core hook for DropdownMenu, ContextMenu, DropdownMenuSubMenu and
 *   TabMenu. The transition table lives in menu-press-gesture.ts.
 *
 * Ported from Astryx's `hooks/useMenuPress.ts`. Svelte has no ref objects, so
 * the options carry **element getters** (`menu`, `trigger`) as you would get
 * them from `bind:this`, and the whole options object comes in as a getter so
 * every read stays current — which is what upstream's `optionsRef` buys. The
 * returned handlers take Svelte's DOM names (`onpointerdown`, `oncontextmenu`)
 * so the result spreads straight onto an element.
 *
 * Upstream reaches a private long-press detector (`useLongPressDetector`) for
 * the held-finger open. This port's public `useLongPress` is the simpler
 * 0.5-pin hook, so the detector's three calls (`start`, `moveTo`, `cancel`)
 * live here, with the same delay and per-press movement tolerance.
 *
 * SYNC: When modified, update hooks/index.ts, hooks/useMenuPress.doc.mjs and
 *   hooks/menuPressGesture.ts.
 */

import { currentGesture } from '../components/layer/gesture-counter.js';
import { isInputShield } from '../components/layer/input-hold.js';
import {
	IDLE_MENU_PRESS,
	menuPressTransition,
	type MenuPressInput,
	type MenuPressOutcome,
	type MenuPressPointerType,
	type MenuPressState
} from './menu-press-gesture.js';
import { MENU_PRESS_MARKER } from './menu-press-marker.js';
import {
	LONG_PRESS_ALLOWABLE_MOVEMENT_PX,
	LONG_PRESS_DURATION_MS
} from '../motion/uikit/longPress.js';
import { edgeAutoscroll } from '../utils/edge-autoscroll.js';
import { focusForLastInput } from '../utils/focus-return.js';
import { trackInteractionModality } from '../utils/interaction-modality.js';
import {
	clearMenuPressLit,
	holdMenuPressPaint,
	markMenuPressLit,
	releaseMenuPressPaint
} from '../private-attributes/menu-press-lit.stylex.js';
import {
	__resetClickGuardForTest,
	armClickGuard,
	CLICK_GUARD_WINDOW_MS,
	withoutClickGuard
} from '../utils/click-guard.js';

export { MENU_PRESS_MARKER };
const MENU_PRESS_ROOT_SELECTOR = `[${MENU_PRESS_MARKER}]`;
/**
 * Carried by a menu root that another root renders beside itself rather than
 * inside it, naming that root's `id`: the menu of a sub-menu with a header or
 * footer, in a dialog beside the root's menu, is nested in that root for the
 * press model, as a flyout inside the root's DOM is. Nothing else beside the
 * root carries it, so a picker placed in a header or footer stays its own root.
 */
export const MENU_PRESS_SURFACE_ATTR = 'data-astryx-menu-press-surface';

/**
 * How long after a tracked release the browser's click is still swallowed:
 * the shared click guard's window (utils/click-guard.ts).
 */
export const MENU_PRESS_STRAY_CLICK_MS = CLICK_GUARD_WINDOW_MS;
/** How long a finger must rest on the trigger before the menu opens under it. */
export const MENU_PRESS_LONG_PRESS_MS = LONG_PRESS_DURATION_MS;
/**
 * How far a finger held on a DropdownMenu trigger may move before the open,
 * in CSS px, under every primary pointer. A native menu still opens after a
 * 12 pt move. ContextMenu keeps the long press's own allowable movement.
 */
export const MENU_PRESS_TRIGGER_DRIFT_PX = 13;

/** A held finger on the trigger gets the same drift allowance under every primary pointer. */
const TRIGGER_TOLERANCE = {
	moveCancelPx: MENU_PRESS_TRIGGER_DRIFT_PX
};
/** Distance from a scrolling menu's edge within which a resting pointer scrolls. */
export const MENU_PRESS_AUTOSCROLL_ZONE_PX = 24;
const AUTOSCROLL_STEP_PX = 6;
const AUTOSCROLL_INTERVAL_MS = 16;

const FOCUSABLE_ROW_SELECTOR =
	'[tabindex], a[href], button, input, select, textarea, [contenteditable]';
const INNER_CONTROL_SELECTOR = 'a[href], button, [tabindex]';

let isModelActivation = false;

/**
 * Whether a menu row activation dispatched by the press model is in flight.
 * True for the synchronous extent of that dispatch, so a row that forwards
 * the activation to a control inside it (a link) can tell the model's click
 * from the browser's stray one.
 */
export function isMenuPressActivation(): boolean {
	return isModelActivation;
}

/** Test-only: forget an armed click guard between cases. */
export function __resetMenuPressForTest(): void {
	__resetClickGuardForTest();
}

export interface UseMenuPressOptions {
	/** The menu (or listbox) root: the surface whose rows the press picks from. */
	menu: () => HTMLElement | null;
	/** The control that opens the menu, when the press may start there. */
	trigger?: () => HTMLElement | null;
	/**
	 * Selector matching the ENABLED rows. A pointer over anything else inside
	 * the menu — a divider, a heading, a disabled row — highlights nothing.
	 */
	itemSelector: string;
	/**
	 * A mouse pressed the trigger, or a finger has rested on it for the
	 * long-press delay: open the menu under the held pointer. Return whether
	 * it opened; a `false` (the press closed an open menu instead) ends the
	 * gesture. The click the trigger receives for this same gesture is reported
	 * by {@link UseMenuPressReturn.isTriggerClickFromPress} so the caller can
	 * leave it alone.
	 */
	onTriggerPress?: (pointerType: MenuPressPointerType) => boolean;
	/**
	 * Move the highlight. `null` clears it. Defaults to moving DOM focus with
	 * `preventScroll` onto the row (or the control inside it), and onto the
	 * menu root when there is no row — a picker that highlights through
	 * `aria-activedescendant` supplies its own.
	 */
	onHighlight?: (row: HTMLElement | null) => void;
	/**
	 * Act on the row under the release. Defaults to dispatching a click on the
	 * row that carries the release's button and modifier keys, so the row acts
	 * exactly as its own click would.
	 */
	onActivate?: (row: HTMLElement, release: PointerEvent) => void;
	/** A MOUSE was released outside the menu with nothing acting: close it. */
	onDismiss?: () => void;
	/**
	 * The element to scroll while a tracked pointer rests near its edge.
	 * Defaults to the menu root when it overflows; return `null` for none.
	 */
	getScroller?: () => HTMLElement | null;
	/**
	 * Resolve the element under a viewport point. Defaults to
	 * `elementFromPoint` on the menu's own document or shadow root, falling back
	 * to the event target where the document lacks it (jsdom). A test seam.
	 */
	hitTest?: (x: number, y: number) => Element | null;
	/** @default 500 */
	longPressDelayMs?: number;
	/** Whether the model is live. @default true */
	isEnabled?: boolean;
}

export interface UseMenuPressReturn {
	/** Spread onto the menu root: claims presses that begin inside it. */
	menuProps: {
		onpointerdown: (event: PointerEvent) => void;
		'data-astryx-menu-press': '';
	};
	/** Spread onto the trigger: a mouse press opens; a held finger opens. */
	triggerProps: {
		onpointerdown: (event: PointerEvent) => void;
		oncontextmenu: (event: MouseEvent) => void;
	};
	/**
	 * Whether the click reaching the trigger belongs to the gesture that just
	 * pressed it — the press already opened or closed the menu, so the click
	 * must neither toggle nor reopen it.
	 */
	isTriggerClickFromPress: () => boolean;
	/** End the gesture in flight with nothing acting (the menu closed). */
	cancel: () => void;
}

function normalizePointerType(type: string): MenuPressPointerType | null {
	return type === 'mouse' || type === 'touch' || type === 'pen' ? type : null;
}

function isRowFocusable(row: HTMLElement): boolean {
	return row.matches(FOCUSABLE_ROW_SELECTOR);
}

/** The outermost marked root: a flyout is a DOM descendant of its parent menu. */
function getOutermostRoot(menu: HTMLElement): HTMLElement {
	let root = menu;
	for (;;) {
		const parent =
			root.parentElement?.closest<HTMLElement>(MENU_PRESS_ROOT_SELECTOR) ?? getSurfaceOwner(root);
		if (parent == null || parent === root) {
			return root;
		}
		root = parent;
	}
}

/**
 * The menu root that renders `menu` beside itself, if any (see
 * `MENU_PRESS_SURFACE_ATTR`). Read off the menu itself, never an ancestor, so
 * a root placed in a region of that surface is not adopted.
 */
function getSurfaceOwner(menu: HTMLElement): HTMLElement | null {
	const ownerId = menu.getAttribute(MENU_PRESS_SURFACE_ATTR);
	if (!ownerId) {
		return null;
	}
	const owner = menu.ownerDocument.getElementById(ownerId);
	return owner?.matches(MENU_PRESS_ROOT_SELECTOR) === true ? owner : null;
}

/**
 * Whether `element` is inside the menu tree whose outermost root is `root`:
 * inside the root itself, or inside a menu nested in it through a surface
 * the root renders beside itself. Anything else in such a surface (a header
 * field, say) is outside the menu, as the root's own regions are.
 */
function isInMenuTree(element: Element, root: HTMLElement): boolean {
	if (root.contains(element)) {
		return true;
	}
	const owner = element.closest<HTMLElement>(MENU_PRESS_ROOT_SELECTOR);
	return owner != null && getOutermostRoot(owner) === root;
}

interface ResolvedPoint {
	row: HTMLElement | null;
	isInMenu: boolean;
	isOnTrigger: boolean;
}

/**
 * DropdownMenu's options for the press model: everything the public hook
 * takes, plus its touch model. DropdownMenu reaches the touch model through
 * its `presentation`, so the public hook has no such option.
 *
 * @internal
 */
export interface DropdownMenuPressOptions extends UseMenuPressOptions {
	/**
	 * How the finger that opened the menu from the trigger picks.
	 * `'pointer'`: its opening press follows the settle rule. `'uikit'`: it
	 * picks only after UIMenu's handoff distance, so the row that appeared
	 * under it never acts on a still lift. A mouse is unaffected.
	 * @default 'pointer'
	 */
	touchModel?: 'pointer' | 'uikit';
}

/**
 * What core's own menus get from {@link useDropdownMenuPress}: the public
 * return. Not exported from the hooks entry point.
 *
 * @internal
 */
export type DropdownMenuPressReturn = UseMenuPressReturn;

/** A held-finger detector driven from the hook's own pointer stream. */
interface MenuLongPress {
	start: (point: { x: number; y: number }, tolerance?: { moveCancelPx?: number }) => void;
	moveTo: (point: { x: number; y: number }) => boolean;
	cancel: () => void;
}

/**
 * Where a pointer is, for a finger's handoff distance. Positions reach the
 * machine only under `touchModel: 'uikit'`. Without them, it keeps the settle
 * rule.
 */
function handoffPosition(event: PointerEvent, hasHandoff: boolean): { x?: number; y?: number } {
	return hasHandoff ? { x: event.clientX, y: event.clientY } : {};
}

/**
 * The press model for a menu: the row under the release acts, the highlight
 * follows a held pointer, and a mouse opens the menu on press.
 *
 * - The document tracks the pointer by `pointerId`. A finger's events stay
 *   with the element it landed on, so the menu never sees a finger that slid
 *   onto it.
 * - The release acts on its row as the row's own click would, with the
 *   release's button and modifier keys.
 * - The browser's stray `click` after a tracked release is swallowed at the
 *   window, in the capture phase. A click with `detail === 0` always passes.
 * - A finger held on the trigger opens the menu after the long-press delay.
 *   The settle rule in menu-press-gesture.ts decides if that release can act.
 * - `pointercancel`, a second pointer, or a window blur ends the gesture, and
 *   nothing acts.
 * - A pointer that rests near the edge of an overflowing menu scrolls it.
 * - The root carries `data-astryx-menu-press`, so a nested flyout can tell
 *   which level owns a press.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   let buttonEl = $state<HTMLElement | null>(null);
 *   let listEl = $state<HTMLElement | null>(null);
 *   const menuPress = useMenuPress(() => ({
 *     menu: () => listEl,
 *     trigger: () => buttonEl,
 *     itemSelector: MENU_ITEM_SELECTOR,
 *     onTriggerPress: () => openMenu(),
 *     onDismiss: closeMenu
 *   }));
 * </script>
 * <button bind:this={buttonEl} {...menuPress.triggerProps} onclick={(event) => {
 *   if (menuPress.isTriggerClickFromPress()) return;
 *   toggle();
 * }}>Open</button>
 * <div bind:this={listEl} role="menu" {...menuPress.menuProps}>…</div>
 * ```
 */
export function useMenuPress(options: () => UseMenuPressOptions): UseMenuPressReturn {
	// The touch model is DropdownMenu's alone; an untyped caller's `touchModel`
	// does not reach the model.
	return useDropdownMenuPress(() => {
		const { touchModel: _touchModel, ...publicOptions } = options() as DropdownMenuPressOptions;
		return { ...publicOptions, touchModel: 'pointer' };
	});
}

/**
 * The press model with DropdownMenu's touch model
 * ({@link DropdownMenuPressOptions.touchModel}). Not exported from the hooks
 * entry point.
 *
 * @internal
 */
export function useDropdownMenuPress(
	options: () => DropdownMenuPressOptions
): DropdownMenuPressReturn {
	let gesture: MenuPressState<HTMLElement> = IDLE_MENU_PRESS;
	let pointerId: number | null = null;
	let detach: (() => void) | null = null;
	// The edge autoscroll running now: its scroller, its direction, and the
	// re-read of the row under the resting pointer after each step.
	let autoscrollRunning: {
		scroller: HTMLElement;
		direction: 1 | -1;
		reread: () => void;
	} | null = null;
	let lastPointerEvent: PointerEvent | null = null;
	let triggerGesture: number | null = null;
	// The second pointer that ended a gesture must not start the next one.
	let ignoredPointerId: number | null = null;
	let litRow: HTMLElement | null = null;
	let heldMenu: HTMLElement | null = null;
	let touchMovePreventer: (() => void) | null = null;

	const autoscroll = edgeAutoscroll({
		intervalMs: AUTOSCROLL_INTERVAL_MS,
		immediate: true,
		step: () => (autoscrollRunning?.direction ?? 0) * AUTOSCROLL_STEP_PX,
		apply: (delta) => {
			const running = autoscrollRunning;
			if (running == null) {
				return 0;
			}
			const before = running.scroller.scrollTop;
			running.scroller.scrollTop = before + delta;
			const moved = running.scroller.scrollTop - before;
			if (moved === 0) {
				// The edge is reached. There is nothing more to show.
				autoscrollRunning = null;
				return 0;
			}
			running.reread();
			return moved;
		}
	});

	function getDocument(): Document {
		return options().menu()?.ownerDocument ?? options().trigger?.()?.ownerDocument ?? document;
	}

	function resolvePoint(event: PointerEvent): ResolvedPoint {
		const { menu: getMenu, trigger: getTrigger, itemSelector, hitTest } = options();
		const menu = getMenu();
		const doc = getDocument();
		let element: Element | null;
		if (hitTest != null) {
			element = hitTest(event.clientX, event.clientY);
		} else if (typeof doc.elementFromPoint === 'function') {
			// Hit-test in the menu's own tree: inside a shadow root the document
			// answers with the shadow host, never the row under the pointer.
			const tree = menu?.getRootNode();
			const scope: Pick<Document, 'elementFromPoint' | 'elementsFromPoint'> =
				tree != null && tree !== doc && typeof (tree as ShadowRoot).elementFromPoint === 'function'
					? (tree as ShadowRoot)
					: doc;
			element = scope.elementFromPoint(event.clientX, event.clientY);
			if (isInputShield(element) && typeof scope.elementsFromPoint === 'function') {
				// An input hold's shield covers the viewport while the menu enters.
				// It keeps new input away, but the press in flight still reaches the
				// row under it. So the hit test sees through that shield only.
				element =
					scope
						.elementsFromPoint(event.clientX, event.clientY)
						.find((candidate) => !isInputShield(candidate)) ?? null;
			}
		} else {
			element = event.target instanceof Element ? event.target : null;
		}
		const root = menu == null ? null : getOutermostRoot(menu);
		const isInMenu = root != null && element != null && isInMenuTree(element, root);
		const trigger = getTrigger?.() ?? null;
		const isOnTrigger = trigger != null && element != null && trigger.contains(element);
		let row: HTMLElement | null = null;
		if (isInMenu && element != null) {
			row = element.closest<HTMLElement>(itemSelector);
			if (row != null && !isInMenuTree(row, root)) {
				row = null;
			}
		}
		return { row, isInMenu, isOnTrigger };
	}

	function stopAutoscroll(): void {
		autoscroll.stop();
		autoscrollRunning = null;
	}

	function endGesture(): void {
		longPress.cancel();
		if (litRow != null) {
			clearMenuPressLit(litRow);
			litRow = null;
		}
		if (heldMenu != null) {
			releaseMenuPressPaint(heldMenu);
			heldMenu = null;
		}
		touchMovePreventer?.();
		touchMovePreventer = null;
		stopAutoscroll();
		detach?.();
		detach = null;
		pointerId = null;
		lastPointerEvent = null;
		gesture = IDLE_MENU_PRESS;
	}

	function highlight(row: HTMLElement | null): void {
		// A held finger or pen marks the row it lights, for the row's pressed
		// paint. A held mouse keeps the hover tint, as on a desktop.
		const isHeld = gesture.phase !== 'idle' && gesture.pointerType !== 'mouse';
		const lit = isHeld ? row : null;
		if (litRow !== lit) {
			if (litRow != null) {
				clearMenuPressLit(litRow);
			}
			litRow = lit;
			if (lit != null) {
				markMenuPressLit(lit);
			}
		}
		const { onHighlight, menu: getMenu } = options();
		// The row the press began on stays :active where a pointer hovers, so
		// the menu holds every row but the lit one off that paint.
		const held = isHeld ? getMenu() : null;
		if (heldMenu !== held) {
			if (heldMenu != null) {
				releaseMenuPressPaint(heldMenu);
			}
			heldMenu = held;
			if (held != null) {
				holdMenuPressPaint(held);
			}
		}
		if (onHighlight != null) {
			onHighlight(row);
			return;
		}
		// In a menu the highlight is focus. A row that takes no focus is
		// highlighted through its inner control. Over nothing, the menu root
		// holds focus, so no row is lit. A held press is pointer input, so the
		// row must not match :focus-visible. A plain focus() would keep the
		// modality of the earlier focus.
		const target =
			row == null
				? getMenu()
				: isRowFocusable(row)
					? row
					: row.querySelector<HTMLElement>(INNER_CONTROL_SELECTOR);
		if (target != null && target !== getDocument().activeElement) {
			focusForLastInput(target, { preventScroll: true });
		}
	}

	function activate(row: HTMLElement, native: PointerEvent): void {
		// Every click this dispatches passes the shared click guard.
		withoutClickGuard(() => {
			const { onActivate } = options();
			isModelActivation = true;
			try {
				if (onActivate != null) {
					onActivate(row, native);
					return;
				}
				// The row acts as its own click would. `detail: 0` marks a dispatched
				// activation, as a keyboard's does, so the click guard lets it pass.
				// The button and the modifiers are the release's.
				row.dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true,
						composed: true,
						detail: 0,
						button: native.button,
						clientX: native.clientX,
						clientY: native.clientY,
						screenX: native.screenX,
						screenY: native.screenY,
						ctrlKey: native.ctrlKey,
						shiftKey: native.shiftKey,
						altKey: native.altKey,
						metaKey: native.metaKey
					})
				);
			} finally {
				isModelActivation = false;
			}
		});
	}

	function applyEffect(
		effect: MenuPressOutcome<HTMLElement>,
		nextGesture: MenuPressState<HTMLElement>,
		native: PointerEvent | undefined
	): void {
		const doc = getDocument();
		switch (effect.type) {
			case 'none':
				return;
			case 'open': {
				const pointerType = nextGesture.phase === 'open' ? nextGesture.pointerType : 'mouse';
				triggerGesture = currentGesture();
				const didOpen = options().onTriggerPress?.(pointerType) ?? false;
				if (!didOpen) {
					endGesture();
				}
				return;
			}
			case 'highlight':
				highlight(effect.row);
				return;
			case 'clear':
				highlight(null);
				return;
			case 'act': {
				// Detach before acting: the activation usually closes the menu.
				endGesture();
				// Once armed, the one swallower stays installed.
				armClickGuard(doc, {
					staysInstalled: true,
					cancelsTouchEnd: native?.pointerType === 'touch'
				});
				if (native != null) {
					activate(effect.row, native);
				}
				return;
			}
			case 'settle': {
				endGesture();
				if (effect.stray) {
					armClickGuard(doc, {
						staysInstalled: true,
						cancelsTouchEnd: native?.pointerType === 'touch'
					});
				}
				if (effect.dismiss) {
					options().onDismiss?.();
				}
				return;
			}
		}
	}

	function step(event: MenuPressInput<HTMLElement>, native?: PointerEvent): void {
		const result = menuPressTransition(gesture, event);
		gesture = result.gesture;
		applyEffect(result.effect, result.gesture, native);
	}

	function getScroller(): HTMLElement | null {
		const { getScroller: custom, menu: getMenu } = options();
		if (custom != null) {
			return custom();
		}
		const menu = getMenu();
		if (menu == null) {
			return null;
		}
		return menu.scrollHeight > menu.clientHeight + 1 ? menu : null;
	}

	function updateAutoscroll(event: PointerEvent): void {
		if (gesture.phase !== 'tracking') {
			stopAutoscroll();
			return;
		}
		const scroller = getScroller();
		if (scroller == null) {
			stopAutoscroll();
			return;
		}
		const rect = scroller.getBoundingClientRect();
		if (rect.height <= 0) {
			stopAutoscroll();
			return;
		}
		let direction: 1 | -1 | 0 = 0;
		if (event.clientY <= rect.top + MENU_PRESS_AUTOSCROLL_ZONE_PX) {
			direction = -1;
		} else if (event.clientY >= rect.bottom - MENU_PRESS_AUTOSCROLL_ZONE_PX) {
			direction = 1;
		}
		if (direction === 0) {
			stopAutoscroll();
			return;
		}
		if (autoscrollRunning?.direction === direction) {
			return;
		}
		stopAutoscroll();
		autoscrollRunning = {
			scroller,
			direction,
			// The rows moved under the resting pointer: re-read the row under it.
			reread: () => {
				const last = lastPointerEvent;
				if (last != null) {
					const point = resolvePoint(last);
					step(
						{
							type: 'move',
							row: point.row,
							isInMenu: point.isInMenu,
							time: Date.now()
						},
						last
					);
				}
			}
		};
		autoscroll.update();
	}

	function attach(trackedPointerId: number): void {
		detach?.();
		const doc = getDocument();
		const view = doc.defaultView;
		pointerId = trackedPointerId;

		const onMove = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) {
				return;
			}
			lastPointerEvent = event;
			if (gesture.phase === 'triggerPress') {
				// A finger that moves past the drift allowance is scrolling, not
				// holding.
				const isPending = longPress.moveTo({
					x: event.clientX,
					y: event.clientY
				});
				if (isPending === false) {
					step({ type: 'cancel' });
				}
				return;
			}
			const point = resolvePoint(event);
			step(
				{
					type: 'move',
					row: point.row,
					isInMenu: point.isInMenu,
					time: Date.now(),
					...handoffPosition(event, options().touchModel === 'uikit')
				},
				event
			);
			updateAutoscroll(event);
		};
		const onUp = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) {
				return;
			}
			const point = resolvePoint(event);
			step(
				{
					type: 'up',
					row: point.row,
					isInMenu: point.isInMenu,
					isOnTrigger: point.isOnTrigger,
					time: Date.now(),
					...handoffPosition(event, options().touchModel === 'uikit')
				},
				event
			);
		};
		const onCancel = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) {
				return;
			}
			step({ type: 'cancel' });
		};
		const onOtherPointerDown = (event: PointerEvent) => {
			// A second pointer ends the gesture: two fingers are a pinch or a
			// scroll, never a pick.
			if (event.pointerId !== pointerId) {
				ignoredPointerId = event.pointerId;
				step({ type: 'cancel' });
			}
		};
		const onBlur = () => {
			step({ type: 'cancel' });
		};

		doc.addEventListener('pointermove', onMove, true);
		doc.addEventListener('pointerup', onUp, true);
		doc.addEventListener('pointercancel', onCancel, true);
		doc.addEventListener('pointerdown', onOtherPointerDown, true);
		view?.addEventListener('blur', onBlur);
		detach = () => {
			doc.removeEventListener('pointermove', onMove, true);
			doc.removeEventListener('pointerup', onUp, true);
			doc.removeEventListener('pointercancel', onCancel, true);
			doc.removeEventListener('pointerdown', onOtherPointerDown, true);
			view?.removeEventListener('blur', onBlur);
		};
	}

	function fireLongPress(): void {
		if (gesture.phase !== 'triggerPress') {
			return;
		}
		triggerGesture = currentGesture();
		const didOpen = options().onTriggerPress?.(gesture.pointerType) ?? false;
		if (!didOpen) {
			step({ type: 'cancel' });
			return;
		}
		// `touch-action` on the trigger was decided when the finger landed; the
		// page must not scroll under a finger that is now driving a menu.
		const doc = getDocument();
		const prevent = (event: TouchEvent) => {
			if (event.cancelable) {
				event.preventDefault();
			}
		};
		doc.addEventListener('touchmove', prevent, { passive: false, capture: true });
		touchMovePreventer = () => {
			doc.removeEventListener('touchmove', prevent, true);
		};
		step({ type: 'opened', time: Date.now() });
	}

	// The detector's hold time comes from the same UIKit source as ContextMenu's
	// long press. The trigger uses one drift allowance under every primary
	// pointer, so no menu, row or trigger reads the pointer query.
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressFrom: { x: number; y: number } | null = null;
	let longPressTolerance: number | null = null;

	function cancelLongPress(): void {
		if (longPressTimer != null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		longPressFrom = null;
		longPressTolerance = null;
	}

	const longPress: MenuLongPress = {
		start(point, tolerance) {
			cancelLongPress();
			longPressFrom = { x: point.x, y: point.y };
			longPressTolerance = tolerance?.moveCancelPx ?? null;
			const delayMs = options().longPressDelayMs ?? MENU_PRESS_LONG_PRESS_MS;
			longPressTimer = setTimeout(() => {
				longPressTimer = null;
				const at = longPressFrom;
				if (at == null) {
					return;
				}
				cancelLongPress();
				fireLongPress();
			}, delayMs);
		},
		moveTo(point) {
			const at = longPressFrom;
			if (at == null) {
				return false;
			}
			const limit = longPressTolerance ?? LONG_PRESS_ALLOWABLE_MOVEMENT_PX;
			if (Math.abs(point.x - at.x) > limit || Math.abs(point.y - at.y) > limit) {
				cancelLongPress();
				return false;
			}
			return true;
		},
		cancel: cancelLongPress
	};

	function handleMenuPointerDown(event: PointerEvent): void {
		const { menu: getMenu, isEnabled = true } = options();
		const menu = getMenu();
		if (!isEnabled || menu == null) {
			return;
		}
		if (event.pointerId === ignoredPointerId) {
			ignoredPointerId = null;
			return;
		}
		if (gesture.phase !== 'idle') {
			// A second pointer landed inside the menu.
			step({ type: 'cancel' });
			return;
		}
		const pointerType = normalizePointerType(event.pointerType);
		if (pointerType == null) {
			return;
		}
		if (pointerType === 'mouse' && event.button !== 0) {
			return;
		}
		// The innermost model owns the press: a flyout is a DOM descendant of
		// its parent menu, and both would otherwise track the same pointer.
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest(MENU_PRESS_ROOT_SELECTOR) !== menu) {
			return;
		}
		if (pointerType !== 'mouse') {
			// Cancelling pointerdown stops the compatibility mouse events that a
			// finger fires at its landing row when it lifts. That mousedown would
			// light the origin row again. touch-action controls scrolling, so
			// scrolling does not change.
			event.preventDefault();
		}
		attach(event.pointerId);
		lastPointerEvent = event;
		const point = resolvePoint(event);
		step(
			{
				type: 'down',
				target: 'menu',
				pointerType,
				row: point.row,
				time: Date.now()
			},
			event
		);
	}

	function handleTriggerPointerDown(event: PointerEvent): void {
		const { isEnabled = true } = options();
		if (event.pointerId === ignoredPointerId) {
			ignoredPointerId = null;
			return;
		}
		if (!isEnabled || gesture.phase !== 'idle') {
			return;
		}
		const pointerType = normalizePointerType(event.pointerType);
		if (pointerType == null || event.button !== 0) {
			return;
		}
		if (pointerType === 'mouse' && event.ctrlKey) {
			// Control-click is the context menu's on macOS.
			return;
		}
		attach(event.pointerId);
		lastPointerEvent = event;
		if (pointerType !== 'mouse') {
			longPress.start({ x: event.clientX, y: event.clientY }, TRIGGER_TOLERANCE);
		}
		step(
			{
				type: 'down',
				target: 'trigger',
				pointerType,
				row: null,
				time: Date.now()
			},
			event
		);
	}

	function handleTriggerContextMenu(event: MouseEvent): void {
		// A finger held on the trigger is opening the menu, not asking for the
		// browser's own context menu.
		if (gesture.phase !== 'idle' && gesture.pointerType !== 'mouse') {
			event.preventDefault();
		}
	}

	function isTriggerClickFromPress(): boolean {
		return triggerGesture != null && triggerGesture === currentGesture();
	}

	function cancel(): void {
		if (gesture.phase !== 'idle') {
			step({ type: 'cancel' });
		}
		endGesture();
	}

	// Syncs the document's interaction-modality tracking with this mount, and
	// ends the gesture on unmount. `currentGesture()` also installs the gesture
	// counter's listeners now, before the first press: a claim of the press that
	// opens the menu reads the counter's pointer id, which exists only if its
	// pointerdown listener heard that press.
	$effect(() => {
		trackInteractionModality();
		currentGesture();
		return () => {
			endGesture();
		};
	});

	return {
		menuProps: {
			onpointerdown: handleMenuPointerDown,
			[MENU_PRESS_MARKER]: ''
		},
		triggerProps: {
			onpointerdown: handleTriggerPointerDown,
			oncontextmenu: handleTriggerContextMenu
		},
		isTriggerClickFromPress,
		cancel
	};
}
