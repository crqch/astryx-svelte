/**
 * Ported from Astryx's `Selector/useSelectorPresentation.ts`.
 *
 * Coordinates popover and bottom-sheet disclosure state for `Selector` and
 * `MultiSelector`. The controller owns the shared policy once: which
 * presentation an opening chose (held until its close settles), whether the
 * sheet is open versus still presented, where focus returns on close, and
 * whether the returned focus may paint a ring.
 */

import {
	usePopover,
	type UsePopoverOptions,
	type UsePopoverReturn
} from '../popover/use-popover.svelte.js';
import {
	useAdaptivePresentation,
	type AdaptivePresentation,
	type ResolvedAdaptivePresentation
} from '../../hooks/use-adaptive-presentation.svelte.js';
import { useFocusReturnVisibility } from '../../hooks/use-focus-return-visibility.svelte.js';
import type { InteractionModality } from '../../utils/interaction-modality.js';
import { createPresentationHold, usePresentationHold } from '../layer/presentation-hold.svelte.js';

/** Upstream's `triggerModality.readModality`, narrowed to the one member read. */
export interface SelectorPresentationTriggerModality {
	readModality: () => InteractionModality;
}

export interface UseSelectorPresentationOptions {
	presentation: () => AdaptivePresentation;
	onHide: () => void;
	onShow: () => void;
	popoverOptions: () => Omit<UsePopoverOptions, 'onHide' | 'onShow'>;
	/**
	 * The trigger element, read at close time. Upstream's
	 * `RefObject<HTMLElement | null>`.
	 */
	triggerRef: () => HTMLElement | null;
	/** The component's one modality tracking. */
	triggerModality: SelectorPresentationTriggerModality;
	/**
	 * Return focus to the trigger on every close, even when a press already moved
	 * focus to another element. A caller-rendered trigger needs this;
	 * the built-in trigger leaves focus where the press put it.
	 */
	isFocusReturnAlways?: boolean;
}

export interface SelectorPresentationController {
	readonly activePresentation: ResolvedAdaptivePresentation;
	hide: () => void;
	readonly isOpen: boolean;
	readonly isSheetOpen: boolean;
	readonly isSheetPresented: boolean;
	readonly isTriggerFocusRingSuppressed: boolean;
	onSheetOpenChange: (isOpen: boolean) => void;
	onTriggerFocus: (event?: FocusEvent) => void;
	readonly popover: UsePopoverReturn;
	show: () => boolean;
}

export function useSelectorPresentation(
	options: () => UseSelectorPresentationOptions
): SelectorPresentationController {
	const resolvedPresentation = useAdaptivePresentation(() => options().presentation());

	// The presentation an opening chose, taken as it shows; and the sheet, held
	// from the render that opens it until its close settles. BottomSheet owns its
	// exit animation and final-focus handoff, so the sheet stays mounted after
	// the controlled open state turns false until that handoff reaches the
	// trigger; then consumers may remove the hidden surface tree.
	const activePresentationHold = createPresentationHold<ResolvedAdaptivePresentation>();
	let isSheetOpen = $state(false);
	const sheetHold = usePresentationHold<true>(() => ({
		isOpen: isSheetOpen,
		presentation: true
	}));

	const focusReturn = useFocusReturnVisibility({
		readModality: () => options().triggerModality.readModality()
	});

	let didShowPopover = false;
	// Read through a function so the hide handler can be created before
	// `popover` exists; the handler only runs after the hook returns.
	let readPopoverContent = (): HTMLElement | null => null;

	const handlePopoverHide = (): void => {
		options().onHide();
		const trigger = options().triggerRef();
		// A light dismiss caused by pressing another focusable element has already
		// moved focus there; taking it back would leave the next key on this
		// closed Selector. Escape, a choice in the list, or a press on nothing
		// focusable still returns focus to the trigger.
		const active = document.activeElement;
		const focusLandedElsewhere =
			!(options().isFocusReturnAlways ?? false) &&
			active instanceof HTMLElement &&
			active !== document.body &&
			active !== trigger &&
			!readPopoverContent()?.contains(active);
		if (focusLandedElsewhere) {
			return;
		}
		focusReturn.prepareFocusReturn();
		trigger?.focus();
	};

	const handlePopoverShow = (): void => {
		didShowPopover = true;
		focusReturn.resetFocusReturn();
		options().onShow();
	};

	const popover = usePopover(() => ({
		...options().popoverOptions(),
		onHide: handlePopoverHide,
		onShow: handlePopoverShow
	}));
	readPopoverContent = () => popover.contentRef;

	const show = (): boolean => {
		const resolved = resolvedPresentation.resolved;
		activePresentationHold.take(resolved);
		if (resolved === 'bottom-sheet') {
			focusReturn.resetFocusReturn();
			options().onShow();
			isSheetOpen = true;
			return true;
		}
		sheetHold.release();
		didShowPopover = false;
		popover.show();
		return didShowPopover;
	};

	const hide = (): void => {
		if (isSheetOpen) {
			focusReturn.prepareFocusReturn();
			isSheetOpen = false;
			options().onHide();
		} else {
			popover.hide();
		}
	};

	const handleTriggerFocus = (_event?: FocusEvent): void => {
		focusReturn.onFocusReturnTargetFocus();
		if (!isSheetOpen && activePresentationHold.current() === 'bottom-sheet') {
			// BottomSheet focuses finalFocusRef only after its exit completes. That
			// focus event is the lifecycle signal that the retained sheet can now
			// leave the tree without dropping focus to the document body: its
			// close has settled.
			activePresentationHold.release();
			sheetHold.release();
		}
	};

	const handleSheetOpenChange = (nextIsOpen: boolean): void => {
		if (nextIsOpen) {
			show();
		} else {
			hide();
		}
	};

	const isOpen = $derived(popover.isOpen || isSheetOpen);
	const activePresentation = $derived(
		isOpen || sheetHold.isHeld
			? (activePresentationHold.current() ?? resolvedPresentation.resolved)
			: resolvedPresentation.resolved
	);

	return {
		get activePresentation() {
			return activePresentation;
		},
		hide,
		get isOpen() {
			return isOpen;
		},
		get isSheetOpen() {
			return isSheetOpen;
		},
		get isSheetPresented() {
			return sheetHold.isHeld;
		},
		get isTriggerFocusRingSuppressed() {
			return focusReturn.isFocusRingSuppressed;
		},
		onSheetOpenChange: handleSheetOpenChange,
		onTriggerFocus: handleTriggerFocus,
		popover,
		show
	};
}
