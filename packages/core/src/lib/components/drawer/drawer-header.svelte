<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';

	export interface DrawerHeaderProps extends BaseProps<HTMLDivElement> {
		/** Ref forwarded to the header's root content row. */
		ref?: HTMLDivElement | null;
		/** The drawer title, rendered as an h2. Keep it inline and non-interactive. */
		title: string | number | Snippet;
		/** Optional subtitle below the title, in smaller secondary text. */
		subtitle?: string | number | Snippet;
		/**
		 * Called with `false` when the close button is clicked. Pass the Drawer's
		 * own `onOpenChange`. If omitted, no close button is rendered.
		 */
		onOpenChange?: (isOpen: boolean) => unknown;
		/** Content before the title (e.g. a back button). */
		startContent?: Snippet;
		/** Content after the title, before the close button (e.g. action buttons). */
		endContent?: Snippet;
		/**
		 * Overrides automatic end-slot compensation. When omitted, rendering the
		 * close action compensates both block and inline-end.
		 */
		endContentEdgeCompensation?: 'inline' | 'block' | 'all';
		/** Adds a themed bottom border on the LayoutHeader. */
		hasDivider?: boolean;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle, sx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import LayoutHeader, { type LayoutHeaderProps } from '../layout/layout-header.svelte';
	import Button from '../button/button.svelte';
	import Icon from '../icon/icon.svelte';
	import Heading from '../heading/heading.svelte';
	import Text from '../text/text.svelte';
	import {
		drawerHeaderActionsStyle,
		drawerHeaderContainerStyle,
		drawerHeaderEndBlockCompensationStyle,
		drawerHeaderEndInlineCompensationStyle,
		drawerHeaderTitleWrapperStyle
	} from './drawer-header.stylex.js';

	/**
	 * Header for a Drawer, ported from Astryx's `Drawer/DrawerHeader.tsx`.
	 *
	 * Mirrors DialogHeader's API: a title, optional subtitle and start/end
	 * content, and a close button when `onOpenChange` is passed. It does not move
	 * focus on mount — Drawer owns focus entry through `data-autofocus`.
	 */
	let {
		title,
		subtitle,
		onOpenChange,
		startContent,
		endContent,
		endContentEdgeCompensation,
		hasDivider,
		ref = $bindable(null),
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: DrawerHeaderProps = $props();

	const t = useTranslator();
	const hasSubtitle = $derived(subtitle != null && subtitle !== '');
	const shouldCompensateEndBlock = $derived(
		endContentEdgeCompensation == null
			? onOpenChange != null
			: endContentEdgeCompensation === 'block' || endContentEdgeCompensation === 'all'
	);
	const shouldCompensateEndInline = $derived(
		endContentEdgeCompensation == null
			? onOpenChange != null
			: endContentEdgeCompensation === 'inline' || endContentEdgeCompensation === 'all'
	);
	const container = $derived(themeProps('drawer-header'));
	const start = $derived(themeProps('drawer-header-start-content'));
	const titleBlock = $derived(themeProps('drawer-header-title-block'));
	const end = $derived(themeProps('drawer-header-end-content'));
	const closeIcon = $derived(themeProps('drawer-header-close-icon'));
	const containerAttrs = sx(drawerHeaderContainerStyle);
	const titleAttrs = sx(drawerHeaderTitleWrapperStyle);
	const actions = sx(drawerHeaderActionsStyle);
	const endAttrs = $derived(
		sx(
			drawerHeaderActionsStyle,
			shouldCompensateEndBlock && drawerHeaderEndBlockCompensationStyle,
			shouldCompensateEndInline && drawerHeaderEndInlineCompensationStyle
		)
	);
</script>

<LayoutHeader
	{hasDivider}
	{xstyle}
	class={className}
	style={styleProp}
	{...rest as LayoutHeaderProps}
>
	<div
		bind:this={ref}
		{...container}
		class={cx(container.class, containerAttrs.class)}
		style={containerAttrs.style}
	>
		{#if startContent}
			<div {...start} class={cx(start.class, actions.class)} style={actions.style}>
				{@render startContent()}
			</div>
		{/if}
		<div {...titleBlock} class={cx(titleBlock.class, titleAttrs.class)} style={titleAttrs.style}>
			<Heading level={2}
				>{#if typeof title === 'function'}{@render title()}{:else}{title}{/if}</Heading
			>
			{#if hasSubtitle}
				<Text type="body" size="sm" color="secondary">
					{#if typeof subtitle === 'function'}{@render subtitle()}{:else}{subtitle}{/if}
				</Text>
			{/if}
		</div>
		{#if endContent || onOpenChange}
			<div {...end} class={cx(end.class, endAttrs.class)} style={endAttrs.style}>
				{#if endContent}{@render endContent()}{/if}
				{#if onOpenChange}
					<Button
						variant="ghost"
						label={t('@astryx.dialog.close')}
						tooltip={t('@astryx.dialog.close')}
						isIconOnly
						onclick={() => onOpenChange?.(false)}
					>
						{#snippet icon()}
							<Icon icon="close" color="inherit" {...closeIcon} />
						{/snippet}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</LayoutHeader>
