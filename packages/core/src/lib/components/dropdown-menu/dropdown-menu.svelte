<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { ButtonProps } from '../button/button.svelte';
	import type { AdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import type { LayerAlignment, LayerPlacement } from '../layer/use-layer.svelte.js';
	import type { DropdownMenuOption } from './dropdown-menu-types.js';

	/** The trigger button's props, minus its click handler (owned internally). */
	export type DropdownMenuButtonProps = Omit<ButtonProps, 'onclick'>;

	/** The menus' shared presentation policy. */
	export type DropdownMenuPresentation = AdaptivePresentation;

	export interface DropdownMenuProps extends BaseProps {
		/** Props for the trigger `Button`. Defaults to a localized "Menu" label. */
		button?: DropdownMenuButtonProps;
		/** Controlled open state. Omit for uncontrolled. */
		isMenuOpen?: boolean;
		/** Fired when the menu opens or closes. */
		onOpenChange?: (isOpen: boolean) => void;
		/** Menu width. Numbers are px, strings pass through. Defaults to the anchor width. */
		menuWidth?: number | string;
		/**
		 * Maximum menu height in pixels, for a menu that must fit its rows.
		 * Lifts the default 300px cap; the viewport still bounds it.
		 */
		menuMaxHeight?: number;
		/** Fired when the trigger is clicked (before open/close). */
		onClick?: () => void;
		/**
		 * Show the trailing chevron on the trigger (ignored when icon-only or when
		 * the button sets its own `endContent`).
		 * @default true
		 */
		hasChevron?: boolean;
		/**
		 * Placement of the menu relative to the trigger.
		 * @default 'below'
		 */
		placement?: LayerPlacement;
		/**
		 * Alignment along the placement axis.
		 * Uses the same alignment values as other Astryx layer-based components.
		 * @default 'start'
		 */
		alignment?: LayerAlignment;
		/**
		 * Content above the menu's rows and outside the menu itself — a filter
		 * field, a toggle. The menu holds only its rows, so a control that is not
		 * a row goes here or in `footer`, never among the rows.
		 */
		header?: Snippet;
		/**
		 * Content below the menu's rows and outside the menu itself — a "Create"
		 * button. See `header`.
		 */
		footer?: Snippet;
		/**
		 * Surface used to present the actions. Pass a value selected by product
		 * policy (for example, a compact-touch media query) when the presentation
		 * should adapt. Bottom-sheet presentation is intended for short action
		 * sets. Omitted, the menu is the anchored popover. Compound children
		 * support the popover only.
		 * @default 'popover'
		 */
		presentation?: DropdownMenuPresentation;
		/** Data mode: the menu items. Mutually exclusive with `children`. */
		items?: DropdownMenuOption[];
		/** Compound mode: `DropdownMenuItem`s and friends. Mutually exclusive with `items`. */
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import Button from '../button/button.svelte';
	import Heading from '../heading/heading.svelte';
	import Icon from '../icon/icon.svelte';
	import PopoverLayer from '../popover/popover-layer.svelte';
	import MenuBottomSheet from './menu-bottom-sheet.svelte';
	import MenuBottomSheetActionList from './menu-bottom-sheet-action-list.svelte';
	import RenderDropdownItems from './render-dropdown-items.svelte';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { usePopover } from '../popover/use-popover.svelte.js';
	import { useAdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import { useFocusReturnVisibility } from '../../hooks/use-focus-return-visibility.svelte.js';
	import { useDropdownMenuPress } from '../../hooks/use-menu-press.svelte.js';
	import type { MenuPressPointerType } from '../../hooks/menu-press-gesture.js';
	import { useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import { useTypeahead } from '../../hooks/use-typeahead.js';
	import { claimPress, currentGesture, isPressInFlight } from '../layer/gesture-counter.js';
	import { focusForLastInput } from '../../utils/focus-return.js';
	import { layerAnimations } from '../layer/layer-animations.stylex.js';
	import { rtlStyles } from '../../utils/rtl.stylex.js';
	import {
		getInteractionModality,
		trackInteractionModality
	} from '../../utils/interaction-modality.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import {
		setDropdownMenuContext,
		setDropdownMenuRootOpenContext,
		setDropdownMenuSurfaceContext
	} from './dropdown-menu-context.svelte.js';
	import { useMenuDrillIn } from './use-menu-drill-in.svelte.js';
	import { useMenuOverflow } from './use-menu-overflow.svelte.js';
	import { hideOpenFlyouts } from './hide-open-flyouts.js';
	import { moveRegionsTab } from './menu-region-stops.js';
	import { drillInHostAttrs, drillInTreeAttrs } from './use-menu-drill-in.stylex.js';
	import {
		MENU_BOUNDARY_SELECTOR,
		MENU_ITEM_ROLES,
		MENU_ITEM_SELECTOR
	} from './menu-item-roles.js';
	import {
		dropdownMenuAttrs,
		dropdownMenuOffset,
		dropdownPopoverViewportStyle,
		dropdownPopoverWidthStyle,
		dropdownRegionAttrs,
		dropdownRegionsFrameAttrs,
		dropdownSheetTriggerXstyle,
		dropdownSurfaceHostAttrs,
		dropdownTriggerXstyle,
		dropdownBottomSheetContentAttrs,
		dropdownBottomSheetHeaderAttrs,
		dropdownBottomSheetRegionAttrs,
		dropdownBottomSheetRootHeadingStyle,
		dropdownBottomSheetViewHeadingStyle
	} from './dropdown-menu.stylex.js';
	import {
		menuBottomSheetContentAttrs,
		menuBottomSheetHeadingAloneStyle
	} from './menu-bottom-sheet.stylex.js';
	import type { DropdownMenuItemData } from './dropdown-menu-types.js';

	/**
	 * A dropdown menu of actionable items, ported from Astryx's `DropdownMenu`.
	 *
	 * Two modes share one keyboard/focus path (`useListFocus` + `useTypeahead`):
	 * pass `items` for a data-driven menu, or `DropdownMenuItem` children for a
	 * compound one. Built on `Popover` (`role: 'none'` so the inner `role="menu"`
	 * is the exposed semantics), following the APG menu-button pattern.
	 *
	 * Initial focus on open follows the input modality: a keyboard open (Enter /
	 * Space / ArrowDown on the trigger) focuses the first enabled item (APG
	 * menu-button); a pointer open focuses the menu container itself so no item
	 * reads as pre-selected, and the first ArrowDown then moves to item 1.
	 */
	const {
		button: buttonFromProps,
		isMenuOpen: controlledIsOpen,
		onOpenChange,
		menuWidth,
		menuMaxHeight,
		onClick,
		hasChevron = true,
		placement = 'below',
		alignment = 'start',
		header,
		footer,
		presentation,
		items,
		children,
		class: className,
		style: styleProp,
		xstyle,
		'data-testid': testId,
		...rest
	}: DropdownMenuProps = $props();

	const t = useTranslator();
	const button = $derived(buttonFromProps ?? { label: t('@astryx.dropdownMenu.label') });

	// Both presentations hang the menu off ONE control. Compound children are
	// pinned to the popover, as upstream's compound props are.
	const resolvedPresentation = useAdaptivePresentation(() =>
		items !== undefined ? (presentation ?? 'popover') : 'popover'
	);
	const usesBottomSheet = $derived(
		resolvedPresentation.resolved === 'bottom-sheet' && items !== undefined
	);
	// How a finger's press runs, on every device: UIMenu's, unless the caller
	// pins `presentation="popover"`. The omitted presentation is the anchored
	// popover visually but keeps the handoff, as upstream's does.
	const pressTouchModel = $derived(presentation === 'popover' ? 'pointer' : 'uikit');

	// Two ids, as upstream has two. `usePopover` here *requires* one for the layer
	// (see `useLayer` for why the hook cannot mint it), where upstream's mints its
	// own — so passing the menu's id through would point `aria-controls` at the
	// layer wrapper instead of the `role="menu"` div upstream names. `$props.id()`
	// may be called only once per component, so the second is derived from it;
	// `TabMenu` already mints its `-menu` id exactly this way.
	const uid = $props.id();
	const layerId = uid;
	const menuId = `${uid}-menu`;
	const sheetId = `${uid}-sheet`;
	const menuSize = $derived(button.size ?? 'md');

	// A header or a footer makes the popover a dialog around the menu: those
	// controls are not menu items, and the menu must stop being the only
	// exposed surface.
	const hasRegions = $derived(header != null || footer != null);
	const resolvedMaxHeight = $derived(menuMaxHeight == null ? undefined : `${menuMaxHeight}px`);
	// The name a drilled-in view's Back row reads. Only a text label names a
	// level; a snippet has no accessible name to borrow.
	const menuLabel = $derived(typeof button.label === 'string' ? button.label : undefined);

	// Open state — controlled iff `isMenuOpen` is defined.
	const isControlled = $derived(controlledIsOpen !== undefined);
	let internalIsOpen = $state(false);
	const isOpen = $derived(isControlled ? (controlledIsOpen as boolean) : internalIsOpen);

	// The sheet view stack and the elements its focus moves read. The sheet's
	// trigger and the popover's share `buttonEl`; the branches never coexist.
	let submenuPath = $state<DropdownMenuItemData[]>([]);
	let actionListEl = $state<HTMLElement | null>(null);
	let viewHeadingEl = $state<HTMLElement | null>(null);
	const currentSubmenu = $derived(submenuPath.at(-1));
	const rootTitle = $derived(menuLabel ?? t('@astryx.dropdownMenu.label'));
	const currentTitle = $derived(currentSubmenu?.label ?? rootTitle);
	// A sheet's accessible name must be text; a snippet title falls back to the
	// root title, as upstream's `sheetLabel` does.
	const sheetLabel = $derived(typeof currentTitle === 'string' ? currentTitle : rootTitle);
	const currentItems = $derived(currentSubmenu?.items ?? items ?? []);

	// A controlled close reaches the sheet without passing through
	// `setSheetOpen`, so the view stack returns to the root as the open state
	// falls. A pre-effect keeps the exiting sheet painting the root view.
	$effect.pre(() => {
		if (!isOpen && submenuPath.length > 0) {
			submenuPath = [];
		}
	});

	// The trigger is the focus-return target, and a pointer return must not paint
	// the keyboard ring.
	const focusReturn = useFocusReturnVisibility({ readModality: getInteractionModality });

	// The drill-in view stack for sub-menus on a phone, and the surface host a
	// sub-menu with regions renders into. Both are owned here. The sheet has its
	// own view stack, so the popover's drill-in stays off while it shows.
	const drillIn = useMenuDrillIn(() => isOpen && !usesBottomSheet);
	let surfaceHostEl = $state<HTMLElement | null>(null);
	let headerEl = $state<HTMLElement | null>(null);
	let footerEl = $state<HTMLElement | null>(null);
	let isMenuKeyboardFocused = $state(false);

	$effect(() => {
		trackInteractionModality();
	});

	// Suppress a trigger click that lands in the same tick as a light dismiss
	// (iOS Safari fires pointerdown → hide before the click), which would re-open.
	let lastHideTime = 0;
	// A presentation change closes the popover while the menu stays open; that
	// hide is not a dismissal, so it must not clear the open state or report it.
	let isHidingPopoverForPresentationChange = false;
	let isRestoringPopoverAfterPresentationChange = false;

	// `onOpenChange` fires for BOTH modes, so an uncontrolled menu still reports a
	// native open/close transition (light dismiss, Escape, the popover's own
	// toggle) that never passes through `handleButtonClick`. In controlled mode a
	// button click therefore reports twice — once optimistically from the click,
	// once when the layer commits — which is upstream's behaviour as of 0.3.0.
	function handleLayerHide(): void {
		if (isHidingPopoverForPresentationChange) {
			isHidingPopoverForPresentationChange = false;
			return;
		}
		// Whatever closed the menu, a press it was tracking ends with it.
		menuPress.cancel();
		lastHideTime = Date.now();
		// A submenu flyout is a nested popover, which the menu's own light dismiss
		// never reaches; close it with the menu so it cannot reappear anchored to
		// the viewport corner on the next open.
		hideOpenFlyouts(menuEl);
		onOpenChange?.(false);
		if (!isControlled) internalIsOpen = false;
		buttonEl?.focus();
	}
	function handleLayerShow(): void {
		if (isRestoringPopoverAfterPresentationChange) {
			isRestoringPopoverAfterPresentationChange = false;
			if (!isControlled) internalIsOpen = true;
			return;
		}
		holdOpeningPress();
		onOpenChange?.(true);
		if (!isControlled) internalIsOpen = true;
	}

	const popover = usePopover(() => ({
		id: layerId,
		// Without a header or footer the popup's own role="menu" is the exposed
		// semantics; a dialog around it would announce an extra container. With
		// either, the popover holds controls that are not menu items, so it is a
		// modal dialog named like the menu, with the menu inside it.
		role: hasRegions ? 'dialog' : 'none',
		dialogLabel: hasRegions ? (menuLabel ?? t('@astryx.dropdownMenu.label')) : undefined,
		hasLightDismiss: true,
		hasCloseButton: false,
		hasAutoFocus: false,
		onShow: handleLayerShow,
		onHide: handleLayerHide
	}));

	function closeMenu(): void {
		popover.hide();
	}

	/**
	 * The sheet branch's open setter. It resets the view stack on every close and
	 * carries the focus-return visibility through the sheet's exit.
	 */
	function setSheetOpen(nextIsOpen: boolean): void {
		if (!nextIsOpen) {
			submenuPath = [];
			focusReturn.prepareFocusReturn();
		} else {
			focusReturn.resetFocusReturn();
		}
		onOpenChange?.(nextIsOpen);
		if (!isControlled) {
			internalIsOpen = nextIsOpen;
		}
	}

	function handleSheetSelect(item: DropdownMenuItemData, _event: MouseEvent): void {
		if (item.isDisabled) {
			return;
		}
		item.onClick?.();
		if (item.hasCloseOnSelect !== false) {
			setSheetOpen(false);
		}
	}

	const list = useListFocus(() => ({
		itemSelector: MENU_ITEM_SELECTOR,
		boundarySelector: MENU_BOUNDARY_SELECTOR,
		wrap: false,
		onEscape: closeMenu
	}));

	// First-character typeahead reuses the hook's scoped item collection, so an
	// inline submenu flyout's items aren't swept into this level's targets.
	const getMenuItems = list.getItems;

	const typeahead = useTypeahead(() => ({
		getItemLabels: () => getMenuItems().map((el) => el.textContent),
		onMatch: list.focusItem,
		getCurrentIndex: () =>
			getMenuItems().findIndex(
				(el) => el === document.activeElement || el.contains(document.activeElement)
			)
	}));

	// Defer item focus until the layer has committed open, so focus restore
	// captures the trigger instead of the first menu item. Upstream's
	// `shouldFocusOnOpenRef`; a plain `let`, since a ref is not reactive state and
	// the effect below must fire on `popover.isOpen` alone.
	let shouldFocusOnOpen = false;

	// The menu container — the focus target for a pointer open, and the fallback
	// when no item is focusable. `DropdownMenuSubMenu`'s flyout has the same pair.
	let menuEl = $state<HTMLElement | null>(null);

	// A menu that fits is not made a scroll container, so its touch-action can
	// stay `pinch-zoom`; one that overflows hands vertical scrolling back to the
	// browser and lets it cancel the press.
	const menuOverflow = useMenuOverflow({
		menu: () => menuEl,
		content: () => items ?? children,
		isOpen: () => popover.isOpen && !usesBottomSheet
	});
	const hasOverflow = $derived(menuOverflow());

	// How the next open was initiated. Keyboard (and programmatic) opens focus the
	// first enabled item per the APG menu-button pattern; pointer opens focus the
	// menu container instead, so no item is visually highlighted as if
	// pre-selected (#4477). Reset to 'keyboard' after every open so programmatic
	// controlled opens keep the item-focus behavior. A plain `let` — upstream's
	// `openModalityRef`, and like `shouldFocusOnOpen` it must not be a dependency
	// of the focus effect below.
	let openModality: 'keyboard' | 'pointer' = 'keyboard';

	// Sync controlled open state → popover. The sheet reads the controlled prop
	// directly, so only the popover arm needs this.
	$effect(() => {
		if (!isControlled || usesBottomSheet) return;
		const open = controlledIsOpen;
		untrack(() => {
			if (open && !popover.isOpen) {
				shouldFocusOnOpen = true;
				popover.show();
			} else if (!open && popover.isOpen) {
				popover.hide();
			}
		});
	});

	// A presentation change while the menu is open keeps the menu open in the
	// other surface: the popover closes without a dismissal, and the other way
	// round reopens it. This is upstream's shared open state across its two
	// presentation components.
	let previousResolvedPresentation = resolvedPresentation.resolved;
	$effect(() => {
		const next = resolvedPresentation.resolved;
		if (next === previousResolvedPresentation) return;
		previousResolvedPresentation = next;
		untrack(() => {
			if (next === 'bottom-sheet' && items !== undefined) {
				if (popover.isOpen) {
					isHidingPopoverForPresentationChange = true;
					popover.hide();
				}
			} else {
				// Leaving the sheet for the popover drops the sheet's view stack, as
				// unmounting upstream's sheet component does.
				if (submenuPath.length > 0) {
					submenuPath = [];
				}
				if (isOpen) {
					isRestoringPopoverAfterPresentationChange = true;
					popover.show();
				}
			}
		});
	});

	// The sheet's initial focus follows how it was opened. A keyboard open waits
	// a frame so the sheet's own open focus has run, then lands on the first
	// action; a pointer open leaves focus on the sheet panel.
	let sheetOpenModality: 'keyboard' | 'pointer' = 'pointer';

	$effect(() => {
		if (!usesBottomSheet || !isOpen || sheetOpenModality !== 'keyboard') return;
		const findFirstAction = (): HTMLElement | null =>
			actionListEl?.querySelector<HTMLElement>('button:not(:disabled), a[href]') ?? null;
		let observer: MutationObserver | null = null;
		let frame = requestAnimationFrame(() => {
			const action = findFirstAction();
			if (action != null) {
				action.focus({ preventScroll: true });
				return;
			}
			// The sheet's rows can arrive with the surface; wait for them, then
			// focus a frame later so the sheet's own open-focus has already run.
			observer = new MutationObserver(() => {
				const loaded = findFirstAction();
				if (loaded == null) return;
				observer?.disconnect();
				observer = null;
				frame = requestAnimationFrame(() => loaded.focus({ preventScroll: true }));
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
		};
	});

	// A drilled-in view's heading takes focus as the view changes; the root view
	// does not steal it on open.
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

	// Move focus into the menu only after the layer has committed open, honoring
	// the input modality: keyboard (and programmatic) opens land on the first
	// enabled item per the APG menu-button pattern; pointer opens focus the menu
	// container itself (`tabindex={-1}`) so no item is highlighted as if
	// pre-selected (#4477). Container focus keeps arrows, typeahead, Escape and
	// Tab in the menu's `onkeydown`, and is also the fallback when no item is
	// focusable (e.g. all disabled), mirroring the submenu flyout fallback.
	//
	// `popover.isOpen` is the sole tracked read — `shouldFocusOnOpen` and
	// `openModality` are plain `let`s, so testing them here creates no dependency
	// and needs no `untrack`.
	$effect(() => {
		if (!popover.isOpen || !shouldFocusOnOpen) return;
		shouldFocusOnOpen = false;
		requestAnimationFrame(() => {
			if (openModality === 'pointer' || !list.focusFirst()) {
				menuEl?.focus();
			}
			openModality = 'keyboard';
		});
	});

	function openAndFocus(modality: 'keyboard' | 'pointer' = 'keyboard'): boolean {
		// An unavailable trigger never opens the menu. Button keeps an
		// aria-disabled trigger focusable for its tooltip and swallows only
		// Enter and Space, so the arrow keys, a press and a click would still
		// arrive here; a custom trigger may be natively disabled instead.
		if (buttonEl?.matches(':disabled, [aria-disabled="true"]') === true) {
			return false;
		}
		openModality = modality;
		shouldFocusOnOpen = true;
		popover.show();
		return true;
	}

	// The press that asked for the next open, so the layer's show can keep the
	// trigger the popover's invoker through that press's release (see
	// `holdInvokerThroughPress`). A plain `let`: the show reads it at event
	// time, never as a reactive dependency.
	let openingPress: { gesture: number } | null = null;

	/**
	 * Keep `control` the invoker of popover `popoverId` for the rest of the
	 * press in flight, so the native light dismiss of a `popover="auto"` does
	 * not read the release over the trigger as a dismissal. The attribute is
	 * dropped a task after the release, once light dismiss has run.
	 */
	function holdInvokerThroughPress(control: HTMLElement | null, popoverId: string): void {
		if (control == null) {
			return;
		}
		const doc = control.ownerDocument;
		control.setAttribute('popovertarget', popoverId);
		const onPressEnd = () => {
			doc.removeEventListener('pointerup', onPressEnd, true);
			doc.removeEventListener('pointercancel', onPressEnd, true);
			// Light dismiss runs as the pointerup default action after listeners.
			doc.defaultView?.setTimeout(() => {
				control.removeAttribute('popovertarget');
			}, 0);
		};
		doc.addEventListener('pointerup', onPressEnd, true);
		doc.addEventListener('pointercancel', onPressEnd, true);
	}

	/**
	 * The layer committed open while the press that asked for it is still
	 * down. The browser's light dismiss reads that press's release over the
	 * trigger as a dismissal because the release is outside the popover, so
	 * the trigger has to stay the popover's invoker until the press ends.
	 */
	function holdOpeningPress(): void {
		const press = openingPress;
		openingPress = null;
		if (press != null && press.gesture === currentGesture() && isPressInFlight()) {
			holdInvokerThroughPress(buttonEl ?? null, layerId);
		}
	}

	// A mouse opens on press-down; a finger held on the trigger opens after
	// the long-press delay. Pressing the trigger of an open menu closes it, and
	// the click of that same gesture — reported by `isTriggerClickFromPress` —
	// neither toggles nor reopens.
	function handleTriggerPress(pointerType: MenuPressPointerType): boolean {
		if (popover.isOpen) {
			if (pointerType !== 'mouse') {
				// A finger's tap toggles through its click, as it always did.
				return false;
			}
			onClick?.();
			if (isControlled) {
				onOpenChange?.(false);
			} else {
				popover.hide();
			}
			return false;
		}
		// The press opens the menu before the browser's own mousedown has
		// focused the trigger (a held finger never does), so the popover would
		// remember whatever was focused BEFORE the press as the element to hand
		// focus back to when it closes. Focusing the trigger first gives the
		// popover the state a click-open already has: the trigger is where
		// Escape or a pick returns focus (the APG menu-button pattern). A
		// finger's press shows no ring here.
		if (buttonEl != null) {
			focusForLastInput(buttonEl, { preventScroll: true });
		}
		openingPress = { gesture: currentGesture() };
		if (isControlled) {
			openModality = 'pointer';
			onOpenChange?.(true);
			claimOpeningPress(pointerType);
			return true;
		}
		const didOpen = openAndFocus('pointer');
		if (didOpen) {
			claimOpeningPress(pointerType);
		}
		return didOpen;
	}

	// A mouse can release away from the trigger, or the trigger can move away
	// under it. So the layer claims a mouse's press, and that release lands on
	// the layer; over the trigger, the trigger keeps it.
	function claimOpeningPress(pointerType: MenuPressPointerType): void {
		if (pointerType !== 'mouse') {
			return;
		}
		const layer = menuEl?.closest('[popover]');
		if (layer instanceof HTMLElement) {
			claimPress(layer, { releaseTarget: buttonEl });
		}
	}

	const menuPress = useDropdownMenuPress(() => ({
		menu: () => menuEl,
		trigger: () => buttonEl ?? null,
		itemSelector: MENU_ITEM_SELECTOR,
		onTriggerPress: handleTriggerPress,
		onDismiss: closeMenu,
		// Under a finger, on every device, the opening finger picks as UIMenu's
		// does. `presentation="popover"` pins the pointer model.
		touchModel: pressTouchModel,
		isEnabled: !usesBottomSheet
	}));

	function handleButtonClick(e: MouseEvent): void {
		// The press already opened or closed the menu; its click is spent.
		if (menuPress.isTriggerClickFromPress()) return;
		if (Date.now() - lastHideTime < 50) return;
		onClick?.();
		// `detail === 0` marks a synthesized click (screen reader / AT activation):
		// treat it as keyboard so those users still land on the first item. Real
		// pointer clicks report detail >= 1. Upstream tests the event here rather
		// than reading `utils/interaction-modality.ts` — followed as written.
		const modality = e.detail === 0 ? 'keyboard' : 'pointer';
		if (isControlled) {
			if (!controlledIsOpen) openModality = modality;
			onOpenChange?.(!controlledIsOpen);
		} else if (popover.isOpen) {
			popover.hide();
		} else {
			openAndFocus(modality);
		}
	}

	function handleButtonKeyDown(e: KeyboardEvent): void {
		if (!popover.isOpen && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			openAndFocus();
		}
	}

	// The sheet trigger opens on click, as upstream's does, with the pointer and
	// keyboard both reaching the same toggle. A controlled sheet reports the
	// requested state; an uncontrolled one sets it.
	function handleSheetButtonClick(e: MouseEvent): void {
		if ((e.currentTarget as HTMLElement).matches(':disabled, [aria-disabled="true"]')) {
			return;
		}
		onClick?.();
		if (isControlled) {
			onOpenChange?.(!isOpen);
		} else {
			setSheetOpen(!isOpen);
		}
	}

	function handleSheetButtonKeyDown(e: KeyboardEvent): void {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			sheetOpenModality = 'keyboard';
		}
	}

	function handleSheetButtonPointerDown(): void {
		sheetOpenModality = 'pointer';
	}

	function handleSheetFocus(): void {
		focusReturn.onFocusReturnTargetFocus();
	}

	function moveDialogTab(e: KeyboardEvent, isFromFlyout = false): void {
		moveRegionsTab(e, menuEl, headerEl, footerEl, isFromFlyout);
	}

	// Enter/Space activation + Tab-closes + typeahead layered over roving nav.
	function listKeyDown(e: KeyboardEvent): void {
		// A submenu flyout renders inline inside this menu; its key events bubble
		// up here. Let that level own them — only handle events from this level.
		if (!list.ownsEvent(e)) {
			// Except Tab: each open flyout has closed itself as the key bubbled up,
			// and the root moves on as Tab from one of its own rows would. With a
			// header or footer that walks the regions; otherwise the menu closes and
			// focus moves on from the trigger (APG menu button).
			if (e.key === 'Tab') {
				if (hasRegions) {
					moveDialogTab(e, true);
				} else {
					closeMenu();
				}
			}
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
		// With a header or footer the popover is a dialog and Tab wraps inside it.
		// Without either, the APG menu-button pattern: Tab closes the menu. Do NOT
		// preventDefault — closing restores focus to the trigger, and the
		// browser's default Tab then continues from there.
		if (e.key === 'Tab') {
			if (hasRegions) {
				moveDialogTab(e);
				return;
			}
			closeMenu();
			return;
		}
		if (typeahead.onKeyDown(e)) {
			e.preventDefault();
			return;
		}
		list.handleKeyDown(e);
	}

	// A region keeps its own keys: arrows move a field's caret and letters type.
	// Tab moves on through the dialog's stops.
	function handleRegionKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Tab') {
			moveDialogTab(e);
		}
	}

	// The trigger element — captured for focus restoration, and the popover anchor.
	let buttonEl = $state<HTMLButtonElement>();
	const triggerAttachKey = createAttachmentKey();
	const buttonAttach = {
		[triggerAttachKey]: (el: HTMLElement) => {
			buttonEl = el as HTMLButtonElement;
			return popover.attachTrigger(el);
		}
	};

	const isIconOnly = $derived(button.isIconOnly === true);
	const sheetTriggerAttachKey = createAttachmentKey();
	const sheetTriggerAttach = {
		[sheetTriggerAttachKey]: (el: HTMLElement) => {
			buttonEl = el as HTMLButtonElement;
		}
	};

	// Context for compound items, and the surface host a sub-menu with regions
	// renders into.
	setDropdownMenuContext(() => ({
		closeMenu,
		menuSize,
		drillIn: drillIn.drillIn,
		menuLabel
	}));
	setDropdownMenuSurfaceContext(() => ({
		host: {
			getElement: () => surfaceHostEl
		},
		ownerId: menuId,
		menuMaxHeight: resolvedMaxHeight
	}));
	setDropdownMenuRootOpenContext(() => isOpen);

	function handleMenuFocus(e: FocusEvent): void {
		if (!hasRegions || e.target !== e.currentTarget) {
			return;
		}
		isMenuKeyboardFocused = getInteractionModality() === 'keyboard';
	}

	function handleMenuBlur(e: FocusEvent): void {
		if (!hasRegions || e.target !== e.currentTarget) {
			return;
		}
		isMenuKeyboardFocused = false;
	}

	const menuAttrs = $derived(
		dropdownMenuAttrs({
			isScrollable: hasOverflow,
			hasRegions,
			isMenuKeyboardFocused,
			menuMaxHeight: resolvedMaxHeight,
			xstyle
		})
	);
	const triggerXstyle = $derived(dropdownTriggerXstyle(isOpen, button.xstyle));
	const sheetTriggerXstyle = $derived(
		dropdownSheetTriggerXstyle(isOpen, focusReturn.isFocusRingSuppressed, button.xstyle)
	);
	const themeClass = themeProps('dropdown-menu', { presentation: 'popover' }).class;
	const sheetTheme = themeProps('dropdown-menu', { presentation: 'bottom-sheet' });
	const sheetContentAttrs = $derived(dropdownBottomSheetContentAttrs(xstyle));
	const sheetHeaderAttrs = dropdownBottomSheetHeaderAttrs();
	const sheetRegionAttrs = dropdownBottomSheetRegionAttrs();
	const regionsFrameAttrs = $derived(dropdownRegionsFrameAttrs(resolvedMaxHeight));
	const regionAttrs = dropdownRegionAttrs();
	const surfaceHostAttrs = dropdownSurfaceHostAttrs();
	const treeAttrs = $derived(drillInTreeAttrs(drillIn.isDrilled));
	const hostAttrs = drillInHostAttrs();
	const layerXstyle = $derived([
		dropdownPopoverViewportStyle(resolvedMaxHeight),
		dropdownPopoverWidthStyle(menuWidth),
		layerAnimations[placement]
	]);
</script>

{#snippet chevron()}
	<Icon icon="chevronDown" size="sm" color="inherit" />
{/snippet}

{#snippet backIcon()}
	<Icon icon="chevronLeft" size="sm" xstyle={rtlStyles.mirror} />
{/snippet}

{#snippet sheetViewHeading()}
	<Heading
		{@attach (element: HTMLElement) => {
			viewHeadingEl = element;
		}}
		level={3}
		tabindex={-1}
		xstyle={[
			dropdownBottomSheetViewHeadingStyle,
			currentSubmenu == null && [
				dropdownBottomSheetRootHeadingStyle,
				menuBottomSheetHeadingAloneStyle
			]
		]}
	>
		{#if typeof currentTitle === 'string'}
			{currentTitle}
		{:else}
			{@render currentTitle()}
		{/if}
	</Heading>
{/snippet}

{#snippet menuElement()}
	<!--
		`rest` is spread **first**, upstream's position for it as of 0.2.0, so the
		menu's own `role`/`aria-label`/`id` cannot be overwritten by a consumer
		attribute — the same hazard `Divider`'s spread-order fix addresses. This
		port spread it last while upstream dropped rest here entirely.
	-->
	<div
		{...rest}
		bind:this={menuEl}
		id={menuId}
		role="menu"
		tabindex={hasOverflow || hasRegions ? 0 : -1}
		aria-label={button.label}
		{...menuPress.menuProps}
		onkeydown={listKeyDown}
		onfocus={handleMenuFocus}
		onblur={handleMenuBlur}
		class={cx(themeClass, menuAttrs.class, className)}
		style={mergeStyle(menuAttrs.style, styleProp as string | undefined)}
		{@attach list.attachList}
	>
		<!--
			The drill-in wrappers render always, not only once a view shows: a
			tree that changed shape at push time would remount the sub-menu row
			and with it the view id it just pushed. They own no box.
		-->
		<div {...treeAttrs} hidden={drillIn.isDrilled} inert={drillIn.isDrilled}>
			{#if items !== undefined}
				<RenderDropdownItems {items} />
			{:else}
				{@render children?.()}
			{/if}
		</div>
		<div {...hostAttrs} {@attach drillIn.attachHost}></div>
	</div>
{/snippet}

{#snippet surfaceHost()}
	<div {...surfaceHostAttrs} data-astryx-submenu-host="" bind:this={surfaceHostEl}></div>
{/snippet}

{#snippet sheetContent()}
	<div
		{...rest}
		bind:this={actionListEl}
		id={sheetId}
		{...sheetTheme}
		class={cx(sheetTheme.class, sheetContentAttrs.class, className)}
		style={mergeStyle(sheetContentAttrs.style, styleProp as string | undefined)}
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
		{#if header}
			<div {...sheetRegionAttrs}>
				{@render header()}
			</div>
		{/if}
		<MenuBottomSheetActionList
			items={currentItems}
			onSelect={handleSheetSelect}
			onOpenSubmenu={(item) => (submenuPath = [...submenuPath, item])}
		/>
		{#if footer}
			<div {...sheetRegionAttrs}>
				{@render footer()}
			</div>
		{/if}
	</div>
{/snippet}

{#if usesBottomSheet}
	<Button
		{...button}
		{...sheetTriggerAttach}
		xstyle={sheetTriggerXstyle}
		tooltip={isOpen ? undefined : button.tooltip}
		endContent={button.endContent ?? (hasChevron && !isIconOnly ? chevron : undefined)}
		onpointerdown={(event) => {
			button.onpointerdown?.(
				event as PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }
			);
			handleSheetButtonPointerDown();
		}}
		onkeydown={(event) => {
			button.onkeydown?.(
				event as KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }
			);
			handleSheetButtonKeyDown(event);
		}}
		onfocus={(event) => {
			button.onfocus?.(event as FocusEvent & { currentTarget: EventTarget & HTMLButtonElement });
			handleSheetFocus();
		}}
		onclick={handleSheetButtonClick}
		aria-haspopup="dialog"
		aria-expanded={isOpen}
		aria-controls={sheetId}
		data-testid={testId}
	/>

	<MenuBottomSheet
		{isOpen}
		onOpenChange={setSheetOpen}
		finalFocusRef={() => buttonEl ?? null}
		label={sheetLabel}
	>
		{@render sheetContent()}
	</MenuBottomSheet>
{:else}
	<Button
		{...button}
		{...buttonAttach}
		xstyle={triggerXstyle}
		tooltip={isOpen ? undefined : button.tooltip}
		endContent={button.endContent ?? (hasChevron && !isIconOnly ? chevron : undefined)}
		onclick={handleButtonClick}
		onpointerdown={(event) => {
			button.onpointerdown?.(
				event as PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }
			);
			menuPress.triggerProps.onpointerdown(event);
		}}
		oncontextmenu={(event) => {
			button.oncontextmenu?.(
				event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
			);
			menuPress.triggerProps.oncontextmenu(event);
		}}
		onkeydown={handleButtonKeyDown}
		aria-haspopup={hasRegions ? 'dialog' : 'menu'}
		aria-expanded={isOpen}
		aria-controls={hasRegions ? layerId : menuId}
		data-testid={testId}
	/>

	<PopoverLayer {popover} {placement} {alignment} offset={dropdownMenuOffset} xstyle={layerXstyle}>
		{#if hasRegions}
			<div {...regionsFrameAttrs}>
				{#if header}
					<div bind:this={headerEl} onkeydown={handleRegionKeyDown} {...regionAttrs}>
						{@render header()}
					</div>
				{/if}
				{@render menuElement()}
				{#if footer}
					<div bind:this={footerEl} onkeydown={handleRegionKeyDown} {...regionAttrs}>
						{@render footer()}
					</div>
				{/if}
				{@render surfaceHost()}
			</div>
		{:else}
			{@render menuElement()}
			{@render surfaceHost()}
		{/if}
	</PopoverLayer>
{/if}
