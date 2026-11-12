import type { Snippet } from 'svelte';
import type { IconName } from '../icon/icon-registry.js';

/**
 * Ported from Astryx's `Selector/types.ts`.
 *
 * The one translation is `icon`: upstream's `ReactNode | IconType` becomes
 * `IconName | Snippet`, the icon-slot shape `DropdownMenuItemData` already
 * settled — `renderIconSlot` dispatches on `typeof icon === 'string'` to a
 * registry lookup, and a snippet covers everything else.
 */

/**
 * A selectable option in the selector.
 */
export type SelectorOptionData = {
	value: string;
	// Kept a string, not renderable content: search filtering and type-ahead
	// both lowercase this to match keystrokes.
	label?: string;
	description?: string | Snippet;
	disabled?: boolean;
	/** A registry name, or a snippet for a custom icon. */
	icon?: IconName | Snippet;
	/**
	 * The option's secondary control — an Edit button beside a saved label —
	 * as one snippet the caller renders and names; the host only places it. In
	 * `MultiSelector`, any option carrying one turns the popup into a grid whose
	 * rows pair the option with its action, reachable by pointer, touch, the
	 * inline-end arrow, and a screen reader (`spec:AST-058`). `Selector` does
	 * not render it yet. Absent and `null` mean the same: none.
	 */
	action?: Snippet | null;
};

/**
 * A divider between options.
 */
export type SelectorDivider = {
	type: 'divider';
};

/**
 * A section/group of options with optional title.
 */
export type SelectorSection = {
	type: 'section';
	title?: string;
	options: SelectorOptionData[];
};

/**
 * Union of all option types passed to the `options` prop.
 * Can be a plain string, option data object, divider, or section.
 */
export type SelectorOptionType = string | SelectorOptionData | SelectorDivider | SelectorSection;
