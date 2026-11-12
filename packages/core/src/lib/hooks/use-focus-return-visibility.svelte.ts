/**
 * Ported from Astryx's `hooks/useFocusReturnVisibility.ts`.
 *
 * Preserves returned focus while suppressing pointer-only focus rings. Pass the
 * component's interaction-modality reader (upstream's
 * `InteractionModalityTracking.readModality`) so the ring follows the last input
 * in the element's own document.
 *
 * This port's `getInteractionModality` is a single document-level store rather
 * than upstream's per-document one; the read callback keeps the call sites
 * independent of that difference, so a later per-document store needs no change
 * here.
 */

import type { InteractionModality } from '../utils/interaction-modality.js';

export interface UseFocusReturnVisibilityOptions {
	readModality: () => InteractionModality;
}

export interface FocusReturnVisibilityState {
	readonly isFocusRingSuppressed: boolean;
	readonly onFocusReturnTargetFocus: () => void;
	readonly prepareFocusReturn: () => void;
	readonly resetFocusReturn: () => void;
}

export function useFocusReturnVisibility({
	readModality
}: UseFocusReturnVisibilityOptions): FocusReturnVisibilityState {
	let isFocusRingSuppressed = $state(false);

	const prepareFocusReturn = (): void => {
		isFocusRingSuppressed = readModality() === 'pointer';
	};

	const resetFocusReturn = (): void => {
		isFocusRingSuppressed = false;
	};

	const onFocusReturnTargetFocus = (): void => {
		if (readModality() === 'keyboard') {
			isFocusRingSuppressed = false;
		}
	};

	return {
		get isFocusRingSuppressed() {
			return isFocusRingSuppressed;
		},
		onFocusReturnTargetFocus,
		prepareFocusReturn,
		resetFocusReturn
	};
}
