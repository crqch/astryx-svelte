<!--
	Ported from upstream's `assets/templates/pages/dashboard-comparison/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed, so each glyph is the one upstream
	draws rather than a stand-in from core's 28-name `Icon` registry.

	Charts. Upstream draws with `recharts`, a React-only library — there is no
	Svelte build of it, and adding one is not something a scaffolded template may
	assume. The four chart shapes are therefore drawn inline, driven by
	upstream's own recharts props so the mapping stays auditable:

	  `<ResponsiveContainer height={48|280}>` → a `bind:clientWidth` wrapper for
	                                           the trend; a
	                                           `preserveAspectRatio="none"`
	                                           viewBox for the 48px sparkline,
	                                           which needs no measurement
	  `<CartesianGrid horizontal>`           → one `<line>` per Y tick
	  `<XAxis domain ticks tickFormatter>`   → `trendX` + `<text>` labels
	  `<YAxis width unit>`                   → `trendY` + `<text>` labels
	  `<Tooltip content={<ActiveTrendTooltip/>}>` → pointer tracking +
	                                           `chartTooltip`; `cursor` is the
	                                           vertical line at the hovered day
	  `<Area fill="url(#…)" stroke>`         → `<path>` + `<polyline>`; the
	                                           `tablet` area's `fill="none"` is
	                                           the bare `<polyline>` upstream
	                                           draws for it
	  `<BarChart layout="vertical" stackId>` → a flex row of segments, which
	                                           reproduces the per-end `radius`
	                                           without an SVG's non-uniform
	                                           scaling
	  `<LineChart height={48}>`              → the sparkline viewBox above
	  `<YAxis hide domain={['dataMin','dataMax']}>` (sparkline) → the visible
	                                           line's own min/max, so the shape
	                                           fills the 48px band

	The trend and sparkline Y axes declare no `ticks` or `domain`, so recharts
	derives them: `domain=[0, 'auto']` extended to the last tick of its
	five-tick "adaptive" nice scale. `niceTicks` below is that algorithm for a
	`[0, max]` domain, checked against recharts 3.10.1's
	`getNiceTickValues([0, max], 5, true, 'adaptive')`; the plot's Y domain is
	the last tick, exactly as `combineAxisDomainWithNiceTicks` extends it.

	Every colour, tick, stroke width, margin and height below is upstream's
	literal value. Upstream passes tick styling as `tick={{fontSize, fill}}`;
	here it lands as an inline `style` on the `<text>`, which is where a CSS
	`var()` actually resolves. `Icon`'s `color` prop only takes semantic names,
	so a legend swatch's series colour is an inline `style` — upstream's
	`dotStyle`, same reason.

	One positional difference: recharts anchors its tooltip to the pointer and
	clamps it inside the plot, while this one is anchored to the hovered day (the
	`dashboard` template's technique). Content, trigger and dismissal match.

	`LegendDot`, `DeltaValue`, `MiniSparkline`, `MetricCard`,
	`ActiveTrendTooltip`, `ActiveUsersTrend`, `BreakdownCard`, `DeltaBadge` and
	`SectionHeading` are local sub-components upstream; here they are snippets.
-->
<script lang="ts">
	import {
		AspectRatio,
		Badge,
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
		ProgressBar,
		Selector,
		Table,
		Text,
		VStack,
		pixel,
		proportional,
		type TableColumn
	} from '@astryx-svelte/core';
	import {
		ArrowDownIcon,
		ArrowDownTrayIcon,
		ArrowUpIcon,
		CursorArrowRaysIcon,
		UsersIcon
	} from '@fvilers/heroicons-svelte/24/outline';
	import { StopIcon } from '@fvilers/heroicons-svelte/24/solid';

	// ============= TYPES =============

	type Segment = 'all' | 'new' | 'returning';
	type DateRange = '7d' | '30d' | '90d';
	type DeviceFilter = 'all' | 'mobile' | 'desktop' | 'tablet';

	// Period-over-period change, in percent: day, week, month, and year.
	interface Deltas {
		dd: number;
		ww: number;
		mm: number;
		yy: number;
	}

	// One point of a sparkline, pre-shaped for recharts so the fixtures do the
	// work once at module load instead of on every render of every card.
	interface SparkPoint {
		i: number;
		v: number;
	}

	interface Metric {
		key: string;
		label: string;
		value: string;
		// Whether a rising value is good (engagement) or bad (bounce rate).
		higherIsBetter: boolean;
		deltas: Deltas;
		spark: SparkPoint[];
	}

	interface BreakdownSegment {
		label: string;
		value: number;
		color: string;
	}

	interface AcqRow extends Record<string, unknown> {
		id: string;
		channel: string;
		users: number;
		share: number;
		delta: number;
	}

	// ============= COLORS (design tokens w/ hex fallbacks) =============

	const COLORS = {
		blue: 'var(--color-data-categorical-blue, #0171E3)',
		green: 'var(--color-data-categorical-green, #0B991F)',
		orange: 'var(--color-data-categorical-orange, #EB6E00)',
		purple: 'var(--color-data-categorical-purple, #6B1EFD)',
		teal: 'var(--color-data-categorical-teal, #08A3A3)',
		neutral: 'var(--color-data-neutral, #8494A3)'
	};
	const GRID_STROKE = 'var(--color-border, rgba(5, 54, 89, 0.1))';
	const TICK_STYLE =
		'font-size: var(--font-size-sm, 12px); fill: var(--color-text-secondary, #4E606F);';

	// ============= DETERMINISTIC SERIES =============

	// A full quarter. The sparklines and the active-users trend both span this
	// window, so the card-level and chart-level views of the data agree.
	const TREND_DAYS = 90;

	// Hash-based noise in [0, 1) — deterministic, so previews never shift.
	// Shared by the metric sparklines and the active-users trend below.
	function noise(i: number, seed: number): number {
		const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	// Build a stable but spiky sparkline series: a trend line, a weekly rhythm, a
	// mean-reverting drift, per-point jitter, and the occasional outlier burst.
	function spark(seed: number, trend: number): SparkPoint[] {
		const out: SparkPoint[] = [];
		let drift = 0;
		for (let i = 0; i < TREND_DAYS; i++) {
			const base = 50 + (trend * i * 24) / TREND_DAYS;
			const weekly = Math.sin((i * Math.PI * 2) / 7 + seed) * 2.5;
			drift = drift * 0.72 + (noise(i, seed) - 0.5) * 7;
			const jitter = (noise(i, seed + 17) - 0.5) * 8;
			const burst =
				noise(i, seed + 91) > 0.9 ? (noise(i, seed + 43) - 0.4) * 20 : 0;
			out.push({ i, v: Math.round(base + weekly + drift + jitter + burst) });
		}
		return out;
	}

	// ============= OVERVIEW METRICS =============

	const OVERVIEW_METRICS: Metric[] = [
		{
			key: 'active-users',
			label: 'Active users',
			value: '1.28M',
			higherIsBetter: true,
			deltas: { dd: 0.4, ww: 2.1, mm: 6.4, yy: 18.2 },
			spark: spark(1, 1.1)
		},
		{
			key: 'new-users',
			label: 'New users',
			value: '184.2K',
			higherIsBetter: true,
			deltas: { dd: 1.2, ww: 3.8, mm: 9.1, yy: 24.6 },
			spark: spark(2, 1.4)
		},
		{
			key: 'sessions',
			label: 'Sessions',
			value: '4.62M',
			higherIsBetter: true,
			deltas: { dd: 0.2, ww: 1.4, mm: 5.2, yy: 15.9 },
			spark: spark(3, 0.9)
		},
		{
			key: 'avg-session',
			label: 'Avg. session',
			value: '6m 42s',
			higherIsBetter: true,
			deltas: { dd: -0.3, ww: 0.8, mm: 2.1, yy: -4.3 },
			spark: spark(4, 0.3)
		},
		{
			key: 'pages-session',
			label: 'Pages / session',
			value: '5.3',
			higherIsBetter: true,
			deltas: { dd: 0.1, ww: -0.6, mm: 1.2, yy: 3.7 },
			spark: spark(5, 0.4)
		},
		{
			key: 'bounce',
			label: 'Bounce rate',
			value: '38.6%',
			higherIsBetter: false,
			deltas: { dd: -0.2, ww: -1.1, mm: -2.4, yy: -6.8 },
			spark: spark(6, -0.5)
		},
		{
			key: 'dau-mau',
			label: 'DAU / MAU',
			value: '52.1%',
			higherIsBetter: true,
			deltas: { dd: 0.3, ww: 1.0, mm: 3.2, yy: 8.4 },
			spark: spark(7, 0.7)
		},
		{
			key: 'conversion',
			label: 'Conversion rate',
			value: '3.84%',
			higherIsBetter: true,
			deltas: { dd: -0.1, ww: 0.9, mm: 2.6, yy: 11.2 },
			spark: spark(8, 0.6)
		},
		{
			key: 'activation',
			label: 'Activation rate',
			value: '61.4%',
			higherIsBetter: true,
			deltas: { dd: 0.2, ww: 1.3, mm: 4.1, yy: 12.7 },
			spark: spark(9, 0.8)
		},
		{
			key: 'retention-30',
			label: '30-day retention',
			value: '27.4%',
			higherIsBetter: true,
			deltas: { dd: 0.1, ww: -0.4, mm: 1.8, yy: 5.3 },
			spark: spark(10, -0.3)
		},
		{
			key: 'churn',
			label: 'Churn rate',
			value: '4.7%',
			higherIsBetter: false,
			deltas: { dd: -0.1, ww: -0.5, mm: -1.3, yy: -3.9 },
			spark: spark(11, -0.6)
		},
		{
			key: 'load-time',
			label: 'Avg. load time',
			value: '1.4s',
			higherIsBetter: false,
			deltas: { dd: 0.2, ww: 0.6, mm: -2.2, yy: -8.1 },
			spark: spark(12, 0.35)
		}
	];

	// Active-users trend: the desktop/mobile/tablet split across TREND_DAYS.
	// Weekends swing traffic from desktop to mobile, and each day carries its own
	// jitter plus the occasional spike, so the series reads like real telemetry.
	const ACTIVE_TREND = (() => {
		const out: {
			t: number;
			label: string;
			desktop: number;
			mobile: number;
			tablet: number;
		}[] = [];
		for (let i = 0; i < TREND_DAYS; i++) {
			const weekend = i % 7 === 5 || i % 7 === 6;
			const spike = noise(i, 61) > 0.88 ? 1 : 0;
			// Slopes are expressed as total drift across the window, so the shape
			// holds if TREND_DAYS changes.
			out.push({
				t: i,
				label: `Day ${i + 1}`,
				desktop: Math.round(
					520 +
						(i * 90) / TREND_DAYS +
						(weekend ? -110 : 20) +
						(noise(i, 11) - 0.5) * 80
				),
				mobile: Math.round(
					680 +
						(i * 150) / TREND_DAYS +
						(weekend ? 85 : -15) +
						(noise(i, 23) - 0.5) * 125 +
						spike * 130
				),
				tablet: Math.round(
					140 + (weekend ? 24 : -5) + (noise(i, 37) - 0.5) * 40 + spike * 18
				)
			});
		}
		return out;
	})();

	// Four evenly spaced labels (roughly month boundaries), derived so the axis
	// stays readable if TREND_DAYS changes.
	const ACTIVE_TICK_COUNT = 4;
	const ACTIVE_TICKS = Array.from({ length: ACTIVE_TICK_COUNT }, (_, i) =>
		Math.round((i * (TREND_DAYS - 1)) / (ACTIVE_TICK_COUNT - 1))
	);

	// ============= DEMOGRAPHICS =============

	const AGE_DATA: BreakdownSegment[] = [
		{ label: '18–24', value: 26, color: COLORS.blue },
		{ label: '25–34', value: 34, color: COLORS.teal },
		{ label: '35–44', value: 21, color: COLORS.green },
		{ label: '45–54', value: 12, color: COLORS.orange },
		{ label: '55+', value: 7, color: COLORS.neutral }
	];

	const GENDER_DATA: BreakdownSegment[] = [
		{ label: 'Female', value: 48, color: COLORS.purple },
		{ label: 'Male', value: 46, color: COLORS.blue },
		{ label: 'Other / undisclosed', value: 6, color: COLORS.neutral }
	];

	const DEVICE_DATA: BreakdownSegment[] = [
		{ label: 'Mobile', value: 58, color: COLORS.blue },
		{ label: 'Desktop', value: 34, color: COLORS.teal },
		{ label: 'Tablet', value: 8, color: COLORS.orange }
	];

	const ACQUISITION: AcqRow[] = [
		{ id: 'a1', channel: 'Organic search', users: 486200, share: 38, delta: 4.2 },
		{ id: 'a2', channel: 'Direct', users: 295400, share: 23, delta: 1.1 },
		{ id: 'a3', channel: 'Social', users: 217800, share: 17, delta: 8.6 },
		{ id: 'a4', channel: 'Referral', users: 141900, share: 11, delta: -2.3 },
		{ id: 'a5', channel: 'Email', users: 89200, share: 7, delta: 3.4 },
		{ id: 'a6', channel: 'Paid ads', users: 51300, share: 4, delta: -1.8 }
	];

	const ACQ_MAX = Math.max(...ACQUISITION.map((a) => a.users));

	// ============= FILTER OPTIONS =============

	const RANGE_OPTIONS = [
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: '90d', label: 'Last 90 days' }
	];
	const SEGMENT_OPTIONS = [
		{ value: 'all', label: 'All users' },
		{ value: 'new', label: 'New users' },
		{ value: 'returning', label: 'Returning users' }
	];
	const DEVICE_OPTIONS = [
		{ value: 'all', label: 'All devices' },
		{ value: 'mobile', label: 'Mobile' },
		{ value: 'desktop', label: 'Desktop' },
		{ value: 'tablet', label: 'Tablet' }
	];

	// Locale is pinned: this is a client component, and letting the server and the
	// browser pick different default locales produces a hydration mismatch (and
	// breaks the deterministic previews this template promises).
	function formatNumber(n: number): string {
		return n.toLocaleString('en-US');
	}

	// ============= CHART GEOMETRY =============
	// The stand-in for recharts. See the header comment.

	function scale(value: number, d0: number, d1: number, r0: number, r1: number): number {
		return d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
	}

	function digitCount(value: number): number {
		return value === 0 ? 1 : Math.floor(Math.log10(Math.abs(value))) + 1;
	}

	function adaptiveStep(roughStep: number, correctionFactor: number): number {
		if (roughStep <= 0) return 0;
		const digits = digitCount(roughStep);
		const digitValue = 10 ** digits;
		const ratio = roughStep / digitValue;
		const ratioScale = digits !== 1 ? 0.05 : 0.1;
		const amended = Math.ceil(ratio / ratioScale) + correctionFactor;
		return amended * ratioScale * digitValue;
	}

	// recharts' `getNiceTickValues([0, max], 5, true, 'adaptive')`. For a `[0, max]`
	// domain the "middle" is 0, the step is always >= max/(count-1), and the only
	// branch left is padding the tick list up to `tickCount`.
	function niceTicks(max: number, tickCount = 5): number[] {
		const count = Math.max(tickCount, 2);
		if (max === 0) return [0];
		const step = adaptiveStep(max / (count - 1), 0);
		let upCount = Math.ceil(max / step);
		if (upCount + 1 < count) upCount = count - 1;
		const ticks: number[] = [];
		for (let i = 0; i <= upCount; i++) ticks.push(Math.round(i * step * 1e10) / 1e10);
		return ticks;
	}

	// `<ResponsiveContainer height={280}>` + `margin` + `YAxis width={40}`.
	const TREND_HEIGHT = 280;
	const TREND_MARGIN = { top: 5, right: 12, left: 0, bottom: 5 };
	const TREND_Y_AXIS_WIDTH = 40;
	const TREND_X_AXIS_HEIGHT = 30;
	const trendYMax = Math.max(...ACTIVE_TREND.map((d) => d.mobile));
	const trendYTicks = niceTicks(trendYMax);
	const trendYDomainMax = trendYTicks[trendYTicks.length - 1];

	let trendWidth = $state(0);
	let trendHoverIndex: number | null = $state(null);

	const trendPlot = $derived({
		left: TREND_MARGIN.left + TREND_Y_AXIS_WIDTH,
		right: trendWidth - TREND_MARGIN.right,
		top: TREND_MARGIN.top,
		bottom: TREND_HEIGHT - TREND_MARGIN.bottom - TREND_X_AXIS_HEIGHT
	});

	const trendX = (t: number) => scale(t, 0, TREND_DAYS - 1, trendPlot.left, trendPlot.right);
	const trendY = (value: number) =>
		scale(value, 0, trendYDomainMax, trendPlot.bottom, trendPlot.top);

	const areaSeries = [
		{
			dataKey: 'mobile' as const,
			name: 'Mobile',
			color: COLORS.blue,
			gradient: 'au-mobile'
		},
		{
			dataKey: 'desktop' as const,
			name: 'Desktop',
			color: COLORS.teal,
			gradient: 'au-desktop'
		},
		{ dataKey: 'tablet' as const, name: 'Tablet', color: COLORS.orange, gradient: null }
	];

	const areaPaths = $derived(
		areaSeries.map((series) => {
			const line = ACTIVE_TREND.map((d) => `${trendX(d.t)},${trendY(d[series.dataKey])}`).join(
				' '
			);
			const area =
				`M${trendX(0)},${trendPlot.bottom}` +
				ACTIVE_TREND.map((d) => `L${trendX(d.t)},${trendY(d[series.dataKey])}`).join('') +
				`L${trendX(TREND_DAYS - 1)},${trendPlot.bottom}Z`;
			return { ...series, line, area };
		})
	);

	const trendHoverPoint = $derived(
		trendHoverIndex === null ? null : ACTIVE_TREND[trendHoverIndex]
	);

	function onTrendMove(event: PointerEvent) {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - bounds.left;
		if (x < trendPlot.left || x > trendPlot.right) {
			trendHoverIndex = null;
			return;
		}
		const t = scale(x, trendPlot.left, trendPlot.right, 0, TREND_DAYS - 1);
		const index = Math.round(t);
		trendHoverIndex = Math.max(0, Math.min(ACTIVE_TREND.length - 1, index));
	}

	// `<LineChart height={48}>` with an implicit Y axis: `domain=[0, 'auto']`
	// extended to the last nice tick, `margin={{top: 4, right: 0, left: 0,
	// bottom: 0}}`. A viewBox whose X unit is the point index needs no
	// measurement; the stroke is `non-scaling`.
	function sparkPoints(data: SparkPoint[], height: number): string {
		const max = niceTicks(Math.max(...data.map((d) => d.v))).at(-1) ?? 0;
		return data
			.map((d, i) => `${i},${scale(d.v, 0, max, height, 4)}`)
			.join(' ');
	}

	// ============= MAIN COMPONENT STATE =============

	// Matches TREND_DAYS — the fixtures render a full quarter.
	let range = $state<DateRange>('90d');
	let segment = $state<Segment>('all');
	let device = $state<DeviceFilter>('all');

	function labelFor(
		options: readonly { value: string; label: string }[],
		value: string
	): string {
		return options.find((o) => o.value === value)?.label ?? '';
	}

	const summary = $derived(
		[
			labelFor(SEGMENT_OPTIONS, segment),
			labelFor(DEVICE_OPTIONS, device),
			labelFor(RANGE_OPTIONS, range)
		].join(' · ')
	);

	const acquisitionColumns = $derived.by<TableColumn<AcqRow>[]>(() => [
		{
			key: 'channel',
			header: 'Channel',
			width: pixel(160),
			renderCell: channelCell
		},
		{
			key: 'users',
			header: 'Users',
			width: proportional(1),
			renderCell: usersCell
		},
		{
			key: 'share',
			header: 'Share',
			width: pixel(90),
			renderCell: shareCell
		},
		{
			key: 'delta',
			header: 'w/w',
			width: pixel(100),
			renderCell: deltaCell
		}
	]);
</script>

<!-- ============= SHARED PIECES ============= -->

{#snippet legendDot(color: string, label: string)}
	<HStack gap={2} vAlign="center">
		<Icon icon={StopIcon} size="xsm" style="color: {color};" />
		<Text type="supporting" color="secondary">{label}</Text>
	</HStack>
{/snippet}

<!-- ============= METRIC MINI-CARD (with sparkline + 4 deltas) ============= -->

{#snippet deltaValue(label: string, value: number)}
	<Text type="body" weight="bold" color="primary" hasTabularNumbers>
		{value === 0 ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}{' '}
		<Text type="inherit" weight="normal" color="secondary">{label}</Text>
	</Text>
{/snippet}

<!--
	The sparkline restates the trend the value and arrow already convey, so it is
	decorative: hidden from assistive tech rather than announced as an unlabelled
	chart.
-->
{#snippet miniSparkline(data: SparkPoint[], color: string)}
	<div aria-hidden="true">
		<svg
			width="100%"
			height="48"
			viewBox="0 0 {TREND_DAYS - 1} 48"
			preserveAspectRatio="none"
		>
			<polyline
				points={sparkPoints(data, 48)}
				fill="none"
				stroke={color}
				stroke-width="1.25"
				stroke-linecap="butt"
				stroke-linejoin="miter"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
	</div>
{/snippet}

{#snippet metricCard(metric: Metric)}
	{@const trendUp = metric.deltas.ww >= 0}
	{@const favorable = metric.higherIsBetter ? trendUp : !trendUp}
	<Card padding={4}>
		<VStack gap={4}>
			<VStack gap={1}>
				<Text type="label" color="secondary">{metric.label}</Text>
				<HStack gap={2} vAlign="center">
					<!-- Sized as the card's hero number, but demoted in the document
					     outline: these sit under the section's h2, not beside the
					     page's h1. -->
					<Heading level={1} accessibilityLevel={3}>{metric.value}</Heading>
					<Icon
						icon={trendUp ? ArrowUpIcon : ArrowDownIcon}
						size="sm"
						color={favorable ? 'success' : 'error'}
					/>
				</HStack>
			</VStack>
			{@render miniSparkline(metric.spark, favorable ? COLORS.green : COLORS.orange)}
			<Grid columns={2} gap={2}>
				{@render deltaValue('d/d', metric.deltas.dd)}
				{@render deltaValue('w/w', metric.deltas.ww)}
				{@render deltaValue('m/m', metric.deltas.mm)}
				{@render deltaValue('y/y', metric.deltas.yy)}
			</Grid>
		</VStack>
	</Card>
{/snippet}

<!-- ============= ACTIVE USERS TREND ============= -->

{#snippet activeTrendTooltip(point: (typeof ACTIVE_TREND)[number])}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{point.label}</Text>
			{#each areaSeries as entry (entry.name)}
				{@render legendDot(
					entry.color,
					`${entry.name}: ${formatNumber(point[entry.dataKey])}K`
				)}
			{/each}
		</VStack>
	</Card>
{/snippet}

{#snippet activeUsersTrend()}
	<VStack gap={3}>
		<!-- `role="presentation"` because the wrapper is pure layout: the `<svg>` is
		     `aria-hidden` (recharts' surface is no more accessible) and the tooltip
		     is a pointer-only affordance. -->
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
					<defs>
						<linearGradient id="au-mobile" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stop-color={COLORS.blue} stop-opacity="0.3" />
							<stop offset="95%" stop-color={COLORS.blue} stop-opacity="0.04" />
						</linearGradient>
						<linearGradient id="au-desktop" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stop-color={COLORS.teal} stop-opacity="0.3" />
							<stop offset="95%" stop-color={COLORS.teal} stop-opacity="0.04" />
						</linearGradient>
					</defs>
					{#each trendYTicks as tick (tick)}
						<line
							x1={trendPlot.left}
							x2={trendPlot.right}
							y1={trendY(tick)}
							y2={trendY(tick)}
							stroke={GRID_STROKE}
						/>
					{/each}
					{#each areaPaths as series (series.dataKey)}
						{#if series.gradient}
							<path d={series.area} fill="url(#{series.gradient})" />
						{/if}
						<polyline
							points={series.line}
							fill="none"
							stroke={series.color}
							stroke-width="1.5"
							stroke-linejoin="miter"
						/>
					{/each}
					{#each ACTIVE_TICKS as tick (tick)}
						<text
							x={trendX(tick)}
							y={trendPlot.bottom + 20}
							text-anchor="middle"
							style={TICK_STYLE}>{ACTIVE_TREND[tick]?.label ?? ''}</text
						>
					{/each}
					{#each trendYTicks as tick (tick)}
						<text
							x={trendPlot.left - 8}
							y={trendY(tick) + 4}
							text-anchor="end"
							style={TICK_STYLE}>{tick}K</text
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
						trendHoverPoint.mobile
					)}px;"
				>
					{@render activeTrendTooltip(trendHoverPoint)}
				</div>
			{/if}
		</div>
		<HStack gap={5} vAlign="center" wrap="wrap">
			{@render legendDot(COLORS.blue, 'Mobile')}
			{@render legendDot(COLORS.teal, 'Desktop')}
			{@render legendDot(COLORS.orange, 'Tablet')}
		</HStack>
	</VStack>
{/snippet}

<!-- ============= BREAKDOWN (horizontal stacked bar) ============= -->

{#snippet breakdownCard(title: string, data: BreakdownSegment[])}
	<Card>
		<VStack gap={4}>
			<!-- Card-title sizing, but h3 in the outline — these sit under the
			     "Audience demographics" h2, so level 4 would skip a rank. -->
			<Heading level={4} accessibilityLevel={3}>{title}</Heading>
			<div class="stacked-bar" aria-hidden="true">
				{#each data as d, i (d.label)}
					<div
						style="flex: {d.value}; background-color: {d.color}; border-radius: {i === 0
							? '4px 0 0 4px'
							: i === data.length - 1
								? '0 4px 4px 0'
								: '0'};"
					></div>
				{/each}
			</div>
			<VStack gap={2}>
				{#each data as d (d.label)}
					<HStack hAlign="between" vAlign="center">
						{@render legendDot(d.color, d.label)}
						<Text type="supporting" weight="semibold" hasTabularNumbers>
							{d.value}%
						</Text>
					</HStack>
				{/each}
			</VStack>
		</VStack>
	</Card>
{/snippet}

<!-- ============= TABLES ============= -->

{#snippet deltaBadge(value: number)}
	<Badge
		variant={value === 0 ? 'neutral' : value > 0 ? 'green' : 'red'}
		label={`${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
	/>
{/snippet}

{#snippet channelCell(item: AcqRow)}
	<Text type="body" weight="semibold">{item.channel}</Text>
{/snippet}

{#snippet usersCell(item: AcqRow)}
	<VStack gap={1}>
		<ProgressBar
			value={item.users}
			max={ACQ_MAX}
			label={`${item.channel} users`}
			isLabelHidden
		/>
		<Text type="supporting" color="secondary" hasTabularNumbers>
			{formatNumber(item.users)}
		</Text>
	</VStack>
{/snippet}

{#snippet shareCell(item: AcqRow)}
	<Text type="body" hasTabularNumbers>{item.share}%</Text>
{/snippet}

{#snippet deltaCell(item: AcqRow)}
	{@render deltaBadge(item.delta)}
{/snippet}

<!-- ============= SECTION HEADING ============= -->

{#snippet sectionHeading(title: string, hint: string, icon: typeof UsersIcon | null)}
	<HStack hAlign="between" vAlign="center" gap={3}>
		<HStack gap={3} vAlign="center">
			{#if icon}
				<!-- AspectRatio takes its width from the container, and as a flex child
				     its own `width: 100%` would resolve against the whole header row.
				     Pinning the width gives it the definite box it needs and makes the
				     tile a 32px square. -->
				<AspectRatio
					ratio={1}
					fit="center"
					style="width: var(--spacing-8); background-color: var(--color-background-muted); border-radius: var(--radius-element);"
				>
					<Icon {icon} size="sm" color="secondary" />
				</AspectRatio>
			{/if}
			<Heading level={2}>{title}</Heading>
		</HStack>
		<Text type="supporting" color="secondary">{hint}</Text>
	</HStack>
{/snippet}

<!-- ============= MAIN ============= -->

<!--
	The filters are presentational: the fixtures are a fixed snapshot, so the
	controls annotate the view rather than re-slicing the data. Swapping the
	fixtures for a query is the seam a consumer replaces.
-->

{#snippet exportIcon()}
	<Icon icon={ArrowDownTrayIcon} size="sm" />
{/snippet}

{#snippet header()}
	<LayoutHeader hasDivider>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
			<VStack gap={0}>
				<Heading level={1}>Data Dashboard</Heading>
				<Text type="supporting" color="secondary">
					User analytics overview · {summary}
				</Text>
			</VStack>
			<HStack gap={1}>
				<Selector
					label="Date range"
					isLabelHidden
					options={RANGE_OPTIONS}
					value={range}
					onChange={(value: string) => (range = value as DateRange)}
				/>
				<Selector
					label="Segment"
					isLabelHidden
					options={SEGMENT_OPTIONS}
					value={segment}
					onChange={(value: string) => (segment = value as Segment)}
				/>
				<Selector
					label="Device"
					isLabelHidden
					options={DEVICE_OPTIONS}
					value={device}
					onChange={(value: string) => (device = value as DeviceFilter)}
				/>
				<Button label="Export" variant="secondary" icon={exportIcon} />
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet content()}
	<LayoutContent padding={6}>
		<VStack gap={10}>
			<VStack gap={6}>
				{@render sectionHeading(
					'Key metrics',
					'Change vs. prior day, week, month, and year',
					UsersIcon
				)}
				<Grid
					class="metrics-grid"
					columns={{ minWidth: 240, repeat: 'fit' }}
					gap={3}
				>
					{#each OVERVIEW_METRICS as metric (metric.key)}
						{@render metricCard(metric)}
					{/each}
				</Grid>
			</VStack>

			<VStack gap={6}>
				{@render sectionHeading('Devices', 'Daily active users (thousands)', CursorArrowRaysIcon)}
				<Card padding={6}>
					<VStack gap={6}>
						<Text type="label">Daily active users by device type</Text>
						{@render activeUsersTrend()}
					</VStack>
				</Card>
			</VStack>

			<Divider />

			<VStack gap={6}>
				{@render sectionHeading('Audience demographics', 'Share of active users', UsersIcon)}
				<Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={4}>
					{@render breakdownCard('Age', AGE_DATA)}
					{@render breakdownCard('Gender', GENDER_DATA)}
					{@render breakdownCard('Device', DEVICE_DATA)}
				</Grid>
			</VStack>

			<VStack gap={6}>
				{@render sectionHeading('Acquisition channels', 'How users find the product', null)}
				<Card>
					<Table
						data={ACQUISITION}
						columns={acquisitionColumns}
						idKey="id"
						density="balanced"
						dividers="rows"
						hasHover
					/>
				</Card>
			</VStack>
		</VStack>
	</LayoutContent>
{/snippet}

<Layout height="fill" contentWidth={1440} {header} {content} />

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

	/* `<BarChart layout="vertical">` with one `stackId` and a `radius` on each
	   end segment. A flex row reproduces it without an SVG's non-uniform
	   horizontal scaling. */
	.stacked-bar {
		display: flex;
		width: 100%;
		height: 24px;
	}

	/* Upstream's `METRICS_WIDE` xstyle: Grid carries one minWidth, so the
	   roomier track floor for wide viewports is a consumer override. The class
	   lands on the Grid component, hence `:global`. */
	@media (min-width: 900px) {
		:global(.metrics-grid) {
			grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		}
	}
</style>
