/**
 * Ported from Astryx's `hooks/focusableSelector.ts`.
 *
 * Upstream's header calls it an internal implementation detail, deliberately
 * kept out of the public barrel and shared by the focus-management hooks so the
 * selector is written once. It lives under `internal/` here for the same reason.
 */

/**
 * Canonical CSS selector for commonly focusable elements. Includes the
 * tabbable natives (button/link/input/select/textarea/[tabindex]) plus
 * editable and media elements the browser also puts in the tab order —
 * contenteditable, media with controls, iframe, and an open <details>'s
 * <summary> — which a naive selector misses, letting Tab escape a trap whose
 * only interactive content is (e.g.) a contenteditable composer (infra-8).
 *
 * This is the canonical focusable selector; prefer importing it here over
 * re-declaring the string so behavior stays consistent across hooks.
 */
export const FOCUSABLE_SELECTOR =
	'button:not([disabled]), a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls], iframe, details > summary:first-child';

/**
 * Whether `element` is disabled inside `container`: it, or an ancestor up to
 * `container`, has `aria-disabled="true"`. Popover skips such an element when
 * it picks initial focus. Tab still reaches it.
 */
export function isDisabledWithin(element: Element, container: Element): boolean {
	const disabled = element.closest('[aria-disabled="true"]');
	return disabled != null && container.contains(disabled);
}

/**
 * `elements` with tab stops first, each group in document order. Inside a
 * composite widget with a roving tab stop (a grid, a toolbar), the member that
 * holds `tabindex="0"` comes before the members that hold `-1`.
 */
export function preferTabStops<T extends Element>(elements: ReadonlyArray<T>): T[] {
	const isTabStop = (element: T) => element.getAttribute('tabindex') !== '-1';
	return [...elements.filter(isTabStop), ...elements.filter((element) => !isTabStop(element))];
}

/**
 * The name of a named native radio, or null for any other element and for an
 * unnamed radio, which is its own Tab stop.
 */
function radioNameOf(el: Element): string | null {
	if (!el.matches('input[type="radio"][name]')) return null;
	return (el as HTMLInputElement).name || null;
}

/**
 * Whether two radios are one group: the same name and the same form owner (or
 * both with no form).
 */
function isSameRadioGroup(a: Element, b: Element): boolean {
	const name = radioNameOf(a);
	return (
		name != null &&
		name === radioNameOf(b) &&
		(a as HTMLInputElement).form === (b as HTMLInputElement).form
	);
}

/**
 * Drop the radios the browser skips for Tab, leaving every other element, and
 * each kept radio, at its own place. In a named group the browser stops only at
 * the focused radio, else the checked one; a group with nothing checked keeps
 * every radio, so a forward entry reaches its first and a backward entry its
 * last.
 *
 * Ported from Astryx's `hooks/useFocusTrap.ts`, exported for menus that walk
 * their own Tab stops so they skip radios exactly as a focus region does.
 */
export function collapseRadioGroups(
	elements: HTMLElement[],
	active: Element | null
): HTMLElement[] {
	return elements.filter((el) => {
		if (radioNameOf(el) == null) return true;
		if (active != null && isSameRadioGroup(el, active)) return el === active;
		return (
			(el as HTMLInputElement).checked ||
			!elements.some((other) => isSameRadioGroup(el, other) && (other as HTMLInputElement).checked)
		);
	});
}
