<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheetEdgeTint from './bottom-sheet-edge-tint.svelte';
	import BottomSheetPanel, { type BottomSheetPanelMotion } from './bottom-sheet-panel.svelte';
	import type { BottomSheetPanelState } from './bottom-sheet-panel.svelte';
	import type { StandaloneBottomSheetProps } from './bottom-sheet.svelte';
	import { bottomSheetDialogAttrs, bottomSheetPositionerAttrs } from './bottom-sheet.stylex.js';
	import { focusPanel } from './focus-panel.js';
	import { setBottomSheetEscape, useBottomSheetEscape } from './bottom-sheet-escape.js';
	import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
	import { useScrollLock } from '../../hooks/use-scroll-lock.svelte.js';
	import { focusForLastInput } from '../../utils/focus-return.js';
	import { isImeKeyEvent } from '../../utils/ime.js';
	import { trackInteractionModality } from '../../utils/interaction-modality.js';

	/**
	 * Ported from the private `StandaloneBottomSheet` in Astryx's
	 * `BottomSheet/BottomSheet.tsx`.
	 *
	 * The host for a sheet that owns its own native `<dialog>`: it opens and
	 * closes the element, keeps it mounted through the exit animation, restores
	 * focus to whatever opened it, and drives the scrim's opacity from the panel's
	 * drag. Everything about the sheet *surface* belongs to `BottomSheetPanel`.
	 *
	 * Its own file because Svelte allows one component per module where upstream
	 * declares both hosts beside the router. Not exported from the barrel —
	 * upstream keeps it private, and `BottomSheet` is the only way in.
	 */
	let {
		isOpen,
		onOpenChange,
		label,
		children,
		height = 'capped',
		snapPoints,
		hasScrim = true,
		finalFocusRef,
		purpose = 'info',
		xstyle,
		...rest
	}: StandaloneBottomSheetProps = $props();

	let dialogEl = $state<HTMLDialogElement>();

	// A sheet opened inside a popover's sheet starts from Escape on, whatever
	// the popover's own `hasEscapeDismiss` says. Read the enclosing policy
	// before replacing it for this sheet's content.
	const escapeContext = useBottomSheetEscape();
	const isEscapeAllowed = $derived(escapeContext?.isEscapeAllowed ?? true);
	setBottomSheetEscape(() => true);

	// Plain `let`s, mirroring upstream's refs: the panel element the hosts focus
	// into, and the element focused when the sheet opened, for restoration on
	// close. Nothing renders from either.
	let panelEl: HTMLDivElement | null = null;
	let triggerEl: HTMLElement | null = null;
	// Whether focus was inside the sheet when its close began. A non-modal sheet
	// leaves the page interactive, so it returns focus to its opener only if the
	// person was still in the sheet; a modal sheet always does.
	let hadFocusAtClose = false;

	// The returned focus shows its ring only after keyboard input. Tracking is
	// global and once-per-document; this effect exists so a sheet in the page
	// starts it, exactly as the other overlay components do.
	$effect(() => {
		trackInteractionModality();
	});

	// Read with the close, before the exiting dialog goes inert and blurs what
	// the person had focused. `$effect.pre` runs before Svelte applies the
	// attribute that would move focus.
	$effect.pre(() => {
		if (!isOpen && dialogEl != null) {
			hadFocusAtClose = dialogEl.contains(document.activeElement);
		}
	});

	// Seeded from the initial prop, as upstream's `useState(isOpen)` is: a sheet
	// mounted already-open is presented from the first frame.
	// svelte-ignore state_referenced_locally
	let isPresented = $state(isOpen);
	// A sheet that was present on load opens settled, with no rise or fade-in;
	// later opens animate. Upstream's `useSettledOpen`; the latch ends on the
	// first close, so nothing after it inherits the settled scrim.
	// svelte-ignore state_referenced_locally
	let opensSettled = $state(isOpen);

	$effect(() => {
		if (!isOpen) {
			opensSettled = false;
		}
	});

	const shouldPresent = $derived(isOpen || isPresented);
	const isEntrySettled = $derived(opensSettled && isOpen);
	// The sheet holds focus until its exit motion completes — `handleMotionComplete`
	// returns it to the opener — so the whole exit takes no pointer input.
	const isExitHoldingFocus = $derived(!isOpen && isPresented);
	const panelState = $derived<BottomSheetPanelState>(
		isOpen
			? { kind: 'open', entering: false }
			: isPresented
				? { kind: 'exiting' }
				: { kind: 'hidden' }
	);

	function dismissOnEscape(): void {
		if (purpose !== 'required' && isEscapeAllowed) {
			onOpenChange(false);
		}
	}

	function dismissOnLightInteraction(): void {
		if (purpose === 'info') {
			onOpenChange(false);
		}
	}

	/**
	 * The panel invokes the callbacks below from inside its *own* effects, so
	 * anything they read would become a dependency of the panel's effect — a
	 * coupling React cannot express, because a callback in a dependency array
	 * contributes its identity and never its reads. Each body is therefore
	 * untracked. The reads stay current: `untrack` suspends subscription, not
	 * evaluation.
	 */
	function handlePanelElementChange(element: HTMLDivElement | null): void {
		panelEl = element;
	}

	function handleScrimOpacity(opacity: number): void {
		untrack(() => dialogEl)?.style.setProperty('--_sheet-scrim-opacity', String(opacity));
	}

	// Presentation. Tracks `isOpen` and `hasScrim`, upstream's two dependencies —
	// `dialogEl` and `panelEl` are refs on both sides and read untracked.
	$effect(() => {
		const dialog = dialogEl;
		if (dialog == null || !isOpen) {
			return;
		}

		// The controlled prop opens an already-mounted dialog, so presentation
		// state latches here: a later close then keeps the element mounted through
		// its exit rather than unmounting mid-animation.
		isPresented = true;
		dialog.style.setProperty('--_sheet-scrim-opacity', '1');
		if (!dialog.open) {
			// Captured before either presentation call: `show()` can move focus to
			// the first control, and a non-modal sheet still returns focus to
			// whatever opened it when the person is still inside at close.
			triggerEl ??= document.activeElement as HTMLElement | null;
			if (hasScrim) {
				dialog.showModal();
			} else {
				dialog.show();
			}
			focusPanel(panelEl, hasScrim);
		}
	});

	// Fade the scrim out for the exit. Separate from the effect above because it
	// runs on the *closing* edge, which that one returns early on.
	$effect(() => {
		if (!isOpen && isPresented && hasScrim) {
			handleScrimOpacity(0);
		}
	});

	function handleMotionComplete(motion: BottomSheetPanelMotion): void {
		untrack(() => {
			if (motion !== 'exiting' || isOpen) {
				return;
			}
			if (dialogEl?.open) {
				dialogEl.close();
			}
			isPresented = false;
			// The sheet's exit has settled, so the element it held can take focus
			// back. An explicit target wins over the opener — an adaptive
			// presentation's trigger may not be the focused element that opened
			// the sheet. A non-modal sheet returns focus only when the person was
			// still in it: the page behind stayed live, so focus taken elsewhere
			// stays there.
			const focusTarget = finalFocusRef?.() ?? (hasScrim || hadFocusAtClose ? triggerEl : null);
			if (focusTarget != null) {
				focusForLastInput(focusTarget, { preventScroll: true });
			}
			triggerEl = null;
		});
	}

	useScrollLock(() => shouldPresent && hasScrim);
	useDevWarning(
		'BottomSheet',
		'requires a non-empty `label` for an accessible name; the open sheet ' +
			'has no built-in heading to derive one from.',
		() => isOpen && !label
	);

	function handleCancel(event: Event): void {
		// A `cancel` that bubbles up from inside is not a close request: a file
		// input fires it when its picker is dismissed, so it is left alone.
		if (event.target !== event.currentTarget) {
			return;
		}
		// No IME guard here: `cancel` is a plain Event carrying no composition
		// state, and `handleKeyDown` claims a composing Escape before the browser
		// can raise the close request that would arrive here.
		event.preventDefault();
		dismissOnEscape();
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') {
			return;
		}
		// Claim the key before reading it: an unclaimed Escape lets the browser
		// raise its own close request, which lands on `handleCancel` and dismisses
		// on the same keypress.
		event.preventDefault();
		// An IME fires this keydown to cancel an in-progress composition, ahead of
		// `compositionend`. It is a composition cancel, not a dismissal command —
		// see `utils/ime`; `Dialog` and `BottomSheetSwitcher` guard the same way.
		if (isImeKeyEvent(event)) {
			return;
		}
		dismissOnEscape();
	}

	function handleClick(event: MouseEvent): void {
		if (hasScrim && event.target === event.currentTarget) {
			dismissOnLightInteraction();
		}
	}

	const dialogAttrs = $derived(
		bottomSheetDialogAttrs(shouldPresent, hasScrim, !isOpen && isPresented, undefined, {
			isEntrySettled,
			isExitHoldingFocus
		})
	);
	const positionerAttrs = bottomSheetPositionerAttrs(false, false);
</script>

<dialog
	bind:this={dialogEl}
	class={dialogAttrs.class}
	style={dialogAttrs.style}
	aria-label={label}
	aria-hidden={!isOpen && isPresented ? 'true' : undefined}
	aria-modal={hasScrim && isOpen ? 'true' : undefined}
	role={purpose === 'required' ? 'alertdialog' : undefined}
	inert={!isOpen && isPresented ? true : undefined}
	oncancel={handleCancel}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	<div class={positionerAttrs.class} style={positionerAttrs.style}>
		<BottomSheetPanel
			{...rest}
			{panelState}
			{height}
			{label}
			{snapPoints}
			{xstyle}
			{children}
			isSwipeDismissAllowed={purpose === 'info'}
			isPageScrollLocked={shouldPresent && hasScrim}
			onDismiss={dismissOnLightInteraction}
			onScrimOpacity={handleScrimOpacity}
			onElementChange={handlePanelElementChange}
			onMotionComplete={handleMotionComplete}
		/>
	</div>
	<!-- A modal sheet's `::backdrop` already answers Safari's edge sampler. -->
	{#if !hasScrim}
		<BottomSheetEdgeTint />
	{/if}
</dialog>
