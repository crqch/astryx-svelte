import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';

/**
 * Ported from Astryx's `DropdownMenu/useMenuDrillIn.tsx` styles.
 *
 * The wrappers add no box of their own, so the menu's flex gap still runs
 * between the rows exactly as it does without them.
 */
const styles = stylex.create({
	tree: {
		display: 'contents'
	},
	treeHidden: {
		display: 'none'
	}
});

/** The root's rows wrapper: hidden while a drilled-in view shows. */
export function drillInTreeAttrs(isDrilled: boolean): SvelteStyleAttrs {
	return sx(styles.tree, isDrilled && styles.treeHidden);
}

/** The host a shown view renders into; it owns no box. */
export function drillInHostAttrs(): SvelteStyleAttrs {
	return sx(styles.tree);
}
