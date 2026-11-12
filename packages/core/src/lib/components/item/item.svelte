<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { LinkComponentType } from '../link/types.js';
	import type { ItemAlign, ItemDensity, ItemLayout } from './item.stylex.js';
	import type {
		ItemSwipeAction,
		ItemSwipeActions,
		ItemSwipeActionVariant,
		ItemSwipeBehavior
	} from './item-swipe-types.js';

	export type { ItemSwipeAction, ItemSwipeActions, ItemSwipeActionVariant, ItemSwipeBehavior };

	/**
	 * `onclick` is omitted from `BaseProps` so the narrowed redeclaration below
	 * replaces it. `label`/`description` are `string | Snippet` because a *string*
	 * label opts into single-line truncation automatically (upstream branches on
	 * `typeof label === 'string'`); the other slots are element content, so plain
	 * `Snippet`.
	 */
	export interface ItemProps extends Omit<BaseProps<HTMLElement>, 'onclick'> {
		/**
		 * What the root renders as: an HTML element, or a component for a caller
		 * that needs the root to be something else. A menu row that navigates
		 * passes the application's link component here, so the row's root IS the
		 * anchor and a modified or middle click keeps the browser's meaning.
		 *
		 * Give a component only when the row carries a `role`, so the parent owns
		 * keyboard access and the row adds no second tab stop; and only when no
		 * interactive node sits in `startContent` or `endContent`, since a control
		 * nested inside an anchor is invalid.
		 * @default 'div'
		 */
		as?: 'div' | 'li' | 'span' | LinkComponentType;
		/** Leading marker (a bullet, number, radio dot) — rendered raw, no wrapper. */
		marker?: Snippet;
		/** Leading content (avatar, icon), wrapped in a fixed-size slot. */
		startContent?: Snippet;
		/** The primary line. A string label single-line-truncates by default. */
		label: string | Snippet;
		/** The secondary line below the label. */
		description?: string | Snippet;
		/** Trailing content (badge, timestamp, chevron), pushed to the end. */
		endContent?: Snippet;
		/**
		 * Vertical alignment of the start/end content slots. `center` centers each
		 * slot on the whole text block; `start` lines up slot tops with the text's
		 * top; `first-line` centers each slot on the label's first line, so a small
		 * mark (a status dot, a radio, a timestamp) stays level with the first line
		 * of a wrapped label. A slot taller than that line moves the text down.
		 * @default 'center'
		 */
		align?: ItemAlign;
		/**
		 * @default 'balanced'
		 */
		density?: ItemDensity;
		/** Max lines for the label before truncating (`1` = ellipsis, `>1` = clamp). */
		labelLines?: number;
		/** Max lines for the description before truncating. */
		descriptionLines?: number;
		/**
		 * How the label and description sit together. `stacked` puts the description
		 * on its own line below the label; `inline` keeps both on one line, with the
		 * description ellipsizing first, so the row fits a fixed-height host.
		 *
		 * @default 'stacked'
		 */
		layout?: ItemLayout;
		/** Click handler. Makes the item interactive (a `<button>` when no `href`). */
		onclick?: (event: MouseEvent) => void;
		/**
		 * A nested control inside the item (e.g. a checkbox in `startContent`) that
		 * already provides the item's keyboard access and action. When set, the item
		 * becomes an enlarged click/tap target that delegates surface clicks to that
		 * control via the `useClickableContainer` pattern: it renders no invisible
		 * button/anchor, so the row adds no second tab stop (WCAG 4.1.2 — one
		 * focusable control per option). Clicks on the control itself, and on any
		 * other nested interactive element, are left to that element. Mutually
		 * exclusive with `onclick`/`href` — when `interactiveRef` is set those are
		 * ignored (the nested control is the sole action), and a dev warning says so.
		 *
		 * Upstream takes a `RefObject<HTMLElement | null>` and reads `.current` at
		 * each use; this port takes a **getter**, read at exactly the same points —
		 * the settled `useOutlineFromDOM` / `useChatStreamScroll` translation. Pass
		 * `() => el` over a `$state` binding, so the read stays live across the
		 * control mounting and unmounting.
		 */
		interactiveRef?: () => HTMLElement | null;
		/** Destination. Makes the item a link. */
		href?: string;
		/** Anchor target. */
		target?: '_blank' | '_self';
		/** Anchor rel. Safe tokens are auto-added for `target="_blank"`. */
		rel?: string;
		/**
		 * @default false
		 */
		isHighlighted?: boolean;
		/**
		 * Selected state. Always applies the selected visual styling. When `role`
		 * permits it (option, tab, row, gridcell, columnheader, rowheader,
		 * treeitem) the state is exposed as `aria-selected`; otherwise (e.g. a
		 * listitem or a bare div, where `aria-selected` is invalid ARIA) it falls
		 * back to `aria-current="true"` so assistive tech is still told which item
		 * is selected. A consumer-provided `aria-current` always wins.
		 * @default false
		 */
		isSelected?: boolean;
		/**
		 * @default false
		 */
		isDisabled?: boolean;
		/**
		 * Swipe actions for touch: the verbs a sideways drag uncovers on each side,
		 * declared as data so the row paints the panel from them. A coarse pointer
		 * drags the row aside and uncovers the side's panel; a mouse never starts
		 * the drag, and a mostly vertical drag stays the scroller's. The gesture is
		 * a touch accelerator and never a row's only path to a verb: a verb
		 * reachable only by swipe is unreachable by keyboard and by mouse, so every
		 * entry must also be reachable through the row's own content (a menu or a
		 * button in `endContent`).
		 *
		 * Available on a row whose role permits interactive descendants — a
		 * `listitem`, a row with no role — and not served on one whose role forbids
		 * them (`option`, `menuitem*`, a row that is the enlarged target of a native
		 * radio). The element containing the rows clips in the inline axis
		 * (`overflow-inline: clip`): `List` does; any other host does it once.
		 *
		 * The gesture and its panels are loaded on demand, the first time a row has
		 * swipe actions, so a row without them ships none of it; a row with them is
		 * drawn at once and becomes swipeable as soon as that module has loaded.
		 */
		swipeActions?: ItemSwipeActions;
		/**
		 * What a swipe does: `reveal` rests the row open with every entry tappable
		 * and fires the outermost on a long drag; `commit` slides the row out and
		 * fires the outermost on release. `commit` fits one entry per side.
		 * @default 'reveal'
		 */
		swipeBehavior?: ItemSwipeBehavior;
	}

	/**
	 * Roles on which WAI-ARIA permits the `aria-selected` attribute.
	 * https://www.w3.org/TR/wai-aria-1.2/#aria-selected
	 */
	const ARIA_SELECTED_ROLES = new Set([
		'option',
		'tab',
		'row',
		'gridcell',
		'columnheader',
		'rowheader',
		'treeitem'
	]);

	/**
	 * Roles whose content model permits interactive descendants, so a swipe
	 * panel's buttons may live inside the row. A row with no role at all
	 * qualifies too; `option`, the `menuitem*` roles and the rest do not.
	 */
	const SWIPE_ROLES = new Set(['listitem']);

	/**
	 * Whether a row serves swipe actions, and so is a stacking context at rest:
	 * its root translates (`styles.swipeRoot`). Swipe actions need a role that
	 * permits interactive descendants, since a swipe panel holds buttons. That
	 * is a `listitem`, or no role at all. A root that is itself a link is not
	 * served, nor is a role that forbids interactive descendants. A disabled
	 * row, a row with no entry on either side, and the enlarged target of a
	 * nested control are not served either. Internal: under a finger, List raises
	 * such a row, so its touch band stays above the rows after it.
	 */
	export function servesSwipeActions({
		swipeActions,
		isDisabled,
		isDelegate,
		isLinkRoot,
		role
	}: {
		readonly swipeActions: ItemSwipeActions | undefined;
		readonly isDisabled: boolean;
		readonly isDelegate: boolean;
		readonly isLinkRoot: boolean;
		readonly role: string | null | undefined;
	}): boolean {
		return (
			swipeActions != null &&
			((swipeActions.leading?.length ?? 0) > 0 || (swipeActions.trailing?.length ?? 0) > 0) &&
			!isDisabled &&
			!isDelegate &&
			!isLinkRoot &&
			(role == null || SWIPE_ROLES.has(role))
		);
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { createAttachmentKey } from 'svelte/attachments';
	import {
		useClickableContainer,
		cancelNestedTouchPress
	} from '../../hooks/use-clickable-container.svelte.js';
	import { usePressFeedback } from '../../hooks/use-press-feedback.svelte.js';
	import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
	import { computeTargetAndRel } from '../link/compute-target-and-rel.js';
	import { useLinkComponent } from '../link/link-context.svelte.js';
	import LinkElement from '../link/link-element.svelte';
	import {
		itemContentAttrs,
		itemDescriptionAttrs,
		itemEndContentAttrs,
		itemInvisibleAnchorAttrs,
		itemInvisibleButtonAttrs,
		itemLabelAttrs,
		itemMarkerContentAttrs,
		itemRootAttrs,
		itemStartContentAttrs
	} from './item.stylex.js';
	import { useItemMarkerColumns } from './item-marker-columns-context.svelte.js';
	import ItemMarkerColumnsScope from './item-marker-columns-scope.svelte';
	import type { ItemSwipeBridge } from './item-swipe-layer.svelte';

	/**
	 * A universal item primitive — the shared "start content + label +
	 * description + end content" row behind list items, menu items, contact rows
	 * and notifications. Static by default; a `href` makes it a link and an
	 * `onclick` makes it a button, with the whole row clickable but inner
	 * controls left to fire on their own.
	 *
	 * @example
	 * ```svelte
	 * <Item label="Ada Lovelace" description="Engineer" onclick={select}>
	 *   {#snippet startContent()}<Avatar name="Ada Lovelace" size="sm" />{/snippet}
	 *   {#snippet endContent()}<Badge label={3} />{/snippet}
	 * </Item>
	 * ```
	 */
	let {
		as = 'div',
		marker,
		startContent,
		label,
		description,
		endContent,
		align = 'center',
		density = 'balanced',
		labelLines,
		descriptionLines,
		layout = 'stacked',
		onclick,
		interactiveRef,
		href,
		target: targetFromProps,
		rel: relFromProps,
		isHighlighted = false,
		isSelected = false,
		isDisabled = false,
		swipeActions,
		swipeBehavior = 'reveal',
		xstyle,
		class: className,
		style: styleProp,
		role,
		onpointerdown,
		...rest
	}: ItemProps = $props();

	const resolveLink = useLinkComponent();
	const linkResolved = $derived(resolveLink());

	let rootEl = $state<HTMLElement | null>(null);
	/** The row's own invisible action, so a press on it keeps the row's press. */
	let actionButton = $state<HTMLElement | null>(null);
	let actionLink = $state<HTMLElement | null>(null);

	// The row paints its press, so the document-level controller marks it and
	// writes `data-astryx-press` here.
	const pressable = usePressFeedback();

	// Delegation mode: the row is an enlarged click/tap target for a nested
	// control (e.g. a checkbox) that owns the keyboard access and action. The
	// control is the row's only tab stop; the row proxies surface clicks to it.
	const isDelegate = $derived(interactiveRef != null);

	// Only the click handler is taken: `onmouseup` handles middle-click `href`
	// navigation, which delegation mode never has (`href` is ignored here).
	//
	// `container` is withheld — not merely `disabled` — outside delegation mode,
	// and that guard is load-bearing rather than tidiness: the hook's `$effect`
	// stamps `data-pressable-container` on whatever container it is handed
	// regardless of `disabled`, and that attribute is itself in
	// `INTERACTIVE_SELECTORS`. Stamping every `Item` would make an enclosing
	// clickable container treat plain rows as interactive and stop forwarding
	// clicks through them. Upstream gets the same guard for free: its
	// `containerRef` is only attached to the root element when `isDelegate`.
	const delegated = useClickableContainer(() => ({
		container: isDelegate ? rootEl : null,
		interactive: interactiveRef?.() ?? null,
		disabled: isDisabled
	}));

	useDevWarning(
		'Item',
		'`interactiveRef` is mutually exclusive with `onclick`/`href`. In ' +
			'delegation mode the row only forwards clicks to the referenced control, ' +
			'so `onclick`/`href` are ignored. Drop one of them.',
		() => isDelegate && (onclick != null || href != null)
	);

	const isInteractive = $derived(onclick != null || href != null || isDelegate);
	// A caller-provided role means a parent owns keyboard access — put onclick on
	// the root, skip the invisible button/anchor, and drop the disabled dim.
	const hasParentRole = $derived(role != null);
	// The root is whatever `as` says it is. A caller that passed a link component
	// means the root itself is the anchor, so the address rides it and the
	// invisible anchor below is not rendered.
	const isLinkRoot = $derived(typeof as !== 'string' && href != null);
	const hasStateFill = $derived(isHighlighted || isSelected);
	// A row with its own action runs it from anywhere on its surface, so it is
	// also the row a nested control's press must not paint. A link root runs its
	// action as the root element itself, so it is not one of these.
	const hasOwnAction = $derived((onclick != null || href != null) && !hasParentRole && !isLinkRoot);

	const leadingSwipe = $derived(swipeActions?.leading ?? []);
	const trailingSwipe = $derived(swipeActions?.trailing ?? []);
	const hasSwipe = $derived(
		servesSwipeActions({ swipeActions, isDisabled, isDelegate, isLinkRoot, role })
	);
	// Filled by the swipe layer once it has mounted; empty until then and on a
	// row without swipe actions, when the forwarders below do nothing.
	const swipeBridgeRef: { current: ItemSwipeBridge | null } = { current: null };
	function setSwipeBridge(bridge: ItemSwipeBridge | null): void {
		swipeBridgeRef.current = bridge;
	}
	useDevWarning(
		'Item',
		'`swipeBehavior="commit"` fires only the outermost entry of a side; the ' +
			'other entries have no touch path. Give a committing side one entry, ' +
			'or use `swipeBehavior="reveal"`.',
		() =>
			hasSwipe &&
			swipeBehavior === 'commit' &&
			(leadingSwipe.length > 1 || trailingSwipe.length > 1)
	);

	// `aria-selected` is only valid on the roles WAI-ARIA 1.2 permits it on, so a
	// plain `listitem` or bare `div` carrying it was invalid ARIA. For those,
	// selection is conveyed via `aria-current` — valid on any element — so the
	// state still reaches AT. Written after `{...rest}` so it defers to a
	// consumer-provided `aria-current`. The selected *styling* is unconditional
	// either way.
	const allowsAriaSelected = $derived(role != null && ARIA_SELECTED_ROLES.has(role));

	const targetAndRel = $derived(computeTargetAndRel(targetFromProps, relFromProps));

	const isStringLabel = $derived(typeof label === 'string');
	const isStringDescription = $derived(typeof description === 'string');

	const theme = $derived(themeProps('item', { density, align }));
	const rootAttrs = $derived(
		itemRootAttrs(
			density,
			align,
			{
				isInteractive,
				isHighlighted,
				isSelected,
				isDisabled,
				hasStateFill,
				hasParentRole,
				isLinkRoot,
				hasSwipe
			},
			xstyle
		)
	);
	// Inline rows are one line by definition, so the description always ellipsizes
	// there — a snippet description cannot wrap the row open. With no description
	// there is nothing to inline, so the layout falls back to stacked.
	const isInline = $derived(layout === 'inline' && description != null);
	const labelAttrs = $derived(itemLabelAttrs(labelLines, isStringLabel, isInline));
	const descAttrs = $derived(itemDescriptionAttrs(descriptionLines, isStringDescription, isInline));
	const contentAttrs = $derived(itemContentAttrs(isDisabled, isInline));
	const buttonAttrs = $derived(itemInvisibleButtonAttrs(isDisabled, isInline));
	const anchorAttrs = $derived(itemInvisibleAnchorAttrs(isDisabled, isInline));
	const startAttrs = $derived(itemStartContentAttrs(align));
	const endAttrs = $derived(itemEndContentAttrs(isDisabled, align));
	// A numbered List row asks for two subgrid cells: the marker and one content
	// cell beside it. Every other row keeps its flat flex children.
	const markerColumns = useItemMarkerColumns();
	const wantsMarkerColumns = $derived(markerColumns());
	const markerContentAttrs = $derived(itemMarkerContentAttrs(align));
	/** Item resets the request for what it renders; see the scope component. */
	const noMarkerColumns = () => false;

	// The polymorphic link props for the invisible-anchor branch; custom
	// components also get a `to={href}` alias.
	const anchorProps = $derived({
		href,
		...(linkResolved.isNative ? {} : { to: href }),
		target: targetAndRel.target,
		rel: targetAndRel.rel,
		'aria-disabled': isDisabled || undefined,
		tabindex: isDisabled ? -1 : undefined,
		class: anchorAttrs.class,
		style: anchorAttrs.style,
		[createAttachmentKey()]: (node: HTMLElement) => {
			actionLink = node;
		}
	});

	// The address rides the root itself when `as` is a caller's link component.
	// A disabled row keeps its place in the tree but goes nowhere.
	const linkRootProps = $derived(
		isLinkRoot
			? {
					href: isDisabled ? undefined : href,
					target: isDisabled ? undefined : targetAndRel.target,
					rel: isDisabled ? undefined : targetAndRel.rel
				}
			: null
	);

	function handleContainerClick(e: MouseEvent): void {
		if (isDisabled) {
			return;
		}
		// A click that landed on an inner control fires that control only, not the row.
		if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
			return;
		}
		onclick?.(e);
	}

	/**
	 * A finger press that starts on a nested control does not run this row's
	 * action, so it must not paint the row either. A mouse keeps the row's
	 * `:active` and is left alone.
	 */
	function handlePointerDown(
		event: PointerEvent & { currentTarget: EventTarget & HTMLElement }
	): void {
		// A swipeable row's pointerdown belongs to the gesture: upstream replaces
		// the caller's handler with the bridge's while a swipe is served, then
		// chains the row's press rule onto it when the row has its own action.
		if (hasSwipe) {
			swipeBridgeRef.current?.handlers.onpointerdown(event);
			if (hasOwnAction && !isDisabled) {
				cancelNestedTouchPress(
					event,
					event.currentTarget,
					href != null ? actionLink : actionButton
				);
			}
			return;
		}
		onpointerdown?.(event);
		if (!hasOwnAction) {
			return;
		}
		cancelNestedTouchPress(event, event.currentTarget, href != null ? actionLink : actionButton);
	}

	// The gesture's handlers, forwarded from the root into the bridge the swipe
	// layer fills: the root keeps the event model it had before the split, while
	// the gesture itself lives in the lazily loaded layer. Until the layer has
	// mounted the bridge is empty and each forwarder does nothing.
	const swipeForwarders = $derived(
		hasSwipe
			? {
					onpointermove: (event: PointerEvent) =>
						swipeBridgeRef.current?.handlers.onpointermove(event),
					onpointerup: (event: PointerEvent) => swipeBridgeRef.current?.handlers.onpointerup(event),
					onpointercancel: (event: PointerEvent) =>
						swipeBridgeRef.current?.handlers.onpointercancel(event),
					onclickcapture: (event: MouseEvent) =>
						swipeBridgeRef.current?.handlers.onclickcapture(event),
					onkeydown: (event: KeyboardEvent) => swipeBridgeRef.current?.handlers.onkeydown(event)
				}
			: {}
	);

	const primaryOnClick = $derived(
		isDelegate
			? delegated.onclick
			: hasParentRole
				? onclick
				: isInteractive
					? handleContainerClick
					: undefined
	);

	// The click the browser synthesizes after a drag must not fire the row's own
	// primary.
	const rootOnclick = $derived(
		hasSwipe && primaryOnClick != null
			? (event: MouseEvent) => {
					if (swipeBridgeRef.current?.shouldSuppressClick() === true) {
						return;
					}
					primaryOnClick(event);
				}
			: primaryOnClick
	);

	// `as` may be a caller's link component: its root must still be reachable
	// for delegation and the gesture. The attachment rides the props bag and a
	// component that spreads its props onto an element applies it there.
	const rootAttachKey = createAttachmentKey();
	function attachRoot(node: HTMLElement): () => void {
		rootEl = node;
		return () => {
			if (rootEl === node) {
				rootEl = null;
			}
		};
	}

	const rootProps = $derived({
		...rest,
		...swipeForwarders,
		...(linkRootProps ?? {}),
		'aria-selected': (allowsAriaSelected && isSelected) || undefined,
		'aria-current': rest['aria-current'] ?? (isSelected && !allowsAriaSelected ? true : undefined),
		'aria-disabled': isDisabled || undefined,
		...(isInteractive ? pressable : undefined),
		...theme,
		class: cx(theme.class, rootAttrs.class, className),
		style: mergeStyle(rootAttrs.style, styleProp as string | undefined),
		role,
		onclick: rootOnclick,
		onpointerdown: handlePointerDown
	});
</script>

{#snippet labelAndDescription()}
	<span class={labelAttrs.class} style={labelAttrs.style}>
		{#if typeof label === 'function'}{@render label()}{:else}{label}{/if}
	</span>
	{#if description != null}
		<span class={descAttrs.class} style={descAttrs.style}>
			{#if typeof description === 'function'}{@render description()}{:else}{description}{/if}
		</span>
	{/if}
{/snippet}

{#snippet content()}
	{#if startContent != null}
		<span class={startAttrs.class} style={startAttrs.style}>{@render startContent()}</span>
	{/if}

	{#if hasParentRole || isDelegate}
		<!--
			Delegation mode (and parent-role mode) put the label in a plain span:
			keyboard access lives on the nested control, so no invisible
			button/anchor is rendered and the row adds no second tab stop.
		-->
		<span class={contentAttrs.class} style={contentAttrs.style}>
			{@render labelAndDescription()}
		</span>
	{:else if href != null && !isLinkRoot}
		<LinkElement component={linkResolved.component} props={anchorProps}>
			{@render labelAndDescription()}
		</LinkElement>
	{:else if onclick != null}
		<button
			type="button"
			bind:this={actionButton}
			{onclick}
			disabled={isDisabled}
			class={buttonAttrs.class}
			style={buttonAttrs.style}
		>
			{@render labelAndDescription()}
		</button>
	{:else}
		<span class={contentAttrs.class} style={contentAttrs.style}>
			{@render labelAndDescription()}
		</span>
	{/if}

	{#if endContent != null}
		<span class={endAttrs.class} style={endAttrs.style}>{@render endContent()}</span>
	{/if}
{/snippet}

{#snippet rootContent()}
	<ItemMarkerColumnsScope columns={noMarkerColumns}>
		{#if marker}{@render marker()}{/if}
		{#if marker != null && wantsMarkerColumns}
			<span class={markerContentAttrs.class} style={markerContentAttrs.style}>
				{@render content()}
			</span>
		{:else}
			{@render content()}
		{/if}
	</ItemMarkerColumnsScope>
	{#if hasSwipe}
		<!--
			The panels: out-of-flow children of this root, so the DOM is the one
			the row had before the split. `{#await}` with no pending branch is
			upstream's `Suspense fallback={null}`, and the import is the `lazy()`
			seam: at rest a panel shows nothing either, so nothing appears or moves
			when the layer mounts.
		-->
		{#await import('./item-swipe-layer.svelte') then { default: ItemSwipeLayer }}
			<ItemSwipeLayer
				rootRef={() => rootEl}
				onBridge={setSwipeBridge}
				leading={leadingSwipe}
				trailing={trailingSwipe}
				behavior={swipeBehavior}
			/>
		{/await}
	{/if}
{/snippet}

{#if typeof as === 'string'}
	<svelte:element this={as} bind:this={rootEl} {...rootProps}>
		{@render rootContent()}
	</svelte:element>
{:else}
	<LinkElement component={as} props={{ ...rootProps, [rootAttachKey]: attachRoot }}>
		{@render rootContent()}
	</LinkElement>
{/if}
