<!--
	Ported from upstream's `assets/templates/pages/dashboard-progress/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed.

	Charts. Upstream draws with `recharts`, a React-only library. The three
	charts are drawn inline here, driven by upstream's own recharts props so the
	mapping stays auditable:

	  `<ResponsiveContainer height={…}>`     → a `bind:clientWidth` wrapper
	  `<BarChart layout="vertical">`         → a measured SVG; the category band
	                                           is `plotHeight / rows`, and
	                                           `barCategoryGap={12}` is 12px off
	                                           each side of the band
	  `<Bar stackId="gantt">`                → one `<rect>` per milestone from
	                                           `X(offset)` to
	                                           `X(offset + duration)`, `rx={4}`
	  `<CartesianGrid vertical>`             → one `<line>` per X tick
	  `<ReferenceLine x label>`              → one dashed `<line>` + `<text>`
	  `<XAxis domain ticks tickFormatter>`   → `TIMELINE_TICKS` + `D<n>` labels
	  `<YAxis type="category">`              → `<text>` labels at band centres
	  `<Tooltip content cursor={{fill}}>`    → pointer tracking, a band wash and
	                                           `ganttTooltip`
	  `<PieChart>` / `<Pie startAngle 90>`   → measured-none `<svg>` at the fixed
	                                           208px frame; sector paths from the
	                                           same angles, gap and padding angle
	  `<Tooltip content>`                    → per-sector pointer tracking
	  `<LineChart>` / `<Line type="monotone">` → `monotonePath` (d3's monotoneX,
	                                           which is what recharts uses)
	  `<YAxis>` (no domain)                  → `niceTicks`, recharts' adaptive
	                                           nice-step algorithm over
	                                           `[0, 'auto']`

	Every colour, domain, tick, stroke width, margin and height below is
	upstream's literal value. Upstream passes tick styling as `tick={{fontSize,
	fill}}`; here it lands as an inline `style` on the `<text>`, which is where
	a CSS `var()` actually resolves.

	No chart animates: all three recharts series set `isAnimationActive={false}`,
	so there is no reveal to port. The only motion on this page is the chevron
	and selection motion the core components already own.

	`LegendDot`, `SectionHeading`, `CardHeading`, `PhaseEmptyState`,
	`GanttChart`, `TaskProgressDonut`, `BurndownChart`, `RisksPanel` and
	`ProgramHeader` are local sub-components upstream; here they are snippets.
	`RiskRow`'s upstream `useHoverCard` call is a hook, so it stays at component
	init — one per fixture row, in `riskHoverCards` — and the row itself is an
	`<li>` with the hook's attachment, exactly as upstream avoids a
	`display:contents` span between `<ul>` and `<li>`.
-->
<script lang="ts">
	import {
		Avatar,
		Badge,
		Button,
		Card,
		EmptyState,
		Grid,
		HStack,
		Heading,
		HoverCardLayer,
		Icon,
		Layout,
		LayoutContent,
		LayoutHeader,
		List,
		ListItem,
		ProgressBar,
		Section,
		SegmentedControl,
		SegmentedControlItem,
		Table,
		Text,
		Timestamp,
		VStack,
		proportional,
		useHoverCard,
		type HoverCardReturn,
		type TableColumn
	} from '@astryx-sv/core';
	import {
		ArrowDownTrayIcon,
		CheckCircleIcon,
		ExclamationTriangleIcon,
		FlagIcon
	} from '@fvilers/heroicons-svelte/24/outline';
	import { StopIcon } from '@fvilers/heroicons-svelte/24/solid';

	// ============= TYPES =============

	type Rag = 'onTrack' | 'atRisk' | 'blocked';
	type Phase = 'all' | 'build' | 'beta' | 'ga';
	type ReleasePhase = Exclude<Phase, 'all'>;

	interface Milestone {
		id: string;
		name: string;
		phase: ReleasePhase;
		// Day offsets on the shared TIMELINE_DAYS scale (project day 0 = kickoff).
		start: number;
		end: number;
		status: Rag;
		dateLabel: string;
	}

	interface Workstream extends Record<string, unknown> {
		id: string;
		name: string;
		owner: string;
		phase: ReleasePhase;
		percent: number;
		due: string;
		status: Rag;
	}

	interface Risk {
		id: string;
		title: string;
		workstream: string;
		phase: ReleasePhase;
		severity: Rag;
		owner: string;
		detail: string;
	}

	interface TaskStatusSegment {
		key: string;
		label: string;
		tasks: number;
		// Effort, not head count: `points` is what sizes the donut arc.
		points: number;
		color: string;
	}

	// ============= LABEL & TONE MAPPING =============

	const PHASE_LABEL: Record<ReleasePhase, string> = {
		build: 'Build',
		beta: 'Beta',
		ga: 'GA'
	};

	const RAG_LABEL: Record<Rag, string> = {
		onTrack: 'On track',
		atRisk: 'At risk',
		blocked: 'Blocked'
	};

	const RAG_BADGE: Record<Rag, 'green' | 'yellow' | 'red'> = {
		onTrack: 'green',
		atRisk: 'yellow',
		blocked: 'red'
	};

	// Leading icon for the program-status badge in the page header, the one badge
	// loud enough to earn one.
	const RAG_ICON = {
		onTrack: CheckCircleIcon,
		atRisk: ExclamationTriangleIcon,
		blocked: ExclamationTriangleIcon
	};

	// Chart fills for RAG status: the data-viz semantic anchors, not the UI status
	// tokens (--color-success/warning/error), so a milestone bar and a "blocked"
	// donut slice land on the same red.
	const RAG_FILL: Record<Rag, string> = {
		onTrack: 'var(--color-data-categorical-green, #0B991F)',
		atRisk: 'var(--color-data-categorical-orange, #EB6E00)',
		blocked: 'var(--color-data-categorical-red, #F5394F)'
	};

	// ============= CHART CHROME (design tokens w/ hex fallbacks) =============

	// The same slots `getChartColors()` resolves in @astryxdesign/charts, as CSS
	// vars rather than the hook because page templates depend only on core +
	// recharts. CHART_NEUTRAL is the reference-line / not-started tone.
	const CHART_GRID = 'var(--color-border, rgba(5, 54, 89, 0.1))';
	const CHART_LABEL = 'var(--color-text-secondary, #4E606F)';
	const CHART_NEUTRAL = 'var(--color-data-neutral, #8494A3)';

	const IDEAL_COLOR = CHART_NEUTRAL;
	const ACTUAL_COLOR = 'var(--color-data-categorical-blue, #0171E3)';
	const AXIS_TICK = `font-size: var(--font-size-sm, 12px); fill: ${CHART_LABEL};`;

	// ============= TIMELINE SCALE =============

	const TIMELINE_DAYS = 90;
	const TIMELINE_TICK_STEP = 15;
	const TIMELINE_TICKS = Array.from(
		{ length: TIMELINE_DAYS / TIMELINE_TICK_STEP + 1 },
		(_, i) => i * TIMELINE_TICK_STEP
	);

	// "Today" marker, as a day offset on the same scale.
	const PROJECT_DAY = 58;

	// ============= DATA =============

	// Task backlog by status. Tasks are not equally sized, so the fixture makes
	// count and effort diverge deliberately; points sum to the 320 the burndown
	// starts from. Statuses are categories rather than a scale, so the fills come
	// from the categorical palette, reusing the Gantt's anchors so one status means
	// one color everywhere on the page.
	const TASK_STATUS: TaskStatusSegment[] = [
		{
			key: 'closed',
			label: 'Closed',
			tasks: 86,
			points: 190,
			color: 'var(--color-data-categorical-blue, #0171E3)'
		},
		{
			key: 'inProgress',
			label: 'In progress',
			tasks: 24,
			points: 58,
			color: 'var(--color-data-categorical-green, #0B991F)'
		},
		{
			key: 'inReview',
			label: 'In review',
			tasks: 12,
			points: 24,
			color: 'var(--color-data-categorical-orange, #EB6E00)'
		},
		{
			key: 'blocked',
			label: 'Blocked',
			tasks: 5,
			points: 22,
			color: 'var(--color-data-categorical-red, #F5394F)'
		},
		{
			key: 'planned',
			label: 'Planned',
			tasks: 21,
			points: 26,
			color: CHART_NEUTRAL
		}
	];

	const MILESTONES: Milestone[] = [
		{
			id: 'm1',
			name: 'Kickoff & scoping',
			phase: 'build',
			start: 0,
			end: 8,
			status: 'onTrack',
			dateLabel: 'Apr 1 – Apr 9'
		},
		{
			id: 'm2',
			name: 'Architecture sign-off',
			phase: 'build',
			start: 8,
			end: 20,
			status: 'onTrack',
			dateLabel: 'Apr 9 – Apr 21'
		},
		{
			id: 'm3',
			name: 'Feature complete',
			phase: 'build',
			start: 20,
			end: 44,
			status: 'atRisk',
			dateLabel: 'Apr 21 – May 15'
		},
		{
			id: 'm4',
			name: 'Private beta',
			phase: 'beta',
			start: 44,
			end: 62,
			status: 'atRisk',
			dateLabel: 'May 15 – Jun 2'
		},
		{
			id: 'm5',
			name: 'Bug bash & hardening',
			phase: 'beta',
			start: 58,
			end: 72,
			status: 'blocked',
			dateLabel: 'May 29 – Jun 12'
		},
		{
			id: 'm6',
			name: 'GA readiness review',
			phase: 'ga',
			start: 72,
			end: 82,
			status: 'onTrack',
			dateLabel: 'Jun 12 – Jun 22'
		},
		{
			id: 'm7',
			name: 'Public launch',
			phase: 'ga',
			start: 82,
			end: 90,
			status: 'onTrack',
			dateLabel: 'Jun 22 – Jun 30'
		}
	];

	const WORKSTREAMS: Workstream[] = [
		{
			id: 'w1',
			name: 'Core platform',
			owner: 'Priya Raman',
			phase: 'build',
			percent: 100,
			due: '2026-04-21',
			status: 'onTrack'
		},
		{
			id: 'w2',
			name: 'Data pipeline',
			owner: 'Marcus Webb',
			phase: 'build',
			percent: 92,
			due: '2026-05-15',
			status: 'atRisk'
		},
		{
			id: 'w3',
			name: 'Web client',
			owner: 'Ana Duarte',
			phase: 'build',
			percent: 88,
			due: '2026-05-15',
			status: 'onTrack'
		},
		{
			id: 'w4',
			name: 'Beta onboarding',
			owner: 'Tom Okafor',
			phase: 'beta',
			percent: 64,
			due: '2026-06-02',
			status: 'atRisk'
		},
		{
			id: 'w5',
			name: 'Load & reliability',
			owner: 'Dana Whitfield',
			phase: 'beta',
			percent: 38,
			due: '2026-06-12',
			status: 'blocked'
		},
		{
			id: 'w6',
			name: 'Docs & enablement',
			owner: 'Sofia Marín',
			phase: 'ga',
			percent: 55,
			due: '2026-06-22',
			status: 'onTrack'
		},
		{
			id: 'w7',
			name: 'Launch marketing',
			owner: 'Kenji Watanabe',
			phase: 'ga',
			percent: 41,
			due: '2026-06-22',
			status: 'onTrack'
		},
		{
			id: 'w8',
			name: 'Go-to-market ops',
			owner: 'Lena Fischer',
			phase: 'ga',
			percent: 30,
			due: '2026-06-30',
			status: 'atRisk'
		}
	];

	const RISKS: Risk[] = [
		{
			id: 'r1',
			title: 'Load tests failing at 3x target concurrency',
			workstream: 'Load & reliability',
			phase: 'beta',
			severity: 'blocked',
			owner: 'Dana Whitfield',
			detail:
				'p99 latency degrades past SLO above 12k concurrent sessions. Root cause traced to connection-pool saturation; fix depends on the data-pipeline retry change landing first.'
		},
		{
			id: 'r2',
			title: 'Data pipeline backfill slower than planned',
			workstream: 'Data pipeline',
			phase: 'build',
			severity: 'atRisk',
			owner: 'Marcus Webb',
			detail:
				'Historical backfill is tracking two days behind. Mitigation: parallelizing the backfill workers; feature-complete date at risk if not recovered this week.'
		},
		{
			id: 'r3',
			title: 'Beta onboarding email deliverability',
			workstream: 'Beta onboarding',
			phase: 'beta',
			severity: 'atRisk',
			owner: 'Tom Okafor',
			detail:
				'Invite emails landing in spam for two enterprise domains. Working with IT to allowlist sending IPs before the private beta opens.'
		}
	];

	// Ideal vs. actual remaining scope (story points), one entry per week. Actual
	// trails ideal mid-project (scope discovery), then recovers late.
	const BURNDOWN = (() => {
		const total = 320;
		const actualRemaining = [320, 300, 286, 262, 240, 226, 210, 182, 150, 132, 96, 54, 20];
		const idealStep = total / (actualRemaining.length - 1);
		return actualRemaining.map((actual, i) => ({
			week: i,
			label: `W${i + 1}`,
			ideal: Math.max(0, Math.round(total - idealStep * i)),
			actual
		}));
	})();

	const BURNDOWN_TICKS = [0, 3, 6, 9, 12];

	// ============= DERIVED FROM DATA =============

	// Program-wide aggregates: unaffected by the phase filter, so computed once.
	const TASK_POINTS_TOTAL = TASK_STATUS.reduce((sum, s) => sum + s.points, 0);
	const TASK_COUNT_TOTAL = TASK_STATUS.reduce((sum, s) => sum + s.tasks, 0);

	// Worst status across every workstream wins.
	const PROGRAM_STATUS: Rag = WORKSTREAMS.some((w) => w.status === 'blocked')
		? 'blocked'
		: WORKSTREAMS.some((w) => w.status === 'atRisk')
			? 'atRisk'
			: 'onTrack';

	const byPhase = <T extends { phase: ReleasePhase }>(items: T[], phase: Phase): T[] =>
		phase === 'all' ? items : items.filter((item) => item.phase === phase);

	let phase = $state<Phase>('all');

	const milestones = $derived(byPhase(MILESTONES, phase));
	const workstreams = $derived(byPhase(WORKSTREAMS, phase));
	const risks = $derived(byPhase(RISKS, phase));

	// ============= CHART GEOMETRY =============
	// The stand-in for recharts. See the header comment.

	const CONTENT_COLUMN = 'width: 100%; max-width: 1440px; margin-inline: auto;';
	const RISK_DETAIL_STYLE = 'max-width: 320px;';

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
		// `calculateStep` pads the upper side when fewer ticks than requested cover
		// the interval, so a domain keeps the same number of grid lines.
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

	// ============= GANTT GEOMETRY =============

	const GANTT_MIN_HEIGHT = 160;
	const GANTT_ROW_HEIGHT = 44;
	const GANTT_MARGIN = { top: 4, right: 16, left: 8, bottom: 4 };
	const GANTT_Y_AXIS_WIDTH = 148;
	const GANTT_X_AXIS_HEIGHT = 30;

	let ganttWidth = $state(0);
	let ganttHover = $state<number | null>(null);
	let ganttPointer = $state({ x: 0, y: 0 });

	// Recharts renders a floating bar as a transparent offset segment plus a
	// colored duration segment stacked on top.
	const ganttData = $derived(
		milestones.map((m) => ({ ...m, offset: m.start, duration: m.end - m.start }))
	);
	const ganttHeight = $derived(
		Math.max(GANTT_MIN_HEIGHT, ganttData.length * GANTT_ROW_HEIGHT)
	);
	const ganttPlot = $derived({
		left: GANTT_MARGIN.left + GANTT_Y_AXIS_WIDTH,
		right: ganttWidth - GANTT_MARGIN.right,
		top: GANTT_MARGIN.top,
		bottom: ganttHeight - GANTT_MARGIN.bottom - GANTT_X_AXIS_HEIGHT
	});
	const ganttBand = $derived(
		ganttData.length === 0 ? 0 : (ganttPlot.bottom - ganttPlot.top) / ganttData.length
	);
	// `barCategoryGap={12}` is 12px on each side of the band.
	const ganttBarHeight = $derived(Math.max(0, ganttBand - 24));
	const ganttX = (day: number) => scale(day, 0, TIMELINE_DAYS, ganttPlot.left, ganttPlot.right);
	const ganttHoverPoint = $derived(ganttHover === null ? null : ganttData[ganttHover]);

	function onGanttMove(event: PointerEvent) {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		ganttPointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
		if (ganttBand <= 0) return;
		const index = Math.floor((ganttPointer.y - ganttPlot.top) / ganttBand);
		ganttHover = index >= 0 && index < ganttData.length ? index : null;
	}

	// ============= DONUT GEOMETRY =============

	const DONUT_SIZE = 208;
	const DONUT_OUTER_RADIUS = 104;
	const DONUT_INNER_RADIUS = 70;
	const DONUT_CENTER = DONUT_SIZE / 2;

	// The standard 2px gap between touching marks, which Recharts wants as an
	// angle: 2px of arc at the middle of the ring.
	const DONUT_GAP_ANGLE =
		(2 / ((DONUT_OUTER_RADIUS + DONUT_INNER_RADIUS) / 2)) * (180 / Math.PI);

	let donutHover = $state<string | null>(null);

	function donutPoint(radius: number, angle: number) {
		const radians = (angle * Math.PI) / 180;
		return {
			x: DONUT_CENTER + Math.cos(radians) * radius,
			y: DONUT_CENTER - Math.sin(radians) * radius
		};
	}

	function donutPath(startAngle: number, endAngle: number): string {
		const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
		const outerStart = donutPoint(DONUT_OUTER_RADIUS, startAngle);
		const outerEnd = donutPoint(DONUT_OUTER_RADIUS, endAngle);
		const innerStart = donutPoint(DONUT_INNER_RADIUS, startAngle);
		const innerEnd = donutPoint(DONUT_INNER_RADIUS, endAngle);
		return (
			`M${outerStart.x},${outerStart.y}` +
			`A${DONUT_OUTER_RADIUS},${DONUT_OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}` +
			`L${innerEnd.x},${innerEnd.y}` +
			`A${DONUT_INNER_RADIUS},${DONUT_INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x},${innerStart.y}Z`
		);
	}

	// Noon start, running clockwise, which puts "Closed" at the top. The gap is
	// paid once per non-zero sector, the same total padding recharts computes.
	const donutArcs = $derived.by(() => {
		const realTotalAngle = 360 - TASK_STATUS.length * DONUT_GAP_ANGLE;
		let angle = 90;
		return TASK_STATUS.map((segment) => {
			const sweep = (segment.points / TASK_POINTS_TOTAL) * realTotalAngle;
			const startAngle = angle;
			const endAngle = startAngle - sweep;
			angle = endAngle - DONUT_GAP_ANGLE;
			const middleRadius = (DONUT_OUTER_RADIUS + DONUT_INNER_RADIUS) / 2;
			return {
				...segment,
				startAngle,
				endAngle,
				path: donutPath(startAngle, endAngle),
				tooltipPosition: donutPoint(middleRadius, (startAngle + endAngle) / 2)
			};
		});
	});
	const donutHoverSegment = $derived(
		donutHover === null ? null : (donutArcs.find((a) => a.key === donutHover) ?? null)
	);

	function percentOfPoints(points: number): number {
		return Math.round((points / TASK_POINTS_TOTAL) * 100);
	}

	// ============= BURNDOWN GEOMETRY =============

	// Matches the donut frame so the two plots sharing the summary row read as one
	// band.
	const BURNDOWN_HEIGHT = DONUT_SIZE;
	const BURNDOWN_MARGIN = { top: 16, right: 4, left: 4, bottom: 4 };
	const BURNDOWN_Y_AXIS_WIDTH = 40;
	const BURNDOWN_X_AXIS_HEIGHT = 30;

	let burndownWidth = $state(0);
	let burndownHover = $state<number | null>(null);
	let burndownPointer = $state({ x: 0, y: 0 });

	const burndownPlot = $derived({
		left: BURNDOWN_MARGIN.left + BURNDOWN_Y_AXIS_WIDTH,
		right: burndownWidth - BURNDOWN_MARGIN.right,
		top: BURNDOWN_MARGIN.top,
		bottom: BURNDOWN_HEIGHT - BURNDOWN_MARGIN.bottom - BURNDOWN_X_AXIS_HEIGHT
	});
	const burndownYTicks = $derived(niceTicks(0, 320));
	const burndownYMax = $derived(burndownYTicks[burndownYTicks.length - 1] ?? 320);
	const burndownX = (week: number) =>
		scale(week, 0, BURNDOWN.length - 1, burndownPlot.left, burndownPlot.right);
	const burndownY = (value: number) =>
		scale(value, 0, burndownYMax, burndownPlot.bottom, burndownPlot.top);
	const idealPath = $derived(
		monotonePath(BURNDOWN.map((d) => ({ x: burndownX(d.week), y: burndownY(d.ideal) })))
	);
	const actualPath = $derived(
		monotonePath(BURNDOWN.map((d) => ({ x: burndownX(d.week), y: burndownY(d.actual) })))
	);
	const burndownHoverPoint = $derived(
		burndownHover === null ? null : BURNDOWN[burndownHover]
	);

	function onBurndownMove(event: PointerEvent) {
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		burndownPointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
		if (burndownPlot.right <= burndownPlot.left) return;
		const week = scale(burndownPointer.x, burndownPlot.left, burndownPlot.right, 0, BURNDOWN.length - 1);
		const index = Math.round(week);
		burndownHover = Math.max(0, Math.min(BURNDOWN.length - 1, index));
	}

	// ============= STATE =============

	// One hover card per fixture row. A hook cannot be called from a row snippet
	// without recreating its state on every render, and the row set is a fixture,
	// so the hooks are created once here.
	const idBase = $props.id();
	const riskHoverCards: Record<string, HoverCardReturn> = {};
	for (const risk of RISKS) {
		const riskId = risk.id;
		riskHoverCards[riskId] = useHoverCard(() => ({
			id: `${idBase}-${riskId}`,
			placement: 'below',
			alignment: 'start',
			focusTrigger: 'always'
		}));
	}

	const workstreamColumns = $derived.by<TableColumn<Workstream>[]>(() => [
		{
			key: 'name',
			header: 'Workstream',
			width: proportional(1, { minWidth: 160 }),
			renderCell: workstreamNameCell
		},
		{
			key: 'owner',
			header: 'Owner',
			width: proportional(1, { minWidth: 160 }),
			renderCell: workstreamOwnerCell
		},
		{
			key: 'percent',
			header: '% complete',
			width: proportional(2, { minWidth: 200 }),
			renderCell: workstreamPercentCell
		},
		{
			key: 'due',
			header: 'Due',
			width: proportional(1, { minWidth: 120 }),
			renderCell: workstreamDueCell
		},
		{
			key: 'status',
			header: 'Status',
			width: proportional(1, { minWidth: 120 }),
			renderCell: workstreamStatusCell
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

{#snippet sectionHeading(title: string, hint?: string)}
	<HStack hAlign="between" vAlign="center" gap={3}>
		<Heading level={2}>{title}</Heading>
		{#if hint}
			<Text type="supporting" color="secondary">{hint}</Text>
		{/if}
	</HStack>
{/snippet}

{#snippet cardHeading(title: string, hint?: string, meta?: string)}
	<HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
		<VStack>
			<Heading level={3} accessibilityLevel={2}>{title}</Heading>
			{#if hint}
				<Text type="supporting" color="secondary">{hint}</Text>
			{/if}
		</VStack>
		{#if meta}
			<Text type="body" color="secondary">{meta}</Text>
		{/if}
	</HStack>
{/snippet}

{#snippet phaseEmptyState(noun: string)}
	<EmptyState
		title={`No ${noun} in this phase`}
		description={`Switch phases to see other ${noun}.`}
		icon={flagIcon}
		isCompact
	/>
{/snippet}

{#snippet flagIcon()}
	<Icon icon={FlagIcon} size="lg" />
{/snippet}

{#snippet programStatusIcon()}
	<Icon icon={RAG_ICON[PROGRAM_STATUS]} size="sm" />
{/snippet}

{#snippet pageHeader()}
	<LayoutHeader padding={6} hasDivider>
		<HStack gap={3} vAlign="center" hAlign="between" wrap="wrap" style={CONTENT_COLUMN}>
			<VStack gap={1}>
				<Heading level={1}>Aurora Launch</Heading>
				<HStack gap={2} vAlign="center">
					<Text type="body" color="secondary">Target GA ·</Text>
					<Timestamp value="2026-06-30T00:00:00Z" format="date" type="body" color="secondary" />
					<Badge
						variant={RAG_BADGE[PROGRAM_STATUS]}
						label={RAG_LABEL[PROGRAM_STATUS]}
						icon={programStatusIcon}
					/>
				</HStack>
			</VStack>
			<HStack gap={2}>
				<SegmentedControl
					label="Release phase"
					value={phase}
					onChange={(value) => (phase = value as Phase)}
				>
					<SegmentedControlItem label="All" value="all" />
					<SegmentedControlItem label="Build" value="build" />
					<SegmentedControlItem label="Beta" value="beta" />
					<SegmentedControlItem label="GA" value="ga" />
				</SegmentedControl>
				<Button label="Export status" variant="secondary" icon={downloadIcon} />
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet downloadIcon()}
	<Icon icon={ArrowDownTrayIcon} size="sm" />
{/snippet}

<!-- ============= GANTT (milestone timeline) ============= -->

{#snippet ganttTooltip(milestone: (typeof ganttData)[number])}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="body" weight="semibold">{milestone.name}</Text>
			<Text type="supporting" color="secondary">
				{milestone.dateLabel} · {PHASE_LABEL[milestone.phase]}
			</Text>
		</VStack>
	</Card>
{/snippet}

{#snippet ganttChart()}
	<VStack gap={3}>
		<!-- `role="presentation"` because the wrapper is pure layout: the `<svg>` is
		     `aria-hidden` (recharts' surface is no more accessible) and the tooltip
		     is a pointer-only affordance. -->
		<div
			class="chart"
			role="presentation"
			style="height: {ganttHeight}px;"
			bind:clientWidth={ganttWidth}
			onpointermove={onGanttMove}
			onpointerleave={() => (ganttHover = null)}
		>
			{#if ganttWidth > 0}
				<svg width={ganttWidth} height={ganttHeight} aria-hidden="true">
					{#each TIMELINE_TICKS as tick (tick)}
						<line
							x1={ganttX(tick)}
							x2={ganttX(tick)}
							y1={ganttPlot.top}
							y2={ganttPlot.bottom}
							stroke={CHART_GRID}
						/>
					{/each}
					{#if ganttHoverPoint}
						<rect
							x={ganttPlot.left}
							y={ganttPlot.top + (ganttHover ?? 0) * ganttBand}
							width={Math.max(0, ganttPlot.right - ganttPlot.left)}
							height={ganttBand}
							fill={CHART_GRID}
							stroke="#ccc"
						/>
					{/if}
					{#each ganttData as milestone, index (milestone.id)}
						<rect
							x={ganttX(milestone.offset)}
							y={ganttPlot.top + index * ganttBand + 12}
							width={Math.max(0, ganttX(milestone.offset + milestone.duration) - ganttX(milestone.offset))}
							height={ganttBarHeight}
							rx="4"
							fill={RAG_FILL[milestone.status]}
						/>
					{/each}
					<line
						x1={ganttX(PROJECT_DAY)}
						x2={ganttX(PROJECT_DAY)}
						y1={ganttPlot.top}
						y2={ganttPlot.bottom}
						stroke={CHART_NEUTRAL}
						stroke-dasharray="4 4"
					/>
					<text
						x={ganttX(PROJECT_DAY)}
						y={ganttPlot.top - 4}
						text-anchor="middle"
						style="font-size: 11px; fill: {CHART_NEUTRAL};">Today</text
					>
					{#each ganttData as milestone, index (milestone.id)}
						<text
							x={ganttPlot.left - 8}
							y={ganttPlot.top + index * ganttBand + ganttBand / 2 + 4}
							text-anchor="end"
							style={AXIS_TICK}>{milestone.name}</text
						>
					{/each}
					{#each TIMELINE_TICKS as tick (tick)}
						<text
							x={ganttX(tick)}
							y={ganttPlot.bottom + 20}
							text-anchor="middle"
							style={AXIS_TICK}>{`D${tick}`}</text
						>
					{/each}
				</svg>
			{/if}
			{#if ganttHoverPoint}
				<div
					class="chart-tooltip"
					style="left: {ganttPointer.x}px; top: {ganttPointer.y}px;"
				>
					{@render ganttTooltip(ganttHoverPoint)}
				</div>
			{/if}
		</div>
		<HStack gap={4} vAlign="center" wrap="wrap">
			{@render legendDot(RAG_FILL.onTrack, RAG_LABEL.onTrack)}
			{@render legendDot(RAG_FILL.atRisk, RAG_LABEL.atRisk)}
			{@render legendDot(RAG_FILL.blocked, RAG_LABEL.blocked)}
		</HStack>
	</VStack>
{/snippet}

<!-- ============= TASK PROGRESS (weighted donut) ============= -->

{#snippet taskDonutTooltip(segment: (typeof donutArcs)[number])}
	<Card padding={3}>
		<VStack gap={1}>
			{@render legendDot(segment.color, segment.label)}
			<Text type="supporting" color="secondary" hasTabularNumbers>
				{percentOfPoints(segment.points)}% · {segment.points} pts · {segment.tasks} tasks
			</Text>
		</VStack>
	</Card>
{/snippet}

{#snippet taskProgressDonut()}
	<HStack gap={8} vAlign="center" wrap="wrap">
		<!-- Fixed size rather than a ResponsiveContainer: the ring geometry is
		     deliberate, and the card wraps the legend under it rather than
		     shrinking it. -->
		<div class="donut-frame">
			<svg width={DONUT_SIZE} height={DONUT_SIZE} role="presentation">
				{#each donutArcs as segment (segment.key)}
					<path
						d={segment.path}
						fill={segment.color}
						stroke="none"
						role="presentation"
						onpointerenter={() => (donutHover = segment.key)}
						onpointerleave={() => (donutHover = null)}
					/>
				{/each}
			</svg>
			{#if donutHoverSegment}
				<div
					class="chart-tooltip"
					style="left: {donutHoverSegment.tooltipPosition.x}px; top: {donutHoverSegment
						.tooltipPosition.y}px;"
				>
					{@render taskDonutTooltip(donutHoverSegment)}
				</div>
			{/if}
		</div>
		<!-- A key, not a table: per-segment figures live in the tooltip. -->
		<VStack gap={2}>
			{#each TASK_STATUS as segment (segment.key)}
				{@render legendDot(segment.color, segment.label)}
			{/each}
		</VStack>
	</HStack>
{/snippet}

<!-- ============= BURN-DOWN CHART ============= -->

{#snippet burndownTooltip(point: (typeof BURNDOWN)[number])}
	<Card padding={3}>
		<VStack gap={1}>
			<Text type="supporting" color="secondary">{point.label}</Text>
			{@render legendDot(IDEAL_COLOR, `Ideal: ${point.ideal} pts`)}
			{@render legendDot(ACTUAL_COLOR, `Actual: ${point.actual} pts`)}
		</VStack>
	</Card>
{/snippet}

{#snippet burndownChart()}
	<VStack gap={3}>
		<div
			class="chart"
			role="presentation"
			style="height: {BURNDOWN_HEIGHT}px;"
			bind:clientWidth={burndownWidth}
			onpointermove={onBurndownMove}
			onpointerleave={() => (burndownHover = null)}
		>
			{#if burndownWidth > 0}
				<svg width={burndownWidth} height={BURNDOWN_HEIGHT} aria-hidden="true">
					{#each burndownYTicks as tick (tick)}
						<line
							x1={burndownPlot.left}
							x2={burndownPlot.right}
							y1={burndownY(tick)}
							y2={burndownY(tick)}
							stroke={CHART_GRID}
						/>
					{/each}
					{#if burndownHoverPoint}
						<line
							x1={burndownX(burndownHoverPoint.week)}
							x2={burndownX(burndownHoverPoint.week)}
							y1={burndownPlot.top}
							y2={burndownPlot.bottom}
							stroke={CHART_GRID}
						/>
					{/if}
					<path
						d={idealPath}
						fill="none"
						stroke={IDEAL_COLOR}
						stroke-width="1"
						stroke-dasharray="4 4"
					/>
					<path d={actualPath} fill="none" stroke={ACTUAL_COLOR} stroke-width="2" />
					{#if burndownHoverPoint}
						<circle
							cx={burndownX(burndownHoverPoint.week)}
							cy={burndownY(burndownHoverPoint.ideal)}
							r="4"
							fill={IDEAL_COLOR}
							stroke="#fff"
							stroke-width="2"
						/>
						<circle
							cx={burndownX(burndownHoverPoint.week)}
							cy={burndownY(burndownHoverPoint.actual)}
							r="4"
							fill={ACTUAL_COLOR}
							stroke="#fff"
							stroke-width="2"
						/>
					{/if}
					{#each BURNDOWN_TICKS as tick (tick)}
						<text
							x={burndownX(tick)}
							y={burndownPlot.bottom + 20}
							text-anchor="middle"
							style={AXIS_TICK}>{BURNDOWN[tick]?.label ?? ''}</text
						>
					{/each}
					{#each burndownYTicks as tick (tick)}
						<text
							x={burndownPlot.left - 8}
							y={burndownY(tick) + 4}
							text-anchor="end"
							style={AXIS_TICK}>{tick} pts</text
						>
					{/each}
				</svg>
			{/if}
			{#if burndownHoverPoint}
				<div
					class="chart-tooltip"
					style="left: {burndownPointer.x}px; top: {burndownPointer.y}px;"
				>
					{@render burndownTooltip(burndownHoverPoint)}
				</div>
			{/if}
		</div>
		<HStack gap={4} vAlign="center" wrap="wrap">
			{@render legendDot(ACTUAL_COLOR, 'Actual remaining')}
			{@render legendDot(IDEAL_COLOR, 'Ideal burndown')}
		</HStack>
	</VStack>
{/snippet}

<!-- ============= RISKS LIST ============= -->

{#snippet riskRow(risk: Risk)}
	{@const hoverCard = riskHoverCards[risk.id]}
	{#snippet riskEnd()}
		<Badge variant={RAG_BADGE[risk.severity]} label={RAG_LABEL[risk.severity]} />
		<HoverCardLayer {hoverCard} placement="below" alignment="start">
			<VStack gap={2} style={RISK_DETAIL_STYLE}>
				<Text type="body" weight="semibold">{risk.title}</Text>
				<Text type="supporting" color="secondary">{risk.detail}</Text>
				<HStack gap={2} vAlign="center">
					<Avatar name={risk.owner} size="sm" />
					<Text type="supporting" color="secondary">{risk.owner}</Text>
				</HStack>
			</VStack>
		</HoverCardLayer>
	{/snippet}
	<ListItem
		tabindex={0}
		aria-describedby={hoverCard.describedBy}
		class="risk-row"
		label={risk.title}
		description={`${risk.workstream} · ${PHASE_LABEL[risk.phase]} · ${risk.owner}`}
		endContent={riskEnd}
		{@attach hoverCard.attachTrigger}
	/>
{/snippet}

{#snippet risksPanel(items: Risk[])}
	<Card padding={6}>
		<VStack gap={4}>
			{@render cardHeading('Blockers & risks', 'Hover or focus a row for detail')}
			{#if items.length === 0}
				<EmptyState
					title="No open blockers or risks"
					description="Nothing flagged for the selected phase. Keep it up."
					icon={noRisksIcon}
					isCompact
				/>
			{:else}
				<List hasDividers>
					{#each items as risk (risk.id)}
						{@render riskRow(risk)}
					{/each}
				</List>
			{/if}
		</VStack>
	</Card>
{/snippet}

{#snippet noRisksIcon()}
	<Icon icon={CheckCircleIcon} size="lg" color="success" />
{/snippet}

<!-- ============= WORKSTREAM TABLE ============= -->

{#snippet workstreamNameCell(item: Workstream)}
	<VStack gap={0}>
		<Text type="body" weight="semibold">{item.name}</Text>
		<Text type="supporting" color="secondary">{PHASE_LABEL[item.phase]}</Text>
	</VStack>
{/snippet}

{#snippet workstreamOwnerCell(item: Workstream)}
	<HStack gap={2} vAlign="center">
		<Avatar name={item.owner} size="sm" />
		<Text type="body">{item.owner}</Text>
	</HStack>
{/snippet}

{#snippet workstreamPercentCell(item: Workstream)}
	<VStack gap={1}>
		<ProgressBar
			value={item.percent}
			max={100}
			label={`${item.name} progress`}
			isLabelHidden
		/>
		<Text type="supporting" color="secondary">{item.percent}%</Text>
	</VStack>
{/snippet}

{#snippet workstreamDueCell(item: Workstream)}
	<Timestamp value={item.due} format="date" />
{/snippet}

{#snippet workstreamStatusCell(item: Workstream)}
	<Badge variant={RAG_BADGE[item.status]} label={RAG_LABEL[item.status]} />
{/snippet}

<!-- ============= MAIN COMPONENT ============= -->

{#snippet content()}
	<LayoutContent padding={0} style="padding-block-end: var(--spacing-10);">
		<Section padding={6} dividers={['bottom']}>
			<VStack gap={6} style={CONTENT_COLUMN}>
				{@render sectionHeading(
					'Milestone timeline',
					`Project days 0–${TIMELINE_DAYS} · dashed line marks today`
				)}
				{#if milestones.length === 0}
					{@render phaseEmptyState('milestones')}
				{:else}
					{@render ganttChart()}
				{/if}
			</VStack>
		</Section>

		<Section padding={6} paddingBlock={10}>
			<VStack gap={6} style={CONTENT_COLUMN}>
				<Grid gap={4} columns={{ minWidth: 320, max: 3 }}>
					<Card padding={6}>
						<VStack gap={5}>
							{@render cardHeading(
								'Overall progress',
								`${TASK_COUNT_TOTAL} tasks · ${TASK_POINTS_TOTAL} story points`
							)}
							{@render taskProgressDonut()}
						</VStack>
					</Card>

					<Card padding={6}>
						<VStack gap={5}>
							{@render cardHeading(
								'Scope burndown',
								`Remaining story points · ${BURNDOWN.length} weeks`
							)}
							{@render burndownChart()}
						</VStack>
					</Card>

					{@render risksPanel(risks)}
				</Grid>

				<Card padding={6}>
					<VStack gap={4}>
						{@render cardHeading(
							'Workstreams',
							undefined,
							`${workstreams.length} of ${WORKSTREAMS.length}`
						)}
						{#if workstreams.length === 0}
							{@render phaseEmptyState('workstreams')}
						{:else}
							<Table
								data={workstreams}
								columns={workstreamColumns}
								idKey="id"
								density="balanced"
								dividers="rows"
								hasHover
							/>
						{/if}
					</VStack>
				</Card>
			</VStack>
		</Section>
	</LayoutContent>
{/snippet}

<Layout height="fill" header={pageHeader} {content} />

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

	.donut-frame {
		position: relative;
		width: 208px;
		height: 208px;
		flex-shrink: 0;
	}

	/* The risk rows carry no action, so `ListItem`'s interactive treatment (pointer
	   cursor, pressed state) would be a lie. This is the hover half only — a hint
	   that the hover card exists — guarded so it never sticks on touch. */
	:global(.risk-row) {
		transition-property: background-color;
		transition-duration: var(--duration-fast-min, 130ms);
		transition-timing-function: var(--ease-standard, cubic-bezier(0.24, 1, 0.4, 1));
		background-color: transparent;
	}

	@media (hover: hover) {
		:global(.risk-row:hover) {
			background-color: var(--color-overlay-hover);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.risk-row) {
			transition: none;
		}
	}
</style>
