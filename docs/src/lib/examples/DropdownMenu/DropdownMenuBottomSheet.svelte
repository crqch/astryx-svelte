<!--
	Ported from upstream's `templates/blocks/components/DropdownMenu/DropdownMenuBottomSheet.tsx`.
	The doc lists this block under `BottomSheet` and `useMediaQuery` as well as
	`DropdownMenu` (`alsoExampleFor`); the registry keys a block by component, so
	the other pages render the same block rather than a second copy of it.
-->
<script lang="ts">
	import { DropdownMenu, Text, VStack } from '@astryx-sv/core';
	import { useMediaQuery } from '@astryx-sv/core/hooks';

	/**
	 * Upstream passes Heroicons' `Pencil`, `DocumentDuplicate`, `Share` and
	 * `ArchiveBox` components. Item icons are registry names or snippets here,
	 * and the registry ships none of the four, so these are built-in
	 * substitutions. Retires with the icon registry (port/todo.md).
	 */
	const COMPACT_TOUCH_QUERY = '(max-width: 639px) and (pointer: coarse) and (hover: none)';

	const ACTIONS = [
		{ label: 'Edit project', icon: 'wrench' },
		{ label: 'Duplicate project', icon: 'copy' },
		{ label: 'Share project', icon: 'externalLink' },
		{ label: 'Archive project', icon: 'stop' }
	] as const;

	const isCompactTouchSurface = useMediaQuery(() => COMPACT_TOUCH_QUERY);
	let lastAction = $state<string | null>(null);
</script>

<VStack gap={3}>
	<DropdownMenu
		button={{ label: 'Project actions' }}
		presentation={isCompactTouchSurface.matches ? 'bottom-sheet' : 'popover'}
		items={ACTIONS.map(({ label, icon }) => ({
			label,
			icon,
			onClick: () => (lastAction = label)
		}))}
	/>
	{#if lastAction}
		<Text type="supporting" color="secondary">Last action: {lastAction}</Text>
	{/if}
</VStack>
