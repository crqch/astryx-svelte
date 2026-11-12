import { Context } from '../../internal/context.js';
import type { AnimatedLayout } from '../../motion/animated-layout.js';

/**
 * Svelte equivalent of Astryx's `List/ListContext.tsx`. A `ListItem` reads the
 * enclosing list's density, divider mode, row edge treatment and marker style.
 *
 * Stored as a **getter** so an item re-reads a changing `density`/`edge`/
 * `listStyle`, where upstream re-renders on the memoised context value. The
 * context is *optional*: upstream's `use(ListContext)` yields `null` outside a
 * `<List>` and `ListItem` falls back to `balanced` / no dividers / `padded` /
 * no markers, so a bare `<ListItem>` still renders. `ListContext` is
 * module-private upstream (the barrel exports only the two components and
 * their prop types), so it is not re-exported here either.
 */
export type ListDensity = 'compact' | 'balanced' | 'spacious';
export type ListMarkerStyle = 'none' | 'disc' | 'decimal' | 'circle';

/**
 * Where each row's content and its lines and backgrounds sit relative to the
 * list's edges and the padding of the container around the list.
 */
export type ListEdge = 'padded' | 'flush' | 'outset' | 'bleed';

/**
 * Every marker `ListItem` draws: the public styles, plus the square, letter and
 * roman markers Markdown's nested lists use through `ListMarkerScope`.
 */
export type ListMarker = 'disc' | 'circle' | 'square' | 'decimal' | 'lower-alpha' | 'lower-roman';

/** A task item's state, drawn as a read-only checkbox in the marker's place. */
export interface ListTaskMarker {
	readonly isChecked: boolean;
	/** The checkbox's accessible name: the item's text. */
	readonly label: string;
}

export interface ListContextValue {
	density: ListDensity;
	hasDividers: boolean;
	edge: ListEdge;
	listStyle: ListMarkerStyle;
	/**
	 * The marker items draw instead of the one `listStyle` names, set by
	 * `ListMarkerScope`; internal. Ignored when `listStyle` is `'none'`.
	 */
	marker?: ListMarker;
	/**
	 * A task item's state, set by `ListMarkerScope`; internal. The item draws a
	 * read-only checkbox instead of its marker. Ignored when `listStyle` is
	 * `'none'`.
	 */
	task?: ListTaskMarker;
	/**
	 * Whether the List has Markdown's outside-marker gutter, set by
	 * `ListMarkerScope`; internal. Its number column keeps the ordinary themed
	 * width, while whole counters may paint toward inline-start beyond it.
	 */
	hasMarkerGutter?: boolean;
	/**
	 * Whether a numbered item lays out outside the List's shared number
	 * columns, with its counter beside its own text as a bullet row has it; set
	 * by `ListMarkerScope`; internal.
	 */
	isOutsideNumberColumns?: boolean;
	/** The list's `animatedLayout` handle, for its rows. */
	animatedLayout?: AnimatedLayout;
}

const ListContext = new Context<() => ListContextValue>('astryx.list');

export function setListContext(get: () => ListContextValue): void {
	ListContext.set(get);
}

/** Returns the enclosing list's getter, or `null` for an item rendered alone. */
export function useList(): (() => ListContextValue) | null {
	return ListContext.getOr(null);
}
