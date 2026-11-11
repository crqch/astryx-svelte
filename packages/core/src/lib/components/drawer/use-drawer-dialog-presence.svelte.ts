/**
 * Native `<dialog>` presence for Drawer, ported from Astryx's
 * `Drawer/useDrawerDialogPresence.ts`.
 *
 * Two notions of presence stay separate: the component's rendered state keeps
 * the panel painting through its CSS exit, while `showModal()`/`showPopover()`
 * keeps it in the browser top layer. The close ordering is the browser-visible
 * invariant — finish the exit, then leave the native host and hide in the same
 * task, or a transformed ancestor becomes the containing block for the
 * still-fixed panel and it paints back into the page for a frame.
 */

const EXIT_BACKSTOP_BUFFER_MS = 50;
const EXIT_FALLBACK_MS = 250;

export interface DrawerDialogPresenceOptions {
	getDialog: () => HTMLDialogElement | null;
	getIsOpen: () => boolean;
	getIsModal: () => boolean;
	setIsRendered: (value: boolean) => void;
}

function isPopoverOpen(dialog: HTMLDialogElement): boolean {
	try {
		return dialog.matches(':popover-open');
	} catch {
		return false;
	}
}

function isDrawerHostOpen(dialog: HTMLDialogElement, isModal: boolean): boolean {
	return isModal ? dialog.open : isPopoverOpen(dialog) || dialog.open;
}

function showDrawerHost(dialog: HTMLDialogElement, isModal: boolean): void {
	if (isModal) {
		dialog.showModal();
	} else if (typeof dialog.showPopover === 'function') {
		dialog.showPopover();
	} else {
		dialog.show();
	}
}

function dispatchDialogClose(dialog: HTMLDialogElement): void {
	const EventConstructor = dialog.ownerDocument.defaultView?.Event ?? Event;
	dialog.dispatchEvent(new EventConstructor('close'));
}

/**
 * Leaves the active native host. Returns whether the caller owes a synthetic
 * `close` dispatch: the non-modal path used `dialog.close()` before popover
 * hosts, and consumers observe its native `close` event. Popover dismissal has
 * no equivalent event, so the public DOM contract is preserved explicitly —
 * by the caller, after focus restore, matching the task-queued native event's
 * ordering.
 */
function hideDrawerHost(dialog: HTMLDialogElement, isModal: boolean): boolean {
	if (!isModal && typeof dialog.hidePopover === 'function') {
		dialog.hidePopover();
		return true;
	}
	if (dialog.open) dialog.close();
	return false;
}

function readTransformTransitionMs(element: HTMLElement): number | null {
	const computed = getComputedStyle(element);
	const properties = computed.transitionProperty.split(',').map((value) => value.trim());
	const durations = parseTimes(computed.transitionDuration);
	const delays = parseTimes(computed.transitionDelay);
	if (
		properties.length === 0 ||
		durations.length === 0 ||
		delays.length === 0 ||
		durations.includes(null) ||
		delays.includes(null)
	) {
		return null;
	}
	return properties.reduce((longest, property, index) => {
		if (property !== 'transform' && property !== 'all') return longest;
		const duration = durations[index % durations.length] ?? 0;
		const delay = delays[index % delays.length] ?? 0;
		return Math.max(longest, duration + delay);
	}, 0);
}

function parseTimes(value: string): (number | null)[] {
	return value.split(',').map((part) => {
		const trimmed = part.trim();
		const time = Number.parseFloat(trimmed);
		if (!Number.isFinite(time)) return null;
		if (trimmed.endsWith('ms')) return time;
		return trimmed.endsWith('s') ? time * 1000 : null;
	});
}

function waitForDrawerExit(element: HTMLDialogElement, complete: () => void): () => void {
	let done = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const finish = () => {
		if (done) return;
		done = true;
		if (timer != null) clearTimeout(timer);
		element.removeEventListener('transitionend', handleTransitionEnd);
		complete();
	};

	const handleTransitionEnd = (event: TransitionEvent) => {
		// Only a completed transition ends the exit. A real browser also fires
		// `transitioncancel` when the opening transition is interrupted by the
		// close, which must not count: the exit transition starts after it. The
		// computed-duration backstop covers a genuinely canceled exit.
		if (
			event.type === 'transitionend' &&
			event.target === element &&
			event.propertyName === 'transform'
		) {
			finish();
		}
	};

	element.addEventListener('transitionend', handleTransitionEnd);
	element.addEventListener('transitioncancel', handleTransitionEnd);
	const transitionMs = readTransformTransitionMs(element);
	timer = setTimeout(finish, (transitionMs ?? EXIT_FALLBACK_MS) + EXIT_BACKSTOP_BUFFER_MS);

	return () => {
		done = true;
		if (timer != null) clearTimeout(timer);
		element.removeEventListener('transitionend', handleTransitionEnd);
	};
}

/**
 * Coordinates the native host with the component's rendered state.
 *
 * Mount/unmount is its own effect: React's open/close effect cleanup would cut
 * off every delayed slide-out, while an unmount must leave the host.
 */
export function useDrawerDialogPresence(options: DrawerDialogPresenceOptions): void {
	let triggerElement: HTMLElement | null = null;
	// Whether this hook last put the host in a top-layer state. The browser
	// auto-hides a popover whose element leaves the document, so teardown cannot
	// rely on `:popover-open` alone to know a synthetic close is owed.
	let isHostShown = false;

	// Host lifetime: a replaced node and an unmount both leave the host.
	$effect(() => {
		const dialog = options.getDialog();
		const isModal = options.getIsModal();
		if (dialog == null) return;
		return () => {
			if (isHostShown || isDrawerHostOpen(dialog, isModal)) {
				// Teardown owes its synthetic popover close immediately, still
				// exactly once.
				if (hideDrawerHost(dialog, isModal)) dispatchDialogClose(dialog);
				isHostShown = false;
			}
			const opener = triggerElement;
			triggerElement = null;
			// Removing an open surface loses focus rather than closing it, so the
			// browser returns nothing. Repair it only when focus really was lost —
			// see `prepareFocusReturnOnRemoval` upstream. The microtask also lets a
			// remount that keeps the element connected stand down.
			queueMicrotask(() => {
				if (dialog.isConnected) return;
				const doc = dialog.ownerDocument;
				const active = doc.activeElement;
				if (
					active != null &&
					active !== doc.body &&
					active !== doc.documentElement &&
					!dialog.contains(active)
				) {
					return;
				}
				if (opener?.isConnected) opener.focus();
			});
		};
	});

	$effect(() => {
		const dialog = options.getDialog();
		const isOpen = options.getIsOpen();
		const isModal = options.getIsModal();
		const setIsRendered = options.setIsRendered;
		if (dialog == null) return;

		if (isOpen) {
			if (!isDrawerHostOpen(dialog, isModal)) {
				triggerElement = document.activeElement as HTMLElement | null;
				showDrawerHost(dialog, isModal);
				isHostShown = true;
				dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
			}
			return;
		}

		if (!isDrawerHostOpen(dialog, isModal)) return;
		return waitForDrawerExit(dialog, () => {
			const owesCloseEvent = hideDrawerHost(dialog, isModal);
			isHostShown = false;
			setIsRendered(false);
			// Return focus after leaving the native host: a modal dialog makes the
			// rest of the document inert, so focusing earlier silently fails.
			triggerElement?.focus();
			triggerElement = null;
			// Fire after the focus restore above, mirroring the task-queued native
			// event: a consumer close listener that retargets focus gets the last
			// word.
			if (owesCloseEvent) dispatchDialogClose(dialog);
		});
	});
}
