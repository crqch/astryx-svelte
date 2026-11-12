<script lang="ts" module>
	export interface SheetConfirmationProps {
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		title: string;
		description: string;
		cancelLabel: string;
		actionLabel: string;
		onAction: () => void;
	}
</script>

<script lang="ts">
	import Button from '../components/button/button.svelte';
	import Dialog from '../components/dialog/dialog.svelte';
	import Heading from '../components/heading/heading.svelte';
	import Layout from '../components/layout/layout.svelte';
	import LayoutContent from '../components/layout/layout-content.svelte';
	import LayoutFooter from '../components/layout/layout-footer.svelte';
	import Stack from '../components/stack/stack.svelte';
	import Text from '../components/text/text.svelte';
	import { themeProps } from './theme-props.js';
	import { sheetConfirmationActionStyle } from './sheet-confirmation.stylex.js';

	/**
	 * Ported from Astryx's `internal/SheetConfirmation.tsx`.
	 *
	 * The confirmation a touch sheet opens over itself for Clear all and for
	 * discarding a changed draft. AlertDialog fixes its purpose to form and its
	 * safe action to ghost; a touch sheet's confirmation allows scrim dismissal.
	 * Its two full-width large actions are stacked and separated: the destructive
	 * action first in reading order, the safe action focused first. The
	 * alert-dialog theme target stays.
	 *
	 * Core-internal, not a public export — the same position as upstream's. It is
	 * the Svelte sibling of the two `BottomSheet` hosts: both callers own the open
	 * state and read a close request as a dismissal.
	 */

	const {
		isOpen,
		onOpenChange,
		title,
		description,
		cancelLabel,
		actionLabel,
		onAction
	}: SheetConfirmationProps = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const descriptionId = `${uid}-description`;
</script>

<Dialog
	{...themeProps('alert-dialog')}
	{isOpen}
	{onOpenChange}
	purpose="info"
	role="alertdialog"
	aria-labelledby={titleId}
	aria-describedby={descriptionId}
	width={400}
>
	<Layout>
		{#snippet content()}
			<LayoutContent>
				<Heading level={2} id={titleId}>{title}</Heading>
				<Text type="body" color="secondary" id={descriptionId}>{description}</Text>
			</LayoutContent>
		{/snippet}
		{#snippet footer()}
			<LayoutFooter>
				<Stack direction="vertical" gap={4} hAlign="stretch">
					<Button
						label={actionLabel}
						variant="destructive"
						size="lg"
						onclick={onAction}
						xstyle={sheetConfirmationActionStyle}
					/>
					<Button
						label={cancelLabel}
						variant="secondary"
						size="lg"
						onclick={() => onOpenChange(false)}
						data-autofocus
						xstyle={sheetConfirmationActionStyle}
					/>
				</Stack>
			</LayoutFooter>
		{/snippet}
	</Layout>
</Dialog>
