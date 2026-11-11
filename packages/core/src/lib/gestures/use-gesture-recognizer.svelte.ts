import { getGestureHost } from './gesture-host.js';
import type { GestureRecognizer } from './gesture-recognizer.js';
import { isSyncingGestures, syncingGestures } from './gesture-sync.svelte.js';
import { internals } from './recognizer-internals.js';

/**
 * Ported from Astryx's `gestures/useGestureRecognizer.ts`.
 *
 * The React hook keeps one recognizer for the component's life, reads its
 * listener through a ref, and attaches in a layout effect. This port takes an
 * element getter (every rune hook's shape), keeps the recognizer at
 * initialisation, reads the newest listener through an effect-updated box,
 * and attaches in an effect that re-runs on the element, enabled state,
 * manage-style and action-group flags.
 */

export interface UseGestureRecognizerOptions {
	/**
	 * Live toggle; turning it off mid-gesture cancels the gesture without
	 * calling `onGesture`.
	 * @default true
	 */
	isEnabled?: boolean;
	/** Let the host set touch-action (and long-press callout) styles. @default true */
	manageStyle?: boolean;
	/** Accepted and ignored: every attachment reads each event's pointer. */
	perEventPointer?: boolean;
	/**
	 * The element is an action group, sibling actions a held pointer slides
	 * across: the host serves it where the primary pointer is fine too.
	 * @default false
	 */
	actionGroup?: boolean;
}

/**
 * Runs `body` with the arena leaving what it unblocks to the next pass,
 * outside the effect. A recognizer that has met no touch has no arena.
 */
function deferringResolution(recognizer: GestureRecognizer, body: () => void): void {
	const arena = internals(recognizer).arena;
	if (arena == null) {
		body();
		return;
	}
	arena.deferResolution(body);
}

/**
 * Attach a recognizer to the element `getElement` returns.
 *
 * The recognizer is created once, so relationships set at creation
 * (`requireToFail`, `recognizeSimultaneouslyWith`) hold for the component's
 * life. A new `onGesture` function re-attaches nothing.
 */
export function useGestureRecognizer<R extends GestureRecognizer>(
	getElement: () => Element | null,
	create: () => R,
	onGesture?: (recognizer: R) => void,
	options: UseGestureRecognizerOptions = {}
): R {
	const recognizer = create();
	let latestOnGesture = onGesture;
	let isUnmounted = false;

	$effect(() => {
		latestOnGesture = onGesture;
	});

	$effect(() => {
		const stop = recognizer.addListener((current) => {
			if (!isUnmounted && !isSyncingGestures()) latestOnGesture?.(current);
		});
		return () => {
			isUnmounted = true;
			stop();
		};
	});

	$effect(() => {
		const isEnabled = options.isEnabled ?? true;
		syncingGestures(() =>
			deferringResolution(recognizer, () => {
				recognizer.setEnabled(isEnabled);
			})
		);
	});

	$effect(() => {
		const element = getElement();
		const isEnabled = options.isEnabled ?? true;
		const manageStyle = options.manageStyle ?? true;
		const actionGroup = options.actionGroup ?? false;
		if (element == null || !isEnabled) {
			return;
		}
		const detach = getGestureHost(element.ownerDocument).attach(element, recognizer, {
			manageStyle,
			/* Accepted for source compatibility; the host reads each pointer. */
			perEventPointer: options.perEventPointer,
			actionGroup
		});
		return () => {
			syncingGestures(() => deferringResolution(recognizer, detach));
		};
	});

	return recognizer;
}
