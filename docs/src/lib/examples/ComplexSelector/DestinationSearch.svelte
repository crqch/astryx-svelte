<!--
	Helper for `ComplexSelectorTreeSearch.svelte`, transcribed from the
	`DestinationSearch` component in upstream's block. It is a separate file so
	the search query resets every time the popup mounts, matching upstream's
	component-local `useState`.
-->
<script lang="ts">
	import { Text, TextInput, TreeList, VStack, type TreeListItemData } from '@astryx-sv/core';

	interface DestinationNode {
		id: string;
		label: string;
		path: string;
		children?: DestinationNode[];
	}

	interface Destination {
		id: string;
		label: string;
		path: string;
	}

	let {
		tree,
		value,
		onChange,
		close
	}: {
		tree: DestinationNode[];
		value: Destination;
		onChange: (value: Destination) => void;
		close: () => void;
	} = $props();

	let query = $state('');

	function matches(node: DestinationNode, needle: string): boolean {
		if (node.label.toLowerCase().includes(needle)) {
			return true;
		}
		return (node.children ?? []).some((child) => matches(child, needle));
	}

	function filterTree(nodes: DestinationNode[], needle: string): DestinationNode[] {
		if (!needle) {
			return nodes;
		}
		return nodes
			.filter((node) => matches(node, needle))
			.map((node) => ({
				...node,
				children: node.children ? filterTree(node.children, needle) : undefined
			}));
	}

	function toItems(
		nodes: DestinationNode[],
		selectedId: string,
		onSelect: (next: Destination) => void
	): TreeListItemData[] {
		return nodes.map((node) => {
			const hasChildren = (node.children ?? []).length > 0;
			return {
				id: node.id,
				label: node.label,
				isSelected: node.id === selectedId,
				isExpanded: true,
				onClick: hasChildren
					? undefined
					: () => onSelect({ id: node.id, label: node.label, path: node.path }),
				children: hasChildren ? toItems(node.children ?? [], selectedId, onSelect) : undefined
			};
		});
	}

	const items = $derived(
		toItems(filterTree(tree, query.toLowerCase()), value.id, (next) => {
			onChange(next);
			close();
		})
	);
</script>

<VStack gap={3} style="width: 360px">
	<TextInput
		label="Search destinations"
		isLabelHidden
		value={query}
		onChange={(next) => (query = next)}
		hasClear
		placeholder="Search folders or teams"
	/>
	{#if items.length > 0}
		<TreeList {items} density="compact" />
	{:else}
		<Text type="supporting" color="secondary">No matching destinations.</Text>
	{/if}
</VStack>
