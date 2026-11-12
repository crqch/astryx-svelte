<!--
	Ported from upstream's `assets/templates/pages/table-collapsible/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The import below is
	upstream's with the package name changed.

	Charts. Upstream draws each expanded row's value history with `recharts`; it
	is drawn inline here, driven by upstream's own recharts props:

	  `<ResponsiveContainer height={132}>` → a `bind:clientWidth` wrapper
	  `<AreaChart margin={{top: 4, right: 4}}>` → `detailPlot`, below
	  `<XAxis domain ticks tickFormatter>` → `axisTicks` + day labels
	  `<ReferenceLine y={data[0].value}>`  → one dashed horizontal rule at the
	                                        window's opening value
	  `<YAxis hide domain={['dataMin','dataMax']}>` → no axis; the scale is the
	                                        window's own min/max
	  `<Tooltip content>`                  → group-synced pointer tracking, the
	                                        default `#ccc` cursor line and
	                                        `detailTooltip`
	  `<Area type="linear">`               → one `<polyline>`-equivalent path
	                                        plus a closing baseline for the fill

	Upstream's `syncId={group}` is ported as `detailHover[group]`, so pointing at
	a date in one open row draws the cursor and the reading on every other open
	row of that category — sound for the same reason it is upstream: every
	account in a group is sampled over the same window.

	No chart animates: the `Area` sets `isAnimationActive={false}`. The
	Skeleton-before-chart gate upstream uses to keep the row-open animation off
	the chart mount is ported with the same `openDurationMs` walk; this port's
	`Collapsible` content has no `grid-template-rows` transition (collapse is
	`display: none`, chevron only), so the walk returns 0 and the chart settles
	immediately — upstream's own `duration === 0` branch.

	`Figure`, `CompactValueCell`, `ChangeCell`, `UtilizationCell`,
	`AccountGroup`, `GroupTable`, `DetailChart` are local sub-components
	upstream; here they are snippets. The four `useTableSortableState` /
	`useTableSortable` / `useTableRowExpansion` calls stay at component init, one
	set per group, because a snippet cannot own hook state; each sort config's
	data is re-sliced when `range` changes, which is upstream's `useMemo` key.
-->
<script lang="ts">
	import {
		Badge,
		Button,
		Card,
		Collapsible,
		HStack,
		Heading,
		Icon,
		Layout,
		LayoutContent,
		LayoutHeader,
		ProgressBar,
		SegmentedControl,
		SegmentedControlItem,
		Skeleton,
		StackItem,
		Table,
		Text,
		Token,
		VStack,
		pixel,
		proportional,
		useTableRowExpansion,
		useTableSortable,
		useTableSortableState,
		type TableColumn,
		type TableSortComparator
	} from '@astryx-sv/core';
	import type { Attachment } from 'svelte/attachments';
	import type { Component, Snippet } from 'svelte';
	import {
		ArrowsRightLeftIcon,
		BuildingLibraryIcon,
		CreditCardIcon,
		PresentationChartLineIcon
	} from '@fvilers/heroicons-svelte/24/outline';

	// ============= SHARED VOCABULARY =============

	/** Everything the page-level machinery needs from a row, whatever group it is
	 * in: an id to key its history by, and the drift that history follows. */
	interface AccountRecord extends Record<string, unknown> {
		id: string;
		/** Direction and strength of the account's drift, as a daily fraction. Feeds
		 * the generated history, so an account's chart and its Change agree. */
		trend: number;
	}

	// Pinned locale keeps the rendered output identical in every environment.
	const currency = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	});

	function money(cents: number): string {
		return currency.format(cents / 100);
	}

	function sum<T>(rows: T[], pick: (row: T) => number): number {
		return rows.reduce((total, row) => total + pick(row), 0);
	}

	// ============= TIME RANGE =============

	const RANGE_IDS = ['1W', '1M', '3M', 'YTD', '1Y'] as const;
	type RangeId = (typeof RANGE_IDS)[number];

	/** Pinned so the generated series, the axis labels and the "as of" dates are
	 * the same on every render and in every environment. */
	const TODAY = Date.UTC(2025, 8, 30);

	const RANGE_DAYS: Record<RangeId, number> = {
		'1W': 7,
		'1M': 30,
		'3M': 90,
		// Days elapsed in the pinned year, so YTD means what it says on this date.
		YTD: 273,
		'1Y': 365
	};

	const SERIES_DAYS = RANGE_DAYS['1Y'];

	const dayFormat = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});

	function dayLabel(daysAgo: number): string {
		const date = new Date(TODAY);
		date.setUTCDate(date.getUTCDate() - daysAgo);
		return dayFormat.format(date);
	}

	/** FNV-1a over the account id, so each account's walk is its own but stable. */
	function seedFrom(id: string): number {
		let hash = 2166136261;
		for (let index = 0; index < id.length; index++) {
			hash ^= id.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
	}

	/**
	 * A year of daily values ending at the account's current figure.
	 *
	 * Built backwards from today so the last point is always the real number on
	 * the row — the alternative is a series that drifts to something close to it
	 * and a table that disagrees with its own chart. xorshift rather than
	 * `Math.random` because a template that renders differently on the server and
	 * the client is a hydration error waiting to happen.
	 */
	function historyFor<T extends AccountRecord>(
		rows: T[],
		pick: (row: T) => number,
		volatility: number
	): Array<[string, number[]]> {
		return rows.map((row) => {
			let state = seedFrom(row.id) || 1;
			const random = () => {
				state ^= state << 13;
				state ^= state >>> 17;
				state ^= state << 5;
				return ((state >>> 0) % 10000) / 10000 - 0.5;
			};

			const series = new Array<number>(SERIES_DAYS);
			let value = pick(row);
			series[SERIES_DAYS - 1] = value;
			for (let day = SERIES_DAYS - 2; day >= 0; day--) {
				value /= 1 + row.trend + random() * volatility;
				series[day] = Math.max(1, Math.round(value));
			}
			return [row.id, series];
		});
	}

	function windowOf(id: string, range: RangeId): number[] {
		return HISTORY[id].slice(-RANGE_DAYS[range]);
	}

	/**
	 * The Change column is a percentage, not an amount. Four groups whose headline
	 * figures span two orders of magnitude cannot be compared in dollars — a
	 * $5,000 move is most of a vendor card and a rounding error on the treasury
	 * sweep. A percentage is the one form of "how much did this move" that means
	 * the same thing in every one of these tables, which is what makes it worth a
	 * column in all four.
	 */
	function changePercentOf(id: string, range: RangeId): number {
		const points = windowOf(id, range);
		const start = points[0];
		if (start === 0) {
			return 0;
		}
		return ((points[points.length - 1] - start) / Math.abs(start)) * 100;
	}

	const percentFormat = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	// ============= CHART VOCABULARY =============

	const UP_COLOR = 'var(--color-data-categorical-green, #0B991F)';
	const DOWN_COLOR = 'var(--color-data-categorical-red, #F5394F)';
	const GRID_COLOR = 'var(--color-border, rgba(5, 54, 89, 0.1))';
	// Text tokens rather than the categorical pair the charts stroke with: these
	// carry text contrast, which a 12px label needs and a 1.5px line does not.
	const TEXT_UP_COLOR = 'var(--color-text-green, #0B991F)';
	const TEXT_DOWN_COLOR = 'var(--color-text-red, #F5394F)';
	const AXIS_TICK = 'font-size: var(--font-size-sm, 12px); fill: var(--color-text-secondary, #4E606F);';

	/** Tooltips and readouts have no room for cents. */
	const wholeCurrency = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	/** Five evenly spaced dates, whether the window is a week or a year. */
	function axisTicks(count: number): number[] {
		const stops = Math.min(5, count);
		if (stops < 2) {
			return [0];
		}
		return Array.from({ length: stops }, (_, stop) =>
			Math.round((stop * (count - 1)) / (stops - 1))
		);
	}

	/**
	 * The width of the box the cards are laid out in, tracked as it changes.
	 *
	 * A media query answers a question about the window, and this template is not
	 * always the window: the docsite preview puts it in a dialog. `@container`
	 * asks the right question, but its answer never leaves CSS and what changes
	 * here is the column *list*, which only script can do — so the box is
	 * measured. `offsetWidth` for the first read rather than
	 * `getBoundingClientRect`: the observer reports the box as laid out and
	 * ignores an ancestor transform, while the rect bakes it in.
	 */
	function useSurfaceWidth() {
		let width = $state(0);
		const attach: Attachment<HTMLElement> = (node) => {
			width = node.offsetWidth;
			const observer = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) {
					width = entry.contentRect.width;
				}
			});
			observer.observe(node);
			return () => observer.disconnect();
		};
		return {
			attach,
			get width() {
				return width;
			}
		};
	}

	/**
	 * Below this the widest table — credit cards, carrying three money columns
	 * and a change — has less room than its fixed widths ask for, and every table
	 * switches together so the four cards stay legible as one page rather than
	 * four differently-shaped ones.
	 */
	const COMPACT_BELOW_PX = 720;

	// ============= GROUP 1 — BANK ACCOUNTS =============

	interface BankAccount extends AccountRecord {
		name: string;
		institution: string;
		mask: string;
		kind: 'Checking' | 'Savings' | 'Money market';
		availableCents: number;
	}

	const BANK_ACCOUNTS: BankAccount[] = [
		{
			id: 'bank-1',
			name: 'Operating',
			institution: 'First Meridian Bank',
			mask: '••4417',
			kind: 'Checking',
			availableCents: 84_215_600,
			trend: 0.00022
		},
		{
			id: 'bank-2',
			name: 'Payroll',
			institution: 'First Meridian Bank',
			mask: '••8830',
			kind: 'Checking',
			availableCents: 21_940_800,
			trend: 0.00004
		},
		{
			id: 'bank-3',
			name: 'Tax reserve',
			institution: 'Harborline Credit Union',
			mask: '••1265',
			kind: 'Savings',
			availableCents: 47_500_000,
			trend: 0.00009
		},
		{
			id: 'bank-4',
			name: 'Treasury sweep',
			institution: 'Northgate Financial',
			mask: '••7702',
			kind: 'Money market',
			availableCents: 132_800_000,
			trend: 0.00033
		}
	];

	const bankComparators: Partial<Record<string, TableSortComparator<BankAccount>>> = {
		name: (a, b) => a.name.localeCompare(b.name),
		kind: (a, b) => a.kind.localeCompare(b.kind),
		available: (a, b) => a.availableCents - b.availableCents
	};

	// ============= GROUP 2 — CREDIT CARDS =============

	interface CreditCardAccount extends AccountRecord {
		name: string;
		issuer: string;
		mask: string;
		balanceCents: number;
		limitCents: number;
	}

	const CREDIT_CARDS: CreditCardAccount[] = [
		{
			id: 'card-1',
			name: 'Corporate — Engineering',
			issuer: 'Meridian Business Card',
			mask: '••2041',
			balanceCents: 4_182_300,
			limitCents: 15_000_000,
			trend: 0.00042
		},
		{
			id: 'card-2',
			name: 'Corporate — Travel',
			issuer: 'Meridian Business Card',
			mask: '••6688',
			balanceCents: 9_640_500,
			limitCents: 12_000_000,
			trend: 0.00071
		},
		{
			id: 'card-3',
			name: 'Vendor payments',
			issuer: 'Northgate Commercial',
			mask: '••3319',
			balanceCents: 1_205_000,
			limitCents: 25_000_000,
			trend: -0.00018
		}
	];

	const creditCardComparators: Partial<Record<string, TableSortComparator<CreditCardAccount>>> = {
		name: (a, b) => a.name.localeCompare(b.name),
		// Utilization is a ratio, not a balance — sorting it by balance would put a
		// maxed-out small card below a barely-touched large one.
		utilization: (a, b) => a.balanceCents / a.limitCents - b.balanceCents / b.limitCents,
		balance: (a, b) => a.balanceCents - b.balanceCents,
		limit: (a, b) => a.limitCents - b.limitCents
	};

	// ============= GROUP 3 — PAYMENT PROCESSORS =============

	interface ProcessorAccount extends AccountRecord {
		name: string;
		merchantId: string;
		pendingPayoutCents: number;
		feesMtdCents: number;
	}

	const PROCESSORS: ProcessorAccount[] = [
		{
			id: 'proc-1',
			name: 'Stripe',
			merchantId: 'acct_1Qf82LmR',
			pendingPayoutCents: 18_442_900,
			feesMtdCents: 612_400,
			trend: 0.00058
		},
		{
			id: 'proc-2',
			name: 'PayPal Commerce',
			merchantId: 'MRC-88214-XT',
			pendingPayoutCents: 3_218_650,
			feesMtdCents: 148_900,
			trend: -0.00024
		},
		{
			id: 'proc-3',
			name: 'Adyen',
			merchantId: 'AD-NORTHWIND-01',
			pendingPayoutCents: 7_905_100,
			feesMtdCents: 233_050,
			trend: 0.00031
		}
	];

	const processorComparators: Partial<Record<string, TableSortComparator<ProcessorAccount>>> = {
		name: (a, b) => a.name.localeCompare(b.name),
		pendingPayout: (a, b) => a.pendingPayoutCents - b.pendingPayoutCents,
		feesMtd: (a, b) => a.feesMtdCents - b.feesMtdCents
	};

	// ============= GROUP 4 — INVESTMENT ACCOUNTS =============

	interface InvestmentAccount extends AccountRecord {
		name: string;
		custodian: string;
		marketValueCents: number;
		costBasisCents: number;
	}

	const INVESTMENTS: InvestmentAccount[] = [
		{
			id: 'inv-1',
			name: 'Short-duration treasuries',
			custodian: 'Northgate Asset Management',
			marketValueCents: 245_180_000,
			costBasisCents: 240_000_000,
			trend: 0.00012
		},
		{
			id: 'inv-2',
			name: 'Corporate bond ladder',
			custodian: 'Northgate Asset Management',
			marketValueCents: 98_420_000,
			costBasisCents: 100_000_000,
			trend: -0.00006
		},
		{
			id: 'inv-3',
			name: 'Money market fund',
			custodian: 'Harborline Capital',
			marketValueCents: 61_050_000,
			costBasisCents: 61_000_000,
			trend: 0.00003
		}
	];

	const investmentComparators: Partial<Record<string, TableSortComparator<InvestmentAccount>>> = {
		name: (a, b) => a.name.localeCompare(b.name),
		marketValue: (a, b) => a.marketValueCents - b.marketValueCents,
		costBasis: (a, b) => a.costBasisCents - b.costBasisCents
	};

	/** Every row id on the page, so a page-level control can address the details
	 * and not just the cards holding them. */
	const ALL_ROW_IDS = [
		...BANK_ACCOUNTS,
		...CREDIT_CARDS,
		...PROCESSORS,
		...INVESTMENTS
	].map((record) => record.id);

	// ============= DERIVED HISTORY =============

	/**
	 * A year of daily values per account. Built once at module scope: the numbers
	 * are a pure function of the pinned data, so recomputing them per render would
	 * be work with no possible different answer.
	 *
	 * The volatilities differ by group because the accounts do. A payout balance
	 * that empties on a schedule is genuinely choppier than a bond ladder, and
	 * giving them the same noise makes every chart on the page the same chart.
	 */
	const HISTORY: Record<string, number[]> = Object.fromEntries([
		...historyFor(BANK_ACCOUNTS, (account) => account.availableCents, 0.014),
		...historyFor(CREDIT_CARDS, (card) => card.balanceCents, 0.016),
		...historyFor(PROCESSORS, (processor) => processor.pendingPayoutCents, 0.04),
		...historyFor(INVESTMENTS, (account) => account.marketValueCents, 0.008)
	]);

	// ============= DETAIL PANEL =============

	const CHART_HEIGHT = 132;
	const DETAIL_MARGIN = { top: 4, right: 4, left: 0 };
	const DETAIL_X_AXIS_HEIGHT = 30;

	const GROUP_IDS = ['bank', 'cards', 'processors', 'investments'] as const;
	type GroupId = (typeof GROUP_IDS)[number];

	const detailWidths = $state<Record<string, number>>({});
	const detailHover = $state<Record<string, number | null>>({});
	const detailSettled = $state<Record<string, boolean>>({});

	/**
	 * How long the row this content sits in takes to open.
	 *
	 * The animating element is an ancestor, so its `transitionend` never reaches
	 * us — bubbling runs child to parent. Walking up to read the duration off
	 * whichever ancestor actually carries the transition costs one pass and keeps
	 * this honest: reduced motion zeroes the token and a theme override changes
	 * it, and both are picked up without knowing a class name.
	 */
	function openDurationMs(from: HTMLElement | null): number {
		for (let el = from; el; el = el.parentElement) {
			const style = getComputedStyle(el);
			if (style.transitionProperty.includes('grid-template-rows')) {
				return parseFloat(style.transitionDuration) * 1000;
			}
		}
		return 0;
	}

	// One attachment per fixture row, created once: a closure rebuilt every render
	// would detach and restart the timer on every hover anywhere on the page.
	const detailAttachments: Record<string, Attachment<HTMLElement>> = {};
	for (const id of ALL_ROW_IDS) {
		detailAttachments[id] = (node) => {
			const duration = openDurationMs(node);
			// Nothing to protect when there is no animation.
			if (duration === 0) {
				detailSettled[id] = true;
				return;
			}
			const timer = setTimeout(() => (detailSettled[id] = true), duration);
			return () => clearTimeout(timer);
		};
	}

	function scale(value: number, d0: number, d1: number, r0: number, r1: number): number {
		return d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
	}

	function onDetailMove(event: PointerEvent, group: GroupId, id: string) {
		const width = detailWidths[id] ?? 0;
		if (width <= 0) return;
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - bounds.left;
		const plotRight = width - DETAIL_MARGIN.right;
		const points = windowOf(id, range);
		if (plotRight <= 0) return;
		const day = scale(x, DETAIL_MARGIN.left, plotRight, 0, points.length - 1);
		const index = Math.round(day);
		detailHover[group] = Math.max(0, Math.min(points.length - 1, index));
	}

	// ============= STATE =============

	const surface = useSurfaceWidth();

	let openGroups = $state(new Set<GroupId>(GROUP_IDS));
	// Lifted out of the chart because it is not the chart's setting — it is the
	// page's. Year to date is the default because it is the window accounts are
	// actually reasoned about in, and it is long enough that a monthly cycle
	// shows up several times rather than once or twice.
	let range = $state<RangeId>('YTD');
	// One Set for all four tables, not one per group. Row ids are unique across the
	// page, so a single Set is unambiguous, and it is what a "collapse every open
	// detail" control or a persisted view would need to read.
	let expandedRows = $state(new Set<string>());

	function toggleRow(key: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(expandedRows);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		expandedRows = next;
	}

	function toggleGroup(id: GroupId, open: boolean) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(openGroups);
		if (open) {
			next.add(id);
		} else {
			next.delete(id);
		}
		openGroups = next;
	}

	const totals = (() => {
		const banks = sum(BANK_ACCOUNTS, (account) => account.availableCents);
		const cards = sum(CREDIT_CARDS, (card) => card.balanceCents);
		const pending = sum(PROCESSORS, (p) => p.pendingPayoutCents);
		const investments = sum(INVESTMENTS, (i) => i.marketValueCents);
		return {
			banks,
			cards,
			pending,
			investments,
			// Outstanding card balances are a liability, so they come off the top.
			net: banks + pending + investments - cards
		};
	})();

	// Zero is the width before the first measurement, not a narrow box, and
	// treating it as narrow would flash the compact tables on every mount.
	const isCompact = $derived(surface.width > 0 && surface.width < COMPACT_BELOW_PX);

	// "All open" has to mean the details too. A control labelled Expand all that
	// opens four cards and leaves thirteen collapsed rows inside them has not
	// expanded all, and its next click would read as Collapse all while most of
	// the page is still shut.
	const isEverythingOpen = $derived(
		openGroups.size === GROUP_IDS.length && expandedRows.size === ALL_ROW_IDS.length
	);

	function toggleEverything() {
		const open = !isEverythingOpen;
		openGroups = open ? new Set(GROUP_IDS) : new Set();
		expandedRows = open ? new Set(ALL_ROW_IDS) : new Set();
	}

	// Change is the one column whose value is not in the row — it is derived from
	// the page's range. A range switch has to hand the sort state a different
	// array or the rows would keep the order computed from the old window while
	// showing figures from the new one.
	const bankRows = $derived.by(() => {
		void range;
		return BANK_ACCOUNTS.slice();
	});
	const creditCardRows = $derived.by(() => {
		void range;
		return CREDIT_CARDS.slice();
	});
	const processorRows = $derived.by(() => {
		void range;
		return PROCESSORS.slice();
	});
	const investmentRows = $derived.by(() => {
		void range;
		return INVESTMENTS.slice();
	});

	const bankSortState = useTableSortableState<BankAccount>(() => ({
		data: bankRows,
		comparators: {
			...bankComparators,
			change: (a, b) => changePercentOf(a.id, range) - changePercentOf(b.id, range)
		}
	}));
	const bankSort = useTableSortable<BankAccount>(() => bankSortState.sortConfig);

	const creditCardSortState = useTableSortableState<CreditCardAccount>(() => ({
		data: creditCardRows,
		comparators: {
			...creditCardComparators,
			change: (a, b) => changePercentOf(a.id, range) - changePercentOf(b.id, range)
		}
	}));
	const creditCardSort = useTableSortable<CreditCardAccount>(
		() => creditCardSortState.sortConfig
	);

	const processorSortState = useTableSortableState<ProcessorAccount>(() => ({
		data: processorRows,
		comparators: {
			...processorComparators,
			change: (a, b) => changePercentOf(a.id, range) - changePercentOf(b.id, range)
		}
	}));
	const processorSort = useTableSortable<ProcessorAccount>(() => processorSortState.sortConfig);

	const investmentSortState = useTableSortableState<InvestmentAccount>(() => ({
		data: investmentRows,
		comparators: {
			...investmentComparators,
			change: (a, b) => changePercentOf(a.id, range) - changePercentOf(b.id, range)
		}
	}));
	const investmentSort = useTableSortable<InvestmentAccount>(
		() => investmentSortState.sortConfig
	);

	const bankExpansion = useTableRowExpansion<BankAccount>(() => ({
		expandedKeys: expandedRows,
		onToggle: toggleRow,
		getRowKey: (item) => item.id,
		renderExpanded: bankDetail
	}));
	const creditCardExpansion = useTableRowExpansion<CreditCardAccount>(() => ({
		expandedKeys: expandedRows,
		onToggle: toggleRow,
		getRowKey: (item) => item.id,
		renderExpanded: creditCardDetail
	}));
	const processorExpansion = useTableRowExpansion<ProcessorAccount>(() => ({
		expandedKeys: expandedRows,
		onToggle: toggleRow,
		getRowKey: (item) => item.id,
		renderExpanded: processorDetail
	}));
	const investmentExpansion = useTableRowExpansion<InvestmentAccount>(() => ({
		expandedKeys: expandedRows,
		onToggle: toggleRow,
		getRowKey: (item) => item.id,
		renderExpanded: investmentDetail
	}));

	const bankColumns = $derived.by<TableColumn<BankAccount>[]>(() => [
		{
			key: 'name',
			sortable: true,
			header: 'Account',
			width: proportional(2),
			renderCell: bankNameCell
		},
		{
			key: 'kind',
			sortable: true,
			header: 'Type',
			width: pixel(150),
			renderCell: bankKindCell
		},
		{
			key: 'available',
			sortable: true,
			header: 'Available',
			width: pixel(150),
			align: 'end',
			renderCell: bankAvailableCell
		},
		{
			key: 'change',
			sortable: true,
			header: 'Change',
			width: pixel(110),
			align: 'end',
			renderCell: bankChangeCell
		}
	]);

	// The name cell is reused rather than restated, so the two layouts cannot
	// drift apart in the one column they share.
	const bankCompactColumns = $derived.by<TableColumn<BankAccount>[]>(() => [
		bankColumns[0],
		{
			key: 'available',
			sortable: true,
			header: 'Available',
			width: pixel(150),
			align: 'end',
			renderCell: bankCompactValueCell
		}
	]);

	const creditCardColumns = $derived.by<TableColumn<CreditCardAccount>[]>(() => [
		{
			key: 'name',
			sortable: true,
			header: 'Card',
			width: proportional(2),
			renderCell: creditCardNameCell
		},
		// Utilization sits where every other group puts its qualifier — bank's type,
		// the processor's merchant id — so the money columns start at the same place
		// in all four tables and the eye can run straight down the page.
		{
			key: 'utilization',
			sortable: true,
			header: 'Utilization',
			width: pixel(150),
			renderCell: creditCardUtilizationCell
		},
		{
			key: 'balance',
			sortable: true,
			header: 'Balance',
			width: pixel(150),
			align: 'end',
			renderCell: creditCardBalanceCell
		},
		{
			key: 'limit',
			sortable: true,
			header: 'Limit',
			width: pixel(150),
			align: 'end',
			renderCell: creditCardLimitCell
		},
		{
			key: 'change',
			sortable: true,
			header: 'Change',
			width: pixel(110),
			align: 'end',
			// The only group whose Change column is read inversely: a balance that
			// grew is a debt that grew.
			renderCell: creditCardChangeCell
		}
	]);

	const creditCardCompactColumns = $derived.by<TableColumn<CreditCardAccount>[]>(() => [
		creditCardColumns[0],
		{
			key: 'balance',
			sortable: true,
			header: 'Balance',
			width: pixel(150),
			align: 'end',
			renderCell: creditCardCompactValueCell
		}
	]);

	const processorColumns = $derived.by<TableColumn<ProcessorAccount>[]>(() => [
		{
			key: 'name',
			sortable: true,
			header: 'Processor',
			width: proportional(2),
			renderCell: processorNameCell
		},
		{
			key: 'pendingPayout',
			sortable: true,
			header: 'Pending payout',
			width: pixel(150),
			align: 'end',
			renderCell: processorPendingCell
		},
		{
			key: 'feesMtd',
			sortable: true,
			header: 'Fees (MTD)',
			width: pixel(150),
			align: 'end',
			renderCell: processorFeesCell
		},
		{
			key: 'change',
			sortable: true,
			header: 'Change',
			width: pixel(110),
			align: 'end',
			renderCell: processorChangeCell
		}
	]);

	const processorCompactColumns = $derived.by<TableColumn<ProcessorAccount>[]>(() => [
		processorColumns[0],
		{
			key: 'pendingPayout',
			sortable: true,
			header: 'Pending payout',
			width: pixel(150),
			align: 'end',
			renderCell: processorCompactValueCell
		}
	]);

	const investmentColumns = $derived.by<TableColumn<InvestmentAccount>[]>(() => [
		{
			key: 'name',
			sortable: true,
			header: 'Account',
			width: proportional(2),
			renderCell: investmentNameCell
		},
		{
			key: 'marketValue',
			sortable: true,
			header: 'Market value',
			width: pixel(150),
			align: 'end',
			renderCell: investmentMarketCell
		},
		{
			key: 'costBasis',
			sortable: true,
			header: 'Cost basis',
			width: pixel(150),
			align: 'end',
			renderCell: investmentCostCell
		},
		{
			key: 'change',
			sortable: true,
			header: 'Change',
			width: pixel(110),
			align: 'end',
			renderCell: investmentChangeCell
		}
	]);

	const investmentCompactColumns = $derived.by<TableColumn<InvestmentAccount>[]>(() => [
		investmentColumns[0],
		{
			key: 'marketValue',
			sortable: true,
			header: 'Market value',
			width: pixel(150),
			align: 'end',
			renderCell: investmentCompactValueCell
		}
	]);
</script>

<!-- ============= CELL PIECES ============= -->

{#snippet figure(value: string)}
	<Text hasTabularNumbers>{value}</Text>
{/snippet}

{#snippet compactValueCell(
	id: string,
	amountCents: number,
	isLiability: boolean
)}
	{@const percent = changePercentOf(id, range)}
	{@const isUp = percent >= 0}
	{@const isGood = isLiability ? !isUp : isUp}
	<VStack gap={0} hAlign="end">
		{@render figure(money(amountCents))}
		<!-- Colour on the row so the icon and the figure inherit one value, rather
		     than being told the same thing twice — Text has no success or error of
		     its own to be told with. -->
		<HStack
			gap={0.5}
			vAlign="center"
			style="color: {isGood ? TEXT_UP_COLOR : TEXT_DOWN_COLOR};"
		>
			<Icon icon={isUp ? 'arrowUp' : 'arrowDown'} size="xsm" color="inherit" />
			<Text type="supporting" color="inherit">
				{percentFormat.format(Math.abs(percent))}%
			</Text>
		</HStack>
	</VStack>
{/snippet}

{#snippet changeCell(id: string, isLiability: boolean)}
	{@const percent = changePercentOf(id, range)}
	{@const isUp = percent >= 0}
	{@const isGood = isLiability ? !isUp : isUp}
	<!-- A Token is a flex box and fills the cell, so `text-align` from the column's
	     align cannot place it — the row does that here instead. -->
	<HStack hAlign="end">
		<Token
			size="sm"
			color={isGood ? 'green' : 'red'}
			label={`${isUp ? '+' : '−'}${percentFormat.format(Math.abs(percent))}%`}
		/>
	</HStack>
{/snippet}

{#snippet utilizationCell(card: CreditCardAccount)}
	{@const percent = Math.round((card.balanceCents / card.limitCents) * 100)}
	<HStack gap={2} vAlign="center">
		<StackItem size="fill">
			<ProgressBar
				label={`${card.name} utilization`}
				isLabelHidden
				value={percent}
				variant="neutral"
			/>
		</StackItem>
		<Text hasTabularNumbers>{percent}%</Text>
	</HStack>
{/snippet}

<!-- ============= GROUP 1 CELLS ============= -->

{#snippet bankNameCell(account: BankAccount)}
	<VStack gap={0}>
		<Text>{account.name}</Text>
		<Text type="supporting">{account.institution} · {account.mask}</Text>
	</VStack>
{/snippet}

{#snippet bankKindCell(account: BankAccount)}
	<Text>{account.kind}</Text>
{/snippet}

{#snippet bankAvailableCell(account: BankAccount)}
	{@render figure(money(account.availableCents))}
{/snippet}

{#snippet bankChangeCell(account: BankAccount)}
	{@render changeCell(account.id, false)}
{/snippet}

{#snippet bankCompactValueCell(account: BankAccount)}
	{@render compactValueCell(account.id, account.availableCents, false)}
{/snippet}

{#snippet bankDetail(account: BankAccount)}
	{@render detailChart(account.id, 'bank', false)}
{/snippet}

<!-- ============= GROUP 2 CELLS ============= -->

{#snippet creditCardNameCell(card: CreditCardAccount)}
	<VStack gap={0}>
		<Text>{card.name}</Text>
		<Text type="supporting">{card.issuer} · {card.mask}</Text>
	</VStack>
{/snippet}

{#snippet creditCardUtilizationCell(card: CreditCardAccount)}
	{@render utilizationCell(card)}
{/snippet}

{#snippet creditCardBalanceCell(card: CreditCardAccount)}
	{@render figure(money(card.balanceCents))}
{/snippet}

{#snippet creditCardLimitCell(card: CreditCardAccount)}
	{@render figure(money(card.limitCents))}
{/snippet}

{#snippet creditCardChangeCell(card: CreditCardAccount)}
	{@render changeCell(card.id, true)}
{/snippet}

{#snippet creditCardCompactValueCell(card: CreditCardAccount)}
	{@render compactValueCell(card.id, card.balanceCents, true)}
{/snippet}

{#snippet creditCardDetail(card: CreditCardAccount)}
	{@render detailChart(card.id, 'cards', true)}
{/snippet}

<!-- ============= GROUP 3 CELLS ============= -->

{#snippet processorNameCell(processor: ProcessorAccount)}
	<VStack gap={0}>
		<Text>{processor.name}</Text>
		<Text type="supporting">{processor.merchantId}</Text>
	</VStack>
{/snippet}

{#snippet processorPendingCell(processor: ProcessorAccount)}
	{@render figure(money(processor.pendingPayoutCents))}
{/snippet}

{#snippet processorFeesCell(processor: ProcessorAccount)}
	{@render figure(money(processor.feesMtdCents))}
{/snippet}

{#snippet processorChangeCell(processor: ProcessorAccount)}
	{@render changeCell(processor.id, false)}
{/snippet}

{#snippet processorCompactValueCell(processor: ProcessorAccount)}
	{@render compactValueCell(processor.id, processor.pendingPayoutCents, false)}
{/snippet}

{#snippet processorDetail(processor: ProcessorAccount)}
	{@render detailChart(processor.id, 'processors', false)}
{/snippet}

<!-- ============= GROUP 4 CELLS ============= -->

{#snippet investmentNameCell(account: InvestmentAccount)}
	<VStack gap={0}>
		<Text>{account.name}</Text>
		<Text type="supporting">{account.custodian}</Text>
	</VStack>
{/snippet}

{#snippet investmentMarketCell(account: InvestmentAccount)}
	{@render figure(money(account.marketValueCents))}
{/snippet}

{#snippet investmentCostCell(account: InvestmentAccount)}
	{@render figure(money(account.costBasisCents))}
{/snippet}

{#snippet investmentChangeCell(account: InvestmentAccount)}
	{@render changeCell(account.id, false)}
{/snippet}

{#snippet investmentCompactValueCell(account: InvestmentAccount)}
	{@render compactValueCell(account.id, account.marketValueCents, false)}
{/snippet}

{#snippet investmentDetail(account: InvestmentAccount)}
	{@render detailChart(account.id, 'investments', false)}
{/snippet}

<!-- ============= DETAIL PANEL ============= -->

{#snippet detailTooltip(label: string, point: number, color: string)}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{label}</Text>
			<HStack gap={2} vAlign="center">
				<span class="swatch" style="background-color: {color};"></span>
				<Text weight="semibold" hasTabularNumbers>{wholeCurrency.format(point)}</Text>
			</HStack>
		</VStack>
	</Card>
{/snippet}

{#snippet detailChart(id: string, group: GroupId, isLiability: boolean)}
	{@const points = windowOf(id, range)}
	{@const data = points.map((value, day) => ({
		day,
		label: dayLabel(points.length - 1 - day),
		value: value / 100
	}))}
	{@const delta = points[points.length - 1] - points[0]}
	{@const isGood = isLiability ? delta <= 0 : delta >= 0}
	{@const color = isGood ? UP_COLOR : DOWN_COLOR}
	{@const ticks = axisTicks(data.length)}
	<!-- One gradient per account, because two charts sharing a fill id take
	     whichever definition the DOM happens to hold — and open two rows of
	     opposite sign and that is a green area under a red line. -->
	{@const fillId = `detail-fill-${id}`}
	{@const width = detailWidths[id] ?? 0}
	{@const min = Math.min(...data.map((d) => d.value))}
	{@const max = Math.max(...data.map((d) => d.value))}
	{@const plot = {
		left: DETAIL_MARGIN.left,
		right: width - DETAIL_MARGIN.right,
		top: DETAIL_MARGIN.top,
		bottom: CHART_HEIGHT - DETAIL_X_AXIS_HEIGHT
	}}
	{@const x = (day: number) => scale(day, 0, data.length - 1, plot.left, plot.right)}
	{@const y = (value: number) => scale(value, min, max, plot.bottom, plot.top)}
	{@const linePoints = data.map((d) => `${x(d.day)},${y(d.value)}`).join(' ')}
	{@const areaPath =
		`M${x(0)},${plot.bottom}` +
		data.map((d) => `L${x(d.day)},${y(d.value)}`).join('') +
		`L${x(data.length - 1)},${plot.bottom}Z`}
	{@const hoveredIndex = detailHover[group] ?? null}
	{@const hoveredPoint =
		hoveredIndex === null || hoveredIndex >= data.length ? null : data[hoveredIndex]}
	<div class="detail-host" {@attach detailAttachments[id]}>
		{#if !detailSettled[id]}
			<Skeleton width="100%" height={CHART_HEIGHT} radius={2} />
		{:else}
			<div
				class="chart"
				role="presentation"
				style="height: {CHART_HEIGHT}px;"
				bind:clientWidth={detailWidths[id]}
				onpointermove={(event) => onDetailMove(event, group, id)}
				onpointerleave={() => (detailHover[group] = null)}
			>
				{#if width > 0}
					<svg width={width} height={CHART_HEIGHT} aria-hidden="true">
						<defs>
							<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color={color} stop-opacity="0.2" />
								<stop offset="100%" stop-color={color} stop-opacity="0" />
							</linearGradient>
						</defs>
						<!-- No CartesianGrid and no axis line. A rule at every Y tick reads
						     as a table ruled behind a table, and an axis line at the bottom
						     marks the frame rather than anything in the data. The one rule
						     worth drawing is where the window opened: everything above it is
						     the gain the Change column reports, everything below the loss. -->
						<line
							x1={plot.left}
							x2={plot.right}
							y1={y(data[0].value)}
							y2={y(data[0].value)}
							stroke={GRID_COLOR}
							stroke-dasharray="3 3"
						/>
						<path d={areaPath} fill={`url(#${fillId})`} />
						<polyline points={linePoints} fill="none" stroke={color} stroke-width="1.5" />
						{#if hoveredPoint}
							<line
								x1={x(hoveredPoint.day)}
								x2={x(hoveredPoint.day)}
								y1={plot.top}
								y2={plot.bottom}
								stroke="#ccc"
							/>
							<circle
								cx={x(hoveredPoint.day)}
								cy={y(hoveredPoint.value)}
								r="3"
								fill={color}
								stroke-width="0"
							/>
						{/if}
						{#each ticks as tick (tick)}
							<text
								x={x(tick)}
								y={plot.bottom + 20}
								text-anchor="middle"
								style={AXIS_TICK}>{data[tick]?.label ?? ''}</text
							>
						{/each}
					</svg>
				{/if}
				{#if hoveredPoint}
					<div
						class="chart-tooltip"
						style="left: {x(hoveredPoint.day)}px; top: {y(hoveredPoint.value)}px;"
					>
						{@render detailTooltip(hoveredPoint.label, hoveredPoint.value, color)}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

<!-- ============= GROUP SHELL ============= -->

{#snippet accountGroup(
	icon: Component,
	title: string,
	count: number,
	summaryLabel: string,
	summaryValue: string,
	isOpen: boolean,
	onOpenChange: (open: boolean) => void,
	children: Snippet
)}
	{#snippet groupTrigger()}
		<!-- paddingBlock, because the trigger has none of its own: its height is
		     exactly the 24px tile, so the only space above the group name was the
		     Card's 8px. The column header below it is a table cell and brings its own
		     inset, which is what made the row read as pinned to the top edge even
		     though the two gaps measured the same. -->
		<HStack gap={2} vAlign="center" hAlign="between" paddingBlock={2} paddingInline={2}>
			<HStack gap={2} vAlign="center">
				<HStack class="category-tile">
					<Icon {icon} size="sm" />
				</HStack>
				<Text weight="semibold">{title}</Text>
				<Badge variant="neutral" label={String(count)} />
			</HStack>
			<HStack gap={2} vAlign="center">
				<!-- Body rather than supporting: it is the label on the one figure a
				     collapsed group still shows, so it has to survive being read at a
				     glance from across the page. -->
				<Text color="secondary">{summaryLabel}</Text>
				<Text weight="semibold" hasTabularNumbers>{summaryValue}</Text>
			</HStack>
		</HStack>
	{/snippet}
	{#snippet groupBody()}
		<!-- The trigger is a row of text and the table opens with a row of text, so
		     without this they read as one block with a hairline in it. 12px is enough
		     to say the header is a header. -->
		<VStack paddingBlockStart={3}>
			{@render children()}
		</VStack>
	{/snippet}
	<!-- 8px on the Card and nothing on the Collapsible: one content line for the
	     header and the table both, and the table's rows then inset themselves by
	     their own cell padding on top of it. -->
	<Card padding={2}>
		<Collapsible {isOpen} {onOpenChange} trigger={groupTrigger} children={groupBody} />
	</Card>
{/snippet}

<!-- ============= PAGE ============= -->

{#snippet headerActions()}
	<HStack gap={3} vAlign="center" wrap="wrap">
		<StackItem size="fill">
			<VStack gap={0.5}>
				<Heading level={1}>Connected accounts</Heading>
				<Text type="supporting">
					Net position {money(totals.net)} across 13 accounts
				</Text>
			</VStack>
		</StackItem>
		<Button
			label={isEverythingOpen ? 'Collapse all' : 'Expand all'}
			variant="ghost"
			onclick={toggleEverything}
		/>
		<!-- The range belongs to the page, not to any one table, so it sits with the
		     page title rather than inside a card. -->
		<SegmentedControl
			value={range}
			onChange={(value) => (range = value as RangeId)}
			label="Time range"
		>
			{#each RANGE_IDS as id (id)}
				<SegmentedControlItem value={id} label={id} />
			{/each}
		</SegmentedControl>
	</HStack>
{/snippet}

{#snippet pageHeader()}
	<LayoutHeader padding={4}>
		{@render headerActions()}
	</LayoutHeader>
{/snippet}

{#snippet bankGroup()}
	{#snippet table()}
		<Table
			data={bankSortState.sortedData}
			columns={isCompact ? bankCompactColumns : bankColumns}
			idKey="id"
			density="compact"
			dividers="rows"
			plugins={{ sort: bankSort, expansion: bankExpansion }}
		/>
	{/snippet}
	{@render accountGroup(
		BuildingLibraryIcon,
		'Bank accounts',
		BANK_ACCOUNTS.length,
		'Available',
		money(totals.banks),
		openGroups.has('bank'),
		(open) => toggleGroup('bank', open),
		table
	)}
{/snippet}

{#snippet creditCardGroup()}
	{#snippet table()}
		<Table
			data={creditCardSortState.sortedData}
			columns={isCompact ? creditCardCompactColumns : creditCardColumns}
			idKey="id"
			density="compact"
			dividers="rows"
			plugins={{ sort: creditCardSort, expansion: creditCardExpansion }}
		/>
	{/snippet}
	{@render accountGroup(
		CreditCardIcon,
		'Credit cards',
		CREDIT_CARDS.length,
		'Outstanding',
		money(totals.cards),
		openGroups.has('cards'),
		(open) => toggleGroup('cards', open),
		table
	)}
{/snippet}

{#snippet processorGroup()}
	{#snippet table()}
		<Table
			data={processorSortState.sortedData}
			columns={isCompact ? processorCompactColumns : processorColumns}
			idKey="id"
			density="compact"
			dividers="rows"
			plugins={{ sort: processorSort, expansion: processorExpansion }}
		/>
	{/snippet}
	{@render accountGroup(
		ArrowsRightLeftIcon,
		'Payment processors',
		PROCESSORS.length,
		'Pending payout',
		money(totals.pending),
		openGroups.has('processors'),
		(open) => toggleGroup('processors', open),
		table
	)}
{/snippet}

{#snippet investmentGroup()}
	{#snippet table()}
		<Table
			data={investmentSortState.sortedData}
			columns={isCompact ? investmentCompactColumns : investmentColumns}
			idKey="id"
			density="compact"
			dividers="rows"
			plugins={{ sort: investmentSort, expansion: investmentExpansion }}
		/>
	{/snippet}
	{@render accountGroup(
		PresentationChartLineIcon,
		'Investment accounts',
		INVESTMENTS.length,
		'Market value',
		money(totals.investments),
		openGroups.has('investments'),
		(open) => toggleGroup('investments', open),
		table
	)}
{/snippet}

{#snippet content()}
	<LayoutContent padding={4}>
		<VStack gap={4} {@attach surface.attach}>
			{@render bankGroup()}
			{@render creditCardGroup()}
			{@render processorGroup()}
			{@render investmentGroup()}
		</VStack>
	</LayoutContent>
{/snippet}

<Layout
	height="auto"
	contentWidth={1200}
	style="background-color: var(--color-background-body);"
	header={pageHeader}
	{content}
/>

<style>
	/* Square side of the category tile in the group header. 24px is not a look, it
	   is an alignment: the tile plus the 8px gap after it is exactly the inset the
	   cells below give their own text, so the group name starts on the same x as
	   the first column's header and rows. It is also the size of the row-expansion
	   chevron buttons, and it sits at their x — so the group's disclosure and its
	   rows' disclosures form one column down the left edge of the card. */
	:global(.category-tile) {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		border-radius: var(--radius-inner);
		background-color: var(--color-background-muted);
	}

	.detail-host {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.chart {
		position: relative;
		width: 100%;
	}

	.chart-tooltip {
		position: absolute;
		pointer-events: none;
		transform: translate(12px, -50%);
		z-index: 1;
	}

	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
