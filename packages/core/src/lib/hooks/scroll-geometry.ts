/**
 * Shared geometry primitives for logical-axis scroll ownership.
 *
 * Ported from Astryx's `hooks/scrollGeometry.ts` — pure DOM geometry, no React.
 */

export const SCROLL_OVERFLOW_TOLERANCE = 1;

export type LogicalScrollAxis = 'inline' | 'block';
export type PhysicalScrollAxis = 'x' | 'y';

export interface LogicalAxisMapping {
	inline: PhysicalScrollAxis;
	block: PhysicalScrollAxis;
	inlineReversed: boolean;
	blockReversed: boolean;
}

export interface MeasuredScrollAxisState {
	isScrollable: boolean;
	atStart: boolean;
	atEnd: boolean;
}

export interface LogicalOverflowGeometry {
	inline: boolean;
	block: boolean;
}

const INACTIVE_AXIS_STATE: MeasuredScrollAxisState = {
	isScrollable: false,
	atStart: true,
	atEnd: true
};

export function getLogicalAxisMapping(writingMode: string, direction: string): LogicalAxisMapping {
	const mode = writingMode.toLowerCase();
	const isVertical = mode.startsWith('vertical') || mode.startsWith('sideways');
	const isRtl = direction === 'rtl';

	if (!isVertical) {
		return { inline: 'x', block: 'y', inlineReversed: isRtl, blockReversed: false };
	}

	// sideways-lr runs its natural inline direction from bottom to top. The
	// other vertical/sideways modes run top to bottom; `direction` reverses each.
	const inlineReversed = mode === 'sideways-lr' ? !isRtl : isRtl;
	const blockReversed = mode.endsWith('-rl');

	return { inline: 'y', block: 'x', inlineReversed, blockReversed };
}

export function isScrollCapableOverflow(value: string): boolean {
	return value === 'auto' || value === 'scroll' || value === 'overlay';
}

function physicalMetrics(
	element: HTMLElement,
	physicalAxis: PhysicalScrollAxis
): { clientExtent: number; contentExtent: number; offset: number; overflow: string } {
	const computedStyle = getComputedStyle(element);
	if (physicalAxis === 'x') {
		return {
			clientExtent: element.clientWidth,
			contentExtent: element.scrollWidth,
			offset: element.scrollLeft,
			overflow: computedStyle.overflowX
		};
	}
	return {
		clientExtent: element.clientHeight,
		contentExtent: element.scrollHeight,
		offset: element.scrollTop,
		overflow: computedStyle.overflowY
	};
}

function isMeasurable(element: HTMLElement, computedStyle: CSSStyleDeclaration): boolean {
	return (
		element.isConnected &&
		computedStyle.display !== 'none' &&
		element.clientWidth > 0 &&
		element.clientHeight > 0
	);
}

export function measureLogicalOverflowGeometry(
	element: HTMLElement,
	logicalAxis: LogicalScrollAxis,
	mapping: LogicalAxisMapping
): boolean | null {
	const computedStyle = getComputedStyle(element);
	if (!isMeasurable(element, computedStyle)) return null;

	const physicalAxis = mapping[logicalAxis];
	const clientExtent = physicalAxis === 'x' ? element.clientWidth : element.clientHeight;
	const contentExtent = physicalAxis === 'x' ? element.scrollWidth : element.scrollHeight;
	return contentExtent - clientExtent > SCROLL_OVERFLOW_TOLERANCE;
}

function logicalEdges(
	offset: number,
	maxOffset: number,
	isReversed: boolean
): { atStart: boolean; atEnd: boolean } {
	const logicalOffset = Math.min(maxOffset, Math.max(0, isReversed ? Math.abs(offset) : offset));
	return {
		atStart: logicalOffset <= SCROLL_OVERFLOW_TOLERANCE,
		atEnd: logicalOffset >= maxOffset - SCROLL_OVERFLOW_TOLERANCE
	};
}

export function measureLogicalScrollAxis(
	element: HTMLElement,
	logicalAxis: LogicalScrollAxis,
	mapping: LogicalAxisMapping
): MeasuredScrollAxisState | null {
	const computedStyle = getComputedStyle(element);
	if (!isMeasurable(element, computedStyle)) return null;

	const physicalAxis = mapping[logicalAxis];
	const metrics = physicalMetrics(element, physicalAxis);
	const maxOffset = metrics.contentExtent - metrics.clientExtent;
	if (!isScrollCapableOverflow(metrics.overflow) || maxOffset <= SCROLL_OVERFLOW_TOLERANCE) {
		return INACTIVE_AXIS_STATE;
	}

	return {
		isScrollable: true,
		...logicalEdges(metrics.offset, maxOffset, mapping[`${logicalAxis}Reversed`])
	};
}

/** Where a scroll left one logical axis, read from geometry alone. */
export interface LogicalScrollPosition {
	overflows: boolean;
	atStart: boolean;
	atEnd: boolean;
	contradictsMapping: boolean;
}

/**
 * Reads one logical axis after a scroll without reading computed style. Only
 * box geometry is read, which stays clean during a scroll.
 */
export function measureLogicalScrollPosition(
	element: HTMLElement,
	logicalAxis: LogicalScrollAxis,
	mapping: LogicalAxisMapping
): LogicalScrollPosition | null {
	if (!element.isConnected || element.clientWidth <= 0 || element.clientHeight <= 0) {
		return null;
	}
	const isX = mapping[logicalAxis] === 'x';
	const isReversed = mapping[`${logicalAxis}Reversed`];
	const offset = isX ? element.scrollLeft : element.scrollTop;
	const maxOffset = isX
		? element.scrollWidth - element.clientWidth
		: element.scrollHeight - element.clientHeight;
	return {
		overflows: maxOffset > SCROLL_OVERFLOW_TOLERANCE,
		...logicalEdges(offset, maxOffset, isReversed),
		contradictsMapping: isReversed
			? offset > SCROLL_OVERFLOW_TOLERANCE
			: offset < -SCROLL_OVERFLOW_TOLERANCE
	};
}
