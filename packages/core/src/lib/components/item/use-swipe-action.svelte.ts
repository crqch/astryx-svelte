/**
 * Ported from Astryx's `Item/useSwipeAction.ts`.
 *
 * A native-list swipe: drag a row sideways and the side's panel is uncovered.
 * Under `reveal` a release past half the panel leaves the row resting open
 * with every entry tappable, and a long drag or a fling fires the outermost
 * entry; under `commit` a release past the commit point slides the row out
 * and fires the outermost entry, and nothing rests. After an entry fires the
 * row springs back, or holds out when the entry has `hasRemoval`. A release
 * short of the threshold springs back under both.
 *
 * Touch only, by pointer type rather than by breakpoint: a mouse has the
 * row's own controls and a keyboard has the verb already; the gesture is an
 * accelerator for a verb the row exposes elsewhere, never the only way to
 * reach one.
 *
 * The axis is decided once, at 10 px of travel: a drag more vertical than
 * horizontal belongs to the scroller and is never claimed. The claim is told
 * to the browser: `touch-action: pan-y` is not enough on iOS Safari, whose
 * scroller takes any drag with a vertical component as a pan (a 4:1 drag got
 * `pointercancel` 40 px in; the same drag after a one-second hold, which
 * fails the native pan, ran to the end), so a non-passive `touchmove`
 * listener cancels the default while the row owns the drag, which is the one
 * signal WebKit honours. Before the axis is decided, and for a drag the
 * scroller got, nothing is cancelled.
 *
 * A pinch is the browser's: the root's `touch-action` keeps `pinch-zoom`, and
 * a second finger that lands anywhere before the axis is decided turns the
 * touch into a pinch, so the row lets it go and cancels nothing. A finger
 * that is not the first one down never starts a drag. Once the row owns a
 * drag, a second finger does not break it.
 *
 * The drag's travel is one custom property written on the root, coalesced to
 * one write per frame; the root's transform reads it and the panels'
 * transforms read its negation, so the row moves and the panel appears fixed
 * in the space the row vacates. Settling (the spring back, the slide out)
 * writes a duration the same elements read as their transition clock, so
 * everything derived from the travel moves together. A drag costs no render;
 * the claim and the settle each cost one.
 *
 * Directions are logical: `leading` is a drag toward the inline end and
 * `trailing` a drag toward the inline start, read against the root's computed
 * `direction` at the touch and written beside the travel as a sign the
 * transforms multiply by, so under `dir="rtl"` the finger, the uncovered edge
 * and the panel's logical inset agree.
 */

import { isRtlElement } from '../../hooks/is-rtl-element.js';

/** The travel, in physical px, written on the row root during a drag. */
export const SWIPE_TRAVEL_PROPERTY = '--_item-swipe-travel';
/** +1 when the inline end is to the right (LTR), -1 under RTL. */
export const SWIPE_DIRECTION_PROPERTY = '--_item-swipe-dir';
/** The clock a settle runs on; `0s` while the finger drives the row. */
export const SWIPE_DURATION_PROPERTY = '--_item-swipe-duration';

/** Travel before the axis is decided. */
const AXIS_LOCK_PX = 10;
/** The commit point: this far past the side's panel, or this fraction of the row, whichever is greater. */
const COMMIT_PAST_PANEL_PX = 48;
const COMMIT_FRACTION = 0.5;
/** Under `reveal`, a release this far into the panel rests the row open. */
const REST_FRACTION = 0.5;
/** Travel past the commit point moves the row this much per pixel of finger. */
const OVERSHOOT_RESISTANCE = 0.35;
/** A release at this speed commits from FLING_MIN_PX, short of the commit point. */
const FLING_VELOCITY_PX_PER_MS = 0.6;
const FLING_MIN_PX = 44;
/** How far past the row's edge a slide-out travels. */
const SLIDE_OUT_OVERSHOOT_PX = 24;
/** The slide-out after a commit, and the spring back after a release. */
export const SWIPE_SETTLE_MS = 200;
/** A click the browser synthesizes after a swipe is not a tap on the row. */
const CLICK_SUPPRESS_MS = 400;

export type SwipeSide = 'leading' | 'trailing';
export type SwipeBehavior = 'reveal' | 'commit';
export type SwipePhase =
	/** At rest, closed. */
	| 'idle'
	/** The finger drives the row. */
	| 'dragging'
	/** Springing back or sliding out, on the settle clock. */
	| 'settling'
	/** Resting open with the side's panel tappable (`reveal` only). */
	| 'resting'
	/** Slid out after an entry with `hasRemoval` fired. */
	| 'held';

export interface SwipeState {
	phase: SwipePhase;
	/** The side whose panel is uncovered, or will be. */
	side: SwipeSide;
	/** Past the commit point: letting go now fires the outermost entry. */
	isArmed: boolean;
}

export interface UseSwipeActionOptions {
	/** Off: the handlers do nothing and no row moves. */
	isEnabled: boolean;
	behavior: () => SwipeBehavior;
	/** Which sides have entries. A drag toward a side without any is not claimed. */
	sides: () => { leading: boolean; trailing: boolean };
	/** The natural width of a side's panel, read when a drag begins. */
	measurePanel: (side: SwipeSide) => number;
	/**
	 * Fire the side's outermost entry. Returns whether the row holds out
	 * afterwards (the entry's `hasRemoval`).
	 */
	fireOutermost: (side: SwipeSide) => boolean;
	/** Skip the slide and spring animations. */
	isReducedMotion?: () => boolean;
	/**
	 * The row root: the gesture's target and the element that translates.
	 * Svelte has no ref objects, so the element comes in as a getter, read at
	 * the same points upstream reads `rootRef.current`.
	 */
	rootRef: () => HTMLElement | null;
}

/**
 * The gesture's handlers, named with Svelte's DOM event keys so the root can
 * spread them straight onto its element.
 */
export interface SwipeHandlers {
	onpointerdown: (event: PointerEvent) => void;
	onpointermove: (event: PointerEvent) => void;
	onpointerup: (event: PointerEvent) => void;
	onpointercancel: (event: PointerEvent) => void;
	onclickcapture: (event: MouseEvent) => void;
	onkeydown: (event: KeyboardEvent) => void;
}

export interface UseSwipeActionResult {
	readonly state: SwipeState;
	handlers: SwipeHandlers;
	/**
	 * A resting panel's entry was tapped: fire it, then hold the row out
	 * (`hasRemoval`) or close.
	 */
	activateEntry: (fire: () => boolean) => void;
	/** Close a resting row. */
	close: () => void;
	/** Whether a click arriving now is the one the browser synthesized after a drag. */
	shouldSuppressClick: () => boolean;
}

interface DragState {
	pointerId: number;
	startX: number;
	startY: number;
	/** The travel the row already had when the finger landed (a resting row). */
	baseTravel: number;
	/** null until the axis is decided; false once it went to the scroller. */
	claimed: boolean | null;
	side: SwipeSide;
	panelWidth: number;
	commitPx: number;
	lastX: number;
	lastTime: number;
	prevX: number;
	prevTime: number;
	/** Logical travel toward the side, before resistance. */
	travel: number;
	inlineSign: 1 | -1;
}

const IDLE_STATE: SwipeState = { isArmed: false, phase: 'idle', side: 'leading' };

/** The logical sign of a side: +1 toward the inline end, -1 toward the start. */
function signOf(side: SwipeSide): number {
	return side === 'trailing' ? -1 : 1;
}

function now(): number {
	return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * The first focusable thing in the row outside its swipe panels, for focus to
 * land on when a resting panel closes under it.
 */
function focusRowContent(root: HTMLElement): void {
	const candidates = root.querySelectorAll<HTMLElement>(
		'button, a[href], input, [tabindex]:not([tabindex="-1"])'
	);
	for (const el of candidates) {
		if (el.closest('[data-swipe-panel]') == null) {
			el.focus();
			return;
		}
	}
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
}

export function useSwipeAction({
	isEnabled,
	behavior,
	sides,
	measurePanel,
	fireOutermost,
	isReducedMotion = () => false,
	rootRef
}: UseSwipeActionOptions): UseSwipeActionResult {
	let drag: DragState | null = null;
	let travel = 0;
	let inlineSign: 1 | -1 = 1;
	let suppressClickUntil = 0;
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let frame: number | null = null;
	let pending: number | null = null;
	/** Removes the document listener that watches for a pinch's second finger. */
	let stopPinchWatch: (() => void) | null = null;
	let state = $state<SwipeState>(IDLE_STATE);

	const stopWatchingForPinch = (): void => {
		stopPinchWatch?.();
		stopPinchWatch = null;
	};

	/**
	 * Until the axis is decided, a second finger anywhere on the page makes
	 * the touch a pinch: the row gives it up and cancels nothing, so the
	 * browser zooms. The finger can land off the row, so the document listens.
	 */
	const watchForPinch = (currentDrag: DragState): void => {
		stopWatchingForPinch();
		const onAnyPointerDown = (event: PointerEvent): void => {
			if (
				event.pointerType === 'touch' &&
				event.pointerId !== currentDrag.pointerId &&
				currentDrag.claimed === null
			) {
				currentDrag.claimed = false;
				stopWatchingForPinch();
			}
		};
		document.addEventListener('pointerdown', onAnyPointerDown, {
			capture: true,
			passive: true
		});
		stopPinchWatch = () => {
			document.removeEventListener('pointerdown', onAnyPointerDown, { capture: true });
		};
	};

	/** Write the travel (physical px) the transforms read. */
	function writeTravel(nextTravel: number): void {
		const root = rootRef();
		if (!root) {
			return;
		}
		travel = nextTravel;
		root.style.setProperty(SWIPE_TRAVEL_PROPERTY, `${nextTravel}px`);
	}

	function writeDuration(ms: number): void {
		const root = rootRef();
		if (!root) {
			return;
		}
		if (ms > 0) {
			root.style.setProperty(SWIPE_DURATION_PROPERTY, `${ms}ms`);
		} else {
			root.style.setProperty(SWIPE_DURATION_PROPERTY, '0s');
		}
	}

	function clearInlineProperties(): void {
		const root = rootRef();
		if (!root) {
			return;
		}
		root.style.removeProperty(SWIPE_TRAVEL_PROPERTY);
		root.style.removeProperty(SWIPE_DIRECTION_PROPERTY);
		root.style.removeProperty(SWIPE_DURATION_PROPERTY);
		travel = 0;
	}

	function cancelPendingPaint(): void {
		if (frame != null) {
			cancelAnimationFrame(frame);
		}
		frame = null;
		pending = null;
	}

	/** One write per frame while the finger drives the row. */
	function paintOnNextFrame(nextTravel: number): void {
		pending = nextTravel;
		if (frame != null) {
			return;
		}
		frame = requestAnimationFrame(() => {
			frame = null;
			const next = pending;
			pending = null;
			if (next != null) {
				writeTravel(next);
			}
		});
	}

	/**
	 * Move the row to `travel` on the settle clock, then land in `phase`. A
	 * zero clock (reduced motion) lands at once.
	 */
	function settle(
		side: SwipeSide,
		nextTravel: number,
		phase: 'idle' | 'resting' | 'held',
		afterSlide?: () => boolean
	): void {
		cancelPendingPaint();
		const duration = isReducedMotion() ? 0 : SWIPE_SETTLE_MS;
		state = { isArmed: false, phase: 'settling', side };
		writeDuration(duration);
		writeTravel(nextTravel);
		if (settleTimer != null) {
			clearTimeout(settleTimer);
		}
		settleTimer = setTimeout(() => {
			settleTimer = null;
			writeDuration(0);
			// A settle that fires an entry may start the spring back itself; the
			// landing below is then that settle's to make.
			if (afterSlide?.() === true) {
				return;
			}
			if (phase === 'idle') {
				clearInlineProperties();
			}
			state = phase === 'idle' ? IDLE_STATE : { isArmed: false, phase, side };
		}, duration);
	}

	/**
	 * The outermost entry fires. Under both models the row first travels to
	 * its slide-out, fires, then holds out (`hasRemoval`) or springs back.
	 */
	function slideOutAndFire(side: SwipeSide, sign: 1 | -1): void {
		const root = rootRef();
		const width = root?.clientWidth ?? 0;
		const out = signOf(side) * sign * (width + SLIDE_OUT_OVERSHOOT_PX);
		settle(side, out, 'held', () => {
			const holdsOut = fireOutermost(side);
			if (holdsOut) {
				return false;
			}
			settle(side, 0, 'idle');
			return true;
		});
	}

	function close(): void {
		if (state.phase !== 'resting') {
			return;
		}
		const root = rootRef();
		if (root != null && root.contains(document.activeElement)) {
			focusRowContent(root);
		}
		settle(state.side, 0, 'idle');
	}

	// A resting row closes on a pointer landing anywhere outside it, which is
	// also how a drag on a neighbour closes it: one row rests open at a time
	// with no shared state.
	$effect(() => {
		if (state.phase !== 'resting') {
			return;
		}
		const onOutside = (event: PointerEvent): void => {
			const root = rootRef();
			if (root != null && event.target instanceof Node && !root.contains(event.target)) {
				close();
			}
		};
		document.addEventListener('pointerdown', onOutside, true);
		return () => {
			document.removeEventListener('pointerdown', onOutside, true);
		};
	});

	// The browser's half of the claim (see the file header). Svelte's template
	// listeners are passive, so this one is attached by hand; it is removed
	// with the element.
	$effect(() => {
		const root = rootRef();
		if (root == null || !isEnabled) {
			return;
		}
		const onTouchMove = (event: TouchEvent): void => {
			if (drag?.claimed === true && event.cancelable) {
				event.preventDefault();
			}
		};
		root.addEventListener('touchmove', onTouchMove, { passive: false });
		return () => {
			root.removeEventListener('touchmove', onTouchMove);
		};
	});

	// Releases the settle timer, the animation frame and the pinch watch on
	// unmount.
	$effect(() => {
		return () => {
			if (settleTimer != null) {
				clearTimeout(settleTimer);
			}
			if (frame != null) {
				cancelAnimationFrame(frame);
			}
			stopPinchWatch?.();
			stopPinchWatch = null;
		};
	});

	function activateEntry(fire: () => boolean): void {
		if (state.phase !== 'resting') {
			return;
		}
		const root = rootRef();
		if (root != null && root.contains(document.activeElement)) {
			focusRowContent(root);
		}
		const holdsOut = fire();
		if (holdsOut) {
			const width = root?.clientWidth ?? 0;
			const out = signOf(state.side) * inlineSign * (width + SLIDE_OUT_OVERSHOOT_PX);
			settle(state.side, out, 'held');
		} else {
			settle(state.side, 0, 'idle');
		}
	}

	function onPointerDown(event: PointerEvent): void {
		const inFlight = drag;
		if (inFlight != null) {
			// A second finger before the axis is decided: a pinch, not a swipe.
			if (
				event.pointerType === 'touch' &&
				event.pointerId !== inFlight.pointerId &&
				inFlight.claimed === null
			) {
				inFlight.claimed = false;
				stopWatchingForPinch();
			}
			return;
		}
		if (
			!isEnabled ||
			event.pointerType !== 'touch' ||
			// Another finger is already down: this one is part of a pinch.
			event.isPrimary === false ||
			state.phase === 'settling' ||
			state.phase === 'held'
		) {
			return;
		}
		const root = rootRef();
		const sign: 1 | -1 = isRtlElement(root) ? -1 : 1;
		inlineSign = sign;
		const startTime = now();
		const currentDrag: DragState = {
			// Logical: the physical travel through the inline sign.
			baseTravel: travel * sign,
			claimed: null,
			commitPx: 0,
			inlineSign: sign,
			lastTime: startTime,
			lastX: event.clientX,
			panelWidth: 0,
			pointerId: event.pointerId,
			prevTime: startTime,
			prevX: event.clientX,
			side: state.phase === 'resting' ? state.side : 'leading',
			startX: event.clientX,
			startY: event.clientY,
			travel: 0
		};
		drag = currentDrag;
		watchForPinch(currentDrag);
	}

	function onPointerMove(event: PointerEvent): void {
		const currentDrag = drag;
		if (
			currentDrag == null ||
			currentDrag.pointerId !== event.pointerId ||
			currentDrag.claimed === false
		) {
			return;
		}
		// Logical travel: positive toward the inline end.
		const deltaX = (event.clientX - currentDrag.startX) * currentDrag.inlineSign;
		const deltaY = event.clientY - currentDrag.startY;
		if (currentDrag.claimed === null) {
			if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_PX) {
				return;
			}
			// The axis is decided now, whichever way: a later finger is the
			// swipe's to ignore or the scroller's to use.
			stopWatchingForPinch();
			// More horizontal than vertical is the row's, the rest the scroller's.
			if (Math.abs(deltaX) <= Math.abs(deltaY)) {
				currentDrag.claimed = false;
				return;
			}
			const resting = state.phase === 'resting';
			// From rest, the drag continues the open side (closing it or going
			// further); from closed, the drag's direction names the side.
			const side: SwipeSide = resting ? currentDrag.side : deltaX > 0 ? 'leading' : 'trailing';
			if (!sides()[side]) {
				currentDrag.claimed = false;
				return;
			}
			currentDrag.claimed = true;
			currentDrag.side = side;
			currentDrag.panelWidth = measurePanel(side);
			const width = rootRef()?.clientWidth ?? 0;
			currentDrag.commitPx = Math.max(
				currentDrag.panelWidth + COMMIT_PAST_PANEL_PX,
				width * COMMIT_FRACTION
			);
			const root = rootRef();
			if (root != null) {
				root.style.setProperty(SWIPE_DIRECTION_PROPERTY, String(currentDrag.inlineSign));
			}
			writeDuration(0);
			state = { isArmed: false, phase: 'dragging', side };
			try {
				rootRef()?.setPointerCapture(event.pointerId);
			} catch {
				// Pointer capture is a nicety (keeps the drag when the finger
				// leaves the row); a platform without it still drags.
			}
		}
		const sign = signOf(currentDrag.side);
		// Travel toward the side, counted from where the row already was.
		const raw = Math.max(0, deltaX * sign + currentDrag.baseTravel * sign);
		const offset =
			raw <= currentDrag.commitPx
				? raw
				: currentDrag.commitPx + (raw - currentDrag.commitPx) * OVERSHOOT_RESISTANCE;
		const isArmed = raw >= currentDrag.commitPx;
		if (isArmed !== currentDrag.travel >= currentDrag.commitPx) {
			state = { isArmed, phase: 'dragging', side: currentDrag.side };
		}
		currentDrag.travel = raw;
		currentDrag.prevX = currentDrag.lastX;
		currentDrag.prevTime = currentDrag.lastTime;
		currentDrag.lastX = event.clientX;
		currentDrag.lastTime = now();
		paintOnNextFrame(sign * currentDrag.inlineSign * offset);
	}

	function endGesture(event: PointerEvent, cancelled: boolean): void {
		const currentDrag = drag;
		if (currentDrag == null || currentDrag.pointerId !== event.pointerId) {
			return;
		}
		drag = null;
		stopWatchingForPinch();
		if (currentDrag.claimed !== true) {
			return;
		}
		suppressClickUntil = now() + CLICK_SUPPRESS_MS;
		try {
			rootRef()?.releasePointerCapture(event.pointerId);
		} catch {
			// See setPointerCapture above.
		}
		const { side, inlineSign: sign } = currentDrag;
		const restTravel = signOf(side) * sign * currentDrag.panelWidth;
		if (cancelled) {
			settle(side, 0, 'idle');
			return;
		}
		const elapsed = Math.max(1, currentDrag.lastTime - currentDrag.prevTime);
		const velocity = (signOf(side) * sign * (currentDrag.lastX - currentDrag.prevX)) / elapsed;
		const flung = velocity >= FLING_VELOCITY_PX_PER_MS && currentDrag.travel >= FLING_MIN_PX;
		if (currentDrag.travel >= currentDrag.commitPx || flung) {
			slideOutAndFire(side, sign);
			return;
		}
		if (behavior() === 'reveal' && currentDrag.travel >= currentDrag.panelWidth * REST_FRACTION) {
			settle(side, restTravel, 'resting');
			return;
		}
		settle(side, 0, 'idle');
	}

	function onPointerUp(event: PointerEvent): void {
		endGesture(event, false);
	}

	function onPointerCancel(event: PointerEvent): void {
		endGesture(event, true);
	}

	function shouldSuppressClick(): boolean {
		return now() < suppressClickUntil;
	}

	function onClickCapture(event: MouseEvent): void {
		// A tap on a resting panel's entry is a tap, however soon after the
		// drag that opened it; the synthesized click lands on the row's content.
		if (
			!shouldSuppressClick() ||
			(event.target instanceof Element && event.target.closest('[data-swipe-panel]') != null)
		) {
			return;
		}
		suppressClickUntil = 0;
		event.preventDefault();
		event.stopPropagation();
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && state.phase === 'resting') {
			event.stopPropagation();
			close();
		}
	}

	return {
		get state() {
			return state;
		},
		handlers: {
			onclickcapture: onClickCapture,
			onkeydown: onKeyDown,
			onpointercancel: onPointerCancel,
			onpointerdown: onPointerDown,
			onpointermove: onPointerMove,
			onpointerup: onPointerUp
		},
		activateEntry,
		close,
		shouldSuppressClick
	};
}
