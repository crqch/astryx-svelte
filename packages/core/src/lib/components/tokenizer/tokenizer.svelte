<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { SizeValue } from '../../internal/types.js';
	import type { InputStatus, InputStatusType } from '../field/types.js';
	import type { FieldStatusVariant } from '../field-status/field-status.stylex.js';
	import type { IconName } from '../icon/icon-registry.js';
	import type { SearchableItem, SearchSource } from '../typeahead/types.js';
	import type { AdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	// `TokenizerSize` is published from `tokenizer.stylex.ts`, derived from the
	// size style keys — the arrangement `Typeahead`/`Selector` use.
	import type { TokenizerSize } from './tokenizer.stylex.js';

	// `TokenizerStatus`/`TokenizerStatusType` alias Field's `InputStatus`/
	// `InputStatusType`, as upstream re-exports them from `Tokenizer.tsx`.
	export type TokenizerStatus = InputStatus;
	export type TokenizerStatusType = InputStatusType;

	/** Change metadata for the `onChange` callback. */
	export type TokenizerChange<T extends SearchableItem> =
		| { item: T; type: 'add' }
		| { item: T; type: 'create' }
		| { item: T; type: 'remove' }
		| { type: 'reorder' };

	/**
	 * Controls overflow behavior when tokens exceed the available width.
	 * - `'none'`: All tokens wrap normally (default).
	 * - `'unfocusedInline'`: Shows a single line with "+ N more" when unfocused, expands inline on focus.
	 * - `'unfocusedLayer'`: Shows a single line with "+ N more" when unfocused, expands as an overlay on focus.
	 */
	export type TokenizerOverflowBehavior = 'none' | 'unfocusedInline' | 'unfocusedLayer';

	/**
	 * How Tokenizer presents its choices, ported from upstream's
	 * `TokenizerPresentation` (`AdaptivePresentation`).
	 * - `'popover'`: the inline combobox with its anchored suggestion menu, on
	 *   every device.
	 * - `'bottom-sheet'`: a field showing the selected tokens, whose trigger
	 *   opens one tall modal sheet. The sheet edits a draft: `onChange` fires
	 *   once, when Save commits it.
	 * - `'adaptive'`: the bottom sheet on compact coarse-pointer screens,
	 *   otherwise the popover.
	 */
	export type TokenizerPresentation = AdaptivePresentation;

	/**
	 * The imperative handle a `Tokenizer` exposes.
	 *
	 * Upstream reaches it through a `handleRef` prop and `useImperativeHandle`;
	 * Svelte's counterpart is the component instance itself, so these are
	 * instance exports and `bind:this` is the seam. There is therefore no
	 * `handleRef` prop — the type still describes exactly what upstream's does.
	 *
	 * @example
	 * ```svelte
	 * let tokenizer: TokenizerHandle;
	 * <Tokenizer bind:this={tokenizer} … />
	 * <button onclick={() => tokenizer.focus()}>Focus</button>
	 * ```
	 */
	export interface TokenizerHandle {
		/** Focus the typeahead input. */
		focus(): void;
		/** Blur the typeahead input. */
		blur(): void;
	}

	/**
	 * `onchange` is omitted so the component's own `onChange` is not shadowed by
	 * the native handler arriving through the rest spread — the hole `Typeahead`
	 * and `Selector` close for the same reason.
	 */
	export interface TokenizerProps<T extends SearchableItem> extends Omit<
		BaseProps<HTMLDivElement>,
		'onchange'
	> {
		/** Accessible label (required). */
		label: string;
		/**
		 * Visually hide the label.
		 * @default false
		 */
		isLabelHidden?: boolean;
		/** Helper text. */
		description?: string;
		/**
		 * Required field.
		 * @default false
		 */
		isRequired?: boolean;
		/**
		 * Optional field.
		 * @default false
		 */
		isOptional?: boolean;
		/** Validation status. */
		status?: InputStatus;
		/**
		 * How the status message is placed relative to the input.
		 * - `attached`: message overlaps directly below the input (bordered treatment)
		 * - `detached`: message floats below as a separate element with spacing
		 * @default 'attached'
		 */
		statusVariant?: FieldStatusVariant;
		/**
		 * Icon to display at the start of the input — a registry name, or a snippet
		 * for a custom icon. Upstream applies `size="sm" color="secondary"` to a
		 * registry icon; a snippet is authored by the caller, so set them yourself
		 * to match.
		 */
		startIcon?: IconName | Snippet;
		/**
		 * Width of the field. Numbers are treated as pixels, strings are used as-is
		 * (e.g. `'100%'`). Sizes the whole field (label, control, and status) so they
		 * stay aligned, unlike setting width via `xstyle`/`class`/`style`.
		 */
		width?: SizeValue;
		/** Label tooltip. */
		labelTooltip?: string;
		/** Search source providing items. */
		searchSource: SearchSource<T>;
		/** Currently selected items. */
		value: T[];
		/**
		 * The HTML name attribute for form submissions. When set, hidden inputs
		 * carry one entry per selected item's id under this name.
		 */
		htmlName?: string;
		/** Callback when selection changes. Includes change metadata. */
		onChange: (items: T[], change: TokenizerChange<T>) => void;
		/** Renderer for dropdown items. Default: `TypeaheadItem`. */
		renderItem?: Snippet<[T]>;
		/**
		 * Renderer for a selected token. Default: `Token` with label + remove.
		 * Upstream's `(item, onRemove) => ReactNode` render prop, which a
		 * parameterised `Snippet` translates directly.
		 */
		renderToken?: Snippet<[T, () => void]>;
		/** Max number of selections. */
		maxEntries?: number;
		/** Placeholder text (shown when no tokens selected). */
		placeholder?: string;
		/**
		 * Show results on focus before typing.
		 * @default false
		 */
		hasEntriesOnFocus?: boolean;
		/**
		 * Max dropdown items.
		 * @default 10
		 */
		maxMenuItems?: number;
		/** Fixed dropdown width in pixels. Never shrinks below the input width. */
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
		 * Explains why the tokenizer is disabled. When set together with
		 * `isDisabled`, the tokenizer shows a tooltip with this text on hover and
		 * keyboard focus, and the input stays focusable (via `aria-disabled`) so the
		 * reason is discoverable by keyboard and assistive technology. Input stays
		 * blocked.
		 *
		 * Use this instead of wrapping a disabled tokenizer in `Tooltip` — disabled
		 * controls don't emit the pointer events an external tooltip needs.
		 */
		disabledMessage?: string;
		/**
		 * Show clear button (clears all tokens).
		 * @default false
		 */
		hasClear?: boolean;
		/**
		 * Content to display at the end of the input row.
		 * Useful for buttons, result counts, or other controls.
		 */
		endContent?: Snippet;
		/**
		 * Auto-focus on mount.
		 * @default false
		 */
		hasAutoFocus?: boolean;
		/**
		 * Input size.
		 * @default 'md'
		 */
		size?: TokenizerSize;
		/**
		 * How the field presents its choices.
		 * - `'popover'`: the inline combobox with its anchored suggestion menu,
		 *   on every device.
		 * - `'bottom-sheet'`: a field showing the selected tokens, whose trigger
		 *   opens one tall modal sheet: a search row on top, full-width checkbox
		 *   rows that keep their place while the sheet is open, a create row with
		 *   `hasCreate`, and a footer pinned in every state with a confirmed
		 *   Clear all and Save. The sheet edits a draft: `onChange` fires once,
		 *   when Save commits it, and a swipe, scrim or Escape close of a changed
		 *   draft asks before discarding.
		 * - `'adaptive'`: the bottom sheet on compact coarse-pointer screens,
		 *   otherwise the popover. The server render and the hydrating render
		 *   are the popover.
		 *
		 * In the sheet presentation the field's box keeps the inline field's
		 * box, theming target and focus ring, and holds the trigger, the tokens
		 * and `endContent`. `renderItem`, `hasClear`, `hasEntriesOnFocus`,
		 * `menuWidth`, `tokenOverflowBehavior` (the field wraps its tokens), and
		 * `hasAutoFocus` have no surface to act on there and warn once in
		 * development.
		 * @default 'adaptive'
		 */
		presentation?: TokenizerPresentation;
		/**
		 * Minimum query length before the search source is queried. Below it no
		 * search runs in the sheet presentation.
		 * @default 1
		 */
		minQueryLength?: number;
		/**
		 * Controls how tokens overflow when the container is too narrow.
		 * - `'none'`: Tokens wrap to multiple lines (default).
		 * - `'unfocusedInline'`: Single line with "+ N more" when unfocused; expands inline on focus.
		 * - `'unfocusedLayer'`: Single line with "+ N more" when unfocused; expands as overlay on focus.
		 * @default 'none'
		 */
		tokenOverflowBehavior?: TokenizerOverflowBehavior;
		/**
		 * Debounce delay in ms before triggering search after typing.
		 * Set to 0 for synchronous/local search sources that don't need debouncing.
		 * @default 150
		 */
		debounceMs?: number;
		/**
		 * Allow users to create new tokens from free-text input.
		 * When true, pressing Enter with text in the input commits the typed value
		 * as a new token — even if the search source returned no results.
		 * @default false
		 */
		hasCreate?: boolean;
		/** Query change callback. */
		onChangeQuery?: (query: string) => void;
		// `onfocusin`/`onfocusout` are upstream's `onFocus`/`onBlur` props. React's
		// synthetic pair *bubbles*, which the native `focus`/`blur` do not — the
		// correction `useListFocus`, `Toolbar` and `Typeahead` already record — so
		// they arrive under the bubbling DOM names, straight off `BaseProps`.
	}

	// Sentinel prefix for creatable items — used to distinguish
	// "Create: X" suggestions from real search results.
	const CREATABLE_ID_PREFIX = '__xds_create__';
</script>

<script lang="ts" generics="T extends SearchableItem">
	import { useSize } from '../../internal/contexts.svelte.js';
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import Field from '../field/field.svelte';
	import Icon from '../icon/icon.svelte';
	import InputClearButton from '../field/input-clear-button.svelte';
	import Layer from '../layer/layer.svelte';
	import { useLayer } from '../layer/use-layer.svelte.js';
	import OverflowList, { type OverflowItem } from '../overflow-list/overflow-list.svelte';
	import Spinner from '../spinner/spinner.svelte';
	import Token from '../token/token.svelte';
	import TooltipLayer from '../tooltip/tooltip-layer.svelte';
	import { useTooltip } from '../tooltip/use-tooltip.svelte.js';
	import BaseTypeahead from '../typeahead/base-typeahead.svelte';
	import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';
	import TokenizerBottomSheet from './tokenizer-bottom-sheet.svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { useAdaptivePresentation } from '../../hooks/use-adaptive-presentation.svelte.js';
	import { warnOnce } from '../../utils/dev-warning.js';
	import { hasInteractiveAncestor } from '../../hooks/use-clickable-container.svelte.js';
	import { useEndLaneReserve } from './use-end-lane-reserve.svelte.js';
	import type { SheetDraftChange } from '../../internal/sheet-draft.js';
	import {
		tokenizerEndSectionAttrs,
		tokenizerIdleSpinnerStyle,
		tokenizerInputAtMaxStyle,
		tokenizerInputCompactStyle,
		tokenizerLayerPlaceholderAttrs,
		tokenizerLayerPopoverStyle,
		tokenizerOverflowTextAttrs,
		tokenizerSheetFieldAttrs,
		tokenizerSheetTokenStyle,
		tokenizerSheetTriggerAttrs,
		tokenizerSheetTriggerPlaceholderAttrs,
		tokenizerStartIconAttrs,
		tokenizerTokenAttrs,
		tokenizerTokenStyle,
		tokenizerWrapperAttrs
	} from './tokenizer.stylex.js';

	/**
	 * Multi-select input with token chips and typeahead search.
	 *
	 * Composes `BaseTypeahead` for search and `Token` for selected items. Tokens
	 * render inline before the text input. Selecting an item adds a token and
	 * clears the query. Backspace on an empty input removes the last token.
	 *
	 * @example
	 * ```svelte
	 * <Tokenizer
	 *   label="Team members"
	 *   searchSource={userSource}
	 *   value={members}
	 *   onChange={(items, change) => {
	 *     members = items;
	 *     if (change.type === 'add') console.log('Added:', change.item.label);
	 *   }}
	 *   placeholder="Search people..."
	 * />
	 * ```
	 */
	const {
		label,
		isLabelHidden = false,
		description,
		isRequired = false,
		isOptional = false,
		status,
		statusVariant = 'attached',
		startIcon,
		labelTooltip,
		searchSource,
		value,
		onChange,
		renderItem,
		renderToken,
		maxEntries,
		placeholder,
		hasEntriesOnFocus,
		maxMenuItems,
		menuWidth,
		emptySearchResultsText,
		isDisabled = false,
		htmlName,
		disabledMessage,
		hasClear = false,
		endContent,
		hasAutoFocus,
		size: sizeProp,
		tokenOverflowBehavior = 'none',
		debounceMs,
		hasCreate = false,
		onChangeQuery,
		presentation = 'adaptive',
		minQueryLength = 1,
		onfocusin: onFocusProp,
		onfocusout: onBlurProp,
		onclick: callerOnClick,
		width,
		xstyle,
		class: className,
		style: styleProp,
		'data-testid': testId,
		...rest
	}: TokenizerProps<T> = $props();

	const t = useTranslator();
	const resolveSize = useSize();
	const size = $derived(resolveSize(sizeProp, 'md'));

	// One base id with derived suffixes — the counterpart to upstream's three
	// `useId` calls, plus two the port needs: the layer's own id (upstream's
	// `useLayer` mints it internally; ours must be passed one) and the tooltip's.
	const uid = $props.id();
	const inputId = `${uid}-input`;
	const descriptionId = `${uid}-description`;
	const statusMessageId = `${uid}-status`;
	const layerId = `${uid}-layer`;
	const tooltipId = `${uid}-tooltip`;

	let inputEl = $state<HTMLInputElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let layerContentEl = $state<HTMLDivElement | null>(null);
	let sheetFieldEl = $state<HTMLDivElement | null>(null);
	let sheetTriggerEl = $state<HTMLButtonElement | null>(null);
	let sheetLaneEl = $state<HTMLDivElement | null>(null);

	// `adaptive` resolves through the policy the selection controls share. An
	// open sheet keeps its presentation until it closes: a resolution change
	// during a task does not replace the open surface.
	const resolvedPresentation = useAdaptivePresentation(() => presentation);
	let isSheetOpen = $state(false);
	// Latched for the sheet's lifetime: a sheet stays presented after it closes
	// until BottomSheet has run its exit and handed focus back to the trigger.
	// Without the latch, `adaptive` resolving to `popover` mid-session would
	// unmount the sheet and the trigger it returns focus to in the same render,
	// dropping focus to the page body.
	let isSheetPresented = $state(false);
	const isSheetPresentation = $derived(
		isSheetOpen || isSheetPresented || resolvedPresentation.resolved === 'bottom-sheet'
	);
	// The sheet's query between presentations: the sheet is in the DOM only
	// from a press until its exit completes, and a close the field forces keeps
	// the query. The plain value follows every report; the press snapshots it
	// into the state the next presentation starts from.
	let sheetQueryRef = '';
	let sheetInitialQuery = $state('');
	// A sheet that was open when the field became disabled stays mounted,
	// closed, so it runs its exit and hands focus back to the trigger; a field
	// that is disabled from the start mounts no sheet.
	let keepsSheetWhileDisabled = $state(false);
	// svelte-ignore state_referenced_locally
	let wasDisabled = isDisabled;
	// Set around a focus move the field makes itself — a presentation swap
	// handing focus from one control to the other — so the receiving control
	// does not report it as focus entering from outside.
	let isHandingOffFocus = false;
	// Whether the caller has been told focus entered the field in this visit, so
	// `onBlur` is never reported without its `onFocus`.
	let hasReportedFocus = false;

	// The end lane's measured reserve. The lane is absolutely positioned and an
	// out-of-flow box reserves nothing, so the input spends the measurement as
	// padding while it has no tokens of its own to push the text.
	const END_LANE_INSET = 'var(--spacing-2)';
	const { attachLane: attachEndLane, reserveStyle: endLaneReserve } =
		useEndLaneReserve(END_LANE_INSET);

	// The inline field's search spinner. The source is wrapped below, so the
	// field knows when a search is in flight without reading BaseTypeahead's
	// internals; the lane holds the spinner's slot while idle so a search does
	// not re-wrap the tokens or widen the field.
	let busyCount = 0;
	let isLaneBusy = $state(false);
	function beginBusy(): void {
		busyCount += 1;
		isLaneBusy = true;
	}
	function endBusy(): void {
		busyCount = Math.max(0, busyCount - 1);
		if (busyCount === 0) {
			isLaneBusy = false;
		}
	}

	// Disabled-reason tooltip. Disabled controls swallow pointer events, so the
	// tooltip listeners attach to the input wrapper and the typeahead input stays
	// perceivable via aria-disabled instead of the disabled attribute. Input is
	// blocked by the isDisabled guards in BaseTypeahead and handleWrapperClick.
	const showsDisabledMessage = $derived(isDisabled && !!disabledMessage);
	const disabledMessageTooltip = useTooltip(() => ({
		id: tooltipId,
		placement: 'above' as const,
		// The wrapper is not naturally focusable; focusin bubbles up from the
		// input, so always attach focus listeners.
		focusTrigger: 'always' as const,
		isEnabled: showsDisabledMessage
	}));

	/**
	 * Upstream's `useImperativeHandle(handleRef, …)`. Svelte's counterpart to an
	 * imperative handle is the component instance, so these are instance exports
	 * reached through `bind:this` rather than a `handleRef` prop.
	 */
	export function focus(): void {
		(isSheetPresentation ? sheetTriggerEl : inputEl)?.focus();
	}

	export function blur(): void {
		(isSheetPresentation ? sheetTriggerEl : inputEl)?.blur();
	}

	// Focus-within state for overflow truncation
	let isFocusedWithin = $state(false);
	const isTruncated = $derived(
		!isFocusedWithin && tokenOverflowBehavior !== 'none' && value.length > 0
	);

	// Layer for unfocusedLayer mode — promotes expanded content to the top layer
	// so it isn't clipped by ancestor overflow.
	const isLayerMode = $derived(tokenOverflowBehavior === 'unfocusedLayer');
	const layer = useLayer(() => ({ mode: 'context', id: layerId }));

	// Anchor the layer to the placeholder element. Upstream gates its `ref`
	// callback on `isLayerMode`; the placeholder only exists in layer mode here,
	// so the attachment is simply not applied outside it.
	const attachPlaceholder = layer.attachTrigger;

	/**
	 * For the layer variant, focus can be in either the placeholder or the
	 * popover content. Both are tracked to decide when focus has truly left.
	 */
	function isFocusInTokenizer(target: Node | null): boolean {
		if (!target) {
			return false;
		}
		if (wrapperEl?.contains(target)) {
			return true;
		}
		if (layerContentEl?.contains(target)) {
			return true;
		}
		// Also check the popover element itself (the layer wrapper)
		const popoverEl = document.getElementById(layer.id);
		if (popoverEl?.contains(target)) {
			return true;
		}
		return false;
	}

	function handleFocusCapture(e: FocusEvent): void {
		const comingFromOutside = !isFocusInTokenizer(e.relatedTarget as Node | null);
		isFocusedWithin = true;
		if (isLayerMode) {
			layer.show();
		}
		if (comingFromOutside) {
			if (!isHandingOffFocus) {
				hasReportedFocus = true;
				onFocusProp?.(e as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
			}
			// Redirect to the input so the user doesn't have to tab through
			// every token remove button.
			if (e.target !== inputEl) {
				inputEl?.focus();
			}
		}
	}

	function handleBlurCapture(e: FocusEvent): void {
		if (!isFocusInTokenizer(e.relatedTarget as Node | null)) {
			isFocusedWithin = false;
			onBlurProp?.(e as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
			if (isLayerMode) {
				layer.hide();
			}
		}
	}

	const isAtMax = $derived(maxEntries != null && value.length >= maxEntries);

	// Filter out already-selected items from search results
	const selectedIds = $derived(new Set(value.map((item) => item.id)));

	// Tokens appeared and disappeared silently before: Backspace on an empty input
	// removes the trailing token, and the per-token remove buttons gave no audible
	// feedback either.
	const announce = useAnnounce();

	/**
	 * Upstream's `useMemo(() => ({search, bootstrap}), [searchSource, selectedIds,
	 * hasCreate])`, whose identity therefore changes on every token add/remove, on
	 * a `searchSource` swap and on a `hasCreate` flip.
	 *
	 * The three keys are **read into locals in the derived's body, not left to the
	 * closures** — that is what gives this derived a dependency set at all. A
	 * `$derived({search: async () => …searchSource…})` only *constructs* the
	 * closures when it runs, reads no signal doing so, and is therefore computed
	 * once and never invalidated: a per-instance constant wearing a memo's
	 * clothes. `BaseTypeahead` keys a cleanup effect on `searchSource` precisely so
	 * that swapping the source drops the queued debounce, so a frozen identity
	 * leaves a search armed before a token was removed to fire afterwards and pop
	 * the dropdown open. Hoisting the reads also restores upstream's
	 * capture-at-memo-time semantics, where the closures see the `selectedIds` of
	 * the render that built them.
	 */
	const filteredSource = $derived.by<SearchSource<T>>(() => {
		const source = searchSource;
		const ids = selectedIds;
		const create = hasCreate;

		return {
			search: async (query: string) => {
				beginBusy();
				try {
					const results = await source.search(query);
					const filtered = results.filter((item) => !ids.has(item.id));

					// Append a "Create: X" synthetic item when hasCreate is true,
					// the user has typed something, and it doesn't exactly match an
					// existing result.
					if (create && query.trim()) {
						const trimmed = query.trim();
						const alreadyExists =
							ids.has(trimmed) ||
							filtered.some((item) => item.label.toLowerCase() === trimmed.toLowerCase());
						if (!alreadyExists) {
							const creatableItem = {
								id: `${CREATABLE_ID_PREFIX}${trimmed}`,
								label: `Create "${trimmed}"`,
								auxiliaryData: { __createdValue: trimmed }
							} as unknown as T;
							filtered.push(creatableItem);
						}
					}

					return filtered;
				} finally {
					endBusy();
				}
			},
			bootstrap: async () => {
				beginBusy();
				try {
					const results = await source.bootstrap();
					return results.filter((item) => !ids.has(item.id));
				} finally {
					endBusy();
				}
			}
		};
	});

	const emptySource: SearchSource<T> = {
		search: async () => [],
		bootstrap: async () => []
	};

	/** Handle adding an item — detect creatable synthetic items. */
	function handleAdd(item: T | null): void {
		if (!item) {
			return;
		}
		if (isAtMax) {
			return;
		}

		// Detect "Create: X" synthetic items from the creatable source
		if (hasCreate && typeof item.id === 'string' && item.id.startsWith(CREATABLE_ID_PREFIX)) {
			const createdValue = item.id.slice(CREATABLE_ID_PREFIX.length);
			if (selectedIds.has(createdValue)) {
				return;
			}
			const realItem = { id: createdValue, label: createdValue } as T;
			const newItems = [...value, realItem];
			onChange(newItems, { item: realItem, type: 'create' });
			announce(t('@astryx.tokenizer.tokenAdded', { label: createdValue }));
			return;
		}

		if (selectedIds.has(item.id)) {
			return;
		}
		const newItems = [...value, item];
		onChange(newItems, { item, type: 'add' });
		announce(t('@astryx.tokenizer.tokenAdded', { label: item.label }));
	}

	/**
	 * Handle removing an item. Single removal path: both Backspace on an empty
	 * input and the per-token remove buttons route through here, so the
	 * announcement covers both.
	 */
	function handleRemove(item: T): void {
		const newItems = value.filter((v) => v.id !== item.id);
		onChange(newItems, { item, type: 'remove' });
		announce(t('@astryx.tokenizer.tokenRemoved', { label: item.label }));
		inputEl?.focus();
	}

	/** Handle clearing all items. */
	function handleClearAll(): void {
		if (value.length === 0) {
			return;
		}
		// Report the last item as removed (convention)
		const lastItem = value[value.length - 1];
		onChange([], { item: lastItem, type: 'remove' });
		inputEl?.focus();
	}

	/** Handle backspace on an empty input — remove the last token. */
	function handleKeyDown(e: KeyboardEvent): void {
		const target = e.currentTarget as HTMLInputElement;
		if (e.key === 'Backspace' && target.value === '' && value.length > 0) {
			e.preventDefault();
			handleRemove(value[value.length - 1]);
		}
	}

	/** Click the wrapper to focus the input. */
	function handleWrapperClick(): void {
		if (!isDisabled) {
			if (isLayerMode) {
				// The input always lives in the popover. Show it and focus.
				layer.show();
				isFocusedWithin = true;
				// The input is already mounted in the popover (not conditional),
				// so we can focus it directly.
				inputEl?.focus();
			} else {
				inputEl?.focus();
			}
		}
	}

	// ---- sheet presentation ----

	// `onChange` fires once, when Save commits the draft. A field that is
	// disabled at Save reports nothing.
	function handleSheetCommit(items: T[], change: SheetDraftChange<T>): void {
		if (!isDisabled) {
			onChange(items, change);
		}
	}

	function handleSheetQueryChange(next: string): void {
		sheetQueryRef = next;
		onChangeQuery?.(next);
	}

	function openSheet(): void {
		if (isDisabled) {
			return;
		}
		// BottomSheet restores focus to whatever opened it. A press on a token or
		// on empty field space opens through this handler without focusing the
		// trigger first (only a press on the trigger itself does), so make the
		// trigger the opener explicitly; otherwise focus would return to the page
		// body and the presentation latch would never clear.
		if (document.activeElement !== sheetTriggerEl) {
			sheetTriggerEl?.focus();
		}
		isSheetPresented = true;
		sheetInitialQuery = sheetQueryRef;
		isSheetOpen = true;
	}

	/**
	 * A caller's `onClick` composes after the field's own open, as upstream
	 * composes it: a caller observes the click but cannot cancel the field's
	 * handling.
	 */
	function handleSheetTriggerClick(event: MouseEvent): void {
		openSheet();
		(callerOnClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
	}

	// A `renderToken` token's own remove control in the sheet field removes at
	// once, as it does in the inline field. Its control leaves with it, so focus
	// moves to the trigger.
	function handleSheetTokenRemove(item: T): void {
		if (isDisabled) {
			return;
		}
		handleRemove(item);
		sheetTriggerEl?.focus();
	}

	// A tap on a token, the placeholder or empty space opens the sheet, as a tap
	// on the trigger does. The trigger, `endContent` and a custom token's
	// controls handle their own clicks.
	function handleSheetFieldClick(event: MouseEvent & { currentTarget: HTMLDivElement }): void {
		const trigger = sheetTriggerEl;
		const target = event.target;
		if (trigger == null || !(target instanceof Element)) {
			return;
		}
		if (
			trigger.contains(target) ||
			sheetLaneEl?.contains(target) ||
			hasInteractiveAncestor(target, event.currentTarget)
		) {
			return;
		}
		trigger.click();
	}

	// The caller's onFocus and onBlur report focus entering and leaving the
	// whole box, as for the inline wrapper. A move between the trigger,
	// `endContent` and a custom token's controls stays inside the field.
	function handleSheetFieldFocus(event: FocusEvent & { currentTarget: HTMLDivElement }): void {
		const isReturningFromSheet =
			event.target === sheetTriggerEl && !isSheetOpen && isSheetPresented;
		if (isReturningFromSheet) {
			isSheetPresented = false;
		}
		const relatedTarget = event.relatedTarget;
		if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
			return;
		}
		// Focus that returns from the field's own sheet, or that a presentation
		// swap hands over, does not enter from outside.
		const isInsideTheField = (isReturningFromSheet && hasReportedFocus) || isHandingOffFocus;
		if (!isInsideTheField) {
			hasReportedFocus = true;
			onFocusProp?.(event);
		}
	}

	function handleSheetFieldBlur(event: FocusEvent & { currentTarget: HTMLDivElement }): void {
		// Focus moving into the sheet, or to another control in the box, is
		// still the field's. Only a blur to somewhere else reports.
		const relatedTarget = event.relatedTarget;
		if (
			isSheetOpen ||
			(relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget))
		) {
			return;
		}
		hasReportedFocus = false;
		onBlurProp?.(event);
	}

	// A field that becomes disabled cannot keep its sheet open, and must not
	// reopen it when re-enabled. Adjusted before the DOM is patched, so no frame
	// shows both.
	$effect.pre(() => {
		if (isDisabled === wasDisabled) {
			return;
		}
		wasDisabled = isDisabled;
		if (isDisabled && isSheetOpen) {
			isSheetOpen = false;
			keepsSheetWhileDisabled = true;
		}
		if (!isDisabled) {
			keepsSheetWhileDisabled = false;
		}
	});

	// Focus that returns from the field's own sheet clears the presentation
	// latch above, so the sheet unmounts only after its exit has completed.

	const ariaDescribedBy = $derived(
		[
			description ? descriptionId : null,
			status?.message ? statusMessageId : null,
			showsDisabledMessage ? disabledMessageTooltip.describedBy : null
		]
			.filter(Boolean)
			.join(' ') || undefined
	);

	// Captures the `<input>` `BaseTypeahead` renders — the counterpart to
	// upstream's `ref={inputRef}`, travelling through the rest props the base
	// spreads onto it. A presentation swap that removes the focused control
	// hands focus here from the effect below, once the branch has patched.
	const captureInput = (el: Element): (() => void) => {
		inputEl = el as HTMLInputElement;
		return () => {
			inputEl = null;
		};
	};

	function attachInlineWrapper(el: HTMLElement): () => void {
		wrapperEl = el as HTMLDivElement;
		return () => {
			wrapperEl = null;
		};
	}

	function attachSheetField(el: HTMLDivElement): () => void {
		sheetFieldEl = el;
		return () => {
			sheetFieldEl = null;
		};
	}

	function attachSheetTrigger(el: HTMLButtonElement): () => void {
		sheetTriggerEl = el;
		return () => {
			sheetTriggerEl = null;
		};
	}

	// A presentation swap removes the focused control. The new presentation's
	// control takes the focus over once the DOM has settled, so focus never
	// lands on the page body. The pre-effect reads the branch that is about to
	// be removed — its nodes are still in the document there — because an
	// attachment cleanup can run after focus has already dropped to the body.
	// svelte-ignore state_referenced_locally
	let previousSheetPresentation = isSheetPresentation;
	// Set before the branch is patched, so a blur caused by the swap cannot
	// clear it. Consumed after the patch by the focus move below.
	let focusWasInRemovedBranch = false;
	$effect.pre(() => {
		const current = isSheetPresentation;
		if (current === previousSheetPresentation) {
			return;
		}
		const active = document.activeElement;
		const oldRoot = previousSheetPresentation ? sheetFieldEl : wrapperEl;
		focusWasInRemovedBranch =
			active != null && active !== document.body && oldRoot?.contains(active) === true;
	});
	$effect(() => {
		const current = isSheetPresentation;
		if (current === previousSheetPresentation) {
			return;
		}
		previousSheetPresentation = current;
		if (!focusWasInRemovedBranch) {
			return;
		}
		focusWasInRemovedBranch = false;
		const target = current ? sheetTriggerEl : inputEl;
		if (target == null) {
			return;
		}
		isHandingOffFocus = true;
		target.focus();
		isHandingOffFocus = false;
	});

	const hasClearButton = $derived(hasClear && value.length > 0 && !isDisabled);
	const hasStaticEndLane = $derived(Boolean(endContent || hasClearButton));
	// Wherever a search can run beside tokens: enabled and below maxEntries.
	const hasBusySlot = $derived(value.length > 0 && !isDisabled && !isAtMax);
	const showsEndLane = $derived(isLaneBusy || hasBusySlot || hasStaticEndLane);

	const inputXStyle = $derived([
		isAtMax || isTruncated
			? tokenizerInputAtMaxStyle
			: value.length > 0
				? tokenizerInputCompactStyle
				: undefined,
		// With tokens, wrapperWithTokens reserves the lane for every row. This
		// rule is only for an empty Tokenizer; it still resolves to zero until
		// the lane publishes a width.
		!(isAtMax || isTruncated || value.length > 0) && endLaneReserve
	]);

	// Self-authored position styles (`positioning="custom"` below): explicit
	// anchor() insets pin the expanded layer over the field itself. `left` is
	// physical, so this popover does not yet mirror in RTL — upstream's known
	// follow-up from #3389.
	const popoverOverrideStyle = 'top:anchor(top);left:anchor(start)';

	// `disabled` reflects as `data-disabled` (and as a bare state class) so a theme
	// can reach the state without duplicating the component's own conditionals.
	// One derived value, spread onto both render branches — upstream writes the
	// same `themeProps` call twice, once per branch.
	const theme = $derived(
		themeProps('tokenizer', {
			size,
			status: status?.type,
			disabled: isDisabled ? 'disabled' : null
		})
	);
	const wrapperAttrs = $derived(
		tokenizerWrapperAttrs(size, status?.type, value.length > 0, isTruncated, isDisabled)
	);
	const placeholderAttrs = $derived(
		tokenizerLayerPlaceholderAttrs(size, status?.type, value.length > 0, isTruncated, isDisabled)
	);
	const startIconAttrs = $derived(tokenizerStartIconAttrs(value.length > 0));
	const endSectionAttrs = $derived(tokenizerEndSectionAttrs(size));
	const overflowTextAttrs = tokenizerOverflowTextAttrs();
	const tokenAttrs = tokenizerTokenAttrs();
	const sheetFieldAttrs = $derived(
		tokenizerSheetFieldAttrs(size, status?.type, value.length > 0, isDisabled)
	);
	const sheetTriggerAttrs = $derived(tokenizerSheetTriggerAttrs(value.length > 0, endLaneReserve));
	const sheetPlaceholderAttrs = $derived(tokenizerSheetTriggerPlaceholderAttrs(isDisabled));
	const sheetTokenStyle = $derived(tokenizerSheetTokenStyle(isDisabled));
	// The sheet's trigger is a button, while the rest bag is typed for the
	// inline input (`BaseProps<HTMLDivElement>`); upstream casts it the same way.
	const sheetTriggerRest = $derived(rest as unknown as HTMLButtonAttributes);

	// The trigger's accessible description names the selected tokens: the
	// button's children are tokens whose own content assistive technology
	// leaves out of a button's name.
	const triggerTokensId = `${uid}-trigger-tokens`;
	const tokenElementId = (itemId: string): string =>
		`${triggerTokensId}-${encodeURIComponent(itemId)}`;
	const triggerDescribedBy = $derived(
		[
			ariaDescribedBy,
			value.length > 0 ? triggerTokensId : null,
			...value.map((item) => tokenElementId(item.id))
		]
			.filter(Boolean)
			.join(' ') || undefined
	);

	// A busy start is announced once, through the shared polite channel; the
	// settle re-arms it. The spinner itself stays decorative.
	let announcedLaneBusy = false;
	$effect(() => {
		if (!isLaneBusy) {
			announcedLaneBusy = false;
			return;
		}
		if (announcedLaneBusy) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			announcedLaneBusy = true;
			announce(t('@astryx.typeahead.loading'));
		});
		return () => cancelAnimationFrame(frame);
	});

	// Props that describe the inline combobox have no surface in the sheet
	// presentation. Say so once in development rather than dropping them
	// silently.
	const inertSheetProps = $derived(
		isSheetPresentation
			? (
					[
						['renderItem', renderItem],
						['hasClear', hasClear || undefined],
						['hasEntriesOnFocus', hasEntriesOnFocus || undefined],
						['menuWidth', menuWidth],
						['tokenOverflowBehavior', tokenOverflowBehavior],
						['hasAutoFocus', hasAutoFocus || undefined]
					] as const
				)
					.filter(([, entry]) => entry !== undefined && entry !== 'none')
					.map(([name]) => name)
			: []
	);
	const inertSheetPropsKey = $derived(inertSheetProps.join(','));
	$effect(() => {
		if (inertSheetPropsKey === '') {
			return;
		}
		warnOnce(
			`tokenizer:sheet-inert:${inertSheetPropsKey}`,
			'Tokenizer',
			`\`${inertSheetProps.join('`, `')}\` ${
				inertSheetProps.length === 1 ? 'has' : 'have'
			} no surface in the bottom-sheet presentation and ${
				inertSheetProps.length === 1 ? 'is' : 'are'
			} not rendered there. Pass \`presentation="popover"\` to keep the inline field on every device.`
		);
	});
</script>

{#snippet startIconSlot()}
	{#if typeof startIcon === 'string'}
		<Icon icon={startIcon} size="sm" color="secondary" />
	{:else if startIcon}
		{@render startIcon()}
	{/if}
{/snippet}

{#snippet tokenSlot(item: T)}
	{#if renderToken}
		<span class={tokenAttrs.class} style={tokenAttrs.style}>
			{@render renderToken(item, () => handleRemove(item))}
		</span>
	{:else}
		<Token
			label={item.label}
			{size}
			onRemove={isDisabled ? undefined : () => handleRemove(item)}
			{isDisabled}
			xstyle={tokenizerTokenStyle}
		/>
	{/if}
{/snippet}

{#snippet overflowIndicator(items: OverflowItem<T>[])}
	<span class={overflowTextAttrs.class} style={overflowTextAttrs.style}>
		+{items.length} more
	</span>
{/snippet}

{#snippet hiddenInputs()}
	{#if htmlName != null}
		<!--
			Keyed by position: upstream's `key={item.id}` tolerates a duplicate id
			(React warns), where Svelte throws.
		-->
		{#each value as item, hiddenIndex (hiddenIndex)}
			<!--
				Disabled native controls are excluded from form submission; mirror
				that for the hidden carriers.
			-->
			<input type="hidden" name={htmlName} value={item.id} disabled={isDisabled} />
		{/each}
	{/if}
{/snippet}

{#snippet wrapperContent()}
	<!--
		The wrapper is the click target and the dropdown anchor. It carries
		`role="group"` with the field's label, as upstream's does, and the click
		handler exists only to widen the hit area over the padding and the tokens.
	-->
	<div
		bind:this={wrapperEl}
		{@attach attachInlineWrapper}
		{@attach disabledMessageTooltip.attachTrigger}
		role="group"
		aria-label={label}
		onclick={handleWrapperClick}
		onfocusin={handleFocusCapture}
		onfocusout={handleBlurCapture}
		data-testid={testId}
		{...theme}
		class={cx(theme.class, wrapperAttrs.class)}
		style={wrapperAttrs.style}
	>
		{#if startIcon}
			<span class={startIconAttrs.class} style={startIconAttrs.style}>
				{@render startIconSlot()}
			</span>
		{/if}
		{#if isTruncated}
			<OverflowList
				gap={1}
				behavior="observeParent"
				items={value}
				item={tokenSlot}
				overflowRenderer={overflowIndicator}
			/>
		{:else}
			{#each value as item, tokenIndex (tokenIndex)}
				{@render tokenSlot(item)}
			{/each}
		{/if}
		<BaseTypeahead
			{@attach captureInput}
			searchSource={isAtMax ? emptySource : filteredSource}
			value={null}
			onChange={handleAdd}
			{renderItem}
			placeholder={value.length === 0 ? placeholder : ''}
			hasEntriesOnFocus={isAtMax ? false : hasEntriesOnFocus}
			{maxMenuItems}
			{menuWidth}
			{emptySearchResultsText}
			{isDisabled}
			isFocusableDisabled={showsDisabledMessage}
			{hasAutoFocus}
			{inputId}
			{ariaDescribedBy}
			{onChangeQuery}
			{debounceMs}
			onKeyDown={handleKeyDown}
			anchorEl={wrapperEl}
			{size}
			{inputXStyle}
		/>
		{@render hiddenInputs()}
		{#if showsEndLane}
			<div {@attach attachEndLane} class={endSectionAttrs.class} style={endSectionAttrs.style}>
				{#if isLaneBusy || hasBusySlot}
					<!--
						Named, never live: the tokenizer announces its search. The
						spinner stays mounted while idle, unrendered, not animating
						and out of the accessibility tree, so the lane keeps its
						measured width across a search.
					-->
					{#key isLaneBusy}
						<Spinner
							size="sm"
							role="img"
							aria-label={t('@astryx.typeahead.loading')}
							aria-hidden={isLaneBusy ? undefined : true}
							xstyle={isLaneBusy ? undefined : tokenizerIdleSpinnerStyle}
						/>
					{/key}
				{/if}
				{#if endContent}{@render endContent()}{/if}
				{#if hasClearButton}
					<InputClearButton
						label={t('@astryx.tokenizer.clearAll')}
						onclick={(e) => {
							e.stopPropagation();
							handleClearAll();
						}}
					/>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet sheetContent()}
	<!--
		The sheet presentation's field: the inline field's own control box. A
		button cannot contain controls, so the trigger, the tokens and the end
		lane are siblings in this box; `endContent` and a custom token can then
		hold their own controls.
	-->
	<div
		{@attach attachSheetField}
		{@attach disabledMessageTooltip.attachTrigger}
		onclick={handleSheetFieldClick}
		onfocusin={handleSheetFieldFocus}
		onfocusout={handleSheetFieldBlur}
		{...theme}
		class={cx(theme.class, sheetFieldAttrs.class)}
		style={sheetFieldAttrs.style}
	>
		{#if startIcon}
			<span class={startIconAttrs.class} style={startIconAttrs.style}>
				{@render startIconSlot()}
			</span>
		{/if}
		<button
			{...sheetTriggerRest}
			{@attach attachSheetTrigger}
			type="button"
			id={inputId}
			aria-haspopup="dialog"
			aria-expanded={isSheetOpen}
			aria-disabled={isDisabled || undefined}
			aria-describedby={triggerDescribedBy}
			data-testid={testId}
			onclick={handleSheetTriggerClick}
			class={sheetTriggerAttrs.class}
			style={sheetTriggerAttrs.style}
		>
			{#if value.length === 0}
				<span class={sheetPlaceholderAttrs.class} style={sheetPlaceholderAttrs.style}>
					{placeholder ?? ''}
				</span>
			{/if}
		</button>
		{#each value as item (item.id)}
			{#if renderToken}
				<span class={tokenAttrs.class} style={tokenAttrs.style}>
					{@render renderToken(item, () => handleSheetTokenRemove(item))}
				</span>
			{:else}
				<Token label={item.label} {size} {isDisabled} xstyle={sheetTokenStyle} />
			{/if}
		{/each}
		{#if endContent}
			<div
				bind:this={sheetLaneEl}
				{@attach attachEndLane}
				class={endSectionAttrs.class}
				style={endSectionAttrs.style}
			>
				{@render endContent()}
			</div>
		{/if}
	</div>
	{#if value.length > 0}
		<VisuallyHidden id={triggerTokensId}>
			{t('@astryx.tokenizer.selectedCount', { count: value.length })}
		</VisuallyHidden>
	{/if}
	<!--
		The trigger's description names each token by id. A default Token drops
		its `id` in this port, so every item gets a hidden label copy rather than
		only a custom one; the referenced id then always resolves.
	-->
	{#each value as item (item.id)}
		<span id={tokenElementId(item.id)} hidden>{item.label}</span>
	{/each}
	{@render hiddenInputs()}
	<!--
		Mounted from the press until the sheet's exit has completed and focus is
		back on the trigger: at rest the field renders its trigger alone.
	-->
	{#if (isSheetOpen || isSheetPresented) && (!isDisabled || keepsSheetWhileDisabled)}
		<TokenizerBottomSheet
			isOpen={isSheetOpen}
			onOpenChange={(open) => {
				isSheetOpen = open;
			}}
			initialQuery={sheetInitialQuery}
			{label}
			{searchSource}
			{value}
			{maxEntries}
			{hasCreate}
			maxMenuItems={maxMenuItems ?? 10}
			{minQueryLength}
			debounceMs={debounceMs ?? 150}
			emptySearchText={emptySearchResultsText}
			onCommit={handleSheetCommit}
			onChangeQuery={handleSheetQueryChange}
		/>
	{/if}
{/snippet}

{#snippet tokenizerContent()}
	{#if isSheetPresentation}
		{@render sheetContent()}
	{:else if isLayerMode}
		<div
			{@attach attachPlaceholder}
			onclick={handleWrapperClick}
			{...theme}
			class={cx(theme.class, placeholderAttrs.class)}
			style={placeholderAttrs.style}
		>
			{#if isTruncated}
				{#if startIcon}{@render startIconSlot()}{/if}
				<OverflowList
					gap={1}
					behavior="observeParent"
					items={value}
					item={tokenSlot}
					overflowRenderer={overflowIndicator}
				/>
			{/if}
		</div>
		<Layer
			{layer}
			positioning="custom"
			xstyle={tokenizerLayerPopoverStyle}
			style={popoverOverrideStyle}
		>
			<div bind:this={layerContentEl} onfocusin={handleFocusCapture} onfocusout={handleBlurCapture}>
				{@render wrapperContent()}
			</div>
		</Layer>
	{:else}
		{@render wrapperContent()}
	{/if}
{/snippet}

<Field
	{...isSheetPresentation ? {} : rest}
	onclick={isSheetPresentation ? undefined : callerOnClick}
	{label}
	{isLabelHidden}
	{description}
	inputID={inputId}
	descriptionID={description ? descriptionId : undefined}
	{isOptional}
	{isRequired}
	{isDisabled}
	status={status
		? {
				type: status.type,
				message: status.message,
				messageID: status.message ? statusMessageId : undefined
			}
		: undefined}
	{statusVariant}
	{labelTooltip}
	{width}
	{xstyle}
	class={className}
	style={styleProp}
>
	{@render tokenizerContent()}
	{#if showsDisabledMessage && disabledMessage}
		<TooltipLayer tooltip={disabledMessageTooltip}>{disabledMessage}</TooltipLayer>
	{/if}
</Field>
