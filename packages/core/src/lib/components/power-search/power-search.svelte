<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { IconName } from '../icon/icon-registry.js';
	import type { InputStatus } from '../field/types.js';
	import type { FieldStatusVariant } from '../field-status/field-status.stylex.js';
	import type { TokenizerOverflowBehavior } from '../tokenizer/tokenizer.svelte';
	import type {
		PartialFilter,
		PowerSearchChangeType,
		PowerSearchComponents,
		PowerSearchConfig,
		PowerSearchFilter
	} from './types.js';

	export type PowerSearchSize = 'sm' | 'md' | 'lg';

	/** How PowerSearch presents filter editing; see {@link PowerSearchProps.presentation}. */
	export type PowerSearchPresentation = 'popover' | 'bottom-sheet' | 'adaptive';

	export interface PowerSearchProps extends Omit<BaseProps<HTMLElement>, 'onChange'> {
		/** PowerSearch configuration defining available fields and operators. */
		config: PowerSearchConfig;
		/** Currently active filters. */
		filters: ReadonlyArray<PowerSearchFilter>;
		/** Called when filters change. */
		onChange: (
			filters: ReadonlyArray<PowerSearchFilter>,
			changeType: PowerSearchChangeType,
			index: number
		) => void;
		/** Accessible label. @default 'Search' */
		label?: string;
		/** Visually hide the label. @default true */
		isLabelHidden?: boolean;
		/** Placeholder text. @default 'Search…' */
		placeholder?: string;
		/** Auto-focus on mount. @default false */
		hasAutoFocus?: boolean;
		/** Show clear button. @default true */
		hasClear?: boolean;
		/** Whether the input is read-only. @default false */
		isReadOnly?: boolean;
		/** Whether the input is disabled. @default false */
		isDisabled?: boolean;
		/**
		 * Explains why the search is disabled. When set together with `isDisabled`,
		 * the search shows a tooltip with this text on hover and keyboard focus, and
		 * the input stays focusable (via `aria-disabled`) so the reason is
		 * discoverable by keyboard and assistive technology. Input stays blocked.
		 *
		 * Use this instead of wrapping a disabled PowerSearch in `Tooltip` — disabled
		 * controls don't emit the pointer events an external tooltip needs.
		 */
		disabledMessage?: string;
		/** Icon to display at the start of the input. */
		startIcon?: IconName | Snippet;
		/** Fires when focus enters the search input from outside. */
		onFocus?: (e: FocusEvent) => void;
		/** Fires when focus leaves the search input entirely. */
		onBlur?: (e: FocusEvent) => void;
		/** Validation status. */
		status?: InputStatus;
		/**
		 * How the status message is placed relative to the input.
		 * - `attached`: message overlaps directly below the input (bordered treatment)
		 * - `detached`: message floats below as a separate element with spacing
		 * @default 'attached'
		 */
		statusVariant?: FieldStatusVariant;
		/** Max width for dropdown menu. */
		menuWidth?: number;
		/** Max display length for filter token values. @default 40 */
		maxTokenLength?: number;
		/** Max suggestions in string and entity value typeaheads. @default 10 */
		maxOperatorMenuItems?: number;
		/**
		 * Max ranked results shown for a non-empty query. This does not affect the
		 * value editor shown after selecting a field. Browsing the field list with
		 * an empty query shows up to 1,000 fields. @default 10
		 */
		maxSearchResults?: number;
		/** Label for the save button in edit popover. @default 'Apply' */
		popoverSaveButtonLabel?: string;
		/** Timezone ID for date formatting. */
		timezoneID?: string;
		/**
		 * Controls how tokens overflow when the container is too narrow.
		 * Forwarded to Tokenizer.
		 * @default 'none'
		 */
		tokenOverflowBehavior?: TokenizerOverflowBehavior;
		/**
		 * Content to display at the end of the input row.
		 * Useful for action buttons or other controls.
		 */
		endContent?: Snippet;
		/**
		 * Number of results matching the current filters.
		 * When a number, formatted as "N results". When a string, displayed as-is.
		 */
		resultCount?: number | string;
		/**
		 * Size of the search input.
		 * @default 'md'
		 */
		size?: PowerSearchSize;
		/**
		 * Per-type component overrides for token and editor rendering.
		 * Keys are operator value types (e.g. 'string', 'enum', 'date_absolute').
		 */
		components?: PowerSearchComponents;
		/**
		 * How the field presents filter editing.
		 * - `'popover'`: the tokenizer field with its typeahead and the editor
		 *   popover, on every device.
		 * - `'bottom-sheet'`: the whole field is one trigger showing display-only
		 *   filter tokens; it opens a stack of sheets. Filters lists the filters
		 *   as rows that edit or remove one, with Add filter, Done, and Clear
		 *   all, which asks first and keeps read-only filters. Add filter opens
		 *   above it with the fields (or the content search with inline
		 *   suggestions), and a value step opens above that, stages operator →
		 *   value, and confirms from its footer. Dismissing a step reveals the
		 *   one beneath. The flow edits a draft: `onChange` is called when Done
		 *   applies it, once per edit in order, and a dismissal with a changed
		 *   draft asks before discarding it. Suited to compact touch screens,
		 *   where the editor popover competes with the software keyboard.
		 * - `'adaptive'`: the bottom sheet on compact coarse-pointer screens,
		 *   otherwise the popover — the same resolution Selector uses.
		 *
		 * In the sheet presentation `menuWidth` and `tokenOverflowBehavior` have
		 * no surface to act on and warn in development. Pass `'popover'` to keep
		 * the tokenizer field and the editor popover on every device.
		 * @default 'adaptive'
		 */
		presentation?: PowerSearchPresentation;
	}

	// =============================================================================
	// State
	// =============================================================================

	type PopoverState =
		| { type: 'idle' }
		| {
				type: 'adding';
				partialFilter: PartialFilter;
		  }
		| {
				type: 'editing';
				filterIndex: number;
				partialFilter: PartialFilter;
		  };

	// =============================================================================
	// Icon mapping for typeahead entries
	// =============================================================================

	// Ranked suggestions shown for a non-empty query. The field list itself is
	// never capped -- see the maxSearchResults prop.
	const DEFAULT_MAX_SEARCH_RESULTS = 10;

	// Empty-query browsing gets a high safety ceiling, matching XDS. This shows
	// every practical field list without allowing an accidental unbounded DOM.
	const MAX_BROWSE_MENU_ITEMS = 1000;

	const OPERATOR_VALUE_TYPE_TO_ICON: Record<string, IconName> = {
		string: 'search',
		string_list: 'search',
		integer: 'search',
		float: 'search',
		date_absolute: 'calendar',
		date_range: 'calendar',
		date_relative: 'calendar',
		time: 'clock',
		enum: 'menu',
		enum_list: 'menu',
		entity_list: 'search',
		custom: 'search',
		empty: 'search',
		nested: 'search'
	};
</script>

<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import Avatar from '../avatar/avatar.svelte';
	import Field from '../field/field.svelte';
	import Icon from '../icon/icon.svelte';
	import PopoverLayer from '../popover/popover-layer.svelte';
	import Token from '../token/token.svelte';
	import Tokenizer from '../tokenizer/tokenizer.svelte';
	import TooltipLayer from '../tooltip/tooltip-layer.svelte';
	import TypeaheadItem from '../typeahead/typeahead-item.svelte';
	import { layerAnimations } from '../layer/layer-animations.stylex.js';
	import { usePopover } from '../popover/use-popover.svelte.js';
	import { useTooltip } from '../tooltip/use-tooltip.svelte.js';
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
	import { useSize } from '../../internal/contexts.svelte.js';
	import { useThemeContext } from '../../theme/theme-context.js';
	import { useLocale } from '../../i18n/use-locale.svelte.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useCalendarSystem } from '../../i18n/use-calendar-system.svelte.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { isFocusDetached } from '../../utils/focus-return.js';
	import { formatFilterValue } from './format-filter-value.js';
	import PowerSearchBottomSheet from './power-search-bottom-sheet.svelte';
	import PowerSearchEditPopover from './power-search-edit-popover.svelte';
	import PowerSearchTokenValue from './power-search-token-value.svelte';
	import {
		popoverLayerStyles,
		powerSearchPopoverOffset,
		powerSearchResultCountAttrs,
		powerSearchSheetContentAttrs,
		powerSearchSheetEndSectionAttrs,
		powerSearchSheetPlaceholderAttrs,
		powerSearchSheetStartIconAttrs,
		powerSearchSheetTriggerAttrs,
		powerSearchSheetTriggerWrapperAttrs
	} from './power-search.stylex.js';
	import { resolveOperatorLabel } from './resolve-operator-label.js';
	import type { PowerSearchAuxData, PowerSearchItem } from './types.js';
	import { useInternalConfig } from './use-internal-config.svelte.js';
	import { usePowerSearchSource } from './use-power-search-source.svelte.js';

	/**
	 * Structured filter bar where each token represents a filter (field + operator
	 * + value), ported from Astryx's `PowerSearch.tsx`.
	 *
	 * Users select a field from a typeahead dropdown, then configure the operator
	 * and value in an edit popover. Filters appear as tokens that can be clicked
	 * to edit or removed individually.
	 *
	 * @example
	 * ```svelte
	 * <script>
	 *   const config = {
	 *     name: 'MySearch',
	 *     fields: [
	 *       {
	 *         key: 'status',
	 *         label: 'Status',
	 *         operators: [
	 *           {
	 *             key: 'is',
	 *             label: 'is',
	 *             value: {
	 *               type: 'enum',
	 *               values: [
	 *                 { value: 'open', label: 'Open' },
	 *                 { value: 'closed', label: 'Closed' }
	 *               ]
	 *             }
	 *           }
	 *         ]
	 *       }
	 *     ]
	 *   };
	 *   let filters = $state([]);
	 * <\/script>
	 * <PowerSearch {config} {filters} onChange={(next) => (filters = next)} />
	 * ```
	 *
	 * Use `contentSearchFieldKey` to designate a field for free-text search. When
	 * set, unstructured text input is routed to that field.
	 *
	 * ## What changed from React
	 *
	 * - **`handleRef` + `useImperativeHandle` become instance exports.** Reach
	 *   `focusTypeahead()`/`blurTypeahead()` through `bind:this`, the shape
	 *   `Tokenizer`, `SideNav` and `Calendar` already use. `ref` is omitted, as
	 *   this port omits every `ref` prop.
	 * - **`popover.render(content, {…})` becomes `<PopoverLayer>`**, the
	 *   `useLayer`→`<Layer>` split the whole port uses. `usePopover` needs an `id`
	 *   here where upstream mints one inside `useLayer`, so it takes `$props.id()`.
	 * - **`key={popoverKey}` becomes `{#key popoverKey}`.** It is the *only*
	 *   mechanism resetting `PowerSearchEditPopover`'s seeded state between one
	 *   token and the next, and two upstream test cases exist to pin it —
	 *   including the same-index/different-filter variant an index-only key would
	 *   miss.
	 * - **`renderToken`/`renderItem` are snippets**, declared in this component so
	 *   they close over `filters`, `config` and the handlers exactly as upstream's
	 *   `useCallback`s do. No binder is needed: `Tokenizer` types them as
	 *   parameterised snippets already.
	 * - **The first-run latch survives.** Upstream's `hasMountedRef` stops the
	 *   result count present at mount from being announced unprompted; a `$effect`
	 *   fires on mount too, so the latch is load-bearing here as well.
	 *
	 * ## The three menu-sizing props
	 *
	 * `menuWidth`, `maxOperatorMenuItems` and `maxSearchResults` were declared and
	 * read by nothing until 0.5.0 — upstream published all three and destructured
	 * none. 0.5.0 wired them: `menuWidth` reaches the field dropdown through
	 * `Tokenizer`, `maxOperatorMenuItems` reaches the *value* typeaheads inside
	 * the edit popover (its name predates what it now does), and `maxSearchResults`
	 * caps ranked results inside `usePowerSearchSource`. The field list itself is
	 * never capped by `maxSearchResults`; empty-query browsing takes the separate
	 * `MAX_BROWSE_MENU_ITEMS` ceiling above.
	 */

	const {
		config: configProp,
		filters,
		onChange,
		label: labelFromProps,
		isLabelHidden = true,
		placeholder: placeholderFromProps,
		hasAutoFocus = false,
		hasClear = true,
		isReadOnly = false,
		isDisabled = false,
		disabledMessage,
		startIcon,
		onFocus,
		onBlur,
		status,
		statusVariant = 'attached',
		menuWidth,
		maxTokenLength = 40,
		maxOperatorMenuItems,
		maxSearchResults = DEFAULT_MAX_SEARCH_RESULTS,
		popoverSaveButtonLabel: popoverSaveButtonLabelFromProps,
		timezoneID,
		tokenOverflowBehavior,
		endContent,
		resultCount,
		size: sizeProp,
		'data-testid': testId,
		xstyle,
		class: className,
		style: styleProp,
		components: componentOverrides,
		presentation = 'adaptive'
	}: PowerSearchProps = $props();

	const resolveSize = useSize();
	const size = $derived(resolveSize(sizeProp, 'md'));
	const config = useInternalConfig(() => configProp);
	const searchSource = usePowerSearchSource(
		() => config,
		() => maxSearchResults
	);
	const t = useTranslator();
	const locale = useLocale();
	const calendar = useCalendarSystem(undefined, 'PowerSearch');
	const label = $derived(labelFromProps ?? t('@astryx.powersearch.label'));
	const placeholder = $derived(placeholderFromProps ?? t('@astryx.powersearch.placeholder'));
	const popoverSaveButtonLabel = $derived(
		popoverSaveButtonLabelFromProps ?? t('@astryx.powersearch.editor.apply')
	);

	// ------------------------------------------------------- presentation --

	// The sheet needs both a compact viewport and a coarse primary pointer:
	// tablets and large touch displays stay anchored, phones in either
	// orientation get the sheet. Compact is the active theme's definition, so a
	// theme that moves `md` is honored. Upstream keeps this policy in
	// `useAdaptivePresentation`; this port has no such hook, and the minimal
	// wiring the one consumer needs lives here rather than as a duplicate
	// general-purpose hook.
	const COMPACT_HEIGHT_BELOW = 500;
	const DEFAULT_MD = 768;
	const themeContext = useThemeContext();
	const isAdaptive = $derived(presentation === 'adaptive');
	let isCompactTouch = $state(false);

	$effect(() => {
		if (!isAdaptive) {
			isCompactTouch = false;
			return;
		}
		const points = themeContext?.().theme.adaptations?.widthBreakpoints;
		const md = points?.md ?? DEFAULT_MD;
		const query = `(width < ${md}px) and (pointer: coarse), (height < ${COMPACT_HEIGHT_BELOW}px) and (pointer: coarse)`;
		const view = typeof window === 'undefined' ? null : window;
		if (view == null || typeof view.matchMedia !== 'function') {
			isCompactTouch = false;
			return;
		}
		const list = view.matchMedia(query);
		isCompactTouch = list.matches;
		const onChange = (): void => {
			isCompactTouch = list.matches;
		};
		if (typeof list.addEventListener === 'function') {
			list.addEventListener('change', onChange);
			return () => list.removeEventListener('change', onChange);
		}
		list.addListener(onChange);
		return () => list.removeListener(onChange);
	});

	const resolvedPresentation = $derived(
		isAdaptive ? (isCompactTouch ? 'bottom-sheet' : 'popover') : presentation
	);

	const uid = $props.id();
	const popoverID = `${uid}-popover`;

	let isSheetOpen = $state(false);
	// Latched for the flow's lifetime: the flow stays presented after it closes
	// until the sheets have run their exit and handed focus back to the trigger.
	// Without the latch, `adaptive` resolving to `popover` mid-session would
	// unmount the sheets and the trigger they return focus to in the same
	// render, dropping focus to the page body.
	let isSheetPresented = $state(false);
	const isSheetPresentation = $derived(
		isSheetOpen || isSheetPresented || resolvedPresentation === 'bottom-sheet'
	);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let endLaneEl = $state<HTMLDivElement | null>(null);

	// `hasAutoFocus` applies only to the control the field first mounts. A
	// presentation swap remounts the control, and focusing the new one would
	// pull focus from wherever on the page it was.
	// svelte-ignore state_referenced_locally
	let autoFocusState = $state({
		presentation: isSheetPresentation,
		isFirstControl: true
	});
	$effect(() => {
		const now = isSheetPresentation;
		if (autoFocusState.presentation !== now) {
			autoFocusState = { presentation: now, isFirstControl: false };
		}
	});
	const autoFocusOnMount = $derived(
		hasAutoFocus &&
			autoFocusState.isFirstControl &&
			autoFocusState.presentation === isSheetPresentation
	);

	let isSwapFocus = false;
	function focusAfterSwap(control: { focus(): void } | null | undefined): void {
		if (control == null) {
			return;
		}
		isSwapFocus = true;
		try {
			control.focus();
		} finally {
			isSwapFocus = false;
		}
	}
	function handleFieldFocus(event: FocusEvent): void {
		if (!isSwapFocus) {
			onFocus?.(event);
		}
	}
	function handleFieldBlur(event: FocusEvent): void {
		onBlur?.(event);
	}

	// A presentation swap removes the focused control, so the other
	// presentation's primary control takes focus and focus never falls to the
	// page body. The detaching root notes that it held focus; the attaching
	// root gives focus to its primary control when focus has fallen away.
	let isFocusPendingHandOff = false;
	const attachSheetRoot: Attachment<HTMLDivElement> = (node) => {
		if (isFocusPendingHandOff && isFocusDetached(document)) {
			focusAfterSwap(triggerEl);
		}
		isFocusPendingHandOff = false;
		return () => {
			if (node.contains(document.activeElement) || popoverState.type !== 'idle') {
				isFocusPendingHandOff = true;
			}
		};
	};
	const attachPopoverRoot: Attachment<HTMLDivElement> = (node) => {
		const detachPopover = (popover.attachTrigger as (element: HTMLElement) => void | (() => void))(
			node
		);
		if (isFocusPendingHandOff && isFocusDetached(document)) {
			focusAfterSwap(tokenizer);
		}
		isFocusPendingHandOff = false;
		return () => {
			detachPopover?.();
			if (node.contains(document.activeElement) || popoverState.type !== 'idle') {
				isFocusPendingHandOff = true;
			}
		};
	};

	const showsDisabledMessage = $derived(isDisabled && !!disabledMessage);
	const disabledMessageTooltip = useTooltip(() => ({
		id: `${uid}-disabled-tooltip`,
		placement: 'above' as const,
		focusTrigger: 'always' as const,
		isEnabled: isSheetPresentation && showsDisabledMessage
	}));
	const triggerId = `${uid}-trigger`;
	const triggerLabelId = `${uid}-label`;
	const triggerContentId = `${uid}-content`;
	const statusMessageId = `${uid}-status`;
	const triggerDescribedBy = $derived(
		[
			status?.message ? statusMessageId : null,
			showsDisabledMessage ? disabledMessageTooltip.describedBy : null
		]
			.filter(Boolean)
			.join(' ') || undefined
	);

	function openSheet(): void {
		if (isDisabled) {
			return;
		}
		triggerEl?.focus({ preventScroll: true });
		isSheetPresented = true;
		isSheetOpen = true;
	}

	function handleTriggerWrapperClick(event: MouseEvent): void {
		const target = event.target;
		if (target instanceof Node && (triggerEl?.contains(target) || endLaneEl?.contains(target))) {
			return;
		}
		openSheet();
	}

	function handleTriggerFocusWithin(event: FocusEvent): void {
		if (!isSheetOpen && isSheetPresented) {
			isSheetPresented = false;
			const count = afterCloseResultCount;
			afterCloseResultCount = null;
			if (count != null) {
				announce(count);
			}
		}
		const related = event.relatedTarget;
		if (
			!(related instanceof Node) ||
			!event.currentTarget ||
			!(event.currentTarget as HTMLElement).contains(related)
		) {
			handleFieldFocus(event);
		}
	}

	function handleTriggerBlurWithin(event: FocusEvent): void {
		const related = event.relatedTarget;
		if (
			!(related instanceof Node) ||
			!event.currentTarget ||
			!(event.currentTarget as HTMLElement).contains(related)
		) {
			handleFieldBlur(event);
		}
	}

	useDevWarning(
		'PowerSearch',
		'`menuWidth` has no surface in the bottom-sheet presentation: the sheet flow has no typeahead popover to size. Pass `presentation="popover"` to keep the popover on every device, or leave it out.',
		() => isSheetPresentation && menuWidth != null
	);
	useDevWarning(
		'PowerSearch',
		'`tokenOverflowBehavior` has no surface in the bottom-sheet presentation: the trigger wraps its display-only tokens. Pass `presentation="popover"` to keep the tokenizer field on every device, or leave it out.',
		() => isSheetPresentation && tokenOverflowBehavior != null
	);

	// A result count that changed during the flow's exit is spoken once the
	// flow has fully closed and focus is back on the trigger.
	let afterCloseResultCount: string | null = null;

	let tokenizer = $state<Tokenizer<PowerSearchItem> | null>(null);

	let popoverState = $state<PopoverState>({ type: 'idle' });

	// Layer for positioning the edit popover anchored to the tokenizer
	function handleLayerHide(): void {
		popoverState = { type: 'idle' };
	}

	const popover = usePopover(() => ({
		id: popoverID,
		onHide: handleLayerHide,
		hasLightDismiss: true,
		hasCloseButton: false,
		hasAutoFocus: false,
		// The popup's own listbox/menu content is the exposed semantics; focus
		// stays on the tokenizer input, so a modal dialog wrapper is incorrect.
		role: 'none'
	}));

	/**
	 * Wrapper that manages layer visibility and tokenizer focus alongside state.
	 *
	 * The animation frame is upstream's and stays, but not for the reason it first
	 * looks like. The synchronous `focus()` it appears to be racing —
	 * `base-typeahead.svelte`'s call right after `onChange` returns — happens in
	 * the same task, so a `tick()` microtask would land after it too. What the
	 * frame actually buys is **ordering against the child**: this callback is
	 * registered synchronously, before `PowerSearchEditPopover` exists, while the
	 * popover's own autofocus frame is registered later, during the flush that
	 * mounts it. Same-frame callbacks run in registration order, so `show()` and
	 * the tokenizer `blur()` always precede the value editor taking focus. A
	 * `tick()` rewrite would have to re-derive that.
	 *
	 * Both calls are unmount-safe: `tokenizer` is a `bind:this` target that Svelte
	 * nulls on destroy, and `layer.show()` is guarded by its own `popover` handle,
	 * which teardown clears. The frame is deliberately not cancelled, as
	 * upstream's is not.
	 */
	function setPopoverState(state: PopoverState): void {
		popoverState = state;
		if (state.type !== 'idle') {
			requestAnimationFrame(() => {
				popover.show();
				tokenizer?.blur();
			});
		} else {
			popover.hide();
			tokenizer?.focus();
		}
	}

	// When `adaptive` flips to the sheet while the editor popover is open, the
	// editing ends with the popover: its state returns to idle in the render that
	// sees the swap, so a later switch back does not reopen a stale editor.
	$effect(() => {
		if (isSheetPresentation && popoverState.type !== 'idle') {
			popoverState = { type: 'idle' };
			popover.hide();
		}
	});

	// A field that becomes disabled cannot keep its flow open, and must not
	// reopen it when re-enabled.
	// svelte-ignore state_referenced_locally
	let wasDisabled = isDisabled;
	$effect(() => {
		if (isDisabled !== wasDisabled) {
			wasDisabled = isDisabled;
			if (isDisabled && isSheetOpen) {
				isSheetOpen = false;
			}
		}
	});

	/** Upstream's `useImperativeHandle(handleRef, …)` — reach it via `bind:this`. */
	export function focusTypeahead(): void {
		if (isSheetPresentation) {
			triggerEl?.focus();
		} else {
			tokenizer?.focus();
		}
	}

	/** Upstream's `useImperativeHandle(handleRef, …)` — reach it via `bind:this`. */
	export function blurTypeahead(): void {
		if (isSheetPresentation) {
			triggerEl?.blur();
		} else {
			tokenizer?.blur();
		}
	}

	// Convert filters to tokenizer items
	const tokenizerValue = $derived.by<PowerSearchItem[]>(() =>
		filters.map((filter, index) => {
			const field = config.getField(filter.field);
			const operator = config.getOperator(filter.field, filter.operator);
			const resolvedOp = operator ? resolveOperatorLabel(operator, t) : '';
			const operatorLabel = resolvedOp ? `: ${resolvedOp}` : '';
			const valueStr = operator
				? formatFilterValue(
						config,
						operator.value,
						filter.value,
						maxTokenLength,
						t,
						locale(),
						timezoneID,
						calendar()
					)
				: '';

			const displayLabel = valueStr
				? `${field?.label ?? filter.field}${operatorLabel} ${valueStr}`
				: `${field?.label ?? filter.field}${operatorLabel}`;

			return {
				id: `filter-${index}-${filter.field}-${filter.operator}`,
				label: displayLabel,
				auxiliaryData: {
					fieldKey: filter.field,
					operatorKey: filter.operator,
					filterValue: filter.value,
					filterIndex: index
				}
			};
		})
	);

	// Handle tokenizer onChange (field selected from typeahead)
	function handleTokenizerChange(
		_items: PowerSearchItem[],
		change: { item?: PowerSearchItem; type: string }
	): void {
		if (change.type === 'add' && change.item) {
			const auxData = change.item.auxiliaryData as PowerSearchAuxData | undefined;
			if (!auxData) {
				return;
			}

			const field = config.getField(auxData.fieldKey);
			if (!field) {
				return;
			}

			const operator = auxData.operatorKey
				? config.getOperator(auxData.fieldKey, auxData.operatorKey)
				: config.getDefaultOperator(auxData.fieldKey);

			// If the item already has a filter value (e.g. content search), add immediately
			if (auxData.filterValue && operator) {
				const newFilter: PowerSearchFilter = {
					field: auxData.fieldKey,
					operator: operator.key,
					value: auxData.filterValue
				};
				onChange([...filters, newFilter], 'add', filters.length);
				return;
			}

			// For "empty" type operators, add the filter immediately
			if (operator?.value.type === 'empty') {
				const newFilter: PowerSearchFilter = {
					field: auxData.fieldKey,
					operator: operator.key,
					value: { type: 'empty' }
				};
				onChange([...filters, newFilter], 'add', filters.length);
				return;
			}

			// Open the edit popover for the new filter
			setPopoverState({
				type: 'adding',
				partialFilter: {
					field: auxData.fieldKey,
					operator: operator?.key,
					value: undefined
				}
			});
		} else if (change.type === 'remove' && change.item) {
			const auxData = change.item.auxiliaryData as PowerSearchAuxData | undefined;
			if (auxData?.filterIndex != null) {
				const removedIndex = auxData.filterIndex;
				const newFilters = filters.filter((_, i) => i !== removedIndex);
				onChange(newFilters, 'remove', removedIndex);
			}
		}
	}

	// Handle clicking a token to edit
	function handleTokenClick(index: number): void {
		if (isReadOnly || isDisabled) {
			return;
		}

		const filter = filters[index];
		if (filter.isReadOnly) {
			return;
		}

		setPopoverState({
			type: 'editing',
			filterIndex: index,
			partialFilter: {
				field: filter.field,
				operator: filter.operator,
				value: filter.value
			}
		});
	}

	// Handle popover save
	function handlePopoverSave(savedFilter: PowerSearchFilter | null): void {
		if (popoverState.type === 'adding') {
			if (savedFilter) {
				onChange([...filters, savedFilter], 'add', filters.length);
			}
		} else if (popoverState.type === 'editing') {
			if (savedFilter) {
				const newFilters = [...filters];
				newFilters[popoverState.filterIndex] = savedFilter;
				onChange(newFilters, 'edit', popoverState.filterIndex);
			} else {
				// Delete
				const removedIndex = popoverState.filterIndex;
				const newFilters = filters.filter((_, i) => i !== removedIndex);
				onChange(newFilters, 'remove', removedIndex);
			}
		}
		setPopoverState({ type: 'idle' });
	}

	// Handle popover cancel
	function handlePopoverCancel(): void {
		setPopoverState({ type: 'idle' });
	}

	// The partial filter for the popover
	const popoverPartialFilter = $derived(
		popoverState.type !== 'idle' ? popoverState.partialFilter : null
	);

	// Resolve custom Editor override for the current popover filter
	const EditorOverride = $derived.by(() => {
		if (!popoverPartialFilter?.field || !popoverPartialFilter?.operator) {
			return undefined;
		}
		const op = config.getOperator(popoverPartialFilter.field, popoverPartialFilter.operator);
		return op ? componentOverrides?.[op.value.type]?.Editor : undefined;
	});

	const popoverMode = $derived<'create' | 'edit'>(
		popoverState.type === 'editing' ? 'edit' : 'create'
	);

	const popoverKey = $derived(
		popoverState.type === 'editing'
			? `edit-${popoverState.filterIndex}-${popoverState.partialFilter.field}`
			: popoverState.type === 'adding'
				? `add-${popoverState.partialFilter.field}`
				: ''
	);

	// Plain-text form of the result count, shared by the visible label and the
	// screen-reader announcement so the two never drift. The ICU plural handles
	// the number formatting + `result` vs `results` in one message so translators
	// can match the locale's plural rules.
	const resultCountText = $derived.by<string | null>(() => {
		if (resultCount == null) {
			return null;
		}
		if (typeof resultCount === 'number') {
			return t('@astryx.powersearch.resultCount', { count: resultCount });
		}
		return resultCount;
	});

	// Announce result-count changes to screen readers through a polite live
	// region, mirroring the way Typeahead announces its dropdown result count.
	// Only a change after mount is spoken — the count present on mount is not
	// announced unprompted. While a sheet of the flow is open the sheet announces
	// the count from its own body, so this effect stays quiet; a change that
	// lands during the flow's exit waits for the trigger focus.
	const announce = useAnnounce();
	const isSheetExiting = $derived(isSheetPresented && !isSheetOpen);
	// svelte-ignore state_referenced_locally
	let announcedResultCount: string | null = resultCountText;
	$effect(() => {
		const text = resultCountText;
		if (text === announcedResultCount) {
			return;
		}
		announcedResultCount = text;
		if (text != null) {
			if (isSheetExiting) {
				afterCloseResultCount = text;
			} else if (!isSheetOpen) {
				announce(text);
			}
		}
	});
</script>

{#snippet renderFilterToken(item: PowerSearchItem, onRemove?: () => void)}
	{@const auxData = item.auxiliaryData}
	{@const filterIndex = auxData?.filterIndex ?? -1}
	{@const filter = filterIndex >= 0 ? filters[filterIndex] : undefined}
	{@const field = auxData ? config.getField(auxData.fieldKey) : undefined}
	{@const operator = auxData?.operatorKey
		? config.getOperator(auxData.fieldKey, auxData.operatorKey)
		: undefined}
	{@const canInteract = onRemove != null && !isReadOnly && !isDisabled && !filter?.isReadOnly}
	{@const handleClick = canInteract ? () => handleTokenClick(filterIndex) : undefined}
	{@const handleRemove = canInteract ? onRemove : undefined}
	{@const TokenOverride = operator ? componentOverrides?.[operator.value.type]?.Token : undefined}

	{#if TokenOverride && filter && field && operator}
		<TokenOverride
			config={configProp}
			{filter}
			{field}
			{operator}
			maxLength={maxTokenLength}
			onClick={handleClick}
			onRemove={handleRemove}
			{isDisabled}
		/>
	{:else}
		{@const fieldLabel = field?.label ?? ''}
		{@const operatorLabel = operator ? resolveOperatorLabel(operator, t) : ''}
		{@const tokenLabel = `${fieldLabel}: ${operatorLabel}`.trim()}
		{@const adjustedMaxLength = Math.max(
			maxTokenLength - fieldLabel.length - operatorLabel.length,
			10
		)}
		{@const entity =
			filter?.value.type === 'entity_list' &&
			filter.value.value.length === 1 &&
			filter.value.value[0].photo
				? filter.value.value[0]
				: undefined}

		{#snippet valueContent()}
			{#if operator && filter}
				<PowerSearchTokenValue
					operatorValue={operator.value}
					filterValue={filter.value}
					maxLength={adjustedMaxLength}
					locale={locale()}
					calendar={calendar()}
				/>
			{/if}
		{/snippet}

		<!-- Show entity photo as token icon for single-entity filters -->
		{#snippet tokenIcon()}
			{#if entity}
				<Avatar src={entity.photo} name={entity.label} size={16} />
			{/if}
		{/snippet}

		<Token
			label={tokenLabel}
			{size}
			icon={entity ? tokenIcon : undefined}
			endContent={operator && filter ? valueContent : undefined}
			onclick={handleClick
				? (e: MouseEvent) => {
						e.stopPropagation();
						handleClick();
					}
				: undefined}
			onRemove={handleRemove}
			{isDisabled}
		/>
	{/if}
{/snippet}

{#snippet renderToken(item: PowerSearchItem, onRemove: () => void)}
	{@render renderFilterToken(item, onRemove)}
{/snippet}

{#snippet renderItem(item: PowerSearchItem)}
	{@const auxData = item.auxiliaryData}
	{#if !auxData}
		<TypeaheadItem {item} />
	{:else}
		{@const field = config.getField(auxData.fieldKey)}
		{@const operator = auxData.operatorKey
			? config.getOperator(auxData.fieldKey, auxData.operatorKey)
			: config.getDefaultOperator(auxData.fieldKey)}
		{@const iconName = OPERATOR_VALUE_TYPE_TO_ICON[operator?.value.type ?? ''] ?? 'search'}

		{#snippet fallbackIcon()}
			<Icon icon={iconName} size="sm" color="secondary" />
		{/snippet}

		<TypeaheadItem
			{item}
			icon={field?.icon ?? (field ? fallbackIcon : undefined)}
			description={field?.description}
		/>
	{/if}
{/snippet}

{#snippet combinedEndContent()}
	{#if resultCountText != null}
		<span {...powerSearchResultCountAttrs()}>{resultCountText}</span>
	{/if}
	{#if endContent}{@render endContent()}{/if}
{/snippet}

{#if isSheetPresentation}
	<div {...themeProps('power-search')} {@attach attachSheetRoot}>
		<Field
			{label}
			{isLabelHidden}
			inputID={triggerId}
			labelID={triggerLabelId}
			{isDisabled}
			status={status
				? {
						type: status.type,
						message: status.message,
						messageID: status.message ? statusMessageId : undefined
					}
				: undefined}
			{statusVariant}
			{xstyle}
			class={className}
			style={styleProp}
		>
			<!--
				The trigger's name is the label plus everything visible here: the
				placeholder, or the tokens, so speech input can say what it sees and
				assistive technology hears the selected filters (WCAG 2.5.3).
			-->
			<div
				{...powerSearchSheetTriggerWrapperAttrs({
					hasTokens: tokenizerValue.length > 0,
					size,
					isDisabled,
					status
				})}
				onclick={handleTriggerWrapperClick}
				onfocusin={handleTriggerFocusWithin}
				onfocusout={handleTriggerBlurWithin}
				aria-disabled={isDisabled ? true : undefined}
				{@attach disabledMessageTooltip.attachTrigger}
			>
				<div id={triggerContentId} {...powerSearchSheetContentAttrs()}>
					{#if startIcon}
						<span {...powerSearchSheetStartIconAttrs(tokenizerValue.length > 0)}>
							{#if typeof startIcon === 'string'}
								<Icon icon={startIcon} size="sm" color="secondary" />
							{:else}
								{@render startIcon()}
							{/if}
						</span>
					{/if}
					{#each tokenizerValue as item (item.id)}
						{@render renderFilterToken(item)}
					{/each}
					<!-- svelte-ignore a11y_autofocus -- the field's first control takes upstream's initial autoFocus -->
					<button
						type="button"
						id={triggerId}
						bind:this={triggerEl}
						data-testid={testId}
						autofocus={autoFocusOnMount}
						onclick={openSheet}
						aria-disabled={isDisabled ? true : undefined}
						aria-haspopup="dialog"
						aria-expanded={isSheetOpen}
						aria-labelledby={`${triggerLabelId} ${triggerContentId}`}
						aria-describedby={triggerDescribedBy}
						{...powerSearchSheetTriggerAttrs(tokenizerValue.length > 0)}
					>
						{#if filters.length === 0}
							<span {...powerSearchSheetPlaceholderAttrs()}>{placeholder}</span>
						{/if}
					</button>
				</div>
				{#if endContent || resultCountText != null}
					<div bind:this={endLaneEl} {...powerSearchSheetEndSectionAttrs()}>
						{#if resultCountText != null}
							<span {...powerSearchResultCountAttrs()}>{resultCountText}</span>
						{/if}
						{#if endContent}{@render endContent()}{/if}
					</div>
				{/if}
			</div>
			{#if showsDisabledMessage}
				<TooltipLayer tooltip={disabledMessageTooltip}>{disabledMessage}</TooltipLayer>
			{/if}
		</Field>
		<!--
			Mounted from the press until the flow's exit has completed and focus is
			back on the trigger: at rest the field renders its trigger alone — no
			closed dialogs, rows, search field or editors in the DOM.
		-->
		{#if isSheetOpen || isSheetPresented}
			<PowerSearchBottomSheet
				isOpen={isSheetOpen}
				onOpenChange={(open) => (isSheetOpen = open)}
				{resultCountText}
				{config}
				{configProp}
				{filters}
				{onChange}
				{searchSource}
				{placeholder}
				{isReadOnly}
				{isDisabled}
				{hasClear}
				{maxOperatorMenuItems}
				{timezoneID}
				{maxSearchResults}
				saveButtonLabel={popoverSaveButtonLabelFromProps}
				components={componentOverrides}
			/>
		{/if}
	</div>
{:else}
	<div {...themeProps('power-search')} {@attach attachPopoverRoot}>
		<Tokenizer
			bind:this={tokenizer}
			{label}
			{isLabelHidden}
			{searchSource}
			value={tokenizerValue}
			onChange={handleTokenizerChange}
			{renderToken}
			{renderItem}
			maxMenuItems={MAX_BROWSE_MENU_ITEMS}
			{menuWidth}
			placeholder={filters.length === 0 ? placeholder : ''}
			hasAutoFocus={autoFocusOnMount}
			hasClear={hasClear && !isReadOnly}
			{startIcon}
			endContent={resultCountText != null || endContent ? combinedEndContent : undefined}
			{isDisabled}
			{disabledMessage}
			{size}
			{tokenOverflowBehavior}
			hasEntriesOnFocus
			debounceMs={0}
			{status}
			{statusVariant}
			onfocusin={handleFieldFocus}
			onfocusout={handleFieldBlur}
			{xstyle}
			class={className}
			style={styleProp}
			data-testid={testId}
		/>
	</div>

	<PopoverLayer
		{popover}
		placement="below"
		alignment="start"
		offset={powerSearchPopoverOffset}
		xstyle={[popoverLayerStyles.layer, layerAnimations.below]}
	>
		{#if popoverPartialFilter}
			{#key popoverKey}
				{#if EditorOverride}
					<EditorOverride
						config={configProp}
						filter={popoverPartialFilter}
						mode={popoverMode}
						onSave={handlePopoverSave}
						onCancel={handlePopoverCancel}
						saveButtonLabel={popoverSaveButtonLabel}
						{isReadOnly}
					/>
				{:else}
					<PowerSearchEditPopover
						{config}
						filter={popoverPartialFilter}
						mode={popoverMode}
						onSave={handlePopoverSave}
						onCancel={handlePopoverCancel}
						saveButtonLabel={popoverSaveButtonLabel}
						maxMenuItems={maxOperatorMenuItems}
						{isReadOnly}
					/>
				{/if}
			{/key}
		{/if}
	</PopoverLayer>
{/if}
