<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { IconName } from '../icon/icon-registry.js';

	export type DropdownMenuSubMenuPresentation = 'flyout' | 'drill-in' | 'adaptive';

	export interface DropdownMenuSubMenuProps extends Pick<BaseProps, 'xstyle' | 'class' | 'style'> {
		/**
		 * Icon before the label on the trigger row — a registry name, or a snippet
		 * for a custom icon. Upstream's `ReactNode | IconType`.
		 */
		icon?: Snippet | IconName;
		/** Primary label text for the trigger row. */
		label: string | Snippet;
		/** Secondary description text displayed below the label. */
		description?: string | Snippet;
		/**
		 * Whether the submenu is disabled. A disabled submenu renders its trigger
		 * row but never opens the flyout.
		 * @default false
		 */
		isDisabled?: boolean;
		/**
		 * Show a spinner in place of the caret, e.g. while a lazy submenu's
		 * children are loading. Ported from the legacy `hasSpinner` async-submenu
		 * affordance.
		 * @default false
		 */
		hasSpinner?: boolean;
		/** Fixed flyout width. Defaults to sizing to its content (min 160px). */
		menuWidth?: number | string;
		/** Called when the flyout opens or closes. */
		onOpenChange?: (isOpen: boolean) => void;
		/**
		 * How the sub-menu shows its rows. `flyout` opens them beside the row;
		 * `drill-in` replaces the menu's rows with them and a Back row, in the
		 * same box; `adaptive` drills in when a finger opened the menu and flies
		 * out otherwise. Drill-in needs a `DropdownMenu` root.
		 * @default 'adaptive'
		 */
		presentation?: DropdownMenuSubMenuPresentation;
		/**
		 * How long a hovering pointer waits before the flyout opens, in
		 * milliseconds. Keyboard focus and touch never wait.
		 * @default 150
		 */
		delay?: number;
		/**
		 * How long the flyout stays open after the pointer leaves, in
		 * milliseconds.
		 * @default 200
		 */
		hideDelay?: number;
		/**
		 * Content above the sub-menu's rows: a field that filters them, say. It
		 * sits beside the sub-menu's `role="menu"` element, never inside it, and
		 * keeps its own keys and presses. With a header or footer the sub-menu's
		 * surface is a modal dialog named by the row.
		 */
		header?: Snippet;
		/** Content below the sub-menu's rows. Same rules as `header`. */
		footer?: Snippet;
		/** Test id for the trigger row. */
		'data-testid'?: string;
		/** Test id for the flyout menu. */
		menuDataTestId?: string;
		/**
		 * The flyout's menu items — the same components used at the top level
		 * (`DropdownMenuItem`, `DropdownMenuSubMenu`, selectable items, etc.).
		 *
		 * Data-mode parity lives one level up: give a `DropdownMenu`/`ContextMenu`
		 * item a nested `items` array and it renders a `DropdownMenuSubMenu` with
		 * these children automatically — so the data path never has to reach into
		 * this component.
		 */
		children: Snippet;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import DropdownMenuItem from './dropdown-menu-item.svelte';
	import Icon from '../icon/icon.svelte';
	import Item from '../item/item.svelte';
	import Layer from '../layer/layer.svelte';
	import Portal from './portal.svelte';
	import Spinner from '../spinner/spinner.svelte';
	import { layerAnimations } from '../layer/layer-animations.stylex.js';
	import { useLayer } from '../layer/use-layer.svelte.js';
	import { useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import { useMenuPress } from '../../hooks/use-menu-press.svelte.js';
	import { useTypeahead } from '../../hooks/use-typeahead.js';
	import { isRtlElement } from '../../hooks/is-rtl-element.js';
	import {
		getInteractionModality,
		trackInteractionModality
	} from '../../utils/interaction-modality.js';
	import { useMenuHover } from '../../internal/use-menu-hover.svelte.js';
	import { cx, sx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useMenuOverflow } from './use-menu-overflow.svelte.js';
	import {
		setDropdownMenuContext,
		setDropdownMenuRootOpenContext,
		useDropdownMenuContext,
		useDropdownMenuRootOpenContext,
		useDropdownMenuSurfaceContext
	} from './dropdown-menu-context.svelte.js';
	import { focusMenuItemOnHover } from './menu-item-hover.js';
	import { hideRegionedFlyoutsIn } from './hide-open-flyouts.js';
	import { moveRegionsTab } from './menu-region-stops.js';
	import { portalTo } from './portal.stylex.js';
	import {
		MENU_BOUNDARY_SELECTOR,
		MENU_ITEM_ROLES,
		MENU_ITEM_SELECTOR
	} from './menu-item-roles.js';
	import {
		dropdownMenuSubMenuOffset,
		subMenuCaretAttrs,
		subMenuDrillInListAttrs,
		subMenuFlyoutAttrs,
		subMenuPopoverViewportStyle,
		subMenuPopoverXstyle,
		subMenuRegionAttrs,
		subMenuRegionFrameAttrs,
		subMenuRegionMenuAttrs,
		subMenuRegionViewFrameAttrs,
		subMenuTriggerXstyle
	} from './dropdown-menu-sub-menu.stylex.js';

	/**
	 * A single menu row that reveals a nested flyout of its own items. The row
	 * adopts `DropdownMenuItem` semantics (label / icon / description /
	 * isDisabled); its `children` become the flyout content. Place inside a
	 * `DropdownMenu` (or `ContextMenu`) alongside plain items.
	 *
	 * One component, not three — the row is promoted into a nested surface by
	 * having children, the way `SideNavItem` and `TreeListItem` do, rather than a
	 * Sub / SubTrigger / SubContent split. For data-driven menus don't use this
	 * directly: give a menu item a nested `items` array and `RenderDropdownItems`
	 * renders the submenu for you.
	 *
	 * Built on existing primitives — no bespoke floating code. Positioning is
	 * `useLayer` context mode (inline-end with viewport auto-flip, RTL-correct by
	 * default); pointer intent is `useMenuHover`; keyboard is a per-level
	 * `useListFocus` + `useTypeahead`. On a compact touch display the root's
	 * drill-in stack replaces its rows with this level's, with a Back row.
	 *
	 * @example
	 * ```svelte
	 * <DropdownMenu button={{ label: 'Actions' }}>
	 *   {#snippet children()}
	 *     <DropdownMenuItem label="Rename" onClick={rename} />
	 *     <DropdownMenuSubMenu label="Move to" icon="folder">
	 *       <DropdownMenuItem label="Folder A" onClick={() => move('a')} />
	 *     </DropdownMenuSubMenu>
	 *   {/snippet}
	 * </DropdownMenu>
	 * ```
	 */
	const {
		icon,
		label,
		description,
		isDisabled = false,
		hasSpinner = false,
		menuWidth,
		onOpenChange,
		presentation = 'adaptive',
		delay = 150,
		hideDelay = 200,
		header,
		footer,
		children,
		xstyle,
		class: className,
		style: styleProp,
		'data-testid': testId,
		menuDataTestId
	}: DropdownMenuSubMenuProps = $props();

	const t = useTranslator();
	const menuCtx = useDropdownMenuContext();
	const rootSurfaceCtx = useDropdownMenuSurfaceContext();
	const rootOpenCtx = useDropdownMenuRootOpenContext();
	const rootSurface = $derived(rootSurfaceCtx());
	const isRootMenuOpen = $derived(rootOpenCtx() ?? true);
	const menuSize = $derived(menuCtx()?.menuSize ?? 'md');
	const canOpen = $derived(!isDisabled);

	// With a header or footer this level's surface holds controls that are not
	// menu items, so it is a modal dialog around its menu. A root that renders no
	// host (as `ContextMenu` does not) has nowhere outside its menu to put them,
	// so the sub-menu shows its rows alone there.
	const wantsRegions = $derived(header != null || footer != null);
	const rootHostsSurfaces = $derived(rootSurface != null);
	const hasRegions = $derived(wantsRegions && rootHostsSurfaces);
	const surfaceHost = $derived(rootSurface?.host.getElement() ?? null);

	// Upstream mints `contentId` and `triggerId` with two `useId` calls and lets
	// `useLayer` mint a third internally. `$props.id()` may be called once, so all
	// of them derive from a single uid — `ContextMenu`'s arrangement.
	const uid = $props.id();
	const layerId = `${uid}-layer`;
	const contentId = `${uid}-content`;
	const triggerId = `${uid}-trigger`;
	const frameId = `${uid}-frame`;
	// The id this level pushes onto the root's drill-in stack.
	const viewId = `${uid}-view`;

	let triggerEl = $state<HTMLElement | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	let frameEl = $state<HTMLElement | null>(null);
	let headerEl = $state<HTMLElement | null>(null);
	let footerEl = $state<HTMLElement | null>(null);
	let isFlyoutOpen = $state(false);
	let isMenuKeyboardFocused = $state(false);

	$effect(() => {
		trackInteractionModality();
	});

	const drillIn = $derived(menuCtx()?.drillIn);
	const activeDrillIn = $derived(
		drillIn != null &&
			(presentation === 'drill-in' || (presentation === 'adaptive' && drillIn.isCompactTouch))
			? drillIn
			: null
	);
	const isDrillIn = $derived(activeDrillIn != null);
	const isOnStack = $derived(activeDrillIn?.viewStack.includes(viewId) === true);
	const isTopView = $derived(isOnStack && activeDrillIn?.viewStack.at(-1) === viewId);
	const isOpen = $derived(isDrillIn ? isOnStack : isFlyoutOpen);

	const stringLabel = $derived(typeof label === 'string' ? label : undefined);
	const parentLabel = $derived(menuCtx()?.menuLabel);
	const backLabel = $derived(
		parentLabel != null
			? t('@astryx.dropdownMenu.backTo', { parent: parentLabel })
			: t('@astryx.dropdownMenu.back')
	);

	// Where focus lands once a pushed view shows, and after it is popped.
	let pendingViewFocus: 'first' | 'container' | null = null;
	let pendingTriggerFocus = false;

	// A pointer that left while focus was inside the flyout closes it once focus
	// leaves too.
	let isFocusInFrame = false;
	let closeWhenFocusLeaves = false;

	const layer = useLayer(() => ({
		mode: 'context',
		id: layerId,
		lightDismiss: false,
		onShow: () => {
			closeWhenFocusLeaves = false;
			isFlyoutOpen = true;
			onOpenChange?.(true);
		},
		onHide: () => {
			closeWhenFocusLeaves = false;
			// Whatever closed this flyout, a flyout with a header or footer opened
			// from one of its rows closes with it: that flyout renders beside the
			// root's menu, not inside this one, so hiding this one would leave it
			// shown.
			hideRegionedFlyoutsIn(document.getElementById(contentId));
			isFlyoutOpen = false;
			onOpenChange?.(false);
		}
	}));

	function showLayer(): void {
		if (canOpen) {
			layer.show();
		}
	}

	function hideLayer(): void {
		// A pointer leaving a flyout with a header or footer does not close it
		// while focus is inside: what was typed into its field stays.
		if (hasRegions && isFocusInFrame) {
			closeWhenFocusLeaves = true;
			return;
		}
		layer.hide();
	}

	function handleFrameFocusIn(): void {
		isFocusInFrame = true;
		closeWhenFocusLeaves = false;
	}

	function handleFrameFocusOut(e: FocusEvent): void {
		const next = e.relatedTarget;
		if (next instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(next)) {
			return;
		}
		isFocusInFrame = false;
		if (closeWhenFocusLeaves) {
			closeWhenFocusLeaves = false;
			layer.hide();
		}
	}

	function handleFramePointerEnter(): void {
		closeWhenFocusLeaves = false;
		menuHover.contentProps.onmouseenter();
	}

	function open(options?: { focusFirst?: boolean }): void {
		if (!canOpen) {
			return;
		}
		if (activeDrillIn != null) {
			pendingViewFocus = options?.focusFirst ? 'first' : 'container';
			activeDrillIn.push(viewId);
			onOpenChange?.(true);
			return;
		}
		layer.show();
		if (options?.focusFirst) {
			// Synchronous by design — see the focus note in `useMenuHover`. A
			// still-loading flyout has no focusable item, so fall back to the
			// container: keyboard ownership must leave the parent list either way.
			if (!list.focusFirst()) {
				menuEl?.focus();
			}
		}
	}

	function close(options?: { focusTrigger?: boolean }): void {
		if (activeDrillIn != null) {
			if (isOnStack) {
				pendingTriggerFocus = options?.focusTrigger !== false;
				activeDrillIn.pop();
				onOpenChange?.(false);
			}
			return;
		}
		layer.hide();
		if (options?.focusTrigger !== false) {
			triggerEl?.focus();
		}
	}

	// The press model for this flyout: the row under a release acts, the
	// highlight follows a held pointer. A mouse released outside every level
	// dismisses the whole menu; a finger leaves it open.
	const menuPress = useMenuPress(() => ({
		menu: () => menuEl,
		itemSelector: MENU_ITEM_SELECTOR,
		onDismiss: () => {
			close({ focusTrigger: false });
			menuCtx()?.closeMenu();
		}
	}));

	// The pushed view has just shown: land focus as the open asked.
	$effect(() => {
		if (!isTopView || activeDrillIn?.host == null) {
			return;
		}
		untrack(() => {
			const mode = pendingViewFocus;
			if (mode == null) {
				return;
			}
			pendingViewFocus = null;
			const items = list.getItems();
			// Back is the first row; a keyboard open lands on the first enabled row
			// after it. The keys reach a disabled row, but an open never starts there.
			const target =
				mode === 'first'
					? (items.find(
							(item, index) => index > 0 && item.getAttribute('aria-disabled') !== 'true'
						) ?? items[0])
					: null;
			if (target != null) {
				target.focus({ preventScroll: true });
			} else {
				menuEl?.focus({ preventScroll: true });
			}
		});
	});

	// The view was popped: the row is visible again, focus returns to it.
	$effect(() => {
		if (isOnStack || !pendingTriggerFocus) {
			return;
		}
		pendingTriggerFocus = false;
		triggerEl?.focus({ preventScroll: true });
	});

	// Dedicated roving-focus + typeahead for this flyout level. The boundary
	// selector scopes item collection and key handling to this flyout's own
	// `role="menu"` — so a submenu nested inside this one (also inline, also
	// `role="menu"`) doesn't pollute this level's items or double-handle keys.
	const list = useListFocus(() => ({
		itemSelector: MENU_ITEM_SELECTOR,
		boundarySelector: MENU_BOUNDARY_SELECTOR,
		wrap: false,
		onEscape: () => close({ focusTrigger: true })
	}));

	const typeahead = useTypeahead(() => ({
		getItemLabels: () => list.getItems().map((el) => el.textContent),
		onMatch: list.focusItem,
		getCurrentIndex: () =>
			list
				.getItems()
				.findIndex((el) => el === document.activeElement || el.contains(document.activeElement))
	}));

	// A drilled-in list scrolls with the root menu, not on its own, unless it
	// has a header or footer: then its rows scroll between them.
	const menuOverflow = useMenuOverflow({
		menu: () => menuEl,
		content: () => children,
		isOpen: () => isOpen && (!isDrillIn || hasRegions)
	});
	const hasOverflow = $derived(menuOverflow());

	// Hover-intent: entering the trigger opens after a short delay; leaving
	// either surface closes after a delay. Hover-open does not steal focus.
	//
	// Hover intent and the shared hover→click guard only: this level owns its own
	// click handling, roving focus and typeahead. `popover="manual"`, so the
	// invoker wiring other consumers need does not apply. A drill-in row has no
	// hover: a finger drives it, and a press opens it.
	const menuHover = useMenuHover(() => ({
		show: showLayer,
		hide: hideLayer,
		isOpen: isFlyoutOpen,
		isEnabled: canOpen && !isDrillIn && isRootMenuOpen,
		showDelay: delay,
		hideDelay
	}));

	function handleTriggerClick(): void {
		if (isDisabled) {
			return;
		}
		if (isDrillIn) {
			pendingViewFocus = 'first';
			open({ focusFirst: true });
			return;
		}
		// Toggles, except for the click that follows a hover-open (#3121).
		if (isOpen) {
			if (menuHover.confirmHoverOpen()) {
				if (!list.focusFirst()) {
					menuEl?.focus();
				}
				return;
			}
			close({ focusTrigger: true });
		} else {
			open({ focusFirst: true });
		}
	}

	// Move the single focus-driven highlight onto the trigger as the pointer
	// enters it, so a sibling item that still holds focus doesn't stay
	// highlighted alongside the hovered trigger. This is separate from the
	// hover-open intent (onmouseenter/onmouseleave) — the flyout still opens on
	// the hover delay; this only keeps the highlight single.
	function handlePointerMove(e: PointerEvent): void {
		focusMenuItemOnHover(e, isDisabled);
	}

	function handleTriggerKeyDown(e: KeyboardEvent): void {
		if (isDisabled) {
			return;
		}
		const openKey = isRtlElement(triggerEl) ? 'ArrowLeft' : 'ArrowRight';
		if (e.key === openKey || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			// The trigger row is a direct child of the parent menu (not a nested
			// role="menu"), so the parent's key handler would otherwise also act on
			// this event (e.g. Enter clicking the focused row). Stop it here — this
			// level fully handles opening the flyout.
			e.stopPropagation();
			open({ focusFirst: true });
		}
	}

	// Enter/Space activate the focused row; typeahead jumps by first character;
	// the close key (Left, or Right in RTL) returns focus to the trigger;
	// arrows/Home/End defer to useListFocus (RTL-aware).
	//
	// The flyout renders inline (useLayer context mode is a native popover, not a
	// portal), so a submenu nested inside this one bubbles its key events up to
	// this handler. `ownsEvent` (from useListFocus, scoped by boundarySelector)
	// tells us whether the event originated in THIS flyout or a deeper one; we
	// only act on our own, letting the deeper level keep ownership.
	function handleContentKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Tab') {
			// With its own header or footer this level is a dialog: Tab walks its
			// regions and its rows as one stop, and wraps. A deeper level has closed
			// itself as the key bubbled up, and the walk continues from this level's
			// rows.
			if (hasRegions) {
				moveRegionsTab(e, menuEl, headerEl, footerEl, !list.ownsEvent(e));
				return;
			}
			// Otherwise Tab leaves the flyout stack: every open level closes as the
			// key bubbles past it. In a menu with a header or footer above this
			// level, that level moves focus on; in a plain menu the root closes the
			// whole menu, and focus moves on from its trigger (APG menu button).
			close({ focusTrigger: false });
			return;
		}
		if (!list.ownsEvent(e)) {
			return;
		}
		// Escape closes just this submenu and returns focus to its trigger (APG:
		// Escape collapses the current level, not the whole stack). The root
		// popover's focus-trap listens for Escape at the document level and bails
		// when the event is already handled, so we mark it handled here (stop
		// propagation + preventDefault) to keep the parent menu open.
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close({ focusTrigger: true });
			return;
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			const focused = document.activeElement as HTMLElement | null;
			if (focused && MENU_ITEM_ROLES.has(focused.getAttribute('role') ?? '')) {
				focused.click();
			}
			return;
		}
		const closeKey = isRtlElement(menuEl) ? 'ArrowRight' : 'ArrowLeft';
		if (e.key === closeKey) {
			e.preventDefault();
			close({ focusTrigger: true });
			return;
		}
		if (typeahead.onKeyDown(e)) {
			e.preventDefault();
			return;
		}
		list.handleKeyDown(e);
	}

	// A region keeps its own keys: arrows move a field's caret and letters type.
	// Tab moves on through the dialog's stops, and Escape returns to the row as
	// it does from the rows.
	function handleRegionKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Tab') {
			moveRegionsTab(e, menuEl, headerEl, footerEl);
			return;
		}
		if (e.key === 'Escape' && !e.defaultPrevented) {
			e.preventDefault();
			e.stopPropagation();
			close({ focusTrigger: true });
		}
	}

	function handleMenuFocus(e: FocusEvent): void {
		if (hasRegions && e.target === e.currentTarget) {
			isMenuKeyboardFocused = getInteractionModality() === 'keyboard';
		}
	}

	function handleMenuBlur(e: FocusEvent): void {
		if (hasRegions && e.target === e.currentTarget) {
			isMenuKeyboardFocused = false;
		}
	}

	// Re-provide the menu context so nested items behave exactly like top-level
	// ones. Selecting a leaf item must dismiss the WHOLE stack, not just this
	// flyout: close this level (without stealing focus back to the trigger) and
	// propagate up via the parent menu's closeMenu. The drill-in stack passes
	// through untouched — the root owns it — and this level's label names the
	// Back row of a view drilled in from here.
	setDropdownMenuContext(() => ({
		menuSize,
		closeMenu: () => {
			close({ focusTrigger: false });
			menuCtx()?.closeMenu();
		},
		drillIn,
		menuLabel: stringLabel
	}));
	// A nested level's pending hover intent dies with this level as well as the
	// root: a hover-open that fired after this level closed would leave a flyout
	// with a header or footer shown beside the root's menu.
	setDropdownMenuRootOpenContext(() => isRootMenuOpen && isOpen);

	// Upstream's single `setTriggerEl` ref callback: store the row for focus
	// management AND wire it as the flyout's positioning anchor. `Item` spreads
	// its rest props onto the root, so the attachment travels there.
	const triggerAttach = {
		[createAttachmentKey()]: (el: HTMLElement) => {
			triggerEl = el;
			const detach = layer.attachTrigger(el);
			return () => {
				detach?.();
				triggerEl = null;
			};
		}
	};

	const itemTheme = $derived(themeProps('dropdown-menu-item', { size: menuSize }));
	const flyoutTheme = themeProps('dropdown-menu', { presentation: 'popover' });
	const indicatorTheme = themeProps('dropdown-menu-indicator-icon');
	const caretAttrs = subMenuCaretAttrs();
	const triggerXstyle = $derived(subMenuTriggerXstyle(menuSize, isOpen, isDisabled, xstyle));
	const layerXstyle = $derived([subMenuPopoverViewportStyle, subMenuPopoverXstyle(menuWidth)]);
	// The entry animation rides the anchored surface, as upstream applies it
	// beside the flyout's own styles rather than to the layer element.
	const endAnimationAttrs = sx(layerAnimations.end);
	const flyoutAttrs = $derived(subMenuFlyoutAttrs(hasOverflow));
	const flyoutFrameAttrs = subMenuRegionFrameAttrs();
	const regionAttrs = subMenuRegionAttrs();
	const viewFrameAttrs = $derived(
		subMenuRegionViewFrameAttrs(!isTopView, rootSurface?.menuMaxHeight)
	);

	const drillInHost = $derived(activeDrillIn?.host ?? null);
	const viewPortalTarget = $derived(surfaceHost ?? drillInHost);
	const viewPortal = $derived(portalTo(() => viewPortalTarget));
</script>

{#snippet iconSlot()}
	{#if typeof icon === 'string'}
		<Icon {icon} size="sm" color="secondary" />
	{:else if icon}
		{@render icon()}
	{/if}
{/snippet}

{#snippet backIcon()}
	<Icon icon="chevronLeft" size="sm" color="secondary" />
{/snippet}

{#snippet endAffordance()}
	<span
		{...indicatorTheme}
		class={cx(indicatorTheme.class, caretAttrs.class)}
		style={caretAttrs.style}
	>
		{#if hasSpinner}
			<Spinner size="sm" />
		{:else}
			<Icon icon="chevronRight" size="sm" color="secondary" />
		{/if}
	</span>
{/snippet}

{#snippet nestedRows()}
	{#if isDrillIn}
		<DropdownMenuItem
			icon={backIcon}
			label={backLabel}
			hasCloseOnSelect={false}
			onClick={() => close({ focusTrigger: true })}
		/>
	{/if}
	{@render children()}
{/snippet}

{#snippet regionsMenu(surface: 'flyout' | 'view')}
	{@const menuAttrs = subMenuRegionMenuAttrs(hasOverflow, isMenuKeyboardFocused)}
	<div
		bind:this={menuEl}
		{@attach list.attachList}
		id={contentId}
		role="menu"
		tabindex={0}
		aria-label={surface === 'view' ? stringLabel : undefined}
		aria-labelledby={surface === 'view' ? (stringLabel == null ? triggerId : undefined) : triggerId}
		onkeydown={handleContentKeyDown}
		onfocus={handleMenuFocus}
		onblur={handleMenuBlur}
		data-testid={menuDataTestId}
		{...menuPress.menuProps}
		data-astryx-menu-press-surface={rootSurface?.ownerId}
		class={menuAttrs.class}
		style={menuAttrs.style}
	>
		{@render nestedRows()}
	</div>
{/snippet}

{#snippet regionsFrameContents(surface: 'flyout' | 'view')}
	{#if header}
		<div bind:this={headerEl} onkeydown={handleRegionKeyDown} {...regionAttrs}>
			{@render header()}
		</div>
	{/if}
	{@render regionsMenu(surface)}
	{#if footer}
		<div bind:this={footerEl} onkeydown={handleRegionKeyDown} {...regionAttrs}>
			{@render footer()}
		</div>
	{/if}
{/snippet}

{#snippet flyoutFrame()}
	<div
		bind:this={frameEl}
		id={frameId}
		role="dialog"
		aria-modal="true"
		aria-labelledby={triggerId}
		data-astryx-submenu-regions="flyout"
		onfocusin={handleFrameFocusIn}
		onfocusout={handleFrameFocusOut}
		onmouseenter={handleFramePointerEnter}
		onmouseleave={menuHover.contentProps.onmouseleave}
		{...flyoutTheme}
		class={cx(flyoutTheme.class, flyoutFrameAttrs.class, endAnimationAttrs.class)}
		style={flyoutFrameAttrs.style}
	>
		{@render regionsFrameContents('flyout')}
	</div>
{/snippet}

{#snippet drilledInList()}
	{@const listAttrs = subMenuDrillInListAttrs(isTopView)}
	<div
		{@attach viewPortal}
		bind:this={menuEl}
		{@attach list.attachList}
		id={contentId}
		role="menu"
		tabindex={-1}
		aria-label={stringLabel}
		aria-labelledby={stringLabel == null ? triggerId : undefined}
		hidden={!isTopView}
		inert={!isTopView}
		onkeydown={handleContentKeyDown}
		data-testid={menuDataTestId}
		{...menuPress.menuProps}
		class={listAttrs.class}
		style={listAttrs.style}
	>
		{@render nestedRows()}
	</div>
{/snippet}

{#snippet drilledInView()}
	<div
		{@attach viewPortal}
		bind:this={frameEl}
		id={frameId}
		role="dialog"
		aria-modal="true"
		aria-label={stringLabel}
		aria-labelledby={stringLabel == null ? triggerId : undefined}
		data-astryx-submenu-regions="view"
		hidden={!isTopView}
		inert={!isTopView}
		class={viewFrameAttrs.class}
		style={viewFrameAttrs.style}
	>
		{@render regionsFrameContents('view')}
	</div>
{/snippet}

<Item
	{...triggerAttach}
	id={triggerId}
	role="menuitem"
	tabindex={isDisabled ? undefined : -1}
	aria-haspopup={hasRegions ? 'dialog' : 'menu'}
	aria-expanded={isOpen}
	aria-controls={isOpen ? (hasRegions ? frameId : contentId) : undefined}
	aria-disabled={isDisabled || undefined}
	data-testid={testId}
	onmouseenter={menuHover.triggerProps.onmouseenter}
	onmouseleave={menuHover.triggerProps.onmouseleave}
	onpointermove={handlePointerMove}
	startContent={icon != null ? iconSlot : undefined}
	{label}
	{description}
	endContent={endAffordance}
	onclick={handleTriggerClick}
	onkeydown={handleTriggerKeyDown}
	{isDisabled}
	xstyle={triggerXstyle}
	class={cx(itemTheme.class, className)}
	style={styleProp as string | undefined}
	data-size={menuSize}
/>

{#if activeDrillIn != null}
	{#if isOnStack && activeDrillIn.host != null}
		{#if hasRegions}
			{@render drilledInView()}
		{:else}
			{@render drilledInList()}
		{/if}
	{/if}
{:else if hasRegions}
	<Portal target={surfaceHost}>
		<Layer
			{layer}
			placement="end"
			alignment="start"
			offset={dropdownMenuSubMenuOffset}
			xstyle={layerXstyle}
		>
			{@render flyoutFrame()}
		</Layer>
	</Portal>
{:else}
	<Layer
		{layer}
		placement="end"
		alignment="start"
		offset={dropdownMenuSubMenuOffset}
		xstyle={layerXstyle}
	>
		<div
			bind:this={menuEl}
			{@attach list.attachList}
			id={contentId}
			role="menu"
			tabindex={hasOverflow ? 0 : -1}
			aria-labelledby={triggerId}
			onkeydown={handleContentKeyDown}
			onmouseenter={menuHover.contentProps.onmouseenter}
			onmouseleave={menuHover.contentProps.onmouseleave}
			data-testid={menuDataTestId}
			{...menuPress.menuProps}
			{...flyoutTheme}
			class={cx(flyoutTheme.class, flyoutAttrs.class, endAnimationAttrs.class)}
			style={flyoutAttrs.style}
		>
			{@render nestedRows()}
		</div>
	</Layer>
{/if}
