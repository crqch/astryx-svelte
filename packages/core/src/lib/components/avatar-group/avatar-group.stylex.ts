import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';

/**
 * Styles for AvatarGroup, ported from Astryx's `src/AvatarGroup/AvatarGroup.tsx`.
 *
 * The group itself is barely styled — the overlap is drawn by each child, which
 * reads the offset from context. That is what lets the API stay compositional:
 * the group never introspects its children.
 */

/** Fraction of an avatar's width that the next one covers. */
const OVERLAP_RATIO = 0.25;

/** Pixels of overlap for a given avatar size. */
export function resolveOverlap(numericSize: number): number {
	return Math.round(numericSize * OVERLAP_RATIO);
}

const styles = stylex.create({
	root: {
		display: 'inline-flex',
		alignItems: 'center',
		// Every avatar (and the overflow indicator) takes the negative overlap
		// margin, including the first one, so the overlap survives wrappers such
		// as HoverCard and Tooltip. This padding gives the first child that space
		// back, keeping the row inside the group's box.
		paddingInlineStart: {
			default: 'calc(-1 * var(--_avatar-group-overlap))',
			':empty': 0
		}
	}
});

const dynamicStyles = stylex.create({
	overlap: (offset: number) => ({
		'--_avatar-group-overlap': `${offset}px`
	})
});

export function avatarGroupAttrs(overlap: number, xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.root, dynamicStyles.overlap(-overlap), xstyle);
}
