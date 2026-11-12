<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { AnimatedLayout } from '../../motion/animated-layout.js';
	import type { Reorderable } from '../../reorderable/create-reorderable.js';
	import type { ListDensity, ListEdge, ListMarkerStyle } from './list-context.svelte.js';

	export interface ListProps extends BaseProps<HTMLUListElement | HTMLOListElement> {
		/** List items. Should be `ListItem` components. */
		children: Snippet;
		/**
		 * Spacing density for list items.
		 * @default 'balanced'
		 */
		density?: ListDensity;
		/**
		 * The handle from `useAnimatedLayout({containerRef})`. With it, the list
		 * isolates its rows for every pointer, so a row that slides across its
		 * neighbours stays above them while it moves.
		 */
		animatedLayout?: AnimatedLayout;
		/**
		 * Makes the rows reorderable, with the object `createReorderable` makes.
		 * Each `ListItem` with an `itemKey` gets a reorder handle at its end. One
		 * the object's `isReorderable` rejects keeps its place. Each committed
		 * move calls its `onReorder` once with the row's key and its index after
		 * the move. Apply it by rendering the rows in their new order. A drop on
		 * the starting place, a cancel, or a move the order does not take changes
		 * nothing.
		 *
		 * On a touch screen, a finger held still on a handle for a moment picks
		 * up its row. A flick on it still scrolls. The row stays in its place,
		 * dimmed, while a copy of it follows the finger. An accent line marks
		 * where it would land. The other rows stay still, the list scrolls near
		 * the edges, and on release the rows rearrange. A mouse drags a handle at
		 * once, the same way.
		 *
		 * Without a drag, activating a handle (a click, Space or Enter) turns on
		 * reorder mode for its row. Each arrow key moves it a place at once,
		 * reported and announced with its place and neighbours. Escape or another
		 * activation ends the mode, keeping the moves. While it is on, a hint
		 * anchored to the handle shows the moves and Done as buttons, so taps
		 * alone can reorder.
		 */
		reorderable?: Reorderable;
		/**
		 * Whether to show dividers between list items.
		 * @default false
		 */
		hasDividers?: boolean;
		/**
		 * Where each row's text, dividers, and hover and selection backgrounds
		 * sit, relative to the list's edges and the container around it.
		 * - `'padded'`: text sits inside each row's padding, so it starts a
		 *   little in from a heading above the list and backgrounds have room
		 *   around it
		 * - `'flush'`: rows drop their side padding, so text starts on the
		 *   heading's line and dividers and backgrounds stop at the row's
		 *   content, with no room beyond it on either side
		 * - `'outset'`: text sits on the heading's line, and dividers and
		 *   backgrounds reach a little past it into the container's padding
		 * - `'bleed'`: text sits on the heading's line, and dividers and
		 *   backgrounds reach the container's edges, like Table rows in a Card
		 * @default 'padded'
		 */
		edge?: ListEdge;
		/**
		 * @deprecated Use `edge="outset"`, which this sets. Still works; `edge`
		 * wins when both are set.
		 */
		edgeCompensation?: 'inline';
		/** Header content rendered above the list, associated via `aria-labelledby`. */
		header?: string | Snippet;
		/**
		 * List marker style. `'decimal'` renders an `<ol>`; anything else a `<ul>`.
		 * @default 'none'
		 */
		listStyle?: ListMarkerStyle;
		/**
		 * Starting number for ordered lists. Sets the CSS counter to begin here.
		 * @default 1
		 */
		start?: number;
		/** Test ID for testing frameworks. */
		'data-testid'?: string;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
	import { setListContext } from './list-context.svelte.js';
	import { listAttrs, listHeaderAttrs, listRootAttrs } from './list.stylex.js';
	import ListReorderHost from './list-reorder-host.svelte';
	import { useReorderCommit, useReorderSession } from './list-reorder-context.svelte.js';

	/**
	 * A vertical list for rendering collections of items.
	 *
	 * Renders a semantic `<ul>` or `<ol>` with configurable density, dividers,
	 * marker styles, and an optional header. Set `edge` to choose where row
	 * text, dividers, and backgrounds sit relative to the list's edges and the
	 * padding of the container around it.
	 *
	 * @example
	 * ```svelte
	 * <List>
	 *   <ListItem label="Notifications" description="Manage your alerts" />
	 *   <ListItem label="Privacy" description="Control your data" />
	 * </List>
	 * <List edge="flush" hasDividers>
	 *   <ListItem label="Solstice Mug" description="Ceramic, 12 oz" />
	 * </List>
	 * ```
	 */
	let {
		children,
		density = 'balanced',
		animatedLayout,
		reorderable,
		hasDividers = false,
		edge: edgeProp,
		edgeCompensation,
		header,
		listStyle = 'none',
		start,
		xstyle,
		class: className,
		style: styleProp,
		'data-testid': testId,
		...rest
	}: ListProps = $props();

	const headerId = $props.id();
	let listEl = $state<HTMLUListElement | HTMLOListElement | null>(null);
	// The reorder's machinery comes with the object. The handles' instructions
	// take the header's id with a suffix.
	const { session: reorderSession, options: reorderOptions } = useReorderSession(
		() => reorderable,
		() => listEl,
		`${headerId}h`
	);
	const reorderValue = $derived(
		reorderSession != null && reorderOptions != null
			? { session: reorderSession, options: reorderOptions }
			: undefined
	);
	// After the layout updates, so a drop's commit is the reorder's. The port's
	// row layout updates (`List/listLayoutUpdates.ts`) are not here; when they
	// land, they read `session.ownsCommit()` to leave this commit alone.
	useReorderCommit(() => reorderSession);
	const isOrdered = $derived(listStyle === 'decimal');
	// Plain use of the deprecated prop is reported by its @deprecated type;
	// development warns only when the two names conflict.
	useDevWarning(
		'List',
		'`edge` and the deprecated `edgeCompensation` are both set; `edge` wins. ' +
			'Remove `edgeCompensation`. `astryx upgrade` rewrites existing usage.',
		() => edgeProp != null && edgeCompensation != null
	);
	const edge = $derived(edgeProp ?? (edgeCompensation === 'inline' ? 'outset' : 'padded'));
	const hasHeader = $derived(header != null);

	setListContext(() => ({
		density,
		hasDividers,
		edge,
		listStyle,
		animatedLayout,
		reorder: reorderValue
	}));

	const theme = $derived(themeProps('list', { density, listStyle }));
	const attrs = $derived(
		listAttrs({
			hasAnimatedLayout: animatedLayout != null,
			isOrdered,
			hasDividers,
			edge,
			hasHeader,
			listStyle,
			start,
			hasReorder: reorderSession != null,
			xstyle
		})
	);
	const rootAttrs = $derived(listRootAttrs(edge));
	const headerAttrs = listHeaderAttrs();
</script>

{#snippet listElement()}
	<!--
		The base list style always sets `list-style-type: none` (markers are
		custom-rendered by `ListItem`), and Safari/VoiceOver drops implicit list
		semantics for lists styled that way. The explicit role restores
		"list, N items" announcements for every `listStyle` variant, which is why it
		is unconditional rather than gated on `listStyle === 'none'` (WCAG 1.3.1).

		It reads as a redundant role and is not: the CSS is what removed the implicit
		one. `a11y_no_redundant_roles` does not fire here only because the tag is
		dynamic — were this a literal `<ul>`, the rule would need suppressing, and the
		reason would be this paragraph.
	-->
	<svelte:element
		this={isOrdered ? 'ol' : 'ul'}
		bind:this={listEl}
		{...rest}
		data-testid={testId}
		{...hasHeader ? { 'aria-labelledby': headerId } : {}}
		{...isOrdered && start != null && start !== 1 ? { start } : {}}
		role="list"
		{...theme}
		{...edge === 'bleed' && !hasHeader ? { 'data-container-corner': '' } : {}}
		class={cx(theme.class, attrs.class, className)}
		style={mergeStyle(attrs.style, styleProp as string | undefined)}
	>
		{@render children()}
	</svelte:element>
{/snippet}

{#if header == null}
	{@render listElement()}
{:else}
	<div
		class={rootAttrs.class}
		style={rootAttrs.style}
		{...edge === 'bleed' ? { 'data-container-corner': '' } : {}}
	>
		<div id={headerId} class={headerAttrs.class} style={headerAttrs.style}>
			{#if typeof header === 'function'}{@render header()}{:else}{header}{/if}
		</div>
		{@render listElement()}
	</div>
{/if}

{#if reorderValue != null}
	<ListReorderHost reorder={reorderValue} />
{/if}
