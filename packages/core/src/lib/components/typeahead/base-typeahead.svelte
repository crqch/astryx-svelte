<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { StyleArg } from '../../internal/sx.js';
	import type { BaseTypeaheadSize } from './base-typeahead.stylex.js';
	import type { SearchableItem, SearchSource } from './types.js';

	/** What a listbox-role menu's `render` receives. */
	export interface BaseTypeaheadListboxMenuInfo {
		/** The result list. Render it once; the arrow keys move through it. */
		listbox: Snippet;
		/** The query in the input. */
		query: string;
		/** Whether a search or focus load is running. */
		isBusy: boolean;
		/** Whether the search for the query completed with no results. */
		isEmptySearch: boolean;
		/** Closes the menu. */
		close: () => void;
	}

	/** What a dialog-role menu's `render` receives. */
	export interface BaseTypeaheadDialogMenuInfo {
		/** The query in the input. */
		query: string;
		/** Closes the menu and returns focus to where it was when it opened. */
		close: () => void;
	}

	/**
	 * What the typeahead's menu shows. The component owns the menu's layer: its
	 * position, top layer, outside press, Escape, focus return, and the ARIA that
	 * ties it to the input. The caller only fills it.
	 *
	 * - `listbox`: the result list, with focus kept in the input. `render` may
	 *   put information around the list, such as a header or a hint. Anything a
	 *   person acts on goes in the list as a result, so the arrow keys reach it.
	 * - `dialog`: content that takes focus, named by `label`. Switching from
	 *   `listbox` to `dialog` keeps the menu open on the same anchor.
	 *
	 * Upstream's `render` is a function returning `ReactNode`; here it is a
	 * `Snippet` and its `listbox` member is a snippet too — Svelte cannot hand a
	 * rendered node through a plain object.
	 */
	export type BaseTypeaheadMenu =
		| {
				role: 'listbox';
				render?: Snippet<[BaseTypeaheadListboxMenuInfo]>;
		  }
		| {
				role: 'dialog';
				/** The dialog's accessible name. */
				label: string;
				render: Snippet<[BaseTypeaheadDialogMenuInfo]>;
		  };

	/**
	 * The imperative handle upstream exposes through `BaseTypeahead`'s
	 * `handleRef`.
	 *
	 * Svelte's counterpart is the component instance, so these are instance
	 * exports reached with `bind:this` rather than a `handleRef` prop — the
	 * arrangement `Tokenizer`, `Calendar` and `ChatComposerInput` use.
	 */
	export interface BaseTypeaheadHandle {
		/**
		 * Opens the menu. A dialog-role menu opens at once; a listbox-role menu
		 * shows its results, loading them first if needed. Called from `onChange`,
		 * it keeps the menu open through the pick.
		 */
		open(): void;
		/** Closes the menu. */
		close(): void;
	}

	/**
	 * `onchange` is omitted so the component's own `onChange` is not shadowed by
	 * the native handler arriving through the rest spread — the hole `NumberInput`
	 * and `Selector` close for the same reason. `onkeydown` likewise: it is
	 * *composed* with the internal keyboard model (upstream's `onKeyDown` prop
	 * runs first and can `preventDefault()` to skip it), so leaving the native one
	 * in the surface would let a caller pass one that typechecks and is then
	 * silently shadowed.
	 *
	 * `oninput`/`onfocus`/`onblur`/`onpointerdown` are omitted for the same reason,
	 * and it matters more here than upstream: upstream drops *every* rest prop, so
	 * nothing is advertised-and-then-ignored, whereas this port makes the rest
	 * spread load-bearing on the `<input>` (it is the seam replacing upstream's
	 * `ref`). A handler arriving through it would reasonably be expected to fire,
	 * and these four are set explicitly after the spread. `NumberInput` and
	 * `TextInput` close exactly this hole.
	 */
	export interface BaseTypeaheadProps<T extends SearchableItem> extends Omit<
		BaseProps<HTMLInputElement>,
		'onchange' | 'onkeydown' | 'oninput' | 'onfocus' | 'onblur' | 'onpointerdown'
	> {
		/** Search source providing items. */
		searchSource: SearchSource<T>;
		/** Currently selected item (null = nothing selected). */
		value: T | null;
		/** Callback when selection changes. */
		onChange: (item: T | null) => void;
		/** Renderer for dropdown items. Default: `TypeaheadItem`. */
		renderItem?: Snippet<[T]>;
		/** Placeholder text. */
		placeholder?: string;
		/**
		 * Show results on focus before typing.
		 * @default false
		 */
		hasEntriesOnFocus?: boolean;
		/**
		 * Max dropdown items to display.
		 * @default 10
		 */
		maxMenuItems?: number;
		/** Fixed dropdown width in pixels. Never shrinks below the anchor width. */
		menuWidth?: number;
		/**
		 * Text shown when no results found.
		 * @default 'No results found'
		 */
		emptySearchResultsText?: string;
		/**
		 * Whether the input is disabled.
		 * @default false
		 */
		isDisabled?: boolean;
		/**
		 * When disabled with a reason, keeps the input focusable via `aria-disabled`
		 * (instead of the native `disabled` attribute) and `readonly` so an
		 * associated disabled-reason tooltip stays discoverable by keyboard and
		 * assistive technology. Value mutation is still blocked by the `isDisabled`
		 * guards. Consumers (`Typeahead`) own the tooltip and wrapper.
		 * @default false
		 */
		isFocusableDisabled?: boolean;
		/**
		 * Auto-focus on mount.
		 * @default false
		 */
		hasAutoFocus?: boolean;
		/** Query change callback (for logging/external use). */
		onChangeQuery?: (query: string) => void;
		/** Callback when the dropdown opens or closes. */
		onOpenChange?: (isOpen: boolean) => void;
		/**
		 * What the menu shows: the result list (`role: 'listbox'`, the default),
		 * optionally with information around it, or content that takes focus
		 * (`role: 'dialog'`). See {@link BaseTypeaheadMenu}.
		 */
		menu?: BaseTypeaheadMenu;
		/**
		 * Debounce delay in ms before triggering search after typing.
		 * Set to 0 for synchronous/local search sources that don't need debouncing.
		 * @default 150
		 */
		debounceMs?: number;
		/** ID for the input element (for label association). */
		inputId?: string;
		/** Additional `aria-describedby` IDs. */
		ariaDescribedBy?: string;
		/** Additional `aria-labelledby` IDs. */
		ariaLabelledBy?: string;
		/** Additional StyleX styles for the input element. */
		inputXStyle?: StyleArg;
		/**
		 * Tab-order override for the input element. `Typeahead` passes `-1` while
		 * its selected-value token is shown: the input is visually collapsed
		 * (width 0 / opacity 0) but must stay programmatically focusable for token
		 * edit/clear interactions, so removing it from the Tab order is what
		 * prevents an invisible tab stop (WCAG 2.4.3 / 2.4.7). The input remains
		 * focusable via `.focus()` regardless of this value.
		 */
		inputTabIndex?: number;
		/**
		 * The element the dropdown is positioned against. Upstream's `anchorRef`
		 * `RefObject`; here the element itself, the shape `Popover`'s `anchorRef`
		 * settled. Falls back to the input.
		 */
		anchorEl?: HTMLElement | null;
		/**
		 * Additional keydown handler called before internal keyboard navigation.
		 * If the handler calls `e.preventDefault()`, internal handling is skipped.
		 */
		onKeyDown?: (e: KeyboardEvent) => void;
		/**
		 * Size of the typeahead, used to scale dropdown item padding.
		 * @default 'md'
		 */
		size?: BaseTypeaheadSize;
	}
</script>

<script lang="ts" generics="T extends SearchableItem">
	import { getKey } from '../../utils/get-key.js';
	import { groupItems } from '../../utils/group-items.js';
	import { useAnnounce } from '../../hooks/use-announce.js';
	// Imported from the module, not the barrel: upstream keeps `isImeKeyEvent`
	// out of `hooks/index.ts` too, and its consumers reach it directly.
	import { isImeKeyEvent } from '../../utils/ime.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import Icon from '../icon/icon.svelte';
	import Spinner from '../spinner/spinner.svelte';
	import PopoverLayer from '../popover/popover-layer.svelte';
	import { usePopover } from '../popover/use-popover.svelte.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { FOCUSABLE_SELECTOR } from '../../internal/focusable-selector.js';
	import { warnOnce } from '../../utils/dev-warning.js';
	import { useBusyIndicatorLane } from './busy-indicator-lane.svelte.js';
	import { useTrailingKeyDown } from './trailing-key-down.svelte.js';
	import TypeaheadItem from './typeahead-item.svelte';
	import {
		baseTypeaheadDefaultItemStyle,
		baseTypeaheadDropdownAttrs,
		baseTypeaheadEmptyStateAttrs,
		baseTypeaheadGroupHeadingAttrs,
		baseTypeaheadInputAttrs,
		baseTypeaheadItemAttrs,
		baseTypeaheadItemContentAttrs,
		baseTypeaheadLoadingSpinnerAttrs,
		baseTypeaheadPopoverStyle
	} from './base-typeahead.stylex.js';

	/**
	 * Combobox engine: input, search, keyboard navigation, and dropdown.
	 *
	 * Renders only the `<input>` and the dropdown popover. No wrapper div, no
	 * border styling, no token rendering. Consumers (`Typeahead`, later
	 * `Tokenizer`) provide their own wrapper and pass `anchorEl` for dropdown
	 * positioning.
	 *
	 * Upstream's `ref` (to the input) has no counterpart: rest props are spread
	 * onto the `<input>`, so an attachment travelling through them reaches the
	 * same element — and it also closes the closed-prop-root contradiction
	 * upstream's `BaseProps<HTMLElement>` type leaves open (it declares the whole
	 * attribute surface and destructures a closed list).
	 */
	const {
		searchSource,
		value,
		onChange,
		renderItem,
		placeholder: placeholderFromProps,
		hasEntriesOnFocus = false,
		maxMenuItems = 10,
		menuWidth,
		emptySearchResultsText: emptySearchResultsTextFromProps,
		isDisabled = false,
		isFocusableDisabled = false,
		hasAutoFocus = false,
		onChangeQuery,
		onOpenChange,
		menu,
		inputId: externalInputId,
		ariaDescribedBy,
		ariaLabelledBy,
		inputXStyle,
		inputTabIndex,
		anchorEl,
		onKeyDown: externalOnKeyDown,
		debounceMs = 150,
		size = 'md',
		class: className,
		style: styleProp,
		xstyle,
		...rest
	}: BaseTypeaheadProps<T> = $props();

	const t = useTranslator();
	const placeholder = $derived(placeholderFromProps ?? t('@astryx.typeahead.searchPlaceholder'));
	const emptySearchResultsText = $derived(
		emptySearchResultsTextFromProps ?? t('@astryx.typeahead.emptySearchResults')
	);

	const uid = $props.id();
	const inputId = $derived(externalInputId ?? `${uid}-input`);
	const listboxId = `${uid}-listbox`;
	const popoverId = `${uid}-popover`;

	let inputEl = $state<HTMLInputElement | null>(null);

	// Announce result counts / "no results" to screen readers via a persistent
	// live region (comboboxes-6). The combobox's own popup carries no working
	// live region, so highlight/result changes were previously silent.
	const announce = useAnnounce();

	let query = $state('');
	// `$state.raw`: every write is a whole-array replacement and an item is opaque
	// to this component — deep-proxying would also make a caller mutating an item
	// it owns re-render our row, which React does not do.
	let results = $state.raw<T[]>([]);
	let highlightedIndex = $state(-1);
	let isLoading = $state(false);
	let hasSearched = $state(false);
	// The query the last search was actually started for. Until it matches the
	// input, the cached answer belongs to the old query, so an empty result set
	// is not this query's outcome yet (upstream's `isSearchPending`).
	let lastSearchedQuery = $state('');

	const isDialogMenu = $derived(menu?.role === 'dialog');
	const dialogMenu = $derived(menu?.role === 'dialog' ? menu : null);
	const listboxMenu = $derived(menu?.role === 'listbox' ? menu : null);
	const isSearchPending = $derived(isLoading || query !== lastSearchedQuery);
	const isEmptySearch = $derived(results.length === 0 && hasSearched && !isSearchPending);

	// Set when `open()` runs, so the open is handled after the commit and reads
	// the menu the caller rendered in the same event (a pick that switches a
	// listbox to a dialog, say).
	let openRequest = $state(0);
	let handledOpenRequest = 0;
	// The element focused when `open()` ran. The open runs after the commit, and
	// a click's own handlers can move focus before it, so the menu returns focus
	// here rather than to whatever happened to be focused at close.
	let openerAtRequest: HTMLElement | null = null;
	// Set by a pick that called `open()`; the open after the commit then reloads
	// a listbox or lets a dialog take focus.
	let pickKeptOpen = false;

	// Report the busy state to a wrapper that has taken the indicator over.
	//
	// A context, not a prop: `BaseTypeaheadProps` is re-exported from the
	// package entry point, so a handoff named on it would ship as public API
	// and pin an internal detail between the wrappers and their base. The
	// wrapper provides the lane; the base is the only thing that knows a search
	// has started. Without one, the base renders its own indicator below.
	//
	// Edge-triggered: a redundant `false` on every keystroke below a query
	// threshold reports nothing.
	const getBusyLane = useBusyIndicatorLane();
	const busyLane = getBusyLane?.() ?? null;
	function setLoading(next: boolean): void {
		if (isLoading === next) {
			return;
		}
		isLoading = next;
		busyLane?.onBusyChange(next);
	}

	// The consumer key handler a wrapper passes through trailing context. It
	// runs after this component's own handling, so it observes every key
	// without being able to cancel navigation, selection, or token editing.
	const getTrailingKeyDown = useTrailingKeyDown();

	// Track active pointer to defer popover.show() past click events. With
	// popover="auto", showing the popover between pointerdown and pointerup/click
	// causes the browser's light-dismiss to immediately close it (the click is
	// seen as "outside" the newly-opened popover). Upstream's refs are plain
	// `let`s here — nothing reads them reactively.
	let pointerActive = false;
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Monotonic counter incremented on selection and query-clear. Async searches
	// that resolve after a selection compare their captured generation to the
	// current value and discard stale results.
	let searchGen = 0;
	// The generation at which results were last populated. `handleFocus` compares
	// this to `searchGen` — if they differ, the cached results are stale (a
	// selection cleared them) and shouldn't be re-shown.
	let resultsGen = 0;

	const popover = usePopover(() => ({
		id: popoverId,
		onShow: handleLayerShow,
		onHide: handleLayerHide,
		hasLightDismiss: true,
		hasCloseButton: false,
		// A listbox-role menu keeps DOM focus in the input and the popup's own
		// role="listbox" is the exposed semantics. A dialog-role menu takes focus
		// and is the named dialog, returning it on close.
		hasAutoFocus: isDialogMenu,
		role: isDialogMenu ? ('dialog' as const) : ('none' as const),
		dialogLabel: menu?.role === 'dialog' ? menu.label : undefined
	}));

	function handleLayerShow(): void {
		onOpenChange?.(true);
	}

	function handleLayerHide(): void {
		const wasDialog = isDialogMenu;
		const opener = openerAtRequest;
		openerAtRequest = null;
		onOpenChange?.(false);
		highlightedIndex = -1;
		searchSource.cancel?.();
		if (wasDialog) {
			// The layer's own focus trap restores the element it captured when it
			// activated; this is upstream's opener instead, recorded by `open()`.
			const target = opener?.isConnected ? opener : inputEl;
			target?.focus();
		}
	}

	/** The menu's popover element, if the layer is mounted. */
	function menuLayer(): HTMLElement | null {
		return document.getElementById(popoverId);
	}

	/**
	 * Record where a dialog should return focus. Upstream prefers the control a
	 * press started on (`pressedOpener`, which this port has not adopted); without
	 * it this reads the element focused when `open()` ran — unless that is inside
	 * the menu that is about to be replaced.
	 */
	function captureOpener(): void {
		const active = document.activeElement;
		openerAtRequest =
			active instanceof HTMLElement && !menuLayer()?.contains(active) ? active : null;
	}

	/** Focus the dialog's first control after the menu content has rendered. */
	function focusDialog(): void {
		requestAnimationFrame(() => {
			const root = popover.contentRef ?? menuLayer();
			const target = root?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
			(target ?? inputEl)?.focus();
		});
	}

	/**
	 * Show the layer for a listbox-role menu, deferring past the active click if a
	 * pointer is down. Without this, `popover="auto"` light-dismiss immediately
	 * closes the dropdown when it opens between pointerdown and pointerup/click.
	 */
	function showLayer(): void {
		if (isDisabled || isDialogMenu) {
			return;
		}
		if (pointerActive) {
			document.addEventListener(
				'click',
				() =>
					requestAnimationFrame(() => {
						if (!isDisabled && !isDialogMenu) {
							popover.show();
						}
					}),
				{ once: true }
			);
		} else {
			popover.show();
		}
	}

	/** Upstream's `hideList`: a dialog-role menu is only closed by its handle. */
	function hideList(): void {
		if (!isDialogMenu) {
			popover.hide();
		}
	}

	/** The handle's listbox open: show current results, or load them. */
	function openListbox(): void {
		if (results.length > 0 && resultsGen === searchGen) {
			showLayer();
		} else if (query.length > 0) {
			void performSearch(query);
		} else if (hasEntriesOnFocus) {
			void performBootstrap();
		}
	}

	/**
	 * The imperative handle's `open()`, reached through `bind:this`. It records
	 * the opener and requests the open; the effect below runs after the commit,
	 * so it reads the menu the caller rendered in the same event.
	 */
	export function open(): void {
		captureOpener();
		openRequest += 1;
	}

	/** The imperative handle's `close()`, reached through `bind:this`. */
	export function close(): void {
		popover.hide();
	}

	// Handle a requested open after the commit that requested it. A pick that
	// called `open()` stays open: a listbox reloads its focus entries (or
	// closes), and a dialog is already on screen so it takes focus.
	$effect(() => {
		const request = openRequest;
		if (request === handledOpenRequest) {
			return;
		}
		handledOpenRequest = request;
		const isAfterPick = pickKeptOpen;
		pickKeptOpen = false;
		if (isDisabled) {
			openerAtRequest = null;
			return;
		}
		if (isAfterPick && !isDialogMenu) {
			inputEl?.focus();
			if (hasEntriesOnFocus) {
				void performBootstrap();
			} else {
				popover.hide();
			}
			return;
		}
		if (popover.isOpen) {
			if (isDialogMenu) {
				focusDialog();
			}
			return;
		}
		if (isDialogMenu) {
			popover.show();
		} else {
			openListbox();
		}
	});

	// A listbox menu's content outside the result list is information only:
	// anything a person acts on must be a result, so the arrow keys reach it.
	$effect(() => {
		if (!popover.isOpen || menu?.role !== 'listbox' || menu.render == null) {
			return;
		}
		const list = document.getElementById(listboxId);
		const layer = list?.closest<HTMLElement>('[popover]');
		if (list == null || layer == null) {
			return;
		}
		const outsideList = Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
			(element) => !list.contains(element)
		);
		if (outsideList.length > 0) {
			warnOnce(
				'base-typeahead:menu-control-outside-list',
				'BaseTypeahead',
				'A listbox menu renders a control outside the result list. The arrow ' +
					'keys cannot reach it: make it a result in the list instead.'
			);
		}
	});

	// Set up the anchor on the provided element or fall back to the input itself.
	// Upstream's effect calls `popover.triggerRef(el)` and `triggerRef(null)` on
	// cleanup; `attachTrigger` is the same seam, used imperatively.
	$effect(() => {
		const el = anchorEl ?? inputEl;
		if (!el) {
			return;
		}
		return popover.attachTrigger(el);
	});

	async function performSearch(searchQuery: string): Promise<void> {
		searchSource.cancel?.();
		// Claim a new generation so overlapping searches can't race: an in-flight
		// response for an older query fails the gen check below instead of
		// overwriting the newer results.
		const gen = ++searchGen;
		setLoading(true);
		hasSearched = true;
		lastSearchedQuery = searchQuery;
		try {
			const searchResults = await searchSource.search(searchQuery);
			if (searchGen !== gen) {
				return;
			}
			resultsGen = gen;
			const shown = searchResults.slice(0, maxMenuItems);
			results = shown;
			// `shown`, not `searchResults` — with `maxMenuItems={0}` the unclamped
			// array is non-empty while nothing is rendered, and highlighting index 0
			// of an empty list is what upstream's `shown.length` test avoids.
			highlightedIndex = shown.length > 0 ? 0 : -1;
			if (searchResults.length > 0 || searchQuery.length > 0) {
				showLayer();
			}
			// Announce the outcome only for an active query (not the initial
			// focus-open), so screen-reader users hear result counts / no-results.
			if (searchQuery.length > 0) {
				announce(
					shown.length === 0
						? emptySearchResultsText
						: t('@astryx.typeahead.resultCount', { count: shown.length })
				);
			}
		} catch {
			if (searchGen !== gen) {
				return;
			}
			results = [];
			highlightedIndex = -1;
		} finally {
			if (searchGen === gen) {
				setLoading(false);
			}
		}
	}

	async function performBootstrap(): Promise<void> {
		const gen = ++searchGen;
		setLoading(true);
		try {
			const bootstrapResults = await searchSource.bootstrap();
			if (searchGen !== gen) {
				return;
			}
			resultsGen = gen;
			const shown = bootstrapResults.slice(0, maxMenuItems);
			results = shown;
			highlightedIndex = shown.length > 0 ? 0 : -1;
			if (bootstrapResults.length > 0) {
				showLayer();
			}
		} catch {
			if (searchGen !== gen) {
				return;
			}
			results = [];
		} finally {
			if (searchGen === gen) {
				setLoading(false);
			}
		}
	}

	function handleQueryChange(newQuery: string): void {
		query = newQuery;
		onChangeQuery?.(newQuery);

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (newQuery.length === 0 && !hasEntriesOnFocus) {
			searchGen++;
			searchSource.cancel?.();
			results = [];
			hasSearched = false;
			// Clear any lingering result-count / no-results announcement.
			announce('');
			hideList();
			return;
		}

		const triggerSearch = (): void => {
			if (newQuery.length > 0) {
				void performSearch(newQuery);
			} else if (hasEntriesOnFocus) {
				void performBootstrap();
			}
		};

		if (debounceMs <= 0) {
			triggerSearch();
		} else {
			searchTimeout = setTimeout(triggerSearch, debounceMs);
		}
	}

	function handleInputChange(e: Event): void {
		handleQueryChange((e.target as HTMLInputElement).value);
	}

	function handleSelect(item: T): void {
		// Bump generation to invalidate any in-flight async searches
		searchGen++;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
			searchTimeout = null;
		}
		searchSource.cancel?.();
		// A caller that opens the menu from `onChange` (to switch it to a dialog,
		// say) keeps it open through the pick, so it does not flicker.
		const requestBefore = openRequest;
		onChange(item);
		const keepsMenuOpen = openRequest !== requestBefore;
		query = '';
		results = [];
		hasSearched = false;
		if (keepsMenuOpen) {
			pickKeptOpen = true;
			return;
		}
		popover.hide();
		inputEl?.focus();
	}

	function handleFocus(): void {
		if (isDisabled || isDialogMenu) {
			return;
		}
		if (hasEntriesOnFocus && results.length === 0 && query.length === 0) {
			void performBootstrap();
		} else if (
			results.length > 0 &&
			(query.length > 0 || hasEntriesOnFocus) &&
			// Only re-show cached results if they haven't been invalidated by a
			// selection.
			resultsGen === searchGen
		) {
			showLayer();
		}
	}

	/**
	 * Close the dropdown when focus leaves the input for an element that is
	 * neither inside the field wrapper (anchor) nor inside the dropdown popover.
	 * The native `popover="auto"` light-dismiss only fires on outside pointer
	 * clicks and Escape; it does not close when focus moves away via the keyboard
	 * (Tab) or programmatically, which would otherwise leave an orphaned open
	 * menu. Clicking a result moves focus onto the option (it is `tabindex="-1"`,
	 * so it lives inside the popover) and selection re-focuses the input, so this
	 * only closes on a genuine focus-out of the whole field.
	 */
	function handleBlur(e: FocusEvent): void {
		// A dialog-role menu takes focus from the input, so a blur keeps it.
		if (!popover.isOpen || isDialogMenu) {
			return;
		}
		const next = e.relatedTarget as Node | null;
		if (next) {
			const anchor = anchorEl ?? inputEl;
			const popoverEl = document.getElementById(popover.id);
			if (anchor?.contains(next) || popoverEl?.contains(next)) {
				return;
			}
		}
		popover.hide();
	}

	function handleKeyDown(e: KeyboardEvent): void {
		externalOnKeyDown?.(e);
		if (e.defaultPrevented) {
			return;
		}

		// An IME candidate window uses Enter to commit the composition and
		// Escape/ArrowUp/ArrowDown/Home/End to navigate its own candidates.
		// Without this guard, a composing Enter both fires handleSelect AND
		// clears the input via handleSelect's setQuery(''), so the IME's
		// subsequent compositionend then writes the still-pending syllable
		// into the freshly-cleared field -- producing a second, spurious
		// selection on the next real Enter.
		if (isImeKeyEvent(e)) {
			return;
		}

		if (!popover.isOpen) {
			// A dialog-role menu has no options for the input to move through and
			// only the handle opens it.
			if (isDialogMenu) {
				return;
			}
			if (e.key === 'ArrowDown' && (hasEntriesOnFocus || query.length > 0)) {
				e.preventDefault();
				if (results.length > 0) {
					popover.show();
					highlightedIndex = 0;
				} else if (hasEntriesOnFocus) {
					void performBootstrap();
				}
			}
			return;
		}

		// A dialog-role menu has no options for the input to move through, so the
		// input only closes it.
		if (isDialogMenu) {
			if (e.key === 'Escape') {
				e.preventDefault();
				popover.hide();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (results.length > 0) {
					highlightedIndex = highlightedIndex < results.length - 1 ? highlightedIndex + 1 : 0;
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (results.length > 0) {
					highlightedIndex = highlightedIndex > 0 ? highlightedIndex - 1 : results.length - 1;
				}
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < results.length) {
					handleSelect(results[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				popover.hide();
				break;
			// Upstream nests two guards in these cases. `popover.isOpen` is dead — the
			// switch is only reached when it is already true — so it is not
			// transcribed. `results.length > 0` is *not* dead and is kept: without it
			// Home would highlight index 0 of an empty list.
			case 'Home':
				e.preventDefault();
				if (results.length > 0) {
					highlightedIndex = 0;
				}
				break;
			case 'End':
				e.preventDefault();
				if (results.length > 0) {
					highlightedIndex = results.length - 1;
				}
				break;
		}
	}

	function getItemId(index: number): string {
		return `${listboxId}-option-${index}`;
	}

	/** Closes the menu from a listbox or dialog render's `close` member. */
	function closeMenu(): void {
		popover.hide();
	}

	// Keep the highlighted option visible during keyboard navigation. The listbox
	// is a fixed-height scroll container, so without this the virtual cursor walks
	// off-screen once navigation passes the visible window.
	//
	// All three reads are hoisted above the early return so the dependency set is
	// the same on every run — a read that only happens after the guard would not
	// be tracked on the runs that bail, and the effect would stop re-running.
	// `count` reproduces upstream's `results.length` dep: because `results` is
	// `$state.raw`, reading `.length` subscribes to the whole-array signal, so a
	// same-length replacement re-runs the effect where React would not. That is
	// harmless — the body only calls `scrollIntoView({block: 'nearest'})`, which
	// is idempotent, a no-op when the row is already visible, and writes no state
	// this effect reads, so the extra runs cannot loop.
	$effect(() => {
		const isOpen = popover.isOpen;
		const index = highlightedIndex;
		const count = results.length;
		if (!isOpen || index < 0 || index >= count) {
			return;
		}
		document.getElementById(getItemId(index))?.scrollIntoView?.({ block: 'nearest' });
	});

	const selectedKey = $derived(
		value == null ? null : getKey(value.id, () => results.indexOf(value))
	);

	// Cleanup timeout and cancel in-flight searches. Upstream keys this on
	// `[searchSource]`, not on mount alone, so *swapping* the source also drops
	// the queued debounce and cancels the outgoing one — otherwise the pending
	// search fires against the new source while the old one's request is left
	// running. Reading `searchSource` in the body is what reproduces that key;
	// capturing it in a local is what makes the teardown cancel the source the
	// effect actually ran with rather than whichever is current when it tears down.
	$effect(() => {
		const source = searchSource;
		return () => {
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
			source.cancel?.();
		};
	});

	// New at 0.5.0: the dropdown renders `auxiliaryData.group` as named groups,
	// ungrouped rows first. Upstream numbers the options with a mutable counter
	// (`flatIndex++`) inside the IIFE it renders them from — a Svelte template
	// has no such statement position, so the same numbering is precomputed here
	// and each row carries the index it would have been handed. The counter walks
	// *render* order, not `results` order, which is upstream's behaviour and
	// upstream's bug (see `port/debts.md`).
	const renderGroups = $derived.by(() => {
		let flatIndex = 0;
		return groupItems(results, { ungroupedFirst: true }).map((group) => ({
			heading: group.heading,
			entries: group.items.map((item) => ({ item, index: flatIndex++ }))
		}));
	});

	const inputAttrs = $derived(baseTypeaheadInputAttrs(isDisabled, inputXStyle, xstyle));
	const loadingAttrs = baseTypeaheadLoadingSpinnerAttrs();
	const dropdownTheme = themeProps('typeahead-dropdown');
	const dropdownAttrs = baseTypeaheadDropdownAttrs();
	const itemContentAttrs = baseTypeaheadItemContentAttrs();
	const emptyStateAttrs = baseTypeaheadEmptyStateAttrs();
	const groupHeadingAttrs = baseTypeaheadGroupHeadingAttrs();
	// New at 0.4.x (#4862): the no-results row became a theme target of its own,
	// so a theme can restyle it without reaching through the dropdown.
	const emptyStateTheme = themeProps('typeahead-empty-state');
</script>

<!-- svelte-ignore a11y_autofocus -->
<input
	{...rest}
	bind:this={inputEl}
	id={inputId}
	type="text"
	role="combobox"
	aria-expanded={popover.isOpen}
	aria-controls={isDialogMenu ? popoverId : listboxId}
	aria-haspopup={isDialogMenu ? 'dialog' : undefined}
	aria-activedescendant={popover.isOpen &&
	!isDialogMenu &&
	highlightedIndex >= 0 &&
	highlightedIndex < results.length
		? getItemId(highlightedIndex)
		: undefined}
	aria-autocomplete="list"
	aria-busy={isLoading || undefined}
	aria-describedby={ariaDescribedBy}
	aria-labelledby={ariaLabelledBy}
	aria-disabled={isFocusableDisabled ? 'true' : undefined}
	tabindex={inputTabIndex}
	value={query}
	oninput={handleInputChange}
	onpointerdown={() => {
		pointerActive = true;
		document.addEventListener(
			'click',
			() => {
				pointerActive = false;
			},
			{ once: true }
		);
	}}
	onfocus={handleFocus}
	onblur={handleBlur}
	onkeydown={(event) => {
		handleKeyDown(event);
		// The consumer handler runs after the built-in handling, so it observes
		// every key on the input and cannot cancel navigation or selection.
		getTrailingKeyDown?.()?.(event);
	}}
	{placeholder}
	disabled={isDisabled && !isFocusableDisabled}
	readonly={isFocusableDisabled || undefined}
	autofocus={hasAutoFocus}
	data-autofocus={hasAutoFocus || undefined}
	autocomplete="off"
	class={cx(inputAttrs.class, className)}
	style={mergeStyle(inputAttrs.style, styleProp as string | undefined)}
/>
{#if isLoading && busyLane == null}
	<!--
		The indicator a direct caller gets. In flow, where it has always been,
		so it reserves its own width and the input's text never runs under it.
		Typeahead and Tokenizer take the indicator over and paint it in their own
		inline-end lane instead; this is what renders for everyone else.
	-->
	<span class={loadingAttrs.class} style={loadingAttrs.style}>
		<!-- Named, never live: the typeahead announces its search. -->
		<Spinner size="sm" role="img" aria-label={t('@astryx.typeahead.loading')} />
	</span>
{/if}

<PopoverLayer
	{popover}
	placement="below"
	alignment="start"
	xstyle={baseTypeaheadPopoverStyle(menuWidth)}
>
	{#if dialogMenu}
		{@render dialogMenu.render({ query, close: closeMenu })}
	{:else if listboxMenu?.render}
		{@render listboxMenu.render({
			listbox,
			query,
			isBusy: isLoading,
			isEmptySearch,
			close: closeMenu
		})}
	{:else}
		{@render listbox()}
	{/if}
</PopoverLayer>

<!--
	The result list, rendered once by the default listbox menu or handed to a
	listbox-role menu's `render` as its `listbox` member. It stays the only
	`role="listbox"` in either case.
-->
{#snippet listbox()}
	<div
		id={listboxId}
		role="listbox"
		aria-label={t('@astryx.typeahead.searchResults')}
		{...dropdownTheme}
		class={cx(dropdownTheme.class, dropdownAttrs.class)}
		style={dropdownAttrs.style}
	>
		{#if results.length === 0 && hasSearched}
			<div
				{...emptyStateTheme}
				class={cx(emptyStateTheme.class, emptyStateAttrs.class)}
				style={emptyStateAttrs.style}
			>
				{emptySearchResultsText}
			</div>
		{:else}
			{#each renderGroups as group (group.heading)}
				{#if group.heading == null}
					{@render options(group.entries)}
				{:else}
					<div role="group" aria-label={group.heading}>
						<div aria-hidden="true" class={groupHeadingAttrs.class} style={groupHeadingAttrs.style}>
							{group.heading}
						</div>
						{@render options(group.entries)}
					</div>
				{/if}
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet options(entries: { item: T; index: number }[])}
	{#each entries as { item, index } (getKey(item.id, index))}
		{@const itemKey = getKey(item.id, index)}
		{@const isSelected = itemKey === selectedKey}
		{@const attrs = baseTypeaheadItemAttrs(size, index === highlightedIndex, isSelected)}
		<!--
			A `role="option"` div with click + hover handlers, as upstream
			renders. The keyboard model belongs to the input, which keeps DOM
			focus and drives selection through `aria-activedescendant`, so the row
			carries `tabindex="-1"` (it must be focusable-by-click so the blur
			handler can tell "inside the popover" from a genuine focus-out) and
			has no key handler of its own.
		-->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			id={getItemId(index)}
			role="option"
			aria-selected={isSelected}
			tabindex={-1}
			onclick={() => handleSelect(item)}
			onmouseenter={() => (highlightedIndex = index)}
			class={attrs.class}
			style={attrs.style}
		>
			<span class={itemContentAttrs.class} style={itemContentAttrs.style}>
				{#if renderItem}{@render renderItem(item)}{:else}<TypeaheadItem
						{item}
						xstyle={baseTypeaheadDefaultItemStyle}
					/>{/if}
			</span>
			{#if isSelected}
				<Icon icon="check" size="sm" color="primary" />
			{/if}
		</div>
	{/each}
{/snippet}
