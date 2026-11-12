<!--
	Ported from upstream's `assets/templates/pages/dashboard-scorecard/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed.

	Charts. Upstream draws the four trend cards with `recharts`. They are drawn
	inline here, driven by upstream's own recharts props:

	  `<ResponsiveContainer height={200}>` → a `bind:clientWidth` wrapper
	  `<AreaChart|LineChart margin>`      → `trendPlot`, below
	  `<CartesianGrid horizontal>`        → one `<line>` per Y tick
	  `<XAxis domain ticks tickFormatter>`→ `[0, 3, 7, 11]` + `W1…` labels
	  `<YAxis>` (no domain)               → `niceTicks`, recharts' adaptive
	                                        nice-step algorithm over `[0, 'auto']`
	  `<Tooltip content cursor={{stroke}}>` → pointer tracking, a vertical
	                                        cursor line and `trendTooltip`
	  `<Area type="monotone">`            → `monotonePath` (d3's monotoneX,
	                                        which is what recharts uses) plus a
	                                        closing baseline for the fill
	  `<Line type="monotone">`            → the same path, unfilled

	Every colour, tick, stroke width, margin and height below is upstream's
	literal value. Upstream passes tick styling as `tick={{fontSize, fill}}`;
	here it lands as an inline `style` on the `<text>`, which is where a CSS
	`var()` actually resolves.

	No chart animates: every `Area` and `Line` sets `isAnimationActive={false}`,
	so there is no reveal to port. The scorecard's responsive 1×6 / 2×3 / 3×2
	grid is upstream's viewport-pinned triple — the two media ranges are
	non-overlapping, so exactly one matches — written as a scoped `:global` rule
	against `Grid`'s own track template because this template takes no StyleX.

	`LegendDot`, `DeltaIndicator`, `ScorecardTile`, `OkrRow`, `TrendChart`,
	`NarrativeCard`, `NarrativeBlock` and `SectionHeading` are local
	sub-components upstream; here they are snippets. Upstream's
	`useMediaQuery('(max-width: 1024px)')` returns a live boolean here through
	`useMediaQuery(...).matches`, so `Layout`'s `end` slot is dropped reactively
	when the rail folds inline.
-->
<script lang="ts">
	import {
		Avatar,
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
		LayoutPanel,
		ProgressBar,
		SegmentedControl,
		SegmentedControlItem,
		StackItem,
		Text,
		Timestamp,
		VStack,
		useMediaQuery
	} from '@astryx-sv/core';
	import { ArrowDownTrayIcon } from '@fvilers/heroicons-svelte/24/outline';
	import {
		ArrowDownIcon,
		ArrowRightIcon,
		ArrowUpIcon,
		StopIcon
	} from '@fvilers/heroicons-svelte/24/solid';

	// ============= TYPES =============

	type Period = 'WoW' | 'MoM' | 'QoQ';
	type Rag = 'green' | 'amber' | 'red';

	interface Kpi {
		key: string;
		label: string;
		value: string;
		unit?: string;
		// Delta percentage per period; sign drives arrow + RAG.
		delta: Record<Period, number>;
		// Whether an increase is good (revenue) or bad (churn, cost).
		higherIsBetter: boolean;
	}

	interface Okr {
		objective: string;
		owner: string;
		actual: number;
		target: number;
		unit: string;
	}

	interface TrendSeries {
		key: string;
		title: string;
		unit: string;
		kind: 'area' | 'line';
		color: string;
		// 12 periods of [current, prior] pairs.
		data: { t: number; label: string; current: number; prior: number }[];
	}

	// ============= RAG COLOR MAPPING =============

	const RAG_ICON: Record<Rag, 'success' | 'warning' | 'error'> = {
		green: 'success',
		amber: 'warning',
		red: 'error'
	};

	// A delta becomes RAG by magnitude + whether the direction is favorable.
	function ragFor(deltaPct: number, higherIsBetter: boolean): Rag {
		const favorable = higherIsBetter ? deltaPct >= 0 : deltaPct <= 0;
		const mag = Math.abs(deltaPct);
		if (favorable) {
			return mag >= 1 ? 'green' : 'amber';
		}
		return mag >= 3 ? 'red' : 'amber';
	}

	// ============= CHART COLORS (design tokens w/ hex fallbacks) =============

	const COLORS = {
		blue: 'var(--color-data-categorical-blue, #0171E3)',
		green: 'var(--color-data-categorical-green, #0B991F)',
		orange: 'var(--color-data-categorical-orange, #EB6E00)',
		purple: 'var(--color-data-categorical-purple, #6B1EFD)',
		prior: 'var(--color-text-secondary, #737373)'
	};
	const GRID_STROKE = 'var(--color-border, rgba(5, 54, 89, 0.1))';
	const AXIS_TICK = 'font-size: var(--font-size-sm, 12px); fill: var(--color-text-secondary, #4E606F);';

	// ============= SCORECARD DATA =============

	const KPIS: Kpi[] = [
		{
			key: 'revenue',
			label: 'Net revenue',
			value: '$4.82M',
			delta: { WoW: 2.4, MoM: 6.1, QoQ: 14.3 },
			higherIsBetter: true
		},
		{
			key: 'arr',
			label: 'ARR',
			value: '$58.1M',
			delta: { WoW: 1.1, MoM: 3.8, QoQ: 11.2 },
			higherIsBetter: true
		},
		{
			key: 'nrr',
			label: 'Net revenue retention',
			value: '112%',
			delta: { WoW: 0.3, MoM: -0.8, QoQ: 2.1 },
			higherIsBetter: true
		},
		{
			key: 'churn',
			label: 'Gross churn',
			value: '1.9%',
			delta: { WoW: 0.4, MoM: 1.6, QoQ: -0.7 },
			higherIsBetter: false
		},
		{
			key: 'cac',
			label: 'CAC payback',
			value: '14.2 mo',
			delta: { WoW: -0.2, MoM: -3.4, QoQ: -8.1 },
			higherIsBetter: false
		},
		{
			key: 'nps',
			label: 'NPS',
			value: '48',
			delta: { WoW: 1.0, MoM: 4.0, QoQ: 6.0 },
			higherIsBetter: true
		}
	];

	// The scorecard is one flat grid of 6 tiles: 1 column (small), 2 (medium),
	// 3 (large) — i.e. 1x6, 2x3, 3x2. The tiers are pinned to viewport width
	// rather than derived from tile width via auto-fill, so the breakpoints are
	// explicit. The ranges are non-overlapping, so exactly one ever matches and
	// the result can't depend on StyleX's at-rule ordering or on source order.

	// ============= OKR / GOAL ATTAINMENT =============

	const OKRS: Okr[] = [
		{
			objective: 'Reach $60M ARR',
			owner: 'Dana Whitfield · CRO',
			actual: 58.1,
			target: 60,
			unit: 'M'
		},
		{
			objective: 'Expand into 3 new enterprise verticals',
			owner: 'Marcus Lin · VP Sales',
			actual: 2,
			target: 3,
			unit: ''
		},
		{
			objective: 'Ship AI copilot GA',
			owner: 'Priya Raman · VP Product',
			actual: 82,
			target: 100,
			unit: '%'
		},
		{
			objective: 'Improve gross margin to 78%',
			owner: 'Tom Okafor · CFO',
			actual: 75.4,
			target: 78,
			unit: '%'
		}
	];

	function okrRag(pct: number): Rag {
		if (pct >= 90) {
			return 'green';
		}
		if (pct >= 70) {
			return 'amber';
		}
		return 'red';
	}

	const RAG_PROGRESS: Record<Rag, 'success' | 'warning' | 'error'> = {
		green: 'success',
		amber: 'warning',
		red: 'error'
	};

	// ============= TREND DATA (period-over-period) =============

	const WEEK_LABELS = [
		'W1',
		'W2',
		'W3',
		'W4',
		'W5',
		'W6',
		'W7',
		'W8',
		'W9',
		'W10',
		'W11',
		'W12'
	];

	function makeTrend(
		base: number,
		growth: number,
		priorGap: number,
		wobble: number
	): { t: number; label: string; current: number; prior: number }[] {
		return WEEK_LABELS.map((label, i) => {
			const drift = base * (1 + (growth * i) / 11);
			const wob = Math.sin(i * 1.3) * base * wobble;
			const current = Math.round(drift + wob);
			const prior = Math.round((drift + wob) * (1 - priorGap));
			return { t: i, label, current, prior };
		});
	}

	const TRENDS: TrendSeries[] = [
		{
			key: 'revenue',
			title: 'Net revenue',
			unit: 'k',
			kind: 'area',
			color: COLORS.blue,
			data: makeTrend(980, 0.24, 0.12, 0.03)
		},
		{
			key: 'pipeline',
			title: 'Qualified pipeline',
			unit: 'k',
			kind: 'area',
			color: COLORS.green,
			data: makeTrend(3200, 0.31, 0.18, 0.05)
		},
		{
			key: 'activation',
			title: 'Activation rate',
			unit: '%',
			kind: 'line',
			color: COLORS.purple,
			data: makeTrend(42, 0.28, 0.09, 0.04)
		},
		{
			key: 'support',
			title: 'Support CSAT',
			unit: '%',
			kind: 'line',
			color: COLORS.orange,
			data: makeTrend(88, 0.06, 0.03, 0.02)
		}
	];

	// ============= AUTO-GENERATED NARRATIVE =============

	type CalloutStatus = 'success' | 'warning' | 'info';

	interface Callout {
		status: CalloutStatus;
		title: string;
		detail: string;
	}

	const NARRATIVE: Record<Period, Callout[]> = {
		WoW: [
			{
				status: 'success',
				title: 'Net revenue up 2.4% week-over-week',
				detail:
					'Driven by three enterprise renewals closing early in the East region; expansion ARR contributed 60% of the lift.'
			},
			{
				status: 'warning',
				title: 'Gross churn ticked up 0.4 points',
				detail:
					'Two mid-market logos churned on price; both flagged in QBRs last month. Save-play in motion for the remaining at-risk cohort.'
			},
			{
				status: 'info',
				title: 'CAC payback holding at 14.2 months',
				detail:
					'Paid acquisition efficiency steady; the shift toward partner-sourced pipeline is starting to show in blended CAC.'
			}
		],
		MoM: [
			{
				status: 'success',
				title: 'Revenue accelerating: +6.1% month-over-month',
				detail:
					'Second consecutive month of accelerating growth. New-logo bookings and expansion both above plan; net-new pipeline covers 3.2x of next quarter target.'
			},
			{
				status: 'warning',
				title: 'NRR dipped 0.8 points to 112%',
				detail:
					'A seasonal downgrade cycle in the SMB segment pulled retention down slightly. Enterprise NRR remains above 120%.'
			},
			{
				status: 'success',
				title: 'CAC payback improved 3.4 points',
				detail:
					'Sales efficiency gains from the new SDR playbook are compounding; payback now inside the 15-month board target.'
			}
		],
		QoQ: [
			{
				status: 'success',
				title: 'Strong quarter: revenue +14.3%, ARR +11.2%',
				detail:
					'Best quarter on record for net-new ARR. Two of three new verticals landed anchor customers; the AI copilot beta is converting at 2x the baseline trial rate.'
			},
			{
				status: 'success',
				title: 'Churn down 0.7 points quarter-over-quarter',
				detail:
					'Retention initiatives launched in Q1 are paying off; gross churn at a two-year low and NRR up 2.1 points.'
			},
			{
				status: 'warning',
				title: 'Gross margin at 75.4%, short of the 78% goal',
				detail:
					'Infrastructure cost from the AI copilot GA ramp is the primary drag. Finance projects margin recovery once usage-based pricing lands next quarter.'
			}
		]
	};

	const PERIOD_SUBTITLE: Record<Period, string> = {
		WoW: 'Week of Jun 23 – Jun 29, 2026 vs. prior week',
		MoM: 'June 2026 vs. May 2026',
		QoQ: 'Q2 2026 vs. Q1 2026'
	};

	// ============= CHART GEOMETRY =============
	// The stand-in for recharts. See the header comment.

	function scale(value: number, d0: number, d1: number, r0: number, r1: number): number {
		return d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
	}

	// `recharts-scale`'s adaptive nice-step algorithm, for a YAxis with no
	// `domain`: `[0, 'auto']` is widened to the last nice tick.
	function niceTicks(min: number, max: number, tickCount = 5): number[] {
		if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min, max];
		const roughStep = (max - min) / (tickCount - 1);
		const digitCount = Math.floor(Math.log10(roughStep)) + 1;
		const digitValue = 10 ** digitCount;
		const scaleFactor = digitCount !== 1 ? 0.05 : 0.1;

		let correction = 0;
		let step = digitValue * scaleFactor;
		let upCount = 0;
		for (;;) {
			step =
				(Math.ceil(roughStep / digitValue / scaleFactor) + correction) * scaleFactor * digitValue;
			upCount = Math.ceil(max / step);
			if (upCount + 1 <= tickCount) break;
			correction += 1;
		}
		if (upCount + 1 < tickCount) upCount += tickCount - (upCount + 1);

		const ticks: number[] = [];
		for (let i = 0; i <= upCount; i++) {
			ticks.push(Number((i * step).toFixed(10)));
		}
		return ticks;
	}

	// d3-shape's monotoneX curve, which is recharts' `type="monotone"`.
	function monotonePath(points: Array<{ x: number; y: number }>): string {
		const n = points.length;
		if (n === 0) return '';
		if (n === 1) return `M${points[0].x},${points[0].y}`;
		const tangents = new Array<number>(n);
		const slope2 = (i: number) => {
			const h = points[i + 1].x - points[i].x;
			const s = (points[i + 1].y - points[i].y) / (h || 1e-9);
			return i > 0
				? (s + (points[i].y - points[i - 1].y) / (points[i].x - points[i - 1].x || 1e-9)) / 2
				: s;
		};
		tangents[0] = slope2(0);
		tangents[n - 1] = slope2(n - 2);
		for (let i = 1; i < n - 1; i++) {
			const h0 = points[i].x - points[i - 1].x;
			const h1 = points[i + 1].x - points[i].x;
			const s0 = (points[i].y - points[i - 1].y) / (h0 || 1e-9);
			const s1 = (points[i + 1].y - points[i].y) / (h1 || 1e-9);
			tangents[i] =
				s0 * s1 <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / s1 + (h1 + 2 * h0) / s0);
		}
		let d = `M${points[0].x},${points[0].y}`;
		for (let i = 0; i < n - 1; i++) {
			const x0 = points[i].x;
			const y0 = points[i].y;
			const x1 = points[i + 1].x;
			const y1 = points[i + 1].y;
			const h = (x1 - x0) / 3;
			d += `C${x0 + h},${y0 + h * tangents[i]},${x1 - h},${y1 - h * tangents[i + 1]},${x1},${y1}`;
		}
		return d;
	}

	const TREND_HEIGHT = 200;
	const TREND_MARGIN = { top: 5, right: 8, left: 0, bottom: 0 };
	const TREND_Y_AXIS_WIDTH = 40;
	const TREND_X_AXIS_HEIGHT = 30;
	const TREND_X_TICKS = [0, 3, 7, 11];

	const trendWidths = $state<Record<string, number>>({});
	const trendHover = $state<Record<string, number | null>>({});

	function trendGeometry(trend: TrendSeries, width: number) {
		const plot = {
			left: TREND_MARGIN.left + TREND_Y_AXIS_WIDTH,
			right: width - TREND_MARGIN.right,
			top: TREND_MARGIN.top,
			bottom: TREND_HEIGHT - TREND_MARGIN.bottom - TREND_X_AXIS_HEIGHT
		};
		const max = Math.max(...trend.data.map((d) => Math.max(d.current, d.prior)));
		const yTicks = niceTicks(0, max);
		const yMax = yTicks[yTicks.length - 1] ?? max;
		const x = (t: number) => scale(t, 0, 11, plot.left, plot.right);
		const y = (value: number) => scale(value, 0, yMax, plot.bottom, plot.top);
		const currentPoints = trend.data.map((d) => ({ x: x(d.t), y: y(d.current) }));
		const priorPoints = trend.data.map((d) => ({ x: x(d.t), y: y(d.prior) }));
		return {
			plot,
			yTicks,
			x,
			y,
			currentPath: monotonePath(currentPoints),
			priorPath: monotonePath(priorPoints),
			currentArea: `${monotonePath(currentPoints)}L${currentPoints[currentPoints.length - 1].x},${plot.bottom}L${currentPoints[0].x},${plot.bottom}Z`
		};
	}

	function onTrendMove(event: PointerEvent, trend: TrendSeries) {
		const geometry = trendGeometry(trend, trendWidths[trend.key] ?? 0);
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - bounds.left;
		if (geometry.plot.right <= geometry.plot.left) return;
		const t = scale(x, geometry.plot.left, geometry.plot.right, 0, 11);
		const index = Math.round(t);
		trendHover[trend.key] = Math.max(0, Math.min(trend.data.length - 1, index));
	}

	// ============= STATE =============

	let period = $state<Period>('WoW');
	// The narrative rail needs ~400px of its own; below that the content column
	// would be too cramped for the 2-up trend grid, so the rail folds inline.
	const isNarrow = useMediaQuery(() => '(max-width: 1024px)');

	const okrSummary = (() => {
		const pcts = OKRS.map((o) => (o.actual / o.target) * 100);
		const onTrack = pcts.filter((p) => p >= 90).length;
		return `${onTrack} of ${OKRS.length} on track`;
	})();
</script>

<!-- ============= SHARED PIECES ============= -->

{#snippet legendDot(color: string, label: string)}
	<HStack gap={2} vAlign="center">
		<Icon icon={StopIcon} size="xsm" style="color: {color};" />
		<Text type="supporting" color="secondary">{label}</Text>
	</HStack>
{/snippet}

{#snippet deltaIndicator(deltaPct: number, rag: Rag)}
	<HStack gap={2} vAlign="center">
		<Text type="body" color="secondary">
			{deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
		</Text>
		<Icon
			icon={deltaPct === 0 ? ArrowRightIcon : deltaPct < 0 ? ArrowDownIcon : ArrowUpIcon}
			size="xsm"
			color={RAG_ICON[rag]}
		/>
	</HStack>
{/snippet}

{#snippet sectionHeading(title: string, hint?: string)}
	<HStack hAlign="between" vAlign="center" gap={3}>
		<Heading level={2}>{title}</Heading>
		{#if hint}
			<Text type="supporting" color="secondary">{hint}</Text>
		{/if}
	</HStack>
{/snippet}

<!-- ============= SCORECARD ============= -->

{#snippet scorecardTile(kpi: Kpi)}
	{@const deltaPct = kpi.delta[period]}
	{@const rag = ragFor(deltaPct, kpi.higherIsBetter)}
	<Card padding={5}>
		<VStack gap={1}>
			<Text type="label" color="secondary">{kpi.label}</Text>
			<HStack gap={4} vAlign="center">
				<Heading level={2}>{kpi.value}</Heading>
				{@render deltaIndicator(deltaPct, rag)}
			</HStack>
		</VStack>
	</Card>
{/snippet}

<!-- ============= OKR ATTAINMENT ============= -->

{#snippet okrRow(okr: Okr)}
	{@const pct = Math.round((okr.actual / okr.target) * 100)}
	{@const rag = okrRag(pct)}
	<!-- `owner` is "Name · Title"; the avatar wants the person, not the title. -->
	{@const ownerName = okr.owner.split('·')[0].trim()}
	<VStack gap={2}>
		<HStack hAlign="between" vAlign="center" gap={3}>
			<StackItem size="fill">
				<Heading level={4}>{okr.objective}</Heading>
			</StackItem>
			<Text type="supporting" color="secondary">{pct}%</Text>
		</HStack>
		<ProgressBar
			value={okr.actual}
			max={okr.target}
			variant={RAG_PROGRESS[rag]}
			label={okr.objective}
			isLabelHidden
		/>
		<HStack hAlign="between" vAlign="center" gap={4}>
			<HStack gap={2} vAlign="center">
				<Avatar size="sm" name={ownerName} />
				<Text type="supporting" color="secondary">{okr.owner}</Text>
			</HStack>
			<Text type="supporting" color="secondary">
				{okr.actual}{okr.unit} / {okr.target}{okr.unit} target
			</Text>
		</HStack>
	</VStack>
{/snippet}

<!-- ============= TREND CHART ============= -->

{#snippet trendTooltip(trend: TrendSeries, index: number)}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{WEEK_LABELS[index] ?? ''}</Text>
			{@render legendDot(
				COLORS.prior,
				`Prior: ${trend.data[index].prior.toLocaleString()}${trend.unit}`
			)}
			{@render legendDot(
				trend.color,
				`Current: ${trend.data[index].current.toLocaleString()}${trend.unit}`
			)}
		</VStack>
	</Card>
{/snippet}

{#snippet trendChart(trend: TrendSeries)}
	{@const latest = trend.data[trend.data.length - 1]}
	{@const deltaPct = Math.round(((latest.current - latest.prior) / latest.prior) * 100)}
	{@const width = trendWidths[trend.key] ?? 0}
	{@const geometry = trendGeometry(trend, width)}
	{@const hoveredIndex = trendHover[trend.key] ?? null}
	{@const hoveredPoint = hoveredIndex === null ? null : trend.data[hoveredIndex]}
	<Card padding={5}>
		<VStack gap={6}>
			<HStack hAlign="between" vAlign="center">
				<HStack gap={2}>
					<Heading level={3}>{trend.title}</Heading>
					<Heading level={3} color="secondary">
						{latest.current.toLocaleString()}{trend.unit}
					</Heading>
				</HStack>
				<Text type="supporting" color="secondary">
					{deltaPct >= 0 ? '+' : ''}{deltaPct}% vs prior
				</Text>
			</HStack>
			<!-- `role="presentation"` because the wrapper is pure layout: the `<svg>`
			     is `aria-hidden` (recharts' surface is no more accessible) and the
			     tooltip is a pointer-only affordance. -->
			<div
				class="chart"
				role="presentation"
				style="height: {TREND_HEIGHT}px;"
				bind:clientWidth={trendWidths[trend.key]}
				onpointermove={(event) => onTrendMove(event, trend)}
				onpointerleave={() => (trendHover[trend.key] = null)}
			>
				{#if width > 0}
					<svg width={width} height={TREND_HEIGHT} aria-hidden="true">
						<defs>
							<linearGradient id={`grad-${trend.key}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stop-color={trend.color} stop-opacity="0.3" />
								<stop offset="95%" stop-color={trend.color} stop-opacity="0.04" />
							</linearGradient>
						</defs>
						{#each geometry.yTicks as tick (tick)}
							<line
								x1={geometry.plot.left}
								x2={geometry.plot.right}
								y1={geometry.y(tick)}
								y2={geometry.y(tick)}
								stroke={GRID_STROKE}
							/>
						{/each}
						{#if hoveredPoint}
							<line
								x1={geometry.x(hoveredPoint.t)}
								x2={geometry.x(hoveredPoint.t)}
								y1={geometry.plot.top}
								y2={geometry.plot.bottom}
								stroke={GRID_STROKE}
							/>
						{/if}
						{#if trend.kind === 'area'}
							<path d={geometry.currentArea} fill={`url(#grad-${trend.key})`} />
						{/if}
						<path
							d={geometry.priorPath}
							fill="none"
							stroke={COLORS.prior}
							stroke-width="1"
							stroke-dasharray="4 4"
						/>
						<path
							d={geometry.currentPath}
							fill="none"
							stroke={trend.color}
							stroke-width="2"
						/>
						{#if hoveredPoint}
							<circle
								cx={geometry.x(hoveredPoint.t)}
								cy={geometry.y(hoveredPoint.prior)}
								r="4"
								fill={COLORS.prior}
								stroke="#fff"
								stroke-width="2"
							/>
							<circle
								cx={geometry.x(hoveredPoint.t)}
								cy={geometry.y(hoveredPoint.current)}
								r="4"
								fill={trend.color}
								stroke="#fff"
								stroke-width="2"
							/>
						{/if}
						{#each TREND_X_TICKS as tick (tick)}
							<text
								x={geometry.x(tick)}
								y={geometry.plot.bottom + 20}
								text-anchor="middle"
								style={AXIS_TICK}>{WEEK_LABELS[tick] ?? ''}</text
							>
						{/each}
						{#each geometry.yTicks as tick (tick)}
							<text
								x={geometry.plot.left - 8}
								y={geometry.y(tick) + 4}
								text-anchor="end"
								style={AXIS_TICK}>{tick}</text
							>
						{/each}
					</svg>
				{/if}
				{#if hoveredPoint && hoveredIndex !== null}
					<div
						class="chart-tooltip"
						style="left: {geometry.x(hoveredPoint.t)}px; top: {geometry.y(
							hoveredPoint.current
						)}px;"
					>
						{@render trendTooltip(trend, hoveredIndex)}
					</div>
				{/if}
			</div>
			<HStack gap={5} vAlign="center">
				{@render legendDot(trend.color, 'Current')}
				{@render legendDot(COLORS.prior, 'Prior')}
			</HStack>
		</VStack>
	</Card>
{/snippet}

<!-- ============= NARRATIVE ============= -->

{#snippet narrativeCard(callout: Callout)}
	<Card padding={5}>
		<HStack gap={3} vAlign="start">
			<Icon
				icon={callout.status === 'info' ? 'info' : callout.status}
				color={callout.status === 'success'
					? 'success'
					: callout.status === 'warning'
						? 'warning'
						: 'accent'}
				size="md"
				label={callout.status === 'success'
					? 'Positive'
					: callout.status === 'warning'
						? 'Needs attention'
						: 'Context'}
			/>
			<StackItem size="fill">
				<VStack gap={1}>
					<Heading level={4}>{callout.title}</Heading>
					<Text type="body" color="secondary">{callout.detail}</Text>
				</VStack>
			</StackItem>
		</HStack>
	</Card>
{/snippet}

{#snippet narrativeBlock()}
	<VStack gap={2}>
		{#each NARRATIVE[period] as callout (callout.title)}
			{@render narrativeCard(callout)}
		{/each}
	</VStack>
{/snippet}

<!-- ============= PAGE CHROME ============= -->

{#snippet downloadIcon()}
	<Icon icon={ArrowDownTrayIcon} size="sm" />
{/snippet}

{#snippet pageHeader()}
	<LayoutHeader padding={6} hasDivider>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
			<VStack gap={1}>
				<Heading level={1}>Weekly Business Review</Heading>
				<HStack gap={2} vAlign="center">
					<Text type="body" color="secondary">{PERIOD_SUBTITLE[period]}</Text>
					<Text type="body" color="secondary">· Generated</Text>
					<Timestamp
						value="2026-06-30T08:00:00Z"
						format="date"
						type="body"
						color="secondary"
					/>
				</HStack>
			</VStack>
			<HStack gap={3}>
				<SegmentedControl
					label="Comparison period"
					value={period}
					onChange={(value) => (period = value as Period)}
				>
					<SegmentedControlItem label="WoW" value="WoW" />
					<SegmentedControlItem label="MoM" value="MoM" />
					<SegmentedControlItem label="QoQ" value="QoQ" />
				</SegmentedControl>
				<Button label="Export" variant="secondary" icon={downloadIcon} />
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet narrativeRail()}
	<LayoutPanel width={400} padding={6} hasDivider role="complementary" label="What changed and why">
		<VStack gap={6}>
			{@render sectionHeading('What changed & why', 'AI summary')}
			{@render narrativeBlock()}
		</VStack>
	</LayoutPanel>
{/snippet}

{#snippet content()}
	<LayoutContent padding={6} style="padding-block-end: var(--spacing-10);">
		<VStack gap={10}>
			<!-- Narrative lives in the end rail; it folds in here when narrow. -->
			{#if isNarrow.matches}
				<VStack gap={6}>
					{@render sectionHeading('What changed & why', 'AI summary')}
					{@render narrativeBlock()}
				</VStack>
			{/if}

			<!-- Scorecard row -->
			<VStack gap={6}>
				{@render sectionHeading('Scorecards', 'Performance metrics')}
				<Grid gap={2} class="scorecard-grid">
					{#each KPIS as kpi (kpi.key)}
						{@render scorecardTile(kpi)}
					{/each}
				</Grid>
			</VStack>

			<!-- OKR attainment -->
			<VStack gap={6}>
				{@render sectionHeading('Goal attainment', okrSummary)}
				<Card padding={6}>
					<VStack gap={6}>
						{#each OKRS as okr, i (okr.objective)}
							<VStack gap={6}>
								{#if i > 0}<Divider />{/if}
								{@render okrRow(okr)}
							</VStack>
						{/each}
					</VStack>
				</Card>
			</VStack>

			<!-- Trend section: 2x2 grid -->
			<VStack gap={6}>
				{@render sectionHeading('Trends', 'Current vs. prior period · trailing 12 weeks')}
				<Grid columns={{ minWidth: 330, repeat: 'fit' }} gap={3}>
					{#each TRENDS as trend (trend.key)}
						{@render trendChart(trend)}
					{/each}
				</Grid>
			</VStack>
		</VStack>
	</LayoutContent>
{/snippet}

<Layout
	height="fill"
	contentWidth={1440}
	header={pageHeader}
	{content}
	end={isNarrow.matches ? undefined : narrativeRail}
/>

<style>
	:global(.scorecard-grid.scorecard-grid) {
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) and (max-width: 1199.98px) {
		:global(.scorecard-grid.scorecard-grid) {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1200px) {
		:global(.scorecard-grid.scorecard-grid) {
			grid-template-columns: repeat(3, 1fr);
		}
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
</style>
