import type { Snippet } from 'svelte';
import { createCellSlotBinder, createSlotBinder } from '../../../../internal/bind-snippet.js';
import { useTranslator } from '../../../../i18n/index.js';
import {
	hasInteractiveAncestor,
	hasTextSelection
} from '../../../../hooks/use-clickable-container.svelte.js';
import { pixel } from '../../column-utils.js';
import { resolveContextActions } from '../../table-context-menu.svelte';
import type {
	BodyCellRenderProps,
	BodyRowRenderProps,
	HeaderCellRenderProps,
	TableColumn,
	TablePlugin
} from '../../table-types.js';
import {
	afterRowFragment,
	chevronDownIcon,
	chevronRightIcon,
	expandedPanel,
	expansionCell,
	type AfterRowArg,
	type ExpandedPanelArg,
	type ExpansionCellArg
} from './row-expansion-slots.svelte';
import {
	expansionChevronCellStyle,
	expansionChevronHeaderCellStyle,
	expansionClickableRowStyle,
	expansionExpandedRowCellStyle
} from './row-expansion.stylex.js';

/**
 * Ported from Astryx's
 * `Table/plugins/rowExpansion/useTableRowExpansion.tsx`.
 *
 * ## Rewritten at upstream 0.4.1 (PR #4609) — this is a breaking change
 *
 * The plugin used to draw hierarchy: a flat array of rows plus `getChildren` /
 * `getDepth`, indented child cells, an expand-all header toggle, an optional
 * whole-row click target. All of that now belongs to `useTableTreeData` +
 * `useTableTreeState`, and `useTableRowExpansion` owns **one full-width detail
 * panel below the expanded row** and nothing else.
 *
 * Gone from the config, with no compatibility layer: `getChildren`, `getDepth`,
 * `hasRowClickExpansion`, `isAllExpanded`, `onToggleExpandAll`. Added and
 * **required**: `renderExpanded`. `getIsItemExpandable`'s default flips from
 * "has children" to `true`. `useTableRowExpansionState` is deleted outright —
 * `packages/cli/assets/codemods/transforms/v0.4.0/` carries the migration.
 *
 * The pipeline follows suit: `transformColumns` still prepends the synthetic
 * `__expansion` column but no longer wraps the first user column,
 * `transformHeaderCell` is gone with the expand-all toggle, and
 * `transformBodyRow` builds the panel instead of a row click handler.
 *
 * ## What has no counterpart, and is deleted
 *
 * - **`useMemo` / `useCallback`.** Upstream memoises the plugin object and the
 *   expansion column so a re-render does not hand `BaseTable` a new identity.
 *   The config arrives here as a **getter**, so a closure over it is stable and
 *   live at once: the plugin object is built once for the component's lifetime
 *   and every read of `expandedKeys`, `renderExpanded`, … happens at call time.
 *   There is nothing left to memoise and no dependency array to keep honest.
 *
 * ## What does keep a ref counterpart
 *
 * **`columnCountRef`.** Unlike the `firstUserColumnKeyRef` this file used to
 * carry — written and read inside a single `transformColumns` call, so a local
 * variable — the column count is written in `transformColumns` and read in
 * `transformBodyRow`, which are *different* passes of the pipeline. It is a
 * `let` in the hook's closure, one per hook call as `useRef` is one per
 * component instance, and `transformColumns` runs first (`base-table.svelte`
 * resolves its columns before it renders a body row) so the panel's `colSpan` is
 * correct on the first render rather than one pass behind.
 *
 * The documented limit of the keyed binders applies to it: the panel's argument
 * is a derived over the reads its getter performs, and the count is a plain
 * `let`, so a `columns` prop that changes *while a row is expanded* updates the
 * count without waking that derived. See "What this still does not cover" in
 * `internal/bind-snippet.ts`.
 *
 * ## What changes shape
 *
 * - **Three slots are markup, and a `.ts` hook cannot author a snippet.** Each
 *   is a module-exported snippet from `row-expansion-slots.svelte`, bound
 *   through the **keyed** binders in `internal/bind-snippet.ts`: `expansionCell`
 *   through `createCellSlotBinder` (because `TableColumn.renderCell` is
 *   `Snippet<[T]>` and the row has to be folded into the bound argument), the
 *   panel and the `afterRow` composition through `createSlotBinder`, keyed by
 *   **row key**. The keying is not cosmetic: `{@render}` branches on a snippet's
 *   function identity, so an unkeyed binding hands it a fresh function on every
 *   transform and *replaces* the subtree — dropping focus out of the chevron a
 *   keyboard user just pressed, and out of anything focusable the consumer put
 *   in the panel. Upstream never meets this, because React reconciles by
 *   type-and-key (and keys the panel `${key}-expanded` for exactly this reason).
 * - **Returning `null` from `renderCell` becomes a flag.** Upstream skips the
 *   chevron for a non-expandable row by returning `null`;
 *   `ExpansionCellArg.isVisible` carries the guard and the snippet renders
 *   nothing when it is false.
 * - **`<>{props.afterRow}{panel}</>` becomes a snippet.** A fragment is not a
 *   value here, so the composition is its own module snippet over
 *   `{previous?, panel}` — and it is keyed for the same focus reason as the rest.
 *
 * The plugin holds no state, so this is a plain `.ts` module.
 */

// =============================================================================
// Config
// =============================================================================

/**
 * Configuration for useTableRowExpansion (detail-panel mode).
 *
 * The consumer owns expansion state; the plugin provides the chevron UI, the
 * full-width detail panel rendered below an expanded row, and a right-click
 * "Expand/Collapse row" action.
 */
export interface UseTableRowExpansionConfig<T extends Record<string, unknown>> {
	/** Set of currently-expanded row keys. */
	expandedKeys: Set<string>;
	/** Called with a row key when its expansion is toggled. */
	onToggle: (key: string) => void;
	/** Derive a stable unique key from a row item. */
	getRowKey: (item: T) => string;
	/**
	 * Render the detail content shown in a full-width panel below the row when
	 * it is expanded. Receives the row's item.
	 *
	 * `(item: T) => ReactNode` upstream; a `Snippet<[T]>` here, which is the
	 * standing translation for a render prop (`Table.renderCell`'s is the same).
	 */
	renderExpanded: Snippet<[T]>;
	/**
	 * Control which rows are expandable. Non-expandable rows show no chevron, no
	 * context-menu action, and never render a panel. @default all rows expandable
	 */
	getIsItemExpandable?: (item: T) => boolean;
	/**
	 * Background behind the detail panel.
	 *
	 * - `transparent` (default): the panel paints nothing and takes whatever
	 *   surface is behind the table.
	 * - `muted`: a wash marking the panel as commentary on the row above rather
	 *   than another row of data.
	 * @default 'transparent'
	 */
	panelVariant?: 'muted' | 'transparent';
	/**
	 * Toggle a row by clicking anywhere on it, not only on its chevron.
	 *
	 * Pointer-only convenience layered over the chevron: keyboard and
	 * assistive-tech users toggle via the chevron button (which stays the
	 * accessible control).
	 * @default false (only the chevron toggles expansion).
	 */
	hasRowClickExpansion?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Expansion column key. Upstream's verbatim — `BaseTable` never inspects it, but this plugin does. */
const EXPANSION_COLUMN_KEY = '__expansion';

const EXPANSION_COLUMN_WIDTH = pixel(40);

// =============================================================================
// Hook
// =============================================================================

/**
 * Returns a {@link TablePlugin} that expands a full-width detail panel below a
 * row.
 *
 * The consumer owns the `expandedKeys` set; the plugin adds a leading chevron
 * column, a right-click expand/collapse action, and renders `renderExpanded`
 * in a full-width panel below each expanded row.
 *
 * For hierarchical data (child rows sharing the parent columns) use
 * `useTableTreeData` + `useTableTreeState` instead.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   let expandedKeys = $state(new Set<string>());
 *   const expansion = useTableRowExpansion<Order>(() => ({
 *     expandedKeys,
 *     onToggle: (key) => {
 *       const next = new Set(expandedKeys);
 *       next.has(key) ? next.delete(key) : next.add(key);
 *       expandedKeys = next;
 *     },
 *     getRowKey: (item) => item.id,
 *     renderExpanded: orderDetails
 *   }));
 * </script>
 * {#snippet orderDetails(order: Order)}<OrderDetails {order} />{/snippet}
 * <Table data={orders} {columns} idKey="id" plugins={{ expansion }} />
 * ```
 */
export function useTableRowExpansion<T extends Record<string, unknown>>(
	config: () => UseTableRowExpansionConfig<T>
): TablePlugin<T> {
	const t = useTranslator();

	// Bound once per hook call, keyed: each chevron and each panel must keep its
	// element identity across an expand/collapse, or clicking a chevron by
	// keyboard destroys the very button that has focus. See the keyed binders'
	// notes in `internal/bind-snippet.ts`.
	const bindExpansionCell = createCellSlotBinder<T, ExpansionCellArg>(expansionCell);
	const bindExpandedPanel = createSlotBinder<ExpandedPanelArg>(expandedPanel);
	const bindAfterRow = createSlotBinder<AfterRowArg>(afterRowFragment);

	// Final rendered column count, captured in transformColumns (pipeline step
	// 1) and read in transformBodyRow for the detail panel's colSpan. Upstream's
	// `useRef(1)`; see the module header for why this one *does* need a ref
	// counterpart where `firstUserColumnKeyRef` did not.
	let columnCount = 1;

	// Upstream destructures the config once per render and closes over the
	// results; here every read goes back through the getter, which is what keeps
	// one plugin object correct for the component's whole lifetime.
	const isItemExpandable = (item: T): boolean => config().getIsItemExpandable?.(item) ?? true;

	const rowToggleLabel = (isExpanded: boolean): string =>
		isExpanded
			? t('@astryx.tableRowExpansion.collapseRow')
			: t('@astryx.tableRowExpansion.expandRow');

	const expansionColumn: TableColumn<T> = {
		key: EXPANSION_COLUMN_KEY,
		header: '',
		width: EXPANSION_COLUMN_WIDTH,
		resizable: false,
		renderCell: bindExpansionCell(EXPANSION_COLUMN_KEY, (item) => {
			const { expandedKeys, getRowKey } = config();
			const key = getRowKey(item);
			const isExpanded = expandedKeys.has(key);
			return {
				// Upstream's `return null` for a row `getIsItemExpandable` rejects.
				isVisible: isItemExpandable(item),
				isExpanded,
				onToggle: () => config().onToggle(key),
				ariaLabel: rowToggleLabel(isExpanded)
			};
		})
	};

	return {
		transformColumns(columns: TableColumn<T>[]) {
			const withExpansion = [expansionColumn, ...columns];
			columnCount = withExpansion.length;
			return withExpansion;
		},

		transformHeaderCell(
			props: HeaderCellRenderProps,
			column: TableColumn<T>
		): HeaderCellRenderProps {
			// Keep the chevron column at its fixed width.
			return column.key === EXPANSION_COLUMN_KEY
				? { ...props, xstyle: [...props.xstyle, expansionChevronHeaderCellStyle] }
				: props;
		},

		transformBodyCell(
			props: BodyCellRenderProps,
			column: TableColumn<T>,
			item: T
		): BodyCellRenderProps {
			// Contribute the expand/collapse action on every cell; BaseTable
			// aggregates them into one menu per row. Skip non-expandable rows.
			if (!isItemExpandable(item)) {
				return props;
			}

			const { expandedKeys, getRowKey } = config();
			const key = getRowKey(item);
			const isExpanded = expandedKeys.has(key);
			const priorActions = props.contextMenuActions;
			return {
				...props,
				xstyle: [
					...props.xstyle,
					// The chevron centres itself in its column.
					...(column.key === EXPANSION_COLUMN_KEY ? [expansionChevronCellStyle] : []),
					// Hand the row divider to the panel below, so the line closes the
					// row-plus-panel pair instead of splitting it.
					...(isExpanded ? [expansionExpandedRowCellStyle] : [])
				],
				contextMenuActions: () => [
					...resolveContextActions(priorActions),
					{
						id: 'row-expansion-toggle',
						group: 'row-expansion',
						label: rowToggleLabel(isExpanded),
						icon: isExpanded ? chevronDownIcon : chevronRightIcon,
						onSelect: () => config().onToggle(key)
					}
				]
			};
		},

		transformBodyRow(props: BodyRowRenderProps, item: T): BodyRowRenderProps {
			if (!isItemExpandable(item)) {
				return props;
			}
			const { expandedKeys, getRowKey, hasRowClickExpansion, panelVariant } = config();
			const key = getRowKey(item);
			// The row a glide measures from, found again after the commit.
			const keyed: BodyRowRenderProps = {
				...props,
				htmlProps: { ...props.htmlProps, 'data-expansion-key': key }
			};

			// Whole-row-click expansion (opt-in), applied before the collapsed
			// early return: a collapsed row is precisely the one a click has to
			// reach, since opening it is the whole point.
			const isExpanded = expandedKeys.has(key);
			const withClick: BodyRowRenderProps = hasRowClickExpansion
				? {
						...keyed,
						htmlProps: {
							...keyed.htmlProps,
							onclick: (event: MouseEvent) => {
								// Don't hijack clicks on interactive cell content or a text
								// selection. Both rules come from `useClickableContainer`, the
								// same pair every clickable surface in the system uses.
								const row = event.currentTarget as HTMLElement;
								const target = event.target;
								if (!(target instanceof Element)) {
									return;
								}
								if (target !== row && hasInteractiveAncestor(target, row)) {
									return;
								}
								// A click inside a contenteditable region is an edit action,
								// not a row toggle.
								if (
									target !== row &&
									target.closest('[contenteditable]:not([contenteditable="false"])')
								) {
									return;
								}
								if (hasTextSelection(row)) {
									return;
								}
								(keyed.htmlProps.onclick as ((e: MouseEvent) => void) | undefined)?.(event);
								config().onToggle(key);
							}
						},
						xstyle: [...(keyed.xstyle ?? []), expansionClickableRowStyle]
					}
				: keyed;

			if (!isExpanded) {
				return withClick;
			}

			// Upstream's `key={`${key}-expanded`}` on the panel `<tr>` is what this
			// binder key spells: one identity per row, for the life of the table.
			const panel = bindExpandedPanel(`${key}-expanded`, () => ({
				item,
				columnCount,
				isMuted: panelVariant === 'muted',
				renderExpanded: config().renderExpanded as unknown as Snippet<[Record<string, unknown>]>
			}));

			const previous = props.afterRow;
			return {
				...withClick,
				afterRow: previous ? bindAfterRow(`${key}-after-row`, () => ({ previous, panel })) : panel
			};
		}
	};
}
