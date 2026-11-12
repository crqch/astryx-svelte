<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { SpacingStep } from '../../internal/types.js';

	export interface PopoverBottomSheetProps extends BaseProps<HTMLDivElement> {
		/** The popover's content, rendered in place of the anchored surface. */
		children: Snippet;

		/**
		 * The sheet panel's id. The trigger's `aria-controls` points at it while
		 * the sheet is the mounted surface.
		 */
		id: string;

		/** Whether the sheet is open, controlled by the popover. */
		isOpen: boolean;

		/** Reports a sheet dismissal, as the anchored popover reports its own. */
		onOpenChange: (isOpen: boolean) => void;

		/**
		 * The sheet's accessible name. Upstream labels it with the popover's
		 * `label`, else the trigger's text (DEC-8).
		 */
		label: string;

		/**
		 * Whether Escape dismisses the sheet. Light dismiss (a scrim tap or a
		 * swipe down) is always on, whatever the popover's `hasLightDismiss`
		 * says, so a finger always has a way out (DEC-8).
		 * @default true
		 */
		hasEscapeDismiss?: boolean;

		/** Content padding on the spacing scale. Upstream's Popover default. */
		padding?: SpacingStep;

		/**
		 * Whether the hidden-until-focused fallback close renders after the
		 * content. The popover passes its resolved `hasCloseButton`.
		 */
		hasCloseButton?: boolean;

		/** The fallback close control's label. */
		closeButtonLabel?: string;
	}
</script>

<script lang="ts">
	import BottomSheet from '../bottom-sheet/bottom-sheet.svelte';
	import Button from '../button/button.svelte';
	import { setBottomSheetEscape } from '../bottom-sheet/bottom-sheet-escape.js';
	import {
		FOCUSABLE_SELECTOR,
		isDisabledWithin,
		preferTabStops
	} from '../../internal/focusable-selector.js';
	import { popoverSheetFallbackCloseXstyle } from './popover.stylex.js';

	/**
	 * Ported from Astryx's `Popover/lazyPopoverBottomSheet.ts`
	 * (`PopoverBottomSheet`), with the surface itself from `Popover.tsx`.
	 *
	 * The sheet a `Popover` presents when its resolved presentation is
	 * `'bottom-sheet'`: a tall modal BottomSheet labeled by the popover, with
	 * the popover's content and its hidden-until-focused fallback close. The
	 * closed sheet stays mounted at rest, as the anchored layer does, so state
	 * kept in the content survives a reopen.
	 *
	 * Upstream loads this component through `React.lazy`. Svelte has no
	 * component-level lazy boundary: `BottomSheet` is a static import and is in
	 * this component's module graph as soon as a Popover loads. The `preload`
	 * hook is kept in `lazy-popover-bottom-sheet.ts` as the place a later lazy
	 * boundary would attach.
	 *
	 * Escape follows the popover's `hasEscapeDismiss` through
	 * `BottomSheetEscapeContext`; the sheet's own `purpose` stays `info`, so
	 * light dismiss is never disabled by the popover's `hasLightDismiss`.
	 */
	const {
		children,
		id,
		isOpen,
		onOpenChange,
		label,
		hasEscapeDismiss = true,
		padding = 3,
		hasCloseButton = true,
		closeButtonLabel = 'Close popover',
		...rest
	}: PopoverBottomSheetProps = $props();

	setBottomSheetEscape(() => hasEscapeDismiss);

	const FALLBACK_CLOSE_SELECTOR = '[data-astryx-popover-fallback-close]';

	/** The visual sheet panel, which carries the scroll area as its child. */
	let panelEl = $state<HTMLDivElement | null>(null);

	/**
	 * Focus enters the sheet at each opening, as it does in the anchored
	 * popover (FR2). A caller's `[data-autofocus]` wins. Else the first enabled
	 * tab stop in the content takes focus: never the injected fallback close or
	 * BottomSheet's own scroll area. Else the scroll area does: it is the
	 * sheet's labelled surface and shows the keyboard focus ring.
	 *
	 * The frame waits for BottomSheet to present the dialog and run its own
	 * panel focusing step, so this reads the state that step left behind.
	 */
	$effect(() => {
		if (!isOpen || panelEl == null) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			const sheetPanel = panelEl;
			if (sheetPanel == null) {
				return;
			}
			const dialog = sheetPanel.closest('dialog');
			if (dialog == null || !dialog.open) {
				return;
			}
			const active = sheetPanel.ownerDocument.activeElement;
			if (
				active != null &&
				active !== sheetPanel &&
				active !== dialog &&
				sheetPanel.contains(active)
			) {
				return;
			}
			const target =
				sheetPanel.querySelector<HTMLElement>('[data-autofocus]') ??
				preferTabStops(
					Array.from(sheetPanel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
						(element) =>
							// BottomSheet's scroll area is the panel's own child; content
							// sits inside it.
							element.parentElement !== sheetPanel &&
							element.closest(FALLBACK_CLOSE_SELECTOR) == null &&
							!isDisabledWithin(element, sheetPanel)
					)
				)[0];
			if (target != null) {
				target.focus({ preventScroll: true });
				return;
			}
			// The scroll area is a tab stop only while its content overflows; it is
			// focusable from script either way.
			const surface = Array.from(sheetPanel.children).find(
				(child): child is HTMLElement =>
					child instanceof HTMLElement && child.getAttribute('role') === 'group'
			);
			if (surface == null) {
				return;
			}
			if (!surface.hasAttribute('tabindex')) {
				surface.tabIndex = -1;
			}
			surface.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<BottomSheet
	{@attach (element: HTMLDivElement) => {
		panelEl = element;
	}}
	{id}
	{isOpen}
	{onOpenChange}
	{label}
	height="tall"
	{padding}
	{...rest}
>
	{@render children()}
	{#if hasCloseButton}
		<Button
			data-astryx-popover-fallback-close=""
			variant="secondary"
			label={closeButtonLabel}
			onclick={() => onOpenChange(false)}
			xstyle={popoverSheetFallbackCloseXstyle()}
		/>
	{/if}
</BottomSheet>
