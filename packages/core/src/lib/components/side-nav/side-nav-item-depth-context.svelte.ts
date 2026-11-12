import { Context } from '../../internal/context.js';

/**
 * How many `SideNavItem`s deep the current item sits: 0 at the top level, 1
 * inside one parent, and so on.
 *
 * Ported from `SideNavItem.tsx`'s `SideNavItemDepthContext`. Nested rows span
 * the full width of the nav list like top-level rows, so their hover and
 * selected fill lines up with the rows above them; the nesting indent is drawn
 * inside the row as extra inline-start padding, one step per level. A collapsed
 * rail's flyout re-provides the context with 0, since the flyout lists a
 * parent's children as its own top level.
 */
export interface SideNavItemDepth {
	depth: number;
}

export const SideNavItemDepthContext = new Context<SideNavItemDepth>('SideNavItemDepthContext');

/** The current item's nesting depth, 0 outside any `SideNavItem`. */
export function useSideNavItemDepth(): number {
	return SideNavItemDepthContext.getOr({ depth: 0 }).depth;
}
