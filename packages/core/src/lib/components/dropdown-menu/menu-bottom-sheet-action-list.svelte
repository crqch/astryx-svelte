<script lang="ts" module>
	import type { DropdownMenuItemData, DropdownMenuOption } from './dropdown-menu-types.js';

	export interface MenuBottomSheetActionListProps {
		items: DropdownMenuOption[];
		onSelect: (item: DropdownMenuItemData, event: MouseEvent) => void;
		onOpenSubmenu: (item: DropdownMenuItemData) => void;
	}
</script>

<script lang="ts">
	import Divider from '../divider/divider.svelte';
	import Heading from '../heading/heading.svelte';
	import Icon from '../icon/icon.svelte';
	import List from '../list/list.svelte';
	import ListItem from '../list/list-item.svelte';
	import {
		getInteractionModality,
		trackInteractionModality
	} from '../../utils/interaction-modality.js';
	import { rtlStyles } from '../../utils/rtl.stylex.js';
	import {
		menuBottomSheetActionListAttrs,
		menuBottomSheetDestructiveActionStyle,
		menuBottomSheetDividerStyle,
		menuBottomSheetSectionAttrs,
		menuBottomSheetSectionHeadingStyle,
		menuBottomSheetStructuralItemAttrs
	} from './menu-bottom-sheet-action-list.stylex.js';

	/**
	 * Ported from Astryx's `DropdownMenu/MenuBottomSheetActionList.tsx`.
	 *
	 * The touch-friendly action list shared by the menu family's sheet
	 * presentations. Rows are `ListItem` actions at `spacious` density; a
	 * divider or a titled section is a structural `<li>` around the row or the
	 * nested list, so the list keeps a semantic child structure.
	 *
	 * Upstream's `useMenuPress` press model has no Svelte counterpart in this
	 * port (the menu rows use native click and focus), so the rows act on click
	 * and the pointer blur mirrors the visible half: a pointer activation does
	 * not leave a focus ring on the row.
	 */
	const { items, onSelect, onOpenSubmenu }: MenuBottomSheetActionListProps = $props();

	$effect(() => {
		trackInteractionModality();
	});

	const listAttrs = menuBottomSheetActionListAttrs();
	const structuralAttrs = menuBottomSheetStructuralItemAttrs();
	const sectionAttrs = menuBottomSheetSectionAttrs();

	function itemKey(item: DropdownMenuItemData, index: number): string {
		return `item-${item.id ?? index}`;
	}

	function activate(item: DropdownMenuItemData, event: MouseEvent): void {
		if (item.isDisabled) {
			return;
		}
		if (getInteractionModality() === 'pointer') {
			(event.currentTarget as HTMLElement | null)?.blur();
		}
		if (item.items != null && item.items.length > 0) {
			onOpenSubmenu(item);
		} else {
			onSelect(item, event);
		}
	}

	function hasSubmenu(item: DropdownMenuItemData): boolean {
		return item.items != null && item.items.length > 0;
	}

	function optionKey(option: DropdownMenuOption, index: number): string {
		if ('type' in option) {
			return option.type === 'divider' ? `divider-${index}` : `section-${option.id ?? index}`;
		}
		return itemKey(option, index);
	}
</script>

{#snippet actionRow(item: DropdownMenuItemData, index: number)}
	{#if hasSubmenu(item)}
		{#snippet chevron()}
			<Icon icon="chevronRight" size="sm" color="secondary" xstyle={rtlStyles.mirror} />
		{/snippet}
		{#snippet start()}
			{#if item.icon != null}
				{#if typeof item.icon === 'string'}
					<Icon
						icon={item.icon}
						size="sm"
						color={item.variant === 'destructive' ? 'error' : 'secondary'}
					/>
				{:else}
					{@render item.icon()}
				{/if}
			{/if}
		{/snippet}
		<ListItem
			label={item.label}
			description={item.description}
			startContent={item.icon != null ? start : undefined}
			endContent={chevron}
			isDisabled={item.isDisabled}
			onclick={(event) => activate(item, event)}
			xstyle={item.variant === 'destructive' ? menuBottomSheetDestructiveActionStyle : undefined}
		/>
	{:else}
		{#snippet start()}
			{#if item.icon != null}
				{#if typeof item.icon === 'string'}
					<Icon
						icon={item.icon}
						size="sm"
						color={item.variant === 'destructive' ? 'error' : 'secondary'}
					/>
				{:else}
					{@render item.icon()}
				{/if}
			{/if}
		{/snippet}
		<ListItem
			label={item.label}
			description={item.description}
			startContent={item.icon != null ? start : undefined}
			endContent={item.endContent}
			isDisabled={item.isDisabled}
			onclick={(event) => activate(item, event)}
			xstyle={item.variant === 'destructive' ? menuBottomSheetDestructiveActionStyle : undefined}
		/>
	{/if}
{/snippet}

{#snippet sectionItems(section: { items: DropdownMenuItemData[] })}
	<List density="spacious">
		{#each section.items as item, index (itemKey(item, index))}
			{@render actionRow(item, index)}
		{/each}
	</List>
{/snippet}

<List density="spacious" {...listAttrs}>
	{#each items as option, index (optionKey(option, index))}
		{#if 'type' in option && option.type === 'divider'}
			<li role="presentation" {...structuralAttrs}>
				<Divider xstyle={menuBottomSheetDividerStyle} />
			</li>
		{:else if 'type' in option && option.type === 'section'}
			<li {...structuralAttrs}>
				<div role="group" aria-label={option.title} {...sectionAttrs}>
					{#if option.title}
						<Heading level={4} xstyle={menuBottomSheetSectionHeadingStyle}>{option.title}</Heading>
					{/if}
					{@render sectionItems(option)}
				</div>
			</li>
		{:else}
			{@render actionRow(option, index)}
		{/if}
	{/each}
</List>
