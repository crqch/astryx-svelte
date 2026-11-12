<script lang="ts" module>
	export interface ListReorderFixtureMove {
		key: string | number;
		to: number;
	}

	export type ListReorderFixtureLabel = 'text' | 'rich' | 'icon' | 'icon-named';
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import List from '$lib/components/list/list.svelte';
	import ListItem from '$lib/components/list/list-item.svelte';
	import { createReorderable } from '$lib/reorderable/create-reorderable.js';

	/**
	 * A reorderable List driven by data, the Svelte counterpart of the inline
	 * JSX fixtures in Astryx's `List/__tests__/ListReorder.test.tsx`.
	 *
	 * `items` is local state, so a reported move reorders the rows exactly as a
	 * consumer applies `onReorder`. `reorderable` is made once; its callbacks
	 * read the latest props, which is upstream's "an object may be made on every
	 * render" contract without remounting the session.
	 */
	interface Props {
		initial: ReadonlyArray<string | number>;
		/** Keys the object rejects: no handle, and they bound the ends. */
		fixed?: ReadonlyArray<string | number>;
		/** Keys whose row is disabled. */
		isDisabled?: ReadonlyArray<string | number>;
		/** Omit `itemKey` from every row. */
		keyless?: boolean;
		/** The row's caller-given accessible name. */
		ariaLabel?: string;
		/** The row's caller-given `aria-labelledby`. */
		ariaLabelledBy?: string;
		/** A name element rendered before the list, for `ariaLabelledBy`. */
		externalName?: string;
		/** How each row's label renders. */
		label?: ListReorderFixtureLabel;
		/** Whether the list receives the object (false leaves it an ordinary List). */
		reorder?: boolean;
		/** Whether the object has an `isReorderable` filter. */
		hasFilter?: boolean;
		/** Make a new object whenever the rows change, as a caller may. */
		remake?: boolean;
		onReorder?: (move: ListReorderFixtureMove) => void;
	}

	let {
		initial,
		fixed = [],
		isDisabled = [],
		keyless = false,
		ariaLabel,
		ariaLabelledBy,
		externalName,
		label = 'text',
		reorder = true,
		hasFilter = true,
		remake = false,
		onReorder
	}: Props = $props();

	let items = $state<ReadonlyArray<string | number>>(untrack(() => [...initial]));

	const reorderable = createReorderable({
		onReorder: (move) => {
			onReorder?.(move);
			items = moveKey(items, move.key, move.to);
		},
		...(untrack(() => hasFilter)
			? { isReorderable: (key: string | number) => !fixed.includes(key) }
			: {})
	});

	// A caller that makes the object on every render: the engine inside is the
	// same, so the session and its reorder mode must survive.
	const liveReorderable = $derived.by(() => {
		if (!remake) {
			return reorderable;
		}
		void items;
		return createReorderable({
			onReorder: (move) => {
				onReorder?.(move);
				items = moveKey(items, move.key, move.to);
			},
			...(untrack(() => hasFilter)
				? { isReorderable: (key: string | number) => !fixed.includes(key) }
				: {})
		});
	});

	function moveKey(
		list: ReadonlyArray<string | number>,
		key: string | number,
		to: number
	): Array<string | number> {
		const next = list.filter((item) => item !== key);
		next.splice(to, 0, key);
		return next;
	}
</script>

{#if externalName != null}
	<span id="row-name">{externalName}</span>
{/if}

<List reorderable={reorder ? liveReorderable : undefined}>
	{#each items as item (String(item))}
		{#snippet labelContent()}
			{#if label === 'rich'}
				<span><strong>{item}</strong> {'mail'}</span>
			{:else if label === 'icon'}
				<svg aria-hidden="true"></svg>
			{:else}
				<svg aria-label="Starred"></svg>
			{/if}
		{/snippet}
		<ListItem
			itemKey={keyless ? undefined : item}
			label={label === 'text' ? String(item) : labelContent}
			isDisabled={isDisabled.includes(item)}
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledBy}
		/>
	{/each}
</List>
