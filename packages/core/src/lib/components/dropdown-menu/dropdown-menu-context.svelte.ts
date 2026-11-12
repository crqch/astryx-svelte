import { Context } from '../../internal/context.js';
import type { DropdownMenuSize } from './dropdown-menu-item.stylex.js';
import type { DropdownMenuDrillIn } from './use-menu-drill-in.svelte.js';

/**
 * Ported from Astryx's `DropdownMenu/DropdownMenuContext.tsx`.
 *
 * Provided by `DropdownMenu`, read by its items so a selection can close the
 * menu and each item can size itself to the trigger. Stored as a getter, per the
 * port's context convention, so `menuSize` stays reactive.
 *
 * Upstream publishes the raw `DropdownMenuContext` object from 0.2.0 on, with
 * the note "public so consumers can build custom menu items", so this one is
 * published too — a Svelte `Context` is the equivalent value, and the barrel
 * already ships ten of them (`AppShellMobileContext`, `ThemeContext`, …).
 */

export interface DropdownMenuContextValue {
	/** Close the menu and return focus to the trigger. */
	closeMenu: () => void;
	/** The menu's size, from the trigger button. */
	menuSize: DropdownMenuSize;
	/** The drill-in view stack; absent in a menu that cannot drill in. */
	drillIn?: DropdownMenuDrillIn;
	/**
	 * The name of this menu level, when known as text: a drilled-in view's Back
	 * row reads "Back to <this>".
	 */
	menuLabel?: string;
}

export const DropdownMenuContext = new Context<() => DropdownMenuContextValue>(
	'astryx.dropdownMenu'
);

export function setDropdownMenuContext(get: () => DropdownMenuContextValue): void {
	DropdownMenuContext.set(get);
}

/** A getter for the enclosing menu's context, or `null` outside one. */
export function useDropdownMenuContext(): () => DropdownMenuContextValue | null {
	return DropdownMenuContext.getOr(() => null);
}

/**
 * The root's surface host, ported from upstream's
 * `DropdownMenuSurfaceContext`. A sub-menu with a header or footer renders its
 * surface beside the root's menu, never inside it; `getElement` is an element
 * inside the root's popover but outside every `role="menu"`.
 */
export interface DropdownMenuSurfaceHost {
	/** The host element, or `null` before it attaches. */
	getElement: () => HTMLElement | null;
}

/** What a sub-menu with a header or footer needs from the root. */
export interface DropdownMenuSurfaceValue {
	host: DropdownMenuSurfaceHost;
	/** The root menu's `id`, which a hosted menu names for the press model. */
	ownerId: string;
	/** The root's resolved `menuMaxHeight`, which a drilled-in view caps at. */
	menuMaxHeight?: string;
}

export const DropdownMenuSurfaceContext = new Context<() => DropdownMenuSurfaceValue | null>(
	'astryx.dropdownMenuSurface'
);

export function setDropdownMenuSurfaceContext(get: () => DropdownMenuSurfaceValue | null): void {
	DropdownMenuSurfaceContext.set(get);
}

/** A getter for the enclosing root's surface, or `null` outside a host. */
export function useDropdownMenuSurfaceContext(): () => DropdownMenuSurfaceValue | null {
	return DropdownMenuSurfaceContext.getOr(() => null);
}

/**
 * Whether the root menu of this layer tree is open. A sub-menu's hover intent
 * must die with the menu: a hover-open scheduled on its trigger before the menu
 * closed from elsewhere would otherwise fire into the hidden menu and reopen
 * the flyout behind it. `null` means no signal, treated as open.
 */
export const DropdownMenuRootOpenContext = new Context<() => boolean | null>(
	'astryx.dropdownMenuRootOpen'
);

export function setDropdownMenuRootOpenContext(get: () => boolean | null): void {
	DropdownMenuRootOpenContext.set(get);
}

export function useDropdownMenuRootOpenContext(): () => boolean | null {
	return DropdownMenuRootOpenContext.getOr(() => null);
}

// =============================================================================
// Radio group coordination
// =============================================================================

export interface DropdownMenuRadioGroupContextValue {
	/** The currently selected value in the group. */
	value: string | undefined;
	/** Select a value. Called by a `DropdownMenuRadioItem` on activation. */
	onChange: (value: string) => void;
	/** Whether selecting an item should close the menu. @default true */
	hasCloseOnSelect: boolean;
}

const radioGroupContext = new Context<() => DropdownMenuRadioGroupContextValue>(
	'astryx.dropdownMenuRadioGroup'
);

export function setDropdownMenuRadioGroupContext(
	get: () => DropdownMenuRadioGroupContextValue
): void {
	radioGroupContext.set(get);
}

/**
 * Read the enclosing radio group's selection state. Returns a getter yielding
 * `null` outside a `DropdownMenuRadioGroup`, which is what lets
 * `DropdownMenuRadioItem` throw upstream's error.
 */
export function useDropdownMenuRadioGroupContext(): () => DropdownMenuRadioGroupContextValue | null {
	return radioGroupContext.getOr(() => null);
}
