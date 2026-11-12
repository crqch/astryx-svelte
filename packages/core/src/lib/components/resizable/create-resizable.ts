/**
 * Ported from Astryx's `Resizable/createResizable.ts` — the resize factory
 * behind `useResizable`.
 *
 * One divergence in shape, not behaviour: upstream also makes a plain element
 * a window splitter when it is handed one. This port's `ResizeHandle` owns
 * pointer, keyboard and ARIA input on its own element, so the factory is
 * created with no handle and only serves the hook. The region, percentage,
 * persistence, rubber-band, spring-back, close-slide and Reduce Motion
 * behaviour below is upstream's.
 *
 * No DOM work on import.
 */

import { observeResize } from '../../internal/shared-resize-observer.js';
import { createDevWarnings } from '../../utils/dev-warning.js';
import { project } from '../../motion/projection.js';
import { rubberBand, rubberBandInverse, rubberBandSlope } from '../../motion/rubber-band.js';
import type { SizeValue } from '../../internal/types.js';
import {
	DEFAULT_COLLAPSED_SIZE,
	DEFAULT_MIN,
	DEFAULT_SIZE_FALLBACK,
	RESIZABLE_SIZE_GUIDANCE,
	SERVER_BASIS,
	clampSize,
	dependsOnBasis,
	loadPersistedState,
	measureContentBox,
	parseSize,
	persistState,
	resolveBound,
	type PersistedResizableState,
	type ResizableDirection,
	type ResizableSize
} from './resizable-model.js';
import {
	createOvershootDrawing,
	createPaneReveal,
	handOverPane,
	type OvershootDrawing,
	type PaneListener,
	type RegionPaneSlot,
	type ResizablePane,
	isScriptMotion,
	shownSizeReader,
	slideMotionsOf,
	slideNextOnRelease
} from './resizable-pane.js';
import { resolveMotion } from '../../motion/resolve-motion.js';
import { springs } from '../../motion/uikit/springs.js';

export interface CreateResizableOptions {
	/**
	 * Initial size. A number or an exact `Npx` is pixels, and an exact `N%` is
	 * a share of the basis. `percent(value, {min | max: pixel(value)})` adds one
	 * pixel floor or ceiling. A value that depends on the basis resolves once
	 * into pixels. @default 250
	 */
	defaultSize?: ResizableSize | SizeValue;
	/** The minimum size, in the same forms. @default 50 */
	minSize?: ResizableSize;
	/** The maximum size, in the same forms. Unbounded when omitted. */
	maxSize?: ResizableSize;
	/** Pixel values the region rests on; it can rest only on one of them. */
	snaps?: number[];
	/** Whether the region can collapse to 0. @default false */
	collapsible?: boolean;
	/**
	 * Size in px under which a lift or a key step collapses the region.
	 * @default 40
	 */
	collapsedSize?: number;
	/**
	 * The element a percentage is a share of, read as `containerRef.current`.
	 * Omitted, percentages are a share of the viewport. A plain `{current}`
	 * object serves outside React.
	 */
	containerRef?: { readonly current: HTMLElement | null };
	/** The axis the region resizes along. @default 'horizontal' */
	direction?: ResizableDirection;
	/** Key under which the size and collapse state persist in localStorage. */
	autoSaveId?: string;
	/** Initial collapse state; a persisted entry wins over it. */
	defaultIsCollapsed?: boolean;
	/**
	 * Controlled collapse state. When set, the caller owns collapse. A collapse
	 * or expand request reports through `onCollapseChange`. Nothing changes
	 * until the caller passes the new value through `update`.
	 */
	isCollapsed?: boolean;
	/** Called when an interaction changes the size. */
	onSizeChange?: (size: number) => void;
	/** Called when an interaction collapses or expands the region. */
	onCollapseChange?: (isCollapsed: boolean) => void;
}

export interface ResizableController {
	/** The region's size in px, 0 while collapsed. */
	readonly size: number;
	readonly isCollapsed: boolean;
	/** Collapses the region, when it is collapsible. */
	collapse(): void;
	/** Expands the region to the size it had before it collapsed. */
	expand(): void;
	/** Resizes the region to `size` px, within its bounds. */
	resize(size: number): void;
	/**
	 * Takes the full set of options, as a new render does: an option left out
	 * returns to its default. The region keeps its size and collapse state,
	 * within the new options.
	 */
	update(options: CreateResizableOptions): void;
	/**
	 * Calls `listener` after every change to `size` or `isCollapsed`, a
	 * correction a newly measured basis makes included. Returns the function
	 * that stops it.
	 */
	subscribe(listener: () => void): () => void;
	/**
	 * Removes every listener, observer and attribute the factory added and the
	 * body's drag cursor; a drag in flight ends as cancelled.
	 */
	destroy(): void;
}

/** The viewport width, the basis without a container. */
function readViewportBasis(): number {
	return typeof window === 'undefined' ? SERVER_BASIS : window.innerWidth;
}

/** The factory warns. This first-render read does not. */
const QUIET = null;

/** How far a pull past a size bound can move the handle, in px. */
const RUBBER_BAND_TRAVEL_PX = 8;

/**
 * The state a region with `options` starts in, before its handle exists: the
 * server's render and a hook's first render. A container is not measured
 * yet, so a percentage of it resolves against the deterministic 1200px basis
 * until the factory measures it. `'server'` reads the state the server
 * rendered, for a render that hydrates it: the 1200px basis for a viewport
 * percentage too, and nothing saved.
 */
export function readInitialResizableState(
	options: CreateResizableOptions = {},
	environment: 'client' | 'server' = 'client'
): ResizableSnapshot {
	const {
		defaultSize,
		minSize,
		maxSize,
		containerRef,
		collapsible = false,
		snaps = [],
		autoSaveId,
		defaultIsCollapsed,
		isCollapsed: controlled
	} = options;
	const isServer = environment === 'server';
	const persisted = autoSaveId && !isServer ? loadPersistedState(autoSaveId) : null;
	const parsedDefault = parseSize(defaultSize);
	const parsedMin = parseSize(minSize);
	const parsedMax = parseSize(maxSize);
	const hasContainer = containerRef != null;
	const needsContainer =
		hasContainer &&
		(dependsOnBasis(parsedMin) ||
			dependsOnBasis(parsedMax) ||
			(persisted?.size == null && dependsOnBasis(parsedDefault)));
	const basis = hasContainer || isServer ? SERVER_BASIS : readViewportBasis();
	const min = resolveBound(
		minSize,
		parsedMin,
		basis,
		DEFAULT_MIN,
		'minSize',
		RESIZABLE_SIZE_GUIDANCE,
		QUIET
	);
	const max = resolveBound(
		maxSize,
		parsedMax,
		basis,
		Infinity,
		'maxSize',
		RESIZABLE_SIZE_GUIDANCE,
		QUIET
	);
	const defaultPx = resolveBound(
		defaultSize,
		parsedDefault,
		basis,
		DEFAULT_SIZE_FALLBACK,
		'defaultSize',
		RESIZABLE_SIZE_GUIDANCE,
		QUIET
	);
	const chosen = persisted?.size ?? (needsContainer ? null : clampSize(defaultPx, min, max, snaps));
	const size = clampSize(chosen ?? defaultPx, min, max, snaps);
	const isCollapsed =
		collapsible &&
		(controlled !== undefined
			? controlled
			: (persisted?.isCollapsed ?? defaultIsCollapsed ?? false));
	// A container is not measured yet; without one the window's extent stands
	// in for a missing maximum, as the factory reports it.
	const windowExtent =
		hasContainer || isServer ? null : readWindowExtent(options.direction ?? 'horizontal');
	return {
		size: isCollapsed ? 0 : size,
		isCollapsed,
		expandedSize: size,
		minPx: min,
		maxPx: max,
		effectiveMaxPx:
			max !== Infinity ? max : standInMaximum(windowExtent, isCollapsed ? min : size, min)
	};
}

/**
 * What a region renders. A change to any part replaces it as a whole. It holds
 * the size (0 while collapsed), the collapse state, the size as expanded, and
 * the bounds the handle announces.
 */
export interface ResizableSnapshot {
	readonly size: number;
	readonly isCollapsed: boolean;
	readonly expandedSize: number;
	readonly minPx: number;
	readonly maxPx: number;
	/** The maximum the handle reports: a configured one, or a measured extent. */
	readonly effectiveMaxPx: number | undefined;
}

/**
 * The package's own channel into a factory, for useResizable: kept off the
 * exported ResizableController, so it adds no public member.
 */
interface ResizableInternals {
	snapshot(): ResizableSnapshot;
	/** Calls `listener` after every change to the snapshot. */
	subscribeSnapshot(listener: () => void): () => void;
	/**
	 * Follows the element behind `containerRef` when it has changed without
	 * new options, as a commit may have swapped it.
	 */
	syncContainer(): void;
	/**
	 * Lets go of the page and keeps the region. Observers go; collapse, expand
	 * and resize still apply and report.
	 */
	suspend(): void;
	/** Takes the page back after `suspend`: the observers. */
	resume(): void;
	/**
	 * The region's side of a gesture the factory does not own: the drag and
	 * keys of a ResizeHandle given the configuration object's props.
	 */
	model: ResizeGestureModel;
	/**
	 * The hook's region: the pane its LayoutPanel hands over, and whether its
	 * ResizeHandle's pointer drags. Returns the function that stops following
	 * it.
	 */
	followRegion(slot: RegionPaneSlot): () => void;
}

const internals = new WeakMap<ResizableController, ResizableInternals>();

/** The factory's internal channel, or undefined for anything else. */
export function readResizableInternals(
	controller: ResizableController
): ResizableInternals | undefined {
	return internals.get(controller);
}

/** The region's side of a gesture: the model a ResizeHandle drives. */
export interface ResizeGestureModel {
	state(): ResizeGestureState;
	start(): void;
	move(delta: number): void;
	end(velocity?: number): void;
	cancel(): void;
	collapse(): void;
	expand(): void;
}

export interface ResizeGestureState {
	size: number;
	isCollapsed: boolean;
	minPx: number;
	maxPx: number;
	snaps: number[];
	collapsedSize: number;
	collapsible: boolean;
}

/** A slide a closing lift plays. */
interface ClosingSlide {
	/** The size the handle shows at the lift, where its slide starts. */
	fromSize: number;
	/** When it started, on the page clock. */
	startedAt: number;
	/** The share still to go by ms since it started. */
	remaining: (elapsedMs: number) => number;
	/** Reads the size the pane shows from its handle's drawn middle. */
	readShown: (() => number) | null;
}

/** The window's extent along an axis, or null when there is no window. */
function readWindowExtent(direction: ResizableDirection): number | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return direction === 'vertical' ? window.innerHeight : window.innerWidth;
}

/**
 * A measured extent that stands in for a missing maximum, floored at the
 * current size and, while collapsed, at the resolved minimum.
 */
function standInMaximum(extent: number | null, size: number, min: number): number | undefined {
	if (extent == null) {
		return undefined;
	}
	return Math.max(extent, size, min);
}

/**
 * The factory. `source` names the warning prefix: `useResizable` keeps the
 * hook's words.
 */
export function createResizableAs(
	source: 'createResizable' | 'useResizable',
	handle: HTMLElement | null,
	options: CreateResizableOptions = {}
): ResizableController {
	const isHook = source === 'useResizable';
	let opts = options;
	let isDestroyed = false;
	// Let go of the page by `suspend`, with the region kept.
	let isSuspended = false;
	const listeners = new Set<() => void>();
	const warn = createDevWarnings();

	let persistedKey = opts.autoSaveId;
	let persisted: PersistedResizableState | null = persistedKey
		? loadPersistedState(persistedKey)
		: null;

	// The percentage basis. The container is followed through the shared
	// observer only while some option needs it; the viewport only while a
	// percentage bound needs it.
	let containerElement: HTMLElement | null = null;
	let observedDirection: ResizableDirection | null = null;
	let containerBasis: number | null = null;
	let stopObservingContainer: (() => void) | null = null;
	let isSubscribing = false;
	let isObservingViewport = false;

	// One stable basis per gesture: a container that resizes mid-drag would
	// otherwise move the bound under the pointer.
	let gestureBasis: number | null = null;
	let isGestureActive = false;
	// A catch between snap points: the edge follows the finger until it
	// reaches one, and the snaps hold again from there.
	let isCarryingToSnap = false;
	let dragStartSize = 0;
	let pointerSize = 0;
	// The open size a drag started from, which a close on its lift keeps.
	let sizeBeforeDrag: number | null = null;
	// Past a bound the handle is drawn this far past it. The panes keep their
	// sizes. It springs back to 0 after the lift.
	let overshoot = 0;
	// A finger that catches the drawn handle holds it where it shows: inside
	// this much overshoot the handle follows the finger 1:1.
	let caught = 0;
	let drawing: OvershootDrawing | null = null;
	// A closing lift keeps the drawn handle until the slide has measured it,
	// so the slide starts from where the handle shows.
	let isDrawingHeldForSlide = false;
	// The drawn handle springs back to its limit after a lift.
	let isSpringingBack = false;
	// The slide a closing lift plays.
	let closingSlide: ClosingSlide | null = null;
	// A finger holds a pane that was sliding shut. The slide's motions are
	// paused, and the finger moves them until it passes the minimum.
	let held: {
		slide: ClosingSlide;
		motions: Animation[];
		durationMs: number;
		// The size the pane shows when the slide ends.
		shutSize: number;
	} | null = null;

	let initialDefault: { px: number; isFinal: boolean } | null = null;
	let chosenSize: number | null | undefined;
	let committedBounds: { min: number; max: number } | null = null;
	let uncontrolledIsCollapsed = persisted?.isCollapsed ?? opts.defaultIsCollapsed ?? false;

	let derived = {
		size: 0,
		isCollapsed: false,
		min: DEFAULT_MIN,
		max: Infinity,
		effectiveMax: undefined as number | undefined,
		isBasisMeasured: true
	};
	let notified: { size: number; isCollapsed: boolean } | null = null;
	let written: { key: string; size: number; isCollapsed: boolean } | null = null;
	let mustWrite = false;
	let snapshot: ResizableSnapshot | null = null;
	const snapshotListeners = new Set<() => void>();

	// The pane is the LayoutPanel the hook's region hands over. The factory
	// measures its edge reveal before the DOM changes. It plays the reveal once
	// the pane renders its new size.
	let pane: ResizablePane | null = null;
	let regionSlot: RegionPaneSlot | null = null;
	const paneReveal = createPaneReveal(() => pane?.element.parentElement ?? null);
	// `pendingFlip` is a flip this factory made that the pane has not rendered
	// yet. `expectedFlip` is a controlled flip that the pane rendered and
	// measured first.
	let pendingFlip: { toCollapsed: boolean; isPlayable: boolean } | null = null;
	let expectedFlip: boolean | null = null;
	let isPointerReopening = false;
	// Whether a pointer drives the gesture under way; a key's step does not.
	let isPointerGesture = false;

	const direction = (): ResizableDirection => opts.direction ?? 'horizontal';
	const collapsible = (): boolean => opts.collapsible ?? false;
	const isControlled = (): boolean => opts.isCollapsed !== undefined;
	const snaps = (): number[] => opts.snaps ?? [];

	const onViewportResize = () => {
		commit();
	};

	/** Which bases the options need followed right now. */
	function observation() {
		const parsedDefault = parseSize(opts.defaultSize);
		const boundsDependOnBasis =
			dependsOnBasis(parseSize(opts.minSize)) || dependsOnBasis(parseSize(opts.maxSize));
		const defaultNeedsInitialBasis =
			persisted?.size == null &&
			chosenSize == null &&
			dependsOnBasis(parsedDefault) &&
			initialDefault?.isFinal !== true;
		const hasContainer = opts.containerRef != null;
		return {
			hasContainer,
			container: hasContainer && (boundsDependOnBasis || defaultNeedsInitialBasis),
			viewport: !hasContainer && boundsDependOnBasis
		};
	}

	/** Follow the bases `observation()` names, and nothing else. */
	function syncObservation(): void {
		const needs = observation();
		const element = needs.container ? (opts.containerRef?.current ?? null) : null;
		if (element !== containerElement || observedDirection !== direction()) {
			stopObservingContainer?.();
			stopObservingContainer = null;
			containerElement = element;
			containerBasis = null;
			observedDirection = direction();
			if (element != null) {
				// The observer measures once as it registers; that measurement is
				// read by the computation this call is part of.
				isSubscribing = true;
				const observed = element;
				stopObservingContainer = observeResize(observed, (entry) => {
					containerBasis = measureContentBox(observed, direction(), entry);
					if (!isSubscribing) {
						commit();
					}
				});
				isSubscribing = false;
			}
		}
		const watchViewport = needs.viewport && typeof window !== 'undefined';
		if (watchViewport && !isObservingViewport) {
			window.addEventListener('resize', onViewportResize);
			isObservingViewport = true;
		} else if (!watchViewport && isObservingViewport) {
			window.removeEventListener('resize', onViewportResize);
			isObservingViewport = false;
		}
	}

	/** The region's state from its options, its basis and its selection. */
	function compute(): void {
		const needs = observation();
		const hasPositiveMeasurement = containerBasis != null && containerBasis > 0;
		// Before a supplied container is measured, the deterministic 1200px
		// stands in. It also stands in while the container measures 0, as a
		// hidden or detached one does. The first real measurement replaces it.
		const liveBasis = needs.hasContainer
			? hasPositiveMeasurement
				? (containerBasis as number)
				: SERVER_BASIS
			: readViewportBasis();
		const isBasisMeasured = needs.container ? hasPositiveMeasurement : true;
		const basis = gestureBasis ?? liveBasis;

		const min = resolveBound(
			opts.minSize,
			parseSize(opts.minSize),
			basis,
			DEFAULT_MIN,
			'minSize',
			RESIZABLE_SIZE_GUIDANCE,
			warn,
			source
		);
		const max = resolveBound(
			opts.maxSize,
			parseSize(opts.maxSize),
			basis,
			Infinity,
			'maxSize',
			RESIZABLE_SIZE_GUIDANCE,
			warn,
			source
		);
		// A basis-dependent default resolves ONCE into a pixel size; it is final
		// once its basis is real.
		if (initialDefault == null || !initialDefault.isFinal) {
			initialDefault = {
				px: resolveBound(
					opts.defaultSize,
					parseSize(opts.defaultSize),
					basis,
					DEFAULT_SIZE_FALLBACK,
					'defaultSize',
					RESIZABLE_SIZE_GUIDANCE,
					warn,
					source
				),
				isFinal: isBasisMeasured
			};
		}
		const defaultPx = initialDefault.px;
		if (chosenSize === undefined) {
			chosenSize =
				persisted?.size ?? (isBasisMeasured ? clampSize(defaultPx, min, max, snaps()) : null);
		}
		if (isBasisMeasured && chosenSize == null) {
			// The container is measured now: the selection the temporary basis
			// stood in for is made against the real one. Not an interaction, so it
			// reports nothing through onSizeChange.
			chosenSize = clampSize(defaultPx, min, max, snaps());
		}
		// A re-resolved bound clamps the SELECTION, once the basis is final and
		// no gesture holds it.
		if (
			isBasisMeasured &&
			gestureBasis == null &&
			(committedBounds == null || committedBounds.min !== min || committedBounds.max !== max)
		) {
			committedBounds = { min, max };
			if (chosenSize != null) {
				chosenSize = clampSize(chosenSize, min, max, snaps());
			}
		}
		const restsOn = isGestureActive && isCarryingToSnap ? [] : snaps();
		const size = clampSize(chosenSize ?? defaultPx, min, max, restsOn);
		const isCollapsed =
			collapsible() && (isControlled() ? Boolean(opts.isCollapsed) : uncontrolledIsCollapsed);

		if (min > max) {
			warn(
				source,
				`the resolved minimum (${min}px) is above the resolved maximum ` +
					`(${max}px). The maximum wins${isHook ? ', as it always has' : ''}.`,
				'inverted'
			);
		}

		// The maximum the handle REPORTS: a configured maximum, or a measured
		// extent standing in for it, never below what the handle announces.
		const measuredForMax = needs.hasContainer
			? hasPositiveMeasurement && needs.container
				? containerBasis
				: null
			: readWindowExtent(direction());
		const effectiveMax =
			max !== Infinity ? max : standInMaximum(measuredForMax, isCollapsed ? min : size, min);

		derived = { size, isCollapsed, min, max, effectiveMax, isBasisMeasured };
	}

	/** Recompute, then bring the observers, the handle, storage and subscribers along. */
	function commit(): void {
		if (isDestroyed) {
			return;
		}
		if (isSuspended) {
			// No observers and no handle: the last measured basis stands.
			compute();
		} else {
			// The observation a computation needs can change with it (a default
			// made final stops following its container): settle both.
			for (let pass = 0; pass < 3; pass++) {
				const before = observation();
				syncObservation();
				compute();
				const after = observation();
				if (before.container === after.container && before.viewport === after.viewport) {
					break;
				}
			}
		}
		if (handle != null && !isSuspended) {
			announce();
		}
		persist();
		const reported = {
			size: derived.isCollapsed ? 0 : derived.size,
			isCollapsed: derived.isCollapsed
		};
		if (notified != null) {
			if (notified.isCollapsed !== reported.isCollapsed) {
				if (expectedFlip === reported.isCollapsed) {
					// The pane rendered this change first and has measured it.
					expectedFlip = null;
					pendingFlip = null;
				} else {
					pendingFlip = {
						toCollapsed: reported.isCollapsed,
						isPlayable: !isPointerReopening
					};
					if (isPointerReopening) {
						// The pointer drives the edge: a running conceal lands at once.
						paneReveal.land();
					}
				}
			} else if (notified.size !== reported.size) {
				// A resize that neither collapses nor opens lands a running motion.
				paneReveal.land();
			}
		}
		pane?.setCollapsed(reported.isCollapsed, handle);
		const next: ResizableSnapshot = {
			size: reported.size,
			isCollapsed: reported.isCollapsed,
			expandedSize: derived.size,
			minPx: derived.min,
			maxPx: derived.max,
			effectiveMaxPx: derived.effectiveMax
		};
		const isSnapshotChanged =
			snapshot == null ||
			(Object.keys(next) as (keyof ResizableSnapshot)[]).some(
				(key) => snapshot?.[key] !== next[key]
			);
		if (isSnapshotChanged) {
			snapshot = next;
		}
		if (
			notified == null ||
			notified.size !== reported.size ||
			notified.isCollapsed !== reported.isCollapsed
		) {
			const isFirst = notified == null;
			notified = reported;
			if (!isFirst) {
				for (const listener of [...listeners]) {
					listener();
				}
			}
		}
		if (isSnapshotChanged) {
			for (const listener of [...snapshotListeners]) {
				listener();
			}
		}
	}

	// --- The pane a LayoutPanel lends ---

	const paneListener: PaneListener = {
		beforeChange(toCollapsed) {
			const current = pane;
			if (current == null) {
				return;
			}
			if (pendingFlip?.toCollapsed === toCollapsed) {
				const { isPlayable } = pendingFlip;
				pendingFlip = null;
				if (isPlayable) {
					paneReveal.measure(current, current.contentFacingEdge());
				} else {
					paneReveal.land();
				}
				dropHeldDrawing();
				return;
			}
			// The pane renders a collapse or open this factory has not made yet,
			// ahead of the size it reports. A controlled isCollapsed does that: it
			// reaches the factory after this update. It plays too.
			const reportedSize = derived.isCollapsed ? 0 : derived.size;
			const isAhead = toCollapsed ? reportedSize !== 0 : reportedSize === 0;
			if (collapsible() && isAhead && derived.isCollapsed !== toCollapsed) {
				expectedFlip = toCollapsed;
				paneReveal.measure(current, current.contentFacingEdge());
			}
			dropHeldDrawing();
		},
		committed() {
			// The slide's after-measure reads the handle without its drawing.
			dropHeldDrawing();
			if (pane != null) {
				paneReveal.committed(pane);
			}
		}
	};

	function setPane(next: ResizablePane | null): void {
		if (next === pane) {
			return;
		}
		paneReveal.land();
		pendingFlip = null;
		expectedFlip = null;
		isDrawingHeldForSlide = false;
		drawing?.clear();
		drawing = next == null ? null : createOvershootDrawing(next);
		pane = handOverPane(pane, next, paneListener, derived.isCollapsed, handle);
	}

	/** Nothing is written while the basis stands in, nor while a gesture runs. */
	function persist(): void {
		const key = opts.autoSaveId;
		if (key == null || key === '' || !derived.isBasisMeasured) {
			return;
		}
		if (isGestureActive) {
			return;
		}
		const next = { key, size: derived.size, isCollapsed: derived.isCollapsed };
		if (
			mustWrite ||
			written == null ||
			written.key !== next.key ||
			written.size !== next.size ||
			written.isCollapsed !== next.isCollapsed
		) {
			mustWrite = false;
			written = next;
			persistState(key, { size: next.size, isCollapsed: next.isCollapsed });
		}
	}

	/**
	 * The factory keeps no handle of its own in this port. Kept as a no-op so
	 * the commit order stays upstream's; `ResizeHandle` writes the ARIA.
	 */
	function announce(): void {}

	const setCollapsed = (value: boolean) => {
		if (!isControlled()) {
			uncontrolledIsCollapsed = value;
		}
	};

	function collapse(): void {
		if (isDestroyed || !collapsible() || derived.isCollapsed) {
			return;
		}
		setCollapsed(true);
		commit();
		opts.onCollapseChange?.(true);
		opts.onSizeChange?.(0);
	}

	function expand(): void {
		if (isDestroyed) {
			return;
		}
		const wasCollapsed = derived.isCollapsed;
		setCollapsed(false);
		commit();
		if (wasCollapsed) {
			opts.onCollapseChange?.(false);
		}
		opts.onSizeChange?.(derived.size);
	}

	function resize(next: number): void {
		if (isDestroyed) {
			return;
		}
		// An invalid size repairs nothing: it must not replace a legal selection
		// with NaN, which would reach storage and aria-valuenow.
		if (!Number.isFinite(next) || next < 0) {
			warn(
				source,
				`resize(${String(next)}) is not a pixel size. Keeping the current ` +
					`size. Percentages configure the ${isHook ? 'hook' : 'region'}; ` +
					'they are not a programmatic input.',
				`resize-${String(next)}`
			);
			return;
		}
		const clamped = clampSize(next, derived.min, derived.max, snaps());
		const wasCollapsed = derived.isCollapsed;
		chosenSize = clamped;
		setCollapsed(false);
		commit();
		// Resizing out of the collapsed state is an implicit expand.
		if (wasCollapsed) {
			opts.onCollapseChange?.(false);
		}
		opts.onSizeChange?.(clamped);
	}

	const model: ResizeGestureModel = {
		state(): ResizeGestureState {
			return {
				size: derived.isCollapsed ? 0 : derived.size,
				isCollapsed: derived.isCollapsed,
				minPx: derived.min,
				maxPx: derived.max,
				snaps: snaps(),
				collapsedSize: opts.collapsedSize ?? DEFAULT_COLLAPSED_SIZE,
				collapsible: collapsible()
			};
		},
		start() {
			dropHeldDrawing();
			// The basis holds still for the whole gesture.
			gestureBasis = readLiveBasis();
			isGestureActive = true;
			isCarryingToSnap = false;
			// Only a pointer catches a slide or a spring-back; a key steps.
			const isPointer = regionSlot?.isPointerDragging() === true;
			isPointerGesture = isPointer;
			const closing = derived.isCollapsed && isPointer ? closingShown() : 0;
			const slide = closingSlide;
			closingSlide = null;
			if (closing > 0 && slide != null) {
				catchClosing(closing, slide);
				return;
			}
			// A finger catches a spring-back where it shows.
			const shown = !isPointer ? 0 : isSpringingBack ? (drawing?.shown() ?? 0) : overshoot;
			isSpringingBack = false;
			overshoot = shown;
			caught = shown;
			drawing?.draw(shown);
			dragStartSize = (derived.isCollapsed ? 0 : derived.size) + shown;
			pointerSize = dragStartSize;
			sizeBeforeDrag = derived.isCollapsed ? null : derived.size;
		},
		move(delta) {
			const previous = pointerSize;
			const raw = dragStartSize + delta;
			pointerSize = raw;
			if (held != null) {
				if (raw < derived.min) {
					holdAt(raw);
					return;
				}
				held = null;
				reopenAt(raw);
				return;
			}
			if (isCarryingToSnap && snaps().some((snap) => (snap - previous) * (snap - raw) <= 0)) {
				isCarryingToSnap = false;
			}
			const collapsedSize = opts.collapsedSize ?? DEFAULT_COLLAPSED_SIZE;
			// A collapsed pane opens once the pointer passes the collapsed size.
			// An open one never collapses mid-drag: the lift decides.
			if (derived.isCollapsed && raw < collapsedSize) {
				return;
			}
			const reopens = derived.isCollapsed && raw >= collapsedSize;
			if (reopens) {
				setCollapsed(false);
			}
			const clamped = clampSize(raw, derived.min, derived.max, isCarryingToSnap ? [] : snaps());
			chosenSize = clamped;
			// Only a pointer on a pane a LayoutPanel lends shows the rubber band. A
			// panel at the hook's size alone, and a key, stop at the limit.
			overshoot = pane == null || regionSlot?.isPointerDragging() !== true ? 0 : overshootPast(raw);
			drawing?.draw(overshoot);
			// Only a pointer reopens without a reveal; a key's step plays one.
			isPointerReopening = reopens && regionSlot?.isPointerDragging() === true;
			commit();
			isPointerReopening = false;
			if (reopens) {
				opts.onCollapseChange?.(false);
			}
			opts.onSizeChange?.(clamped);
		},
		// The lift decides a close: past the collapsed size, or released fast
		// enough to come to rest past it. Anything else springs back.
		end(velocity = 0) {
			if (held != null) {
				letGoOfHeldSlide(velocity);
				endGesture();
				return;
			}
			const collapsedSize = opts.collapsedSize ?? DEFAULT_COLLAPSED_SIZE;
			const closes =
				collapsible() &&
				!derived.isCollapsed &&
				Math.min(pointerSize, project(pointerSize, velocity)) < collapsedSize;
			if (closes && !isPointerGesture) {
				closeOnStep();
			} else if (closes) {
				closeOnRelease(velocity);
			} else if (isCarryingToSnap) {
				settleOnNearestSnap(velocity);
			} else {
				settleOvershoot(velocity);
			}
			endGesture();
		},
		// A cancelled gesture is still over: the basis it held comes back, and
		// the size it reached is saved once, like a completed one.
		cancel() {
			if (held != null) {
				letGoOfHeldSlide(-Infinity);
				endGesture();
				return;
			}
			if (isCarryingToSnap) {
				settleOnNearestSnap(0);
			} else {
				settleOvershoot(0);
			}
			endGesture();
		},
		collapse,
		expand
	};

	/**
	 * A finger catches a pane that is still sliding shut, where it shows. Past
	 * the minimum it opens there at once. Under it the slide stops, and the
	 * finger moves the slide. The pane's edge, the handle and the content stay
	 * together under the finger until it passes the minimum.
	 */
	function catchClosing(shownSize: number, slide: ClosingSlide): void {
		dragStartSize = shownSize;
		pointerSize = shownSize;
		if (shownSize >= derived.min) {
			reopenAt(shownSize);
			return;
		}
		const motions = pane == null ? [] : slideMotionsOf(pane);
		for (const motion of motions) {
			motion.pause();
		}
		const elapsed = Number(motions[0]?.currentTime ?? 0);
		const share = slide.remaining(Number.isFinite(elapsed) ? elapsed : 0);
		// The shown size moves with the share of the slide still to go. It runs
		// from the size laid out at the lift down to the size it shuts to.
		const shutSize = share < 0.98 ? (shownSize - slide.fromSize * share) / (1 - share) : 0;
		held = {
			slide,
			motions,
			durationMs: Number(motions[0]?.effect?.getComputedTiming().duration ?? 0),
			shutSize
		};
	}

	/** The held slide shows `size`: its motions move to the time it shows it. */
	function holdAt(size: number): void {
		if (held == null) {
			return;
		}
		const { slide, motions, durationMs, shutSize } = held;
		const span = slide.fromSize - shutSize;
		const share = span > 0 ? Math.min(1, Math.max(0, (size - shutSize) / span)) : 0;
		// The share still to go falls over the slide's time.
		let low = 0;
		let high = durationMs;
		while (high - low > 0.05) {
			const mid = (low + high) / 2;
			if (slide.remaining(mid) > share) {
				low = mid;
			} else {
				high = mid;
			}
		}
		for (const motion of motions) {
			motion.currentTime = (low + high) / 2;
		}
	}

	/**
	 * A lift while a finger holds a closing pane. Under the collapse threshold,
	 * or fast enough to come to rest under it, the slide plays on and shuts.
	 * Any other lift opens the pane to its minimum from where it shows.
	 */
	function letGoOfHeldSlide(velocity: number): void {
		const current = held;
		held = null;
		if (current == null) {
			return;
		}
		const collapsedSize = opts.collapsedSize ?? DEFAULT_COLLAPSED_SIZE;
		if (Math.min(pointerSize, project(pointerSize, velocity)) < collapsedSize) {
			for (const motion of current.motions) {
				motion.play();
			}
			const view = pane?.element.ownerDocument.defaultView;
			const elapsed = Number(current.motions[0]?.currentTime ?? 0);
			if (view != null && Number.isFinite(elapsed)) {
				closingSlide = {
					...current.slide,
					startedAt: view.performance.now() - elapsed
				};
			}
			return;
		}
		const row = pane?.element.parentElement;
		if (row != null) {
			slideNextOnRelease(row, velocity, Math.max(derived.min - pointerSize, 1));
		}
		setCollapsed(false);
		chosenSize = derived.min;
		// The open plays: the paused slide reverses from what it shows.
		commit();
		opts.onCollapseChange?.(false);
		opts.onSizeChange?.(derived.min);
	}

	/** The pane opens at once at `size`, under the pointer, with no slide. */
	function reopenAt(size: number): void {
		setCollapsed(false);
		const clamped = clampSize(size, derived.min, derived.max, []);
		isCarryingToSnap = snaps().length > 0 && !snaps().includes(clamped);
		chosenSize = clamped;
		sizeBeforeDrag = clamped;
		caught = 0;
		overshoot = pane == null ? 0 : overshootPast(size);
		drawing?.draw(overshoot);
		// Only a pointer reopens; the paused slide lands with what glides beside.
		isPointerReopening = true;
		commit();
		isPointerReopening = false;
		opts.onCollapseChange?.(false);
		opts.onSizeChange?.(clamped);
	}

	/**
	 * A lift between snap points, after a catch: the edge glides from where it
	 * shows to the snap nearest it.
	 */
	function settleOnNearestSnap(velocity: number): void {
		isCarryingToSnap = false;
		const shown = derived.size + overshoot;
		isSpringingBack = false;
		overshoot = 0;
		drawing?.clear();
		const target = clampSize(shown, derived.min, derived.max, snaps());
		const row = pane?.element.parentElement;
		const distance = Math.abs(target - shown);
		if (row != null && distance > 0) {
			slideNextOnRelease(row, Math.sign(target - shown) * velocity, distance);
		}
		chosenSize = target;
		commit();
		opts.onSizeChange?.(target);
	}

	/** How far the shown size runs past the bound `raw` is beyond. */
	function overshootPast(raw: number): number {
		const { min, max } = derived;
		if (raw >= min && raw <= max) {
			caught = 0;
			return 0;
		}
		const bound = raw > max ? max : min;
		const excess = raw - bound;
		const held = Math.sign(caught) === Math.sign(excess) ? caught : 0;
		// The band resumes past what a catch held, over the rest of its extent.
		const shown =
			Math.abs(excess) <= Math.abs(held)
				? excess
				: held + rubberBand(excess - held, Math.max(RUBBER_BAND_TRAVEL_PX - Math.abs(held), 0));
		// Below the minimum the drawn handle stops at 0, never past it.
		return Math.max(bound + shown, 0) - bound;
	}

	/**
	 * The drawn handle springs back to the bound on the settle spring from the
	 * release velocity, on the compositor. The size never left the bound, so
	 * nothing is laid out.
	 */
	function settleOvershoot(velocity: number): void {
		const from = overshoot;
		isSpringingBack = false;
		overshoot = 0;
		if (from === 0 || drawing == null || pane == null) {
			drawing?.clear();
			return;
		}
		const element = pane.element;
		const view = element.ownerDocument.defaultView;
		if (view == null || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
			drawing.clear();
			return;
		}
		// The drawn handle moved at the pointer's speed times the band's slope.
		const dimension = RUBBER_BAND_TRAVEL_PX;
		const slope = rubberBandSlope(rubberBandInverse(from, dimension), dimension);
		isSpringingBack = drawing.springBack(resolveMotion(element, springs.settle), velocity * slope);
	}

	/** Drops the drawn handle a closing lift kept for its slide to measure. */
	function dropHeldDrawing(): void {
		if (isDrawingHeldForSlide) {
			isDrawingHeldForSlide = false;
			drawing?.clear();
		}
	}

	/** The size a pane still sliding shut shows now; 0 once it is shut. */
	function closingShown(): number {
		const element = pane?.element;
		const view = element?.ownerDocument.defaultView;
		if (closingSlide == null || element == null || view == null) {
			return 0;
		}
		// The slide's own motion on the pane tells how far it has run. A held
		// slide keeps its time, and a landed one reads past its end. Without the
		// animation API, the time since the lift tells it.
		const elapsed =
			typeof element.getAnimations === 'function'
				? Number(
						element
							.getAnimations()
							.find(
								(motion) =>
									(motion.playState === 'running' || motion.playState === 'paused') &&
									isScriptMotion(motion)
							)?.currentTime ?? Infinity
					)
				: view.performance.now() - closingSlide.startedAt;
		const share = closingSlide.remaining(elapsed);
		if (!(share > 0)) {
			return 0;
		}
		// The handle stays under the finger: the size is read from where it shows.
		return closingSlide.readShown?.() ?? closingSlide.fromSize * share;
	}

	/**
	 * A key step that ends under the collapsed size closes as `collapse()`
	 * does, on the theme's curve: no gesture releases it.
	 */
	function closeOnStep(): void {
		// An open restores the size the step started from.
		if (sizeBeforeDrag != null) {
			chosenSize = sizeBeforeDrag;
		}
		setCollapsed(true);
		commit();
		opts.onCollapseChange?.(true);
		opts.onSizeChange?.(0);
	}

	/**
	 * A lift that closes: the pane slides shut from what it shows, on the
	 * settle spring from the release velocity. The handle slides from where it
	 * is drawn.
	 */
	function closeOnRelease(velocity: number): void {
		isSpringingBack = false;
		const drawnAtLift = overshoot;
		const shown = derived.size + overshoot;
		// Measured while the edge still shows where the lift left it.
		const readShown = pane == null ? null : shownSizeReader(pane, shown);
		overshoot = 0;
		isDrawingHeldForSlide = drawing != null;
		// An open restores the size the drag started from.
		if (sizeBeforeDrag != null) {
			chosenSize = sizeBeforeDrag;
		}
		const row = pane?.element.parentElement;
		const remaining = row == null ? null : slideNextOnRelease(row, -velocity, shown);
		const view = pane?.element.ownerDocument.defaultView;
		// Under Reduce Motion the pane shuts at once: nothing is left to catch.
		closingSlide =
			remaining == null ||
			view == null ||
			view.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
				? null
				: {
						fromSize: shown,
						startedAt: view.performance.now(),
						remaining,
						readShown
					};
		setCollapsed(true);
		commit();
		opts.onCollapseChange?.(true);
		opts.onSizeChange?.(0);
		// A close the owner keeps open (a controlled isCollapsed) renders no
		// slide to measure the drawing. By the next frame the handle springs back
		// from where it is drawn.
		if (isDrawingHeldForSlide) {
			const springBackIfKept = () => {
				if (!isDrawingHeldForSlide) {
					return;
				}
				isDrawingHeldForSlide = false;
				overshoot = drawnAtLift;
				settleOvershoot(velocity);
			};
			if (typeof view?.requestAnimationFrame === 'function') {
				view.requestAnimationFrame(springBackIfKept);
			} else {
				setTimeout(springBackIfKept, 16);
			}
		}
	}

	function readLiveBasis(): number {
		const needs = observation();
		if (!needs.hasContainer) {
			return readViewportBasis();
		}
		return containerBasis != null && containerBasis > 0 ? containerBasis : SERVER_BASIS;
	}

	function endGesture(): void {
		if (!isGestureActive) {
			return;
		}
		gestureBasis = null;
		isGestureActive = false;
		mustWrite = true;
		commit();
	}

	commit();

	let stopFollowingRegion: (() => void) | null = null;

	const controller: ResizableController = {
		get size() {
			return derived.isCollapsed ? 0 : derived.size;
		},
		get isCollapsed() {
			return derived.isCollapsed;
		},
		collapse,
		expand,
		resize,
		update(next) {
			if (isDestroyed) {
				return;
			}
			opts = next;
			if (opts.autoSaveId !== persistedKey) {
				persistedKey = opts.autoSaveId;
				persisted = persistedKey ? loadPersistedState(persistedKey) : null;
			}
			commit();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		destroy() {
			if (isDestroyed) {
				return;
			}
			// A gesture a ResizeHandle drove through the region's model ends the
			// same way.
			endGesture();
			isSpringingBack = false;
			overshoot = 0;
			drawing?.clear();
			drawing = null;
			isDestroyed = true;
			stopFollowingRegion?.();
			stopFollowingRegion = null;
			paneReveal.land();
			pane = handOverPane(pane, null, paneListener, false, null);
			if (!isSuspended) {
				letGoOfPage();
			}
			listeners.clear();
			snapshotListeners.clear();
		}
	};
	internals.set(controller, {
		snapshot: () => snapshot as ResizableSnapshot,
		subscribeSnapshot(listener) {
			snapshotListeners.add(listener);
			return () => {
				snapshotListeners.delete(listener);
			};
		},
		model,
		suspend() {
			if (isDestroyed || isSuspended) {
				return;
			}
			endGesture();
			isSuspended = true;
			// A suspended region plays no reveal, so a running one lands now.
			paneReveal.land();
			letGoOfPage();
		},
		resume() {
			if (isDestroyed || !isSuspended) {
				return;
			}
			isSuspended = false;
			commit();
		},
		syncContainer() {
			if (isDestroyed || isSuspended) {
				return;
			}
			const element = observation().container ? (opts.containerRef?.current ?? null) : null;
			if (element !== containerElement) {
				commit();
			}
		},
		followRegion(slot) {
			stopFollowingRegion?.();
			regionSlot = slot;
			const stop = slot.follow((next) => {
				if (!isDestroyed) {
					setPane(next);
				}
			});
			stopFollowingRegion = () => {
				stop();
				if (regionSlot === slot) {
					regionSlot = null;
				}
			};
			return () => {
				stopFollowingRegion?.();
				stopFollowingRegion = null;
			};
		}
	});
	return controller;

	/** Stops the container and viewport observers and the reveal. */
	function letGoOfPage(): void {
		stopObservingContainer?.();
		stopObservingContainer = null;
		containerElement = null;
		if (isObservingViewport) {
			window.removeEventListener('resize', onViewportResize);
			isObservingViewport = false;
		}
	}
}
