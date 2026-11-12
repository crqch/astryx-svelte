import * as stylex from '@stylexjs/stylex';
import type { StyleArg } from '../../internal/sx.js';

/**
 * AlertDialog's styles, from Astryx's `AlertDialog/AlertDialog.tsx`.
 *
 * Upstream declares these inline in the component. The tracking row keeps the
 * browser from panning on the actions — Chrome on Android cancels a pointer it
 * pans, which would cancel the group's press — while the gesture host keeps an
 * author's narrower `touch-action`.
 */
const styles = stylex.create({
	trackingRow: {
		touchAction: 'pinch-zoom'
	},
	action: {
		maxWidth: '100%',
		minWidth: 0
	},
	stackedAction: {
		width: '100%'
	}
});

/** The actions row; tracking adds the browser's pan guard. */
export function alertDialogActionsXstyle(isTracking: boolean): StyleArg {
	return isTracking ? styles.trackingRow : undefined;
}

/** One action button, full width when the actions stack. */
export function alertDialogActionXstyle(isStacked: boolean): StyleArg {
	return [styles.action, isStacked && styles.stackedAction];
}
