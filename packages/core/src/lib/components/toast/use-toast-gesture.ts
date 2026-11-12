import { createAttachmentKey } from 'svelte/attachments';
import { PanGestureRecognizer } from '../../gestures/pan-gesture-recognizer.js';
import { useGestureRecognizer } from '../../gestures/use-gesture-recognizer.svelte.js';

/**
 * Ported from Astryx's `Toast/useToastGesture.ts`.
 *
 * Touch/pen swipe dismissal for one toast card. A drag along the block axis
 * *towards the viewport edge the toast entered from* follows the finger, fades
 * and shrinks the card, and on release either dismisses it (past the distance
 * threshold, or a short fast flick) or springs it back. A drag the other way, or
 * one that reads as horizontal, hands the gesture straight back to the page.
 *
 * The whole visual half is CSS custom properties this file sets on the card
 * (`--_toast-swipe-y`, `--_toast-swipe-opacity`, `--_toast-swipe-scale`,
 * `--_toast-swipe-exit-y`); `toast.stylex.ts` reads them through upstream's own
 * fallbacks, so the styles are inert until a gesture starts.
 *
 * ## Touch and pen are two inputs, drawn by two paths
 *
 * A pen is followed directly: the card's `pointer*` handlers begin, move and end
 * it. A finger's *claim* is the shared `PanGestureRecognizer`, attached to the
 * card by `useGestureRecognizer`, which decides once — from the first move —
 * whether the page keeps the touch or the toast does. The drawing still comes
 * from the touch events themselves, so a page-owned first move (or Chromium's
 * pointer-before-touch order) ends the swipe instead of drawing under a scroll.
 * The pan's hysteresis is infinite because it never draws; it only claims.
 *
 * Every point carries the input event's `timeStamp`, which is when the finger
 * was there. Browsers can run a move's handler a frame or two later, and a
 * flick has to be measured from the input, not from when the callback ran.
 *
 * Pen handlers ride `on*` props. The finger's drawing listeners are attached to
 * the card (non-passive, so a first move toward the edge can hold the touch),
 * because Svelte's spread `ontouch*` props land on the mount root where the
 * browser makes `touchmove` passive. Where the page routes fingers through
 * pointer events, the host sees no TouchEvents at all; the card's listener then
 * makes the pan's own one-way first-move decision so a page-owned touch never
 * starts drawing later.
 */

const DRAG_PROMOTION_SLOP = 8;
const SWIPE_DISMISS_RATIO = 0.4;
/** The dismiss distance of a card too short for its height ratio to reach it. */
const SWIPE_DISMISS_MIN_DISTANCE = 48;
/** Average speed, px/ms, at which a release dismisses whatever its travel. */
const FLICK_VELOCITY = 1.2;
const VERTICAL_INTENT_RATIO = 1.2;
const SWIPE_EXIT_DISTANCE = '120%';
const SWIPE_ACTIVE_FADE_MAX = 0.4;
const SWIPE_ACTIVE_SCALE_MAX = 0.02;

/** Which way a toast leaves: `1` towards the block end, `-1` towards the start. */
export type ToastGestureDirection = 1 | -1;

interface GesturePoint {
	source: 'touch' | 'pen';
	pointerId: number;
	clientX: number;
	clientY: number;
	/** The input event's `timeStamp`, which is when the finger was there. */
	time: number;
}

interface GestureState {
	source: GesturePoint['source'];
	pointerId: number;
	startX: number;
	startY: number;
	startTime: number;
	direction: ToastGestureDirection;
	intent: 'pending' | 'vertical' | 'opposite';
	/** The touch path's one-way first move, which decides who keeps the touch. */
	firstMoveDecided: boolean;
	pausedTimer: boolean;
	surfaceSize: number;
	dismissThreshold: number;
}

interface UseToastGestureOptions {
	direction: ToastGestureDirection;
	enabled: boolean;
	canPauseTimer: boolean;
	isTimerPaused: () => boolean;
	pauseTimer: () => void;
	resumeTimer: () => void;
	dismiss: () => void;
	shouldIgnoreTarget: (target: EventTarget | null, root: HTMLElement) => boolean;
}

/**
 * Spread on the toast card: upstream's `bindings`. The card element itself comes
 * from the caller's `bind:this`, so the recognizer and these handlers share one
 * root without an attachment.
 */
interface ToastGestureBindings {
	onpointerdown: (event: PointerEvent) => void;
	onpointermove: (event: PointerEvent) => void;
	onpointerup: (event: PointerEvent) => void;
	onpointercancel: (event: PointerEvent) => void;
	onlostpointercapture: (event: PointerEvent) => void;
	[key: symbol]: unknown;
}

function swipeProgressValue(travel: number, surfaceSize: number): number {
	return Math.min(Math.max(travel / surfaceSize, 0), 1);
}

function clearTransientStyles(root: HTMLElement): void {
	root.style.removeProperty('transition-duration');
	root.style.removeProperty('--_toast-swipe-y');
	root.style.removeProperty('--_toast-swipe-exit-y');
	root.style.removeProperty('--_toast-swipe-opacity');
	root.style.removeProperty('--_toast-swipe-scale');
}

export function useToastGesture(
	options: () => UseToastGestureOptions,
	getRoot: () => HTMLElement | null
): ToastGestureBindings {
	// Upstream's gestureRef and its refs: plain `let` for the same reason, since
	// nothing renders from either.
	let gesture: GestureState | null = null;

	// The pan claims a finger for the toast or leaves it to the page. It never
	// draws: its hysteresis is infinite, so it stays possible until it fails.
	const claim = useGestureRecognizer(
		() => getRoot(),
		() =>
			new PanGestureRecognizer({
				name: 'toast-swipe',
				direction: options().direction === 1 ? 'down' : 'up',
				firstMoveDecides: true,
				maximumNumberOfTouches: 1,
				hysteresis: Number.POSITIVE_INFINITY,
				cancelsTouchesInView: false,
				shouldReceiveTouch: (_recognizer, touch) => {
					const root = getRoot();
					return (
						touch.pointerType === 'touch' &&
						root != null &&
						!options().shouldIgnoreTarget(touch.target as EventTarget, root)
					);
				}
			}),
		undefined,
		{ isEnabled: () => options().enabled, manageStyle: false }
	);

	function resetGesture(shouldResume: boolean): void {
		const state = gesture;
		gesture = null;
		const root = getRoot();
		if (root) {
			clearTransientStyles(root);
		}
		if (shouldResume && state?.pausedTimer) {
			options().resumeTimer();
		}
	}

	function beginGesture(point: GesturePoint, target: EventTarget | null): boolean {
		const root = getRoot();
		const { direction, enabled, canPauseTimer, isTimerPaused, pauseTimer, shouldIgnoreTarget } =
			options();
		if (!root || !enabled || gesture != null || shouldIgnoreTarget(target, root)) {
			return false;
		}
		const pausedTimer = canPauseTimer && !isTimerPaused();
		if (pausedTimer) {
			pauseTimer();
		}
		const surfaceSize = Math.max(root.getBoundingClientRect().height, 1);
		gesture = {
			source: point.source,
			pointerId: point.pointerId,
			startX: point.clientX,
			startY: point.clientY,
			startTime: point.time,
			direction,
			intent: 'pending',
			firstMoveDecided: false,
			pausedTimer,
			surfaceSize,
			dismissThreshold: Math.max(surfaceSize * SWIPE_DISMISS_RATIO, SWIPE_DISMISS_MIN_DISTANCE)
		};
		return true;
	}

	function moveGesture(
		point: GesturePoint,
		preventDefault?: () => void,
		releaseCapture?: () => void
	): void {
		const state = gesture;
		const root = getRoot();
		if (!state || !root || point.source !== state.source || point.pointerId !== state.pointerId) {
			return;
		}
		const deltaX = point.clientX - state.startX;
		const deltaY = point.clientY - state.startY;
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);
		if (state.intent === 'pending') {
			if (absX > DRAG_PROMOTION_SLOP && absX > absY) {
				releaseCapture?.();
				resetGesture(true);
				return;
			}
			if (absY <= DRAG_PROMOTION_SLOP || absY <= absX * VERTICAL_INTENT_RATIO) {
				return;
			}
			state.intent = deltaY * state.direction > 0 ? 'vertical' : 'opposite';
			if (state.intent === 'opposite') {
				releaseCapture?.();
				resetGesture(true);
				return;
			}
			root.style.setProperty('transition-duration', '0s');
		}
		preventDefault?.();
		const travel = Math.max(0, deltaY * state.direction);
		const progress = swipeProgressValue(travel, state.surfaceSize);
		root.style.setProperty('--_toast-swipe-y', `${travel * state.direction}px`);
		root.style.setProperty(
			'--_toast-swipe-opacity',
			(1 - progress * SWIPE_ACTIVE_FADE_MAX).toFixed(3)
		);
		root.style.setProperty(
			'--_toast-swipe-scale',
			(1 - progress * SWIPE_ACTIVE_SCALE_MAX).toFixed(3)
		);
	}

	function endGesture(point: GesturePoint): void {
		const state = gesture;
		const root = getRoot();
		if (!state || !root || point.source !== state.source || point.pointerId !== state.pointerId) {
			return;
		}
		const travel = Math.max(0, (point.clientY - state.startY) * state.direction);
		const elapsed = Math.max(1, point.time - state.startTime);
		// A flick needs no travel floor. Intent turns vertical only past the
		// slop toward the edge.
		const isDismissed =
			state.intent === 'vertical' &&
			(travel >= state.dismissThreshold || travel / elapsed > FLICK_VELOCITY);

		gesture = null;
		root.style.removeProperty('transition-duration');
		if (isDismissed) {
			// The exit animation owns the final translation. Clear the live-drag
			// transform/fade/scale first so a standalone Toast does not remain
			// partially translated or faded after its dismiss callback fires.
			clearTransientStyles(root);
			root.style.setProperty(
				'--_toast-swipe-exit-y',
				state.direction === 1 ? SWIPE_EXIT_DISTANCE : `calc(-1 * ${SWIPE_EXIT_DISTANCE})`
			);
			options().dismiss();
			return;
		}
		clearTransientStyles(root);
		if (state.pausedTimer) {
			options().resumeTimer();
		}
	}

	function handlePointerDown(event: PointerEvent): void {
		// `button` is always a number on a native `PointerEvent`; upstream's
		// `== null` branch tolerates an event that omits it, and widening the local
		// is what keeps that branch expressible under `strict`.
		const button: number | undefined = event.button;
		if (
			event.pointerType === 'pen' &&
			(button == null || button === 0) &&
			beginGesture(
				{
					source: 'pen',
					pointerId: event.pointerId,
					clientX: event.clientX,
					clientY: event.clientY,
					time: event.timeStamp
				},
				event.target
			)
		) {
			getRoot()?.setPointerCapture?.(event.pointerId);
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (event.pointerType !== 'pen') {
			return;
		}
		moveGesture(
			{
				source: 'pen',
				pointerId: event.pointerId,
				clientX: event.clientX,
				clientY: event.clientY,
				time: event.timeStamp
			},
			() => event.preventDefault(),
			() => getRoot()?.releasePointerCapture?.(event.pointerId)
		);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (event.pointerType !== 'pen') {
			return;
		}
		getRoot()?.releasePointerCapture?.(event.pointerId);
		endGesture({
			source: 'pen',
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			time: event.timeStamp
		});
	}

	function handlePointerCancel(event: PointerEvent): void {
		// The root can be null on the `lostpointercapture` path: per the Pointer
		// Events spec, removing a capturing element from the document releases
		// capture and fires `lostpointercapture` **at that element**, where a
		// spread handler remains attached after Svelte has detached it. Without
		// the guard, a toast unmounted mid-pen-drag reads `options()` off a
		// destroyed component and resumes a timer whose teardown has already run.
		if (
			getRoot() != null &&
			event.pointerType === 'pen' &&
			gesture?.source === 'pen' &&
			gesture.pointerId === event.pointerId
		) {
			resetGesture(true);
		}
	}

	const touchPoint = (touch: Touch, event: TouchEvent): GesturePoint => ({
		source: 'touch',
		pointerId: touch.identifier,
		clientX: touch.clientX,
		clientY: touch.clientY,
		time: event.timeStamp
	});

	function changedTouch(event: TouchEvent): Touch | undefined {
		const state = gesture;
		const pointerId = state?.source === 'touch' ? state.pointerId : null;
		return pointerId == null
			? undefined
			: [...event.changedTouches].find((touch) => touch.identifier === pointerId);
	}

	function handleTouchStart(event: TouchEvent): void {
		if (!options().enabled) {
			return;
		}
		if (event.touches.length !== 1) {
			// A second contact means the browser may be handling pinch zoom or
			// two-finger scrolling. Abandon any accepted one-finger swipe before
			// touchmove can suppress that native gesture.
			resetGesture(true);
			return;
		}
		const touch = event.changedTouches[0];
		if (touch != null) {
			beginGesture(touchPoint(touch, event), event.target);
		}
	}

	function handleTouchMove(event: TouchEvent): void {
		if (!options().enabled) {
			return;
		}
		if (event.touches.length !== 1) {
			resetGesture(true);
			return;
		}
		// The gesture host's pan decides the touch from its first move. Once the
		// pan fails, the page has the touch, so the swipe ends too.
		if (gesture != null && claim.state === 'failed') {
			resetGesture(true);
			return;
		}
		const touch = changedTouch(event);
		if (!touch) {
			return;
		}
		const point = touchPoint(touch, event);
		// Where the page's input mode routes fingers through pointer events, the
		// host hears no touch at all. The same one-way decision is made here, on
		// the first move, so a page-owned touch never starts drawing later.
		const state = gesture;
		if (state != null && state.source === 'touch' && !state.firstMoveDecided) {
			const deltaX = point.clientX - state.startX;
			const deltaY = point.clientY - state.startY;
			if (deltaX !== 0 || deltaY !== 0) {
				state.firstMoveDecided = true;
				const along = deltaY * state.direction;
				const vertical = Math.abs(deltaY) > VERTICAL_INTENT_RATIO * Math.abs(deltaX);
				if (!vertical || along <= 0) {
					resetGesture(true);
					return;
				}
				// A first move toward the dismiss edge holds the finger, as the pan
				// does before it begins: the browser must not also scroll it.
				if (event.cancelable) {
					event.preventDefault();
				}
			}
		}
		moveGesture(point, () => {
			if (event.cancelable) {
				event.preventDefault();
			}
		});
	}

	function handleTouchEnd(event: TouchEvent): void {
		if (!options().enabled) {
			return;
		}
		if (event.touches.length > 0) {
			resetGesture(true);
			return;
		}
		const touch = changedTouch(event);
		if (touch) {
			endGesture(touchPoint(touch, event));
		} else {
			resetGesture(true);
		}
	}

	function handleTouchCancel(): void {
		if (options().enabled) {
			resetGesture(true);
		}
	}

	/**
	 * Upstream's React `onTouch*` handlers, which the gesture host cannot supply
	 * here: the drawing lives on the card's own non-passive listeners so a first
	 * move toward the edge can hold the touch (`preventDefault` is a no-op on the
	 * passive listener Svelte would attach at its mount root).
	 */
	const attachTouchGesture = (node: HTMLElement): (() => void) => {
		node.addEventListener('touchstart', handleTouchStart, { passive: true });
		node.addEventListener('touchmove', handleTouchMove, { passive: false });
		node.addEventListener('touchend', handleTouchEnd, { passive: true });
		node.addEventListener('touchcancel', handleTouchCancel, { passive: true });
		return () => {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchCancel);
		};
	};

	return {
		onpointerdown: handlePointerDown,
		onpointermove: handlePointerMove,
		onpointerup: handlePointerUp,
		onpointercancel: handlePointerCancel,
		onlostpointercapture: handlePointerCancel,
		[createAttachmentKey()]: attachTouchGesture
	};
}
