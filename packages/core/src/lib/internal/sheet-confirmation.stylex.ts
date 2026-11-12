import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from './sx.js';

/**
 * Ported from the one style in Astryx's `internal/SheetConfirmation.tsx`.
 *
 * Both stacked actions fill the dialog's footer width. The compiler folds this
 * single fixed call site upstream, so `dist/` holds no style object; the attrs
 * helper keeps the key alive in our compiled module and the shipped CSS oracle
 * checks its rule.
 */
const styles = stylex.create({
	action: { width: '100%' }
});

/** The raw action style, for `Button`'s `xstyle`. */
export const sheetConfirmationActionStyle = styles.action;

/** A full-width stacked action in the confirmation's footer. */
export function sheetConfirmationActionAttrs(): SvelteStyleAttrs {
	return sx(styles.action);
}
