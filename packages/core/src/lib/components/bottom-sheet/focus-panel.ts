/**
 * Ported from `focusPanel` and `focusFirstEligibleAutofocus` in Astryx's
 * `BottomSheet/bottomSheetStack.ts` (0.7.13).
 *
 * Its own module here rather than a file-local, because Svelte cannot export
 * from a component's instance script and both hosts — the standalone sheet and
 * the switcher item — call it. Not exported from the barrel; upstream publishes
 * nothing of it.
 *
 * `preventScroll` on every call: presenting a sheet must not scroll the page to
 * reveal what it just focused. For an autofocused field that reveal is the
 * mobile keyboard's, and it moves the document under a fixed sheet;
 * `useMobileKeyboard` brings the field into view within the sheet instead.
 */

/**
 * Focus the first `data-autofocus` descendant that belongs to this sheet.
 *
 * A sheet rendered inside the content carries its own `data-autofocus` fields,
 * and a closing one must not take the focus this sheet is about to place. An
 * inert or unrendered candidate is skipped for the same reason: `focus()`
 * either does nothing or lands somewhere the person cannot see, and the next
 * candidate should get the chance. A candidate that refuses focus is skipped by
 * checking `document.activeElement` after the call, which is how a plain
 * `<div data-autofocus>` is passed over.
 */
function focusFirstEligibleAutofocus(panel: HTMLElement): boolean {
	const dialog = panel.closest('dialog');
	for (const candidate of panel.querySelectorAll<HTMLElement>('[data-autofocus]')) {
		if (
			candidate.closest('dialog') !== dialog ||
			candidate.closest('[inert]') != null ||
			(typeof candidate.checkVisibility === 'function' && !candidate.checkVisibility())
		) {
			continue;
		}
		candidate.focus({ preventScroll: true });
		if (candidate.ownerDocument.activeElement === candidate) {
			return true;
		}
	}
	return false;
}

/**
 * Move focus into a sheet panel after its native host has presented it.
 *
 * The native focusing steps have just run, and what they focus is not the
 * person's choice: Chromium lands on the panel, Firefox on the first control.
 * An eligible `data-autofocus` field takes focus over either. Without one, a
 * modal sheet keeps Chromium's landing (the panel); a lone non-modal sheet
 * takes no focus of its own, so the page behind it keeps what it had.
 */
export function focusPanel(panel: HTMLElement | null, isModal: boolean): void {
	if (panel == null) {
		return;
	}
	// A covered sheet takes no focus: its dialog is inert (the stack marks it so,
	// and a modal above it blocks it in the browser anyway), so a step that
	// enters beneath a sheet on top leaves the person where they are.
	const host = panel.closest('dialog');
	if (host != null && (host.hasAttribute('inert') || host.getAttribute('aria-hidden') === 'true')) {
		return;
	}
	const activeElement = panel.ownerDocument.activeElement;
	const isInsidePanel =
		activeElement != null &&
		panel.contains(activeElement) &&
		activeElement.closest('dialog') === panel.closest('dialog');
	if (isInsidePanel && activeElement.hasAttribute('data-autofocus')) {
		return;
	}
	if (focusFirstEligibleAutofocus(panel)) {
		return;
	}
	if (!isInsidePanel && isModal) {
		panel.focus({ preventScroll: true });
	}
}
