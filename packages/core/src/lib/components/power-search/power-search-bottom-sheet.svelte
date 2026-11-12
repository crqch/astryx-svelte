<script lang="ts" module>
	import type { SearchSource } from '../typeahead/types.js';
	import type {
		PowerSearchChangeType,
		PowerSearchComponents,
		PowerSearchConfig,
		PowerSearchField,
		PowerSearchFilter,
		PowerSearchItem,
		PowerSearchOperator
	} from './types.js';
	import type { FilterValue, PartialFilter } from './types.js';
	import type { InternalConfig } from './use-internal-config.svelte.js';

	export interface PowerSearchBottomSheetProps {
		/** Whether the flow is open; the trigger in PowerSearch owns it. */
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		/**
		 * The field's formatted result count, announced from inside the open
		 * sheet's dialog when it changes while the flow is open.
		 */
		resultCountText?: string | null;
		config: InternalConfig;
		/** The caller's config, handed to Editor overrides as they expect it. */
		configProp: PowerSearchConfig;
		/** The committed filters; the draft the sheet edits starts from them. */
		filters: ReadonlyArray<PowerSearchFilter>;
		/**
		 * The field's `onChange`. Done replays the draft's edits through it, in
		 * order, onto the field's latest filters.
		 */
		onChange: (
			filters: ReadonlyArray<PowerSearchFilter>,
			changeType: PowerSearchChangeType,
			index: number
		) => void;
		/** The field typeahead source; the content search lists its suggestions. */
		searchSource: SearchSource<PowerSearchItem>;
		/** Placeholder of the content search. */
		placeholder: string;
		isReadOnly: boolean;
		isDisabled: boolean;
		hasClear: boolean;
		maxOperatorMenuItems?: number;
		/** The zone a date-only value is read and written in; see PowerSearch. */
		timezoneID?: string;
		maxSearchResults: number;
		/** The caller's confirm label; the step picks a default per mode. */
		saveButtonLabel?: string;
		components?: PowerSearchComponents;
	}

	type SheetStep = 'manage' | 'fields' | 'value';

	type PendingSheetFocus =
		| { readonly type: 'manager-add' }
		| { readonly type: 'content-search' }
		| {
				readonly type: 'manager-filter';
				readonly sourceFilter: PowerSearchFilter;
				readonly sourceSignature: string;
				readonly preferredIndex: number;
				readonly part?: 'remove';
		  }
		| { readonly type: 'field'; readonly fieldKey: string };

	interface FilterDraft {
		readonly mode: 'create' | 'edit';
		readonly generation: number;
		readonly returnFocus?: 'field' | 'content-search';
		readonly filterIndex?: number;
		readonly sourceFilter?: PowerSearchFilter;
		readonly sourceSignature?: string;
		readonly field: string;
		readonly operator?: string;
		readonly value?: FilterValue;
	}

	function resolveDraftFilterIndex(
		filters: ReadonlyArray<PowerSearchFilter>,
		draft: FilterDraft
	): number | null {
		if (
			draft.mode !== 'edit' ||
			draft.filterIndex == null ||
			draft.sourceFilter == null ||
			draft.sourceSignature == null
		) {
			return null;
		}
		return resolveFilterIdentityIndex(
			filters,
			draft.sourceFilter,
			draft.sourceSignature,
			draft.filterIndex
		);
	}

	// Below this many fields a search box is noise: the whole list is on screen.
	const SEARCHABLE_FIELD_COUNT = 8;
	// Empty-query browsing keeps the popover presentation's safety ceiling.
	const MAX_BROWSE_MENU_ITEMS = 1000;

	// A placeholder the Filters row formats `labelValue` with, then splits on, so
	// the value segment can render bold inside the catalog's ordering. A private
	// use code point: never part of a label or value.
	const ROW_VALUE_SLOT = '\uE000';
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheet from '../bottom-sheet/bottom-sheet.svelte';
	import Button from '../button/button.svelte';
	import CheckboxList from '../checkbox-list/checkbox-list.svelte';
	import CheckboxListItem from '../checkbox-list/checkbox-list-item.svelte';
	import EmptyState from '../empty-state/empty-state.svelte';
	import Heading from '../heading/heading.svelte';
	import Icon from '../icon/icon.svelte';
	import IconButton from '../icon-button/icon-button.svelte';
	import List from '../list/list.svelte';
	import ListItem from '../list/list-item.svelte';
	import RadioList from '../radio-list/radio-list.svelte';
	import RadioListItem from '../radio-list/radio-list-item.svelte';
	import Text from '../text/text.svelte';
	import TextInput from '../text-input/text-input.svelte';
	import SheetConfirmation from '../../internal/sheet-confirmation.svelte';
	import { useDismissSearchOnTouchDrag } from '../../internal/use-dismiss-search-on-touch-drag.js';
	import { containerPaddingInlineVarStyles } from '../../internal/padding.stylex.js';
	import { sx } from '../../internal/sx.js';
	import { groupItems } from '../../utils/group-items.js';
	import { isImeKeyEvent } from '../../utils/ime.js';
	import { rtlStyles } from '../../utils/rtl.stylex.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useLocale } from '../../i18n/use-locale.svelte.js';
	import { useCalendarSystem } from '../../i18n/use-calendar-system.svelte.js';
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import NestedEditor from './nested-editor.svelte';
	import PlusIcon from './power-search-plus-icon.svelte';
	import PowerSearchValueEditor from './power-search-value-editor.svelte';
	import { resolveOperatorLabel } from './resolve-operator-label.js';
	import {
		createFilterIdentities,
		createSheetSuggestionSource,
		fieldMatchesQuery,
		filterSignature,
		hasSameFilters,
		isSupportedOperator,
		nearestEditableIndex,
		replayDraftEdits,
		resolveFilterIdentityIndex,
		type DraftEdit
	} from './power-search-sheet-utils.js';
	import {
		buildSheetRelativeDateOptions,
		formatSheetValueText
	} from './power-search-sheet-text.js';
	import {
		powerSearchSheetAttrs,
		powerSearchSheetBodyStyle,
		powerSearchSheetControlSectionAttrs,
		powerSearchSheetEditorInputAttrs,
		powerSearchSheetEmptyAttrs,
		powerSearchSheetEmptyStateStyle,
		powerSearchSheetFooterAttrs,
		powerSearchSheetFooterEqualActionStyle,
		powerSearchSheetFooterSoleActionStyle,
		powerSearchSheetHeaderAttrs,
		powerSearchSheetHeaderRowAttrs,
		powerSearchSheetHeaderTextAttrs,
		powerSearchSheetNestedEditorContainerStyle,
		powerSearchSheetRowValueAttrs,
		powerSearchSheetScrollContentStyle,
		powerSearchSheetScrollViewportAttrs,
		powerSearchSheetTouchActionStyle,
		powerSearchSheetTouchHitAreaStyle
	} from './power-search-bottom-sheet.stylex.js';
	/**
	 * Ported from Astryx's `PowerSearchBottomSheet.tsx` — the touch surface of
	 * `PowerSearch presentation="bottom-sheet"`.
	 *
	 * Three steps are sibling standalone sheets that stack: Filters, Add filter,
	 * and the value step. A dismissal closes the step that received it and
	 * reveals the one beneath; dismissing the bottom sheet ends the flow. The
	 * sheets pad their own content (`padding={0}` on `BottomSheet`), and the
	 * Filters / Add filter sheets keep a fixed header and footer around a scroll
	 * viewport whose content publishes the body's padding for `edge="bleed"`
	 * lists.
	 *
	 * ## What changed from React
	 *
	 * - **`flushSync` has no counterpart.** A confirmation that must be gone
	 *   before focus moves into the sheet is closed with a state write, then
	 *   focus moved after `tick()`. The observable order is the same: the
	 *   confirmation's dialog is removed by the state write, and focus lands on
	 *   the sheet's control afterwards.
	 * - **Row refs are DOM queries.** `ListItem` has no ref prop here; rows carry
	 *   `data-filter-index` / `data-field-key` and the focus handlers query them,
	 *   which is what upstream's `managerRowsRef`/`fieldRowsRef` maps hold.
	 * - **`useAnnounce` has no modal routing in this port**, so every message goes
	 *   to the shared polite region rather than into the open sheet's dialog.
	 *   Recorded in the batch report rather than invented around.
	 * - **`editors` is not a prop.** Upstream splits the sheet into a lazily
	 *   loaded chunk and takes the popover's editors as an injected object; a
	 *   Svelte component has no lazy boundary here, so it imports them directly.
	 * - **The sheets are standalone siblings, not a retained stack.** This port's
	 *   `BottomSheet` owns one native dialog and does not mark a covered sheet
	 *   `inert`/`aria-hidden`; three steps therefore present three open dialogs
	 *   with the browser's top-layer order, not upstream's one-modal-plus-covered
	 *   stack. The step transitions, focus targets and dismissal rules here are
	 *   upstream's.
	 * - **`string_list` values use the popover's inline Tokenizer.** Upstream
	 *   opens `TokenizerBottomSheet` above the value step; that component is not
	 *   ported yet, so the chip editor stays inline here. Every other value type
	 *   uses the same editor the popover presentation does.
	 *
	 * The draft, replay, focus recovery and step rules are upstream's.
	 */
	const {
		isOpen,
		onOpenChange,
		resultCountText,
		config,
		configProp,
		filters: committedFilters,
		onChange: onCommit,
		searchSource,
		placeholder,
		isReadOnly,
		isDisabled,
		hasClear,
		maxOperatorMenuItems,
		timezoneID,
		maxSearchResults,
		saveButtonLabel: saveButtonLabelFromProps,
		components: componentOverrides
	}: PowerSearchBottomSheetProps = $props();

	const t = useTranslator();
	const locale = useLocale();
	const calendar = useCalendarSystem(undefined, 'PowerSearch');
	const announce = useAnnounce();
	const isInteractive = $derived(!isDisabled && !isReadOnly);

	// ---- draft ----
	// One open flow edits one draft of the filter list; `onChange` waits for
	// Done, and a dismissal with a changed draft asks first.
	// svelte-ignore state_referenced_locally
	let filtersAtOpen = $state<ReadonlyArray<PowerSearchFilter>>(committedFilters);
	// svelte-ignore state_referenced_locally
	let filters = $state<ReadonlyArray<PowerSearchFilter>>(committedFilters);
	// svelte-ignore state_referenced_locally
	let draftRef: ReadonlyArray<PowerSearchFilter> = filters;
	let draftEdits: DraftEdit[] = [];
	const isDraftDirty = $derived(!hasSameFilters(filtersAtOpen, filters));

	function handleDraftChange(
		next: ReadonlyArray<PowerSearchFilter>,
		changeType: PowerSearchChangeType,
		index: number
	): void {
		draftEdits.push({ before: draftRef, after: next, changeType, index });
		draftRef = next;
		filters = next;
	}

	let isDiscardConfirmationOpen = $state(false);

	const contentSearchFieldKey = $derived(config.config.contentSearchFieldKey);
	const contentSearchOperator = $derived(
		contentSearchFieldKey == null ? undefined : config.getDefaultOperator(contentSearchFieldKey)
	);
	const hasContentSearch = $derived(contentSearchOperator?.value.type === 'string');
	const suggestionSource = $derived(createSheetSuggestionSource(config, searchSource));

	const contentResultsId = $props.id();
	// The content search and its suggestion rows are one vertical list for the
	// arrow keys: ArrowDown from the searchbox reaches the first suggestion,
	// ArrowUp from the first suggestion returns to the searchbox, and the ends do
	// not wrap. Home and End stay with the searchbox's caret.
	const contentListFocus = useListFocus(() => ({
		itemSelector: `[role="searchbox"], [id="${contentResultsId}"] button`,
		wrap: false,
		hasHomeEnd: false
	}));
	function handleContentListKeyDown(event: KeyboardEvent): void {
		if (!isImeKeyEvent(event)) {
			contentListFocus.handleKeyDown(event);
		}
	}

	// Elements the focus recovery and step changes need. Nothing renders from
	// any of them.
	let manageEl: HTMLDivElement | null = null;
	let fieldsEl: HTMLDivElement | null = null;
	let contentSearchEl = $state<HTMLDivElement | null>(null);
	let fieldSearchEl = $state<HTMLDivElement | null>(null);
	let valueEl: HTMLDivElement | null = null;

	function managerAddButton(): HTMLElement | null {
		return manageEl?.querySelector<HTMLElement>('[data-manager-add]') ?? null;
	}
	function clearAllButton(): HTMLElement | null {
		return manageEl?.querySelector<HTMLElement>('[data-clear-all]') ?? null;
	}
	function cancelButton(): HTMLButtonElement | null {
		return valueEl?.querySelector<HTMLButtonElement>('[data-cancel]') ?? null;
	}

	// Where focus was inside the Filters or Add filter sheet, read on every
	// focus change there, so a controlled update that unmounts the focused
	// control can put focus on the nearest remaining row by that index.
	let lastSheetFocus: { sheet: 'manage' | 'fields'; rowIndex: number | null } | null = null;
	let pendingSheetFocus: PendingSheetFocus | null = null;
	let pendingMutationFocus = false;
	let pendingAnnouncement: string | null = null;

	function buttonRowsOf(panel: HTMLElement | null): HTMLElement[] {
		return Array.from(panel?.querySelectorAll<HTMLLIElement>('li') ?? [])
			.map((row) => row.querySelector<HTMLElement>('button'))
			.filter((button): button is HTMLElement => button != null);
	}

	function noteSheetFocus(sheet: 'manage' | 'fields', event: FocusEvent): void {
		const target = event.target as HTMLElement;
		const row = target.closest('li');
		const button = row?.querySelector<HTMLElement>('button') ?? null;
		const rowIndex =
			button == null ? -1 : buttonRowsOf(event.currentTarget as HTMLElement).indexOf(button);
		lastSheetFocus = { sheet, rowIndex: rowIndex === -1 ? null : rowIndex };
	}

	// svelte-ignore state_referenced_locally
	let step = $state<SheetStep | null>(
		isOpen
			? committedFilters.length === 0 && !isDisabled && !isReadOnly
				? 'fields'
				: 'manage'
			: null
	);
	// svelte-ignore state_referenced_locally
	let fieldPickerOrigin = $state<'manage' | 'trigger'>(
		isOpen && committedFilters.length === 0 && !isDisabled && !isReadOnly ? 'trigger' : 'manage'
	);
	let draft = $state<FilterDraft | null>(null);
	let draftGeneration = 0;
	let fieldQuery = $state('');
	let contentQuery = $state('');
	let isClearConfirmationOpen = $state(false);

	function nextDraftGeneration(): number {
		draftGeneration += 1;
		return draftGeneration;
	}

	function closeFlow(): void {
		pendingSheetFocus = null;
		step = null;
		onOpenChange(false);
	}

	function commitAndClose(): void {
		// A field that became read-only while the flow was open reports nothing.
		if (isDraftDirty && isInteractive) {
			replayDraftEdits(committedFilters, draftEdits, onCommit);
		}
		draftEdits = [];
		closeFlow();
	}

	function requestDismiss(): void {
		if (isDraftDirty) {
			isDiscardConfirmationOpen = true;
		} else {
			closeFlow();
		}
	}

	function closeDiscardConfirmation(): void {
		isDiscardConfirmationOpen = false;
		const target =
			step === 'manage'
				? (managerAddButton() ?? manageEl?.closest<HTMLElement>('[tabindex="-1"]'))
				: fieldsEl?.closest<HTMLElement>('[tabindex="-1"]');
		target?.focus({ preventScroll: true });
	}

	const isRowButton = (filter: PowerSearchFilter): boolean => !filter.isReadOnly && isInteractive;

	// ------------------------------------------------------------------ focus --

	function firstFieldsControl(): HTMLElement | null {
		return (
			fieldsEl?.querySelector<HTMLElement>('input') ??
			fieldsEl?.querySelector<HTMLElement>('li button') ??
			fieldsEl?.querySelector<HTMLElement>('button') ??
			null
		);
	}

	function focusPendingSheetTarget(): void {
		const target = pendingSheetFocus;
		if (target == null) {
			return;
		}
		pendingSheetFocus = null;
		if (target.type === 'manager-add') {
			managerAddButton()?.focus({ preventScroll: true });
			return;
		}
		if (target.type === 'content-search') {
			(contentSearchEl?.querySelector<HTMLInputElement>('input') ?? firstFieldsControl())?.focus({
				preventScroll: true
			});
			return;
		}
		if (target.type === 'field') {
			const row = Array.from(fieldsEl?.querySelectorAll<HTMLLIElement>('li') ?? []).find(
				(li) => li.dataset.fieldKey === target.fieldKey
			);
			(row?.querySelector<HTMLButtonElement>('button') ?? firstFieldsControl())?.focus({
				preventScroll: true
			});
			return;
		}
		const index =
			resolveFilterIdentityIndex(
				filters,
				target.sourceFilter,
				target.sourceSignature,
				target.preferredIndex
			) ?? nearestEditableIndex(filters, target.preferredIndex, isRowButton);
		const rowElements = Array.from(manageEl?.querySelectorAll<HTMLLIElement>('li') ?? []);
		const row = index == null ? null : rowElements[index];
		const rowButton =
			target.part === 'remove'
				? (row?.querySelector<HTMLButtonElement>('[data-sheet-remove]') ??
					row?.querySelector<HTMLButtonElement>('button'))
				: row?.querySelector<HTMLButtonElement>('button');
		(rowButton ?? managerAddButton())?.focus({ preventScroll: true });
	}

	function queueManagerAddFocus(): void {
		pendingSheetFocus = { type: 'manager-add' };
	}

	// ----------------------------------------------------------------- fields --

	const fields = $derived(config.getVisibleFields());
	const normalizedFieldQuery = $derived(fieldQuery.trim().toLowerCase());
	const matchingFields = $derived.by(() => {
		const matches = fields.filter((field) => fieldMatchesQuery(field, normalizedFieldQuery));
		return normalizedFieldQuery === '' ? matches : matches.slice(0, maxSearchResults);
	});
	const groupedFields = $derived.by<ReadonlyArray<readonly [string | null, PowerSearchField[]]>>(
		() =>
			matchingFields.length === 0
				? []
				: groupItems(
						matchingFields.map((field) => ({
							id: field.key,
							label: field.label,
							auxiliaryData: { group: field.group },
							field
						})),
						{ ungroupedFirst: true }
					).map((group) => [group.heading, group.items.map((item) => item.field)] as const)
	);
	const isFieldSearchShown = $derived(fields.length >= SEARCHABLE_FIELD_COUNT);

	function isImmediateAddField(field: PowerSearchField): boolean {
		const operators = config.getVisibleOperators(field.key);
		return operators.length === 1 && operators[0].value.type === 'empty';
	}

	// The steps stack: each opens above the sheet that led to it, which stays
	// open beneath. Add filter entered directly has no Filters sheet beneath.
	const isFieldPickerDirectEntry = $derived(fieldPickerOrigin === 'trigger');
	const isManageSheetOpen = $derived(
		step === 'manage' ||
			(step === 'fields' && !isFieldPickerDirectEntry) ||
			(step === 'value' && (draft?.mode === 'edit' || !isFieldPickerDirectEntry))
	);
	const isFieldsSheetOpen = $derived(
		step === 'fields' || (step === 'value' && draft?.mode === 'create')
	);

	// The suggestions derive synchronously from the config, so a list never
	// waits on a request.
	const contentResults = $derived.by<PowerSearchItem[]>(() => {
		if (!isFieldsSheetOpen || !hasContentSearch || !isInteractive) {
			return [];
		}
		const results =
			contentQuery.trim() === ''
				? suggestionSource.bootstrap()
				: suggestionSource.search(contentQuery);
		return results.slice(0, MAX_BROWSE_MENU_ITEMS);
	});

	// ------------------------------------------------------------------ draft --

	const draftField = $derived(draft ? config.getField(draft.field) : undefined);
	const draftOperator = $derived(
		draft?.operator != null ? config.getOperator(draft.field, draft.operator) : undefined
	);
	const draftOperators = $derived(draft ? config.getVisibleOperators(draft.field) : []);

	function describeFilterParts(filter: PowerSearchFilter): { label: string; value: string | null } {
		const field = config.getField(filter.field);
		const operator = config.getOperator(filter.field, filter.operator);
		const fieldLabel = field?.label ?? filter.field;
		const operatorLabel = operator == null ? filter.operator : resolveOperatorLabel(operator, t);
		const label = operatorLabel
			? t('@astryx.powersearch.sheet.fieldOperator', {
					field: fieldLabel,
					operator: operatorLabel
				})
			: fieldLabel;
		if (operator == null) {
			return { label, value: null };
		}
		const filterValue = filter.value;
		const value =
			operator.value.type === 'date_relative' && filterValue.type === 'date_relative'
				? (buildSheetRelativeDateOptions(operator.value).find(
						(option) => option.value === filterValue.value
					)?.label ?? filterValue.value)
				: formatSheetValueText(
						config,
						operator.value,
						filterValue,
						t,
						locale(),
						timezoneID,
						calendar()
					);
		return { label, value };
	}

	function describeFilter(filter: PowerSearchFilter): string {
		const parts = describeFilterParts(filter);
		return parts.value
			? t('@astryx.powersearch.sheet.labelValue', { label: parts.label, value: parts.value })
			: parts.label;
	}

	function openFieldList(): void {
		if (!isInteractive) {
			return;
		}
		fieldPickerOrigin = 'manage';
		fieldQuery = '';
		contentQuery = '';
		pendingSheetFocus = null;
		step = 'fields';
	}

	function commitSavedFilter(next: FilterDraft, filter: PowerSearchFilter): void {
		if (!isInteractive) {
			queueManagerAddFocus();
			step = 'manage';
			return;
		}
		if (next.mode === 'edit') {
			const filterIndex = resolveDraftFilterIndex(filters, next);
			const currentFilter = filterIndex == null ? undefined : filters[filterIndex];
			if (filterIndex == null || currentFilter == null || currentFilter.isReadOnly) {
				pendingSheetFocus =
					next.sourceFilter != null && next.sourceSignature != null && next.filterIndex != null
						? {
								type: 'manager-filter',
								sourceFilter: next.sourceFilter,
								sourceSignature: next.sourceSignature,
								preferredIndex: next.filterIndex
							}
						: { type: 'manager-add' };
				step = 'manage';
				return;
			}
			pendingSheetFocus = {
				type: 'manager-filter',
				sourceFilter: filter,
				sourceSignature: filterSignature(filter),
				preferredIndex: filterIndex
			};
			const updated = [...filters];
			updated[filterIndex] = filter;
			handleDraftChange(updated, 'edit', filterIndex);
		} else {
			queueManagerAddFocus();
			handleDraftChange([...filters, filter], 'add', filters.length);
		}
		step = 'manage';
	}

	function openCreateEditor(
		field: PowerSearchField,
		operator: PowerSearchOperator,
		returnFocus: 'field' | 'content-search' = 'field'
	): void {
		draft = {
			mode: 'create',
			generation: nextDraftGeneration(),
			returnFocus,
			field: field.key,
			operator: operator.key,
			value: operator.value.type === 'empty' ? { type: 'empty' } : undefined
		};
		pendingSheetFocus = null;
		step = 'value';
	}

	function handleFieldSelect(field: PowerSearchField): void {
		if (!isInteractive) {
			return;
		}
		if (isImmediateAddField(field)) {
			const [operator] = config.getVisibleOperators(field.key);
			const nextFilter: PowerSearchFilter = {
				field: field.key,
				operator: operator.key,
				value: { type: 'empty' }
			};
			pendingSheetFocus = {
				type: 'manager-filter',
				sourceFilter: nextFilter,
				sourceSignature: filterSignature(nextFilter),
				preferredIndex: filters.length
			};
			pendingMutationFocus = true;
			handleDraftChange([...filters, nextFilter], 'add', filters.length);
			pendingAnnouncement = t('@astryx.tokenizer.tokenAdded', {
				label: describeFilter(nextFilter)
			});
			step = 'manage';
			return;
		}
		const operator = config.getDefaultOperator(field.key) ?? field.operators[0];
		if (operator == null) {
			return;
		}
		openCreateEditor(field, operator);
	}

	function handleContentSuggestionSelect(item: PowerSearchItem | null): void {
		if (!isInteractive || item?.auxiliaryData == null) {
			return;
		}
		const { fieldKey, filterValue, operatorKey } = item.auxiliaryData;
		const field = config.getField(fieldKey);
		const operator =
			operatorKey == null
				? config.getDefaultOperator(fieldKey)
				: config.getOperator(fieldKey, operatorKey);
		if (field == null || operator == null) {
			return;
		}
		contentQuery = '';
		if (filterValue != null) {
			const nextFilter: PowerSearchFilter = {
				field: field.key,
				operator: operator.key,
				value: filterValue
			};
			pendingSheetFocus = {
				type: 'manager-filter',
				sourceFilter: nextFilter,
				sourceSignature: filterSignature(nextFilter),
				preferredIndex: filters.length
			};
			pendingMutationFocus = true;
			handleDraftChange([...filters, nextFilter], 'add', filters.length);
			pendingAnnouncement = t('@astryx.tokenizer.tokenAdded', { label: item.label });
			step = 'manage';
			return;
		}
		openCreateEditor(field, operator, 'content-search');
	}

	function handleFilterEdit(index: number): void {
		const filter = filters[index];
		if (!isInteractive || filter == null || filter.isReadOnly) {
			return;
		}
		draft = {
			mode: 'edit',
			generation: nextDraftGeneration(),
			filterIndex: index,
			sourceFilter: filter,
			sourceSignature: filterSignature(filter),
			field: filter.field,
			operator: filter.operator,
			value: filter.value
		};
		pendingSheetFocus = null;
		step = 'value';
	}

	function handleRemoveFilter(index: number): void {
		const filter = filters[index];
		if (!isInteractive || filter == null || filter.isReadOnly) {
			return;
		}
		const nextFilters = filters.filter((_, i) => i !== index);
		const nextIndex = nearestEditableIndex(nextFilters, index, isRowButton);
		if (nextIndex == null) {
			pendingSheetFocus = { type: 'manager-add' };
		} else {
			const nextFilter = nextFilters[nextIndex];
			pendingSheetFocus = {
				type: 'manager-filter',
				sourceFilter: nextFilter,
				sourceSignature: filterSignature(nextFilter),
				preferredIndex: nextIndex,
				part: 'remove'
			};
		}
		pendingMutationFocus = true;
		handleDraftChange(nextFilters, 'remove', index);
		const message = t('@astryx.tokenizer.tokenRemoved', { label: describeFilter(filter) });
		if (step === 'manage') {
			announce(message);
		} else {
			pendingAnnouncement = message;
		}
	}

	function closeClearConfirmation(confirmed: boolean): void {
		const kept = filters.filter((filter) => filter.isReadOnly);
		const firstRemovedIndex = filters.findIndex((filter) => !filter.isReadOnly);
		const isClearing = confirmed && isInteractive && firstRemovedIndex >= 0;
		isClearConfirmationOpen = false;
		if (isClearing) {
			handleDraftChange(kept, 'remove', firstRemovedIndex);
		}
		if (!isClearing) {
			clearAllButton()?.focus();
			return;
		}
		managerAddButton()?.focus({ preventScroll: true });
		announce(
			kept.length > 0
				? t('@astryx.powersearch.editableFiltersRemoved')
				: t('@astryx.powersearch.allFiltersRemoved')
		);
	}

	function handleOperatorSelect(operator: PowerSearchOperator): void {
		if (draft == null) {
			return;
		}
		const keepsValue = draft.value != null && draft.value.type === operator.value.type;
		draft = {
			...draft,
			operator: operator.key,
			value:
				operator.value.type === 'empty' ? { type: 'empty' } : keepsValue ? draft.value : undefined
		};
	}

	function handleDraftValueChange(value: FilterValue): void {
		if (draft == null) {
			return;
		}
		draft = { ...draft, value };
	}

	function handleDraftUnstage(): void {
		if (draft == null) {
			return;
		}
		draft = { ...draft, value: undefined };
	}

	function handleSave(): void {
		if (draft?.value == null || draft.operator == null) {
			return;
		}
		commitSavedFilter(draft, {
			field: draft.field,
			operator: draft.operator,
			value: draft.value
		});
	}

	function returnFromValue(): void {
		if (draft == null) {
			queueManagerAddFocus();
			step = 'manage';
			return;
		}
		if (
			draft.mode === 'edit' &&
			draft.sourceFilter != null &&
			draft.sourceSignature != null &&
			draft.filterIndex != null
		) {
			pendingSheetFocus = {
				type: 'manager-filter',
				sourceFilter: draft.sourceFilter,
				sourceSignature: draft.sourceSignature,
				preferredIndex: resolveDraftFilterIndex(filters, draft) ?? draft.filterIndex
			};
			step = 'manage';
			return;
		}
		if (draft.returnFocus === 'content-search') {
			pendingSheetFocus = { type: 'content-search' };
			step = 'fields';
			return;
		}
		pendingSheetFocus = { type: 'field', fieldKey: draft.field };
		step = 'fields';
	}

	function handleRemove(): void {
		if (draft?.mode !== 'edit') {
			return;
		}
		const filterIndex = resolveDraftFilterIndex(filters, draft);
		if (filterIndex == null || filters[filterIndex]?.isReadOnly) {
			queueManagerAddFocus();
			step = 'manage';
			return;
		}
		handleRemoveFilter(filterIndex);
		step = 'manage';
	}

	// ---- controlled open ----

	// svelte-ignore state_referenced_locally
	let wasOpen = isOpen;
	$effect(() => {
		const open = isOpen;
		if (open === wasOpen) {
			return;
		}
		wasOpen = open;
		if (open) {
			filtersAtOpen = committedFilters;
			filters = committedFilters;
			draftRef = committedFilters;
			draftEdits = [];
			fieldQuery = '';
			contentQuery = '';
			const startsOnAddFilter = committedFilters.length === 0 && isInteractive;
			step = startsOnAddFilter ? 'fields' : 'manage';
			fieldPickerOrigin = startsOnAddFilter ? 'trigger' : 'manage';
		} else {
			step = null;
			isClearConfirmationOpen = false;
			isDiscardConfirmationOpen = false;
		}
	});

	// A step change announces what the step it lands in must say, after the
	// entering sheet is the open dialog.
	$effect(() => {
		const current = step;
		if (current != null && pendingAnnouncement != null) {
			const message = pendingAnnouncement;
			pendingAnnouncement = null;
			announce(message);
		}
	});

	// A target still pending when the flow closes never carries into the next open.
	$effect(() => {
		if (step == null) {
			pendingSheetFocus = null;
			pendingMutationFocus = false;
			return;
		}
		focusPendingSheetTarget();
	});

	// A mutation that unmounts the focused control leaves focus on the page body
	// inside the open modal. Read after every commit of an open step: when focus
	// is no longer inside the sheet's dialog, the nearest remaining row by the
	// last focused index takes it, else the sheet's first control, else its panel.
	$effect(() => {
		const current = step;
		if (current !== 'manage' && current !== 'fields') {
			return;
		}
		const last = lastSheetFocus;
		if (last == null || last.sheet !== current) {
			return;
		}
		// Subscribe to the filter list so a removal re-runs this recovery.
		void filters;
		untrack(() => {
			const panel = current === 'manage' ? manageEl : fieldsEl;
			const dialog = panel?.closest('dialog');
			const active = document.activeElement;
			if (panel == null || dialog == null) {
				return;
			}
			if (active != null && active !== document.body && dialog.contains(active)) {
				return;
			}
			const rowButtons = buttonRowsOf(panel);
			let target: HTMLElement | null = null;
			if (last.rowIndex != null && rowButtons.length > 0) {
				target = rowButtons[Math.min(last.rowIndex, rowButtons.length - 1)];
			}
			target ??=
				panel.querySelector<HTMLElement>('input') ??
				rowButtons[0] ??
				panel.querySelector<HTMLElement>('button') ??
				null;
			if (target != null) {
				target.focus({ preventScroll: true });
			} else {
				const focusable = dialog.querySelector<HTMLElement>('[tabindex="-1"]');
				(focusable ?? dialog).focus({ preventScroll: true });
			}
		});
	});

	// The filters effect is declared after the recovery one so a mutation that
	// lands in the same commit as the step change resolves its row against the
	// new filters.
	$effect(() => {
		const current = step;
		// Subscribe to the draft list and the step.
		void filters;
		if (current === 'manage' && pendingMutationFocus) {
			pendingMutationFocus = false;
			untrack(focusPendingSheetTarget);
		}
	});

	$effect(() => {
		if (isDisabled && isOpen) {
			onOpenChange(false);
		}
	});

	// Each step sheet is controlled by `step`; a sheet only ever asks to close,
	// which only the top sheet of the stack receives. Closing the top step
	// reveals the step beneath it; closing the bottom one ends the flow.
	function handleManageOpenChange(open: boolean): void {
		if (!open && step === 'manage') {
			requestDismiss();
		}
	}
	function handleFieldsOpenChange(open: boolean): void {
		if (open || step !== 'fields') {
			return;
		}
		if (fieldPickerOrigin === 'trigger') {
			requestDismiss();
			return;
		}
		queueManagerAddFocus();
		step = 'manage';
	}
	function handleValueOpenChange(open: boolean): void {
		if (!open && step === 'value') {
			returnFromValue();
		}
	}

	// ---- render state ----

	const filterIdentities = createFilterIdentities();
	const filterIds = $derived(filterIdentities.next(filters));
	const filterRows = $derived(
		filters.map((filter, index) => {
			const { label, value } = describeFilterParts(filter);
			const isEditable = isRowButton(filter);
			let displayLabelBefore = label;
			let displayLabelAfter = '';
			if (value) {
				const [before, after] = t('@astryx.powersearch.sheet.labelValue', {
					label,
					value: ROW_VALUE_SLOT
				}).split(ROW_VALUE_SLOT);
				displayLabelBefore = before;
				displayLabelAfter = after;
			}
			return {
				displayLabelBefore,
				displayLabelAfter,
				value,
				filter,
				index,
				isEditable,
				key: `filter-${filterIds[index]}`
			};
		})
	);
	const hasRemovableFilter = $derived(filters.some((filter) => !filter.isReadOnly));
	const isClearAllShown = $derived(hasClear && isInteractive && hasRemovableFilter);

	const EditorOverride = $derived(
		draftOperator != null ? componentOverrides?.[draftOperator.value.type]?.Editor : undefined
	);

	const draftOperatorLabel = $derived(
		draftOperator == null ? '' : resolveOperatorLabel(draftOperator, t)
	);
	const showsOperatorGroup = $derived(
		draftOperators.length > 1 && draftOperator != null && draftOperators.includes(draftOperator)
	);
	const editorTitle = $derived.by(() => {
		if (draft == null) {
			return t('@astryx.powersearch.sheet.addFilter');
		}
		if (draftField == null || (draftOperator == null && draft.operator != null)) {
			return t('@astryx.powersearch.sheet.fieldOperator', {
				field: draftField?.label ?? draft.field,
				operator: draftOperatorLabel !== '' ? draftOperatorLabel : (draft.operator ?? '')
			}).trim();
		}
		if (!showsOperatorGroup && draftOperatorLabel !== '') {
			return t('@astryx.powersearch.sheet.fieldOperator', {
				field: draftField.label,
				operator: draftOperatorLabel
			});
		}
		return draftField.label;
	});
	const saveButtonLabel = $derived(
		saveButtonLabelFromProps ??
			(draft?.mode === 'edit'
				? t('@astryx.powersearch.editor.apply')
				: t('@astryx.powersearch.sheet.addFilter'))
	);

	const bodyAttrs = $derived(sx(powerSearchSheetBodyStyle, containerPaddingInlineVarStyles[4]));
	const scrollContentAttrs = $derived(
		sx(powerSearchSheetScrollContentStyle, containerPaddingInlineVarStyles[4])
	);

	const fieldPickerDragHandlers = useDismissSearchOnTouchDrag(
		() => [
			contentSearchEl?.querySelector('input') ?? null,
			fieldSearchEl?.querySelector('input') ?? null
		],
		() => fieldsEl?.closest<HTMLElement>('[tabindex="-1"]')
	);

	// The field's result count, while a sheet is open: the owner's own effect is
	// quiet then, so the change is spoken here. Only a change after the flow
	// opened is spoken.
	// svelte-ignore state_referenced_locally
	let announcedResultCount = resultCountText;
	$effect(() => {
		const text = resultCountText;
		if (text === announcedResultCount) {
			return;
		}
		announcedResultCount = text;
		if (step != null && text != null) {
			announce(text);
		}
	});

	const isEditorDisabled = $derived(isDisabled || isReadOnly);
	const isSaveDisabled = $derived(
		isEditorDisabled || draft?.operator == null || draft.value == null
	);
	const isDraftRenderable = $derived(draft != null && draftField != null && draftOperator != null);
	const isDraftNested = $derived(
		isDraftRenderable && draftOperator != null && !isSupportedOperator(draftOperator)
	);

	// svelte-ignore state_referenced_locally
	let wasDraftRenderable = isDraftRenderable;
	$effect(() => {
		const now = isDraftRenderable;
		const was = wasDraftRenderable;
		wasDraftRenderable = now;
		if (!was || now || draft == null || step !== 'value') {
			return;
		}
		const active = document.activeElement;
		const cancel = cancelButton();
		const dialog = cancel?.closest('dialog');
		if (dialog != null && active != null && dialog.contains(active)) {
			return;
		}
		cancel?.focus({ preventScroll: true });
	});

	// The value step's "no longer available" message, spoken once per opened
	// filter while the step is the open one.
	let announcedUnavailable = -1;
	$effect(() => {
		if (
			isDraftRenderable ||
			draft == null ||
			step !== 'value' ||
			announcedUnavailable === draft.generation
		) {
			return;
		}
		announcedUnavailable = draft.generation;
		announce(t('@astryx.powersearch.sheet.filterUnavailable'));
	});

	const operatorChoices = $derived(
		draftField == null
			? []
			: draftOperators.map((operator) => ({
					value: operator.key,
					label: t('@astryx.powersearch.sheet.fieldOperator', {
						field: draftField!.label,
						operator: resolveOperatorLabel(operator, t)
					})
				}))
	);

	const nestedOperatorOptions = $derived(
		draftOperator == null
			? []
			: [{ value: draftOperator.key, label: resolveOperatorLabel(draftOperator, t) }]
	);

	function handleNestedDraftChange(next: PartialFilter): void {
		if (draft == null) {
			return;
		}
		draft = { ...draft, value: next.value };
	}

	const relativeChoices = $derived(
		draftOperator?.value.type === 'date_relative'
			? buildSheetRelativeDateOptions(draftOperator.value)
			: []
	);
	const choiceItems = $derived(
		draftOperator?.value.type === 'enum' || draftOperator?.value.type === 'enum_list'
			? draftOperator.value.values
			: []
	);
	const selectedValues = $derived.by<readonly string[]>(() => {
		const value = draft?.value;
		if (value?.type === 'enum' || value?.type === 'date_relative') {
			return [value.value];
		}
		if (value?.type === 'enum_list') {
			return value.value;
		}
		return [];
	});
</script>

{#snippet plusIcon()}
	<Icon icon={PlusIcon} size="sm" />
{/snippet}

{#snippet emptyActions()}
	<Button
		data-manager-add=""
		label={t('@astryx.powersearch.sheet.addFilter')}
		icon={plusIcon}
		variant="primary"
		size="lg"
		xstyle={powerSearchSheetTouchHitAreaStyle}
		onclick={openFieldList}
	/>
{/snippet}

{#snippet headerAddAction()}
	<Button
		data-manager-add=""
		label={t('@astryx.powersearch.sheet.addFilter')}
		icon={plusIcon}
		isIconOnly
		variant="secondary"
		size="md"
		xstyle={powerSearchSheetTouchHitAreaStyle}
		onclick={openFieldList}
	/>
{/snippet}

{#snippet chevron()}
	<Icon icon="chevronRight" size="sm" color="secondary" xstyle={rtlStyles.mirror} />
{/snippet}

{#snippet plusEnd()}
	<Icon icon={PlusIcon} size="sm" color="secondary" />
{/snippet}

{#snippet emptyIcon()}
	<Icon icon="search" size="lg" color="secondary" />
{/snippet}

<!-- Filters -->
<BottomSheet
	isOpen={isManageSheetOpen}
	onOpenChange={handleManageOpenChange}
	label={t('@astryx.powersearch.sheet.filtersTitle')}
	height="tall"
	padding={0}
>
	<div
		bind:this={manageEl}
		onfocusin={(event) => noteSheetFocus('manage', event)}
		{...powerSearchSheetAttrs(true)}
	>
		<div {...powerSearchSheetHeaderAttrs()}>
			<div {...powerSearchSheetHeaderRowAttrs()}>
				<div {...powerSearchSheetHeaderTextAttrs()}>
					<Heading level={3}>{t('@astryx.powersearch.sheet.filtersTitle')}</Heading>
				</div>
				{#if isInteractive && filterRows.length > 0}
					{@render headerAddAction()}
				{/if}
			</div>
		</div>
		<div {...powerSearchSheetScrollViewportAttrs()}>
			<div {...scrollContentAttrs}>
				{#if filterRows.length === 0}
					<!-- With no filter the single thing to do is the only visible action. -->
					{#if isManageSheetOpen}
						<EmptyState
							title={t(
								isDraftDirty
									? '@astryx.powersearch.sheet.noFiltersInDraft'
									: '@astryx.powersearch.sheet.noFilters'
							)}
							description={t('@astryx.powersearch.sheet.noFiltersDescription')}
							headingLevel={4}
							icon={funnelIcon}
							xstyle={powerSearchSheetEmptyStateStyle}
							actions={isInteractive ? emptyActions : undefined}
						/>
					{/if}
				{:else}
					<List hasDividers density="spacious" edge="bleed">
						{#each filterRows as row (row.key)}
							{@const operator = config.getOperator(row.filter.field, row.filter.operator)}
							{@const fieldLabel = config.getField(row.filter.field)?.label ?? row.filter.field}
							{@const isOneTap = operator?.value.type === 'empty'}
							{@const removeLabel = t('@astryx.powersearch.sheet.removeFilter', {
								field: fieldLabel
							})}
							<ListItem
								data-filter-index={row.index}
								onclick={row.isEditable
									? isOneTap
										? () => handleRemoveFilter(row.index)
										: () => handleFilterEdit(row.index)
									: undefined}
								endContent={row.isEditable ? removeAction : undefined}
							>
								{#snippet label()}
									{row.displayLabelBefore}{#if row.value}<span {...powerSearchSheetRowValueAttrs()}
											>{row.value}</span
										>{row.displayLabelAfter}{/if}
								{/snippet}
							</ListItem>
							{#snippet removeAction()}
								<IconButton
									data-sheet-remove=""
									label={removeLabel}
									tooltip={removeLabel}
									icon={closeIcon}
									variant="ghost"
									size="md"
									xstyle={powerSearchSheetTouchHitAreaStyle}
									onclick={(event: MouseEvent) => {
										event.stopPropagation();
										handleRemoveFilter(row.index);
									}}
								/>
							{/snippet}
						{/each}
					</List>
				{/if}
			</div>
		</div>
		<!-- The footer stays while the draft differs from the applied filters: an
		     emptied draft still needs Done to apply the removals. -->
		{#if filterRows.length > 0 || isDraftDirty}
			<div {...powerSearchSheetFooterAttrs(true)}>
				{#if isClearAllShown}
					<Button
						data-clear-all=""
						label={t('@astryx.powersearch.sheet.clearAll')}
						variant="secondary"
						size="lg"
						xstyle={powerSearchSheetFooterEqualActionStyle}
						onclick={() => (isClearConfirmationOpen = true)}
					/>
				{/if}
				<Button
					label={t('@astryx.powersearch.sheet.done')}
					variant="primary"
					size="lg"
					xstyle={isClearAllShown
						? powerSearchSheetFooterEqualActionStyle
						: [powerSearchSheetFooterSoleActionStyle, powerSearchSheetTouchHitAreaStyle]}
					onclick={commitAndClose}
					width={isClearAllShown ? undefined : '100%'}
				/>
			</div>
		{/if}
	</div>
</BottomSheet>

{#snippet funnelIcon()}
	<Icon icon="funnel" size="lg" color="secondary" />
{/snippet}

{#snippet closeIcon()}
	<Icon icon="close" size="sm" />
{/snippet}

<!-- Add filter -->
<BottomSheet
	isOpen={isFieldsSheetOpen}
	onOpenChange={handleFieldsOpenChange}
	label={t('@astryx.powersearch.sheet.addFilter')}
	height="tall"
	padding={0}
>
	<div
		bind:this={fieldsEl}
		onfocusin={(event) => noteSheetFocus('fields', event)}
		onkeydown={hasContentSearch ? handleContentListKeyDown : undefined}
		{...powerSearchSheetAttrs(true)}
		{@attach contentListFocus.attachList}
	>
		<div {...powerSearchSheetHeaderAttrs()}>
			<div {...powerSearchSheetHeaderRowAttrs()}>
				<div {...powerSearchSheetHeaderTextAttrs()}>
					<Heading level={3}>{t('@astryx.powersearch.sheet.addFilter')}</Heading>
				</div>
			</div>
			{#if hasContentSearch}
				<div bind:this={contentSearchEl}>
					<TextInput
						label={t('@astryx.powersearch.sheet.search')}
						isLabelHidden
						role="searchbox"
						aria-controls={contentResultsId}
						value={contentQuery}
						onChange={(value) => (contentQuery = value)}
						onkeydown={(event) => {
							if (isImeKeyEvent(event)) {
								return;
							}
							if (event.key === 'Enter' && contentResults[0] != null) {
								event.preventDefault();
								handleContentSuggestionSelect(contentResults[0]);
							}
						}}
						{placeholder}
						hasClear
						startIcon={searchIcon}
						isDisabled={!isInteractive}
						size="lg"
						width="100%"
					/>
				</div>
			{:else if isFieldSearchShown}
				<div bind:this={fieldSearchEl}>
					<TextInput
						label={t('@astryx.powersearch.sheet.searchFields')}
						isLabelHidden
						placeholder={t('@astryx.powersearch.sheet.searchFieldsPlaceholder')}
						value={fieldQuery}
						onChange={(value) => (fieldQuery = value)}
						startIcon={searchIcon}
						isDisabled={!isInteractive}
						size="lg"
						width="100%"
					/>
				</div>
			{/if}
		</div>
		<div {...powerSearchSheetScrollViewportAttrs()} {...fieldPickerDragHandlers}>
			<div {...scrollContentAttrs}>
				{#if hasContentSearch}
					{#if contentResults.length > 0}
						<List
							id={contentResultsId}
							aria-label={t('@astryx.powersearch.sheet.searchResults')}
							hasDividers
							density="spacious"
							edge="bleed"
						>
							{#each contentResults as item (item.id)}
								<ListItem
									label={item.label}
									isDisabled={!isInteractive}
									onclick={() => handleContentSuggestionSelect(item)}
								/>
							{/each}
						</List>
					{:else if contentQuery.trim() !== ''}
						<div id={contentResultsId}>
							{#if step === 'fields'}
								<EmptyState
									icon={emptyIcon}
									title={t('@astryx.powersearch.sheet.noResults')}
									description={t('@astryx.powersearch.sheet.tryDifferentSearch')}
									headingLevel={4}
									isCompact
									xstyle={powerSearchSheetEmptyStateStyle}
								/>
							{/if}
						</div>
					{:else}
						<div id={contentResultsId}></div>
					{/if}
				{:else if groupedFields.length === 0}
					{#if normalizedFieldQuery !== '' && step === 'fields'}
						<EmptyState
							icon={emptyIcon}
							title={t('@astryx.powersearch.sheet.noMatchingFields')}
							description={t('@astryx.powersearch.sheet.tryDifferentSearch')}
							headingLevel={4}
							isCompact
							xstyle={powerSearchSheetEmptyStateStyle}
						/>
					{/if}
				{:else}
					{#each groupedFields as [group, groupFields] (group ?? '')}
						<List
							hasDividers
							density="spacious"
							header={group === null || group === ''
								? t('@astryx.powersearch.sheet.ungroupedFields')
								: group}
							edge="bleed"
						>
							{#each groupFields as field (field.key)}
								<ListItem
									label={field.label}
									data-field-key={field.key}
									isDisabled={!isInteractive}
									startContent={field.icon}
									endContent={isImmediateAddField(field) ? plusEnd : chevron}
									onclick={() => handleFieldSelect(field)}
								/>
							{/each}
						</List>
					{/each}
				{/if}
			</div>
		</div>
		{#if isFieldPickerDirectEntry}
			<div {...powerSearchSheetFooterAttrs(true)}>
				<Button
					label={t('@astryx.powersearch.sheet.done')}
					variant="primary"
					width="100%"
					xstyle={powerSearchSheetTouchActionStyle}
					onclick={commitAndClose}
				/>
			</div>
		{/if}
	</div>
</BottomSheet>

{#snippet searchIcon()}
	<Icon icon="search" size="sm" color="secondary" />
{/snippet}

<!-- Value step -->
<BottomSheet
	isOpen={step === 'value'}
	onOpenChange={handleValueOpenChange}
	label={editorTitle}
	height="tall"
	padding={0}
	purpose="info"
>
	<div bind:this={valueEl} {...powerSearchSheetAttrs()}>
		<div {...powerSearchSheetHeaderAttrs(true)}>
			<div {...powerSearchSheetHeaderRowAttrs()}>
				<div {...powerSearchSheetHeaderTextAttrs()}>
					<Heading level={3} maxLines={1}>{editorTitle}</Heading>
				</div>
			</div>
		</div>
		{#if isDraftRenderable && EditorOverride}
			<div {...bodyAttrs}>
				{#if showsOperatorGroup}
					<div {...powerSearchSheetControlSectionAttrs()}>
						<RadioList
							label={t('@astryx.powersearch.editor.operator')}
							isLabelHidden
							value={draft?.operator ?? ''}
							onChange={(operatorKey) => {
								const operator = draftOperators.find((candidate) => candidate.key === operatorKey);
								if (operator != null) {
									handleOperatorSelect(operator);
								}
							}}
							isDisabled={isEditorDisabled}
						>
							{#each operatorChoices as choice (choice.value)}
								<RadioListItem label={choice.label} value={choice.value} />
							{/each}
						</RadioList>
					</div>
				{/if}
				{#key `${draft?.generation}-${draft?.field}-${draft?.operator}`}
					{@const Editor = EditorOverride}
					<Editor
						config={configProp}
						filter={{
							field: draft?.field ?? '',
							operator: draft?.operator,
							value: draft?.value
						}}
						mode={draft?.mode ?? 'create'}
						onSave={(saved) => {
							if (saved == null) {
								if (draft?.mode === 'edit') {
									handleRemove();
								} else {
									queueManagerAddFocus();
									step = 'manage';
								}
								return;
							}
							if (draft != null) {
								commitSavedFilter(draft, saved);
							}
						}}
						onCancel={returnFromValue}
						{saveButtonLabel}
						isReadOnly={isEditorDisabled}
						{timezoneID}
					/>
				{/key}
			</div>
		{:else}
			<div {...bodyAttrs}>
				{#if isDraftRenderable}
					{#if showsOperatorGroup}
						<div {...powerSearchSheetControlSectionAttrs()}>
							<RadioList
								label={t('@astryx.powersearch.editor.operator')}
								isLabelHidden
								value={draft?.operator ?? ''}
								onChange={(operatorKey) => {
									const operator = draftOperators.find(
										(candidate) => candidate.key === operatorKey
									);
									if (operator != null) {
										handleOperatorSelect(operator);
									}
								}}
								isDisabled={isEditorDisabled}
							>
								{#each operatorChoices as choice (choice.value)}
									<RadioListItem label={choice.label} value={choice.value} />
								{/each}
							</RadioList>
						</div>
					{/if}
					{#if isDraftNested}
						{#key `${draft?.generation}-${draft?.field}-${draft?.operator}`}
							<NestedEditor
								{config}
								partialFilter={{
									field: draft?.field ?? '',
									operator: draft?.operator,
									value: draft?.value
								}}
								operatorOptions={nestedOperatorOptions}
								hasRootOperatorPicker={false}
								onOperatorChange={() => {}}
								onPartialFilterChange={handleNestedDraftChange}
								maxMenuItems={maxOperatorMenuItems}
								isReadOnly={isEditorDisabled}
								xstyle={powerSearchSheetNestedEditorContainerStyle}
							/>
						{/key}
					{:else if draftOperator}
						{#key `${draft?.generation}-${draft?.field}-${draft?.operator}`}
							{#if draftOperator.value.type === 'enum'}
								<RadioList
									label={draftField?.label ?? ''}
									isLabelHidden
									value={selectedValues[0] ?? ''}
									onChange={(value) => handleDraftValueChange({ type: 'enum', value })}
									isDisabled={isEditorDisabled}
								>
									{#each choiceItems as item (item.value)}
										<RadioListItem label={item.label} value={item.value} />
									{/each}
								</RadioList>
							{:else if draftOperator.value.type === 'enum_list'}
								<CheckboxList
									label={draftField?.label ?? ''}
									isLabelHidden
									value={[...selectedValues]}
									onChange={(values) =>
										handleDraftValueChange({ type: 'enum_list', value: values })}
									isDisabled={isEditorDisabled}
								>
									{#each choiceItems as item (item.value)}
										<CheckboxListItem label={item.label} value={item.value} />
									{/each}
								</CheckboxList>
							{:else if draftOperator.value.type === 'date_relative'}
								<RadioList
									label={draftField?.label ?? ''}
									isLabelHidden
									value={selectedValues[0] ?? ''}
									onChange={(value) => handleDraftValueChange({ type: 'date_relative', value })}
									isDisabled={isEditorDisabled}
								>
									{#each relativeChoices as choice (choice.value)}
										<RadioListItem label={choice.label} value={choice.value} />
									{/each}
								</RadioList>
							{:else}
								<div {...powerSearchSheetEditorInputAttrs()}>
									<PowerSearchValueEditor
										operatorValue={draftOperator.value}
										filterValue={draft?.value}
										onChange={(value) => handleDraftValueChange(value)}
										onEnter={handleSave}
										{config}
										maxMenuItems={maxOperatorMenuItems}
										isDisabled={isEditorDisabled}
										{timezoneID}
									/>
								</div>
							{/if}
						{/key}
					{/if}
				{:else}
					{#if draft != null}
						<div {...powerSearchSheetEmptyAttrs()}>
							<Text type="supporting" color="secondary">
								{t('@astryx.powersearch.sheet.filterUnavailable')}
							</Text>
						</div>
					{/if}
				{/if}
			</div>
			<div {...powerSearchSheetFooterAttrs()}>
				{#if isReadOnly}
					<Button
						data-cancel=""
						label={t('@astryx.powersearch.editor.cancel')}
						variant="secondary"
						width="100%"
						xstyle={[powerSearchSheetFooterSoleActionStyle, powerSearchSheetTouchHitAreaStyle]}
						onclick={returnFromValue}
					/>
				{:else}
					<Button
						data-cancel=""
						label={t('@astryx.powersearch.editor.cancel')}
						variant="secondary"
						size="lg"
						xstyle={powerSearchSheetFooterEqualActionStyle}
						onclick={returnFromValue}
					/>
					{#if isDraftRenderable}
						<Button
							label={saveButtonLabel}
							variant="primary"
							size="lg"
							isDisabled={isSaveDisabled}
							xstyle={powerSearchSheetFooterEqualActionStyle}
							onclick={handleSave}
						/>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</BottomSheet>

{#if isClearConfirmationOpen}
	<SheetConfirmation
		isOpen
		onOpenChange={(open) => {
			if (!open) {
				closeClearConfirmation(false);
			}
		}}
		title={t('@astryx.powersearch.sheet.clearAllTitle')}
		description={t('@astryx.powersearch.sheet.clearAllDescription')}
		actionLabel={t('@astryx.powersearch.sheet.clearAllConfirm')}
		cancelLabel={t('@astryx.powersearch.sheet.clearAllCancel')}
		onAction={() => closeClearConfirmation(true)}
	/>
{/if}
{#if isDiscardConfirmationOpen}
	<SheetConfirmation
		isOpen
		onOpenChange={(open) => {
			if (!open) {
				closeDiscardConfirmation();
			}
		}}
		title={t('@astryx.powersearch.sheet.discardTitle')}
		description={t('@astryx.powersearch.sheet.discardDescription')}
		actionLabel={t('@astryx.powersearch.sheet.discardConfirm')}
		cancelLabel={t('@astryx.powersearch.sheet.keepEditing')}
		onAction={() => {
			isDiscardConfirmationOpen = false;
			draftEdits = [];
			closeFlow();
		}}
	/>
{/if}
