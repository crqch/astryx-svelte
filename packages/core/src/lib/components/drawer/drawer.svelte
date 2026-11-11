<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { SpacingStep } from '../../internal/types.js';
	import type { DialogPurpose } from '../dialog/dialog.svelte';

	export interface DrawerProps extends BaseProps<HTMLDialogElement> {
		/** Ref forwarded to the root `<dialog>` element. */
		ref?: HTMLDialogElement | null;
		/** Whether the drawer is open. Fully controlled — pair with `onOpenChange`. */
		isOpen: boolean;
		/**
		 * Called when the drawer requests an open-state change. Escape and a scrim
		 * click call it with `false` as `purpose` allows; a `DrawerHeader` close
		 * button calls it when you pass the same callback to the header.
		 */
		onOpenChange: (isOpen: boolean) => unknown;
		/**
		 * Which edge the drawer slides from.
		 * - `'end'` — inline-end edge (right in LTR) — the inspector convention
		 * - `'start'` — inline-start edge (left in LTR)
		 * @default 'end'
		 */
		side?: 'start' | 'end';
		/**
		 * Desktop width budget. A number is pixels; a string is any CSS length.
		 * Below 640px the panel preserves a 56px page reveal without exceeding it.
		 * @default 400
		 */
		width?: number | string;
		/** Experimental options, outside the stable compatibility promise. */
		experimental?: {
			/** Cover the full mobile viewport instead of preserving the 56px reveal. */
			isFullWidthOnMobile?: boolean;
		};
		/** Accessible label for the drawer. */
		label: string;
		/**
		 * Whether to render a modal scrim behind the drawer.
		 * `true` uses `showModal()`; `false` uses a non-modal manual popover.
		 * @default true
		 */
		hasScrim?: boolean;
		/** Configures dismissals, matching Dialog. @default 'info' */
		purpose?: DialogPurpose;
		/** Internal padding on the spacing scale; defaults to the drawer theme default. */
		padding?: SpacingStep;
		/** Drawer content, rendered inside the full-height scroll area. */
		children: Snippet;
		/** Test ID for the root element. */
		'data-testid'?: string;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle, sx, type SvelteStyleAttrs } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import {
		containerPaddingBlockEndVarStyles,
		containerPaddingBlockStartVarStyles,
		containerPaddingInlineVarStyles,
		paddingStyles
	} from '../../internal/padding.stylex.js';
	import { useScrollLock } from '../../hooks/use-scroll-lock.svelte.js';
	import { useFocusTrap } from '../../hooks/use-focus-trap.svelte.js';
	import LayerDepthProvider from '../layer/layer-depth-provider.svelte';
	import { useLayerDismissal } from '../layer/use-layer-dismissal.svelte.js';
	import { drawerInlineSizeStyle, drawerMobilePageReveal, drawerStyles } from './drawer.stylex.js';
	import { useDrawerDialogPresence } from './use-drawer-dialog-presence.svelte.js';

	/**
	 * An overlay panel for inspectors and detail views, ported from Astryx's
	 * `Drawer/Drawer.tsx`.
	 *
	 * Slides in from the logical start or end edge using the native `<dialog>`:
	 * modal with a scrim by default, or a non-modal overlay with
	 * `hasScrim={false}`. Escape closes the top-most open drawer; focus returns
	 * to the element that opened it.
	 */
	let {
		isOpen,
		onOpenChange,
		side = 'end',
		width = 400,
		experimental,
		label,
		hasScrim = true,
		purpose = 'info',
		padding,
		children,
		ref = $bindable(null),
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: DrawerProps = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let isRendered = $state(isOpen);
	let hasMounted = $state(false);
	let exitSide = $state(side);

	$effect(() => {
		hasMounted = true;
	});
	$effect(() => {
		if (isOpen) {
			isRendered = true;
			exitSide = side;
		}
	});

	const opensSettled = $derived(isOpen && !hasMounted);
	const anchoredSide = $derived(isOpen ? side : exitSide);
	const allowEscape = $derived(purpose !== 'required');
	const allowScrimClick = $derived(purpose === 'info');

	const focusTrap = useFocusTrap(() => ({ isActive: isOpen && hasScrim }));
	useScrollLock(() => isOpen && hasScrim);

	const { shouldDismissOnCloseRequest } = useLayerDismissal(() => ({
		isActive: isRendered,
		escapeBehavior: allowEscape ? 'close' : 'block',
		onDismiss: () => onOpenChange(false),
		getContainer: () => dialogEl
	}));

	useDrawerDialogPresence({
		getDialog: () => dialogEl,
		getIsOpen: () => isOpen,
		getIsModal: () => hasScrim,
		setIsRendered: (value) => {
			isRendered = value;
		}
	});

	function handleCancel(event: Event): void {
		if (event.target !== event.currentTarget) return;
		event.preventDefault();
		if (!shouldDismissOnCloseRequest()) return;
		if (allowEscape) onOpenChange(false);
	}

	function handleClick(event: MouseEvent): void {
		// A ::backdrop click targets the dialog itself; child clicks target the
		// child. Stop content clicks at the drawer so wrappers around where it is
		// written do not also act on them.
		event.stopPropagation();
		if (event.target === event.currentTarget && allowScrimClick) onOpenChange(false);
	}

	const widthValue = $derived(typeof width === 'number' ? `${width}px` : width);
	const mobileWidth = $derived(
		experimental?.isFullWidthOnMobile
			? '100dvw'
			: `min(${widthValue}, calc(100dvw - ${drawerMobilePageReveal}px))`
	);
	const effectivePadding = $derived(padding ?? 4);
	const theme = $derived(themeProps('drawer', { side: anchoredSide }));

	const dialogAttrs = $derived([
		drawerStyles.dialog,
		drawerStyles[anchoredSide],
		isRendered && drawerStyles.rendered,
		isOpen && (anchoredSide === 'start' ? drawerStyles.startOpen : drawerStyles.endOpen),
		hasScrim && drawerStyles.scrim,
		hasScrim && isOpen && drawerStyles.scrimOpen,
		opensSettled && drawerStyles.openSettled,
		drawerInlineSizeStyle(widthValue, mobileWidth),
		xstyle
	] as const);
	const dialogStyle = $derived(sxFrom(dialogAttrs));
	const contentStyles = $derived.by(() => [
		drawerStyles.content,
		paddingStyles[effectivePadding],
		containerPaddingInlineVarStyles[effectivePadding],
		containerPaddingBlockStartVarStyles[effectivePadding],
		containerPaddingBlockEndVarStyles[effectivePadding],
		drawerStyles.contentSafeArea
	]);
	const contentStyle = $derived(sxFrom(contentStyles));

	function sxFrom(args: readonly unknown[]): SvelteStyleAttrs {
		return sx(...(args as never[]));
	}
</script>

{#snippet contentArea()}
	<div tabindex={-1} class={contentStyle.class} style={contentStyle.style}>
		{@render children()}
	</div>
{/snippet}

<dialog
	bind:this={dialogEl}
	{...rest}
	{...theme}
	class={cx(theme.class, dialogStyle.class, className)}
	style={mergeStyle(dialogStyle.style, styleProp as string | undefined)}
	popover={hasScrim ? undefined : 'manual'}
	aria-label={label}
	aria-modal={hasScrim && isOpen ? 'true' : undefined}
	role={purpose === 'required' && hasScrim ? 'alertdialog' : undefined}
	onclick={handleClick}
	oncancel={handleCancel}
	{@attach focusTrap.attachContainer}
	{@attach (node: HTMLDialogElement) => {
		ref = node;
		return () => {
			if (ref === node) ref = null;
		};
	}}
>
	<LayerDepthProvider>{@render contentArea()}</LayerDepthProvider>
</dialog>
