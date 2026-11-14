import type { GestureRecognizer } from '../../gestures/gesture-recognizer.js';
import { LongPressGestureRecognizer } from '../../gestures/long-press-gesture-recognizer.js';
import { PanGestureRecognizer } from '../../gestures/pan-gesture-recognizer.js';
import { PinchGestureRecognizer } from '../../gestures/pinch-gesture-recognizer.js';
import { TapGestureRecognizer } from '../../gestures/tap-gesture-recognizer.js';
import type { Point } from '../../gestures/types.js';
import { useGestureRecognizer } from '../../gestures/use-gesture-recognizer.svelte.js';
import { UIKIT_PAN } from '../../motion/uikit/gestures.js';
import { coast as coastCurves } from '../../motion/coast.js';
import { decayRestDistance } from '../../motion/decay.js';
import { resolveMotion } from '../../motion/resolve-motion.js';
import { springs } from '../../motion/uikit/springs.js';
import { zoomMedia } from '../../motion/uikit/zoomMedia.js';
import {
	IDENTITY,
	dismissCommits,
	dismissExitY,
	dismissTransform,
	doubleTapTarget,
	draggedTransform,
	isZoomed,
	overshootScale,
	pinchScaleFor,
	rawForDragged,
	releaseTarget,
	restRange,
	transformKeepingPoint,
	type StagePoint,
	type ZoomGeometry,
	type ZoomTransform
} from './zoom-stage.js';
import { ZOOM_DRAGGING_ATTRIBUTE, type ZoomCore, type ZoomStage } from './use-zoom-core.svelte.js';

export { ZOOM_DRAGGING_ATTRIBUTE, type ZoomStage };

/**
 * Set on the stage while a drag to dismiss moves the photo, until it settles.
 * A stage that only hugs the photo then lets the moved photo draw outside it.
 */
export const ZOOM_DISMISSING_ATTRIBUTE = 'data-zoom-dismissing';

export interface UseZoomStageOptions {
	/** The stage: the box the photo is fitted and centred in, clipping it. */
	stageRef: () => HTMLElement | null;
	/** Where the recognizers attach: the stage by default, a pager's track. */
	surfaceRef?: () => HTMLElement | null;
	/** The gestures are on (zoom is on), for every pointer. */
	isEnabled: boolean;
	/** Changes when another item shows: a drag to dismiss in progress ends. */
	itemKey: unknown;
	/**
	 * A finger's single tap landed off the photo, at this client point. It
	 * landed on the stage, or on the surface around it, such as a gallery
	 * page's empty strip.
	 */
	onTapOutside?: (location: Point) => void;
	/** A pan began (a release over the backdrop must not close). */
	onDragStart?: () => void;
	/**
	 * The touch presentation is on. A pan's give past the edges and its coast
	 * belong to it. Otherwise a drag or a trackpad's scroll pans 1:1, and it
	 * stops at the edges and at the release.
	 */
	isTouchPresentation?: boolean;
	/**
	 * Whether a pinch, or a two-finger pan, may begin, from the recognizer's
	 * tracked touches. False leaves the fingers to the page's zoom.
	 */
	shouldBeginPinch?: (recognizer: GestureRecognizer) => boolean;
	/**
	 * An outer pager takes a one-finger drag that heads past the zoomed photo's
	 * edge. Without one, the pan begins there and gives past the edge.
	 */
	hasOuterPager?: boolean;
	/** Drag to dismiss, as Photos has it; none without. */
	dismiss?: ZoomStageDismiss;
}

/**
 * Photos' drag to dismiss. A one-finger drag that starts downward on a photo
 * at its fitted size carries it. Its centre follows the finger, and it
 * shrinks with the travel. The release dismisses or springs back. The owner
 * fades its backdrop and controls by the travel and closes once the photo
 * has left.
 */
export interface ZoomStageDismiss {
	/** Whether a drag can dismiss now (an image, in the touch presentation). */
	isEnabled: boolean;
	/** Each move of the drag: its downward travel, pt. */
	onDrag: (travel: number) => void;
	/**
	 * The release: whether it dismisses, so the photo leaves, or springs back,
	 * and whether a finger released it. Under reduced motion a finger's
	 * release cross-fades. A mouse's, a trackpad's or a pen's cross-fades on a
	 * coarse primary pointer.
	 */
	onRelease: (dismisses: boolean, touch: boolean) => void;
	/** The dismissed photo has left the stage. */
	onDismissed: () => void;
}

/** The touch layer's additions to the core's API. */
export interface ZoomStageWithTouch extends ZoomStage {
	/** A dismissed photo back at its fitted size at once (the viewer opens again). */
	reset(): void;
}

interface PinchSession {
	readonly start: ZoomTransform;
	/** The pinch's own scale the start corresponds to (past a limit, more). */
	readonly startPinchScale: number;
	readonly anchor: StagePoint;
	centroid: StagePoint;
}

interface PanSession {
	/** The pointer-travel transform when the session started. */
	readonly raw: ZoomTransform;
	readonly translation: Point;
	/** It gives past the edges and coasts at the release. */
	readonly hasGive: boolean;
}

const EVERY_POINTER = ['touch', 'pen', 'mouse'] as const;
/** Fingers only: a pen does not pinch. A ctrl-wheel pinches too. */
const PINCH_POINTERS = ['touch'] as const;
/** Fingers only: a mouse's or a pen's double-click is the browser's. */
const DOUBLE_TAP_POINTERS = ['touch'] as const;
/** A mouse's or a pen's click beside the photo is the browser's `click`. */
const TAP_POINTERS = ['touch'] as const;

/**
 * Ported from Astryx's `Lightbox/useZoomStage.ts`.
 *
 * Lightbox's gestures: a zooming UIScrollView's, for every pointer, on top of
 * the core. The React hook reads its live options through refs; here the
 * options arrive as a getter, and the recognizers are created once at init and
 * read the current options at event time. Everything else — the recognizer
 * graph, the sessions and the springs — is upstream's.
 */
export function useZoomStage(
	core: ZoomCore,
	options: () => UseZoomStageOptions
): ZoomStageWithTouch {
	const {
		animator,
		geometryRef,
		targetRef,
		measure,
		toStage,
		current,
		write,
		setTarget,
		setZoomed,
		settleTo,
		isMoving,
		isAtEdgeOf
	} = core;
	let pinchSession: PinchSession | null = null;
	let panSession: PanSession | null = null;
	/** A drag to dismiss in progress: the geometry it started from. */
	let dismissGeometry: ZoomGeometry | null = null;
	/** A dismissed photo is leaving: nothing catches it. */
	let leaving = false;
	/** A touch stopped a moving photo; a pan or pinch has since taken over. */
	let caught = false;
	let draggedSinceCatch = false;
	const hasGive = () => options().isTouchPresentation === true;
	const latest = () => options();

	/**
	 * A zoomed pan's release: UIScrollView's coast, bouncing at the edges.
	 */
	function coast(geometry: ZoomGeometry, velocity: Point): void {
		const from = current();
		// Under Reduce Motion too, a coast keeps its momentum and its settle at
		// an edge. That is the person's own movement, and iOS keeps decelerating
		// scrolls under Reduce Motion. The animator's policy leaves `decay` alone.
		const range = restRange(geometry, from.scale);
		const vx = range.x.min === range.x.max ? 0 : velocity.x;
		const vy = range.y.min === range.y.max ? 0 : velocity.y;
		const rest = (value: number, v: number, { min, max }: typeof range.x) =>
			Math.min(max, Math.max(min, value + decayRestDistance(v)));
		setTarget({
			x: rest(from.x, vx, range.x),
			y: rest(from.y, vy, range.y),
			scale: from.scale
		});
		setZoomed(isZoomed(geometry, from));
		animator.decay(coastCurves(animator, { x: vx, y: vy }, { bounds: { x: range.x, y: range.y } }));
	}

	// The pan begins with two fingers down when a pinch may, or on a zoomed
	// photo. Where an outer pager takes the drag, it begins only short of the
	// photo's edge on the side the drag heads to. UIScrollView's pan in a
	// paging scroll view does the same, and the pager takes the rest.
	function pinchShouldBegin(recognizer: GestureRecognizer): boolean {
		return latest().shouldBeginPinch?.(recognizer) ?? true;
	}

	function panShouldBegin(pan: PanGestureRecognizer): boolean {
		if (pan.numberOfTouches > 1) {
			return pinchShouldBegin(pan);
		}
		const geometry = measure();
		if (geometry == null || !isZoomed(geometry, current())) {
			return false;
		}
		const { x, y } = pan.totalTranslation();
		return !(
			latest().hasOuterPager === true &&
			Math.abs(x) >= Math.abs(y) &&
			isAtEdgeOf(geometry, x < 0 ? 'left' : 'right')
		);
	}

	function isMovingNow(): boolean {
		return !leaving && isMoving();
	}

	function dismissShouldBegin(pan: PanGestureRecognizer): boolean {
		const latestOptions = latest();
		if (latestOptions.dismiss?.isEnabled !== true || leaving) {
			return false;
		}
		// Where the photo is going: one zooming in is not dismissed.
		const geometry = measure();
		if (geometry == null || isZoomed(geometry, targetRef.current)) {
			return false;
		}
		const { x, y } = pan.totalTranslation();
		return y > 0 && y >= Math.abs(x);
	}

	// Whether a finger began each gesture, read from its first touch as it
	// begins. Under reduced motion a finger's release cross-fades. A mouse's, a
	// trackpad's or a pen's release completes at once where the primary pointer
	// is fine.
	const finger = { pinch: false, catch: false, dismiss: false };

	const pinch = new PinchGestureRecognizer({
		name: 'Lightbox.zoomPinch',
		allowedPointerTypes: PINCH_POINTERS,
		shouldBegin: (recognizer) => pinchShouldBegin(recognizer)
	});
	// A zoomed photo is a scroll view: its coast reads the pan's scroll-view
	// release (`scrollVelocity()`), so it coasts as far as UIKit's.
	const pan = new PanGestureRecognizer({
		name: 'Lightbox.zoomPan',
		maximumNumberOfTouches: 2,
		allowedPointerTypes: EVERY_POINTER,
		allowedScrollTypes: ['continuous'],
		shouldBegin: (recognizer) => panShouldBegin(recognizer),
		// A mouse's or a pen's drag on a zoomed photo pans from its first move.
		// A finger keeps UIKit's begin threshold, which tells a tap from a pan.
		hysteresis: (touch) =>
			touch.pointerType !== 'touch' &&
			geometryRef.current != null &&
			isZoomed(geometryRef.current, current())
				? 0
				: UIKIT_PAN.hysteresis.value
	});
	// A finger's double tap. A mouse's or a pen's double-click is the
	// browser's `dblclick`, which keeps the system's double-click speed.
	const doubleTap = new TapGestureRecognizer({
		name: 'lightbox-zoom-double-tap',
		numberOfTapsRequired: 2,
		allowedPointerTypes: DOUBLE_TAP_POINTERS
	});
	const tap = new TapGestureRecognizer({
		name: 'lightbox-zoom-tap',
		allowedPointerTypes: TAP_POINTERS
	});
	const touchDown = new LongPressGestureRecognizer({
		name: 'lightbox-zoom-touch-down',
		minimumPressDuration: 0,
		allowableMovement: Number.POSITIVE_INFINITY,
		cancelsTouchesInView: false,
		delaysTouchesEnded: false,
		allowedPointerTypes: EVERY_POINTER,
		// Only a moving photo is caught, so a still one leaves the touch to
		// everyone else (an outer pager's own catch).
		shouldBegin: () => isMovingNow()
	});
	const dismissPan = new PanGestureRecognizer({
		name: 'Lightbox.dismissPan',
		maximumNumberOfTouches: 1,
		allowedPointerTypes: EVERY_POINTER,
		allowedScrollTypes: ['continuous'],
		shouldBegin: (recognizer) => dismissShouldBegin(recognizer)
	});
	pinch.recognizeSimultaneouslyWith(pan);
	tap.requireToFail(doubleTap);
	for (const other of [pinch, pan, doubleTap, tap, dismissPan]) {
		touchDown.recognizeSimultaneouslyWith(other);
	}

	const recognizerOptions = () => ({
		isEnabled: () => latest().isEnabled,
		manageStyle: false
	});
	const surface = () => (latest().surfaceRef ?? latest().stageRef)();

	useGestureRecognizer(
		surface,
		() => pinch,
		(event) => {
			if (event.state === 'began') {
				finger.pinch = event.trackedTouches[0]?.pointerType === 'touch';
				const geometry = measure();
				if (geometry == null) {
					return;
				}
				draggedSinceCatch = true;
				animator.stop();
				const start = current();
				const anchor = toStage(event.focalPoint());
				pinchSession = {
					start,
					startPinchScale: pinchScaleFor(geometry, start.scale),
					anchor,
					centroid: anchor
				};
			}
			const session = pinchSession;
			const geometry = geometryRef.current;
			const isMovingNow = event.state === 'began' || event.state === 'changed';
			if (!isMovingNow) {
				// The session ends with the pinch, even one that outlived its photo:
				// a session left behind would block every later pan.
				pinchSession = null;
			}
			if (session == null || geometry == null) {
				return;
			}
			if (isMovingNow) {
				session.centroid = toStage(event.focalPoint());
				const shown = overshootScale(geometry, session.startPinchScale * event.scale);
				write(
					transformKeepingPoint(geometry, session.start, session.anchor, session.centroid, shown)
				);
				return;
			}
			// Ended (a finger lifted) or cancelled (the browser took the touches).
			const shown = current();
			const target = releaseTarget(geometry, shown, session.centroid);
			if (target !== shown) {
				// Past a limit: the return springs from the photo's scale velocity
				// at the lift, anchored at the last centroid. A finger still down
				// rests until it lands again.
				panSession = null;
				// The photo's scale per second at the lift: the pinch's, through the
				// give past the limit. A cancelled pinch starts the return at rest.
				const raw = session.startPinchScale * event.scale;
				const step = raw * 1e-4;
				const give =
					(overshootScale(geometry, raw + step) - overshootScale(geometry, raw - step)) /
					(2 * step);
				settleTo(geometry, target, {
					touchRelease: finger.pinch,
					scaleVelocity:
						event.state === 'ended' ? give * session.startPinchScale * event.velocity : 0
				});
				return;
			}
			if (pan.state === 'began' || pan.state === 'changed') {
				// The finger left down keeps panning from here, without a jump.
				const give = hasGive();
				panSession = {
					raw: rawForDragged(geometry, shown),
					translation: give ? pan.translation() : pan.totalTranslation(),
					hasGive: give
				};
				setZoomed(isZoomed(geometry, shown));
				return;
			}
			coast(geometry, { x: 0, y: 0 });
		},
		recognizerOptions()
	);

	useGestureRecognizer(
		surface,
		() => pan,
		(event) => {
			const stage = latest().stageRef();
			if (event.state === 'began') {
				const geometry = measure();
				if (geometry == null) {
					return;
				}
				draggedSinceCatch = true;
				animator.stop();
				latest().onDragStart?.();
				const shown = current();
				if (isZoomed(geometry, shown)) {
					stage?.setAttribute(ZOOM_DRAGGING_ATTRIBUTE, '');
				}
				// The translation already leaves out the begin threshold's travel,
				// and what the finger moved past it shows at once, as in UIKit.
				// Without give, the photo follows the pointer's whole travel from the
				// press, so it catches up the threshold's travel at once.
				panSession = {
					raw: rawForDragged(geometry, shown),
					translation: { x: 0, y: 0 },
					hasGive: hasGive()
				};
			}
			if (event.state === 'began' || event.state === 'changed') {
				const session = panSession;
				const geometry = geometryRef.current;
				if (pinchSession != null || session == null || geometry == null) {
					return;
				}
				const translation = session.hasGive ? event.translation() : event.totalTranslation();
				const raw = {
					x: session.raw.x + translation.x - session.translation.x,
					y: session.raw.y + translation.y - session.translation.y,
					scale: session.raw.scale
				};
				if (session.hasGive) {
					write(draggedTransform(geometry, raw));
					return;
				}
				const range = restRange(geometry, raw.scale);
				write({
					x: Math.min(range.x.max, Math.max(range.x.min, raw.x)),
					y: Math.min(range.y.max, Math.max(range.y.min, raw.y)),
					scale: raw.scale
				});
				return;
			}
			stage?.removeAttribute(ZOOM_DRAGGING_ATTRIBUTE);
			const session = panSession;
			panSession = null;
			const geometry = geometryRef.current;
			if (pinchSession != null || session == null || geometry == null) {
				return;
			}
			// The release carries the shared filter's velocity at the lift: a scroll
			// view's, at rest after a silent hold.
			coast(
				geometry,
				event.state === 'ended' && session.hasGive ? event.scrollVelocity() : { x: 0, y: 0 }
			);
		},
		recognizerOptions()
	);

	useGestureRecognizer(
		surface,
		() => touchDown,
		(event) => {
			if (event.state === 'began') {
				finger.catch = event.trackedTouches[0]?.pointerType === 'touch';
				// It only begins on a moving photo: stopped where it shows, at the
				// presentation value from the curve.
				draggedSinceCatch = false;
				caught = true;
				const shown = current();
				animator.stop();
				setTarget(shown);
				return;
			}
			if (event.state === 'changed') {
				return;
			}
			// Lifted, or taken. With no drag since the catch, the photo settles from
			// where it was stopped. It goes back inside the stage, or back to a zoom
			// limit it passed.
			const wasCaught = caught;
			caught = false;
			const geometry = geometryRef.current ?? measure();
			if (!wasCaught || draggedSinceCatch || geometry == null) {
				return;
			}
			const shown = current();
			const limit = releaseTarget(geometry, shown, {
				x: geometry.width / 2,
				y: geometry.height / 2
			});
			if (limit !== shown) {
				settleTo(geometry, limit, { touchRelease: finger.catch });
				return;
			}
			coast(geometry, { x: 0, y: 0 });
		},
		recognizerOptions()
	);

	useGestureRecognizer(
		surface,
		() => doubleTap,
		(event) => {
			if (event.state !== 'ended') {
				return;
			}
			const geometry = measure();
			if (geometry == null) {
				return;
			}
			// A finger's double tap fills the viewer, at least 2×, and keeps the
			// tapped point in place. It plays the same spring as every zoom, from
			// rest.
			const point = toStage(event.location());
			settleTo(geometry, doubleTapTarget(geometry, current(), point));
		},
		recognizerOptions()
	);

	useGestureRecognizer(
		surface,
		() => tap,
		(event) => {
			if (event.state !== 'ended') {
				return;
			}
			const geometry = measure();
			if (geometry == null) {
				return;
			}
			const point = toStage(event.location());
			const { x, y, scale } = current();
			const left = geometry.fit.x + x;
			const top = geometry.fit.y + y;
			const onPhoto =
				point.x >= left &&
				point.x <= left + geometry.fit.width * scale &&
				point.y >= top &&
				point.y <= top + geometry.fit.height * scale;
			if (!onPhoto) {
				latest().onTapOutside?.(event.location());
			}
		},
		recognizerOptions()
	);

	useGestureRecognizer(
		surface,
		() => dismissPan,
		(event) => {
			if (event.state === 'began') {
				finger.dismiss = event.trackedTouches[0]?.pointerType === 'touch';
				const geometry = measure();
				if (geometry == null || latest().dismiss == null) {
					return;
				}
				animator.stop();
				latest().onDragStart?.();
				dismissGeometry = geometry;
				latest().stageRef()?.setAttribute(ZOOM_DISMISSING_ATTRIBUTE, '');
			}
			const geometry = dismissGeometry;
			if (geometry == null) {
				return;
			}
			const translation = event.translation();
			if (event.state === 'began' || event.state === 'changed') {
				write(dismissTransform(geometry, translation.x, translation.y));
				latest().dismiss?.onDrag(Math.max(0, translation.y));
				return;
			}
			// Ended or cancelled.
			dismissGeometry = null;
			// The release rule and the motion read the shared filter's velocity at
			// the lift, at rest after a silent hold.
			const velocity = event.velocity();
			const dismisses = event.state === 'ended' && dismissCommits(translation.y, velocity.y);
			latest().dismiss?.onRelease(dismisses, finger.dismiss);
			const shown = current();
			if (dismisses) {
				leaving = true;
				// No thumbnail to return to, so straight on down on the dismissal's
				// position spring, from the release velocity, until it leaves the
				// screen. A stage that only hugs the photo sits above its bottom. The
				// screen's bottom is in stage px, from the pan's first measure.
				const view = latest().stageRef()?.ownerDocument.defaultView;
				const y = dismissExitY(
					geometry,
					shown,
					view != null ? toStage({ x: 0, y: view.innerHeight }).y : geometry.height
				);
				setTarget({ ...shown, y });
				const handle = animator.animate(
					{ x: shown.x, y },
					{
						spring: resolveMotion(latest().stageRef(), zoomMedia.dismiss.dismissPositionSpring),
						velocity: { x: velocity.x, y: velocity.y }
					},
					{ crossfadeAs: 'exit', touchRelease: finger.dismiss }
				);
				void handle.finished.then(() => {
					if (leaving) {
						latest().dismiss?.onDismissed();
					}
				});
				return;
			}
			setTarget(IDENTITY);
			// A cancelled drag's return is not an exit, so it plays the shared
			// settle spring, read where the stage is, from the release velocity.
			const settle = resolveMotion(latest().stageRef(), springs.settle);
			const position = animator.animate(
				{ x: 0, y: 0 },
				{ spring: settle, velocity: { x: velocity.x, y: velocity.y } },
				{ touchRelease: finger.dismiss }
			);
			const size = animator.animate(
				{ scale: 1 },
				{ spring: settle },
				{ touchRelease: finger.dismiss }
			);
			// Back in its box: the stage clips again, unless another drag began.
			void Promise.all([position.finished, size.finished]).then(() => {
				if (dismissGeometry == null && !leaving) {
					latest().stageRef()?.removeAttribute(ZOOM_DISMISSING_ATTRIBUTE);
				}
			});
		},
		{
			isEnabled: () => latest().dismiss?.isEnabled === true,
			manageStyle: false
		}
	);

	// Another item: a drag to dismiss in progress ends, and the stage clips its
	// photo again. The core puts the photo back at the fitted size.
	$effect(() => {
		void latest().itemKey;
		const stage = latest().stageRef();
		dismissGeometry = null;
		leaving = false;
		stage?.removeAttribute(ZOOM_DISMISSING_ATTRIBUTE);
	});

	const api = core.api;
	return {
		...api,
		reset: () => {
			if (!leaving) {
				return;
			}
			leaving = false;
			dismissGeometry = null;
			animator.stop();
			animator.set({ x: 0, y: 0, scale: 1, opacity: 1 });
			setTarget(IDENTITY);
			latest().stageRef()?.removeAttribute(ZOOM_DISMISSING_ATTRIBUTE);
		}
	};
}
