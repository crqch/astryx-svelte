<!--
	Ported from upstream's `assets/templates/pages/dashboard-cohort-funnel/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed, so each glyph is the one upstream
	draws rather than a stand-in from core's 28-name `Icon` registry.

	Charts. Upstream draws with `recharts`, a React-only library — there is no
	Svelte build of it, and adding one is not something a scaffolded template may
	assume. Both chart shapes are therefore drawn inline, driven by upstream's
	own recharts props so the mapping stays auditable:

	  `<ResponsiveContainer height={260}>`     → a `bind:clientWidth` wrapper
	  `<BarChart layout="vertical">`          → `funnelPlot`; category bands are
	                                             `bandSize` tall, and
	                                             `barCategoryGap={10}` insets each
	                                             bar 10px from its band, which is
	                                             recharts' `getPercentValue` on a
	                                             numeric gap (20px between bars)
	  `<CartesianGrid vertical>`              → one `<line>` per X tick
	  `<XAxis type="number">`                 → `funnelX` + `<text>` labels
	  `<YAxis type="category" width={110}>`   → `funnelY` + `<text>` labels
	  `<Bar radius={4}>` with one `<Cell>`    → one `<rect rx="4">` per bar
	  `<Tooltip cursor={{fill}}>`             → the hovered band's `<rect>` +
	                                             `funnelTooltip`
	  `<LineChart margin>`                    → `trendPlot`
	  `<CartesianGrid horizontal>`            → one `<line>` per Y tick
	  `<XAxis domain ticks tickFormatter>`    → `trendX` + `<text>` labels
	  `<YAxis width unit>`                    → `trendY` + `<text>` labels
	  `<Tooltip cursor={{stroke}}>`           → pointer tracking + the vertical
	                                             line at the hovered week +
	                                             `trendTooltip`
	  `<Line type="linear" strokeWidth={1.5}>`→ one `<polyline>` per series

	Axes with no `ticks`/`domain` declare only `[0, 'auto']`, so recharts derives
	the ticks and extends the domain to the last one: `niceTicks` below is its
	`getNiceTickValues([0, max], 5, true, 'adaptive')`, checked against recharts
	3.10.1. That covers the funnel's numeric X axis, the trend's Y axis, and the
	trend's X axis, whose explicit ticks are labelled from `TREND`.

	Every colour, domain, tick, stroke width, margin and height below is
	upstream's literal value. Upstream passes tick styling as `tick={{fontSize,
	fill}}`; here it lands as an inline `style` on the `<text>`, which is where a
	CSS `var()` actually resolves. `Icon`'s `color` prop only takes semantic
	names, so a legend swatch's series colour is an inline `style` — upstream's
	`dotStyle`, same reason.

	One positional difference: recharts anchors its tooltip to the pointer and
	clamps it inside the plot, while this one is anchored to the hovered bar end
	or week (the `dashboard` template's technique). Content, trigger and
	dismissal match.

	`LegendDot`, `KpiTile`, `FunnelTooltip`, `ConversionFunnel`, `FunnelSteps`,
	`ConversionTrend`, `SectionHeading` are local sub-components upstream; here
	they are snippets. `buildCohortColumns` becomes `cohortColumns`, with one
	snippet per week because a column's `renderCell` takes only the row.
-->
<script lang="ts">
	import {
		Button,
		Card,
		Divider,
		Grid,
		HStack,
		Heading,
		Icon,
		Layout,
		LayoutContent,
		LayoutHeader,
		SegmentedControl,
		SegmentedControlItem,
		Selector,
		Table,
		Text,
		Token,
		VStack,
		pixel,
		type TableColumn
	} from '@astryx-sv/core';
	import {
		ArrowDownIcon,
		ArrowDownTrayIcon,
		ArrowTrendingDownIcon,
		ArrowUpIcon
	} from '@fvilers/heroicons-svelte/24/outline';
	import { StopIcon } from '@fvilers/heroicons-svelte/24/solid';

	// ============= TYPES =============

	type Segment = 'all' | 'web' | 'ios' | 'android';
	type FunnelWindow = '7d' | '30d' | '90d';

	interface FunnelStage {
		key: string;
		label: string;
		// Absolute users entering this stage, per segment.
		users: Record<Segment, number>;
	}

	interface FunnelBar {
		key: string;
		label: string;
		users: number;
		pctOfTop: number;
		stepPct: number | null;
		color: string;
	}

	interface TrendPoint {
		t: number;
		label: string;
		signup: number;
		activate: number;
		subscribe: number;
	}

	interface Cohort {
		label: string;
		size: number;
		// Retention % by week index (week 0 = 100 by definition).
		retention: number[];
	}

	interface CohortRow extends Record<string, unknown> {
		id: string;
		label: string;
		size: number;
		retention: number[];
	}

	interface Kpi {
		key: string;
		label: string;
		value: string;
		delta: number;
		higherIsBetter: boolean;
	}

	// ============= COLORS (design tokens w/ hex fallbacks) =============

	const COLORS = {
		blue: 'var(--color-data-categorical-blue, #0171E3)',
		green: 'var(--color-data-categorical-green, #0B991F)',
		orange: 'var(--color-data-categorical-orange, #EB6E00)',
		purple: 'var(--color-data-categorical-purple, #6B1EFD)',
		teal: 'var(--color-data-categorical-teal, #08A3A3)'
	};
	const GRID_STROKE = 'var(--color-border, rgba(5, 54, 89, 0.1))';
	const TICK_STYLE =
		'font-size: var(--font-size-sm, 12px); fill: var(--color-text-secondary, #4E606F);';

	// Funnel bars step through the categorical palette top-to-bottom.
	const FUNNEL_COLORS = [COLORS.blue, COLORS.teal, COLORS.green, COLORS.orange, COLORS.purple];

	// ============= FUNNEL DATA =============

	// Window multipliers applied to the base (30d) stage counts.
	const WINDOW_FACTOR: Record<FunnelWindow, number> = {
		'7d': 0.24,
		'30d': 1,
		'90d': 3.1
	};

	const FUNNEL_STAGES: FunnelStage[] = [
		{
			key: 'visit',
			label: 'Visited site',
			users: { all: 128400, web: 82600, ios: 27300, android: 18500 }
		},
		{
			key: 'signup',
			label: 'Signed up',
			users: { all: 41200, web: 24800, ios: 9600, android: 6800 }
		},
		{
			key: 'activate',
			label: 'Activated',
			users: { all: 22600, web: 12900, ios: 5900, android: 3800 }
		},
		{
			key: 'subscribe',
			label: 'Subscribed',
			users: { all: 9100, web: 5100, ios: 2600, android: 1400 }
		},
		{
			key: 'retain',
			label: 'Retained 30d',
			users: { all: 6300, web: 3600, ios: 1850, android: 850 }
		}
	];

	// ============= CONVERSION-OVER-TIME =============

	// Weekly stage-conversion rates (%). Signup->activate->subscribe.
	//
	// Shaped as a plausible growth story rather than a smooth ramp, so the chart
	// reads like real telemetry: a W7 pricing test lifts paid conversion, a W9-W10
	// onboarding regression sinks activation until a fix ships, a W15 acquisition
	// campaign spikes signups with low-intent traffic (activation dips as signup
	// peaks, and the two series cross), W18 is an outage week that knocks all three
	// down together, and W19+ recovers to a net-upward trend.
	const TREND: TrendPoint[] = [
		{ t: 0, label: 'W1', signup: 30.1, activate: 52.4, subscribe: 38.2 },
		{ t: 1, label: 'W2', signup: 31.4, activate: 54.1, subscribe: 36.9 },
		{ t: 2, label: 'W3', signup: 29.2, activate: 51.2, subscribe: 39.8 },
		{ t: 3, label: 'W4', signup: 32.6, activate: 55.8, subscribe: 37.1 },
		{ t: 4, label: 'W5', signup: 28.4, activate: 53.6, subscribe: 40.4 },
		{ t: 5, label: 'W6', signup: 31.8, activate: 56.2, subscribe: 38.3 },
		{ t: 6, label: 'W7', signup: 33.5, activate: 54.3, subscribe: 44.6 },
		{ t: 7, label: 'W8', signup: 30.2, activate: 57.1, subscribe: 42.1 },
		{ t: 8, label: 'W9', signup: 34.1, activate: 48.9, subscribe: 37.4 },
		{ t: 9, label: 'W10', signup: 29.6, activate: 46.2, subscribe: 35.2 },
		{ t: 10, label: 'W11', signup: 32.9, activate: 50.4, subscribe: 38.9 },
		{ t: 11, label: 'W12', signup: 35.4, activate: 55.6, subscribe: 41.3 },
		{ t: 12, label: 'W13', signup: 31.1, activate: 57.3, subscribe: 39.2 },
		{ t: 13, label: 'W14', signup: 33.8, activate: 54.8, subscribe: 42.8 },
		{ t: 14, label: 'W15', signup: 41.2, activate: 49.6, subscribe: 40.1 },
		{ t: 15, label: 'W16', signup: 38.6, activate: 47.8, subscribe: 36.4 },
		{ t: 16, label: 'W17', signup: 30.4, activate: 53.2, subscribe: 39.7 },
		{ t: 17, label: 'W18', signup: 26.8, activate: 44.1, subscribe: 34.2 },
		{ t: 18, label: 'W19', signup: 31.9, activate: 51.7, subscribe: 38.1 },
		{ t: 19, label: 'W20', signup: 34.7, activate: 56.4, subscribe: 41.9 },
		{ t: 20, label: 'W21', signup: 32.2, activate: 58.2, subscribe: 44.2 },
		{ t: 21, label: 'W22', signup: 36.1, activate: 55.1, subscribe: 40.6 },
		{ t: 22, label: 'W23', signup: 33.4, activate: 59.4, subscribe: 43.8 },
		{ t: 23, label: 'W24', signup: 37.2, activate: 56.8, subscribe: 46.1 },
		{ t: 24, label: 'W25', signup: 34.9, activate: 60.1, subscribe: 42.7 },
		{ t: 25, label: 'W26', signup: 38.4, activate: 58.6, subscribe: 45.3 }
	];

	// One row per plotted series, so the chart lines and the legend below it can't
	// drift apart — both are rendered from this list.
	const TREND_SERIES = [
		{ key: 'signup', name: 'Visit → signup', color: COLORS.blue },
		{ key: 'activate', name: 'Signup → activation', color: COLORS.green },
		{ key: 'subscribe', name: 'Activation → paid', color: COLORS.orange }
	] as const;

	// Label every fifth week. Derived from TREND so the axis stays in-domain when
	// the fixture grows or shrinks.
	const TREND_TICK_STEP = 5;
	const TREND_TICKS = Array.from(
		{ length: Math.ceil(TREND.length / TREND_TICK_STEP) },
		(_, i) => i * TREND_TICK_STEP
	);
	const formatTrendTick = (v: number) => TREND[v]?.label ?? '';

	// ============= COHORT RETENTION =============

	const COHORTS: Cohort[] = [
		{
			label: 'Apr 6 – Apr 12',
			size: 4820,
			retention: [100, 62, 48, 41, 37, 34, 32, 31]
		},
		{
			label: 'Apr 13 – Apr 19',
			size: 5140,
			retention: [100, 64, 50, 43, 39, 36, 34]
		},
		{ label: 'Apr 20 – Apr 26', size: 5390, retention: [100, 66, 52, 45, 41, 38] },
		{ label: 'Apr 27 – May 3', size: 5610, retention: [100, 63, 49, 42, 38] },
		{ label: 'May 4 – May 10', size: 5980, retention: [100, 67, 54, 47] },
		{ label: 'May 11 – May 17', size: 6240, retention: [100, 69, 56] },
		{ label: 'May 18 – May 24', size: 6510, retention: [100, 71] },
		{ label: 'May 25 – May 31', size: 6720, retention: [100] }
	];

	const MAX_WEEKS = 8;

	// Map a retention percentage to a Token color (green = sticky, red = leaky).
	function retentionColor(pct: number): 'green' | 'teal' | 'yellow' | 'orange' | 'red' {
		if (pct >= 70) {
			return 'green';
		}
		if (pct >= 50) {
			return 'teal';
		}
		if (pct >= 40) {
			return 'yellow';
		}
		if (pct >= 32) {
			return 'orange';
		}
		return 'red';
	}

	// ============= KPIS =============

	const KPIS: Record<Segment, Kpi[]> = {
		all: [
			{
				key: 'v2s',
				label: 'Visit → signup',
				value: '32.1%',
				delta: 1.8,
				higherIsBetter: true
			},
			{
				key: 's2a',
				label: 'Signup → activation',
				value: '54.9%',
				delta: 2.4,
				higherIsBetter: true
			},
			{
				key: 'a2s',
				label: 'Activation → paid',
				value: '40.3%',
				delta: -1.1,
				higherIsBetter: true
			},
			{
				key: 'w4',
				label: 'Week-4 retention',
				value: '43.2%',
				delta: 3.6,
				higherIsBetter: true
			}
		],
		web: [
			{
				key: 'v2s',
				label: 'Visit → signup',
				value: '30.0%',
				delta: 1.2,
				higherIsBetter: true
			},
			{
				key: 's2a',
				label: 'Signup → activation',
				value: '52.0%',
				delta: 1.9,
				higherIsBetter: true
			},
			{
				key: 'a2s',
				label: 'Activation → paid',
				value: '39.5%',
				delta: -0.6,
				higherIsBetter: true
			},
			{
				key: 'w4',
				label: 'Week-4 retention',
				value: '41.8%',
				delta: 2.9,
				higherIsBetter: true
			}
		],
		ios: [
			{
				key: 'v2s',
				label: 'Visit → signup',
				value: '35.2%',
				delta: 2.6,
				higherIsBetter: true
			},
			{
				key: 's2a',
				label: 'Signup → activation',
				value: '61.5%',
				delta: 3.1,
				higherIsBetter: true
			},
			{
				key: 'a2s',
				label: 'Activation → paid',
				value: '44.1%',
				delta: 0.8,
				higherIsBetter: true
			},
			{
				key: 'w4',
				label: 'Week-4 retention',
				value: '47.5%',
				delta: 4.2,
				higherIsBetter: true
			}
		],
		android: [
			{
				key: 'v2s',
				label: 'Visit → signup',
				value: '36.8%',
				delta: 2.1,
				higherIsBetter: true
			},
			{
				key: 's2a',
				label: 'Signup → activation',
				value: '55.9%',
				delta: 1.4,
				higherIsBetter: true
			},
			{
				key: 'a2s',
				label: 'Activation → paid',
				value: '36.8%',
				delta: -2.3,
				higherIsBetter: true
			},
			{
				key: 'w4',
				label: 'Week-4 retention',
				value: '38.4%',
				delta: -0.9,
				higherIsBetter: true
			}
		]
	};

	const SEGMENT_OPTIONS = [
		{ value: 'all', label: 'All platforms' },
		{ value: 'web', label: 'Web' },
		{ value: 'ios', label: 'iOS' },
		{ value: 'android', label: 'Android' }
	];

	function nf(n: number): string {
		return n.toLocaleString();
	}

	// ============= CHART GEOMETRY =============
	// The stand-in for recharts. See the header comment.

	function scale(value: number, d0: number, d1: number, r0: number, r1: number): number {
		return d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
	}

	function digitCount(value: number): number {
		return value === 0 ? 1 : Math.floor(Math.log10(Math.abs(value))) + 1;
	}

	function adaptiveStep(roughStep: number): number {
		if (roughStep <= 0) return 0;
		const digits = digitCount(roughStep);
		const digitValue = 10 ** digits;
		const ratio = roughStep / digitValue;
		const ratioScale = digits !== 1 ? 0.05 : 0.1;
		return Math.ceil(ratio / ratioScale) * ratioScale * digitValue;
	}

	// recharts' five-tick adaptive scale for a zero-based domain. See the header.
	function niceTicks(max: number, tickCount = 5): number[] {
		const count = Math.max(tickCount, 2);
		if (max === 0) return [0];
		const step = adaptiveStep(max / (count - 1));
		let upCount = Math.ceil(max / step);
		if (upCount + 1 < count) upCount = count - 1;
		const ticks: number[] = [];
		for (let i = 0; i <= upCount; i++) ticks.push(Math.round(i * step * 1e10) / 1e10);
		return ticks;
	}

	// `<ResponsiveContainer height={260}>` + `margin={{top:0,right:24,left:8,bottom:0}}`
	// + `YAxis width={110}`, and recharts' default XAxis height of 30.
	const FUNNEL_HEIGHT = 260;
	const FUNNEL_MARGIN = { top: 0, right: 24, left: 8, bottom: 0 };
	const FUNNEL_Y_AXIS_WIDTH = 110;
	const FUNNEL_X_AXIS_HEIGHT = 30;
	const FUNNEL_BAR_CATEGORY_GAP = 10;

	let funnelWidth = $state(0);
	let funnelHoverIndex: number | null = $state(null);

	const funnelPlot = $derived({
		left: FUNNEL_MARGIN.left + FUNNEL_Y_AXIS_WIDTH,
		right: funnelWidth - FUNNEL_MARGIN.right,
		top: FUNNEL_MARGIN.top,
		bottom: FUNNEL_HEIGHT - FUNNEL_MARGIN.bottom - FUNNEL_X_AXIS_HEIGHT
	});

	// A category axis with bars is a d3 band scale: `bandSize` is the plot height
	// over the category count, and each bar is inset by `barCategoryGap` at the
	// top and bottom. `bars` below is the tooltip's payload.
	const funnelBandSize = $derived((funnelPlot.bottom - funnelPlot.top) / FUNNEL_STAGES.length);
	const funnelBarHeight = $derived(funnelBandSize - 2 * FUNNEL_BAR_CATEGORY_GAP);
	const funnelBandY = (index: number) => funnelPlot.top + index * funnelBandSize;

	const funnelBars = $derived.by<FunnelBar[]>(() => {
		const top = FUNNEL_STAGES[0].users[segment];
		return FUNNEL_STAGES.map((stage, i) => {
			const users = stage.users[segment];
			const prev = i > 0 ? FUNNEL_STAGES[i - 1].users[segment] : null;
			return {
				key: stage.key,
				label: stage.label,
				users,
				pctOfTop: (users / top) * 100,
				stepPct: prev != null ? (users / prev) * 100 : null,
				color: FUNNEL_COLORS[i % FUNNEL_COLORS.length]
			};
		});
	});

	const funnelTicks = $derived(niceTicks(Math.max(...funnelBars.map((b) => b.users))));
	const funnelDomainMax = $derived(funnelTicks[funnelTicks.length - 1] ?? 0);
	const funnelX = (users: number) =>
		scale(users, 0, funnelDomainMax, funnelPlot.left, funnelPlot.right);

	const funnelHoverBar = $derived(
		funnelHoverIndex === null ? null : funnelBars[funnelHoverIndex]
	);

	function onFunnelMove(event: PointerEvent) {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - bounds.left;
		const y = event.clientY - bounds.top;
		if (x < funnelPlot.left || x > funnelPlot.right || y < funnelPlot.top || y > funnelPlot.bottom) {
			funnelHoverIndex = null;
			return;
		}
		const index = Math.floor((y - funnelPlot.top) / funnelBandSize);
		funnelHoverIndex = Math.max(0, Math.min(funnelBars.length - 1, index));
	}

	// `<ResponsiveContainer height={260}>` + `margin={{top:5,right:12,left:0,bottom:5}}`
	// + `YAxis width={40}`.
	const TREND_HEIGHT = 260;
	const TREND_MARGIN = { top: 5, right: 12, left: 0, bottom: 5 };
	const TREND_Y_AXIS_WIDTH = 40;
	const TREND_X_AXIS_HEIGHT = 30;

	let trendWidth = $state(0);
	let trendHoverIndex: number | null = $state(null);

	const trendPlot = $derived({
		left: TREND_MARGIN.left + TREND_Y_AXIS_WIDTH,
		right: trendWidth - TREND_MARGIN.right,
		top: TREND_MARGIN.top,
		bottom: TREND_HEIGHT - TREND_MARGIN.bottom - TREND_X_AXIS_HEIGHT
	});

	const trendTicks = niceTicks(Math.max(...TREND.map((d) => d.activate)));
	const trendDomainMax = trendTicks[trendTicks.length - 1] ?? 0;
	const trendX = (t: number) => scale(t, 0, TREND.length - 1, trendPlot.left, trendPlot.right);
	const trendY = (value: number) => scale(value, 0, trendDomainMax, trendPlot.bottom, trendPlot.top);

	const trendLines = $derived(
		TREND_SERIES.map((series) => ({
			...series,
			points: TREND.map((d) => `${trendX(d.t)},${trendY(d[series.key])}`).join(' ')
		}))
	);
	const trendHoverPoint = $derived(
		trendHoverIndex === null ? null : TREND[trendHoverIndex]
	);

	function onTrendMove(event: PointerEvent) {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - bounds.left;
		if (x < trendPlot.left || x > trendPlot.right) {
			trendHoverIndex = null;
			return;
		}
		const t = scale(x, trendPlot.left, trendPlot.right, 0, TREND.length - 1);
		const index = Math.round(t);
		trendHoverIndex = Math.max(0, Math.min(TREND.length - 1, index));
	}

	// ============= TABLE =============

	const cohortRows: CohortRow[] = COHORTS.map((c, i) => ({
		id: `c${i}`,
		label: c.label,
		size: c.size,
		retention: c.retention
	}));

	const cohortColumns = $derived.by<TableColumn<CohortRow>[]>(() => {
		const cols: TableColumn<CohortRow>[] = [
			{
				key: 'label',
				header: 'Cohort',
				width: pixel(150),
				renderCell: cohortLabelCell
			},
			{
				key: 'size',
				header: 'Users',
				width: pixel(90),
				renderCell: cohortSizeCell
			}
		];
		const weekCells = [
			week0Cell,
			week1Cell,
			week2Cell,
			week3Cell,
			week4Cell,
			week5Cell,
			week6Cell,
			week7Cell
		];
		for (let week = 0; week < MAX_WEEKS; week++) {
			cols.push({
				key: `w${week}`,
				header: `W${week}`,
				width: pixel(72),
				renderCell: weekCells[week]
			});
		}
		return cols;
	});

	// ============= MAIN COMPONENT STATE =============

	let segment = $state<Segment>('all');
	let funnelWindow = $state<FunnelWindow>('30d');

	const kpis = $derived(KPIS[segment]);

	const topOfFunnel = $derived(
		Math.round(FUNNEL_STAGES[0].users[segment] * WINDOW_FACTOR[funnelWindow])
	);

	const overallConversion = $derived(
		(
			(FUNNEL_STAGES[FUNNEL_STAGES.length - 1].users[segment] /
				FUNNEL_STAGES[0].users[segment]) *
			100
		).toFixed(1)
	);

	const funnelHint = $derived(
		`${SEGMENT_OPTIONS.find((o) => o.value === segment)?.label} · ${funnelWindow}`
	);

	// The step-by-step drop-off cards beneath the funnel.
	const funnelStepRows = $derived(
		FUNNEL_STAGES.slice(1).map((stage, i) => {
			const prev = FUNNEL_STAGES[i];
			const from = prev.users[segment];
			const to = stage.users[segment];
			const conv = (to / from) * 100;
			return {
				key: stage.key,
				label: `${prev.label} → ${stage.label}`,
				conv,
				drop: 100 - conv
			};
		})
	);
</script>

<!-- ============= SHARED PIECES ============= -->

{#snippet legendDot(color: string, label: string)}
	<HStack gap={2} vAlign="center">
		<Icon icon={StopIcon} size="xsm" style="color: {color};" />
		<Text type="supporting" color="secondary">{label}</Text>
	</HStack>
{/snippet}

{#snippet trendDownIcon()}
	<Icon icon={ArrowTrendingDownIcon} size="xsm" color="inherit" />
{/snippet}

{#snippet exportIcon()}
	<Icon icon={ArrowDownTrayIcon} size="sm" />
{/snippet}

<!-- ============= KPI TILE ============= -->

{#snippet kpiTile(kpi: Kpi)}
	{@const favorable = kpi.higherIsBetter ? kpi.delta >= 0 : kpi.delta <= 0}
	<Card padding={4}>
		<VStack gap={1}>
			<Text type="label" color="secondary">{kpi.label}</Text>
			<HStack gap={3}>
				<Heading level={1}>{kpi.value}</Heading>
				<HStack gap={1} vAlign="center">
					<Icon
						icon={kpi.delta >= 0 ? ArrowUpIcon : ArrowDownIcon}
						size="xsm"
						color={favorable ? 'success' : 'error'}
					/>
					<Text type="supporting" color="secondary">
						{kpi.delta >= 0 ? '+' : ''}{kpi.delta.toFixed(1)} pts vs. prior
					</Text>
				</HStack>
			</HStack>
		</VStack>
	</Card>
{/snippet}

<!-- ============= FUNNEL ============= -->

{#snippet funnelTooltip(bar: FunnelBar)}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="body" weight="semibold">{bar.label}</Text>
			<Text type="supporting" color="secondary">
				{nf(bar.users)} users · {bar.pctOfTop.toFixed(1)}% of top
			</Text>
			{#if bar.stepPct != null}
				<Text type="supporting" color="secondary">
					{bar.stepPct.toFixed(1)}% from previous step
				</Text>
			{/if}
		</VStack>
	</Card>
{/snippet}

{#snippet conversionFunnel()}
	<VStack gap={4}>
		<!-- `role="presentation"` because the wrapper is pure layout: the `<svg>` is
		     `aria-hidden` (recharts' surface is no more accessible) and the tooltip
		     is a pointer-only affordance. -->
		<div
			class="chart"
			role="presentation"
			style="height: {FUNNEL_HEIGHT}px;"
			bind:clientWidth={funnelWidth}
			onpointermove={onFunnelMove}
			onpointerleave={() => (funnelHoverIndex = null)}
		>
			{#if funnelWidth > 0}
				<svg width={funnelWidth} height={FUNNEL_HEIGHT} aria-hidden="true">
					{#each funnelTicks as tick (tick)}
						<line
							x1={funnelX(tick)}
							x2={funnelX(tick)}
							y1={funnelPlot.top}
							y2={funnelPlot.bottom}
							stroke={GRID_STROKE}
						/>
					{/each}
					{#if funnelHoverIndex !== null}
						<rect
							x={funnelPlot.left + 0.5}
							y={funnelBandY(funnelHoverIndex)}
							width={funnelPlot.right - funnelPlot.left - 1}
							height={funnelBandSize}
							fill={GRID_STROKE}
						/>
					{/if}
					{#each funnelBars as bar, i (bar.key)}
						<rect
							x={funnelPlot.left}
							y={funnelBandY(i) + FUNNEL_BAR_CATEGORY_GAP}
							width={Math.max(0, funnelX(bar.users) - funnelPlot.left)}
							height={funnelBarHeight}
							rx="4"
							fill={bar.color}
						/>
					{/each}
					{#each funnelTicks as tick (tick)}
						<text
							x={funnelX(tick)}
							y={funnelPlot.bottom + 20}
							text-anchor="middle"
							style={TICK_STYLE}>{tick}</text
						>
					{/each}
					{#each funnelBars as bar, i (bar.key)}
						<text
							x={funnelPlot.left - 8}
							y={funnelBandY(i) + funnelBandSize / 2 + 4}
							text-anchor="end"
							style={TICK_STYLE}>{bar.label}</text
						>
					{/each}
				</svg>
			{/if}
			{#if funnelHoverBar}
				<div
					class="chart-tooltip"
					style="left: {funnelX(funnelHoverBar.users)}px; top: {funnelBandY(
						funnelHoverIndex ?? 0
					) + funnelBandSize / 2}px;"
				>
					{@render funnelTooltip(funnelHoverBar)}
				</div>
			{/if}
		</div>
	</VStack>
{/snippet}

{#snippet funnelSteps()}
	<Grid class="step-grid" columns={{ minWidth: 200, repeat: 'fit' }} gap={3}>
		{#each funnelStepRows as step (step.key)}
			{@const leaky = step.drop >= 55}
			<VStack class="step" gap={1}>
				<Text type="label" color="secondary">{step.label}</Text>
				<HStack gap={2} vAlign="center">
					<Heading level={2}>{step.conv.toFixed(1)}%</Heading>
					<Token
						size="sm"
						color={leaky ? 'red' : 'green'}
						icon={trendDownIcon}
						label={`-${step.drop.toFixed(0)}%`}
					/>
				</HStack>
			</VStack>
		{/each}
	</Grid>
{/snippet}

<!-- ============= CONVERSION TREND ============= -->

{#snippet trendTooltip(point: TrendPoint)}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{point.label}</Text>
			{#each TREND_SERIES as series (series.key)}
				{@render legendDot(series.color, `${series.name}: ${point[series.key].toFixed(1)}%`)}
			{/each}
		</VStack>
	</Card>
{/snippet}

{#snippet conversionTrend()}
	<VStack gap={3}>
		<!-- `role="presentation"`: see the funnel's wrapper. -->
		<div
			class="chart"
			role="presentation"
			style="height: {TREND_HEIGHT}px;"
			bind:clientWidth={trendWidth}
			onpointermove={onTrendMove}
			onpointerleave={() => (trendHoverIndex = null)}
		>
			{#if trendWidth > 0}
				<svg width={trendWidth} height={TREND_HEIGHT} aria-hidden="true">
					{#each trendTicks as tick (tick)}
						<line
							x1={trendPlot.left}
							x2={trendPlot.right}
							y1={trendY(tick)}
							y2={trendY(tick)}
							stroke={GRID_STROKE}
						/>
					{/each}
					{#each trendLines as line (line.key)}
						<polyline
							points={line.points}
							fill="none"
							stroke={line.color}
							stroke-width="1.5"
							stroke-linejoin="miter"
						/>
					{/each}
					{#each TREND_TICKS as tick (tick)}
						<text
							x={trendX(tick)}
							y={trendPlot.bottom + 20}
							text-anchor="middle"
							style={TICK_STYLE}>{formatTrendTick(tick)}</text
						>
					{/each}
					{#each trendTicks as tick (tick)}
						<text
							x={trendPlot.left - 8}
							y={trendY(tick) + 4}
							text-anchor="end"
							style={TICK_STYLE}>{tick}%</text
						>
					{/each}
					{#if trendHoverPoint}
						<line
							x1={trendX(trendHoverPoint.t)}
							x2={trendX(trendHoverPoint.t)}
							y1={trendPlot.top}
							y2={trendPlot.bottom}
							stroke={GRID_STROKE}
						/>
					{/if}
				</svg>
			{/if}
			{#if trendHoverPoint}
				<div
					class="chart-tooltip"
					style="left: {trendX(trendHoverPoint.t)}px; top: {trendY(
						trendHoverPoint.signup
					)}px;"
				>
					{@render trendTooltip(trendHoverPoint)}
				</div>
			{/if}
		</div>
		<HStack gap={5} vAlign="center" wrap="wrap">
			{#each TREND_SERIES as series (series.key)}
				{@render legendDot(series.color, series.name)}
			{/each}
		</HStack>
	</VStack>
{/snippet}

<!-- ============= TABLE CELLS ============= -->

{#snippet cohortLabelCell(item: CohortRow)}
	<Text type="body" weight="semibold">{item.label}</Text>
{/snippet}

{#snippet cohortSizeCell(item: CohortRow)}
	<Text type="body" color="secondary">{nf(item.size)}</Text>
{/snippet}

{#snippet cohortWeekCell(item: CohortRow, week: number)}
	{@const pct = item.retention[week]}
	{#if pct == null}
		<Text type="supporting" color="secondary">—</Text>
	{:else}
		<Token size="sm" color={retentionColor(pct)} label={`${pct}%`} />
	{/if}
{/snippet}

{#snippet week0Cell(item: CohortRow)}{@render cohortWeekCell(item, 0)}{/snippet}
{#snippet week1Cell(item: CohortRow)}{@render cohortWeekCell(item, 1)}{/snippet}
{#snippet week2Cell(item: CohortRow)}{@render cohortWeekCell(item, 2)}{/snippet}
{#snippet week3Cell(item: CohortRow)}{@render cohortWeekCell(item, 3)}{/snippet}
{#snippet week4Cell(item: CohortRow)}{@render cohortWeekCell(item, 4)}{/snippet}
{#snippet week5Cell(item: CohortRow)}{@render cohortWeekCell(item, 5)}{/snippet}
{#snippet week6Cell(item: CohortRow)}{@render cohortWeekCell(item, 6)}{/snippet}
{#snippet week7Cell(item: CohortRow)}{@render cohortWeekCell(item, 7)}{/snippet}

<!-- ============= SECTION HEADING ============= -->

{#snippet sectionHeading(title: string, hint: string)}
	<VStack>
		<Heading level={2}>{title}</Heading>
		<Text type="supporting" color="secondary">{hint}</Text>
	</VStack>
{/snippet}

<!-- ============= MAIN ============= -->

{#snippet header()}
	<LayoutHeader hasDivider>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
			<VStack gap={0}>
				<Heading level={1}>Funnel & cohort analytics</Heading>
				<Text type="supporting" color="secondary">
					{nf(topOfFunnel)} visitors · {overallConversion}% end-to-end conversion
				</Text>
			</VStack>
			<HStack gap={2}>
				<SegmentedControl
					label="Funnel window"
					value={funnelWindow}
					onChange={(value: string) => (funnelWindow = value as FunnelWindow)}
				>
					<SegmentedControlItem label="7d" value="7d" />
					<SegmentedControlItem label="30d" value="30d" />
					<SegmentedControlItem label="90d" value="90d" />
				</SegmentedControl>
				<Selector
					label="Segment"
					isLabelHidden
					options={SEGMENT_OPTIONS}
					value={segment}
					onChange={(value: string) => (segment = value as Segment)}
				/>
				<Button label="Export" variant="secondary" icon={exportIcon} />
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet content()}
	<LayoutContent>
		<VStack gap={10}>
			<VStack gap={4}>
				<!-- KPI row -->
				<Grid columns={{ minWidth: 240, repeat: 'fit' }} gap={3}>
					{#each kpis as kpi (kpi.key)}
						{@render kpiTile(kpi)}
					{/each}
				</Grid>

				<!-- Conversion funnel -->
				<Card padding={6}>
					<VStack gap={6}>
						{@render sectionHeading('Conversion funnel', funnelHint)}
						{@render conversionFunnel()}
						<Divider />
						{@render funnelSteps()}
					</VStack>
				</Card>

				<!-- Conversion over time -->
				<Card padding={6}>
					<VStack gap={6}>
						{@render sectionHeading(
							'Conversion over time',
							`Stage conversion rates · trailing ${TREND.length} weeks`
						)}
						{@render conversionTrend()}
					</VStack>
				</Card>
			</VStack>

			<Divider />

			<!-- Cohort retention grid -->
			<VStack gap={6}>
				{@render sectionHeading(
					'Weekly retention cohorts',
					'Signup week × weeks since signup'
				)}
				<Card padding={6}>
					<VStack gap={8}>
						<Table
							data={cohortRows}
							columns={cohortColumns}
							idKey="id"
							density="balanced"
							dividers="rows"
						/>
						<HStack gap={4} vAlign="center" wrap="wrap">
							<Text type="supporting" color="secondary">Retention:</Text>
							<HStack gap={2} vAlign="center">
								<Token size="sm" color="red" label="< 32%" />
								<Token size="sm" color="orange" label="32–40%" />
								<Token size="sm" color="yellow" label="40–50%" />
								<Token size="sm" color="teal" label="50–70%" />
								<Token size="sm" color="green" label="≥ 70%" />
							</HStack>
						</HStack>
					</VStack>
				</Card>
			</VStack>
		</VStack>
	</LayoutContent>
{/snippet}

<Layout height="fill" padding={4} contentWidth={1440} {header} {content} />

<style>
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

	/* Upstream's `styles.stepGrid` / `styles.step`. Rules between the drop-off
	   steps: each step draws its own leading rule, pulled half a gap to the left
	   so it sits centred in the column gap, and `overflowX: clip` hides the one a
	   row-starting step draws outside the grid's content box. The
	   `--spacing-3` must match the step Grid's `gap={3}`. Both classes land on
	   Astryx components, hence `:global`. */
	:global(.step-grid) {
		overflow-x: clip;
	}

	:global(.step) {
		border-inline-start: 1px solid var(--color-border, rgba(5, 54, 89, 0.1));
		margin-inline-start: calc(var(--spacing-3, 12px) / -2);
		padding-inline-start: calc(var(--spacing-3, 12px) / 2);
	}
</style>
