import { Context } from '../../internal/context.js';

/**
 * Ported from Astryx's `BottomSheet/bottomSheetEscape.ts`.
 *
 * Whether Escape (and the platform's close request) may dismiss the standalone
 * sheet below it. Popover's sheet presentation passes its `hasEscapeDismiss`
 * through this context, so the sheet can always light-dismiss (a scrim tap or a
 * swipe down) while Escape stays off. A standalone BottomSheet reads the
 * default (`true`), so its `purpose` rule is unchanged.
 *
 * Internal to core: not exported from the package or any barrel.
 */

export interface BottomSheetEscapeContextValue {
	/** Whether Escape may dismiss; `purpose="required"` still blocks it. */
	readonly isEscapeAllowed: boolean;
}

const BottomSheetEscapeContext = new Context<BottomSheetEscapeContextValue>(
	'astryx.bottom-sheet-escape'
);

/**
 * Provides the Escape policy to the sheet this component renders. `isAllowed`
 * is read through a getter, so a prop change reaches the consumer.
 */
export function setBottomSheetEscape(isAllowed: () => boolean): void {
	BottomSheetEscapeContext.set({
		get isEscapeAllowed() {
			return isAllowed();
		}
	});
}

/** The nearest sheet's Escape policy, or null when nothing provides one. */
export function useBottomSheetEscape(): BottomSheetEscapeContextValue | null {
	return BottomSheetEscapeContext.getOr(null);
}
