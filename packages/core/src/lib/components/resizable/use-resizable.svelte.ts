/**
 * Ported from Astryx's `Resizable/useResizable.ts` at the 0.7.13 pin.
 *
 * The hook is the Svelte wrapper around `createResizable`: the factory owns
 * the region's state, persistence, percentage basis and motion; this module
 * creates it during component init, feeds it the options each update, and
 * exposes the snapshot as reactive state.
 *
 * Three React devices go. `useSyncExternalStore` becomes a `$state` snapshot
 * fed by the factory's own snapshot channel. The options object's identity is
 * not a render, so an effect calls `update` whenever the config getter's
 * values change. And the props object is stable with getters rather than
 * rebuilt each render, because this port's pane and handle registries key on
 * its identity.
 */

import {
	createResizableAs,
	readInitialResizableState,
	readResizableInternals,
	type CreateResizableOptions,
	type ResizableSnapshot
} from './create-resizable.js';
import { createRegionPaneSlot, registerPropsRegion } from './resizable-pane.js';
import {
	DEFAULT_COLLAPSED_SIZE,
	percent,
	type ResizableDirection,
	type ResizablePercentSize,
	type ResizableSize,
	type SizeValue
} from './resizable-model.js';
import { pixel } from '../table/column-utils.js';

export { percent, pixel };
export type { ResizableDirection, ResizablePercentSize, ResizableSize };

/** A pixel size with its Table-compatible structured spelling. */
export type { PixelWidth } from '../table/table-types.js';

export interface ResizableRegionConfig {
	/**
	 * Initial size. A number is pixels, exact `Npx` is pixels, exact `N%` is a
	 * share of the basis, and `percent()` adds one pixel floor or ceiling.
	 */
	defaultSize?: ResizableSize | SizeValue;
	/** Minimum size, in the same forms. @default 50 */
	minSize?: ResizableSize;
	/** Maximum size, in the same forms. Unbounded when omitted. */
	maxSize?: ResizableSize;
	/** Legacy alias of `minSize`, kept for this port's released API. */
	minSizePx?: number;
	/** Legacy alias of `maxSize`, kept for this port's released API. */
	maxSizePx?: number;
	/** Whether this region can collapse to 0. @default false */
	collapsible?: boolean;
	/** Size in px at which dragging triggers collapse. @default 40 */
	collapsedSize?: number;
	/** Pixel values to snap to during resize. */
	snaps?: number[];
	/** Cascade priority — lower number shrinks first. */
	shrinkOrder?: number;
}

/**
 * Shared config shape for any component that integrates built-in resize
 * (e.g. SideNav's `resizable` prop). A simplified surface over the full
 * `ResizableRegionConfig`.
 */
export interface ResizableConfig {
	/** Initial width in pixels. @default 260 */
	defaultWidth?: number;
	/** Minimum width in pixels. @default 180 */
	minWidth?: number;
	/** Maximum width in pixels. @default 480 */
	maxWidth?: number;
	/** localStorage key for persisting width and collapse state. */
	autoSaveId?: string;
	/** Called when the width changes (on drag end). */
	onWidthChange?: (width: number) => void;
	/** Start collapsed (uncontrolled). A persisted entry wins over this. */
	defaultIsCollapsed?: boolean;
	/** Controlled collapse state. Pair with `onCollapseChange`. */
	isCollapsed?: boolean;
	/** Called once per collapse state change. */
	onCollapseChange?: (isCollapsed: boolean) => void;
}

export interface UseResizableSingleConfig extends ResizableRegionConfig {
	/**
	 * The element a percentage is a share of. Omitted, percentages are a share
	 * of the viewport.
	 */
	containerRef?: { readonly current: HTMLElement | null };
	/** Which axis this region resizes along. @default 'horizontal' */
	direction?: ResizableDirection;
	/** Unique key for localStorage persistence. */
	autoSaveId?: string;
	/**
	 * Initial collapse state (uncontrolled). A persisted entry wins over it.
	 * Only honored when `collapsible` is true.
	 */
	defaultIsCollapsed?: boolean;
	/** Controlled collapse state. When set, the caller owns collapse. */
	isCollapsed?: boolean;
	/** Called when size changes during drag. */
	onSizeChange?: (size: number) => void;
	/** Called once per collapse state change. */
	onCollapseChange?: (isCollapsed: boolean) => void;
}

export interface UseResizableMultiConfig {
	/** Layout direction, shared by every region. @default 'horizontal' */
	direction?: ResizableDirection;
	/** One container for every region's percentage basis. */
	containerRef?: { readonly current: HTMLElement | null };
	/** Named region configurations. */
	regions: Record<string, ResizableRegionConfig>;
	/** Unique key for localStorage persistence. */
	autoSaveId?: string;
}

export interface ResizableRegion {
	/** Current size in pixels. */
	readonly size: number;
	/** Whether the region is currently collapsed. */
	readonly isCollapsed: boolean;
	/** Collapse the region (if collapsible). */
	collapse: () => void;
	/** Expand from collapsed state. */
	expand: () => void;
	/** Resize to a specific pixel value. */
	resize: (size: number) => void;
	/** Props to pass to a component's `resizable` prop or to `ResizeHandle`. */
	readonly props: ResizableProps;
}

export interface ResizableProps {
	_size: number;
	_isCollapsed: boolean;
	_onResizeStart: () => void;
	_onResizeMove: (delta: number) => void;
	_onResizeEnd: () => void;
	/**
	 * The gesture ended without completing — pointercancel, a lost pointer
	 * capture, or a handle unmounted mid-drag. Separate from `_onResizeEnd`
	 * because a cancelled drag deliberately does not signal a resize end, but
	 * it must still release everything the gesture was holding.
	 */
	_onResizeCancel?: () => void;
	_minSizePx: number;
	_maxSizePx: number;
	_snaps: number[];
	_collapsedSize: number;
	/** Whether the region supports collapsing. */
	_collapsible: boolean;
	/**
	 * The hook's axis, so a handle can flag a direction mismatch. Optional for
	 * the same reason as `_onResizeCancel`: this type is exported, and a
	 * hand-built object from before it existed must keep compiling.
	 */
	_direction?: ResizableDirection;
	_isResizableProps: true;
}

// =============================================================================
// The hook's channels to the factory and its handle
// =============================================================================

type CollapseControls = { collapse: () => void; expand: () => void };
const collapseControls = new WeakMap<ResizableProps, CollapseControls>();

/** A drag's end with its release velocity, signed like the move's delta. */
const releaseEnds = new WeakMap<ResizableProps, (velocity: number) => void>();

/** The maximum an unbounded region reports as `aria-valuemax`. */
const effectiveMaxima = new WeakMap<ResizableProps, number>();

/** The props behind a component's `resizable` slot. */
export function resizablePropsOf(value: ResizableRegion | ResizableProps): ResizableProps {
	return 'props' in value ? value.props : value;
}

/** Whether a `resizable` value is useResizable's output for one region. */
export function isResizableRegion(value: unknown): value is ResizableRegion {
	return typeof value === 'object' && value !== null && 'props' in value;
}

/** The reported maximum for `props`, or `undefined` for a hand-built object. */
export function getEffectiveMaxPx(props: ResizableProps): number | undefined {
	return effectiveMaxima.get(props);
}

/**
 * The collapse/expand pair the hook registered for `props`, or `undefined`
 * for a hand-built `ResizableProps` object (which the handle then toggles
 * with a resize gesture).
 */
export function getCollapseControls(props: ResizableProps): CollapseControls | undefined {
	return collapseControls.get(props);
}

/**
 * Ends the drag `props` follows at a release `velocity`. A props object the
 * hook did not return ends without one.
 */
export function endResizeAt(props: ResizableProps, velocity: number): void {
	const end = releaseEnds.get(props);
	if (end == null) {
		props._onResizeEnd();
		return;
	}
	end(velocity);
}

const EMPTY_SNAPS: number[] = [];

/** Maps the released pixel aliases onto upstream's `minSize` / `maxSize`. */
function optionsOf(config: UseResizableSingleConfig): CreateResizableOptions {
	const { minSizePx, maxSizePx, ...rest } = config;
	return {
		...rest,
		minSize: config.minSize ?? minSizePx,
		maxSize: config.maxSize ?? maxSizePx
	};
}

function useSingleResizable(config: () => UseResizableSingleConfig): ResizableRegion {
	const controller = createResizableAs('useResizable', null, optionsOf(config()));
	const channel = readResizableInternals(controller)!;
	const slot = createRegionPaneSlot();
	channel.followRegion(slot);

	let snapshot = $state(channel.snapshot());

	const props: ResizableProps = {
		get _size() {
			return snapshot.size;
		},
		get _isCollapsed() {
			return snapshot.isCollapsed;
		},
		_onResizeStart: () => channel.model.start(),
		_onResizeMove: (delta: number) => channel.model.move(delta),
		_onResizeEnd: () => channel.model.end(),
		_onResizeCancel: () => channel.model.cancel(),
		get _minSizePx() {
			return snapshot.minPx;
		},
		get _maxSizePx() {
			return snapshot.maxPx;
		},
		get _snaps() {
			const snaps = config().snaps;
			return snaps == null ? EMPTY_SNAPS : snaps;
		},
		get _collapsedSize() {
			return config().collapsedSize ?? DEFAULT_COLLAPSED_SIZE;
		},
		get _collapsible() {
			return config().collapsible ?? false;
		},
		get _direction() {
			return config().direction ?? 'horizontal';
		},
		_isResizableProps: true
	};

	collapseControls.set(props, {
		collapse: () => controller.collapse(),
		expand: () => controller.expand()
	});
	releaseEnds.set(props, (velocity) => channel.model.end(velocity));
	registerPropsRegion(props, slot);
	const noteEffectiveMax = () => {
		if (snapshot.effectiveMaxPx != null) {
			effectiveMaxima.set(props, snapshot.effectiveMaxPx);
		}
	};
	noteEffectiveMax();
	const unsubscribe = channel.subscribeSnapshot(() => {
		snapshot = channel.snapshot();
		noteEffectiveMax();
	});

	$effect.pre(() => {
		const options = optionsOf(config());
		// Reading the element makes a swap behind a stable ref a tracked change.
		if (options.containerRef != null) {
			void options.containerRef.current;
		}
		controller.update(options);
	});

	$effect(() => {
		return () => {
			unsubscribe();
			controller.destroy();
		};
	});

	const collapse = () => controller.collapse();
	const expand = () => controller.expand();
	const resize = (size: number) => controller.resize(size);

	return {
		get size() {
			return snapshot.size;
		},
		get isCollapsed() {
			return snapshot.isCollapsed;
		},
		collapse,
		expand,
		resize,
		get props() {
			return props;
		}
	};
}

/**
 * Multi-region form — one `useSingleResizable` per named region.
 *
 * Region keys must be stable, as upstream's contract requires: each region owns
 * a `$state` and an effect created during init, so a key that appears later gets
 * neither. Upstream's reason is React's rules of hooks; ours is that effects are
 * created once. Same contract, different cause.
 */
function useMultiResizable(config: () => UseResizableMultiConfig): Record<string, ResizableRegion> {
	const result: Record<string, ResizableRegion> = {};
	const { regions } = config();

	for (const key of Object.keys(regions)) {
		result[key] = useSingleResizable(() => {
			const current = config();
			return {
				...current.regions[key],
				containerRef: current.containerRef,
				direction: current.direction,
				autoSaveId: current.autoSaveId ? `${current.autoSaveId}:${key}` : undefined
			};
		});
	}

	return result;
}

export function useResizable(config: () => UseResizableSingleConfig): ResizableRegion;
export function useResizable(
	config: () => UseResizableMultiConfig
): Record<string, ResizableRegion>;
export function useResizable(
	config: () => UseResizableSingleConfig | UseResizableMultiConfig
): ResizableRegion | Record<string, ResizableRegion> {
	if ('regions' in config()) {
		return useMultiResizable(config as () => UseResizableMultiConfig);
	}
	return useSingleResizable(config as () => UseResizableSingleConfig);
}

/** The initial state a region renders before its factory exists, for SSR. */
export function readResizableServerState(config: UseResizableSingleConfig): ResizableSnapshot {
	return readInitialResizableState(optionsOf(config), 'server');
}
