<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { AdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import type { BaseProps } from '../../base-props.js';
	import type { LayerAlignment, LayerPlacement } from '../layer/use-layer.svelte.js';

	/**
	 * The surface a Popover presents its content on: anchored to the trigger, in
	 * a BottomSheet, or adaptive (a BottomSheet on a compact touch screen, the
	 * popover elsewhere).
	 */
	export type PopoverPresentation = AdaptivePresentation;

	/**
	 * Props passed to the render-prop `trigger` snippet for explicit trigger
	 * wiring. Upstream's `PopoverTriggerRenderProps`.
	 *
	 * `ref` is upstream's ref callback, translated to an `Attachment` (this port's
	 * universal ref-callback replacement) — apply it with `{@attach}`. `onClick`
	 * is a plain handler the consumer wires to `onclick`. The ARIA fields are set
	 * on the trigger element by the consumer.
	 */
	export interface PopoverTriggerRenderProps {
		/** Attach to the trigger element for anchor positioning. Upstream's `ref`. */
		ref: Attachment<HTMLElement>;
		/** Toggle the popover open/closed. */
		onClick: () => void;
		/** ARIA attribute: indicates the element triggers a dialog. */
		'aria-haspopup': 'dialog';
		/** ARIA attribute: whether the popover is currently open. */
		'aria-expanded': boolean;
		/** ARIA attribute: ID of the controlled popover element. */
		'aria-controls': string;
	}

	export interface PopoverProps extends Pick<BaseProps, 'xstyle' | 'class' | 'style'> {
		/**
		 * The trigger content (automatic mode). Must contain a `<button>` or
		 * `[role="button"]` element — the popover locates it and applies
		 * click/keydown handlers and ARIA attributes automatically. Components that
		 * consume `InteractiveRoleContext` (e.g. `Token`) render as a button here.
		 *
		 * Upstream's `children` is `ReactNode | (props => ReactNode)` — a single
		 * prop discriminated by `typeof children === 'function'`. Svelte wraps both
		 * content and render-functions as snippets, so the two cannot be told
		 * apart; the render-function branch is split out to `trigger`, exactly as
		 * `Tooltip`'s string branch is split to a prop. Recorded under "Known debts".
		 */
		children?: Snippet;

		/**
		 * Explicit-mode trigger (upstream's render-function `children`). Receives
		 * `PopoverTriggerRenderProps` — the consumer attaches `ref`, wires
		 * `onClick`, and sets the ARIA attributes on their own trigger element. Use
		 * for custom triggers or third-party components.
		 */
		trigger?: Snippet<[PopoverTriggerRenderProps]>;

		/**
		 * External element to use as the popover anchor (sibling mode). When
		 * provided (and no `children`/`trigger`), the popover attaches to this
		 * element instead of wrapping content. The element must be a `<button>` or
		 * `[role="button"]` — the popover applies click/keydown handlers and ARIA
		 * to it directly. Bind it with `bind:this` in the consumer.
		 *
		 * Upstream's `anchorRef: RefObject<HTMLElement>` — a React ref object;
		 * here the element itself, the port's translation of a `.current` read.
		 */
		anchorRef?: HTMLElement | null;

		/** Content to display inside the popover. */
		content: Snippet;

		/**
		 * Position placement relative to the trigger.
		 * @default 'below'
		 */
		placement?: LayerPlacement;

		/**
		 * Alignment along the placement axis.
		 * @default 'start'
		 */
		alignment?: LayerAlignment;

		/**
		 * Whether the popover is open (controlled mode).
		 * Omit for uncontrolled behavior.
		 */
		isOpen?: boolean;

		/** Callback fired when the popover visibility changes. */
		onOpenChange?: (isOpen: boolean) => void;

		/**
		 * Whether the popover is enabled. When false, trigger interactions are
		 * ignored.
		 * @default true
		 */
		isEnabled?: boolean;

		/**
		 * Width of the popover container. Numbers are px, strings used as-is.
		 * @default 'auto'
		 */
		width?: number | string;

		/**
		 * Accessible label for the popover dialog. Recommended for accessibility
		 * when `role` is `'dialog'` (used as `aria-label` on the dialog).
		 */
		label?: string;

		/**
		 * ARIA role stamped on the popover content wrapper.
		 *
		 * Use `'dialog'` for dialog-style popovers. Use `'none'` when the popup
		 * content owns its own role, such as a child `role="menu"` or
		 * `role="listbox"`.
		 *
		 * @default 'dialog'
		 */
		role?: 'dialog' | 'none';

		/**
		 * Whether a dialog-style popover is modal (`aria-modal`). Only applies when
		 * `role` is `'dialog'`.
		 *
		 * @default true
		 */
		isModal?: boolean;

		/**
		 * Whether to include a hidden close button for accessibility.
		 * @default true
		 */
		hasCloseButton?: boolean;

		/**
		 * Label for the hidden close button.
		 * @default "Close popover"
		 */
		closeButtonLabel?: string;

		/**
		 * Whether to auto-focus the first focusable element when the popover opens.
		 * @default true
		 */
		hasAutoFocus?: boolean;

		/**
		 * Whether clicking outside dismisses the popover.
		 * @default true
		 */
		hasLightDismiss?: boolean;

		/**
		 * Whether pressing Escape dismisses the popover.
		 * @default true
		 */
		hasEscapeDismiss?: boolean;

		/**
		 * The surface that holds the content. `'popover'` anchors it to the
		 * trigger. `'bottom-sheet'` presents it in a modal BottomSheet, labeled by
		 * `label`. `'adaptive'` presents the BottomSheet on a compact touch screen
		 * (a coarse pointer on a screen the theme counts as compact: narrower than
		 * its `md` width point or shorter than 500px, so a phone in either
		 * orientation) and the anchored popover elsewhere, which is what iOS does
		 * with a popover by default.
		 *
		 * In a sheet, `placement`, `alignment`, `width`, `role`, `isModal` and
		 * `hasAutoFocus` do not apply (the sheet is a modal dialog with its own
		 * focus handling); `xstyle`, `class` and `style` style the sheet's panel,
		 * as they style the anchored surface. The sheet always light-dismisses (a
		 * tap outside it or a swipe down closes it, whatever `hasLightDismiss`
		 * says), Escape follows `hasEscapeDismiss`, and the fallback close stays
		 * hidden as on the anchored surface. The surface is chosen when the
		 * popover opens and kept until it closes.
		 * @default 'popover'
		 */
		presentation?: PopoverPresentation;

		/** Test ID for the popover container. */
		'data-testid'?: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import type { Attachment as AttachmentType } from 'svelte/attachments';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { spacingVars } from '../../styles/tokens.stylex.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { devWarn } from '../../utils/dev-warning.js';
	import PopoverAnchor from './popover-anchor.svelte';
	import PopoverLayer from './popover-layer.svelte';
	import {
		popoverAnchorWrapperAttrs,
		popoverContentAttrs,
		popoverLayerXstyle
	} from './popover.stylex.js';
	import { usePopover } from './use-popover.svelte.js';
	import { useAdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import { usePresentationHold } from '../layer/presentation-hold.svelte.js';
	import { PopoverBottomSheet, preloadPopoverBottomSheet } from './lazy-popover-bottom-sheet.js';

	/**
	 * A click-triggered popover for interactive content anchored to a trigger,
	 * ported from Astryx's `Popover/Popover.tsx`.
	 *
	 * `presentation` chooses the surface with the vocabulary DropdownMenu and
	 * Selector use: the anchored popover (the default), a BottomSheet, or
	 * `adaptive` — a BottomSheet on a compact touch screen and the popover
	 * elsewhere (the shared adaptive presentation policy). The surface is chosen
	 * when the popover opens; whichever is open stays until it closes.
	 *
	 * Implements the button + dialog ARIA pattern. The trigger must contain a
	 * `<button>` or `[role="button"]`; the popover finds it and applies handlers
	 * and ARIA automatically (automatic mode), or the consumer wires them
	 * (`trigger` render-prop / `anchorRef` sibling modes).
	 *
	 * Upstream's three `useIsomorphicLayoutEffect`s become two attachments and one
	 * `$effect`:
	 *
	 * - **Children mode** is an attachment on the anchor wrapper (`attachAnchor`) —
	 *   an attachment is upstream's ref-callback lifecycle, and finds the button
	 *   after its subtree has mounted, so `querySelector` sees it.
	 * - **Sibling mode** stays an `$effect` because `anchorRef` is an external
	 *   element the component only reads (upstream's `anchorRef.current`).
	 * - **`aria-expanded` sync** is its own `$effect`: upstream re-runs its whole
	 *   attach on every render (its `popover` dep churns) purely to re-stamp
	 *   `aria-expanded`; here the static ARIA/listeners bind once and only
	 *   `aria-expanded` follows `isOpen` reactively.
	 *
	 * Note `hasCloseButton`/`closeButtonLabel`/`hasAutoFocus`/`isModal` are **not**
	 * defaulted here — they pass through to `usePopover`, which supplies the
	 * defaults, exactly as upstream leaves them `undefined` at this layer. `role`
	 * is the exception upstream also makes: it is defaulted here to `'dialog'`
	 * because the render-prop branch reads it.
	 */
	const {
		children,
		trigger,
		anchorRef,
		content,
		placement = 'below',
		alignment = 'start',
		isOpen,
		onOpenChange,
		isEnabled = true,
		width,
		label,
		role = 'dialog',
		isModal,
		hasCloseButton,
		closeButtonLabel,
		hasAutoFocus,
		hasLightDismiss = true,
		hasEscapeDismiss = true,
		presentation = 'popover',
		xstyle,
		class: className,
		style,
		'data-testid': testId
	}: PopoverProps = $props();

	const id = $props.id();

	const BUTTON_SELECTOR = 'button, [role="button"]';

	/**
	 * Find the trigger button inside a container — either the element itself or the
	 * first matching descendant. Upstream's `findTriggerButton`.
	 */
	function findTriggerButton(el: HTMLElement): HTMLElement | null {
		if (el.matches(BUTTON_SELECTOR)) {
			return el;
		}
		return el.querySelector<HTMLElement>(BUTTON_SELECTOR);
	}

	const isControlled = $derived(isOpen !== undefined);
	// Track when the popover was last hidden by light dismiss to prevent the
	// trigger click from immediately re-opening it. Upstream's `lastHideTimeRef`.
	let lastHideTime = 0;

	// The surface `presentation` resolves to now. Only `'adaptive'` reads the
	// theme's compact definition and subscribes to its query; a fixed
	// presentation holds no media listener.
	const adaptivePresentation = useAdaptivePresentation(() => presentation);
	const resolvedPresentation = $derived(adaptivePresentation.resolved);
	let isSheetOpenState = $state(false);
	// The trigger's own name, which labels a sheet that has no `label` (DEC-8).
	let triggerText = $state('');

	const popover = usePopover(() => ({
		id,
		dialogLabel: label,
		role,
		isModal,
		hasLightDismiss,
		hasEscapeDismiss,
		hasCloseButton,
		closeButtonLabel,
		hasAutoFocus,
		onShow: () => onOpenChange?.(true),
		onHide: () => {
			lastHideTime = Date.now();
			onOpenChange?.(false);
		}
	}));

	// A controlled popover opens on the surface its presentation resolves to as
	// it opens, and keeps that surface until it closes: a phone rotated past the
	// compact width while the sheet is open keeps its sheet. The hold is taken
	// before the DOM update that opens the surface, so the open surface is known
	// in the same flush that opens it, and let go as the controlled state turns
	// off.
	const surfaceHold = usePresentationHold<'popover' | 'bottom-sheet'>(() => ({
		isOpen: isControlled && isOpen === true,
		presentation: popover.isOpen ? 'popover' : resolvedPresentation
	}));
	const controlledSurface = $derived(surfaceHold.presentation);
	const isSheetOpen = $derived(
		isControlled ? isOpen === true && controlledSurface === 'bottom-sheet' : isSheetOpenState
	);

	// The sheet, held from the render that opens it until its dialog has closed.
	// While held it stays mounted through its exit, so the exit plays out and its
	// dialog hands focus back to the trigger (component:Popover AR4).
	const sheetHold = usePresentationHold<true>(() => ({
		isOpen: isSheetOpen,
		presentation: true
	}));
	const hasSheetBeenOpen = $derived(sheetHold.isHeld);
	const releaseSheet = sheetHold.release;

	// One presentation at a time (architecture:component-style-authoring INV7):
	// the sheet is mounted, in place of the anchored layer, while it is the
	// surface an opening would choose and the anchored popover is not the open
	// one, while it is open, and through its exit after it was. Closed, it holds
	// the content as the anchored layer does, so state kept in the content (a
	// ticked box, typed text) survives a reopen.
	const isSheetMounted = $derived(
		isSheetOpen || hasSheetBeenOpen || (resolvedPresentation === 'bottom-sheet' && !popover.isOpen)
	);
	const isAnySurfaceOpen = $derived(popover.isOpen || isSheetOpen);
	const sheetId = $derived(`${popover.id}-sheet`);

	let sheetPanelEl = $state<HTMLDivElement | null>(null);

	$effect.pre(() => {
		if (isControlled && isOpen !== true && surfaceHold.isHeld) {
			surfaceHold.release();
		}
	});

	// The sheet's <dialog> has closed: its exit is over, so the retained sheet
	// may leave the tree. A dialog that is already closed means the same thing.
	$effect(() => {
		if (isSheetOpen || !hasSheetBeenOpen) {
			return;
		}
		const dialog = sheetPanelEl?.closest('dialog');
		if (dialog == null || !dialog.open) {
			releaseSheet();
			return;
		}
		const handleClose = () => releaseSheet();
		dialog.addEventListener('close', handleClose);
		return () => dialog.removeEventListener('close', handleClose);
	});

	// An open on a compact touch screen shows the sheet at once: preload as soon
	// as the sheet can be the surface, with nothing rendered. The sheet is a
	// static import here, so the call is the hook upstream's effect needs.
	$effect(() => {
		if (resolvedPresentation === 'bottom-sheet') {
			preloadPopoverBottomSheet();
		}
	});

	/** The trigger's own name: its `aria-label`, else its text. */
	function readTriggerText(trigger: HTMLElement): string {
		return trigger.getAttribute('aria-label')?.trim() || trigger.textContent?.trim() || '';
	}

	const setSheetOpen = (next: boolean): void => {
		if (!isControlled) {
			isSheetOpenState = next;
		}
		onOpenChange?.(next);
	};

	// Shared click handler for the trigger button.
	function handleTriggerClick(event?: Event): void {
		// An aria-disabled trigger stays focusable but opens nothing
		// (spec:AST-085 FR2), even for a click dispatched straight on it.
		const trigger = event?.currentTarget;
		if (
			!isEnabled ||
			(trigger instanceof Element && trigger.getAttribute('aria-disabled') === 'true')
		) {
			return;
		}
		// If the popover was just closed by light dismiss (clicking outside), the
		// trigger click fires in the same event — skip re-opening.
		if (Date.now() - lastHideTime < 50) {
			return;
		}
		// Opening chooses the surface; an open popover closes as a popover.
		if (isSheetOpen || (!popover.isOpen && resolvedPresentation === 'bottom-sheet')) {
			const opener = trigger instanceof HTMLElement ? trigger : renderTriggerElement;
			if (opener != null) {
				triggerText = readTriggerText(opener);
			}
			setSheetOpen(!isSheetOpen);
			return;
		}
		popover.toggle();
	}

	// Shared keydown handler for role="button" elements. Native <button>
	// synthesizes click on Enter/Space; role="button" does not.
	function handleTriggerKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleTriggerClick(e);
		}
	}

	// The found trigger button — the ARIA effect syncs it. In automatic mode the
	// anchor attachment sets it; in sibling mode the effect does.
	let triggerButton = $state<HTMLElement | null>(null);
	// The render-prop trigger element. Upstream's `renderTriggerRef`, read when a
	// trigger click carries no `currentTarget`.
	let renderTriggerElement: HTMLElement | null = null;

	/**
	 * Bind static ARIA + event handlers to a trigger button. `aria-haspopup`,
	 * `aria-expanded` and `aria-controls` are handled by the reactive effect
	 * below, not here — see the component comment. They may not be read in this
	 * function: it runs inside an attachment, and those values read `isOpen` and
	 * the presentation, which would re-run the whole attachment (rebinding
	 * listeners) on every open, close and presentation change.
	 */
	function wireTriggerButton(button: HTMLElement): () => void {
		button.addEventListener('click', handleTriggerClick);
		const needsKeyDown = button.tagName !== 'BUTTON' && button.getAttribute('role') === 'button';
		if (needsKeyDown) {
			button.addEventListener('keydown', handleTriggerKeyDown);
		}
		triggerButton = button;
		// The trigger's text is in the DOM the caller rendered, read as the
		// trigger attaches; it names a sheet that has no `label` (DEC-8).
		triggerText = readTriggerText(button);

		return () => {
			button.removeAttribute('aria-haspopup');
			button.removeAttribute('aria-expanded');
			button.removeAttribute('aria-controls');
			button.removeEventListener('click', handleTriggerClick);
			if (needsKeyDown) {
				button.removeEventListener('keydown', handleTriggerKeyDown);
			}
			if (triggerButton === button) {
				triggerButton = null;
			}
		};
	}

	// Automatic (children) mode: the wrapper is the CSS anchor, find the button
	// inside for ARIA + handlers. Upstream's children-mode layout effect.
	const attachAnchor: AttachmentType<HTMLElement> = (wrapper) => {
		const detachAnchor = popover.attachTrigger(wrapper);

		const button = findTriggerButton(wrapper);
		if (!button) {
			devWarn(
				'Popover',
				'children must contain a <button> or [role="button"] element. ' +
					'The popover trigger implements the button + dialog ARIA pattern.'
			);
			return detachAnchor;
		}

		const detachButton = wireTriggerButton(button);
		return () => {
			detachButton();
			detachAnchor?.();
		};
	};

	// Render-prop mode: the caller owns the element, so its attachment also
	// records it for a trigger click that carries no `currentTarget`. Upstream's
	// `setRenderTrigger`.
	const attachRenderTrigger: AttachmentType<HTMLElement> = (element) => {
		renderTriggerElement = element;
		triggerText = readTriggerText(element);
		const detachAnchor = popover.attachTrigger(element);
		return () => {
			if (renderTriggerElement === element) {
				renderTriggerElement = null;
			}
			detachAnchor?.();
		};
	};

	// Sibling mode: attach to the external anchorRef element itself, find the
	// button inside for ARIA + handlers. Upstream's anchorRef layout effect.
	$effect(() => {
		const el = anchorRef;
		if (!el || children !== undefined || trigger !== undefined) {
			return;
		}

		return untrack(() => {
			const button = findTriggerButton(el);
			if (!button) {
				devWarn(
					'Popover',
					'anchorRef must reference a <button> or [role="button"] element. ' +
						'The popover trigger implements the button + dialog ARIA pattern.'
				);
				return;
			}

			// Anchor positioning on the anchorRef element itself.
			const detachAnchor = popover.attachTrigger(el);
			const detachButton = wireTriggerButton(button);
			return () => {
				detachButton();
				detachAnchor?.();
			};
		});
	});

	// The trigger's ARIA follows the open surface, once a trigger button is
	// wired. The sheet is a dialog whatever the popover's `role`; while it is
	// the mounted surface the trigger controls its panel, not the hidden layer.
	// Upstream re-runs its whole attach on every render and re-stamps all three;
	// here the listeners bind once in `wireTriggerButton` and only these follow.
	$effect(() => {
		const button = triggerButton;
		const hasPopup = isSheetMounted ? 'dialog' : popover.triggerProps['aria-haspopup'];
		const expanded = isAnySurfaceOpen;
		const controls = isSheetMounted ? sheetId : popover.id;
		if (button) {
			button.setAttribute('aria-haspopup', hasPopup);
			button.setAttribute('aria-expanded', String(expanded));
			button.setAttribute('aria-controls', controls);
		}
	});

	// Sync controlled state. The sheet follows the controlled state in its
	// derived `isSheetOpen`; only the anchored surface has an imperative API.
	$effect(() => {
		if (!isControlled) {
			return;
		}
		const open = isOpen;
		const surface = controlledSurface;
		untrack(() => {
			if (!open) {
				if (popover.isOpen) {
					popover.hide();
				}
				return;
			}
			if (surface === 'popover' && !popover.isOpen) {
				popover.show();
			}
		});
	});

	// Mode is decided by which trigger the consumer supplied, NOT by `anchorRef`'s
	// value: upstream keys sibling mode on the *presence* of the `anchorRef` prop
	// (a stable RefObject, truthy even when `.current` is null), but here `anchorRef`
	// is the element itself — null until it mounts — so reading its value would
	// misdetect not-yet-mounted sibling mode as automatic and warn about a missing
	// button. Automatic mode is the one that renders a wrapper around `children`;
	// with no inline trigger (`children`/`trigger`), the popover attaches to the
	// external `anchorRef` whenever it arrives. This mirrors upstream's branch order
	// (render-prop → sibling → automatic) without depending on the ref value.
	const mode = $derived(trigger ? 'render' : children !== undefined ? 'automatic' : 'sibling');

	const anchorAttrs = popoverAnchorWrapperAttrs();
	const contentAttrs = $derived(popoverContentAttrs(xstyle));
	const themeClass = themeProps('popover').class;
	const layerXstyle = $derived(popoverLayerXstyle(width, placement));

	// `aria-haspopup` is the literal `'dialog'` here, NOT `popover.triggerProps`'s
	// role-derived value, and `PopoverTriggerRenderProps` types it as that literal.
	// That is upstream 0.3.0 verbatim: it routed the automatic/sibling paths through
	// `popover.triggerProps` when it added `role`, and left the render-prop branch
	// hard-coded. Deliberately not "fixed" here — see the parity rule.
	const renderTriggerProps = $derived<PopoverTriggerRenderProps>({
		ref: attachRenderTrigger,
		onClick: () => handleTriggerClick(),
		'aria-haspopup': 'dialog',
		'aria-expanded': isAnySurfaceOpen,
		'aria-controls': isSheetMounted ? sheetId : popover.id
	});
</script>

{#if mode === 'automatic'}
	<PopoverAnchor attach={attachAnchor} class={anchorAttrs.class} style={anchorAttrs.style}>
		{@render children?.()}
	</PopoverAnchor>
{:else if mode === 'render'}
	{@render trigger?.(renderTriggerProps)}
{/if}

{#if isSheetMounted}
	<PopoverBottomSheet
		id={sheetId}
		isOpen={isSheetOpen}
		onOpenChange={setSheetOpen}
		label={label ?? triggerText}
		{hasEscapeDismiss}
		hasCloseButton={popover.hasCloseButton}
		closeButtonLabel={popover.closeButtonLabel}
		{xstyle}
		class={className}
		{style}
		data-testid={testId}
		{@attach (element: HTMLDivElement) => {
			sheetPanelEl = element;
		}}
	>
		{@render content()}
	</PopoverBottomSheet>
{:else}
	<PopoverLayer
		{popover}
		{placement}
		{alignment}
		offset={spacingVars['--spacing-1']}
		xstyle={layerXstyle}
	>
		<div
			data-testid={testId}
			class={cx(themeClass, contentAttrs.class, className)}
			style={mergeStyle(contentAttrs.style, style)}
		>
			{@render content()}
		</div>
	</PopoverLayer>
{/if}
