<script lang="ts" module>
	import type { SearchableItem, SearchSource } from '../typeahead/types.js';
	import type { SheetDraftChange } from '../../internal/sheet-draft.js';

	export interface TokenizerBottomSheetProps<T extends SearchableItem> {
		/** Whether the sheet is open. */
		isOpen: boolean;
		/**
		 * Called with `false` when the sheet closes: Save, a clean dismissal, or a
		 * confirmed discard.
		 */
		onOpenChange: (isOpen: boolean) => void;
		/**
		 * The query this presentation starts with. The sheet is mounted only from
		 * a press until its exit completes, so the field keeps the query between
		 * mounts from what `onChangeQuery` reported: a close the field forces
		 * (becoming disabled while open) keeps it, while a close the person makes
		 * clears and reports it.
		 */
		initialQuery: string;
		/** The field label; names the sheet, the search field, and the list. */
		label: string;
		searchSource: SearchSource<T>;
		/** The committed selection; the draft the sheet edits starts from it. */
		value: T[];
		/** The selection limit, enforced on the draft. */
		maxEntries: number | undefined;
		hasCreate: boolean;
		maxMenuItems: number;
		minQueryLength: number;
		debounceMs: number;
		/** The no-results message; a string becomes the empty state's title. */
		emptySearchText?: string;
		/**
		 * Save's one report: the whole draft and the last edit that still holds.
		 * The sheet announces each edit itself when it happens; nothing is
		 * announced on Save.
		 */
		onCommit: (items: T[], change: SheetDraftChange<T>) => void;
		onChangeQuery?: (query: string) => void;
	}
</script>

<script lang="ts" generics="T extends SearchableItem">
	import { tick, untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import BottomSheet from '../bottom-sheet/bottom-sheet.svelte';
	import Button from '../button/button.svelte';
	import EmptyState from '../empty-state/empty-state.svelte';
	import PanelSearchInput from '../field/panel-search-input.svelte';
	import Icon from '../icon/icon.svelte';
	import CheckboxIndicator from '../indicator/checkbox-indicator.svelte';
	import Spinner from '../spinner/spinner.svelte';
	import Text from '../text/text.svelte';
	import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';
	import SheetConfirmation from '../../internal/sheet-confirmation.svelte';
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { warnOnce } from '../../utils/dev-warning.js';
	import { hasSameSelection, nameSheetDraftChange } from '../../internal/sheet-draft.js';
	import { useDismissSearchOnTouchDrag } from '../../internal/use-dismiss-search-on-touch-drag.js';
	import {
		sheetBodyAttrs,
		sheetCreateLabelStyle,
		sheetCreateRowAttrs,
		sheetEmptyHostAttrs,
		sheetEmptyStyle,
		sheetFooterActionStyle,
		sheetFooterAttrs,
		sheetIndicatorDisabledStyle,
		sheetListAttrs,
		sheetPendingAttrs,
		sheetRowAttrs,
		sheetRowItemAttrs,
		sheetRowLabelStyle,
		sheetRowsAttrs,
		sheetSearchFieldStyle,
		sheetSearchRowAttrs
	} from './tokenizer-bottom-sheet.stylex.js';

	/**
	 * Ported from Astryx's `Tokenizer/TokenizerBottomSheet.tsx`.
	 *
	 * One open sheet edits one draft that starts as `value`; rows, the create row
	 * and Clear all change the draft, and Save reports it once. Rows keep their
	 * position while the sheet is open: the items selected when it opened lead,
	 * in `value` order, then draft-selected items the results do not carry, then
	 * the results; the next open takes a fresh snapshot and regroups
	 * selected-first.
	 *
	 * Upstream splits the wrapper and the content so the content — search, rows,
	 * footer, and every announcement about them — renders inside the sheet's
	 * dialog. Svelte has no rule about announcements crossing a dialog boundary,
	 * and this port's `useAnnounce` regions are page-level singletons, so one
	 * file holds both halves.
	 */
	const {
		isOpen,
		onOpenChange,
		initialQuery,
		label,
		searchSource,
		value,
		maxEntries,
		hasCreate,
		maxMenuItems,
		minQueryLength,
		debounceMs,
		emptySearchText,
		onCommit,
		onChangeQuery
	}: TokenizerBottomSheetProps<T> = $props();

	const t = useTranslator();
	const announce = useAnnounce();

	/** Rows rendered per batch while a long list scrolls. */
	const LIST_RENDER_BATCH_SIZE = 50;
	/** Distance from the list's end at which the next batch renders. */
	const LIST_LOAD_MORE_THRESHOLD_PX = 200;
	/** Sentinel prefix for the create row's synthetic item. */
	const CREATABLE_ID_PREFIX = '__xds_create__';
	const EMPTY_RESULTS: never[] = [];

	const bodyAttrs = sheetBodyAttrs();
	const searchRowAttrs = sheetSearchRowAttrs();
	const listAttrs = sheetListAttrs();
	const rowsAttrs = sheetRowsAttrs();
	const rowItemAttrs = sheetRowItemAttrs();
	const createRowAttrs = sheetCreateRowAttrs();
	const footerAttrs = sheetFooterAttrs();
	const emptyHostAttrs = sheetEmptyHostAttrs();
	const pendingAttrs = sheetPendingAttrs();

	let searchEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);
	// Whether a checkbox row holds focus, kept by the list's own focus events,
	// so the hand-off below fires only when it was a row that a settled search
	// removed — not the search field or a footer action.
	let isRowFocused = false;

	// One open sheet edits one draft. The caller's `value` is unchanged until
	// Save, so a dismissal can discard cleanly; `lastDraftChange` is the edit
	// Save names when it still holds.
	// svelte-ignore state_referenced_locally
	let valueAtOpen = $state<T[]>([...value]);
	// svelte-ignore state_referenced_locally
	let draftValue = $state<T[]>([...value]);
	let lastDraftChange: SheetDraftChange<T> | null = null;
	const isDraftDirty = $derived(!hasSameSelection(valueAtOpen, draftValue));
	const selectedIds = $derived(new Set(draftValue.map((item) => item.id)));
	const isAtMax = $derived(maxEntries != null && draftValue.length >= maxEntries);
	const isDraftOverMax = $derived(maxEntries != null && draftValue.length > maxEntries);

	// Starts from the field's copy, which `onChangeQuery` keeps current, so the
	// query survives the sheet's unmount between presentations.
	// svelte-ignore state_referenced_locally
	let query = $state(initialQuery);
	let sourceResults = $state<T[]>([]);
	const trimmedQueryForSearch = $derived(query.trim());
	// A query shorter than `minQueryLength` is never searched: no source rows,
	// no busy feedback, no empty state, no outcome announcement.
	const isBelowMinQuery = $derived(
		trimmedQueryForSearch !== '' && trimmedQueryForSearch.length < minQueryLength
	);
	const results = $derived(isBelowMinQuery ? EMPTY_RESULTS : sourceResults);
	// Whether a query is one the source is asked about: empty (the bootstrap
	// set) or at least `minQueryLength`. One rule for every way a query comes to
	// be: the initial one, an open, a change.
	const willSearchFor = (trimmed: string): boolean =>
		trimmed === '' || trimmed.length >= minQueryLength;

	// Pending from open, and from each query change, until that search settles.
	// The sheet mounts already open, so its first render is its open: a kept
	// query below the threshold starts settled, not pending for a search that
	// never runs.
	// svelte-ignore state_referenced_locally
	let isPending = $state(!isOpen || willSearchFor(initialQuery.trim()));
	// Each search that runs gets a number; its outcome is announced once, keyed
	// on that number.
	let searchId = $state(0);
	let searchIdRef = 0;
	// svelte-ignore state_referenced_locally
	let announcedSearchIdRef = isOpen && !willSearchFor(initialQuery.trim()) ? 0 : -1;
	const startSearch = (): void => {
		searchIdRef += 1;
		searchId = searchIdRef;
	};

	let renderedItemCount = $state(LIST_RENDER_BATCH_SIZE);
	let seqRef = 0;
	let lastLoadScrollHeight: number | null = null;
	// svelte-ignore state_referenced_locally
	let selectedItemsAtOpen = $state<T[]>(value);

	let isClearConfirmationOpen = $state(false);
	let isDiscardConfirmationOpen = $state(false);
	let clearAllEl = $state<HTMLElement | null>(null);

	// Snapshot the selection and reset the rendered window in the render that
	// opens the sheet, so the first open frame already shows selected-first
	// order — a plain effect would paint one frame of the previous session's
	// order.
	// svelte-ignore state_referenced_locally
	let wasOpen = isOpen;
	$effect.pre(() => {
		if (isOpen === wasOpen) {
			return;
		}
		wasOpen = isOpen;
		if (isOpen) {
			selectedItemsAtOpen = value;
			valueAtOpen = [...value];
			draftValue = [...value];
			lastDraftChange = null;
			renderedItemCount = LIST_RENDER_BATCH_SIZE;
			isClearConfirmationOpen = false;
			isDiscardConfirmationOpen = false;
			// An open lists the bootstrap set, or searches a query kept across a
			// close the field forced, and that load is pending; a kept query below
			// the threshold leaves nothing pending, since no search runs for it.
			const willSearch = willSearchFor(trimmedQueryForSearch);
			isPending = willSearch;
			if (willSearch) {
				startSearch();
			} else {
				announcedSearchIdRef = searchIdRef;
			}
			lastLoadScrollHeight = null;
		}
	});

	// Synchronizes the row list with the caller's `searchSource`, an external
	// system this component does not own. The bootstrap set is requested at
	// once — on open and when the query clears — as the inline field requests
	// its focus bootstrap; only a typed query waits `debounceMs`. A pre-effect,
	// so a source that answers synchronously settles before the browser paints
	// the open commit and the Loading row never reaches the screen. Cleanup
	// clears the debounce timer so a superseded query never fetches, and the
	// sequence guard drops a response that lands after a newer request.
	$effect.pre(() => {
		if (!isOpen) {
			// Retire the closed sheet's request, so its answer never lands.
			seqRef += 1;
			return;
		}
		const trimmed = query.trim();
		const seq = ++seqRef;
		let unanswered: SearchSource<T> | null = null;
		if (trimmed !== '' && trimmed.length < minQueryLength) {
			// Not searched; the derived `results` are already empty, and taking a
			// sequence number retires a still-running search.
			return;
		}
		const settle = (items: T[]): void => {
			unanswered = null;
			if (seqRef === seq) {
				sourceResults = items.slice(0, maxMenuItems);
				isPending = false;
			}
		};
		const run = (): void => {
			let answer: T[] | PromiseLike<T[]>;
			const source = untrack(() => searchSource);
			try {
				answer = trimmed === '' ? source.bootstrap() : source.search(query);
			} catch {
				answer = [];
			}
			if (Array.isArray(answer)) {
				// An instant source settles in the same tick, before any busy
				// feedback or announcement could start.
				settle(answer);
				return;
			}
			// Anything else is awaited as a thenable — a native Promise, one from
			// another realm, or a library's — as the inline field's `await` does.
			unanswered = source;
			void Promise.resolve(answer).then(settle, () => {
				// A rejecting source settles to no results, as the inline field
				// does: the previous query's rows are not this query's answer.
				settle([]);
			});
		};
		const timer = trimmed !== '' && debounceMs > 0 ? setTimeout(run, debounceMs) : null;
		if (timer == null) {
			run();
		}
		return () => {
			if (timer != null) {
				clearTimeout(timer);
			}
			const source: SearchSource<T> | null = unanswered;
			unanswered = null;
			source?.cancel?.();
		};
	});

	const visibleItems = $derived.by<T[]>(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const matchesQuery = (item: T): boolean =>
			normalizedQuery === '' || item.label.toLowerCase().includes(normalizedQuery);
		const selectedAtOpenMatches = selectedItemsAtOpen.filter(matchesQuery);
		const selectedAtOpenIds = new Set(selectedAtOpenMatches.map((item) => item.id));
		const resultIds = new Set(results.map((item) => item.id));
		const selectedItemsMissingFromResults = draftValue.filter(
			(item) => !selectedAtOpenIds.has(item.id) && !resultIds.has(item.id) && matchesQuery(item)
		);

		// Selection changes update checkbox state without moving an existing row.
		// The next open snapshots the latest value and applies selected-first order.
		return [
			...selectedAtOpenMatches,
			...selectedItemsMissingFromResults,
			...results.filter((item) => !selectedAtOpenIds.has(item.id))
		];
	});

	const renderedItems = $derived(visibleItems.slice(0, renderedItemCount));

	// A settled search may remove the row that holds focus: it was listed from
	// the previous search and is not in this one. Focus would fall to the page
	// body behind the modal; the search field takes it instead.
	$effect(() => {
		if (!isOpen || isPending || !isRowFocused) {
			return;
		}
		// Track the rendered window: a search that removes the focused row
		// changes it.
		void renderedItems.length;
		const active = document.activeElement;
		if (active == null || active === document.body) {
			isRowFocused = false;
			searchEl?.focus();
		}
	});

	// The pending Spinner stays named, as the inline field's does, but is not a
	// live region; the sheet announces each busy start once.
	let hasAnnouncedBusy = false;
	$effect(() => {
		if (!(isOpen && isPending)) {
			hasAnnouncedBusy = false;
			return;
		}
		if (hasAnnouncedBusy) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			hasAnnouncedBusy = true;
			announce(t('@astryx.typeahead.loading'));
		});
		return () => cancelAnimationFrame(frame);
	});

	const trimmedQuery = $derived(query.trim());
	const createItem = $derived.by<T | null>(() => {
		// Judged against this query's own results: while the search is pending
		// `results` still hold the previous query's rows, and a create row then
		// could offer a value the source already has.
		if (!hasCreate || trimmedQuery === '' || isAtMax || isPending) {
			return null;
		}
		const lowered = trimmedQuery.toLowerCase();
		if (
			selectedIds.has(trimmedQuery) ||
			draftValue.some((item) => item.label.toLowerCase() === lowered) ||
			results.some((item) => item.label.toLowerCase() === lowered)
		) {
			return null;
		}
		return {
			id: `${CREATABLE_ID_PREFIX}${trimmedQuery}`,
			label: t('@astryx.tokenizer.create', { value: trimmedQuery })
		} as unknown as T;
	});

	const resetListWindow = (): void => {
		lastLoadScrollHeight = null;
		renderedItemCount = LIST_RENDER_BATCH_SIZE;
	};

	function handleQueryChange(next: string): void {
		resetListWindow();
		const willSearch = willSearchFor(next.trim());
		// A search still unsettled from the previous query is retired
		// unannounced, so "0 results" is never said for a query that was never
		// searched. Only a query that runs gets a search number.
		isPending = willSearch;
		if (willSearch) {
			startSearch();
		} else {
			announcedSearchIdRef = searchIdRef;
		}
		query = next;
		onChangeQuery?.(next);
	}

	/** Close the sheet as the person's own act, clearing and reporting the query. */
	function closeSheet(): void {
		if (query !== '') {
			query = '';
			onChangeQuery?.('');
		}
		onOpenChange(false);
	}

	// A swipe, scrim or Escape close asks first while the draft is changed.
	function handleOpenChange(next: boolean): void {
		if (next) {
			onOpenChange(true);
		} else if (isDraftDirty) {
			isDiscardConfirmationOpen = true;
		} else {
			closeSheet();
		}
	}

	function handleSave(): void {
		if (isDraftOverMax) {
			return;
		}
		const change = isDraftDirty
			? nameSheetDraftChange(valueAtOpen, draftValue, lastDraftChange)
			: null;
		if (change != null) {
			onCommit([...draftValue], change);
		}
		closeSheet();
	}

	function handleCreate(): void {
		const createdItem = { id: trimmedQuery, label: trimmedQuery } as T;
		draftValue = [...draftValue, createdItem];
		lastDraftChange = { item: createdItem, type: 'create' };
		// The created value, as the inline field announces it; the item's label
		// is the row's caption ("Create …").
		announce(t('@astryx.tokenizer.tokenAdded', { label: trimmedQuery }));
		// The same path a typed change takes, so the bootstrap reload shows its
		// pending state and reports the change.
		handleQueryChange('');
		// The row this control sits on is gone with the query; the search field
		// is where the next value starts.
		searchEl?.focus();
	}

	function toggleRow(item: T, rowDisabled: boolean): void {
		if (rowDisabled) {
			return;
		}
		if (selectedIds.has(item.id)) {
			draftValue = draftValue.filter((selected) => selected.id !== item.id);
			lastDraftChange = { item, type: 'remove' };
			announce(t('@astryx.tokenizer.tokenRemoved', { label: item.label }));
		} else {
			draftValue = [...draftValue, item];
			lastDraftChange = { item, type: 'add' };
			announce(t('@astryx.tokenizer.tokenAdded', { label: item.label }));
		}
	}

	function handleListScroll(event: Event): void {
		const list = event.currentTarget as HTMLDivElement;
		const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
		if (
			distanceFromBottom <= LIST_LOAD_MORE_THRESHOLD_PX &&
			lastLoadScrollHeight !== list.scrollHeight
		) {
			lastLoadScrollHeight = list.scrollHeight;
			renderedItemCount = Math.min(renderedItemCount + LIST_RENDER_BATCH_SIZE, visibleItems.length);
		}
	}

	async function closeClearConfirmation(confirmed: boolean): Promise<void> {
		isClearConfirmationOpen = false;
		// The confirmation must be gone before focus moves into the sheet and
		// the words are announced.
		await tick();
		clearAllEl?.focus();
		if (confirmed) {
			announce(t('@astryx.tokenizer.allRemoved'));
		}
	}

	async function closeDiscardConfirmation(): Promise<void> {
		isDiscardConfirmationOpen = false;
		// Keep editing: the confirmation is gone, and focus returns to the search
		// field, where the sheet's own reading order starts.
		await tick();
		searchEl?.focus({ preventScroll: true });
	}

	const listDragProps = useDismissSearchOnTouchDrag(
		() => [searchEl],
		() => listEl?.closest<HTMLElement>('[tabindex="-1"]')
	);

	const searchLabel = $derived(t('@astryx.tokenizer.search', { label }));
	const isQueryEmpty = $derived(trimmedQuery === '');
	// An empty state only once the search has settled; while pending the busy
	// row above stands in for it.
	const isSettledEmpty = $derived(
		!isPending &&
			!isBelowMinQuery &&
			!isQueryEmpty &&
			visibleItems.length === 0 &&
			createItem == null
	);
	const isSettledBlank = $derived(
		!isPending &&
			!isBelowMinQuery &&
			isQueryEmpty &&
			visibleItems.length === 0 &&
			createItem == null
	);
	const noResultsTitle = $derived(emptySearchText ?? t('@astryx.typeahead.emptySearchResults'));

	// How each search ended, once per settle, keyed on the search's number. The
	// empty state's words are rendered content: the default EmptyState
	// announces its own title and description once when it appears, so the
	// sheet speaks nothing for it.
	$effect(() => {
		if (!isOpen || isPending || announcedSearchIdRef === searchId) {
			return;
		}
		announcedSearchIdRef = searchId;
		if (!isSettledEmpty && !isQueryEmpty) {
			// The rows the sheet lists for this query — the source's results,
			// capped by maxMenuItems, selected items the source did not return,
			// such as a created value, and the create row when it is offered — as
			// the inline field announces the entries it shows.
			announce(
				t('@astryx.typeahead.resultCount', {
					count: visibleItems.length + (createItem == null ? 0 : 1)
				})
			);
		}
	});

	// Clear all is aria-disabled after a clear but stays focusable, so it keeps
	// focus; a reference to its element is all the focus move needs.
	const clearAllAttachment = {
		[createAttachmentKey()]: (node: HTMLElement) => {
			clearAllEl = node;
			return () => {
				clearAllEl = null;
			};
		}
	};
</script>

{#snippet emptyIcon()}
	<Icon icon="search" size="lg" color="secondary" />
{/snippet}

<BottomSheet {isOpen} onOpenChange={handleOpenChange} {label} height="tall" padding={0}>
	<div class={bodyAttrs.class} style={bodyAttrs.style}>
		<div class={searchRowAttrs.class} style={searchRowAttrs.style}>
			<PanelSearchInput
				bind:ref={searchEl}
				label={searchLabel}
				clearLabel={t('@astryx.textInput.clearLabel', { label: searchLabel })}
				placeholder={t('@astryx.tokenizer.searchPlaceholder')}
				value={query}
				onValueChange={handleQueryChange}
				hasInputBox
				fieldXstyle={sheetSearchFieldStyle}
			/>
		</div>
		<!--
			The sheet's own content area is already a group named by the label;
			naming this list the same would announce it twice.
		-->
		<div
			bind:this={listEl}
			class={listAttrs.class}
			style={listAttrs.style}
			aria-busy={isPending || undefined}
			data-rendered-count={renderedItems.length}
			data-total-count={visibleItems.length}
			{...listDragProps}
			onfocusin={(event) => {
				isRowFocused =
					event.target instanceof HTMLElement && event.target.getAttribute('role') === 'checkbox';
			}}
			onfocusout={(event) => {
				// A row unmounted while focused fires no blur, so a blur that does
				// arrive is a real move elsewhere.
				if (event.relatedTarget != null) {
					isRowFocused = false;
				}
			}}
			onscroll={handleListScroll}
		>
			{#if createItem}
				<div class={createRowAttrs.class} style={createRowAttrs.style}>
					<Text type="body" xstyle={sheetCreateLabelStyle}>
						{createItem.label}
					</Text>
					<Button
						label={t('@astryx.tokenizer.add')}
						aria-label={t('@astryx.tokenizer.addValue', { value: trimmedQuery })}
						variant="secondary"
						size="lg"
						onclick={handleCreate}
					/>
				</div>
			{/if}
			{#if isPending}
				<!--
					Named busy feedback while the source works, above any rows
					still listed from the previous search; the empty states wait
					for it.
				-->
				<div class={pendingAttrs.class} style={pendingAttrs.style}>
					<Spinner size="md" role="img" aria-label={t('@astryx.typeahead.loading')} />
				</div>
			{/if}
			{#if isSettledEmpty}
				<div class={emptyHostAttrs.class} style={emptyHostAttrs.style}>
					<EmptyState
						icon={emptyIcon}
						title={noResultsTitle}
						description={t('@astryx.tokenizer.noResultsDescription')}
						isCompact
						xstyle={sheetEmptyStyle}
					/>
				</div>
			{:else if isSettledBlank}
				<!-- An empty query that lists nothing shows only the search
					field: nothing has failed, typing is what finds items. -->
			{:else}
				<!--
					A list of items: each listitem carries its place in the whole
					set, not the rendered window, so a person moving through the
					rows hears "n of total" and learns more exist before the list
					has scrolled. The position attributes live on the listitem
					because `checkbox` does not admit them.
				-->
				<div role="list" class={rowsAttrs.class} style={rowsAttrs.style}>
					{#each renderedItems as item, index (item.id)}
						{@const isSelected = selectedIds.has(item.id)}
						{@const rowDisabled = !isSelected && isAtMax}
						{@const isLastRendered = index === renderedItems.length - 1}
						{@const rowAttrs = sheetRowAttrs(rowDisabled)}
						<div
							role="listitem"
							aria-setsize={visibleItems.length}
							aria-posinset={index + 1}
							class={rowItemAttrs.class}
							style={rowItemAttrs.style}
						>
							<button
								type="button"
								role="checkbox"
								aria-checked={isSelected}
								aria-label={item.label}
								aria-disabled={rowDisabled || undefined}
								onfocus={() => {
									// Focus reaching the last rendered row renders the
									// next batch, so Tab and arrow keys reach every row
									// without a scroll.
									if (isLastRendered && renderedItems.length < visibleItems.length) {
										renderedItemCount = Math.min(
											renderedItemCount + LIST_RENDER_BATCH_SIZE,
											visibleItems.length
										);
									}
								}}
								onclick={() => toggleRow(item, rowDisabled)}
								class={rowAttrs.class}
								style={rowAttrs.style}
							>
								<Text
									type="body"
									color={rowDisabled ? 'inherit' : undefined}
									xstyle={sheetRowLabelStyle}
								>
									{item.label}
								</Text>
								<CheckboxIndicator
									state={isSelected ? 'checked' : 'unchecked'}
									size="md"
									isDisabled={rowDisabled}
									xstyle={rowDisabled ? sheetIndicatorDisabledStyle : undefined}
								/>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div class={footerAttrs.class} style={footerAttrs.style}>
			<Button
				label={t('@astryx.tokenizer.clearAll')}
				variant="secondary"
				size="lg"
				isDisabled={draftValue.length === 0}
				// With a tooltip, Button uses aria-disabled, so Clear all stays
				// focusable after a clear and says why it does nothing.
				tooltip={draftValue.length === 0 ? t('@astryx.tokenizer.nothingToClear') : undefined}
				{...clearAllAttachment}
				onclick={() => {
					isClearConfirmationOpen = true;
				}}
				xstyle={sheetFooterActionStyle}
			/>
			<Button
				label={t('@astryx.tokenizer.save')}
				variant="primary"
				size="lg"
				isDisabled={isDraftOverMax}
				// Over the limit Save keeps its tab stop and says why it waits.
				tooltip={isDraftOverMax
					? t('@astryx.tokenizer.selectionLimit', { count: maxEntries ?? 0 })
					: undefined}
				onclick={handleSave}
				xstyle={sheetFooterActionStyle}
			/>
		</div>
		{#if isClearConfirmationOpen}
			<SheetConfirmation
				isOpen
				onOpenChange={(next) => {
					if (!next) {
						void closeClearConfirmation(false);
					}
				}}
				title={t('@astryx.tokenizer.clearAllTitle')}
				description={t('@astryx.tokenizer.clearAllDescription', { label })}
				cancelLabel={t('@astryx.alertDialog.cancel')}
				actionLabel={t('@astryx.tokenizer.clearSelection')}
				onAction={() => {
					// A clear is a removal of the draft's last item, for Save's
					// `remove` when it is the last edit that holds.
					const lastItem = draftValue[draftValue.length - 1];
					if (lastItem != null) {
						draftValue = [];
						lastDraftChange = { item: lastItem, type: 'remove' };
					}
					void closeClearConfirmation(true);
				}}
			/>
		{/if}
		{#if isDiscardConfirmationOpen}
			<SheetConfirmation
				isOpen
				onOpenChange={(next) => {
					if (!next) {
						void closeDiscardConfirmation();
					}
				}}
				title={t('@astryx.tokenizer.discardChangesTitle')}
				description={t('@astryx.tokenizer.discardChangesDescription', { label })}
				cancelLabel={t('@astryx.tokenizer.keepEditing')}
				actionLabel={t('@astryx.tokenizer.discardChanges')}
				onAction={() => {
					isDiscardConfirmationOpen = false;
					closeSheet();
				}}
			/>
		{/if}
	</div>
</BottomSheet>
