<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { ItemAlign } from '../item/item.stylex.js';

	/**
	 * `onclick` is omitted from `BaseProps` so the narrowed redeclaration below
	 * replaces it, as `Item`'s own props do. `label`/`description` are
	 * `string | Snippet` for the same reason they are on `Item`: a *string* opts
	 * into single-line truncation, richer content does not.
	 */
	export interface ListItemProps extends Omit<BaseProps<HTMLLIElement>, 'onclick'> {
		/** Primary text label. A string single-line-truncates automatically. */
		label: string | Snippet;
		/** Secondary description below the label. */
		description?: string | Snippet;
		/** Content rendered before the item (icon, avatar, checkbox). */
		startContent?: Snippet;
		/** Content rendered after the item (badge, action button, chevron). */
		endContent?: Snippet;
		/**
		 * Vertical alignment of the start and end content against the label,
		 * forwarded to Item. Use `first-line` to keep the start and end content
		 * level with the first line of a wrapped label.
		 * @default 'center'
		 */
		align?: ItemAlign;
		/** Click handler for interactive items. Enables hover/press styles. */
		onclick?: (event: MouseEvent) => void;
		/**
		 * A nested control inside the item (e.g. a checkbox in `startContent`) that
		 * already provides the item's keyboard access and action. When set, the item
		 * becomes an enlarged click/tap target that delegates surface clicks to that
		 * control via the `useClickableContainer` pattern: it renders no invisible
		 * button/anchor, so the row adds no second tab stop (WCAG 4.1.2 — one
		 * focusable control per option). Mutually exclusive with `onclick`/`href` —
		 * when set those are ignored.
		 *
		 * Upstream takes a `RefObject<HTMLElement | null>`; this port takes a
		 * **getter**, read at the same points — the settled `useOutlineFromDOM` /
		 * `useChatStreamScroll` translation. Forwarded verbatim to `Item`.
		 */
		interactiveRef?: () => HTMLElement | null;
		/** URL for link items. Renders an invisible anchor and enables hover/press styles. */
		href?: string;
		/** Link target (e.g. `'_blank'`). Only used with `href`. */
		target?: string;
		/** Link relationship. `noopener noreferrer` is added for `target="_blank"`. */
		rel?: string;
		/**
		 * @default false
		 */
		isDisabled?: boolean;
		/**
		 * @default false
		 */
		isSelected?: boolean;
		/**
		 * The row's item key, a string or a number from the data (the shape
		 * Table's `idKey` returns). It is the row's identity for the list's
		 * animated layout, and in a reorderable List it is the key the
		 * reorderable object's `onReorder` reports and `isReorderable` is asked
		 * about. A row without one has no reorder handle and keeps its place.
		 */
		itemKey?: string | number;
	}
</script>

<script lang="ts">
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import Item from '../item/item.svelte';
	import { setItemMarkerColumns } from '../item/item-marker-columns-context.svelte.js';
	import { setItemLabelNeeded } from '../item/item-label-context.svelte.js';
	import { setItemTrailing } from '../item/item-trailing-context.svelte.js';
	import CheckboxInput from '../checkbox-input/checkbox-input.svelte';
	import { useList } from './list-context.svelte.js';
	import ListReorderHandle from './list-reorder-handle.svelte';
	import ListReorderRowName from './list-reorder-row-name.svelte';
	import { reorderRowStyle } from './list-reorder-handle.stylex.js';
	import {
		listItemXstyle,
		markerCircleAttrs,
		markerContainerAttrs,
		markerDotAttrs,
		markerNumberAttrs,
		markerSquareAttrs,
		taskMarkerContainerAttrs
	} from './list-item.stylex.js';

	/**
	 * A list item for use within `List`.
	 *
	 * Renders structured content with a label, description and start/end content
	 * areas. `onclick` uses the invisible button pattern; `href` the invisible
	 * anchor one. Density, dividers, edge treatment and markers come from the
	 * enclosing `List`.
	 *
	 * @example
	 * ```svelte
	 * <ListItem label="Settings" description="Manage your preferences" />
	 * <ListItem label="Profile" onclick={() => goto('/profile')} />
	 * ```
	 */
	let {
		label,
		description,
		startContent,
		endContent,
		align,
		onclick,
		interactiveRef,
		href,
		target,
		rel,
		isDisabled = false,
		isSelected = false,
		itemKey,
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: ListItemProps = $props();

	// Optional by design: upstream's `use(ListContext)` is `null` outside a
	// `<List>` and falls back to these same defaults, so a bare item renders.
	const list = useList();
	const isInList = list != null;
	const ctx = $derived(list?.() ?? null);
	const density = $derived(ctx?.density ?? 'balanced');
	const hasDividers = $derived(ctx?.hasDividers ?? false);
	const edge = $derived(ctx?.edge ?? 'padded');
	const listStyle = $derived(ctx?.listStyle ?? 'none');
	const hasMarkers = $derived(listStyle !== 'none');
	// ListMarkerScope may name another marker for this item.
	const markerKind = $derived(listStyle === 'none' ? null : (ctx?.marker ?? listStyle));
	// A task item in a list with markers shows its checkbox instead.
	const task = $derived(markerKind == null ? undefined : ctx?.task);
	const hasMarkerGutter = $derived(ctx?.hasMarkerGutter === true);
	// Only numbered rows contribute two cells to List's shared counter grid.
	const usesNumberColumns = $derived(
		listStyle === 'decimal' && ctx?.isOutsideNumberColumns !== true
	);
	// Under a finger, the row's hit target grows where its neighbors leave
	// room; the composed press layer rides only such an interactive row.
	const isTouchTarget = $derived(
		(onclick != null || href != null || interactiveRef != null) && !isDisabled
	);

	// The row's element, which a row without a handle names for the reorder.
	let rowEl = $state<HTMLElement | null>(null);
	// In a reorderable List: a trailing handle, or a row that stays put.
	const reorder = $derived(ctx?.reorder ?? null);
	const hasHandle = $derived(
		reorder != null && itemKey != null && (reorder.options.isReorderable?.(itemKey) ?? true)
	);
	// The handle is the one element reordering adds to a row. With end content
	// it joins the end slot. Without, it is the row's own child
	// (ItemTrailingContext), since an end slot of its own would be a second
	// element.
	const isHandleInRow = $derived(hasHandle && endContent == null);
	const rowLabel = $derived(rest['aria-label'] ?? undefined);
	const rowLabelledBy = $derived(rest['aria-labelledby'] ?? undefined);
	const rowAlign = $derived(isHandleInRow ? (align ?? 'center') : undefined);
	// The handle is named after the row's label, and a row without one still
	// has a name for the announcements of the moves beside it.
	setItemLabelNeeded(() => hasHandle);
	setItemTrailing(() => (isHandleInRow ? reorderHandleSnippet : null));

	// Upstream wraps numbered rows in `ItemMarkerColumnsContext`; the Item reads
	// this getter and renders its content as one cell beside the marker.
	setItemMarkerColumns(() => usesNumberColumns);

	// Upstream types `ListItem`'s props `BaseProps<HTMLLIElement>` — the element
	// `Item` really renders for `as="li"` — while `Item`'s own props are
	// `BaseProps<HTMLElement>`. Event handlers are contravariant in that element
	// type, so the two are incompatible at the seam even though the DOM agrees.
	// The public type stays upstream's; the widening happens at the one point the
	// rest props cross into `Item`, rather than by weakening what we publish.
	const itemRest = $derived(rest as Omit<BaseProps<HTMLElement>, 'onclick'>);

	const theme = themeProps('list-item');
	const containerAttrs = markerContainerAttrs();
	const dotAttrs = markerDotAttrs();
	const circleAttrs = markerCircleAttrs();
	const squareAttrs = markerSquareAttrs();
	const taskContainerAttrs = taskMarkerContainerAttrs();
</script>

{#snippet reorderHandleSnippet()}
	{#if hasHandle && itemKey != null}
		<ListReorderHandle {label} {itemKey} {isDisabled} {rowLabel} {rowLabelledBy} {rowAlign} />
	{/if}
{/snippet}

{#snippet itemEndContent()}
	{#if endContent != null}{@render endContent()}{/if}
	{#if hasHandle && !isHandleInRow}{@render reorderHandleSnippet()}{/if}
{/snippet}

{#snippet marker()}
	{#if task != null}
		<span class={taskContainerAttrs.class} style={taskContainerAttrs.style}>
			<CheckboxInput size="sm" value={task.isChecked} label={task.label} isLabelHidden isReadOnly />
		</span>
	{:else if markerKind === 'disc' || markerKind === 'circle' || markerKind === 'square'}
		<span class={containerAttrs.class} style={containerAttrs.style}>
			<span
				class={markerKind === 'disc'
					? dotAttrs.class
					: markerKind === 'circle'
						? circleAttrs.class
						: squareAttrs.class}
				style={markerKind === 'disc'
					? dotAttrs.style
					: markerKind === 'circle'
						? circleAttrs.style
						: squareAttrs.style}
			></span>
		</span>
	{:else if markerKind != null}
		{@const numberAttrs = markerNumberAttrs(markerKind, hasMarkerGutter)}
		<span class={numberAttrs.class} style={numberAttrs.style}></span>
	{/if}
{/snippet}

<Item
	data-astryx-item-key={itemKey == null ? undefined : String(itemKey)}
	{...itemRest}
	as="li"
	marker={hasMarkers ? marker : undefined}
	{startContent}
	{label}
	{description}
	endContent={hasHandle && !isHandleInRow ? itemEndContent : endContent}
	{align}
	{onclick}
	{interactiveRef}
	{href}
	target={target as '_blank' | '_self' | undefined}
	{rel}
	{isDisabled}
	{isSelected}
	{density}
	xstyle={listItemXstyle({
		hasMarkers,
		isOrdered: listStyle === 'decimal',
		usesNumberColumns,
		hasDividers,
		hasPressDividers: hasDividers && isTouchTarget,
		isTouchTarget,
		isInList,
		edge,
		hasReorderHandle: hasHandle,
		xstyle
	})}
	class={cx(theme.class, className)}
	style={styleProp}
	bind:ref={rowEl}
/>

{#if reorder != null && !hasHandle}
	<ListReorderRowName row={() => rowEl} {label} />
{/if}
