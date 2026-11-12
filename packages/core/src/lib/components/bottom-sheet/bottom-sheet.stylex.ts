import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, durationVars, easeVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `BottomSheet/BottomSheet.tsx` styles.
 *
 * The dialog shell around the panel: the native `<dialog>` reset, the scrim on
 * its `::backdrop`, and the positioner that pins the sheet to the block end.
 * The sheet surface itself lives in `bottom-sheet-panel.stylex.ts`.
 */

const styles = stylex.create({
	dialog: {
		position: 'fixed',
		inset: 0,
		width: '100dvw',
		height: '100dvh',
		maxWidth: 'none',
		maxHeight: 'none',
		margin: 0,
		padding: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		overflow: 'visible',
		display: 'none',
		outline: 'none'
	},
	dialogOpen: {
		display: 'block'
	},
	// An open dialog is the panel's positioner: the panel sits at its block end,
	// centred, with no wrapper. A tap beside a narrower panel lands on the
	// dialog, which light dismiss reads. A flex row, not a grid: WebKit lays a
	// grid host out again on each render inside the sheet.
	dialogPanelHost: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'flex-end'
	},
	// A non-modal sheet is in the top layer as a manual popover, so it has no
	// page z-index (AST-027). Below the Popover API floor, `show()` leaves it
	// in page stacking order as a reduced fallback.
	dialogNonModal: {
		pointerEvents: 'none',
		width: '100%',
		height: '100%'
	},
	// A no-scrim switcher flow is in the normal rendering tree below the
	// Popover API floor, where DOM order would decide which dialog paints in
	// front. Upstream's flow wrapper keeps the overlay value of the old shared
	// shell; this port has one shared dialog, so it takes that value itself.
	flowNonModal: {
		zIndex: 1000
	},
	// The per-sheet dialog a 0.7.13 switcher renders for each step.
	dialogNonModalItem: {
		pointerEvents: 'none',
		width: '100%',
		height: '100%'
	},
	dialogNonModalItemTop: {
		zIndex: 1
	},
	scrim: {
		'::backdrop': {
			backgroundColor: colorVars['--color-overlay'],
			opacity: {
				default: 'var(--_sheet-scrim-opacity, 1)',
				'@starting-style': 0
			},
			transitionProperty: 'opacity, display',
			// The scrim changes hands between stacked sheets with no fade at all:
			// the host pins this to 0s inline for the frame the change lands in.
			// Reduced motion keeps the pin too.
			transitionDuration: `var(--_sheet-scrim-duration, ${durationVars['--duration-medium']})`,
			transitionTimingFunction: easeVars['--ease-standard'],
			transitionBehavior: 'allow-discrete',
			'@media (prefers-reduced-motion: reduce)': {
				transitionDuration: 'var(--_sheet-scrim-duration, 0.01s)'
			}
		}
	},
	// A sheet present on page load dims at once (AST-013 FR13), with the
	// reduced-motion collapse, so the transition still ends.
	scrimSettled: {
		'::backdrop': {
			transitionDuration: '0.01s'
		}
	},
	/**
	 * The dim leaves with the sheet, on a curve that matches.
	 *
	 * A fade covers no distance, so the decelerate token front-loads its progress
	 * and simply ends it early: `--ease-standard` puts the scrim at 90% faded in
	 * 163ms of a 410ms close, leaving an undimmed page under a sheet that is still
	 * sliding across it. `linear` spends the duration it is given. Same reasoning
	 * the touch date picker's surface swap already carries.
	 *
	 * Shared with `BottomSheetSwitcher`, where the flow's dim leaves with its last
	 * panel — a handoff between two sheets is not a close, and keeps the entrance
	 * curve.
	 */
	scrimClosing: {
		'::backdrop': {
			transitionTimingFunction: 'linear'
		}
	},
	// A closing sheet that keeps focus takes no pointer input during its exit.
	exitHoldingFocus: {
		pointerEvents: 'none'
	},
	positioner: {
		position: 'absolute',
		insetInline: 0,
		insetBlockEnd: 0,
		display: 'flex',
		justifyContent: 'center',
		pointerEvents: 'none'
	},
	positionerHidden: {
		display: 'none'
	},
	positionerTop: {
		zIndex: 1
	},
	// A sheet in a stack recedes and returns with CSS motion only; the style
	// stays on while another sheet is presented so the return animates too.
	// On a standalone sheet these apply to the dialog itself (its panel's
	// positioner); on a switcher step, to the step's positioner.
	positionerStackMotion: {
		transformOrigin: '50% 0',
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-medium'],
		transitionTimingFunction: easeVars['--ease-standard'],
		'@media (prefers-reduced-motion: reduce)': {
			transitionDuration: '0.01s'
		}
	},
	// Covered sheets recede behind the top sheet: the nearest shrinks a step
	// about its top edge and lifts, the next shrinks a second step; deeper
	// sheets share that second step.
	positionerReceded1: {
		transform: `translateY(calc(-1 * ${spacingVars['--spacing-2']})) scale(0.96)`
	},
	positionerReceded2: {
		transform: `translateY(calc(-2 * ${spacingVars['--spacing-2']})) scale(0.92)`
	}
});

/** A sheet's place in the 0.7.13 presentation stack. */
export interface BottomSheetStackView {
	readonly isStacked: boolean;
	/** 0 for a lone sheet, 1 for the nearest covered sheet, 2+ deeper. */
	readonly depth: number;
}

/** Positioner styles for a sheet's place in the stack; the switcher items share them. */
export function bottomSheetStackPositionerStyles(view: BottomSheetStackView) {
	return [
		view.isStacked && styles.positionerStackMotion,
		view.depth === 1 && styles.positionerReceded1,
		view.depth >= 2 && styles.positionerReceded2
	] as const;
}

/**
 * The 0.7.13 switcher renders a `<dialog>` per step, and a non-modal flow's
 * step gets the item styles instead of the shared dialog's.
 */
export function bottomSheetSwitcherDialogAttrs(
	isPresented: boolean,
	hasScrim: boolean,
	isEntrySettled: boolean,
	isScrimClosing: boolean,
	isTopSheet: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.dialog,
		isPresented && styles.dialogOpen,
		hasScrim && styles.scrim,
		hasScrim && isEntrySettled && styles.scrimSettled,
		hasScrim && isScrimClosing && styles.scrimClosing,
		!hasScrim && styles.dialogNonModalItem,
		!hasScrim && isTopSheet && styles.dialogNonModalItemTop,
		xstyle
	);
}

/**
 * The native `<dialog>` shell. `hasScrim` is what makes the dialog modal, so it
 * selects the scrim and the non-modal layering between them. `isScrimClosing`
 * is the host's own reading of "the dim is on its way out": the standalone
 * sheet's is `!isOpen && isPresented`, the switcher's is `isFlowVisible &&
 * activeSheet == null`.
 *
 * Shared with `BottomSheetSwitcher`, which declares the same six style keys in
 * its own file upstream — identical properties, identical token references, and
 * so identical atomic classes. One module here rather than a byte-for-byte
 * duplicate: the emitted CSS is the same either way, and the oracles check the
 * output, not the file layout. `xstyle` is threaded because the switcher applies
 * a consumer override to the dialog itself, where a standalone sheet applies it
 * to the panel.
 */
export interface BottomSheetDialogState {
	/** The sheet was present on load, so its dim settles at once (AST-013 FR13). */
	isEntrySettled?: boolean;
	/** The closing sheet still holds focus, so it takes no pointer input. */
	isExitHoldingFocus?: boolean;
	/** The shared dialog is a no-scrim switcher flow, which needs its own order. */
	isSwitcherFlow?: boolean;
}

export function bottomSheetDialogAttrs(
	isPresented: boolean,
	hasScrim: boolean,
	isScrimClosing: boolean,
	xstyle?: StyleArg,
	state: BottomSheetDialogState = {}
): SvelteStyleAttrs {
	return sx(
		styles.dialog,
		isPresented && styles.dialogOpen,
		isPresented && styles.dialogPanelHost,
		hasScrim && styles.scrim,
		hasScrim && state.isEntrySettled && styles.scrimSettled,
		hasScrim && isScrimClosing && styles.scrimClosing,
		state.isExitHoldingFocus && styles.exitHoldingFocus,
		!hasScrim && styles.dialogNonModal,
		!hasScrim && state.isSwitcherFlow && styles.flowNonModal,
		xstyle
	);
}

/** The block-end positioner the panel sits in. */
export function bottomSheetPositionerAttrs(
	isHidden: boolean,
	isTop: boolean,
	stackView?: BottomSheetStackView
): SvelteStyleAttrs {
	return sx(
		styles.positioner,
		isHidden && styles.positionerHidden,
		isTop && styles.positionerTop,
		...(stackView != null ? bottomSheetStackPositionerStyles(stackView) : [])
	);
}
