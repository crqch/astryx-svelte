import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusVars, spacingVars } from '../../styles/tokens.stylex.js';
import type { ChatDensity } from './chat-context.svelte.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';

/** Ported from the `styles` block in Astryx's `Chat/ChatLayout.tsx`. */
const styles = stylex.create({
	root: {
		position: 'relative',
		containerType: 'inline-size',
		minHeight: 0,
		flex: 1,
		// Flex column so the sticky dock's natural height is part of the 100%:
		// messageArea flexes to fill the leftover space instead of forcing
		// minHeight: 100% on its own. Without this, the in-flow sticky dock
		// adds its full height on top of the 100% message area and the root
		// always overflows by exactly the dock height (#2573).
		display: 'flex',
		flexDirection: 'column'
	},
	rootScrollable: {
		overflowY: 'auto',
		overflowX: 'hidden'
	},

	messageArea: {
		display: 'flex',
		flexDirection: 'column',
		marginInline: 'auto',
		// Fill the space the dock doesn't need (grow), but never shrink below
		// content height — long content must overflow the root so it scrolls.
		flexGrow: 1,
		flexShrink: 0,
		flexBasis: 'auto',
		paddingBlockEnd: spacingVars['--spacing-6'],
		width: '100%',
		maxWidth: '100%',
		paddingInline: 0
	},

	// The end padding grows by the part of the keyboard over the dock and, for
	// a fixed dock, by the dock's height. So the newest message can scroll
	// above the composer, with no element added for it.
	messageAreaEndRoom: (room: number) => ({
		paddingBlockEnd: `calc(${spacingVars['--spacing-6']} + ${room}px)`
	}),

	emptyState: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
		minHeight: 200
	},

	// --- Dock container ---
	dockContainer: {
		bottom: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		zIndex: 0,
		isolation: 'isolate',
		pointerEvents: 'none',
		// Keep the sticky dock at its natural height as a flex item.
		// (Inert in fixed mode — position: fixed takes it out of flex layout.)
		flexShrink: 0
	},
	dockContainerFixed: {
		position: 'fixed'
	},
	dockContainerSticky: {
		position: 'sticky'
	},

	blurLayer: {
		position: 'absolute',
		bottom: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		pointerEvents: 'none',
		backdropFilter: 'blur(12px)',
		WebkitBackdropFilter: 'blur(12px)',
		height: 100,
		maskImage: 'linear-gradient(to bottom, transparent, black 36px)',
		WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 36px)'
	},

	dock: {
		position: 'relative',
		zIndex: 1,
		pointerEvents: 'auto',
		paddingInline: spacingVars['--spacing-3'],
		paddingBlockEnd: spacingVars['--spacing-3']
	},

	// The ring Done's park shows after typing, inside the dock's edge, which can
	// meet the viewport's.
	dockFocusRing: {
		outlineOffset: {
			default: null,
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		}
	},

	dockInner: {
		marginInline: 'auto',
		width: '100%',
		maxWidth: '100%'
	},

	// --- Forced density overrides (disable container queries) ---
	messageAreaCompact: {
		maxWidth: '100%',
		paddingInline: 0
	},
	messageAreaBalanced: {
		maxWidth: '100%',
		paddingInline: 0
	},
	messageAreaSpacious: {
		maxWidth: 800,
		paddingInline: spacingVars['--spacing-4']
	},

	blurLayerCompact: {
		height: 80,
		maskImage: 'linear-gradient(to bottom, transparent, black 24px)',
		WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 24px)'
	},
	blurLayerBalanced: {
		height: 100,
		maskImage: 'linear-gradient(to bottom, transparent, black 36px)',
		WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 36px)'
	},
	blurLayerSpacious: {
		height: 120,
		maskImage: 'linear-gradient(to bottom, transparent, black 48px)',
		WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 48px)'
	},

	dockCompact: {
		paddingInline: spacingVars['--spacing-2'],
		paddingBlockEnd: spacingVars['--spacing-2']
	},
	dockBalanced: {
		paddingInline: spacingVars['--spacing-3'],
		paddingBlockEnd: spacingVars['--spacing-3']
	},
	dockSpacious: {
		paddingInline: spacingVars['--spacing-4'],
		paddingBlockEnd: spacingVars['--spacing-3']
	},

	dockInnerCompact: {
		maxWidth: '100%'
	},
	dockInnerBalanced: {
		maxWidth: '100%'
	},
	dockInnerSpacious: {
		maxWidth: 800
	}
});

/** Upstream's `densityStyles` lookup, kept as one table rather than four. */
const byDensity = {
	compact: {
		messageArea: styles.messageAreaCompact,
		blurLayer: styles.blurLayerCompact,
		dock: styles.dockCompact,
		dockInner: styles.dockInnerCompact
	},
	balanced: {
		messageArea: styles.messageAreaBalanced,
		blurLayer: styles.blurLayerBalanced,
		dock: styles.dockBalanced,
		dockInner: styles.dockInnerBalanced
	},
	spacious: {
		messageArea: styles.messageAreaSpacious,
		blurLayer: styles.blurLayerSpacious,
		dock: styles.dockSpacious,
		dockInner: styles.dockInnerSpacious
	}
} as const;

export function chatLayoutRootAttrs(isSelfScrolling: boolean, xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.root, isSelfScrolling && styles.rootScrollable, xstyle);
}

export function chatLayoutMessageAreaAttrs(density: ChatDensity, endRoom = 0): SvelteStyleAttrs {
	return sx(
		styles.messageArea,
		byDensity[density].messageArea,
		endRoom > 0 && styles.messageAreaEndRoom(endRoom)
	);
}

export function chatLayoutEmptyStateAttrs(): SvelteStyleAttrs {
	return sx(styles.emptyState);
}

export function chatLayoutDockContainerAttrs(isSelfScrolling: boolean): SvelteStyleAttrs {
	return sx(
		styles.dockContainer,
		isSelfScrolling ? styles.dockContainerSticky : styles.dockContainerFixed
	);
}

export function chatLayoutBlurLayerAttrs(density: ChatDensity): SvelteStyleAttrs {
	return sx(styles.blurLayer, byDensity[density].blurLayer);
}

export function chatLayoutDockAttrs(density: ChatDensity): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.dock,
		byDensity[density].dock,
		styles.dockFocusRing
	);
}

export function chatLayoutDockInnerAttrs(density: ChatDensity): SvelteStyleAttrs {
	return sx(styles.dockInner, byDensity[density].dockInner);
}
