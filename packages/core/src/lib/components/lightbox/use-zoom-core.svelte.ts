import type { Attachment } from 'svelte/attachments';
import { createMotionEngine, type Animator } from '../../motion/animator.js';
import { resolveMotion } from '../../motion/resolve-motion.js';
import { springs } from '../../motion/uikit/springs.js';
import { registerReducedMotionCrossFade } from '../../motion/uikit/timing.js';
import { observeResize } from '../../internal/shared-resize-observer.js';
import {
	IDENTITY,
	doubleClickTarget,
	doubleTapScaleFor,
	isZoomed,
	maxScaleFor,
	pannedBy,
	releasedZoomTarget,
	restRange,
	restingTransform,
	transformForResize,
	type StagePoint,
	type ZoomGeometry,
	type ZoomTransform
} from './zoom-stage.js';

/**
 * Ported from Astryx's `Lightbox/useZoomCore.ts`.
 *
 * The React hook keeps its options in a ref and its elements in refs; here the
 * options arrive as a getter and the stage/surface as element getters, the
 * shape every hook in this port uses. The photo attaches through an
 * attachment, since a Svelte component cannot hand out a callback ref to a
 * node it does not render.
 *
 * Every zoom step runs on the compositor as baked keyframes, with no render
 * and no layout read after a step begins. A keyboard step continues from where
 * the photo is going, so presses during a settle add up. Svelte hears only
 * discrete changes (`onZoomedChange`).
 */

/** Set on the stage while a finger or the mouse drags a zoomed photo. */
export const ZOOM_DRAGGING_ATTRIBUTE = 'data-zoom-dragging';

/** A drag's initial direction on screen. */
export type PanDirection = 'left' | 'right';

export interface UseZoomCoreOptions {
	/** The stage: the box the photo is fitted and centred in, clipping it. */
	stageRef: () => HTMLElement | null;
	/**
	 * Where the gestures attach and what the resize observer watches: the
	 * stage by default. In a pager, the track (the pager's own pan sits on the
	 * stage, each element has one `touch-action`, and every page shares the
	 * track's size).
	 */
	surfaceRef?: () => HTMLElement | null;
	/** Zoom is on (an image item with `hasZoom`). */
	isEnabled: boolean;
	/** Changes when another item shows; the photo returns to the fitted size. */
	itemKey: unknown;
	/** The photo became zoomed or returned to the fitted size. */
	onZoomedChange: (zoomed: boolean) => void;
}

/** What Lightbox calls: the photo's attachment and the keyboard's zoom and pan. */
export interface ZoomStage {
	/** Attachment for the photo element the stage moves and scales. */
	readonly contentAttach: Attachment<HTMLElement>;
	/** Whether the photo is zoomed now. */
	isZoomed(): boolean;
	/** Keyboard: zoom in 2x about the stage's centre, or out when zoomed. */
	toggle(): void;
	zoomIn(): void;
	zoomOut(): void;
	/** Keyboard: move a zoomed photo by (dx, dy) px, kept inside the stage. */
	panBy(dx: number, dy: number): void;
	/**
	 * A mouse's or a pen's double-click at a client point: 2× about it, or
	 * back when zoomed. Lightbox calls it on the browser's `dblclick`, which
	 * keeps the system's double-click speed.
	 */
	doubleClickAt(clientX: number, clientY: number): void;
	/**
	 * Whether a zoomed photo can no longer move with a drag toward
	 * `direction`, since its edge on that side is at the stage's. A pager takes
	 * such a drag, as an outer paging scroll view does.
	 */
	isAtEdge(direction: PanDirection): boolean;
}

/** The core as the gestures (`useZoomStage`) drive it. */
export interface ZoomCore {
	/** The API Lightbox calls (one object for the component's lifetime). */
	readonly api: ZoomStage;
	readonly animator: Animator;
	/** The last measured geometry (null until a step measures it). */
	readonly geometryRef: { current: ZoomGeometry | null };
	/** Where the photo is going: the last written value or the settle's end. */
	readonly targetRef: { current: ZoomTransform };
	readonly zoomedRef: { current: boolean };
	readonly optionsRef: { current: UseZoomCoreOptions };
	/** Reads the stage and the photo (layout): when a step begins. */
	measure(): ZoomGeometry | null;
	/** Client px to stage px, from the last measure. */
	toStage(point: StagePoint): StagePoint;
	/** Where the photo shows now (its presentation value). */
	current(): ZoomTransform;
	/** Shows the photo at `transform` at once. */
	write(transform: ZoomTransform): void;
	/** Where the photo is going, when an animation the core did not start ends there. */
	setTarget(transform: ZoomTransform): void;
	setZoomed(next: boolean): void;
	/** Whether the photo is moving (shown away from where it is going). */
	isMoving(): boolean;
	/** Whether a zoomed photo's edge toward `direction` is at the stage's. */
	isAtEdgeOf(geometry: ZoomGeometry, direction: PanDirection): boolean;
	/**
	 * Settles on `springs.settle`: a release past a limit, a double tap, a
	 * double-click and the keyboard's zoom and pan. Lightbox's main interaction
	 * is a gesture, so every zoom settles on that one spring. A pinch's release
	 * starts it at `scaleVelocity`, the photo's scale per second at the lift;
	 * anything else starts at rest. Under Reduce Motion the animator's default
	 * applies. That is a fade in place on a touch screen or for a finger's
	 * release (`touchRelease`), and at once otherwise.
	 */
	settleTo(
		geometry: ZoomGeometry,
		target: ZoomTransform,
		options?: { touchRelease?: boolean; scaleVelocity?: number }
	): void;
}

export function useZoomCore(options: () => UseZoomCoreOptions): ZoomCore {
	// One animator for the component's lifetime; the photo's attachment
	// attaches it.
	const animator = createMotionEngine(null);
	const optionsRef: { current: UseZoomCoreOptions } = { current: options() };
	let contentElement: HTMLElement | null = null;
	const geometryRef: { current: ZoomGeometry | null } = { current: null };
	/** Client px of the stage's top-left corner when last measured. */
	let origin = { x: 0, y: 0 };
	const zoomedRef = { current: false };
	const targetRef: { current: ZoomTransform } = { current: IDENTITY };

	const contentAttach: Attachment<HTMLElement> = (element) => {
		contentElement = element;
		animator.attach(element);
		return () => {
			if (contentElement !== element) {
				return;
			}
			contentElement = null;
			animator.attach(null);
		};
	};

	// Layout reads happen here only: when a gesture or a keyboard zoom begins.
	// Sizes are read unrounded (offset sizes round to whole pixels, an error a
	// deep zoom would multiply): the stage's box and the photo's used size.
	// The stage centres the photo, so its fitted box follows from the two.
	function measure(): ZoomGeometry | null {
		const stage = optionsRef.current.stageRef();
		const content = contentElement;
		const view = stage?.ownerDocument.defaultView;
		if (stage == null || content == null || view == null) {
			return null;
		}
		const rect = stage.getBoundingClientRect();
		// The stage has no border or scrollbar: its box is its content box.
		const width = rect.width > 0 ? rect.width : stage.clientWidth;
		const height = rect.height > 0 ? rect.height : stage.clientHeight;
		const used = view.getComputedStyle(content);
		const fitWidth = parseFloat(used.width) || content.offsetWidth;
		const fitHeight = parseFloat(used.height) || content.offsetHeight;
		if (!(width > 0 && height > 0 && fitWidth > 0 && fitHeight > 0)) {
			return null;
		}
		origin = {
			x: rect.left + stage.clientLeft,
			y: rect.top + stage.clientTop
		};
		// By tag, not `instanceof`: a viewer rendered into another window has
		// that window's element classes.
		const naturalWidth = content.tagName === 'IMG' ? (content as HTMLImageElement).naturalWidth : 0;
		const natural = naturalWidth > 0 ? naturalWidth : fitWidth;
		const doubleTapScale = doubleTapScaleFor(width, height, fitWidth, fitHeight);
		const geometry: ZoomGeometry = {
			width,
			height,
			fit: {
				x: (width - fitWidth) / 2,
				y: (height - fitHeight) / 2,
				width: fitWidth,
				height: fitHeight
			},
			minScale: 1,
			maxScale: maxScaleFor(natural, fitWidth, view.devicePixelRatio || 1, doubleTapScale),
			doubleTapScale
		};
		geometryRef.current = geometry;
		return geometry;
	}

	function toStage(point: StagePoint): StagePoint {
		return { x: point.x - origin.x, y: point.y - origin.y };
	}

	function current(): ZoomTransform {
		return {
			x: animator.get('x'),
			y: animator.get('y'),
			scale: animator.get('scale')
		};
	}

	function write(transform: ZoomTransform): void {
		targetRef.current = transform;
		animator.set({ x: transform.x, y: transform.y, scale: transform.scale });
	}

	function setTarget(transform: ZoomTransform): void {
		targetRef.current = transform;
	}

	function isMoving(): boolean {
		const shown = current();
		const target = targetRef.current;
		return (
			Math.abs(shown.x - target.x) > 0.01 ||
			Math.abs(shown.y - target.y) > 0.01 ||
			Math.abs(shown.scale - target.scale) > 0.0001
		);
	}

	function isAtEdgeOf(geometry: ZoomGeometry, direction: PanDirection): boolean {
		const { x, scale } = targetRef.current;
		const range = restRange(geometry, scale);
		return direction === 'left' ? x <= range.x.min + 0.5 : x >= range.x.max - 0.5;
	}

	function setZoomed(next: boolean): void {
		if (zoomedRef.current !== next) {
			zoomedRef.current = next;
			optionsRef.current.onZoomedChange(next);
		}
	}

	function settleTo(
		geometry: ZoomGeometry,
		target: ZoomTransform,
		{
			touchRelease = false,
			scaleVelocity = 0
		}: { touchRelease?: boolean; scaleVelocity?: number } = {}
	): void {
		const from = current();
		animator.stop();
		// A Reduce Motion cross-fade stopped mid-dip would leave the photo dim,
		// since the next dip returns to the frozen opacity. So every settle
		// starts from full opacity, and ends there.
		if (animator.get('opacity') !== 1) {
			animator.set({ opacity: 1 });
		}
		targetRef.current = target;
		setZoomed(isZoomed(geometry, target));
		if (from.x === target.x && from.y === target.y && from.scale === target.scale) {
			return;
		}
		// Registers the reduced-motion cross-fade once; later calls do nothing.
		registerReducedMotionCrossFade();
		// Every zoom settles on `springs.settle`, read where the stage is. A
		// pinch's release starts it at the photo's scale velocity. The offset
		// starts at the matching speed, so the point the fingers held stays
		// put, as it does from rest.
		const stage = optionsRef.current.stageRef();
		const span = target.scale - from.scale;
		const rate = Number.isFinite(scaleVelocity) && span !== 0 ? scaleVelocity / span : 0;
		animator.animate(
			{ x: target.x, y: target.y, scale: target.scale },
			{
				spring: resolveMotion(stage, springs.settle),
				velocity: {
					x: (target.x - from.x) * rate,
					y: (target.y - from.y) * rate,
					scale: span * rate
				}
			},
			{ touchRelease }
		);
	}

	// Another item: back to the fitted size before it paints. Lightbox resets
	// its own zoomed state during that render.
	$effect(() => {
		void options().itemKey;
		animator.stop();
		animator.set({ x: 0, y: 0, scale: 1, opacity: 1 });
		targetRef.current = IDENTITY;
		zoomedRef.current = false;
		geometryRef.current = null;
	});

	// A rotation or resize keeps the same photo point centred at the same
	// on-screen size (the shared resize observer). It watches the surface: in
	// a gallery the stage moves to each current page, while the track, whose
	// size every page shares, stays.
	function onResize(): void {
		const before = geometryRef.current;
		if (before == null || !zoomedRef.current) {
			return;
		}
		const after = measure();
		if (after == null) {
			return;
		}
		animator.stop();
		const next = transformForResize(before, after, targetRef.current);
		write(next);
		setZoomed(isZoomed(after, next));
	}
	$effect(() => {
		const latest = options();
		optionsRef.current = latest;
		if (!latest.isEnabled) {
			return;
		}
		const surface = (latest.surfaceRef ?? latest.stageRef)();
		if (surface == null) {
			return;
		}
		return observeResize(surface, onResize);
	});

	// The keyboard works on where the photo is going, like UIKit's model
	// values: a press during a settle continues from that settle's end.
	function zoomIn(): void {
		const geometry = measure();
		if (geometry == null || zoomedRef.current) {
			return;
		}
		settleTo(geometry, releasedZoomTarget(geometry, targetRef.current));
	}

	function zoomOut(): void {
		const geometry = measure();
		if (geometry == null || !zoomedRef.current) {
			return;
		}
		settleTo(geometry, restingTransform(geometry, { ...IDENTITY, scale: geometry.minScale }));
	}

	const api: ZoomStage = {
		contentAttach,
		isZoomed: () => zoomedRef.current,
		toggle: () => (zoomedRef.current ? zoomOut() : zoomIn()),
		zoomIn,
		zoomOut,
		panBy: (dx: number, dy: number) => {
			const geometry = measure();
			if (geometry == null || !zoomedRef.current) {
				return;
			}
			settleTo(geometry, pannedBy(geometry, targetRef.current, dx, dy));
		},
		doubleClickAt: (clientX: number, clientY: number) => {
			const geometry = measure();
			if (geometry == null) {
				return;
			}
			const point = toStage({ x: clientX, y: clientY });
			settleTo(geometry, doubleClickTarget(geometry, current(), point));
		},
		isAtEdge: (direction: PanDirection) => {
			const geometry = geometryRef.current ?? measure();
			if (geometry == null || !zoomedRef.current) {
				return true;
			}
			return isAtEdgeOf(geometry, direction);
		}
	};

	return {
		api,
		animator,
		geometryRef,
		targetRef,
		zoomedRef,
		optionsRef,
		measure,
		toStage,
		current,
		write,
		setTarget,
		setZoomed,
		isMoving,
		isAtEdgeOf,
		settleTo
	};
}

/** The hook's options read live at each call. */
export type { ZoomGeometry, ZoomTransform };
