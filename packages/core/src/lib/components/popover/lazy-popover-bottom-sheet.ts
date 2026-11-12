/**
 * Ported from Astryx's `Popover/lazyPopoverBottomSheet.ts`.
 *
 * Upstream lazy-loads the sheet through `React.lazy` and renders nothing until
 * its module arrives, so a page whose popovers stay anchored never loads
 * BottomSheet or its gestures. Svelte has no component-level lazy boundary:
 * `PopoverBottomSheet` is a static import, and `BottomSheet` is therefore in
 * `Popover`'s module graph before any popover renders.
 *
 * `preloadPopoverBottomSheet` is kept as the hook the component calls when its
 * resolved presentation becomes `'bottom-sheet'`. With the static import there
 * is nothing left to load, so the call is a no-op; a later Svelte lazy
 * boundary attaches here and the call site does not change.
 */

export { default as PopoverBottomSheet } from './popover-bottom-sheet.svelte';

/** Loads the sheet's module with nothing rendered. A no-op in this port. */
export function preloadPopoverBottomSheet(): void {
	return;
}
