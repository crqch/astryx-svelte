/**
 * Upstream's `Selector` disabled-ring probe: a synthetic ring keyed on
 * `:has(> [aria-disabled="true"]:focus-visible)`, so the absence assertion
 * names a class only that ring emits. Reusing the real disabled-ring style
 * would include its unconditional border/shadow atoms, which the
 * pointer-restored focus style legitimately shares.
 */

import * as stylex from '@stylexjs/stylex';
import { colorVars } from '../../lib/styles/tokens.stylex.js';

export const selectorPresentationProbe = stylex.create({
	ring: {
		boxShadow: {
			default: null,
			':has(> [aria-disabled="true"]:focus-visible)': `inset 0px 0px 0px 2px ${colorVars['--color-accent-muted']}`
		}
	}
});
