import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { useThemeContext } from '../../theme/theme-context.js';

/**
 * Ported from Astryx's `DropdownMenu/useMenuDrillIn.tsx`.
 *
 * On a phone a flyout beside a phone-width menu has no room, so a sub-menu row
 * replaces the list with its own rows and a Back row in the same menu box. The
 * root owns the stack: `isDrilled` hides the root's rows and the view renders
 * into `host`. The sub-menu row stays mounted (hidden) while its view shows, so
 * its rows stay live and Back can return focus to it without bookkeeping.
 * Whether a finger drove the menu is decided once, when it opens, so a menu
 * never changes shape under a pointer.
 *
 * The Svelte half is split rather than returned as markup: a hook cannot return
 * a snippet, so the root renders the tree wrapper and the host itself and reads
 * the state from here.
 */

/** A sub-menu's view stack. Internal; the public surface is `presentation`. */
export interface DropdownMenuDrillIn {
	/** Whether the menu opened on a compact touch display, sampled at open. */
	readonly isCompactTouch: boolean;
	/** The pushed view ids, outermost first; the last one is the view shown. */
	readonly viewStack: ReadonlyArray<string>;
	/** The element a shown view renders its rows into. */
	readonly host: HTMLElement | null;
	/** Show a sub-menu's view in place of the current rows. */
	push: (viewId: string) => void;
	/** Return to the rows the shown view replaced. */
	pop: () => void;
}

export interface UseMenuDrillInReturn {
	readonly drillIn: DropdownMenuDrillIn;
	/** Whether a view is shown in place of the root's rows. */
	readonly isDrilled: boolean;
	/** Attach to the element a shown view renders into. */
	readonly attachHost: Attachment<HTMLElement>;
}

const COMPACT_HEIGHT_BELOW = 500;
const DEFAULT_MD = 768;

function compactTouchQuery(md: number): string {
	const width = `(width < ${md}px)`;
	const height = `(height < ${COMPACT_HEIGHT_BELOW}px)`;
	return `${width} and (pointer: coarse), ${height} and (pointer: coarse)`;
}

/**
 * @param isOpen - whether the root menu is open; the pointer kind is sampled
 *   when it opens and the stack empties when it closes.
 */
export function useMenuDrillIn(isOpen: () => boolean): UseMenuDrillInReturn {
	const themeContext = useThemeContext();

	let isCompactTouch = $state(false);
	let viewStack = $state<ReadonlyArray<string>>([]);
	let host = $state<HTMLElement | null>(null);
	// Derived from the open transition: the pointer kind is sampled as the menu
	// opens, and closing forgets the drilled view so the next open starts at the
	// root. `wasOpen` is a plain value: writing it must not subscribe the effect
	// to its own write.
	let wasOpen = isOpen();

	$effect(() => {
		const open = isOpen();
		if (wasOpen === open) {
			return;
		}
		wasOpen = open;
		if (open) {
			const points = themeContext?.().theme.adaptations?.widthBreakpoints;
			const query = compactTouchQuery(points?.md ?? DEFAULT_MD);
			isCompactTouch =
				typeof window !== 'undefined' &&
				typeof window.matchMedia === 'function' &&
				window.matchMedia(query).matches;
		} else if (viewStack.length > 0) {
			untrack(() => {
				viewStack = [];
			});
		}
	});

	function push(viewId: string): void {
		if (!viewStack.includes(viewId)) {
			viewStack = [...viewStack, viewId];
		}
	}

	function pop(): void {
		viewStack = viewStack.slice(0, -1);
	}

	const attachHost: Attachment<HTMLElement> = (element) => {
		host = element;
		return () => {
			if (host === element) {
				host = null;
			}
		};
	};

	return {
		get drillIn(): DropdownMenuDrillIn {
			return {
				get isCompactTouch() {
					return isCompactTouch;
				},
				get viewStack() {
					return viewStack;
				},
				get host() {
					return host;
				},
				push,
				pop
			};
		},
		get isDrilled() {
			return viewStack.length > 0;
		},
		attachHost
	};
}
