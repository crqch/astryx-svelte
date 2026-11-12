<!--
	Ported from upstream's `assets/templates/pages/dashboard-alert-rail/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed, so each glyph is the one upstream
	draws rather than a stand-in from core's 28-name `Icon` registry.

	Charts. Upstream draws with `recharts`, a React-only library — there is no
	Svelte build of it, and adding one is not something a scaffolded template may
	assume. Everything chart-shaped is therefore drawn inline, driven by
	upstream's own recharts props so the mapping stays auditable:

	  `<ResponsiveContainer height={280}>`  → a `bind:clientWidth` wrapper
	  `<LineChart margin={…}>`              → `chartPlot`, below
	  `<CartesianGrid horizontal>`          → one `<line>` per Y tick
	  `<XAxis domain ticks tickFormatter>`  → `chartX` + `<text>` labels
	  `<YAxis width={56} unit>`             → `chartY` + `<text>` labels
	  `<Tooltip content={<ChartTooltip/>}>` → pointer tracking + `chartTooltip`;
	                                           `cursor` is the vertical line at
	                                           the hovered sample
	  `<Line strokeWidth={1.5}>`            → one `<polyline>` per series
	  `<LineChart height={40}>` (spark)     → a `preserveAspectRatio="none"`
	                                           viewBox with
	                                           `vector-effect="non-scaling-stroke"`
	  the uptime strip                      → 90 flex bars (3px floor, 2px gap,
	                                           scrolls below ~420px); the strip is
	                                           one image to assistive tech, with
	                                           per-day detail on `title`

	The two time-series declare no Y `ticks`/`domain`, so recharts derives them:
	`domain=[0, 'auto']` extended to the last tick of its five-tick "adaptive"
	nice scale. `niceTicks` below is that algorithm for a `[0, max]` domain,
	checked against recharts 3.10.1's
	`getNiceTickValues([0, max], 5, true, 'adaptive')`; the plot's Y domain is
	the last tick. The sparkline's `YAxis hide domain={['dataMin','dataMax']}` is
	its own min/max, so availability's 99.2–100% range fills the 40px band.

	Every colour, domain, tick, stroke width, margin and height below is
	upstream's literal value — including `LINE_PROPS`' miter joins and butt caps,
	which keep every sample a straight segment (`monotone` would round spikes no
	real metric produces). Upstream passes tick styling as `tick={{fontSize,
	fill}}`; here it lands as an inline `style` on the `<text>`, which is where a
	CSS `var()` actually resolves. `Icon`'s `color` prop only takes semantic
	names, so a legend swatch's series colour is an inline `style` — upstream's
	`dotStyle`, same reason.

	One positional difference: recharts anchors its tooltip to the pointer and
	clamps it inside the plot, while this one is anchored to the hovered sample
	(the `dashboard` template's technique). Content, trigger and dismissal match.

	`LegendDot`, `ChartTooltip`, `MetricChart`, `Sparkline`, `KpiTile`,
	`RailSection`, `AlertsFeed`, `ServiceBreakdown`, `UptimeStrip`, `UptimeRow`
	and `AllServicesUptime` are local sub-components upstream; here they are
	snippets. `MetricChart` is instantiated twice rather than parameterised by a
	width getter, because each chart needs its own measured width and hover
	index; `metricChartSvg` is the shared body.

	Upstream's `styles` becomes three `:global` rules in the page `<style>`:
	a `class` handed to an Astryx component is never scoped by Svelte.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		Badge,
		Card,
		Divider,
		EmptyState,
		Grid,
		HStack,
		Heading,
		Icon,
		Layout,
		LayoutContent,
		LayoutHeader,
		LayoutPanel,
		List,
		ListItem,
		SegmentedControl,
		SegmentedControlItem,
		Selector,
		StackItem,
		StatusDot,
		Text,
		Timestamp,
		Token,
		VStack,
		useMediaQuery,
		type IconType
	} from '@astryx-sv/core';
	import {
		ArrowDownIcon,
		ArrowUpIcon,
		BellAlertIcon,
		CheckCircleIcon,
		ServerStackIcon
	} from '@fvilers/heroicons-svelte/24/outline';
	import { StopIcon } from '@fvilers/heroicons-svelte/24/solid';

	// ============= TYPES =============

	type TimeWindow = '1h' | '1d' | '7d';
	type Environment = 'production' | 'staging' | 'development';
	type HealthStatus = 'healthy' | 'warning' | 'critical';
	type MetricKey = 'p50' | 'p95' | 'p99' | 'useast' | 'uswest' | 'euwest';
	type AlertState = 'firing' | 'acknowledged' | 'resolved';
	type UptimeStatus = 'operational' | 'degraded' | 'down';

	type SeriesPoint = Record<MetricKey, number> & {
		t: number;
		label: string;
	};

	interface WindowSeries {
		points: SeriesPoint[];
		ticks: number[];
		tickLabels: Record<number, string>;
	}

	interface ChartLine {
		key: MetricKey;
		name: string;
		color: string;
	}

	interface ChartRow {
		t: number;
		label: string;
		values: Record<MetricKey, number>;
	}

	interface Kpi {
		key: string;
		label: string;
		value: string;
		status: HealthStatus;
		statusLabel: string;
		delta: string;
		/** Whether the delta direction is a good thing — drives the arrow + color. */
		deltaPositive: boolean;
	}

	interface HostRow {
		id: string;
		service: string;
		environment: Environment;
		region: string;
		instances: number;
		rpm: number;
		errorRate: number;
		p99: number;
		status: HealthStatus;
	}

	interface Alert {
		id: string;
		severity: HealthStatus;
		title: string;
		service: string;
		at: string;
		state: AlertState;
	}

	interface ServiceUptime {
		service: string;
		status: HealthStatus;
		days: UptimeStatus[];
		uptime: number;
		degradedDays: number;
		downDays: number;
	}

	const STATUS_STROKE: Record<HealthStatus, string> = {
		healthy: 'var(--color-text-success)',
		warning: 'var(--color-text-warning)',
		critical: 'var(--color-text-error)'
	};

	const STATUS_DOT: Record<HealthStatus, 'success' | 'warning' | 'error'> = {
		healthy: 'success',
		warning: 'warning',
		critical: 'error'
	};

	// Accessible label wherever a StatusDot is the only carrier of state.
	const STATUS_LABEL: Record<HealthStatus, string> = {
		healthy: 'Healthy',
		warning: 'Degraded',
		critical: 'Down'
	};

	const SEVERITY_RANK: Record<HealthStatus, number> = {
		critical: 0,
		warning: 1,
		healthy: 2
	};

	// ============= DETERMINISTIC TIME-SERIES =============

	// Staging and dev carry a fraction of prod's load, and run leaner with it.
	const ENV_FACTOR: Record<Environment, number> = {
		production: 1,
		staging: 0.16,
		development: 0.04
	};

	const ENV_LATENCY_FACTOR: Record<Environment, number> = {
		production: 1,
		staging: 0.82,
		development: 0.7
	};

	const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function pad2(n: number): string {
		return n < 10 ? `0${n}` : `${n}`;
	}

	// Pseudo-noise in [0, 1) — a hash, not a PRNG, so every render is identical.
	function hashNoise(i: number, seed: number): number {
		const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	// Signed jitter in [-1, 1) — the per-sample wobble every real metric carries.
	function jitter(i: number, seed: number): number {
		return hashNoise(i, seed) * 2 - 1;
	}

	// Sparse heavy-tail burst in [0, 1], zero most of the time: metrics sit near
	// baseline and occasionally kick rather than wandering smoothly.
	function burstAt(i: number, seed: number, rate: number): number {
		const gate = hashNoise(i, seed);
		if (gate < 1 - rate) {
			return 0;
		}
		const t = (gate - (1 - rate)) / rate;
		return t * t;
	}

	// A diurnal baseline under constant jitter, punctuated by sparse bursts, with a
	// sustained latency spike mid-window to match the SEV2 alert in the rail.
	function buildWindow(kind: TimeWindow): WindowSeries {
		const config: Record<TimeWindow, { n: number; stepSec: number; cycles: number }> = {
			'1h': { n: 120, stepSec: 30, cycles: 1.2 },
			'1d': { n: 144, stepSec: 600, cycles: 2 },
			'7d': { n: 168, stepSec: 3600, cycles: 7 }
		};
		const { n, stepSec, cycles } = config[kind];
		const points: SeriesPoint[] = [];
		const spikeCenter = Math.round(n * 0.62);
		const spikeWidth = Math.max(3, Math.round(n * 0.05));

		for (let i = 0; i < n; i++) {
			const phase = (i / n) * Math.PI * 2 * cycles;
			const diurnal = Math.sin(phase);
			const diurnal2 = Math.sin(phase + 1.1);
			const diurnal3 = Math.sin(phase + 2.3);

			const dist = Math.abs(i - spikeCenter);
			const spike = dist <= spikeWidth ? (1 - dist / (spikeWidth + 1)) * 170 : 0;

			// A real slowdown hits the whole distribution, hardest at the tail.
			const burst = burstAt(i, 3.1, 0.14);
			const p50 = 46 + 9 * diurnal + spike * 0.15 + burst * 11 + jitter(i, 1) * 4;
			const p95 = 158 + 38 * diurnal + spike * 0.6 + burst * 58 + jitter(i, 2) * 15;
			const p99 = 312 + 88 * diurnal + spike * 1.6 + burst * 195 + jitter(i, 3) * 38;

			// Deploys and outages move every region together.
			const pulse = burstAt(i, 7.3, 0.18) - burstAt(i, 9.7, 0.12);
			const useast = 9200 + 2600 * diurnal + pulse * 1500 + jitter(i, 11) * 520;
			const uswest = 6100 + 1500 * diurnal2 + pulse * 900 + jitter(i, 13) * 380;
			const euwest = 3900 + 1200 * diurnal3 + pulse * 620 + jitter(i, 17) * 260;

			const totalMin = Math.floor((i * stepSec) / 60);
			let label: string;
			if (kind === '7d') {
				label = DAY_LABELS[Math.floor(totalMin / (60 * 24)) % 7];
			} else {
				const hh = Math.floor(totalMin / 60) % 24;
				const mm = totalMin % 60;
				label = `${pad2(hh)}:${pad2(mm)}`;
			}

			points.push({
				t: i,
				label,
				p50: Math.round(p50),
				p95: Math.round(p95),
				p99: Math.round(p99),
				useast: Math.round(useast),
				uswest: Math.round(uswest),
				euwest: Math.round(euwest)
			});
		}

		// A fixed handful of ticks, so dense sampling can't crowd the axis.
		const ticks: number[] = [];
		if (kind === '7d') {
			const perDay = Math.round((60 * 60 * 24) / stepSec);
			for (let d = 0; d < 7; d++) {
				ticks.push(d * perDay);
			}
		} else {
			for (let k = 0; k < 6; k++) {
				ticks.push(Math.round((k / 5) * (n - 1)));
			}
		}
		const tickLabels: Record<number, string> = {};
		for (const tk of ticks) {
			tickLabels[tk] = points[Math.min(tk, points.length - 1)]?.label ?? '';
		}

		return { points, ticks, tickLabels };
	}

	const SERIES: Record<TimeWindow, WindowSeries> = {
		'1h': buildWindow('1h'),
		'1d': buildWindow('1d'),
		'7d': buildWindow('7d')
	};

	// ============= KPI DATA (per environment) =============

	const KPI_BY_ENV: Record<Environment, Kpi[]> = {
		production: [
			{
				key: 'health',
				label: 'Overall health',
				value: '98.6%',
				status: 'healthy',
				statusLabel: 'Healthy',
				delta: '+0.3%',
				deltaPositive: true
			},
			{
				key: 'error',
				label: 'Error rate',
				value: '1.84%',
				status: 'warning',
				statusLabel: 'Elevated',
				delta: '+0.9%',
				deltaPositive: false
			},
			{
				key: 'latency',
				label: 'p99 latency',
				value: '512 ms',
				status: 'warning',
				statusLabel: 'Above target',
				delta: '+84 ms',
				deltaPositive: false
			},
			{
				key: 'availability',
				label: 'Availability',
				value: '99.98%',
				status: 'healthy',
				statusLabel: 'Operational',
				delta: '+0.01%',
				deltaPositive: true
			}
		],
		staging: [
			{
				key: 'health',
				label: 'Overall health',
				value: '99.4%',
				status: 'healthy',
				statusLabel: 'Healthy',
				delta: '+0.1%',
				deltaPositive: true
			},
			{
				key: 'error',
				label: 'Error rate',
				value: '0.42%',
				status: 'healthy',
				statusLabel: 'Nominal',
				delta: '-0.2%',
				deltaPositive: true
			},
			{
				key: 'latency',
				label: 'p99 latency',
				value: '338 ms',
				status: 'healthy',
				statusLabel: 'Within target',
				delta: '-12 ms',
				deltaPositive: true
			},
			{
				key: 'availability',
				label: 'Availability',
				value: '99.95%',
				status: 'healthy',
				statusLabel: 'Operational',
				delta: '0.00%',
				deltaPositive: true
			}
		],
		development: [
			{
				key: 'health',
				label: 'Overall health',
				value: '96.1%',
				status: 'warning',
				statusLabel: 'Flaky',
				delta: '-1.8%',
				deltaPositive: false
			},
			{
				key: 'error',
				label: 'Error rate',
				value: '3.10%',
				status: 'critical',
				statusLabel: 'High',
				delta: '+1.4%',
				deltaPositive: false
			},
			{
				key: 'latency',
				label: 'p99 latency',
				value: '274 ms',
				status: 'healthy',
				statusLabel: 'Within target',
				delta: '-30 ms',
				deltaPositive: true
			},
			{
				key: 'availability',
				label: 'Availability',
				value: '99.20%',
				status: 'warning',
				statusLabel: 'Degraded',
				delta: '-0.6%',
				deltaPositive: false
			}
		]
	};

	// 120 samples per KPI, tail-sliced to the active window so it ends "now".
	const SPARKLINES: Record<string, number[]> = {
		// prettier-ignore
		health: [97.6, 97.6, 97.7, 97.6, 98, 97.4, 96.5, 97.3, 97.3, 97, 97, 97.6, 96.8, 97.2, 91.7, 92.2, 95, 96.3, 96.5, 96.4, 96.8, 95.9, 96.7, 96.7, 96.4, 97.1, 97, 97, 96.1, 96.7, 96, 95.7, 96.9, 97.3, 96.1, 95.8, 96.9, 96.2, 96.6, 96.7, 97.2, 92.7, 96.5, 97.2, 96.5, 95.8, 96, 97.4, 96.8, 96.9, 96.4, 96.9, 97.3, 96.2, 97.3, 96.2, 97, 97.3, 89.5, 90.1, 91.8, 95.1, 96.4, 97.7, 97.2, 97.8, 97, 97.5, 97.1, 98, 96.8, 96.8, 97.7, 97.7, 96.8, 97.2, 93.2, 95.3, 97.2, 97.7, 97.3, 98.2, 97.6, 97.3, 97, 97.4, 96.5, 98, 96.9, 97.1, 96.5, 96.4, 97.6, 87.4, 90, 94.1, 97.1, 97.1, 97.5, 97.6, 96.9, 96.9, 96.8, 96.5, 95.8, 96.7, 96.7, 97.2, 91.7, 91.5, 92.3, 95.3, 96.9, 97.4, 96.8, 97.9, 97.5, 98.3, 97.9, 98.6],
		// prettier-ignore
		error: [0.62, 0.64, 0.98, 0.82, 0.86, 0.83, 1.02, 1.29, 1.24, 2.41, 1.57, 0.96, 0.91, 1.43, 1.36, 1.16, 1.33, 0.95, 1.18, 1.3, 1.48, 1.05, 1.41, 1.06, 1.03, 1.36, 1, 3.71, 2.85, 1.7, 1.41, 1.29, 1.35, 1.35, 1.19, 1.27, 1.2, 0.91, 0.95, 1.06, 1.26, 1.28, 1.19, 1.09, 2.21, 1.52, 0.83, 0.94, 1.17, 0.81, 1.11, 1.24, 1.18, 0.76, 1.09, 1.08, 1.22, 1.02, 1, 5.18, 4.39, 3.74, 2.23, 1, 1.3, 1.53, 1.42, 1.16, 1.18, 1.52, 1.45, 1.34, 3.13, 2.1, 1.66, 1.74, 1.69, 1.33, 1.43, 1.73, 1.73, 1.51, 1.63, 1.55, 1.56, 1.74, 2, 1.46, 5.44, 4.33, 2.3, 1.99, 1.77, 1.82, 1.98, 1.86, 1.88, 1.51, 1.42, 1.82, 1.71, 3.88, 2.22, 1.72, 1.65, 1.64, 1.42, 1.69, 1.39, 1.81, 1.66, 1.3, 1.32, 1.75, 6.22, 5.03, 2.35, 1.39, 1.25, 1.84],
		// prettier-ignore
		latency: [322, 371, 287, 357, 313, 353, 320, 617, 421, 363, 377, 399, 350, 401, 421, 420, 430, 365, 401, 797, 635, 477, 365, 412, 380, 421, 380, 411, 393, 401, 436, 378, 376, 569, 389, 419, 417, 342, 347, 376, 385, 347, 393, 328, 328, 367, 304, 871, 812, 707, 411, 317, 316, 367, 331, 320, 354, 349, 326, 309, 323, 631, 396, 306, 295, 293, 355, 334, 324, 372, 1012, 850, 489, 355, 324, 346, 353, 406, 365, 362, 377, 348, 437, 423, 664, 437, 397, 413, 402, 427, 404, 438, 491, 479, 447, 500, 440, 903, 776, 555, 476, 506, 439, 461, 502, 496, 485, 474, 470, 503, 1198, 1080, 930, 609, 456, 507, 426, 451, 427, 512],
		// prettier-ignore
		availability: [99.891, 99.956, 99.885, 99.964, 99.882, 99.92, 99.696, 99.897, 99.913, 99.948, 99.918, 99.942, 99.921, 99.928, 99.94, 99.902, 99.551, 99.853, 99.853, 99.891, 99.887, 99.926, 99.912, 99.911, 99.739, 99.873, 99.877, 99.85, 99.844, 99.895, 99.854, 99.851, 99.912, 99.426, 99.593, 99.821, 99.851, 99.928, 99.767, 99.852, 99.854, 99.866, 99.87, 99.929, 99.856, 99.925, 99.672, 99.882, 99.926, 99.865, 99.944, 99.941, 99.807, 99.91, 99.892, 99.922, 99.937, 99.338, 99.491, 99.743, 99.925, 99.871, 99.95, 99.909, 99.949, 99.687, 99.844, 99.911, 99.93, 99.882, 99.894, 99.536, 99.833, 99.867, 99.927, 99.88, 99.883, 99.926, 99.895, 99.653, 99.827, 99.906, 99.941, 99.893, 99.863, 99.916, 99.781, 99.885, 99.846, 99.896, 99.876, 99.485, 99.534, 99.738, 99.832, 99.241, 99.321, 99.422, 99.698, 99.828, 99.824, 99.837, 99.828, 99.61, 99.761, 99.878, 99.843, 99.845, 99.529, 99.75, 99.838, 99.83, 99.423, 99.728, 99.817, 99.827, 99.811, 99.871, 99.925, 99.98]
	};

	// ============= DRILL-DOWN ROWS =============

	const HOST_ROWS: HostRow[] = [
		{
			id: '1',
			service: 'checkout-api',
			environment: 'production',
			region: 'us-east-1',
			instances: 24,
			rpm: 9240,
			errorRate: 2.1,
			p99: 512,
			status: 'warning'
		},
		{
			id: '2',
			service: 'checkout-api',
			environment: 'production',
			region: 'us-west-2',
			instances: 18,
			rpm: 6110,
			errorRate: 0.3,
			p99: 214,
			status: 'healthy'
		},
		{
			id: '3',
			service: 'checkout-api',
			environment: 'production',
			region: 'eu-west-1',
			instances: 12,
			rpm: 3980,
			errorRate: 0.4,
			p99: 236,
			status: 'healthy'
		},
		{
			id: '4',
			service: 'search-indexer',
			environment: 'production',
			region: 'us-east-1',
			instances: 16,
			rpm: 4120,
			errorRate: 5.8,
			p99: 1180,
			status: 'critical'
		},
		{
			id: '5',
			service: 'search-indexer',
			environment: 'production',
			region: 'ap-southeast-1',
			instances: 8,
			rpm: 2040,
			errorRate: 0.9,
			p99: 342,
			status: 'healthy'
		},
		{
			id: '6',
			service: 'payments',
			environment: 'production',
			region: 'us-east-1',
			instances: 20,
			rpm: 5310,
			errorRate: 0.2,
			p99: 188,
			status: 'healthy'
		},
		{
			id: '7',
			service: 'payments',
			environment: 'production',
			region: 'eu-west-1',
			instances: 10,
			rpm: 2760,
			errorRate: 0.2,
			p99: 205,
			status: 'healthy'
		},
		{
			id: '8',
			service: 'edge-cdn',
			environment: 'production',
			region: 'eu-west-1',
			instances: 30,
			rpm: 14820,
			errorRate: 1.6,
			p99: 402,
			status: 'warning'
		},
		{
			id: '9',
			service: 'auth',
			environment: 'production',
			region: 'us-west-2',
			instances: 14,
			rpm: 4530,
			errorRate: 0.1,
			p99: 96,
			status: 'healthy'
		},
		{
			id: '10',
			service: 'notifications',
			environment: 'production',
			region: 'ap-southeast-1',
			instances: 6,
			rpm: 1210,
			errorRate: 0.5,
			p99: 268,
			status: 'healthy'
		},
		{
			id: '11',
			service: 'checkout-api',
			environment: 'staging',
			region: 'us-east-1',
			instances: 3,
			rpm: 420,
			errorRate: 0.4,
			p99: 198,
			status: 'healthy'
		},
		{
			id: '12',
			service: 'search-indexer',
			environment: 'staging',
			region: 'us-east-1',
			instances: 2,
			rpm: 180,
			errorRate: 1.1,
			p99: 356,
			status: 'warning'
		},
		{
			id: '13',
			service: 'checkout-api',
			environment: 'development',
			region: 'us-west-2',
			instances: 1,
			rpm: 44,
			errorRate: 3.2,
			p99: 274,
			status: 'warning'
		},
		{
			id: '14',
			service: 'auth',
			environment: 'development',
			region: 'us-west-2',
			instances: 1,
			rpm: 38,
			errorRate: 6.4,
			p99: 512,
			status: 'critical'
		}
	];

	// ============= ALERTS =============

	const ALERT_STATE_TOKEN: Record<
		AlertState,
		{ label: string; color: 'red' | 'yellow' | 'green' }
	> = {
		firing: { label: 'Firing', color: 'red' },
		acknowledged: { label: 'Ack', color: 'yellow' },
		resolved: { label: 'Resolved', color: 'green' }
	};

	const ALERTS: Alert[] = [
		{
			id: 'AL-8842',
			severity: 'critical',
			title: 'search-indexer 5xx rate above 5%',
			service: 'search-indexer · us-east-1',
			at: '2026-06-30T21:14:00Z',
			state: 'firing'
		},
		{
			id: 'AL-8841',
			severity: 'warning',
			title: 'checkout-api p99 latency above 500ms',
			service: 'checkout-api · us-east-1',
			at: '2026-06-30T21:02:00Z',
			state: 'firing'
		},
		{
			id: 'AL-8840',
			severity: 'warning',
			title: 'edge-cdn cache hit ratio degraded',
			service: 'edge-cdn · eu-west-1',
			at: '2026-06-30T20:41:00Z',
			state: 'acknowledged'
		},
		{
			id: 'AL-8839',
			severity: 'critical',
			title: 'auth error rate spike in dev cluster',
			service: 'auth · us-west-2',
			at: '2026-06-30T20:18:00Z',
			state: 'acknowledged'
		},
		{
			id: 'AL-8838',
			severity: 'warning',
			title: 'notifications queue depth climbing',
			service: 'notifications · ap-southeast-1',
			at: '2026-06-30T19:55:00Z',
			state: 'firing'
		},
		{
			id: 'AL-8837',
			severity: 'warning',
			title: 'payments settlement job heartbeat missed',
			service: 'payments · us-east-1',
			at: '2026-06-30T18:30:00Z',
			state: 'resolved'
		}
	];

	const ALERT_ORDER: AlertState[] = ['firing', 'acknowledged', 'resolved'];

	const ALERT_GROUPS = ALERT_ORDER.map((state) => ({
		state,
		items: ALERTS.filter((a) => a.state === state)
	})).filter((group) => group.items.length > 0);

	const FIRING_COUNT = ALERTS.filter((a) => a.state === 'firing').length;

	// ============= SHARED CHART GEOMETRY =============

	const AXIS_TICK = 'var(--font-size-sm, 12px)';
	const TICK_STYLE = `font-size: ${AXIS_TICK}; fill: var(--color-text-secondary, #4E606F);`;
	const GRID_STROKE = 'var(--color-border, rgba(5, 54, 89, 0.1))';

	// Shared so both cards in the grid row align. The margins reserve the overhang
	// of centered axis ticks, without which the tallest y-label is clipped.
	const CHART_HEIGHT = 280;
	const CHART_MARGIN = { top: 12, right: 16, left: 0, bottom: 4 };
	const Y_AXIS_WIDTH = 56;
	// recharts' default XAxis height: the band its tick labels occupy.
	const X_AXIS_HEIGHT = 30;

	// `linear` + miter joins keep every sample a straight segment — `monotone`
	// would round the spikes into a curve no real metric produces.
	const LINE_STROKE_WIDTH = 1.5;

	const BLUE = 'var(--color-data-categorical-blue, #0171E3)';
	const ORANGE = 'var(--color-data-categorical-orange, #EB6E00)';
	const PURPLE = 'var(--color-data-categorical-purple, #6B1EFD)';
	const TEAL = 'var(--color-data-categorical-teal, #08A3A3)';

	const LATENCY_LINES: ChartLine[] = [
		{ key: 'p50', name: 'p50', color: BLUE },
		{ key: 'p95', name: 'p95', color: ORANGE },
		{ key: 'p99', name: 'p99', color: PURPLE }
	];

	const TRAFFIC_LINES: ChartLine[] = [
		{ key: 'useast', name: 'us-east-1', color: BLUE },
		{ key: 'uswest', name: 'us-west-2', color: TEAL },
		{ key: 'euwest', name: 'eu-west-1', color: ORANGE }
	];

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

	function chartPlot(width: number) {
		return {
			left: CHART_MARGIN.left + Y_AXIS_WIDTH,
			right: width - CHART_MARGIN.right,
			top: CHART_MARGIN.top,
			bottom: CHART_HEIGHT - CHART_MARGIN.bottom - X_AXIS_HEIGHT
		};
	}

	function chartX(plot: ReturnType<typeof chartPlot>, count: number, t: number): number {
		return scale(t, 0, count - 1, plot.left, plot.right);
	}

	function chartY(plot: ReturnType<typeof chartPlot>, max: number, value: number): number {
		return scale(value, 0, max, plot.bottom, plot.top);
	}

	// `MetricChart`'s data: every line multiplied by the environment's factor and
	// rounded, exactly as upstream's `useMemo` builds it.
	function buildChartRows(
		series: WindowSeries,
		lines: ChartLine[],
		factor: number
	): ChartRow[] {
		return series.points.map((point) => {
			const values = {} as Record<MetricKey, number>;
			for (const line of lines) {
				values[line.key] = Math.round(point[line.key] * factor);
			}
			return { t: point.t, label: point.label, values };
		});
	}

	// `<LineChart height={40}>` sparkline: `<YAxis hide domain={['dataMin',
	// 'dataMax']} />`, `margin={{top: 4, right: 0, left: 0, bottom: 2}}`. Rendered
	// into a viewBox whose X unit is the point index, so no measurement is needed.
	function sparkPoints(data: number[], height: number): string {
		const min = Math.min(...data);
		const max = Math.max(...data);
		return data.map((v, i) => `${i},${scale(v, min, max, height - 2, 4)}`).join(' ');
	}

	// ============= UPTIME HISTORY =============

	// Deliberately on its own time base, not the header's 1h/1d/7d control: uptime
	// is measured in days. Environment and region still filter the roster.
	const UPTIME_DAYS = 90;

	// Mirrors the bar colours in the page `<style>`. The legend needs values, the
	// bars need static rules. Keep the two in sync by hand.
	const UPTIME_COLOR: Record<UptimeStatus, string> = {
		operational: 'var(--color-success, #0D8626)',
		degraded: 'var(--color-warning, #E9AF08)',
		down: 'var(--color-error, #E3193B)'
	};

	const UPTIME_LABEL: Record<UptimeStatus, string> = {
		operational: 'Operational',
		degraded: 'Partial degradation',
		down: 'Downtime'
	};

	const UPTIME_ORDER: UptimeStatus[] = ['operational', 'degraded', 'down'];

	// Percentage of the day served — a down day is a partial outage, not 24h lost.
	const DAY_UPTIME: Record<UptimeStatus, number> = {
		operational: 100,
		degraded: 98.4,
		down: 82
	};

	// How much rougher each environment's history runs than production's.
	const UPTIME_ENV_RISK: Record<Environment, number> = {
		production: 1,
		staging: 1.6,
		development: 3
	};

	// An unhealthy service didn't get there in a day; its record reads worse.
	const UPTIME_STATUS_RISK: Record<HealthStatus, number> = {
		healthy: 1,
		warning: 3.5,
		critical: 7
	};

	// The strip's last bar has to agree with what the rest of the page reports.
	const UPTIME_TODAY: Record<HealthStatus, UptimeStatus> = {
		healthy: 'operational',
		warning: 'degraded',
		critical: 'down'
	};

	// Stable per service, so a history doesn't reshuffle as the roster is filtered.
	function seedForService(service: string): number {
		let h = 7;
		for (let i = 0; i < service.length; i++) {
			h = (h * 31 + service.charCodeAt(i)) % 9973;
		}
		return h;
	}

	function buildUptime(
		service: string,
		environment: Environment,
		status: HealthStatus
	): ServiceUptime {
		const seed = seedForService(service);
		const risk = UPTIME_ENV_RISK[environment] * UPTIME_STATUS_RISK[status];

		// Fixed quotas rather than a per-day coin flip: over 90 draws the variance of
		// independent rolls swamps the risk signal. The ±40% wobble keeps same-status
		// peers from rendering identically without reordering the bands.
		const downWobble = 0.6 + 0.8 * hashNoise(seed, 3.7);
		const degradedWobble = 0.6 + 0.8 * hashNoise(seed, 5.9);
		const downCount = Math.round(UPTIME_DAYS * Math.min(0.09, 0.005 * risk) * downWobble);
		const degradedCount = Math.round(
			UPTIME_DAYS * Math.min(0.32, 0.02 * risk) * degradedWobble
		);

		const ranked = Array.from({ length: UPTIME_DAYS }, (_, i) => i).sort(
			(a, b) => hashNoise(b, seed) - hashNoise(a, seed)
		);
		const days: UptimeStatus[] = new Array(UPTIME_DAYS).fill('operational');
		for (let k = 0; k < downCount; k++) {
			days[ranked[k]] = 'down';
		}
		for (let k = downCount; k < downCount + degradedCount; k++) {
			days[ranked[k]] = 'degraded';
		}
		days[UPTIME_DAYS - 1] = UPTIME_TODAY[status];

		// Per-service, not per-day: a per-day wobble averages out to the same figure
		// for every service, leaving equal-quota peers showing an identical number.
		const cleanDay = DAY_UPTIME.operational - 0.02 - hashNoise(seed, 11.3) * 0.06;

		let served = 0;
		let degradedDays = 0;
		let downDays = 0;
		for (let i = 0; i < UPTIME_DAYS; i++) {
			const day = days[i];
			if (day === 'operational') {
				served += cleanDay - hashNoise(i, seed + 1) * 0.02;
			} else {
				served += DAY_UPTIME[day];
				if (day === 'degraded') {
					degradedDays++;
				} else {
					downDays++;
				}
			}
		}

		return {
			service,
			status,
			days,
			uptime: served / UPTIME_DAYS,
			degradedDays,
			downDays
		};
	}

	// Index 0 is the oldest day, UPTIME_DAYS - 1 is today.
	function dayLabel(i: number): string {
		const ago = UPTIME_DAYS - 1 - i;
		if (ago === 0) {
			return 'Today';
		}
		return ago === 1 ? 'Yesterday' : `${ago} days ago`;
	}

	function uptimeEntries(rows: HostRow[], environment: Environment): ServiceUptime[] {
		const worst = new Map<string, HealthStatus>();
		for (const row of rows) {
			const prev = worst.get(row.service);
			if (prev === undefined || SEVERITY_RANK[row.status] < SEVERITY_RANK[prev]) {
				worst.set(row.service, row.status);
			}
		}
		// Alphabetical, not worst-first — the rail already triages by severity.
		return [...worst.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([service, status]) => buildUptime(service, environment, status));
	}

	// ============= CONTROL OPTIONS =============

	const ENV_OPTIONS = [
		{ value: 'production', label: 'Production' },
		{ value: 'staging', label: 'Staging' },
		{ value: 'development', label: 'Development' }
	];

	const REGION_OPTIONS = [
		{ value: 'all', label: 'All regions' },
		{ value: 'us-east-1', label: 'us-east-1' },
		{ value: 'us-west-2', label: 'us-west-2' },
		{ value: 'eu-west-1', label: 'eu-west-1' },
		{ value: 'ap-southeast-1', label: 'ap-southeast-1' }
	];

	// Every window stays densely sampled — a thinned sparkline smooths its spikes.
	const SPARK_LEN: Record<TimeWindow, number> = { '1h': 60, '1d': 90, '7d': 120 };

	// ============= MAIN COMPONENT STATE =============

	let timeWindow = $state<TimeWindow>('1d');
	let environment = $state<Environment>('production');
	let region = $state('all');

	const isNarrow = useMediaQuery(() => '(max-width: 1024px)');

	const series = $derived(SERIES[timeWindow]);
	const kpis = $derived(KPI_BY_ENV[environment]);
	const sparkLen = $derived(SPARK_LEN[timeWindow]);

	const rows = $derived(
		HOST_ROWS.filter(
			(r) => r.environment === environment && (region === 'all' || r.region === region)
		)
	);

	// Restates the active filters, since the rail rows carry no column headers.
	const breakdownContext = $derived(
		`${ENV_OPTIONS.find((e) => e.value === environment)?.label} · ${
			REGION_OPTIONS.find((r) => r.value === region)?.label
		}`
	);

	const latencyRows = $derived(
		buildChartRows(series, LATENCY_LINES, ENV_LATENCY_FACTOR[environment])
	);
	const trafficRows = $derived(buildChartRows(series, TRAFFIC_LINES, ENV_FACTOR[environment]));

	const latencyTicks = $derived(
		niceTicks(Math.max(...latencyRows.flatMap((row) => LATENCY_LINES.map((l) => row.values[l.key]))))
	);
	const latencyMax = $derived(latencyTicks[latencyTicks.length - 1] ?? 0);
	const trafficTicks = $derived(
		niceTicks(Math.max(...trafficRows.flatMap((row) => TRAFFIC_LINES.map((l) => row.values[l.key]))))
	);
	const trafficMax = $derived(trafficTicks[trafficTicks.length - 1] ?? 0);

	let latencyWidth = $state(0);
	let trafficWidth = $state(0);
	let latencyHoverIndex: number | null = $state(null);
	let trafficHoverIndex: number | null = $state(null);

	const latencyPlot = $derived(chartPlot(latencyWidth));
	const trafficPlot = $derived(chartPlot(trafficWidth));

	const latencyHoverRow = $derived(
		latencyHoverIndex === null ? null : (latencyRows[latencyHoverIndex] ?? null)
	);
	const trafficHoverRow = $derived(
		trafficHoverIndex === null ? null : (trafficRows[trafficHoverIndex] ?? null)
	);

	function onChartMove(event: PointerEvent, which: 'latency' | 'traffic') {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const plot = which === 'latency' ? latencyPlot : trafficPlot;
		const x = event.clientX - bounds.left;
		if (x < plot.left || x > plot.right) {
			if (which === 'latency') {
				latencyHoverIndex = null;
			} else {
				trafficHoverIndex = null;
			}
			return;
		}
		const count = (which === 'latency' ? latencyRows : trafficRows).length;
		const t = scale(x, plot.left, plot.right, 0, count - 1);
		const index = Math.max(0, Math.min(count - 1, Math.round(t)));
		if (which === 'latency') {
			latencyHoverIndex = index;
		} else {
			trafficHoverIndex = index;
		}
	}

	function errorColor(rate: number): 'red' | 'yellow' | 'green' {
		if (rate >= 5) {
			return 'red';
		}
		return rate >= 1.5 ? 'yellow' : 'green';
	}

	// Abbreviated — the traffic chart carries the exact figures.
	function formatRpm(rpm: number): string {
		return rpm >= 1000 ? `${(rpm / 1000).toFixed(1)}k rpm` : `${rpm} rpm`;
	}

	// Per-service drill-down as rail rows rather than a wide table: a rail has room
	// for about two of the seven columns this data would need. Rows sort
	// worst-first, since a scrolling rail can't be scanned like a grid.
	function sortRows(items: HostRow[]): HostRow[] {
		return [...items].sort(
			(a, b) =>
				SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || b.errorRate - a.errorRate
		);
	}
</script>

<!-- ============= SHARED CHART PIECES ============= -->

{#snippet legendDot(color: string, label: string)}
	<HStack gap={2} vAlign="center">
		<Icon icon={StopIcon} size="xsm" style="color: {color};" />
		<Text type="supporting" color="secondary">{label}</Text>
	</HStack>
{/snippet}

{#snippet chartTooltip(row: ChartRow, lines: ChartLine[], unit: string)}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{row.label}</Text>
			{#each lines as line (line.key)}
				{@render legendDot(
					line.color,
					`${line.name}: ${row.values[line.key].toLocaleString()}${unit}`
				)}
			{/each}
		</VStack>
	</Card>
{/snippet}

<!-- ============= CHART CARDS ============= -->

{#snippet metricChartSvg(
	width: number,
	rows: ChartRow[],
	lines: ChartLine[],
	plot: ReturnType<typeof chartPlot>,
	hoverIndex: number | null,
	yTicks: number[],
	yMax: number,
	unit: string,
	hasAxisUnit: boolean
)}
	{@const x = (t: number) => chartX(plot, rows.length, t)}
	{@const y = (value: number) => chartY(plot, yMax, value)}
	<svg width={width} height={CHART_HEIGHT} aria-hidden="true">
		{#each yTicks as tick (tick)}
			<line
				x1={plot.left}
				x2={plot.right}
				y1={y(tick)}
				y2={y(tick)}
				stroke={GRID_STROKE}
			/>
		{/each}
		{#each lines as line (line.key)}
			<polyline
				points={rows.map((row) => `${x(row.t)},${y(row.values[line.key])}`).join(' ')}
				fill="none"
				stroke={line.color}
				stroke-width={LINE_STROKE_WIDTH}
				stroke-linejoin="miter"
				stroke-linecap="butt"
			/>
		{/each}
		{#each series.ticks as tick (tick)}
			<text
				x={x(tick)}
				y={plot.bottom + 20}
				text-anchor="middle"
				style={TICK_STYLE}>{series.tickLabels[tick] ?? ''}</text
			>
		{/each}
		{#each yTicks as tick (tick)}
			<text
				x={plot.left - 8}
				y={y(tick) + 4}
				text-anchor="end"
				style={TICK_STYLE}>{tick}{hasAxisUnit ? unit : ''}</text
			>
		{/each}
		{#if hoverIndex !== null && rows[hoverIndex]}
			<line
				x1={x(rows[hoverIndex].t)}
				x2={x(rows[hoverIndex].t)}
				y1={plot.top}
				y2={plot.bottom}
				stroke={GRID_STROKE}
			/>
		{/if}
	</svg>
{/snippet}

{#snippet latencyChart()}
	<!-- `role="presentation"` because the wrapper is pure layout: the `<svg>` is
	     `aria-hidden` (recharts' surface is no more accessible) and the tooltip is
	     a pointer-only affordance. -->
	<div
		class="chart"
		role="presentation"
		style="height: {CHART_HEIGHT}px;"
		bind:clientWidth={latencyWidth}
		onpointermove={(event) => onChartMove(event, 'latency')}
		onpointerleave={() => (latencyHoverIndex = null)}
	>
		{#if latencyWidth > 0}
			{@render metricChartSvg(
				latencyWidth,
				latencyRows,
				LATENCY_LINES,
				latencyPlot,
				latencyHoverIndex,
				latencyTicks,
				latencyMax,
				' ms',
				true
			)}
		{/if}
		{#if latencyHoverRow}
			<div
				class="chart-tooltip"
				style="left: {chartX(latencyPlot, latencyRows.length, latencyHoverRow.t)}px; top: {chartY(
					latencyPlot,
					latencyMax,
					latencyHoverRow.values[LATENCY_LINES[0].key]
				)}px;"
			>
				{@render chartTooltip(latencyHoverRow, LATENCY_LINES, ' ms')}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet trafficChart()}
	<!-- `role="presentation"`: see the latency chart's wrapper. -->
	<div
		class="chart"
		role="presentation"
		style="height: {CHART_HEIGHT}px;"
		bind:clientWidth={trafficWidth}
		onpointermove={(event) => onChartMove(event, 'traffic')}
		onpointerleave={() => (trafficHoverIndex = null)}
	>
		{#if trafficWidth > 0}
			{@render metricChartSvg(
				trafficWidth,
				trafficRows,
				TRAFFIC_LINES,
				trafficPlot,
				trafficHoverIndex,
				trafficTicks,
				trafficMax,
				' rpm',
				false
			)}
		{/if}
		{#if trafficHoverRow}
			<div
				class="chart-tooltip"
				style="left: {chartX(trafficPlot, trafficRows.length, trafficHoverRow.t)}px; top: {chartY(
					trafficPlot,
					trafficMax,
					trafficHoverRow.values[TRAFFIC_LINES[0].key]
				)}px;"
			>
				{@render chartTooltip(trafficHoverRow, TRAFFIC_LINES, ' rpm')}
			</div>
		{/if}
	</div>
{/snippet}

<!-- ============= KPI TILE ============= -->

{#snippet sparkline(data: number[], color: string)}
	<svg
		width="100%"
		height="40"
		viewBox="0 0 {data.length - 1} 40"
		preserveAspectRatio="none"
		aria-hidden="true"
	>
		<polyline
			points={sparkPoints(data, 40)}
			fill="none"
			stroke={color}
			stroke-width="1.25"
			stroke-linejoin="miter"
			stroke-linecap="butt"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{/snippet}

{#snippet kpiTile(kpi: Kpi, spark: number[])}
	<Card padding={4}>
		<VStack gap={2}>
			<HStack gap={2} vAlign="center">
				<StatusDot
					variant={STATUS_DOT[kpi.status]}
					label={kpi.statusLabel}
					tooltip={kpi.statusLabel}
					isPulsing={kpi.status === 'critical'}
				/>
				<Text type="label" color="secondary">{kpi.label}</Text>
			</HStack>
			<HStack gap={2} vAlign="center">
				<Heading level={2}>{kpi.value}</Heading>
				<HStack gap={1} vAlign="center">
					<Icon
						icon={kpi.deltaPositive ? ArrowUpIcon : ArrowDownIcon}
						size="xsm"
						color={kpi.deltaPositive ? 'success' : 'error'}
					/>
					<Text type="supporting" color="secondary">{kpi.delta}</Text>
				</HStack>
			</HStack>
			{@render sparkline(spark, STATUS_STROKE[kpi.status])}
		</VStack>
	</Card>
{/snippet}

<!-- ============= EMPTY STATES ============= -->

{#snippet checkCircleIcon()}
	<Icon icon={CheckCircleIcon} size="lg" color="success" />
{/snippet}

{#snippet serverStackIcon()}
	<Icon icon={ServerStackIcon} size="lg" />
{/snippet}

{#snippet noServices()}
	<EmptyState
		title="No services in this view"
		description="Nothing reports in the selected environment and region. Try widening the region filter."
		icon={serverStackIcon}
		isCompact
	/>
{/snippet}

<!-- ============= RAIL SECTIONS ============= -->

{#snippet railSection(
	icon: IconType,
	iconColor: 'error' | 'secondary',
	title: string,
	subtitle: string,
	badge: Snippet,
	hasStickyHeader: boolean,
	body: Snippet
)}
	<VStack gap={0}>
		<VStack gap={0} class={hasStickyHeader ? 'rail-sticky-header' : undefined}>
			<VStack gap={1} padding={4} class="rail-header">
				<HStack gap={2} vAlign="center">
					<Icon {icon} size="sm" color={iconColor} />
					<StackItem size="fill">
						<Heading level={3}>{title}</Heading>
					</StackItem>
					{@render badge()}
				</HStack>
				<Text type="supporting" color="secondary">{subtitle}</Text>
			</VStack>
			<Divider />
		</VStack>
		{@render body()}
	</VStack>
{/snippet}

{#snippet alertsBadge()}
	<Badge label={`${FIRING_COUNT} firing`} variant={FIRING_COUNT > 0 ? 'error' : 'neutral'} />
{/snippet}

<!-- ============= ALERTS FEED ============= -->

{#snippet alertsFeed(hasStickyHeader: boolean)}
	{#snippet body()}
		{#if ALERT_GROUPS.length === 0}
			<EmptyState
				title="All clear"
				description="No active alerts across the selected environment."
				icon={checkCircleIcon}
				isCompact
			/>
		{:else}
			{#each ALERT_GROUPS as group (group.state)}
				<List density="compact" hasDividers>
					{#each group.items as alert (alert.id)}
						{#snippet start()}
							<StatusDot
								variant={STATUS_DOT[alert.severity]}
								label={alert.severity}
								isPulsing={alert.state === 'firing' && alert.severity === 'critical'}
							/>
						{/snippet}
						{#snippet end()}
							<VStack gap={1} hAlign="end">
								<Token
									size="sm"
									color={ALERT_STATE_TOKEN[alert.state].color}
									label={ALERT_STATE_TOKEN[alert.state].label}
								/>
								<Timestamp value={alert.at} format="relative" color="secondary" />
							</VStack>
						{/snippet}
						<ListItem
							label={alert.title}
							description={alert.service}
							startContent={start}
							endContent={end}
						/>
					{/each}
				</List>
			{/each}
		{/if}
	{/snippet}
	{@render railSection(
		BellAlertIcon,
		FIRING_COUNT > 0 ? 'error' : 'secondary',
		'Active alerts',
		`${ALERTS.length} in the last 24h · newest first`,
		alertsBadge,
		hasStickyHeader,
		body
	)}
{/snippet}

<!-- ============= SERVICE BREAKDOWN ============= -->

{#snippet serviceBreakdown(
	items: HostRow[],
	contextLabel: string,
	hasStickyHeader: boolean
)}
	{@const sorted = sortRows(items)}
	{#snippet badge()}
		<Badge label={`${items.length}`} variant="neutral" />
	{/snippet}
	{#snippet body()}
		{#if sorted.length === 0}
			{@render noServices()}
		{:else}
			<List density="compact" hasDividers>
				{#each sorted as row (row.id)}
					{#snippet start()}
						<StatusDot
							variant={STATUS_DOT[row.status]}
							label={STATUS_LABEL[row.status]}
							isPulsing={row.status === 'critical'}
						/>
					{/snippet}
					{#snippet end()}
						<VStack gap={1} hAlign="end">
							<HStack gap={1} vAlign="center">
								<Text type="supporting" color="secondary">p99</Text>
								<Text type="body" weight="semibold">{row.p99} ms</Text>
							</HStack>
							<Token
								size="sm"
								color={errorColor(row.errorRate)}
								label={`${row.errorRate.toFixed(1)}% err`}
							/>
						</VStack>
					{/snippet}
					<ListItem
						label={row.service}
						description={`${row.region} · ${row.instances} hosts · ${formatRpm(row.rpm)}`}
						startContent={start}
						endContent={end}
					/>
				{/each}
			</List>
		{/if}
	{/snippet}
	{@render railSection(
		ServerStackIcon,
		'secondary',
		'Service breakdown',
		contextLabel,
		badge,
		hasStickyHeader,
		body
	)}
{/snippet}

<!-- ============= UPTIME HISTORY ============= -->

<!--
	One service's 90-day strip — a single image to assistive tech, not 90
	unlabelled boxes. Per-day detail rides on `title` rather than 90 Tooltips.
-->
{#snippet uptimeStrip(entry: ServiceUptime)}
	{@const summary =
		entry.downDays === 0 && entry.degradedDays === 0
			? `${UPTIME_DAYS}-day uptime for ${entry.service}: no incidents.`
			: `${UPTIME_DAYS}-day uptime for ${entry.service}: ${entry.degradedDays} degraded ${
					entry.degradedDays === 1 ? 'day' : 'days'
				}, ${entry.downDays} with downtime.`}
	<div class="uptime-strip" role="img" aria-label={summary}>
		{#each entry.days as day, i (i)}
			<div
				class="uptime-bar"
				style="background-color: {UPTIME_COLOR[day]};"
				title={`${dayLabel(i)} — ${UPTIME_LABEL[day]}`}
			></div>
		{/each}
	</div>
{/snippet}

{#snippet uptimeRow(entry: ServiceUptime)}
	<VStack gap={2}>
		<HStack gap={3} vAlign="center" hAlign="between">
			<HStack gap={2} vAlign="center">
				<StatusDot
					variant={STATUS_DOT[entry.status]}
					label={STATUS_LABEL[entry.status]}
					isPulsing={entry.status === 'critical'}
				/>
				<Heading level={4}>{entry.service}</Heading>
			</HStack>
			<Text type="supporting" color="secondary">
				{entry.uptime.toFixed(2)}% uptime
			</Text>
		</HStack>
		{@render uptimeStrip(entry)}
	</VStack>
{/snippet}

<!--
	The "All services" roster — one strip per *service*, not per deployment. The
	rail already lists service × region rows; each strip here takes the worst
	status across a service's regions.
-->
{#snippet allServicesUptime(
	items: HostRow[],
	env: Environment,
	contextLabel: string
)}
	{@const entries = uptimeEntries(items, env)}
	<VStack gap={6}>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
			<VStack>
				<Heading level={2}>All services</Heading>
				<Text type="supporting" color="secondary">
					Daily uptime over the last {UPTIME_DAYS} days · {contextLabel}
				</Text>
			</VStack>
			<HStack gap={4} vAlign="center" wrap="wrap">
				{#each UPTIME_ORDER as state (state)}
					{@render legendDot(UPTIME_COLOR[state], UPTIME_LABEL[state])}
				{/each}
			</HStack>
		</HStack>
		<Card padding={6}>
			{#if entries.length === 0}
				{@render noServices()}
			{:else}
				<VStack gap={6}>
					{#each entries as entry, index (entry.service)}
						{#if index > 0}
							<Divider />
						{/if}
						{@render uptimeRow(entry)}
					{/each}
				</VStack>
			{/if}
		</Card>
	</VStack>
{/snippet}

<!-- ============= MAIN ============= -->

{#snippet liveDot()}
	<StatusDot
		variant="success"
		label="Live"
		isPulsing
		tooltip="Auto-refreshing every 30s"
	/>
{/snippet}

{#snippet header()}
	<LayoutHeader padding={6} hasDivider>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
			<VStack gap={0} vAlign="center">
				<Heading level={1}>Service Health Monitor</Heading>
				<HStack gap={2} vAlign="center">
					{@render liveDot()}
					<Text type="supporting" color="secondary">
						Updated{' '}
						<Timestamp
							value="2026-06-30T21:15:00Z"
							format="relative"
							type="inherit"
							color="inherit"
						/>
					</Text>
				</HStack>
			</VStack>
			<HStack gap={2} vAlign="center">
				<SegmentedControl
					label="Time window"
					value={timeWindow}
					onChange={(value: string) => (timeWindow = value as TimeWindow)}
					size="lg"
				>
					<SegmentedControlItem label="1h" value="1h" />
					<SegmentedControlItem label="1d" value="1d" />
					<SegmentedControlItem label="7d" value="7d" />
				</SegmentedControl>
				<Selector
					label="Environment"
					isLabelHidden
					size="lg"
					options={ENV_OPTIONS}
					value={environment}
					onChange={(value: string) => (environment = value as Environment)}
				/>
				<Selector
					label="Region"
					isLabelHidden
					size="lg"
					options={REGION_OPTIONS}
					value={region}
					onChange={(value: string) => (region = value)}
				/>
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet content()}
	<LayoutContent padding={6}>
		<VStack gap={10}>
			<VStack gap={6}>
				<!-- Traffic-light KPI tiles -->
				<Grid columns={{ minWidth: 240, repeat: 'fit' }} gap={3}>
					{#each kpis as kpi (kpi.key)}
						{@render kpiTile(kpi, SPARKLINES[kpi.key].slice(-sparkLen))}
					{/each}
				</Grid>

				<!-- Time-series charts -->
				<Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={3}>
					<Card padding={6}>
						<VStack gap={4}>
							<VStack gap={1}>
								<Heading level={3}>Response latency</Heading>
								<Text type="supporting" color="secondary">
									Percentile latency across all services (ms)
								</Text>
							</VStack>
							{@render latencyChart()}
							<HStack gap={6} vAlign="center" wrap="wrap">
								{#each LATENCY_LINES as line (line.key)}
									{@render legendDot(line.color, line.name)}
								{/each}
							</HStack>
						</VStack>
					</Card>
					<Card padding={6}>
						<VStack gap={4}>
							<VStack gap={1}>
								<Heading level={3}>Request volume by region</Heading>
								<Text type="supporting" color="secondary">
									Requests per minute (rpm)
								</Text>
							</VStack>
							{@render trafficChart()}
							<HStack gap={6} vAlign="center" wrap="wrap">
								{#each TRAFFIC_LINES as line (line.key)}
									{@render legendDot(line.color, line.name)}
								{/each}
							</HStack>
						</VStack>
					</Card>
				</Grid>
			</VStack>

			<Divider />

			<!-- 90-day uptime roster -->
			{@render allServicesUptime(rows, environment, breakdownContext)}

			<!-- Below 1024px the rail folds in here, one card per section -->
			{#if isNarrow.matches}
				<VStack gap={4}>
					<Card padding={0}>
						{@render alertsFeed(false)}
					</Card>
					<Card padding={0}>
						{@render serviceBreakdown(rows, breakdownContext, false)}
					</Card>
				</VStack>
			{/if}
		</VStack>
	</LayoutContent>
{/snippet}

{#snippet end()}
	<LayoutPanel
		width={400}
		padding={0}
		hasDivider
		role="complementary"
		label="Alerts and service breakdown"
		isScrollable
	>
		<!-- One scroll region for the whole rail; the sticky section headers keep
		     the boundary between the two feeds legible. -->
		<VStack gap={0}>
			{@render alertsFeed(true)}
			<Divider />
			{@render serviceBreakdown(rows, breakdownContext, true)}
		</VStack>
	</LayoutPanel>
{/snippet}

<!--
	Layout height="fill" is height:100%, which needs a definite height the host's
	<html>/<body> don't set. Without this the rail grows instead of scrolling.
-->
<Layout
	height="fill"
	style="height: 100dvh;"
	{header}
	{content}
	end={isNarrow.matches ? undefined : end}
/>

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

	/* Upstream's `railStyles.header`: translucent, so the band reads the same on a
	   card and on the panel. */
	:global(.rail-header) {
		background-color: var(--color-background-muted);
	}

	/* The opaque layer the translucent band needs; without it the rows read
	   through the header as they scroll past. */
	:global(.rail-sticky-header) {
		position: sticky;
		inset-block-start: 0;
		z-index: 1;
		background-color: var(--color-background-surface);
	}

	/* Upstream's `uptimeStyles.strip`: below ~420px the row can't honor the 3px
	   bar floor, so it scrolls rather than thinning bars — that would hide the
	   outage days this strip shows. */
	.uptime-strip {
		display: flex;
		gap: 2px;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
	}

	/* No radius: at 3–8px wide the smallest token (4px) rounds a bar away. */
	.uptime-bar {
		flex-basis: 0;
		flex-grow: 1;
		min-width: 3px;
		height: 30px;
	}
</style>
