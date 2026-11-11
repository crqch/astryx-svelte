import * as stylex from '@stylexjs/stylex';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	shadowVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Drawer/Drawer.tsx`.
 *
 * The native `<dialog>` element is the panel. `display` is owned by the
 * component's rendered state rather than a discrete transition, so the panel
 * stops painting in the same task the native host closes; only `transform`
 * animates.
 */
const MOBILE_BREAKPOINT = 640;
const MOBILE_PAGE_REVEAL = 56;

const styles = stylex.create({
	dialog: {
		position: 'fixed',
		margin: 0,
		padding: 0,
		borderWidth: 0,
		borderStyle: 'none',
		borderRadius: 0,
		maxWidth: 'none',
		maxHeight: 'none',
		boxSizing: 'border-box',
		flexDirection: 'column',
		backgroundColor: colorVars['--color-background-surface'],
		boxShadow: shadowVars['--shadow-high'],
		// `clip`, not `hidden`: `hidden` makes the panel a scroll container, and
		// Chromium then holds a finger's drag on the page beside a non-modal
		// drawer in that container's overscroll containment.
		overflow: 'clip',
		outline: 'none',
		insetBlockStart: 0,
		insetBlockEnd: 0,
		height: '100dvh',
		display: 'none',
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-medium'],
		transitionTimingFunction: easeVars['--ease-standard'],
		'@media (prefers-reduced-motion: reduce)': { transitionDuration: '0.01s' }
	},
	rendered: { display: 'flex' },
	end: {
		insetInlineEnd: 0,
		insetInlineStart: 'auto',
		borderInlineStartWidth: borderVars['--border-width'],
		borderInlineStartStyle: 'solid',
		borderInlineStartColor: colorVars['--color-border'],
		transform: {
			default: 'translateX(100%)',
			':dir(rtl)': 'translateX(-100%)'
		}
	},
	endOpen: {
		transform: {
			default: 'translateX(0)',
			'@starting-style': {
				default: 'translateX(100%)',
				':dir(rtl)': 'translateX(-100%)'
			}
		}
	},
	start: {
		insetInlineStart: 0,
		insetInlineEnd: 'auto',
		borderInlineEndWidth: borderVars['--border-width'],
		borderInlineEndStyle: 'solid',
		borderInlineEndColor: colorVars['--color-border'],
		transform: {
			default: 'translateX(-100%)',
			':dir(rtl)': 'translateX(100%)'
		}
	},
	startOpen: {
		transform: {
			default: 'translateX(0)',
			'@starting-style': {
				default: 'translateX(-100%)',
				':dir(rtl)': 'translateX(100%)'
			}
		}
	},
	openSettled: {
		transitionDuration: '0.01s',
		'::backdrop': { transitionDuration: '0.01s' }
	},
	scrim: {
		'::backdrop': {
			backgroundColor: colorVars['--color-overlay'],
			opacity: 0,
			transitionProperty: 'opacity',
			transitionDuration: durationVars['--duration-medium'],
			transitionTimingFunction: easeVars['--ease-standard']
		},
		'@media (prefers-reduced-motion: reduce)': {
			'::backdrop': { transitionDuration: '0.01s' }
		}
	},
	scrimOpen: {
		'::backdrop': {
			opacity: { default: 1, '@starting-style': 0 }
		}
	},
	content: {
		flexGrow: 1,
		minHeight: 0,
		width: '100%',
		overflowY: 'auto',
		overflowX: 'hidden',
		overscrollBehavior: 'contain',
		touchAction: 'pan-y',
		outline: 'none',
		backgroundColor: colorVars['--color-background-surface']
	},
	contentSafeArea: {
		paddingBlockEnd:
			'calc(var(--container-padding-block-end, 0px) + env(safe-area-inset-bottom, 0px))'
	}
});

const dynamicStyles = stylex.create({
	inlineSize: (desktopWidth: string, mobileWidth: string) => ({
		width: {
			default: desktopWidth,
			[`@media (max-width: ${MOBILE_BREAKPOINT}px)`]: mobileWidth
		},
		maxWidth: '100dvw'
	})
});

export const drawerStyles = styles;
export const drawerMobilePageReveal = MOBILE_PAGE_REVEAL;

export function drawerInlineSizeStyle(desktopWidth: string, mobileWidth: string) {
	return dynamicStyles.inlineSize(desktopWidth, mobileWidth);
}
