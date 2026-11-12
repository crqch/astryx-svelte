<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { AnimatedLayout } from '../../motion/animated-layout.js';
	import type { TreeListDensity, TreeListItemData, TreeListVariant } from './tree-list-types.js';

	export interface TreeListProps extends BaseProps<HTMLDivElement> {
		/**
		 * Tree items as a recursive data structure.
		 * Each item can have nested `children` arrays.
		 */
		items: TreeListItemData[];

		/**
		 * The handle from `useAnimatedLayout({ container })`. With it, expanding
		 * or collapsing a row glides the rows and content after it, up to that
		 * container, instead of jumping, and the chevron turns on the same timing.
		 */
		animatedLayout?: AnimatedLayout;

		/**
		 * Spacing density for tree list items.
		 * - `'compact'`: tighter spacing for dense UIs
		 * - `'balanced'`: standard spacing
		 * - `'spacious'`: extra spacing for readability
		 * @default 'balanced'
		 */
		density?: TreeListDensity;

		/**
		 * Visual treatment of the hierarchy guide lines, orthogonal to `density`.
		 * - `lineGuides`: connector lines between parent and child rows
		 * - `noGuides`: no connector lines; indentation alone conveys nesting
		 * @default 'lineGuides'
		 */
		variant?: TreeListVariant;

		/**
		 * Header content rendered above the tree list.
		 * Semantically associated via `aria-labelledby`.
		 */
		header?: string | Snippet;

		/** Test ID for testing frameworks. */
		'data-testid'?: string;
	}

	/** Recursively collect IDs of items marked as `isExpanded`. */
	function collectExpandedKeys(items: TreeListItemData[]): string[] {
		const keys: string[] = [];
		for (const item of items) {
			if (item.isExpanded && item.children != null && item.children.length > 0) {
				keys.push(item.id);
			}
			if (item.children != null) {
				keys.push(...collectExpandedKeys(item.children));
			}
		}
		return keys;
	}

	/**
	 * Compute the initial roving-tabindex seed: the first selected enabled item in
	 * document order, else the first enabled item, else the first item. The hook
	 * (`useTreeFocus` with `hasRovingTabIndex`) takes ownership after mount — it
	 * preserves this seeded `tabindex="0"` on its repair pass and moves the stop
	 * with keyboard navigation.
	 */
	function findInitialTabbableId(items: TreeListItemData[]): string | undefined {
		let firstEnabled: string | undefined;
		const walk = (list: TreeListItemData[]): string | undefined => {
			for (const item of list) {
				if (item.isSelected && item.isDisabled !== true) {
					return item.id;
				}
				if (firstEnabled == null && item.isDisabled !== true) {
					firstEnabled = item.id;
				}
				if (item.children != null && item.children.length > 0) {
					const selected = walk(item.children);
					if (selected != null) {
						return selected;
					}
				}
			}
			return undefined;
		};
		return walk(items) ?? firstEnabled ?? items[0]?.id;
	}

	/**
	 * Upstream's `isRenderable`: `null`, `undefined`, booleans and the empty
	 * string render nothing in React. The header is `string | Snippet` here, so
	 * only the empty string can reach that branch through the type — the rest
	 * arrive from a JS caller, and Svelte would otherwise render the header box
	 * for `false`/`true` and name the tree with an empty element.
	 */
	function isRenderableHeader(value: unknown): boolean {
		return value != null && typeof value !== 'boolean' && value !== '';
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useTreeFocusInternal } from '../../hooks/use-tree-focus.svelte.js';
	import { useAnimatedLayout } from '../../hooks/use-animated-layout.svelte.js';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import {
		applyLayoutChangeTransition,
		holdLayoutExit,
		playLayoutChange,
		releaseLayoutExit,
		reportLayoutChange,
		type LayoutChange
	} from '../../motion/animated-layout.js';
	import { useLayoutChangeSnapshot } from '../../motion/layout-change-snapshot.svelte.js';
	import {
		moveFocusLeftBehind,
		noteFocusWithin,
		type FocusWithin
	} from '../../utils/focus-return.js';
	import { trackInteractionModality } from '../../utils/interaction-modality.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import { useFocusLeavingChange } from '../../utils/use-focus-leaving-change.svelte.js';
	import { focusVars } from '../../styles/tokens.stylex.js';
	import TreeListItem from './tree-list-item.svelte';
	import { treeListHeaderAttrs, treeListListAttrs, treeListRootAttrs } from './tree-list.stylex.js';

	/**
	 * A data-driven tree list component for rendering hierarchical data.
	 *
	 * Accepts an `items` array of recursive config objects. Expansion state is
	 * managed internally — seed initial state by setting `isExpanded: true` on
	 * individual items in the data. Positional data (nestedLevel, isLast,
	 * ancestorsIsLast) is computed during rendering — no context, no snippet
	 * threading, no force-update mechanism.
	 *
	 * @example
	 * ```svelte
	 * <TreeList
	 *   items={[
	 *     { id: 'src', label: 'src', isExpanded: true, children: [
	 *       { id: 'app', label: 'App.svelte' },
	 *       { id: 'index', label: 'index.ts' }
	 *     ] },
	 *     { id: 'pkg', label: 'package.json' }
	 *   ]}
	 * />
	 * ```
	 */
	let {
		items,
		density = 'balanced',
		variant = 'lineGuides',
		header,
		xstyle,
		class: className,
		style: styleProp,
		'aria-label': ariaLabel,
		'aria-labelledby': ariaLabelledby,
		onkeydown: onKeyDownProp,
		animatedLayout: animatedLayoutProp,
		...rest
	}: TreeListProps = $props();

	const headerId = $props.id();
	// A header that renders nothing names nothing, so the tree keeps its own label.
	const hasHeader = $derived(isRenderableHeader(header));

	// Expanded keys from data: recomputed whenever items change.
	const expandedKeysFromProps = $derived(new Set(collectExpandedKeys(items)));

	// User overrides: only stores IDs the user has explicitly toggled. `$state.raw`
	// because every update is a whole-Map reassignment, as upstream's
	// `setExpandedKeysOverride(prev => new Map(prev))` is.
	let expandedKeysOverride = $state.raw(new Map<string, boolean>());

	function isItemExpanded(id: string): boolean {
		return expandedKeysOverride.has(id)
			? (expandedKeysOverride.get(id) ?? false)
			: expandedKeysFromProps.has(id);
	}

	function handleToggle(id: string): void {
		// A plain `Map` reassigned wholesale, not a `SvelteMap`: this is upstream's
		// `setExpandedKeysOverride(prev => new Map(prev).set(…))` exactly, and the
		// `$state.raw` box is what publishes the change. A `SvelteMap` would make
		// each in-place mutation reactive — a second, redundant mechanism.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Map(expandedKeysOverride);
		next.set(id, !isItemExpanded(id));
		expandedKeysOverride = next;
	}

	// With an `animatedLayout` handle, a row's size change (its children shown
	// or hidden) animates up to the handle's container: the rows and content
	// after it glide, and the shown group plays its own entrance on the same
	// timing (`architecture:react-component-runtime` INV12).
	let treeEl = $state<HTMLUListElement | null>(null);
	const isTouch = useMediaQuery(() => TOUCH_QUERY);
	// Under a finger, a tree with no handle animates inside itself: the rows
	// after a toggled row glide while its group fades on the same timing.
	// Content after the tree takes its place at once, because only an app's own
	// handle moves it.
	const ownLayout = useAnimatedLayout({ container: () => treeEl });
	const animatedLayout = $derived(animatedLayoutProp ?? (isTouch.matches ? ownLayout : undefined));

	// The rows expanded now, whatever expanded them (a click, the keyboard, or
	// `isExpanded` changed in `items`). Recursion stops at a collapsed row, as
	// upstream's walk does: a child left `isExpanded` in the data is not shown
	// while its parent is closed.
	const expandedIds = $derived.by(() => {
		const out = new Set<string>();
		const walk = (list: ReadonlyArray<TreeListItemData>) => {
			for (const item of list) {
				if (item.children == null || item.children.length === 0) {
					continue;
				}
				if (isItemExpanded(item.id)) {
					out.add(item.id);
					walk(item.children);
				}
			}
		};
		walk(items);
		return out;
	});

	// Rows whose collapse is still playing its exit: their child group stays
	// rendered (the exit makes it inert and gives up its space) until it ends
	// (`spec:AST-105` FR4). Updated in the pre-change snapshot, before Svelte
	// patches the DOM, so the collapsing commit already keeps the group.
	let exitingIds = $state.raw<ReadonlySet<string>>(new Set());

	function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
		if (a === b) {
			return true;
		}
		if (a.size !== b.size) {
			return false;
		}
		for (const id of a) {
			if (!b.has(id)) {
				return false;
			}
		}
		return true;
	}

	function endExit(id: string): void {
		// Called from the exit effect: holdLayoutExit decides from layout read
		// in the collapsing commit (the group's place in the area's visible
		// part, Reduce Motion and the pointer, and whether an end margin frees
		// its space); a group it does not hold goes before the frame paints.
		if (!exitingIds.has(id)) {
			return;
		}
		const next = new Set(exitingIds);
		next.delete(id);
		exitingIds = next;
	}

	/** A change measured before its commit, for the effect after it. */
	interface PendingLayout {
		readonly change: LayoutChange;
		readonly id: string;
		readonly isExpanding: boolean;
		/** Changed rows inside this one: they move and exit with it. */
		readonly nested: string[];
	}
	// `$state.raw` because each change is an immutable push, as upstream's
	// ref array is appended to and drained. The post-commit effect reads it, so
	// a change added in the snapshot schedules that effect.
	let pendingLayout = $state.raw<PendingLayout[]>([]);

	// Every expansion change is measured before it lands (`spec:AST-105` FR1),
	// for each row whose expansion changed. The row's own chevron (the Icon in
	// its toggle) turns on the glide's motion.
	function measureChanges(previous: ReadonlySet<string>): void {
		const changed = [
			...[...previous].filter((id) => !expandedIds.has(id)),
			...[...expandedIds].filter((id) => !previous.has(id))
		];
		const rows = new Map<string, HTMLElement>();
		for (const id of changed) {
			const row = treeEl?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`);
			if (row != null) {
				rows.set(id, row);
			}
		}
		// A changed row inside another changed row (a child left expanded when
		// its parent collapses) is not a change of its own: its group goes with
		// the outer one, so the content after them moves once (`spec:AST-105`
		// FR3).
		const outerOf = (row: HTMLElement): string | undefined =>
			[...rows].find(([, other]) => other !== row && other.contains(row))?.[0];
		const nested = new Map<string, string[]>();
		for (const [id, row] of rows) {
			const outer = outerOf(row);
			if (outer != null) {
				nested.set(outer, [...(nested.get(outer) ?? []), id]);
			}
		}
		for (const [id, row] of rows) {
			if (outerOf(row) != null) {
				continue;
			}
			applyLayoutChangeTransition(
				animatedLayout,
				row.querySelector<HTMLElement>('[data-tree-toggle] > .astryx-icon')
			);
			const change = reportLayoutChange(animatedLayout, () => row);
			change.measureBefore();
			pendingLayout = [
				...pendingLayout,
				{
					change,
					id,
					isExpanding: expandedIds.has(id),
					nested: nested.get(id) ?? []
				}
			];
		}
	}

	// Focus inside a branch's child group when it collapses would be lost once
	// the group goes (or turns inert for its exit). It moves to the collapsing
	// row itself (AR2); focus anywhere else is not moved. The tree's own
	// document's last input decides the moved focus's ring.
	$effect(() => {
		trackInteractionModality();
	});
	const noteCollapsingFocus = useFocusLeavingChange<
		ReadonlySet<string>,
		{ focus: FocusWithin; ids: string[] }
	>(
		() => expandedIds,
		// Every expanded row whose group holds focus, outermost first, found by
		// walking up from the focused element: which of them collapsed is known
		// only after the commit.
		(previous) => {
			const active = treeEl?.ownerDocument.activeElement;
			if (treeEl == null || active == null || !treeEl.contains(active)) {
				return null;
			}
			let focus: FocusWithin | null = null;
			const ids: string[] = [];
			for (
				let element = active.parentElement;
				element != null && element !== treeEl;
				element = element.parentElement
			) {
				const id = element.parentElement?.dataset.treeId;
				if (element.getAttribute('role') === 'group' && id != null && previous.has(id)) {
					focus = noteFocusWithin(element);
					ids.unshift(id);
				}
			}
			return focus == null ? null : { focus, ids };
		},
		(noted, expanded) => {
			// The outermost row that collapsed: a row inside it goes with it.
			const id = noted.ids.find((candidate) => !expanded.has(candidate));
			if (id == null) {
				return;
			}
			const row = treeEl?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`);
			const moved = moveFocusLeftBehind(
				noted.focus,
				row,
				row?.querySelector(':scope > [role="group"]') ?? null
			);
			// The row focus moved to holds the tree's one Tab stop, unless it is
			// disabled (AR1, AR2).
			if (moved && row != null) {
				takeTabStop(row);
			}
		}
	);

	// Every expansion change is measured before it lands. The snapshot hook is
	// the port's `LayoutChangeSnapshot`: it runs in the commit, before Svelte
	// changes the DOM.
	useLayoutChangeSnapshot(
		() => expandedIds,
		(previous) => {
			if (animatedLayout != null) {
				const next = new Set(exitingIds);
				for (const id of previous) {
					if (!expandedIds.has(id)) {
						next.add(id);
					}
				}
				for (const id of expandedIds) {
					next.delete(id);
				}
				if (!sameIds(next, exitingIds)) {
					exitingIds = next;
				}
			}
			noteCollapsingFocus(previous);
			if (animatedLayout != null) {
				measureChanges(previous);
			}
		}
	);

	$effect(() => {
		const pendings = pendingLayout;
		const handle = animatedLayout;
		const tree = treeEl;
		if (pendings.length === 0) {
			return;
		}
		untrack(() => {
			pendingLayout = [];
			for (const pending of pendings) {
				const isMeasured = pending.change.animate();
				const group = tree?.querySelector<HTMLElement>(
					`[data-tree-id="${CSS.escape(pending.id)}"] > [role="group"]`
				);
				if (pending.isExpanding) {
					if (group != null) {
						// Expanded again mid-exit: the group takes its place in flow.
						releaseLayoutExit(group);
						if (isMeasured) {
							playLayoutChange(handle, group);
						}
					}
					continue;
				}
				// The rows nested in it leave with it, once its exit ends.
				const endAll = () => {
					endExit(pending.id);
					for (const id of pending.nested) {
						endExit(id);
					}
				};
				const isHeld = isMeasured && group != null && holdLayoutExit(handle, group, endAll);
				if (!isHeld) {
					// An exit holdLayoutExit did not hold (out of view, Reduce
					// Motion with a fine pointer, or no margin frees its space):
					// the group goes before this frame paints.
					endAll();
				}
			}
			if (pendings.length > 0 && handle === ownLayout && tree != null) {
				clipWhileMoving(tree);
			}
		});
	});

	// Without a handle the chevrons keep the theme's own turn: a spring a
	// handle set stays only while it is passed (`spec:AST-105` FR2).
	$effect(() => {
		const handle = animatedLayout;
		const tree = treeEl;
		untrack(() => {
			if (handle != null) {
				return;
			}
			for (const chevron of tree?.querySelectorAll<HTMLElement>(
				'[data-tree-toggle] > .astryx-icon'
			) ?? []) {
				applyLayoutChangeTransition(null, chevron);
			}
		});
	});

	/**
	 * The clip a tree with no handle takes while it moves. Rows that glide up
	 * into a shorter tree show only inside it, so they never paint over the
	 * content after it. Only the bottom edge clips, past the reach of a row's
	 * focus ring.
	 */
	const MOVING_CLIP = `inset(-100vmax -100vmax calc(-1 * (${focusVars['--focus-outline-width']} + ${focusVars['--focus-outline-offset']})) -100vmax)`;
	const clipGenerations = new WeakMap<HTMLElement, number>();

	/** Clips `tree` with MOVING_CLIP until each finite motion in it settles. */
	function clipWhileMoving(tree: HTMLElement): void {
		if (typeof tree.getAnimations !== 'function') {
			return;
		}
		const moving = tree
			.getAnimations({ subtree: true })
			.filter(
				(animation) =>
					animation.playState === 'running' &&
					Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)
			);
		if (moving.length === 0) {
			return;
		}
		const generation = (clipGenerations.get(tree) ?? 0) + 1;
		clipGenerations.set(tree, generation);
		tree.style.setProperty('clip-path', MOVING_CLIP);
		void Promise.allSettled(moving.map(async (animation) => animation.finished)).then(() => {
			if (clipGenerations.get(tree) === generation) {
				clipGenerations.delete(tree);
				tree.style.removeProperty('clip-path');
			}
		});
	}

	// The hook (`hasRovingTabIndex`) owns the tree's single tab stop: it repairs
	// the stop on mount and moves it with keyboard navigation. We only seed the
	// initially-tabbable treeitem in the render (selected item or first enabled);
	// the hook's repair pass preserves that seeded `tabindex="0"`.
	const initialTabbableId = $derived(findInitialTabbableId(items));

	// Whether any *top-level* item can expand. Upstream computes it exactly this
	// way — `items.some(...)` on the prop, outside `renderItems`, which shadows the
	// name during recursion — so a tree whose only expandable item is nested deep
	// does not reserve the column. Leaves consult it to decide whether to hold a
	// chevron-width gutter open; a wholly flat tree holds none.
	const hasExpandableItems = $derived(
		items.some((item) => item.children != null && item.children.length > 0)
	);

	/**
	 * Enter/Space activation: prefer the treeitem's own inner action (link or
	 * button); return true when handled so the hook does not also toggle. Scoped
	 * to this treeitem's own row — never a descendant treeitem's action inside an
	 * expanded group.
	 */
	function activateItem(current: HTMLElement): boolean {
		// The chevron toggle is marked with `data-tree-toggle` (set by
		// `TreeListItem`) so this filter stays stable across locales — matching by
		// aria-label would break under any locale where "Toggle children" is
		// translated.
		const candidates = current.querySelectorAll<HTMLElement>(
			'a[href], button:not([data-tree-toggle])'
		);
		for (const candidate of candidates) {
			if (candidate.closest('[role="treeitem"]') === current) {
				candidate.click();
				return true;
			}
		}
		return false;
	}

	// Rows of a group still playing its collapse are gone from the tree's
	// keyboard order already. The selector is used for the hook's visible rows
	// and for moving the tab stop after a collapse moves focus.
	const TREE_ITEM_SELECTOR = '[role="treeitem"]:not([data-tree-exiting] *)';

	/** Make `row` the tree's one Tab stop, as the hook's navigation does. */
	function takeTabStop(row: HTMLElement): void {
		if (row.dataset.treeDisabled != null || row.getAttribute('aria-disabled') === 'true') {
			return;
		}
		for (const item of treeEl?.querySelectorAll<HTMLElement>(TREE_ITEM_SELECTOR) ?? []) {
			item.setAttribute('tabindex', item === row ? '0' : '-1');
		}
	}

	const tree = useTreeFocusInternal(() => ({
		onToggleExpand: handleToggle,
		onActivate: activateItem,
		hasRovingTabIndex: true,
		// Rows are named by their label (AR1); typeahead matches that label, not
		// the chevron toggle, start content or description.
		matchLabelledBy: true,
		itemSelector: TREE_ITEM_SELECTOR
	}));

	/**
	 * Consumer keydown first, on the root, then the tree model only when the
	 * event originated inside the list — upstream's `handleRootKeyDown`. A
	 * consumer can prevent the built-in move by preventing the default, and a key
	 * pressed in the header slot never navigates the tree.
	 */
	function handleRootKeyDown(event: KeyboardEvent): void {
		onKeyDownProp?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) {
			return;
		}
		if (treeEl != null && event.target instanceof Node && treeEl.contains(event.target)) {
			tree.handleKeyDown(event);
		}
	}

	// `variant` belongs here as well as `density`: `TreeListVariantMap` is
	// declaration-mergeable, so an augmented variant type-checks and renders —
	// and without the axis on the element there is no selector for a theme to
	// style it with. Upstream shipped that gap too and closed it at 0.4.5.
	const theme = $derived(themeProps('tree-list', { density, variant }));
	const rootAttrs = $derived(treeListRootAttrs(xstyle));
	const listAttrs = treeListListAttrs();
	const headerAttrs = treeListHeaderAttrs();
</script>

{#snippet renderItems(
	list: TreeListItemData[],
	nestedLevel: number,
	ancestorsIsLast: ReadonlyArray<boolean>
)}
	{#each list as item, index (item.id)}
		{@const isLast = index === list.length - 1}
		{@const hasChildren = item.children != null && item.children.length > 0}
		{@const isExpanded = isItemExpanded(item.id)}
		{@const isExiting = exitingIds.has(item.id) && !isExpanded}
		{@const ancestorsForChildren = hasChildren ? [...ancestorsIsLast, isLast] : ancestorsIsLast}

		{#snippet childSubtree()}
			{@render renderItems(item.children ?? [], nestedLevel + 1, ancestorsForChildren)}
		{/snippet}

		<TreeListItem
			id={item.id}
			label={item.label}
			description={item.description}
			startContent={item.startContent}
			endContent={item.endContent}
			xstyle={item.xstyle}
			className={item.className}
			style={item.style}
			{hasChildren}
			{hasExpandableItems}
			onClick={item.onClick}
			href={item.href}
			target={item.target}
			isDisabled={item.isDisabled}
			isSelected={item.isSelected}
			{nestedLevel}
			{isLast}
			{ancestorsIsLast}
			{isExpanded}
			{isExiting}
			onToggle={handleToggle}
			{density}
			{variant}
			renderedChildren={(isExpanded || isExiting) && hasChildren ? childSubtree : undefined}
			posInSet={index + 1}
			setSize={list.length}
			isTabbable={item.id === initialTabbableId}
		/>
	{/each}
{/snippet}

<div
	{...rest}
	{...theme}
	class={cx(theme.class, rootAttrs.class, className)}
	style={mergeStyle(rootAttrs.style, styleProp as string | undefined)}
	onkeydown={handleRootKeyDown}
>
	{#if hasHeader}
		<div id={headerId} class={headerAttrs.class} style={headerAttrs.style}>
			{#if typeof header === 'function'}{@render header()}{:else}{header}{/if}
		</div>
	{/if}
	<ul
		bind:this={treeEl}
		{@attach tree.attachTree}
		role="tree"
		aria-label={hasHeader ? undefined : ariaLabel}
		aria-labelledby={hasHeader ? headerId : ariaLabelledby}
		onfocusin={tree.handleFocus}
		class={listAttrs.class}
		style={listAttrs.style}
	>
		{@render renderItems(items, 0, [])}
	</ul>
</div>
