import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars } from '../../styles/tokens.stylex.js';

/**
 * Styles for Icon, ported from Astryx's `src/Icon/Icon.tsx`.
 */

const styles = stylex.create({
	root: {
		flexShrink: 0
	},
	/** Wrapper for string-based (registry) icons */
	span: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0
	}
});

const colorStyles = stylex.create({
	primary: {
		color: colorVars['--color-icon-primary']
	},
	secondary: {
		color: colorVars['--color-icon-secondary']
	},
	tertiary: {
		color: colorVars['--color-icon-secondary']
	},
	disabled: {
		color: colorVars['--color-icon-disabled']
	},
	accent: {
		color: colorVars['--color-accent']
	},
	info: {
		color: colorVars['--color-icon-info']
	},
	success: {
		color: colorVars['--color-icon-success']
	},
	error: {
		color: colorVars['--color-icon-error']
	},
	warning: {
		color: colorVars['--color-icon-warning']
	},
	inherit: {
		color: 'inherit'
	},
	// Non-semantic colors
	blue: {
		color: colorVars['--color-icon-blue']
	},
	red: {
		color: colorVars['--color-icon-red']
	},
	green: {
		color: colorVars['--color-icon-green']
	},
	gray: {
		color: colorVars['--color-icon-gray']
	},
	cyan: {
		color: colorVars['--color-icon-cyan']
	},
	teal: {
		color: colorVars['--color-icon-teal']
	},
	yellow: {
		color: colorVars['--color-icon-yellow']
	},
	orange: {
		color: colorVars['--color-icon-orange']
	},
	pink: {
		color: colorVars['--color-icon-pink']
	},
	purple: {
		color: colorVars['--color-icon-purple']
	}
});

/**
 * Size styles for direct SVG icon components.
 * Uses width/height only — SVG components handle their own viewBox scaling.
 *
 * The dimensions are the `icon` target's private vars (`--_icon-width` /
 * `--_icon-height`) so a theme's `width`/`height` on that target's size
 * selector sets the glyph dimension; with no theme value each size falls back
 * to its rem value at a 16px root: 12px → 0.75rem, 16px → 1rem, 20px → 1.25rem,
 * 24px → 1.5rem.
 */
const sizeStyles = stylex.create({
	xsm: {
		width: 'var(--_icon-width, 0.75rem)',
		height: 'var(--_icon-height, 0.75rem)'
	},
	sm: {
		width: 'var(--_icon-width, 1rem)',
		height: 'var(--_icon-height, 1rem)'
	},
	md: {
		width: 'var(--_icon-width, 1.25rem)',
		height: 'var(--_icon-height, 1.25rem)'
	},
	lg: {
		width: 'var(--_icon-width, 1.5rem)',
		height: 'var(--_icon-height, 1.5rem)'
	}
});

/**
 * Size styles for string-based (registry) icons.
 * Reads the same private vars, plus a `fontSize`, because registry artwork is
 * 1em-based. `fontSize` is the smaller side, which fits square artwork into a
 * non-square box the way an SVG viewBox does.
 */
const registrySizeStyles = stylex.create({
	xsm: {
		width: 'var(--_icon-width, 0.75rem)',
		height: 'var(--_icon-height, 0.75rem)',
		fontSize: 'min(var(--_icon-width, 0.75rem), var(--_icon-height, 0.75rem))'
	},
	sm: {
		width: 'var(--_icon-width, 1rem)',
		height: 'var(--_icon-height, 1rem)',
		fontSize: 'min(var(--_icon-width, 1rem), var(--_icon-height, 1rem))'
	},
	md: {
		width: 'var(--_icon-width, 1.25rem)',
		height: 'var(--_icon-height, 1.25rem)',
		fontSize: 'min(var(--_icon-width, 1.25rem), var(--_icon-height, 1.25rem))'
	},
	lg: {
		width: 'var(--_icon-width, 1.5rem)',
		height: 'var(--_icon-height, 1.5rem)',
		fontSize: 'min(var(--_icon-width, 1.5rem), var(--_icon-height, 1.5rem))'
	}
});

/**
 * Size styles for component-owned icon boxes. Unlike the direct-SVG set above,
 * these are literal rem values (upstream's `iconBoxSizeStyles`): the box is
 * sized by the owning component, and `fontSize` keeps 1em-based icons in step.
 */
const iconBoxSizeStyles = stylex.create({
	xsm: { width: '0.75rem', height: '0.75rem', fontSize: '0.75rem' },
	sm: { width: '1rem', height: '1rem', fontSize: '1rem' },
	md: { width: '1.25rem', height: '1.25rem', fontSize: '1.25rem' },
	lg: { width: '1.5rem', height: '1.5rem', fontSize: '1.5rem' }
});

export type IconColor = keyof typeof colorStyles;
export type IconSize = keyof typeof sizeStyles;

/**
 * The `<svg>` a caller passed as a component. `xstyle` folds into the same
 * `stylex.props()` call as the base colour/size styles, last, so it merges and
 * dedupes with them rather than landing beside them — upstream's arrangement.
 */
export function iconAttrs(color: IconColor, size: IconSize, xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.root, colorStyles[color], sizeStyles[size], xstyle);
}

/** Raw StyleX styles for a component-owned icon box. */
export function iconBoxStyle(size: IconSize): StyleArg {
	return iconBoxSizeStyles[size];
}

/** The `<span>` wrapping a registry icon, whose font-size sizes the 1em SVG. */
export function iconSpanAttrs(
	color: IconColor,
	size: IconSize,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(styles.span, colorStyles[color], registrySizeStyles[size], xstyle);
}
