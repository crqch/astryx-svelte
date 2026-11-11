import * as stylex from '@stylexjs/stylex';
import type { StyleArg } from '../internal/sx.js';

/**
 * The behavior-owned overflow declaration for a ScrollableArea viewport.
 *
 * Ported from Astryx's `hooks/useScrollableArea.ts` inline `styles.overflow`.
 * It is a function style, so the class oracle deliberately does not diff it;
 * its output is one atomic pair per overflow axis.
 */
const styles = stylex.create({
	overflow: (overflowX: 'auto' | 'hidden' | 'clip', overflowY: 'auto' | 'hidden' | 'clip') => ({
		overflowX,
		overflowY
	})
});

export function scrollableAreaOverflowStyles(
	overflowX: 'auto' | 'hidden' | 'clip',
	overflowY: 'auto' | 'hidden' | 'clip'
): StyleArg {
	return styles.overflow(overflowX, overflowY);
}
