/**
 * Ported from Astryx's `utils/focusReturn.ts`.
 *
 * Used by overlay triggers (DateInput, DateTimeInput) that return focus to
 * their control when the overlay closes, but only when the dismiss did not
 * already move focus somewhere the user chose. The same module holds the
 * disclosure path — `noteFocusWithin` before a change hides or removes
 * focused content, `moveFocusLeftBehind` after it — which Collapsible and
 * TreeList run around their exit holds.
 */

import { getInteractionModality } from './interaction-modality.js';

/**
 * True when focus rests on nothing in particular — no active element, or the
 * document body / root element.
 *
 * An overlay (popover, calendar, dropdown) that restores focus to its trigger
 * on close should do so ONLY when this is true. A native `popover="auto"`
 * light-dismiss fires its close synchronously with the pointer event that
 * moved focus, so by the time the close handler runs, focus has already
 * landed on whatever the user clicked — another field, a button, anywhere.
 * Restoring focus unconditionally would yank it back and fight that click.
 * The one case the browser leaves unresolved is Escape or a click on
 * non-focusable empty space, which drops focus to the body; that is exactly
 * when the trigger should reclaim it.
 */
export function isFocusDetached(doc: Document = document): boolean {
	const active = doc.activeElement;
	return active == null || active === doc.body || active === doc.documentElement;
}

/**
 * True when focus would be lost if `surface` hid now: nothing is focused (see
 * isFocusDetached) or focus sits inside `surface`. Reads `surface`'s own
 * document, so a surface in an iframe or Picture-in-Picture window is
 * answered there. Internal: not exported from the utils barrel.
 */
function isFocusLost(surface: Element | null, doc?: Document): boolean {
	const ownerDocument = doc ?? surface?.ownerDocument ?? document;
	return (
		isFocusDetached(ownerDocument) ||
		(surface != null && surface.contains(ownerDocument.activeElement))
	);
}

/** Where focus was, inside a container, before a change removed or hid content. */
export interface FocusWithin {
	readonly element: Element;
	readonly container: HTMLElement;
}

/**
 * The focused element, if it is inside `container`. A disclosure calls this
 * before the DOM changes (the `onBeforeChange` of a layout-change snapshot)
 * and passes the result to `moveFocusLeftBehind` from a post-commit effect of
 * the same change. Internal.
 */
export function noteFocusWithin(container: HTMLElement | null | undefined): FocusWithin | null {
	const active = container?.ownerDocument.activeElement;
	if (container == null || active == null || !container.contains(active)) {
		return null;
	}
	return { element: active, container };
}

/**
 * Moves focus noted by `noteFocusWithin` to `target` when the change lost it
 * (`isFocusLost`): it fell to the page because its element was removed, or it
 * is still inside `hidden`, content the change hid but kept, which the browser
 * is about to blur. Focus that survived the change, or that was never inside,
 * is not moved. The ring follows the last input, so the calling component
 * keeps modality tracking active (`trackInteractionModality`). Returns
 * whether focus moved. Internal.
 */
export function moveFocusLeftBehind(
	note: FocusWithin | null,
	target: HTMLElement | null | undefined,
	hidden: Element | null = null,
	options?: FocusOptions
): boolean {
	if (note == null || target == null || !isFocusLost(hidden, note.container.ownerDocument)) {
		return false;
	}
	focusForLastInput(target, options);
	return target.ownerDocument.activeElement === target;
}

/**
 * Move focus programmatically so its ring follows the last input. After
 * pointer input the browser's focus option keeps the element from matching
 * `:focus-visible`.
 *
 * `trackInteractionModality()` must be active in the component that calls
 * this.
 */
export function focusForLastInput(element: HTMLElement, options?: FocusOptions): void {
	// A text-entry field paints its own focus treatment to show where typing
	// goes, and an extra blur there can run validation or mark it touched.
	// Read the owner window's constructors: an element in an iframe is never an
	// instance of the page's.
	const view = element.ownerDocument.defaultView ?? window;
	const isTextEntry =
		element instanceof view.HTMLInputElement ||
		element instanceof view.HTMLTextAreaElement ||
		element instanceof view.HTMLSelectElement ||
		element.isContentEditable;
	if (isTextEntry || getInteractionModality() !== 'pointer') {
		element.focus(options);
		return;
	}
	// Focusing the element that already has focus does nothing, so a ring the
	// browser already drew would stay. WebKit draws one when its own focus
	// restoration moves focus itself, so clear that focus first.
	if (element.matches(':focus-visible')) {
		element.blur();
	}
	element.focus({ ...options, focusVisible: false });
}
