import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';

/**
 * Ported from Astryx's `Timer/Timer.tsx`.
 *
 * The `<time>` element inherits the surrounding typography rather than
 * declaring its own; Timer wraps it in `Text`, which supplies the type scale.
 * Only the tabular figures and the inline box are Timer's own.
 */
const styles = stylex.create({
	time: {
		color: 'inherit',
		display: 'inline',
		fontFamily: 'inherit',
		fontSize: 'inherit',
		fontStyle: 'normal',
		fontVariantNumeric: 'tabular-nums',
		fontWeight: 'inherit',
		lineHeight: 'inherit'
	}
});

export function timerTimeAttrs(): SvelteStyleAttrs {
	return sx(styles.time);
}
