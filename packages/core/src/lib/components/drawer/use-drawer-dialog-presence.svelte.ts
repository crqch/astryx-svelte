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
		element.removeEventListener('transitioncancel', handleTransitionEnd);
		complete();
	};

	const handleTransitionEnd = (event: TransitionEvent) => {
		if (event.target === element && event.propertyName === 'transform') finish();
	};

	element.addEventListener('transitionend', handleTransitionEnd);
	element.addEventListener('transitioncancel', handleTransitionEnd);
	const transitionMs = readTransformTransitionMs(element);
	timer = setTimeout(finish, (transitionMs ?? EXIT_FALLBACK_MS) + EXIT_BACKSTOP_BUFFER_MS);

	return () => {
		done = true;
		if (timer != null) clearTimeout(timer);
		element.removeEventListener('transitionend', handleTransitionEnd);
		element.removeEventListener('transitioncancel', handleTransitionEnd);
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

	// Host lifetime: a replaced node and an unmount both leave the host.
	$effect(() => {
		const dialog = options.getDialog();
		const isModal = options.getIsModal();
		if (dialog == null) return;
		return () => {
			if (isDrawerHostOpen(dialog, isModal)) hideDrawerHost(dialog, isModal);
			triggerElement?.focus();
			triggerElement = null;
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
				dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
			}
			return;
		}

		if (!isDrawerHostOpen(dialog, isModal)) return;
		return waitForDrawerExit(dialog, () => {
			hideDrawerHost(dialog, isModal);
			setIsRendered(false);
			// Return focus after leaving the native host: a modal dialog makes the
			// rest of the document inert, so focusing earlier silently fails.
			triggerElement?.focus();
			triggerElement = null;
		});
	});
}
