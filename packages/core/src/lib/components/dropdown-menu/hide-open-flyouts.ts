/**
 * Ported from Astryx's `DropdownMenu/DropdownMenu.tsx` and
 * `DropdownMenuSubMenu.tsx` close sweeps.
 *
 * Submenu flyouts are `popover="manual"` elements nested inside the menu's
 * `popover="auto"` element, so the browser's light dismiss of the menu never
 * reaches them: without a sweep they keep their open state and their top-layer
 * entry while the menu is hidden, and re-anchor to the viewport corner when the
 * menu reopens. Closing them through the popover API lets `useLayer`'s toggle
 * handling reset their state.
 */

function closeFlyout(flyout: HTMLElement): void {
	if (typeof flyout.hidePopover === 'function') {
		if (flyout.matches(':popover-open')) {
			flyout.hidePopover();
		}
		return;
	}
	if (flyout.style.display === 'block') {
		// Without the popover API the layer toggles `display`; mirror it and tell
		// its reconciler.
		flyout.style.display = 'none';
		const toggle = new Event('toggle', { bubbles: false });
		Object.defineProperty(toggle, 'newState', { value: 'closed', configurable: true });
		flyout.dispatchEvent(toggle);
	}
}

/**
 * Close every open flyout inside `menu` before the menu hides. Innermost first:
 * hiding a flyout may unmount the flyouts nested inside it, and a detached
 * element no longer has the toggle listener that resets its open state.
 */
export function hideOpenFlyouts(menu: HTMLElement | null): void {
	const root = menu?.closest<HTMLElement>('[popover]') ?? menu;
	if (root == null) {
		return;
	}
	for (const flyout of [...root.querySelectorAll<HTMLElement>('[popover]')].reverse()) {
		closeFlyout(flyout);
	}
}

/**
 * Close every open flyout with a header or footer whose row sits in `menu`.
 * Such a flyout renders beside the root's menu, not inside the flyout that
 * holds its row, so hiding that flyout does not hide it.
 */
export function hideRegionedFlyoutsIn(menu: HTMLElement | null): void {
	if (menu == null) {
		return;
	}
	const doc = menu.ownerDocument;
	const rows = menu.querySelectorAll<HTMLElement>('[aria-expanded="true"][aria-controls]');
	for (const row of [...rows].reverse()) {
		const frame = doc.getElementById(row.getAttribute('aria-controls') ?? '');
		if (frame?.getAttribute('data-astryx-submenu-regions') !== 'flyout') {
			continue;
		}
		const flyout = frame.closest<HTMLElement>('[popover]');
		if (flyout == null) {
			continue;
		}
		closeFlyout(flyout);
	}
}
