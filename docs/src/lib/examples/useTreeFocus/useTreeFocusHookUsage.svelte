<!--
	Ported from upstream's `templates/blocks/components/Hooks/useTreeFocusHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useTreeFocus` takes its options through a getter, returns `attachTree` for
	upstream's `treeRef`, and its `handleFocus` goes on `onfocusin` because
	Svelte's `onfocus` does not bubble. Upstream's `renderRow` becomes a snippet.
	Heroicons' chevrons are replaced by the registry's `chevronDown`/`chevronRight`
	— the substitution upstream's block metadata names.
-->
<script lang="ts">
	import { HStack, Icon, Text, VStack, rtlStyles, useTreeFocus } from '@astryx-sv/core';

	type FileNode = { name: string; children?: FileNode[] };

	const FILES: FileNode[] = [
		{ name: 'src', children: [{ name: 'index.ts' }, { name: 'theme.ts' }] },
		{ name: 'docs', children: [{ name: 'intro.md' }, { name: 'usage.md' }] },
		{ name: 'package.json' },
		{ name: 'README.md' }
	];

	const FOLDERS = new Set(FILES.filter((node) => node.children != null).map((node) => node.name));

	let expanded = $state<ReadonlySet<string>>(new Set(['src']));
	let openFile = $state<string | null>(null);

	function toggle(name: string) {
		const next = new Set(expanded);
		if (!next.delete(name)) {
			next.add(name);
		}
		expanded = next;
	}

	const tree = useTreeFocus(() => ({
		hasRovingTabIndex: true,
		onToggleExpand: toggle,
		onActivate: (_item, name) => {
			if (name == null || FOLDERS.has(name)) {
				return false;
			}
			openFile = name;
			return true;
		}
	}));
</script>

{#snippet renderRow(node: FileNode, level: 1 | 2)}
	{@const isFolder = node.children != null}
	{@const isExpanded = expanded.has(node.name)}
	<HStack
		role="treeitem"
		aria-level={level}
		aria-expanded={isFolder ? isExpanded : undefined}
		aria-selected={isFolder ? undefined : openFile === node.name}
		data-tree-id={node.name}
		gap={1}
		vAlign="center"
		paddingInlineStart={isFolder ? 0 : level === 1 ? 5 : 10}
		onclick={() => (isFolder ? toggle(node.name) : (openFile = node.name))}
	>
		{#if isFolder}
			{#if isExpanded}
				<Icon icon="chevronDown" />
			{:else}
				<!-- The collapsed chevron points toward the inline end, where
				     ArrowRight (ArrowLeft under RTL) opens the folder. -->
				<Icon icon="chevronRight" xstyle={rtlStyles.mirror} />
			{/if}
		{/if}
		<Text type="body">{node.name}</Text>
	</HStack>
{/snippet}

<VStack gap={3} width={240}>
	<VStack
		{@attach tree.attachTree}
		role="tree"
		aria-label="Files"
		gap={1}
		onkeydown={tree.handleKeyDown}
		onfocusin={tree.handleFocus}
	>
		{#each FILES as node (node.name)}
			{@render renderRow(node, 1)}
			{#if expanded.has(node.name)}
				{#each node.children ?? [] as child (child.name)}
					{@render renderRow(child, 2)}
				{/each}
			{/if}
		{/each}
	</VStack>
	<Text type="supporting">Open file: {openFile ?? 'none'}</Text>
</VStack>
