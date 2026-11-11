import { untrack } from 'svelte';
import { createAttachmentKey, type Attachment } from 'svelte/attachments';
import type { BaseProps } from '../base-props.js';
import { cx, mergeStyle, sx, type StyleArg } from '../internal/sx.js';
import { observeResize } from '../internal/shared-resize-observer.js';
import { scrollableAreaOverflowStyles } from './use-scrollable-area.stylex.js';
import { attachScrollKeyboardDelegation } from './scroll-keyboard-delegation.js';
import {
	getLogicalAxisMapping,
	measureLogicalOverflowGeometry,
	measureLogicalScrollAxis,
	measureLogicalScrollPosition,
	type LogicalAxisMapping,
	type LogicalOverflowGeometry
} from './scroll-geometry.js';
import { publishScrollGeometry } from './scroll-geometry-subscriptions.js';
import { registerScrollOwner, unregisterScrollOwner } from './scroll-owner-registry.js';

/** Logical axis or axes where native scrolling is requested. */
export type ScrollAxis = 'inline' | 'block' | 'both';
/** Whether effective axes pass scroll gestures to ancestors at an edge. */
export type ScrollOverscroll = 'allow' | 'contain';
/** Whether a fitting viewport deliberately remains a Sticky containing boundary. */
export type ScrollStickyContainment = 'whenScrollable' | 'always';

/**
 * Where keyboard scrolling is reached: caller-owned content, a named viewport,
 * or a named viewport that delegates forward Tab entry into its content.
 */
export type ScrollKeyboardAccess =
	| { owner: 'content' }
	| { owner: 'viewport'; label: string; role?: 'group' | 'region' }
	| { owner: 'contentOrViewport'; label: string; role?: 'group' | 'region' };

/** Effective ownership and logical edge state for one requested axis. */
export interface ScrollAxisState {
	isScrollable: boolean;
	atStart: boolean;
	atEnd: boolean;
}

/** Per-axis effective scroll state published by the hook. */
export interface ScrollableAreaState {
	inline: ScrollAxisState;
	block: ScrollAxisState;
}

export interface UseScrollableAreaOptions {
	/** Logical axis or axes where scrolling is allowed. */
	axis: ScrollAxis;
	/** Keyboard reachability owner; a named viewport joins the tab order while effective. */
	keyboardAccess: ScrollKeyboardAccess;
	/** Edge propagation on effective axes. @default 'allow' */
	overscroll?: ScrollOverscroll;
	/** Sticky containment while fitting. @default 'whenScrollable' */
	stickyContainment?: ScrollStickyContainment;
}

/** Props a caller can spread onto the viewport or content box. */
export type ScrollableElementProps<E extends HTMLElement = HTMLElement> = BaseProps<E> & {
	readonly [key: symbol]: unknown;
};

export interface UseScrollableAreaResult {
	getViewportProps<E extends HTMLElement>(
		props?: ScrollableElementProps<E>
	): ScrollableElementProps<E>;
	getContentProps<E extends HTMLElement>(
		props?: ScrollableElementProps<E>
	): ScrollableElementProps<E>;
	readonly state: ScrollableAreaState;
}

const INACTIVE_AXIS_STATE: ScrollAxisState = {
	isScrollable: false,
	atStart: true,
	atEnd: true
};
const INITIAL_STATE: ScrollableAreaState = {
	inline: INACTIVE_AXIS_STATE,
	block: INACTIVE_AXIS_STATE
};
const INITIAL_OVERFLOW: LogicalOverflowGeometry = { inline: false, block: false };
const INITIAL_MAPPING: LogicalAxisMapping = {
	inline: 'x',
	block: 'y',
	inlineReversed: false,
	blockReversed: false
};
const LOGICAL_AXES = ['inline', 'block'] as const;

const ANCESTOR_STYLE_PROPERTIES = [
	'direction',
	'writing-mode',
	'display',
	'visibility',
	'content-visibility'
] as const;

function inlineDeclaration(cssText: string | null, property: string): string | null {
	if (cssText == null || !cssText.includes(property)) return null;
	const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]*)`, 'i').exec(cssText);
	return match == null ? null : match[1].trim();
}

function inlineStyleChangesMapping(before: string | null, after: string | null): boolean {
	if (before === after) return false;
	return ANCESTOR_STYLE_PROPERTIES.some(
		(property) => inlineDeclaration(before, property) !== inlineDeclaration(after, property)
	);
}

function axisIsRequested(requested: ScrollAxis, axis: 'inline' | 'block'): boolean {
	return requested === axis || requested === 'both';
}

function statesEqual(a: ScrollableAreaState, b: ScrollableAreaState): boolean {
	return (
		a.inline.isScrollable === b.inline.isScrollable &&
		a.inline.atStart === b.inline.atStart &&
		a.inline.atEnd === b.inline.atEnd &&
		a.block.isScrollable === b.block.isScrollable &&
		a.block.atStart === b.block.atStart &&
		a.block.atEnd === b.block.atEnd
	);
}

function overflowEqual(a: LogicalOverflowGeometry, b: LogicalOverflowGeometry): boolean {
	return a.inline === b.inline && a.block === b.block;
}

function mappingsEqual(a: LogicalAxisMapping, b: LogicalAxisMapping): boolean {
	return (
		a.inline === b.inline &&
		a.block === b.block &&
		a.inlineReversed === b.inlineReversed &&
		a.blockReversed === b.blockReversed
	);
}

/** Strip the overflow declarations this hook owns from a caller style string. */
function withoutOwnedOverflow(style: string | undefined): string | undefined {
	if (!style) return undefined;
	const kept = style
		.split(';')
		.filter((part) => !/^\s*overflow(?:-(?:x|y|inline|block))?\s*:/.test(part));
	return kept.join(';').trim() || undefined;
}

/**
 * Axis-aware native scrolling over caller-owned viewport and content boxes,
 * ported from Astryx's `hooks/useScrollableArea.ts`.
 *
 * Upstream returns React prop getters; this port returns the same two getter
 * names, and each bag carries a Svelte attachment under a stable
 * `createAttachmentKey()` symbol. Svelte has no ref object, so the attachment
 * is the ref callback's exact lifecycle counterpart: it receives the element on
 * mount, replaces it when the node changes, and returns its teardown.
 *
 * Options arrive as a getter so `axis`, `keyboardAccess`, `overscroll` and
 * `stickyContainment` stay live, following `useTooltip` and
 * `useClickableContainer`. Upstream's `useCallback` dependency arrays collapse
 * into the getter reads.
 */
export function useScrollableArea(
	options: () => UseScrollableAreaOptions
): UseScrollableAreaResult {
	const viewportAttachmentKey = createAttachmentKey();
	const contentAttachmentKey = createAttachmentKey();

	let viewport = $state<HTMLElement | null>(null);
	let content = $state<HTMLElement | null>(null);
	let measured = $state<ScrollableAreaState>(INITIAL_STATE);
	let overflow = $state<LogicalOverflowGeometry>(INITIAL_OVERFLOW);
	let mapping = $state<LogicalAxisMapping>(INITIAL_MAPPING);
	let isViewportFocused = $state(false);
	let measureNow: (() => void) | null = null;
	let previousOverflow = INITIAL_OVERFLOW;
	let previousMapping = INITIAL_MAPPING;

	const state = $derived<ScrollableAreaState>({
		inline: axisIsRequested(options().axis, 'inline') ? measured.inline : INACTIVE_AXIS_STATE,
		block: axisIsRequested(options().axis, 'block') ? measured.block : INACTIVE_AXIS_STATE
	});

	const attachViewport: Attachment<HTMLElement> = (node) => {
		viewport = node;
		// A focusin is a user or programmatic focus on a live node, so it can be
		// recorded in the handler. A focusout is also the last event a removing
		// branch fires, during the teardown where Svelte forbids a state write, so
		// that one is deferred past the commit and re-reads the document.
		const handleFocusIn = () => {
			if (!node.isConnected) return;
			isViewportFocused = true;
		};
		const handleFocusOut = () => {
			queueMicrotask(() => {
				if (!node.isConnected || viewport !== node) return;
				isViewportFocused = node.ownerDocument.activeElement === node;
			});
		};
		isViewportFocused = node.ownerDocument.activeElement === node;
		node.addEventListener('focusin', handleFocusIn);
		node.addEventListener('focusout', handleFocusOut);
		return () => {
			node.removeEventListener('focusin', handleFocusIn);
			node.removeEventListener('focusout', handleFocusOut);
			isViewportFocused = false;
			viewport = null;
		};
	};

	const attachContent: Attachment<HTMLElement> = (node) => {
		content = node;
		return () => {
			content = null;
		};
	};

	$effect(() => {
		const viewportElement = viewport;
		const contentElement = content;
		const { axis } = options();
		if (viewportElement == null || contentElement == null) {
			measureNow = null;
			return;
		}

		let frame: number | null = null;
		let isActive = true;
		let measuredMapping = INITIAL_MAPPING;
		let measuredOverflow = INITIAL_OVERFLOW;
		let hasContentInvalidation = true;
		let hasLayoutInvalidation = true;

		const publish = (nextState: ScrollableAreaState) => {
			registerScrollOwner(viewportElement, nextState);
			if (!statesEqual(measured, nextState)) measured = nextState;
		};

		const measureNowFn = () => {
			const computedStyle = getComputedStyle(viewportElement);
			const nextMapping = getLogicalAxisMapping(computedStyle.writingMode, computedStyle.direction);
			const inlineOverflow = axisIsRequested(axis, 'inline')
				? measureLogicalOverflowGeometry(viewportElement, 'inline', nextMapping)
				: false;
			const blockOverflow = axisIsRequested(axis, 'block')
				? measureLogicalOverflowGeometry(viewportElement, 'block', nextMapping)
				: false;
			const inline = axisIsRequested(axis, 'inline')
				? measureLogicalScrollAxis(viewportElement, 'inline', nextMapping)
				: INACTIVE_AXIS_STATE;
			const block = axisIsRequested(axis, 'block')
				? measureLogicalScrollAxis(viewportElement, 'block', nextMapping)
				: INACTIVE_AXIS_STATE;

			// Hidden, disconnected and zero-size viewports are unknown rather than
			// fitting. Keep the last valid state until a bounded signal remeasures.
			if (inlineOverflow == null || blockOverflow == null || inline == null || block == null) {
				return;
			}

			if (!inline.isScrollable && !block.isScrollable) {
				isViewportFocused = viewportElement.ownerDocument.activeElement === viewportElement;
			}

			const nextOverflow = { inline: inlineOverflow, block: blockOverflow };
			measuredMapping = nextMapping;
			measuredOverflow = nextOverflow;
			if (!overflowEqual(overflow, nextOverflow)) overflow = nextOverflow;
			publish({ inline, block });
			publishScrollGeometry(viewportElement, hasContentInvalidation, hasLayoutInvalidation);
			hasContentInvalidation = false;
			hasLayoutInvalidation = false;
			if (!mappingsEqual(mapping, nextMapping)) mapping = nextMapping;
		};
		measureNow = measureNowFn;

		const measure = () => {
			frame = null;
			measureNowFn();
		};
		const scheduleMeasure = () => {
			if (!isActive || frame != null) return;
			frame = window.requestAnimationFrame(measure);
		};

		const onScroll = () => {
			if (!isActive || frame != null) return;
			const current = measured;
			let next = current;
			for (const logicalAxis of LOGICAL_AXES) {
				if (!axisIsRequested(axis, logicalAxis)) continue;
				const position = measureLogicalScrollPosition(
					viewportElement,
					logicalAxis,
					measuredMapping
				);
				if (position == null) return;
				if (position.overflows !== measuredOverflow[logicalAxis] || position.contradictsMapping) {
					scheduleMeasure();
					return;
				}
				const axisState = current[logicalAxis];
				if (
					!axisState.isScrollable ||
					(axisState.atStart === position.atStart && axisState.atEnd === position.atEnd)
				) {
					continue;
				}
				next = {
					...next,
					[logicalAxis]: {
						isScrollable: true,
						atStart: position.atStart,
						atEnd: position.atEnd
					}
				};
			}
			if (next !== current) publish(next);
			publishScrollGeometry(viewportElement);
		};

		const scheduleContentMeasure = () => {
			hasContentInvalidation = true;
			scheduleMeasure();
		};
		const scheduleLayoutMeasure = () => {
			hasLayoutInvalidation = true;
			scheduleContentMeasure();
		};

		const isUnmappedAncestorStyle = (record: MutationRecord) => {
			const target = record.target;
			return (
				record.type === 'attributes' &&
				record.attributeName === 'style' &&
				target instanceof Element &&
				!viewportElement.contains(target) &&
				!contentElement.contains(target) &&
				!inlineStyleChangesMapping(record.oldValue, target.getAttribute('style'))
			);
		};
		const onMutations = (records: MutationRecord[]) => {
			const counted = records.filter((record) => !isUnmappedAncestorStyle(record));
			if (counted.length === 0) return;
			if (
				counted.some(
					(record) => record.target === contentElement || !contentElement.contains(record.target)
				)
			) {
				scheduleLayoutMeasure();
			} else {
				scheduleContentMeasure();
			}
		};

		registerScrollOwner(viewportElement, measured);
		measure();
		const stopObservingViewport = observeResize(viewportElement, scheduleLayoutMeasure);
		const stopObservingContent = observeResize(contentElement, scheduleLayoutMeasure);

		viewportElement.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', scheduleMeasure);
		window.visualViewport?.addEventListener('resize', scheduleMeasure);
		contentElement.addEventListener('load', scheduleMeasure, true);
		viewportElement.addEventListener('transitionend', scheduleMeasure);
		viewportElement.addEventListener('animationend', scheduleMeasure);
		contentElement.addEventListener('transitionend', scheduleMeasure);
		contentElement.addEventListener('animationend', scheduleMeasure);

		const mutationObserver =
			typeof MutationObserver === 'undefined' ? null : new MutationObserver(onMutations);
		mutationObserver?.observe(viewportElement, {
			attributes: true,
			attributeFilter: ['class', 'dir', 'hidden', 'style']
		});
		mutationObserver?.observe(contentElement, {
			attributes: true,
			attributeFilter: ['class', 'dir', 'hidden', 'style'],
			characterData: true,
			childList: true,
			subtree: true
		});
		let ancestor = viewportElement.parentElement;
		while (ancestor != null) {
			mutationObserver?.observe(ancestor, {
				attributes: true,
				attributeFilter: ['class', 'dir', 'hidden', 'style'],
				attributeOldValue: true
			});
			ancestor = ancestor.parentElement;
		}

		const fonts = document.fonts;
		fonts?.addEventListener?.('loadingdone', scheduleLayoutMeasure);
		void fonts?.ready.then(scheduleLayoutMeasure);

		return () => {
			isActive = false;
			measureNow = null;
			unregisterScrollOwner(viewportElement);
			stopObservingViewport();
			stopObservingContent();
			mutationObserver?.disconnect();
			viewportElement.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', scheduleMeasure);
			window.visualViewport?.removeEventListener('resize', scheduleMeasure);
			contentElement.removeEventListener('load', scheduleMeasure, true);
			viewportElement.removeEventListener('transitionend', scheduleMeasure);
			viewportElement.removeEventListener('animationend', scheduleMeasure);
			contentElement.removeEventListener('transitionend', scheduleMeasure);
			contentElement.removeEventListener('animationend', scheduleMeasure);
			fonts?.removeEventListener?.('loadingdone', scheduleLayoutMeasure);
			if (frame != null) window.cancelAnimationFrame(frame);
		};
	});

	// An overflowing mount is measured once in the effect; the gain of an axis,
	// or a writing-mode change, needs one same-commit remeasure so the viewport
	// is a tab stop from the first frame it scrolls.
	$effect(() => {
		const current = overflow;
		const currentMapping = mapping;
		const hasGainedOverflow =
			(current.inline && !previousOverflow.inline) || (current.block && !previousOverflow.block);
		const hasRemapped = !mappingsEqual(currentMapping, previousMapping);
		previousOverflow = current;
		previousMapping = currentMapping;
		if (hasGainedOverflow || hasRemapped) {
			untrack(() => measureNow?.());
		}
	});

	const keyboardAccess = $derived(options().keyboardAccess);
	const hasEffectiveAxis = $derived(state.inline.isScrollable || state.block.isScrollable);
	$effect(() => {
		if (keyboardAccess.owner !== 'contentOrViewport' || !hasEffectiveAxis) return;
		if (viewport == null || content == null) return;
		return attachScrollKeyboardDelegation(viewport, content);
	});

	function getViewportProps<E extends HTMLElement>(
		props: ScrollableElementProps<E> = {}
	): ScrollableElementProps<E> {
		const {
			axis,
			overscroll = 'allow',
			stickyContainment = 'whenScrollable',
			keyboardAccess: access
		} = options();
		const currentState = state;
		const currentMapping = mapping;
		const currentOverflow = overflow;
		const hasEffective = currentState.inline.isScrollable || currentState.block.isScrollable;
		const requestedX =
			(axisIsRequested(axis, 'inline') && currentMapping.inline === 'x') ||
			(axisIsRequested(axis, 'block') && currentMapping.block === 'x');
		const requestedY =
			(axisIsRequested(axis, 'inline') && currentMapping.inline === 'y') ||
			(axisIsRequested(axis, 'block') && currentMapping.block === 'y');
		const overflowingX =
			(currentOverflow.inline && currentMapping.inline === 'x') ||
			(currentOverflow.block && currentMapping.block === 'x');
		const overflowingY =
			(currentOverflow.inline && currentMapping.inline === 'y') ||
			(currentOverflow.block && currentMapping.block === 'y');
		const containsSticky = overflowingX || overflowingY || stickyContainment === 'always';
		const scrollsOnX = stickyContainment === 'always' ? requestedX : overflowingX;
		const scrollsOnY = stickyContainment === 'always' ? requestedY : overflowingY;
		const {
			xstyle,
			class: callerClass,
			style: callerStyle,
			...domProps
		} = props as ScrollableElementProps<E> & { xstyle?: StyleArg };
		const overflowStyle = scrollableAreaOverflowStyles(
			containsSticky ? (scrollsOnX ? 'auto' : 'hidden') : 'clip',
			containsSticky ? (scrollsOnY ? 'auto' : 'hidden') : 'clip'
		);
		const styled = sx(overflowStyle, xstyle);
		const mayHoldFocus =
			isViewportFocused ||
			(axisIsRequested(axis, 'inline') && measured.inline.isScrollable) ||
			(axisIsRequested(axis, 'block') && measured.block.isScrollable);
		const behavior: string[] = [];
		if (axisIsRequested(axis, 'inline')) {
			behavior.push(
				`${currentMapping.inline === 'x' ? 'overscroll-behavior-x' : 'overscroll-behavior-y'}: ${
					overscroll === 'contain' && currentState.inline.isScrollable ? 'contain' : 'auto'
				}`
			);
		}
		if (axisIsRequested(axis, 'block')) {
			behavior.push(
				`${currentMapping.block === 'x' ? 'overscroll-behavior-x' : 'overscroll-behavior-y'}: ${
					overscroll === 'contain' && currentState.block.isScrollable ? 'contain' : 'auto'
				}`
			);
		}
		const keyboardProps =
			access.owner !== 'content'
				? {
						role: access.role ?? 'group',
						'aria-label': access.label,
						tabindex: hasEffective ? 0 : mayHoldFocus ? -1 : undefined
					}
				: {};
		const result = {
			...domProps,
			...keyboardProps,
			[viewportAttachmentKey]: attachViewport,
			class: cx(styled.class, callerClass),
			style: mergeStyle(
				styled.style,
				withoutOwnedOverflow(callerStyle as string | undefined),
				behavior.join(';')
			),
			'data-scroll-axis': axis,
			'data-scrollable-inline': currentState.inline.isScrollable ? 'true' : undefined,
			'data-scrollable-block': currentState.block.isScrollable ? 'true' : undefined,
			'data-scroll-inline-start': currentState.inline.atStart ? 'true' : undefined,
			'data-scroll-inline-end': currentState.inline.atEnd ? 'true' : undefined,
			'data-scroll-block-start': currentState.block.atStart ? 'true' : undefined,
			'data-scroll-block-end': currentState.block.atEnd ? 'true' : undefined
		};
		return result as ScrollableElementProps<E>;
	}

	function getContentProps<E extends HTMLElement>(
		props: ScrollableElementProps<E> = {}
	): ScrollableElementProps<E> {
		const {
			xstyle,
			class: callerClass,
			style: callerStyle,
			...domProps
		} = props as ScrollableElementProps<E> & { xstyle?: StyleArg };
		const styled = sx(xstyle);
		return {
			...domProps,
			[contentAttachmentKey]: attachContent,
			class: cx(styled.class, callerClass),
			style: mergeStyle(styled.style, callerStyle as string | undefined),
			'data-scroll-content': ''
		} as ScrollableElementProps<E>;
	}

	return {
		getViewportProps,
		getContentProps,
		get state() {
			return state;
		}
	};
}
