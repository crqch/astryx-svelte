import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/**
 * The tooltip surface's own styles, from Astryx's `Tooltip/useTooltip.tsx`.
 *
 * They sit in a `.stylex.ts` module rather than beside the hook for the same
 * reason `Layer`'s do: the StyleX bundler plugin Babel-parses anything that
 * imports `@stylexjs/stylex`, and `use-tooltip.svelte.ts` has to stay a plain
 * rune module.
 */
const styles = stylex.create({
	// Base container styles - inverted colors for high contrast
	container: {
		// Inverted color palette: dark background, light text
		backgroundColor: colorVars['--color-text-primary'],
		color: colorVars['--color-background-surface'],
		borderRadius: radiusVars['--radius-container'],
		// Typography
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	},
	// Content wrapper for padding
	content: {
		paddingBlockStart: spacingVars['--spacing-1'],
		paddingBlockEnd: spacingVars['--spacing-1'],
		paddingInlineStart: spacingVars['--spacing-2'],
		paddingInlineEnd: spacingVars['--spacing-2'],
		maxWidth: 300,
		wordBreak: 'break-word'
	}
});

/**
 * The popover container's `xstyle` — upstream's `popoverXstyle`.
 *
 * The gap is the layer's `offset` (0.7.13 moved it out of the surface's own
 * margins), so nothing here depends on placement; only `layerAnimations`
 * follows the per-render placement.
 */
export function tooltipSurfaceXstyle(): StyleArg {
	return styles.container;
}

/** The inner padding wrapper `renderTooltip` puts around its children. */
export function tooltipContentAttrs(): SvelteStyleAttrs {
	return sx(styles.content);
}
