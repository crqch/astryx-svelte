<script lang="ts">
	import Collapsible from '$lib/components/collapsible/collapsible.svelte';
	import CollapsibleGroup from '$lib/components/collapsible/collapsible-group.svelte';
	import TreeList from '$lib/components/tree-list/tree-list.svelte';
	import type { TreeListItemData } from '$lib/components/tree-list/tree-list-types.js';
	import { useAnimatedLayout } from '$lib/hooks/use-animated-layout.svelte.js';

	/**
	 * Stands in for upstream's inline `Area` plus the JSX around each component
	 * in `motion/animatedLayoutAdopters.test.tsx`: a container that owns the
	 * handle, the component under test, and a paragraph after it (the element
	 * the glide moves, or must leave alone).
	 *
	 * `kind` picks the markup upstream authors inline. `withHandle` drops the
	 * handle while leaving the same tree, so a case can rerender a live
	 * component with and without one.
	 */
	interface Props {
		kind: 'collapsible' | 'tree' | 'group';
		withHandle: boolean;
		/** Collapsible: controlled open state. */
		isOpen?: boolean;
		/** Collapsible: uncontrolled initial state. */
		defaultIsOpen?: boolean;
		onOpenChange?: (isOpen: boolean) => void;
		/** Collapsible: the content is a focusable button instead of text. */
		childKind?: 'text' | 'button';
		/** TreeList: the items. */
		items?: TreeListItemData[];
		/** Group: three accordion items, or the two-item controlled pair. */
		groupVariant?: 'accordion' | 'pair';
		/** Group: controlled value for the pair. */
		groupValue?: string;
	}

	let {
		kind,
		withHandle,
		isOpen,
		defaultIsOpen,
		onOpenChange,
		childKind = 'text',
		items = [{ id: 'src', label: 'src', children: [{ id: 'index', label: 'index.ts' }] }],
		groupVariant = 'accordion',
		groupValue
	}: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	const layout = useAnimatedLayout({ container: () => container });
	const handle = $derived(withHandle ? layout : undefined);
</script>

{#snippet textBody()}
	Hidden content
{/snippet}

{#snippet buttonBody()}
	<button type="button">Inside</button>
{/snippet}

<div bind:this={container} data-testid="area">
	{#if kind === 'collapsible'}
		<Collapsible trigger="Details" animatedLayout={handle} {isOpen} {defaultIsOpen} {onOpenChange}>
			{#if childKind === 'button'}{@render buttonBody()}{:else}{@render textBody()}{/if}
		</Collapsible>
	{:else if kind === 'tree'}
		<TreeList {items} animatedLayout={handle} />
	{:else if groupVariant === 'pair'}
		<CollapsibleGroup value={groupValue} onChange={() => {}}>
			<Collapsible trigger="One" value="one" animatedLayout={handle}>First</Collapsible>
			<Collapsible trigger="Two" value="two" animatedLayout={handle}>Second</Collapsible>
		</CollapsibleGroup>
	{:else}
		<CollapsibleGroup type="single" defaultValue="shipping">
			<Collapsible value="shipping" trigger="Shipping" animatedLayout={handle}>
				Shipping details
			</Collapsible>
			<Collapsible value="payment" trigger="Payment" animatedLayout={handle}>
				Payment details
			</Collapsible>
			<Collapsible value="warranty" trigger="Warranty" animatedLayout={handle}>
				Warranty details
			</Collapsible>
		</CollapsibleGroup>
	{/if}
	<p data-testid="after">Notes</p>
</div>
