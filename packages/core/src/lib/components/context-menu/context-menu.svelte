<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { StyleArg } from '../../internal/sx.js';
	import type { AdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import type { DropdownMenuSize } from '../dropdown-menu/dropdown-menu-item.stylex.js';
	import type {
		DropdownMenuDividerData,
		DropdownMenuItemData,
		DropdownMenuOption,
		DropdownMenuSection
	} from '../dropdown-menu/dropdown-menu-types.js';

	export type ContextMenuItemData = DropdownMenuItemData;
	// Renamed from `ContextMenuDivider` at upstream 0.4.0 — the bare name is the
	// component alias now. See `DropdownMenuDividerData`.
	export type ContextMenuDividerData = DropdownMenuDividerData;
	export type ContextMenuSection = DropdownMenuSection;
	export type ContextMenuOption = DropdownMenuOption;

	interface ContextMenuBaseProps extends BaseProps {
		/**
		 * Styles applied to the trigger wrapper (the right-click target). By
		 * default the trigger hugs its content — pass a fill style when the whole
		 * parent area should be right-clickable.
		 */
		triggerXstyle?: StyleArg;
		/** The trigger area — right-click on this to open the menu. */
		children: Snippet;
		/**
		 * @default '160px'
		 */
		menuWidth?: number | string;
		/**
		 * @default 'md'
		 */
		size?: DropdownMenuSize;
		/**
		 * Accessible name for the menu surface, announced when it opens.
		 * @default 'Context menu'
		 */
		label?: string;
		/** When true, right-click shows the native browser context menu instead. */
		isDisabled?: boolean;
		/** Called when the menu opens or closes. */
		onOpenChange?: (isOpen: boolean) => void;
		/**
		 * Presentation policy for the menu.
		 * - `popover`: open beside the pointer position.
		 * - `bottom-sheet`: open as an action sheet.
		 * - `adaptive`: use a BottomSheet on compact coarse-pointer viewports and
		 *   the cursor-positioned popover elsewhere.
		 * @default 'popover'
		 */
		presentation?: AdaptivePresentation;
		'data-testid'?: string;
	}

	interface ContextMenuDataProps extends ContextMenuBaseProps {
		/** Menu entries (data-driven mode). */
		items: ContextMenuOption[];
		menuContent?: undefined;
	}

	interface ContextMenuCompoundProps extends ContextMenuBaseProps {
		items?: undefined;
		/** Custom menu content (compound mode). */
		menuContent: Snippet;
	}

	export type ContextMenuProps = ContextMenuDataProps | ContextMenuCompoundProps;
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '../button/button.svelte';
	import Heading from '../heading/heading.svelte';
	import Icon from '../icon/icon.svelte';
	import Layer from '../layer/layer.svelte';
	import MenuBottomSheet from '../dropdown-menu/menu-bottom-sheet.svelte';
	import MenuBottomSheetActionList from '../dropdown-menu/menu-bottom-sheet-action-list.svelte';
	import RenderDropdownItems from '../dropdown-menu/render-dropdown-items.svelte';
	import { setDropdownMenuContext } from '../dropdown-menu/dropdown-menu-context.svelte.js';
	import {
		MENU_BOUNDARY_SELECTOR,
		MENU_ITEM_ROLES,
		MENU_ITEM_SELECTOR
	} from '../dropdown-menu/menu-item-roles.js';
	import { useAdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import { layerAnimations } from '../layer/layer-animations.stylex.js';
	import { useLayer } from '../layer/use-layer.svelte.js';
	import { useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import { useLongPress } from '../../hooks/use-long-press.svelte.js';
	import { useTypeahead } from '../../hooks/use-typeahead.js';
	import { useMenuOverflow } from '../dropdown-menu/use-menu-overflow.svelte.js';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { isImeKeyEvent } from '../../utils/ime.js';
	import { rtlStyles } from '../../utils/rtl.stylex.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import type { DropdownMenuItemData as MenuItemData } from '../dropdown-menu/dropdown-menu-types.js';
	import {
		contextMenuAttrs,
		contextMenuCursorAnchorAttrs,
		contextMenuPopoverXstyle,
		contextMenuSheetHeaderAttrs,
		contextMenuSheetMenuAttrs,
		contextMenuSheetRootHeadingStyle,
		contextMenuSheetViewHeadingStyle,
		contextMenuTriggerAttrs
	} from './context-menu.stylex.js';

	/**
	 * A right-click context menu positioned at the cursor.
	 *
	 * The cursor point is captured as an offset *inside the trigger* and
	 * materialised as a zero-size anchor element, so the menu is positioned
	 * against the trigger's context through CSS anchor positioning rather than
	 * the viewport: it follows the content on scroll and auto-flips at viewport
	 * edges while still appearing under the cursor.
	 *
	 * Two content modes share one keyboard/focus path: `items` for a data-driven
	 * menu, `menuContent` for a compound one. Open state is internal —
	 * right-click (or a touch long-press) opens; outside-click and Escape close.
	 *
	 * @example
	 * ```svelte
	 * <ContextMenu items={[{ label: 'Cut', onClick: cut }, { label: 'Copy', onClick: copy }]}>
	 *   <div>Right-click this area</div>
	 * </ContextMenu>
	 * ```
	 */
	let {
		children,
		menuWidth,
		size = 'md',
		label: labelFromProps,
		isDisabled = false,
		onOpenChange,
		presentation = 'popover',
		class: className,
		style: styleProp,
		xstyle,
		triggerXstyle,
		'data-testid': testId,
		items,
		menuContent
	}: ContextMenuProps = $props();

	const t = useTranslator();
	const label = $derived(labelFromProps ?? t('@astryx.contextMenu.label'));

	// `$props.id()` may be called once per component, and two ids are needed: the
	// `<Layer>` element carries the layer's own id, so the inner `role="menu"`
	// div — which upstream gives a separate `useId` — derives a second from it.
	const uid = $props.id();
	const layerId = `${uid}-layer`;
	const menuId = `${uid}-menu`;
	// Cursor point in the trigger's local coordinate space, written straight onto
	// the zero-size anchor element. Neither value is rendered from state — the
	// anchor's inline offsets are set imperatively, as upstream's ref write is.
	let cursorAnchorEl = $state<HTMLElement | null>(null);
	let triggerEl = $state<HTMLElement | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	// The element focused before the menu opened, restored on close so focus does
	// not fall to <body> after Escape or an outside click.
	let triggerFocusEl: HTMLElement | null = null;

	let isOpen = $state(false);

	// The menu's presentation policy resolves once per render against the active
	// theme, and the sheet has its own view stack.
	const resolvedPresentation = useAdaptivePresentation(() => presentation);
	const usesBottomSheet = $derived(resolvedPresentation.resolved === 'bottom-sheet');
	let submenuPath = $state<MenuItemData[]>([]);
	let viewHeadingEl = $state<HTMLElement | null>(null);
	const currentSubmenu = $derived(submenuPath.at(-1));
	const currentTitle = $derived(currentSubmenu?.label ?? label);
	const sheetLabel = $derived(typeof currentTitle === 'string' ? currentTitle : label);
	const currentItems = $derived(currentSubmenu?.items ?? items ?? []);

	function updateOpenState(nextIsOpen: boolean): void {
		if (!nextIsOpen) {
			submenuPath = [];
		}
		isOpen = nextIsOpen;
		onOpenChange?.(nextIsOpen);
	}

	const layer = useLayer(() => ({
		mode: 'context',
		id: layerId,
		lightDismiss: false,
		onShow: () => {
			updateOpenState(true);
		},
		onHide: () => {
			updateOpenState(false);
			const toRestore = triggerFocusEl;
			triggerFocusEl = null;
			if (toRestore && document.contains(toRestore)) {
				toRestore.focus();
			}
		}
	}));

	function closeMenu(): void {
		if (usesBottomSheet) {
			updateOpenState(false);
		} else {
			layer.hide();
		}
	}

	function handleSheetSelect(item: MenuItemData, _event: MouseEvent): void {
		if (item.isDisabled) {
			return;
		}
		item.onClick?.();
		if (item.hasCloseOnSelect !== false) {
			closeMenu();
		}
	}

	const listFocus = useListFocus(() => ({
		itemSelector: MENU_ITEM_SELECTOR,
		boundarySelector: MENU_BOUNDARY_SELECTOR,
		wrap: false,
		onEscape: closeMenu
	}));

	// First-character typeahead over the enabled menu items. Reuses the hook's
	// scoped item collection so an inline submenu flyout's items aren't swept in.
	const getMenuItems = listFocus.getItems;

	const typeahead = useTypeahead(() => ({
		getItemLabels: () => getMenuItems().map((el) => el.textContent),
		onMatch: listFocus.focusItem,
		getCurrentIndex: () =>
			getMenuItems().findIndex(
				(el) => el === document.activeElement || el.contains(document.activeElement)
			)
	}));

	// Dismiss on any click outside the menu. The layer is `popover="manual"`, not
	// `"auto"`, because native light-dismiss treats the mouseup from the opening
	// right-click as a dismissal; handling mousedown ourselves avoids that race.
	$effect(() => {
		if (!isOpen || usesBottomSheet) return;

		const handleClickOutside = (e: MouseEvent) => {
			const menu = untrack(() => menuEl);
			if (menu && !menu.contains(e.target as Node)) {
				closeMenu();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	// Dismiss on Escape from anywhere while open. The menu's own keydown only
	// fires with focus inside it; this document-level listener is the reliable
	// fallback. Guards against an IME composition-cancel.
	$effect(() => {
		if (!isOpen || usesBottomSheet) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			// Ignore Escape that is committing/cancelling an IME composition;
			// see utils/ime.ts for why.
			if (isImeKeyEvent(e)) return;
			e.preventDefault();
			closeMenu();
		};
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	});

	function listKeyDown(e: KeyboardEvent): void {
		// A submenu flyout renders inline inside this menu; its key events bubble
		// up here. Let that level own them — only handle events from this level.
		if (!listFocus.ownsEvent(e)) {
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
		// APG menu pattern: Tab closes the menu. Menu items are tabindex={-1} so
		// Tab would otherwise leak focus into the page while the menu stayed open
		// (menus-5). Do NOT preventDefault — closing restores focus to the
		// previously focused element, and the browser's default Tab then continues
		// from there to the next element.
		if (e.key === 'Tab') {
			closeMenu();
			return;
		}
		if (typeahead.onKeyDown(e)) {
			e.preventDefault();
			return;
		}
		listFocus.handleKeyDown(e);
	}

	// Place the zero-size cursor anchor at a point in the trigger's local
	// coordinate space and open the menu. Anchoring inside the trigger (rather
	// than storing viewport coordinates on the menu) is what makes the menu
	// context-relative: it scrolls with the content and the browser auto-flips it.
	function openAtLocalPoint(localX: number, localY: number, focusEl: HTMLElement | null): void {
		const anchorEl = cursorAnchorEl;
		if (anchorEl) {
			anchorEl.style.left = `${localX}px`;
			anchorEl.style.top = `${localY}px`;
		}
		// Remember the element focused before opening so it can be restored on
		// close, instead of dropping focus to <body>.
		triggerFocusEl =
			document.activeElement instanceof HTMLElement ? document.activeElement : focusEl;
		if (usesBottomSheet) {
			updateOpenState(true);
			return;
		}
		layer.show();
		requestAnimationFrame(() => listFocus.focusFirst());
	}

	function handleContextMenu(e: MouseEvent): void {
		if (isDisabled) {
			return;
		}
		e.preventDefault();
		const rect = triggerEl?.getBoundingClientRect();
		// A keyboard-initiated contextmenu (Shift+F10 / the Menu key) fires an
		// event whose coordinates are (0, 0) in several browsers. Detect that and
		// anchor to the trigger's bottom-left instead, so the menu stays reachable
		// without a pointer.
		const isKeyboardInvoked = e.clientX === 0 && e.clientY === 0 && e.detail === 0;
		const localX = isKeyboardInvoked || !rect ? 0 : e.clientX - rect.left;
		const localY = isKeyboardInvoked || !rect ? (rect?.height ?? 0) : e.clientY - rect.top;
		openAtLocalPoint(localX, localY, e.currentTarget as HTMLElement);
	}

	// Touch long-press invocation. iOS Safari never synthesises a `contextmenu`
	// event on long-press, so a context menu is otherwise unreachable on touch.
	const longPress = useLongPress(() => ({
		disabled: isDisabled,
		onLongPress: (point: { x: number; y: number }) => {
			const rect = triggerEl?.getBoundingClientRect();
			openAtLocalPoint(
				rect ? point.x - rect.left : point.x,
				rect ? point.y - rect.top : point.y,
				triggerEl
			);
		}
	}));

	setDropdownMenuContext(() => ({ closeMenu, menuSize: size }));

	// A menu that overflows hands vertical touch scrolling to the browser; one
	// that fits keeps pinch-zoom only, so a pan cannot drag the page behind it.
	const menuOverflow = useMenuOverflow({
		menu: () => menuEl,
		content: () => (items !== undefined ? items : menuContent),
		isOpen: () => isOpen && !usesBottomSheet
	});
	const hasOverflow = $derived(menuOverflow());

	// The sheet's content element carries `data-autofocus`, as upstream's does:
	// focus lands on the action list, not on the first row. The shared
	// `focusPanel` keeps native dialog focus on the panel when it is already
	// inside, so the sheet names its content target here after it mounts.
	$effect(() => {
		if (!isOpen || !usesBottomSheet) return;
		const frame = requestAnimationFrame(() => menuEl?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(frame);
	});

	// A drilled-in sheet view's heading takes focus as the view changes; the
	// root view does not steal it on open.
	let previousSubmenuDepth = 0;
	$effect(() => {
		if (!isOpen) {
			previousSubmenuDepth = 0;
			return;
		}
		const depth = submenuPath.length;
		if (depth === previousSubmenuDepth) return;
		previousSubmenuDepth = depth;
		const frame = requestAnimationFrame(() => viewHeadingEl?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(frame);
	});

	const theme = themeProps('context-menu');
	const triggerAttrs = $derived(contextMenuTriggerAttrs(triggerXstyle));
	const anchorAttrs = contextMenuCursorAnchorAttrs();
	const sheetMenuAttrs = $derived(contextMenuSheetMenuAttrs(xstyle));
	const sheetHeaderAttrs = contextMenuSheetHeaderAttrs();
	const menuAttrs = $derived(
		usesBottomSheet ? sheetMenuAttrs : contextMenuAttrs(xstyle, hasOverflow)
	);
	const popoverXstyle = $derived(contextMenuPopoverXstyle(menuWidth));
</script>

{#snippet sheetViewHeading()}
	<Heading
		{@attach (element: HTMLElement) => {
			viewHeadingEl = element;
		}}
		level={3}
		tabindex={-1}
		xstyle={[
			contextMenuSheetViewHeadingStyle,
			currentSubmenu == null && contextMenuSheetRootHeadingStyle
		]}
	>
		{#if typeof currentTitle === 'string'}
			{currentTitle}
		{:else}
			{@render currentTitle()}
		{/if}
	</Heading>
{/snippet}

{#snippet backIcon()}
	<Icon icon="chevronLeft" size="sm" xstyle={rtlStyles.mirror} />
{/snippet}

{#snippet renderedMenu()}
	<div
		bind:this={menuEl}
		{@attach listFocus.attachList}
		id={menuId}
		role="menu"
		aria-label={label}
		data-autofocus={usesBottomSheet ? '' : undefined}
		tabindex={usesBottomSheet ? 0 : -1}
		onkeydown={listKeyDown}
		oncontextmenu={(e) => e.preventDefault()}
		{...theme}
		class={cx(theme.class, menuAttrs.class, className)}
		style={mergeStyle(menuAttrs.style, styleProp as string | undefined)}
	>
		{#if items !== undefined}
			<RenderDropdownItems {items} />
		{:else}
			{@render menuContent?.()}
		{/if}
	</div>
{/snippet}

{#snippet sheetDataContent()}
	<div
		bind:this={menuEl}
		data-autofocus=""
		tabindex={0}
		{...theme}
		class={cx(theme.class, sheetMenuAttrs.class, className)}
		style={mergeStyle(sheetMenuAttrs.style, styleProp as string | undefined)}
	>
		{#if currentSubmenu != null}
			<div {...sheetHeaderAttrs}>
				<Button
					label={t('@astryx.dropdownMenu.back')}
					variant="ghost"
					size="sm"
					icon={backIcon}
					isIconOnly
					onclick={() => (submenuPath = submenuPath.slice(0, -1))}
				/>
				{@render sheetViewHeading()}
			</div>
		{:else}
			{@render sheetViewHeading()}
		{/if}
		<MenuBottomSheetActionList
			items={currentItems}
			onSelect={handleSheetSelect}
			onOpenSubmenu={(item) => (submenuPath = [...submenuPath, item])}
		/>
	</div>
{/snippet}

<div
	bind:this={triggerEl}
	oncontextmenu={handleContextMenu}
	{...longPress}
	data-testid={testId}
	class={triggerAttrs.class}
	style={triggerAttrs.style}
>
	{@render children()}
	<span
		bind:this={cursorAnchorEl}
		{@attach layer.attachTrigger}
		aria-hidden="true"
		class={anchorAttrs.class}
		style={anchorAttrs.style}
	></span>
</div>

{#if usesBottomSheet}
	<MenuBottomSheet {isOpen} onOpenChange={updateOpenState} label={sheetLabel}>
		{#if items !== undefined}
			{@render sheetDataContent()}
		{:else}
			{@render renderedMenu()}
		{/if}
	</MenuBottomSheet>
{:else}
	<Layer
		{layer}
		placement="below"
		alignment="start"
		xstyle={[popoverXstyle, layerAnimations.below]}
	>
		{@render renderedMenu()}
	</Layer>
{/if}
