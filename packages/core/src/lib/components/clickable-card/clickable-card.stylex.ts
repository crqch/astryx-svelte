import * as stylex from '@stylexjs/stylex';
import type { CardVariant } from '../card/card.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { borderVars, colorVars, durationVars, easeVars } from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';

const styles = stylex.create({
	interactive: {
		position: 'relative',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textDecoration: 'none',
		color: 'inherit'
	},
	// Hover overlay guarded by `@media (hover: hover)` so touch devices don't show
	// a stuck hover; the active/pressed state works everywhere.
	overlay: {
		'::after': {
			content: '""',
			position: 'absolute',
			inset: 0,
			pointerEvents: 'none',
			transitionProperty: {
				default: 'background-color',
				// Under reduced motion a colour changes at once. Only opacity may
				// still fade on a touch screen.
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'opacity'
			},
			transitionDuration: {
				default: durationVars['--duration-fast'],
				// Under reduced motion a fine pointer gets no transition. A touch
				// screen's fade keeps the exit tokens, within 200 ms.
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s',
				// The 200 ms bound copies reducedMotionFadeConsts.duration. That
				// module is internal, and a swizzled component imports only exported
				// paths. reduced-motion-values.test.ts keeps the copies equal.
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': `min(${durationVars['--duration-exit']}, 200ms)`
			},
			transitionTimingFunction: {
				default: easeVars['--ease-standard'],
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': easeVars['--ease-exit']
			},
			backgroundColor: 'transparent'
		},
		':active::after': {
			backgroundColor: colorVars['--color-overlay-pressed']
		}
	},
	hoverOnPointer: {
		'@media (hover: hover)': {
			':hover:where(:not(:disabled,[aria-disabled="true"]))::after': {
				backgroundColor: colorVars['--color-overlay-hover']
			}
		}
	},
	// Non-`default` variants drop Card's transparent 1px border so the overlay
	// reaches the box edge instead of leaving an untinted ring.
	borderless: {
		borderWidth: 0
	},
	// `default` draws the 1px border *within* the padding (width subtracted per
	// side) so total inset matches the borderless variants; it emphasizes on hover.
	bordered: {
		borderColor: colorVars['--color-border'],
		paddingInlineStart: `calc(var(--container-padding-inline-start) - ${borderVars['--border-width']})`,
		paddingInlineEnd: `calc(var(--container-padding-inline-end) - ${borderVars['--border-width']})`,
		paddingBlockStart: `calc(var(--container-padding-block-start) - ${borderVars['--border-width']})`,
		paddingBlockEnd: `calc(var(--container-padding-block-end) - ${borderVars['--border-width']})`,
		transitionProperty: {
			default: 'border-color',
			// Under reduced motion the border's colour changes at once.
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'opacity'
		},
		transitionDuration: {
			default: durationVars['--duration-fast'],
			// Under reduced motion a fine pointer gets no transition. A touch
			// screen's opacity fade, such as a disabled card's dimming, takes
			// 200 ms at most.
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': `min(${durationVars['--duration-exit']}, 200ms)`
		},
		transitionTimingFunction: {
			default: easeVars['--ease-standard'],
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': easeVars['--ease-exit']
		}
	},
	borderedHoverOnPointer: {
		'@media (hover: hover)': {
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				borderColor: colorVars['--color-border-emphasized']
			}
		}
	},
	disabled: {
		cursor: 'default',
		opacity: 0.5
	},
	srOnly: {
		position: 'absolute',
		width: '1px',
		height: '1px',
		padding: 0,
		margin: '-1px',
		overflow: 'hidden',
		clip: 'rect(0, 0, 0, 0)',
		whiteSpace: 'nowrap',
		borderWidth: 0
	}
});

export interface ClickableCardXstyleOptions {
	variant: CardVariant;
	isDisabled: boolean;
}

/**
 * The interactive layer handed to `Card`'s `xstyle` prop (an array, exactly as
 * upstream). They stay live style objects — `Card` resolves them through its own
 * `sx()`, which keeps them as object-mode dist entries.
 */
export function clickableCardXstyle(
	{ variant, isDisabled }: ClickableCardXstyleOptions,
	xstyle?: StyleArg
): StyleArg {
	const hasBorder = variant === 'default';
	return [
		styles.interactive,
		focusOutlineStyles.focusWithin,
		hasBorder ? styles.bordered : styles.borderless,
		!isDisabled && styles.overlay,
		!isDisabled && styles.hoverOnPointer,
		!isDisabled && hasBorder && styles.borderedHoverOnPointer,
		isDisabled && styles.disabled,
		xstyle
	];
}

/** The visually-hidden `<button>`/`<a>` that carries the accessible role/label. */
export function clickableCardControlAttrs(): SvelteStyleAttrs {
	return sx(styles.srOnly);
}
