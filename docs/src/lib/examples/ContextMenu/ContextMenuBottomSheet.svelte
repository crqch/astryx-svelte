<!--
	Ported from upstream's `templates/blocks/components/ContextMenu/ContextMenuBottomSheet.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { ContextMenu } from '@astryx-sv/core';

	/**
	 * Upstream passes Heroicons' `Pencil`, `DocumentDuplicate`, `Share` and
	 * `Trash` components. Item icons are registry names or snippets here, and
	 * the registry ships none of the four, so these are built-in substitutions.
	 * Retires with the icon registry (port/todo.md).
	 */
</script>

<ContextMenu
	presentation="bottom-sheet"
	label="Document actions"
	items={[
		{
			label: 'Rename document',
			description: 'Change the title shown to collaborators.',
			icon: 'wrench',
			onClick: () => {}
		},
		{
			label: 'Duplicate document',
			description: 'Create a copy in the same workspace.',
			icon: 'copy',
			onClick: () => {}
		},
		{
			label: 'Share document',
			description: 'Invite people or copy a share link.',
			icon: 'externalLink',
			onClick: () => {}
		},
		{
			label: 'Delete document',
			description: 'Move this document to the trash.',
			icon: 'close',
			variant: 'destructive',
			onClick: () => {}
		}
	]}
>
	<div
		style="display: flex; flex-direction: column; gap: 8px; padding: 32px; border: 1px solid #d1d5db; border-radius: 12px"
	>
		<strong>Quarterly plan</strong>
		<span>Long-press on touch or right-click for document actions.</span>
	</div>
</ContextMenu>
