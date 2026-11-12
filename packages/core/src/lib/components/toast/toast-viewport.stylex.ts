import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars, durationVars, easeVars } from '../../styles/tokens.stylex.js';
import type { ToastPosition } from './types.js';

const SAFE_AREA_INLINE_START = `max(${spacingVars['--spacing-4']}, env(safe-area-inset-left, 0px))`;
const SAFE_AREA_INLINE_END = `max(${spacingVars['--spacing-4']}, env(safe-area-inset-right, 0px))`;
const SAFE_AREA_BLOCK_START = `max(${spacingVars['--spacing-4']}, env(safe-area-inset-top, 0px))`;
// On an iPhone, a downward swipe that starts in the bottom inset can pull the
// whole screen down. Keep the toast clear of that inset.
const SAFE_AREA_BLOCK_END = `calc(${spacingVars['--spacing-4']} + env(safe-area-inset-bottom, 0px))`;
// Safari reports the inset only to a page with `viewport-fit=cover`. Under a
// coarse pointer the gutter clears 34 px anyway: a Face ID iPhone's bottom
// inset in portrait.
const SAFE_AREA_BLOCK_END_TOUCH = `calc(${spacingVars['--spacing-4']} + max(env(safe-area-inset-bottom, 0px), 34px))`;
const TOAST_EDGE_DRIFT = spacingVars['--spacing-2'];
const TOAST_EDGE_DRIFT_NEGATIVE = `calc(-1 * ${TOAST_EDGE_DRIFT})`;

const styles = stylex.create({
	viewport: {
		position: 'fixed',
		zIndex: 500,
		display: 'flex',
		boxSizing: 'border-box',
		flexDirection: 'column',
		paddingBlockStart: SAFE_AREA_BLOCK_START,
		paddingBlockEnd: {
			default: SAFE_AREA_BLOCK_END,
			'@media (pointer: coarse)': SAFE_AREA_BLOCK_END_TOUCH
		},
		paddingInlineStart: {
			default: SAFE_AREA_INLINE_START,
			':is([dir="rtl"] *)': SAFE_AREA_INLINE_END
		},
		paddingInlineEnd: {
			default: SAFE_AREA_INLINE_END,
			':is([dir="rtl"] *)': SAFE_AREA_INLINE_START
		},
		pointerEvents: 'none',
		// Reset popover styles — the popover attribute puts us in the top
		// layer (above dialogs), but we don't want its default styles.
		// UA stylesheet applies background-color: Canvas, margin: auto, etc.
		inset: 'unset',
		// `width` is part of that reset: the UA gives every popover
		// `width: fit-content`, and this element is positioned by spanning the
		// inline axis (`viewportInlineSpan` sets both inset-inline edges to 0)
		// and then aligning within itself. A shrink-wrapped box cannot span, so
		// both edges cannot be honoured — the box resolves against the start
		// edge at its content width, and `align-items: flex-end` then aligns the
		// toast to the right of a box that is itself sitting on the left.
		width: 'auto',
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		overflow: 'visible'
	},
	// iOS Safari colors its toolbar from a fixed element at the bottom edge. A
	// toast that a swipe sends through that edge gives the viewport its color.
	// Safari keeps that color while the viewport has a box, so an empty
	// viewport has none.
	// The mount point upstream's modal host portals into. Empty until that host
	// lands; `display: contents` keeps it invisible and layout-free.
	rootOutlet: {
		display: 'contents'
	},
	viewportEmpty: {
		display: 'none'
	},
	// The viewport sits at the inset the app declared on LayerProvider for a
	// bar floating over that edge; unset, each reads 0px. A toast-only `inset`
	// prop writes the same edges inline and wins.
	viewportInlineSpan: {
		insetInlineStart: 'var(--astryx-layer-inset-inline-start, 0px)',
		insetInlineEnd: 'var(--astryx-layer-inset-inline-end, 0px)'
	},
	bottomEnd: {
		bottom: 'var(--astryx-layer-inset-block-end, 0px)',
		alignItems: 'flex-end'
	},
	bottomStart: {
		bottom: 'var(--astryx-layer-inset-block-end, 0px)',
		alignItems: 'flex-start'
	},
	topEnd: {
		top: 'var(--astryx-layer-inset-block-start, 0px)',
		alignItems: 'flex-end',
		flexDirection: 'column-reverse'
	},
	topStart: {
		top: 'var(--astryx-layer-inset-block-start, 0px)',
		alignItems: 'flex-start',
		flexDirection: 'column-reverse'
	},
	toastWrapper: {
		pointerEvents: 'auto',
		display: 'grid',
		width: '100%',
		maxWidth: 400,
		minWidth: 0,
		gridTemplateRows: '1fr',
		transitionProperty: 'grid-template-rows, padding',
		transitionDuration: {
			default: durationVars['--duration-fast'],
			'@media (prefers-reduced-motion: reduce)': '0.01ms'
		},
		transitionTimingFunction: easeVars['--ease-standard']
	},
	// A row opens from a closed track only when it first renders. A move to
	// another modal outlet renders it again, and it must not open again.
	toastWrapperEntering: {
		'@starting-style': {
			gridTemplateRows: '0fr',
			paddingBlockEnd: 0
		}
	},
	toastWrapperFromBottom: {
		'--_toast-slide-y': TOAST_EDGE_DRIFT
	},
	toastWrapperFromTop: {
		'--_toast-slide-y': TOAST_EDGE_DRIFT_NEGATIVE
	},
	// The inter-toast gap is padding on each wrapper so it collapses with the
	// grid track. The wrapper nearest the viewport edge drops that padding; the
	// child flips because top stacks use column-reverse.
	toastWrapperGap: {
		paddingBlockEnd: { default: spacingVars['--spacing-2'], ':last-child': 0 }
	},
	toastWrapperGapReversed: {
		paddingBlockEnd: { default: spacingVars['--spacing-2'], ':first-child': 0 }
	},
	toastWrapperExiting: {
		gridTemplateRows: '0fr',
		paddingBlockEnd: 0
	},
	toastWrapperInner: {
		width: '100%',
		maxWidth: '100%',
		minWidth: 0,
		minHeight: 0,
		// Clip while the grid row opens and closes so the toast reads as folding
		// into the stack. Once the entry transition settles, the companion style
		// below releases the clip so the card's shadow can paint. `hidden` works
		// in every engine and restores the exact exit paint/hit boundary that the
		// viewport shipped with before the shadow fix.
		overflow: 'hidden'
	},
	toastWrapperInnerSettled: {
		overflow: 'visible'
	}
});

/**
 * Upstream's if/else chain: any value other than the three named positions
 * falls through to `bottomEnd`, which is also the prop default.
 */
function positionStyle(position: ToastPosition) {
	if (position === 'topEnd') return styles.topEnd;
	if (position === 'topStart') return styles.topStart;
	if (position === 'bottomStart') return styles.bottomStart;
	return styles.bottomEnd;
}

export function toastRootOutletAttrs(): SvelteStyleAttrs {
	return sx(styles.rootOutlet);
}

export function toastViewportAttrs(position: ToastPosition, hasToasts: boolean): SvelteStyleAttrs {
	return sx(
		styles.viewport,
		styles.viewportInlineSpan,
		positionStyle(position),
		!hasToasts && styles.viewportEmpty
	);
}

export function toastWrapperAttrs(
	isReversed: boolean,
	hasEntryStarted: boolean,
	isExiting: boolean
): SvelteStyleAttrs {
	return sx(
		styles.toastWrapper,
		!hasEntryStarted && styles.toastWrapperEntering,
		isReversed ? styles.toastWrapperFromTop : styles.toastWrapperFromBottom,
		isReversed ? styles.toastWrapperGapReversed : styles.toastWrapperGap,
		isExiting && styles.toastWrapperExiting
	);
}

export function toastWrapperInnerAttrs(isSettled: boolean, isExiting: boolean): SvelteStyleAttrs {
	return sx(styles.toastWrapperInner, isSettled && !isExiting && styles.toastWrapperInnerSettled);
}
