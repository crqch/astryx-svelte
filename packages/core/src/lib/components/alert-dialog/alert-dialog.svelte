<script lang="ts" module>
	import type { BaseProps } from '../../base-props.js';
	import type { ButtonVariant } from '../button/button.stylex.js';

	export interface AlertDialogProps extends BaseProps<HTMLDialogElement> {
		/** Whether the dialog is open. */
		isOpen: boolean;
		/**
		 * Renders alert dialog content inline without modal behavior.
		 * For documentation previews and showcases only.
		 * @default false
		 */
		isInline?: boolean;
		/**
		 * Fired when the dialog visibility changes. Called with `false` when cancel
		 * is clicked or Escape is pressed.
		 */
		onOpenChange: (isOpen: boolean) => unknown;
		/** Dialog title. Linked to the dialog via `aria-labelledby`. */
		title: string;
		/** Consequence description. Linked to the dialog via `aria-describedby`. */
		description: string;
		/**
		 * Label for the cancel button. Clicking it calls `onOpenChange(false)`.
		 * @default 'Cancel'
		 */
		cancelLabel?: string;
		/** Label for the action button. */
		actionLabel: string;
		/**
		 * @default 'destructive'
		 */
		actionVariant?: ButtonVariant;
		/** Whether the action button shows a loading spinner. */
		isActionLoading?: boolean;
		/**
		 * Fired when the action button is clicked. The dialog does **not**
		 * auto-close — call `onOpenChange(false)` when done.
		 */
		onAction: () => unknown;
		/**
		 * Width of the dialog. Numbers are pixels, strings pass through.
		 * @default 400
		 */
		width?: number | string;
	}
</script>

<script lang="ts">
	import Button from '../button/button.svelte';
	import Dialog from '../dialog/dialog.svelte';
	import Heading from '../heading/heading.svelte';
	import Stack from '../stack/stack.svelte';
	import Layout from '../layout/layout.svelte';
	import LayoutContent from '../layout/layout-content.svelte';
	import LayoutFooter from '../layout/layout-footer.svelte';
	import Text from '../text/text.svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { useActionGroupTracking } from '../../hooks/use-action-group-tracking.svelte.js';
	import { GROUP_PRESS_POINTERS } from '../../hooks/use-group-press-tracking.svelte.js';
	import { setPressGroupContext } from '../../hooks/press-group-context.svelte.js';
	import { alertController } from '../../motion/uikit/alert.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import { alertDialogActionXstyle, alertDialogActionsXstyle } from './alert-dialog.stylex.js';

	/**
	 * A confirmation dialog for destructive or irreversible actions.
	 *
	 * Uses `role="alertdialog"` and requires explicit user action to dismiss: it
	 * cannot be dismissed by clicking outside, and Escape triggers cancel. Initial
	 * focus goes to the cancel button — the least destructive action.
	 *
	 * The inline preview is the exception, and takes `role="group"` instead
	 * (#4887): `alertdialog` is a *modal* role, promising an interruption the
	 * user has to deal with, a focus trap, and an inert page behind it. The
	 * inline path renders a plain always-present div with none of that, so the
	 * role would misdescribe it. `group` keeps the title and description
	 * associated with a container without claiming a dialog.
	 *
	 * @example
	 * ```svelte
	 * <AlertDialog
	 *   isOpen={isOpen}
	 *   onOpenChange={(open) => (isOpen = open)}
	 *   title="Delete item?"
	 *   description="This action cannot be undone."
	 *   actionLabel="Delete"
	 *   onAction={async () => { await deleteItem(); isOpen = false; }}
	 * />
	 * ```
	 */
	let {
		isOpen,
		isInline,
		onOpenChange,
		title,
		description,
		cancelLabel: cancelLabelFromProps,
		actionLabel,
		actionVariant = 'destructive',
		isActionLoading,
		onAction,
		width = 400,
		xstyle,
		class: className,
		style: styleProp,
		'data-testid': testId,
		...rest
	}: AlertDialogProps = $props();

	const t = useTranslator();
	const cancelLabel = $derived(cancelLabelFromProps ?? t('@astryx.alertDialog.cancel'));

	const SMALL_SCREEN_QUERY = '(max-width: 640px)';
	// Width stays delegated to Dialog: this query exists only so AlertDialog can
	// keep narrow visual, DOM, and tab order aligned for its destructive/cancel
	// semantics without coupling action order to pointer or hover capability.
	const isSmallScreen = useMediaQuery(() => SMALL_SCREEN_QUERY);
	// Only under the touch presentation does a press slide across the actions.
	// A desktop press stays the native button's.
	const isTouch = useMediaQuery(() => TOUCH_QUERY);
	const isTracking = $derived(isOpen && isInline !== true && isTouch.matches);

	// Through the group's context, each action's Button writes the press-group
	// marker from its first render. So the tracker is its only painter.
	let actionsEl = $state<HTMLElement | null>(null);
	const ACTIONS_ATTACHMENT = createAttachmentKey();
	const actionsAttachment = {
		[ACTIONS_ATTACHMENT]: (node: HTMLElement) => {
			actionsEl = node;
			return () => {
				if (actionsEl === node) {
					actionsEl = null;
				}
			};
		}
	};
	useActionGroupTracking(
		() => actionsEl,
		() => ({
			// The actions row holds only the two buttons.
			itemSelector: 'button',
			highlightOnsetMs: alertController.actions.highlightOnsetMs,
			highlightExpansion: alertController.actions.highlightExpansion,
			// A mouse press acts as a native button's under any presentation.
			pointerTypes: GROUP_PRESS_POINTERS,
			isEnabled: isTracking
		})
	);
	setPressGroupContext(() => (isTracking ? GROUP_PRESS_POINTERS : null));

	// Upstream mints two `useId`s; `$props.id()` may be called only once per
	// component, so the pair is derived from one — the same shape `InputGroup`
	// and `RadioListItem` already use.
	const uid = $props.id();
	const titleId = `${uid}-title`;
	const descriptionId = `${uid}-description`;

	const theme = themeProps('alert-dialog');

	const dialogRole = $derived(isInline ? 'group' : 'alertdialog');
	const actionXstyle = $derived(alertDialogActionXstyle(isSmallScreen.matches));
	const actionsXstyle = $derived(alertDialogActionsXstyle(isTracking));

	function handleCancel(): void {
		onOpenChange(false);
	}
</script>

{#snippet content()}
	<LayoutContent>
		<Heading level={2} id={titleId}>{title}</Heading>
		<Text type="body" color="secondary" id={descriptionId}>{description}</Text>
	</LayoutContent>
{/snippet}

{#snippet cancelButton()}
	<!--
		Dialog focuses `[data-autofocus]` itself after `showModal()`, because the
		native `autofocus` attribute runs while the dialog is still invisible.
		Cancel is the least destructive choice, so it is the one preselected.
	-->
	<Button
		variant="ghost"
		label={cancelLabel}
		onclick={handleCancel}
		xstyle={actionXstyle}
		data-autofocus
	/>
{/snippet}

{#snippet actionButton()}
	<Button
		variant={actionVariant}
		label={actionLabel}
		onclick={onAction}
		isLoading={isActionLoading}
		xstyle={actionXstyle}
	/>
{/snippet}

{#snippet footer()}
	<LayoutFooter>
		<!--
			Generic Dialog footers should wrap, but their consumers own action
			semantics and order. AlertDialog keeps this destructive-above-Cancel
			narrow order because confirmation actions have component-specific
			meaning here.
		-->
		<Stack
			{...actionsAttachment}
			xstyle={actionsXstyle}
			direction={isSmallScreen.matches ? 'vertical' : 'horizontal'}
			gap={2}
			hAlign={isSmallScreen.matches ? 'stretch' : 'end'}
			wrap={isSmallScreen.matches ? 'nowrap' : 'wrap'}
		>
			{#if isSmallScreen.matches}
				{@render actionButton()}
				{@render cancelButton()}
			{:else}
				{@render cancelButton()}
				{@render actionButton()}
			{/if}
		</Stack>
	</LayoutFooter>
{/snippet}

<Dialog
	{...rest}
	{isOpen}
	{isInline}
	{onOpenChange}
	{width}
	purpose="form"
	role={dialogRole}
	aria-labelledby={titleId}
	aria-describedby={descriptionId}
	class={cx(theme.class, className)}
	style={styleProp}
	{xstyle}
	data-testid={testId}
>
	<Layout {content} {footer} />
</Dialog>
