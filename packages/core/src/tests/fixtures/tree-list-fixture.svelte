<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { TreeListItemData } from '$lib/components/tree-list/tree-list-types.js';

	/**
	 * One item's spec. Identical to `TreeListItemData` except that the two snippet
	 * slots are named by string, so a test can describe a whole *tree* as data —
	 * a Svelte snippet can only be authored in a template, and the recursion means
	 * there is no `{#each}` for the test to hang one off. A case that needs
	 * element content or a listener attaches a raw snippet directly.
	 */
	export interface TreeListFixtureItem extends Omit<
		TreeListItemData,
		'children' | 'startContent' | 'endContent'
	> {
		/** Key into the fixture's snippet table, filling `startContent`. */
		startSlot?: 'star';
		/** Key into the fixture's snippet table, filling `endContent`. */
		endSlot?: 'badge';
		/** Raw content for `startContent` (wins over `startSlot`). */
		startContent?: Snippet;
		/** Raw content for `endContent` (wins over `endSlot`). */
		endContent?: Snippet;
		children?: TreeListFixtureItem[];
	}

	function withSlots(
		list: TreeListFixtureItem[],
		slots: Record<string, Snippet>
	): TreeListItemData[] {
		return list.map(({ startSlot, endSlot, children, ...item }) => ({
			...item,
			startContent: item.startContent ?? (startSlot != null ? slots[startSlot] : undefined),
			endContent: item.endContent ?? (endSlot != null ? slots[endSlot] : undefined),
			children: children != null ? withSlots(children, slots) : undefined
		}));
	}
</script>

<script lang="ts">
	import TreeList from '$lib/components/tree-list/tree-list.svelte';

	interface Props {
		/** Props for the `<TreeList>` itself. */
		tree?: Record<string, unknown>;
		items: TreeListFixtureItem[];
		/** `header`, rendered as `<span>{headerText}</span>` as upstream's case does. */
		headerText?: string;
		/** Raw header value, for upstream's empty-slot and `0` cases. */
		header?: string | false | true | null | number;
		/** Raw header content, for a header that is more than text (a button). */
		headerContent?: Snippet;
		/** Receives the tree root element, the port's counterpart to upstream's `ref`. */
		onRoot?: (element: HTMLElement) => void;
		/** Render upstream's `<button>Elsewhere</button>` sibling after the tree. */
		elsewhere?: boolean;
	}

	const {
		tree = {},
		items,
		headerText,
		header,
		headerContent,
		onRoot,
		elsewhere = false
	}: Props = $props();
</script>

{#snippet star()}
	<span data-testid="icon">★</span>
{/snippet}

{#snippet badge()}
	<span data-testid="badge">3</span>
{/snippet}

{#snippet headerSnippet()}
	<span>{headerText}</span>
{/snippet}

<TreeList
	{...tree}
	items={withSlots(items, { star, badge })}
	header={headerContent ??
		(headerText != null ? headerSnippet : (header as string | Snippet | undefined))}
	{@attach (element) => {
		onRoot?.(element as HTMLElement);
	}}
/>

{#if elsewhere}
	<button type="button">Elsewhere</button>
{/if}
