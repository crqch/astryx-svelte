<script lang="ts" module>
	import type { ItemSwipeAction, ItemSwipeBehavior } from './item-swipe-types.js';
	import type { SwipeHandlers, SwipeSide } from './use-swipe-action.svelte.js';

	/**
	 * What the root needs from the gesture: the handlers it forwards its events
	 * into, and the test for the click the browser synthesizes after a drag. The
	 * layer writes it when it mounts; the root reads it on every event.
	 */
	export interface ItemSwipeBridge {
		handlers: SwipeHandlers;
		shouldSuppressClick: () => boolean;
	}

	export interface ItemSwipeLayerProps {
		/** The row root: the gesture's target and the element that translates. */
		rootRef: () => HTMLElement | null;
		/**
		 * Called with the gesture for the root to forward into, after the layer
		 * mounts, and with `null` when the layer leaves.
		 */
		onBridge: (bridge: ItemSwipeBridge | null) => void;
		leading: ItemSwipeAction[];
		trailing: ItemSwipeAction[];
		behavior: ItemSwipeBehavior;
	}
</script>

<script lang="ts">
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import {
		itemSwipeEntriesAttrs,
		itemSwipeEntryAttrs,
		itemSwipeEntryFocusAttrs,
		itemSwipePanelAttrs
	} from './item-swipe-layer.stylex.js';
	import { useSwipeAction } from './use-swipe-action.svelte.js';

	/**
	 * The swipe half of an `Item` with `swipeActions`: both panels, rendered into
	 * the root Item owns, and the gesture that drives that root.
	 *
	 * Ported from Astryx's `Item/ItemSwipeLayer.tsx`. Upstream loads this module
	 * on demand through `React.lazy`; `item.svelte`'s `{#await import(…)}` is the
	 * same seam, so a row without swipe actions never loads the gesture.
	 *
	 * The row's root stays Item's: it carries the swipe root styles and forwards
	 * its pointer, click-capture and key events into the bridge this layer fills.
	 * This layer renders the two panels as out-of-flow children of that root and
	 * runs the gesture against it, so the DOM is the one Item rendered before the
	 * split — no element is added for the swipe.
	 */
	let { rootRef, onBridge, leading, trailing, behavior }: ItemSwipeLayerProps = $props();

	let leadingEntries = $state<HTMLDivElement | null>(null);
	let trailingEntries = $state<HTMLDivElement | null>(null);
	const reducedMotion = useMediaQuery(() => '(prefers-reduced-motion: reduce)');

	function outermost(side: SwipeSide): ItemSwipeAction | undefined {
		const entries = side === 'leading' ? leading : trailing;
		return entries[entries.length - 1];
	}

	const swipe = useSwipeAction({
		isEnabled: true,
		behavior: () => behavior,
		sides: () => ({ leading: leading.length > 0, trailing: trailing.length > 0 }),
		measurePanel: (side) =>
			(side === 'leading' ? leadingEntries : trailingEntries)?.offsetWidth ?? 0,
		fireOutermost: (side) => {
			const entry = outermost(side);
			if (entry == null || entry.isDisabled === true) {
				return false;
			}
			void entry.onActivate();
			return entry.hasRemoval === true;
		},
		isReducedMotion: () => reducedMotion.matches,
		rootRef: () => rootRef()
	});

	// The root forwards its events into what this publishes. Published from an
	// effect, like the gesture's own latest-callback refs: effects run before
	// the browser delivers a discrete event, so a handler never meets a stale
	// bridge; and withdrawn when the layer leaves.
	$effect(() => {
		onBridge({
			handlers: swipe.handlers,
			shouldSuppressClick: swipe.shouldSuppressClick
		});
		return () => {
			onBridge(null);
		};
	});

	const isSwipeResting = $derived(swipe.state.phase === 'resting');

	function attachLeadingEntries(node: HTMLDivElement): () => void {
		leadingEntries = node;
		return () => {
			if (leadingEntries === node) {
				leadingEntries = null;
			}
		};
	}

	function attachTrailingEntries(node: HTMLDivElement): () => void {
		trailingEntries = node;
		return () => {
			if (trailingEntries === node) {
				trailingEntries = null;
			}
		};
	}

	function activateEntry(entry: ItemSwipeAction): void {
		swipe.activateEntry(() => {
			void entry.onActivate();
			return entry.hasRemoval === true;
		});
	}

	// A disabled entry stays focusable while the row rests open but is inert:
	// it runs no `onActivate` and its click does not reach the row.
	function handleEntryClick(event: MouseEvent, entry: ItemSwipeAction): void {
		if (entry.isDisabled === true) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		activateEntry(entry);
	}

	function handleEntryKeydown(event: KeyboardEvent, entry: ItemSwipeAction): void {
		if (entry.isDisabled === true && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
		}
	}
</script>

{#snippet swipePanel(side: SwipeSide, entries: ItemSwipeAction[])}
	{@const outer = entries[entries.length - 1]}
	{@const isCommit = behavior === 'commit'}
	{@const isLive = isSwipeResting && !isCommit}
	{@const outerVariant = outer.variant ?? 'accent'}
	{@const panelAttrs = itemSwipePanelAttrs(side, outerVariant)}
	{@const panelTheme = themeProps('item-swipe-panel', { side })}
	{@const entriesAttrs = itemSwipeEntriesAttrs(side)}
	<!--
		A side's panel: entries as real buttons under `reveal`, presentational
		blocks under `commit`. Out of the accessibility tree and the tab order
		except while the row rests open, so the row keeps one tab stop and a
		pointer that can hover never meets it.
	-->
	<div
		data-swipe-panel={side}
		inert={isLive ? undefined : true}
		aria-hidden={isCommit ? true : undefined}
		class={cx(panelTheme.class, panelAttrs.class)}
		style={panelAttrs.style}
	>
		<div
			{@attach side === 'leading' ? attachLeadingEntries : attachTrailingEntries}
			class={entriesAttrs.class}
			style={entriesAttrs.style}
		>
			{#each entries as entry (entry.id ?? entry.label)}
				{@const entryVariant = entry.variant ?? 'accent'}
				{#if isCommit}
					{@const entryAttrs = itemSwipeEntryAttrs(entryVariant, entry.isDisabled === true)}
					{@const entryTheme = themeProps('item-swipe-action', { variant: entryVariant })}
					<span class={cx(entryTheme.class, entryAttrs.class)} style={entryAttrs.style}>
						{#if entry.icon}{@render entry.icon()}{/if}
						<span>{entry.label}</span>
					</span>
				{:else}
					{@const entryAttrs = itemSwipeEntryFocusAttrs(entryVariant, entry.isDisabled === true)}
					{@const entryTheme = themeProps('item-swipe-action', { variant: entryVariant })}
					<button
						type="button"
						aria-disabled={entry.isDisabled === true ? true : undefined}
						onclick={(event) => handleEntryClick(event, entry)}
						onkeydown={(event) => handleEntryKeydown(event, entry)}
						class={cx(entryTheme.class, entryAttrs.class)}
						style={entryAttrs.style}
					>
						{#if entry.icon}{@render entry.icon()}{/if}
						<span>{entry.label}</span>
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

{#if leading.length > 0}{@render swipePanel('leading', leading)}{/if}
{#if trailing.length > 0}{@render swipePanel('trailing', trailing)}{/if}
