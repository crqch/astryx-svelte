<!--
	Ported from upstream's `templates/blocks/components/MoreMenu/MoreMenuBottomSheet.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { MoreMenu } from '@astryx-sv/core';

	/**
	 * Upstream passes Heroicons' `Pencil`, `DocumentDuplicate`, `Share` and
	 * `Trash` components. Item icons are registry names or snippets here, and
	 * the registry ships none of the four, so these are built-in substitutions.
	 * Retires with the icon registry (port/todo.md).
	 */
</script>

<div
	style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: min(100%, 360px); padding: 16px; border: 1px solid #d1d5db; border-radius: 12px"
>
	<div style="display: flex; flex-direction: column; gap: 4px">
		<strong>Quarterly plan</strong>
		<span>Updated a few minutes ago</span>
	</div>
	<MoreMenu
		presentation="bottom-sheet"
		label="Project actions"
		items={[
			{
				label: 'Rename project',
				description: 'Update the project title.',
				icon: 'wrench',
				onClick: () => {}
			},
			{
				label: 'Duplicate project',
				description: 'Create a copy in this workspace.',
				icon: 'copy',
				onClick: () => {}
			},
			{
				label: 'Share project',
				description: 'Invite people to collaborate.',
				icon: 'externalLink',
				onClick: () => {}
			},
			{
				label: 'Delete project',
				description: 'Move this project to the trash.',
				icon: 'close',
				variant: 'destructive',
				onClick: () => {}
			}
		]}
	/>
</div>
