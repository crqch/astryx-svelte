import { untrack } from 'svelte';
import { getGestureHost } from './gesture-host.js';
import { UIKIT_CONTROL } from '../motion/uikit/gestures.js';
import {
	createPressTracker,
	vetoesSingleTap,
	type PressTracker,
	type PressTrackerOptions
} from './press-tracker.js';
import { isSyncingGestures, syncingGestures } from './gesture-sync.svelte.js';

/**
 * Ported from Astryx's `gestures/usePressTracker.ts`.
 *
 * One tracker serves the component's life; the profile and callbacks are read
 * through the latest options, so a change applies from the tracker's next read
 * and never ends a press in progress. `keepsTouch` is the exception — it is
 * fixed at creation, as upstream documents, because it decides whether the host
 * gives the element a blocking touchmove.
 *
 * Releasing the element (unmount, or a replaced node) ends any press without
 * calling the caller back: that release runs in an effect, which never calls a
 * callback.
 */

export type UsePressTrackerOptions = Omit<PressTrackerOptions, 'getBounds' | 'view'> & {
	/** Accepted and ignored: every attachment reads each event's pointer. */
	perEventPointer?: boolean;
};

export function usePressTracker(
	getElement: () => Element | null,
	options: UsePressTrackerOptions = {}
): PressTracker {
	let isReleasing = false;
	let isUnmounted = false;

	const deliver = (call: () => void): void => {
		if (isReleasing || isUnmounted) return;
		if (!isSyncingGestures()) {
			call();
			return;
		}
		queueMicrotask(() => {
			if (!isUnmounted) call();
		});
	};

	// Mark unmounted before the later effects' cleanups release the tracker.
	$effect(() => {
		return () => {
			isUnmounted = true;
		};
	});

	const tracker = createPressTracker({
		getBounds: () => {
			const element = getElement();
			return element == null ? null : getGestureHost(element.ownerDocument).presentedRect(element);
		},
		get view() {
			return getElement();
		},
		onControlEvent: (event, touch) => deliver(() => options.onControlEvent?.(event, touch)),
		onHighlightChange: (isHighlighted) => deliver(() => options.onHighlightChange?.(isHighlighted)),
		trackingExpansion: options.trackingExpansion,
		get highlightDelay() {
			return options.highlightDelay;
		},
		get cancelTravel() {
			return options.cancelTravel;
		},
		get quickTapFlash() {
			return options.quickTapFlash;
		},
		keepsTouch: options.keepsTouch,
		get selectionLock() {
			return options.selectionLock;
		},
		vetoesAncestorRecognizer: (recognizer) =>
			(options.vetoesAncestorRecognizer ?? vetoesSingleTap)(recognizer),
		isEnabled: () => options.isEnabled?.() ?? true,
		holdsContextMenu: (id) => options.holdsContextMenu?.(id) === true,
		isBraking: (touch) => {
			const own = options.isBraking;
			if (own != null) return own(touch);
			const element = getElement();
			return element != null && getGestureHost(element.ownerDocument).isScrollBraking(element);
		}
	});

	$effect(() => {
		tracker.trackingExpansion = options.trackingExpansion ?? UIKIT_CONTROL.trackingExpansion.value;
	});

	// One attachment for the current element. The effect reacts to the element
	// only; a rerun that names the same node keeps the live attachment, so a
	// press survives an unrelated option change. A replaced node or a node that
	// leaves the document detaches and disposes the old one.
	let attachedElement: Element | null = null;
	let detachAttached: (() => void) | null = null;

	$effect(() => {
		const element = getElement();
		if (element === attachedElement) return;
		if (detachAttached != null) {
			isReleasing = true;
			try {
				detachAttached();
				tracker.dispose();
			} finally {
				isReleasing = false;
			}
			detachAttached = null;
			attachedElement = null;
		}
		if (element == null) return;
		// Deprecated and ignored by the host; read untracked so unrelated new
		// options do not touch the attachment.
		const perEventPointer = untrack(() => options.perEventPointer ?? false);
		attachedElement = element;
		detachAttached = getGestureHost(element.ownerDocument).attachConsumer(element, tracker, {
			perEventPointer
		});
	});

	$effect(() => {
		const element = getElement();
		const isEnabled = options.isEnabled?.() ?? true;
		isReleasing = true;
		try {
			if (tracker.isTracking && !isEnabled) tracker.dispose();
			if (element != null) {
				syncingGestures(() => getGestureHost(element.ownerDocument).update(element));
			}
		} finally {
			isReleasing = false;
		}
	});

	// The component going away ends a live press without calling back.
	$effect(() => {
		return () => {
			isUnmounted = true;
			isReleasing = true;
			try {
				detachAttached?.();
				detachAttached = null;
				attachedElement = null;
				tracker.dispose();
			} finally {
				isReleasing = false;
			}
		};
	});

	return tracker;
}
