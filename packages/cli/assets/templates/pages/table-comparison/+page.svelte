<!--
	Ported from upstream's `assets/templates/pages/table-comparison/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Lucide throughout, as upstream's are: `@lucide/svelte` is
	`lucide-react`'s Svelte build and keeps the names, so the imports below are
	upstream's with the package name changed.

	The uptime strip is the page's only chart, and upstream draws it with
	recharts' `ScatterChart` over points rendered as bars. It is drawn inline
	here, driven by the same geometry:

	  `useResizeObserver` on the wrapper   → a `bind:clientWidth` record
	  `XAxis domain={[-0.5, 29.5]}` hide   → `step = stripWidth / 30` and
	                                        `cx = i * step + step / 2`
	  `barWidth = max(2, pitch - 2)`       → each `<rect>` is `barWidth` wide,
	                                        `28` tall, `rx={2}`
	  `Scatter onMouseMove`                → the slot index under the pointer
	                                        drives `uptimeHover[model.id]`
	  `VisuallyHidden` tally               → unchanged, and the reading line
	                                        swaps the month average for the day
	                                        under the pointer

	No chart animates: the `Scatter` sets `isAnimationActive={false}`, so there
	is no reveal to port. The only motion is the Switch, selector, chevron and
	collapse motion the core components already own.

	The table's grouped header and pinned label column use the port's own
	`useTableGroupedRows` / `useTableStickyColumns`, as upstream uses its hooks.
	The comparison's cell renderers are wrappers around one parameterised
	snippet (`modelCellAt`) because `renderCell` takes only the row; the eight
	wrappers cover the eight models the catalog can hold. `renderCell` also has
	to no-op on the synthetic group-header row — this port's grouped plugin
	replaces those cells in `transformBodyRow`, after `BaseTable` has already
	called the renderer, which upstream suppresses with `transformBodyCell`.
-->
<script lang="ts">
	import {
		Button,
		Card,
		HStack,
		Heading,
		Icon,
		Layout,
		LayoutContent,
		LayoutHeader,
		ProgressBar,
		Selector,
		StackItem,
		Switch,
		Table,
		Text,
		Tooltip,
		VStack,
		VisuallyHidden,
		pixel,
		proportional,
		useTableGroupedRows,
		useTableStickyColumns,
		type TableColumn
	} from '@astryx-svelte/core';
	import type { Component, Snippet } from 'svelte';
	import {
		AudioLines,
		Box,
		CircleCheck,
		CircleX,
		Cpu,
		FileText,
		Image as ImageIcon,
		Plus,
		Sparkles,
		Type,
		Video,
		Zap
	} from '@lucide/svelte';

	// ============= CANDIDATES =============

	/**
	 * Modalities are a set, not a sentence. Held as data, the row can render every
	 * model against the same four slots — so a gap is a dimmed glyph in a fixed
	 * position rather than a word you have to notice is missing from a list.
	 */
	type Modality = 'text' | 'image' | 'audio' | 'video' | 'document';

	const MODALITY_ORDER: Modality[] = ['text', 'image', 'audio', 'video', 'document'];

	const MODALITY_ICON: Record<Modality, Component> = {
		text: Type,
		image: ImageIcon,
		audio: AudioLines,
		video: Video,
		document: FileText
	};

	/**
	 * Tooltip and accessible-name copy. The glyphs are small and several are
	 * near-neighbours — a waveform and a film frame are not self-evident at 20px —
	 * so the rail explains every slot on hover, focus, and touch.
	 */
	const MODALITY_LABEL: Record<Modality, string> = {
		text: 'Text',
		image: 'Image',
		audio: 'Audio',
		video: 'Video',
		document: 'Document'
	};

	/** One model's specs, stated once. Every cell in the table derives from here. */
	interface Model {
		id: string;
		name: string;
		provider: string;
		/** Context window in tokens. */
		context: number;
		/** Maximum tokens in a single response. */
		maxOutput: number;
		cutoff: string;
		inputModalities: Modality[];
		outputModalities: Modality[];
		hasOpenWeights: boolean;
		/** USD per million input tokens. */
		inputPrice: number;
		/** USD per million output tokens. */
		outputPrice: number;
		/** USD per million cached input tokens. */
		cachedPrice: number;
		/** Output tokens per second, median. */
		speed: number;
		/** Time to first token, seconds. */
		latency: number;
		mmlu: number;
		humanEval: number;
		math: number;
		/** Requests per minute at the default tier. */
		rateLimit: number;
		hasStreaming: boolean;
		hasTools: boolean;
		hasFineTuning: boolean;
	}

	const MODELS: Model[] = [
		{
			id: 'atlas-4-flash',
			name: 'Atlas 4 Flash',
			provider: 'Northwind',
			context: 1_000_000,
			maxOutput: 65_536,
			cutoff: 'Mar 2026',
			inputModalities: ['text', 'image'],
			outputModalities: ['text'],
			hasOpenWeights: false,
			inputPrice: 0.1,
			outputPrice: 0.4,
			cachedPrice: 0.025,
			speed: 186,
			latency: 0.28,
			mmlu: 78.4,
			humanEval: 84.1,
			math: 71.2,
			rateLimit: 4_000,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: true
		},
		{
			id: 'atlas-4-pro',
			name: 'Atlas 4 Pro',
			provider: 'Northwind',
			context: 2_000_000,
			maxOutput: 131_072,
			cutoff: 'Mar 2026',
			inputModalities: ['text', 'image', 'audio', 'document'],
			outputModalities: ['text', 'audio'],
			hasOpenWeights: false,
			inputPrice: 1.25,
			outputPrice: 5.0,
			cachedPrice: 0.31,
			speed: 74,
			latency: 0.62,
			mmlu: 88.7,
			humanEval: 93.4,
			math: 89.1,
			rateLimit: 1_000,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: false
		},
		{
			id: 'meridian-2-5-flash',
			name: 'Meridian 2.5 Flash',
			provider: 'Calder Labs',
			context: 1_048_576,
			maxOutput: 8_192,
			cutoff: 'Jan 2026',
			inputModalities: ['text', 'image', 'video'],
			outputModalities: ['text'],
			hasOpenWeights: false,
			inputPrice: 0.075,
			outputPrice: 0.3,
			cachedPrice: 0.019,
			speed: 214,
			latency: 0.24,
			mmlu: 76.9,
			humanEval: 81.7,
			math: 68.4,
			rateLimit: 2_000,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: true
		},
		{
			id: 'meridian-2-5-pro',
			name: 'Meridian 2.5 Pro',
			provider: 'Calder Labs',
			context: 2_097_152,
			maxOutput: 65_536,
			cutoff: 'Jan 2026',
			inputModalities: ['text', 'image', 'audio', 'video', 'document'],
			outputModalities: ['text', 'image', 'audio'],
			hasOpenWeights: false,
			inputPrice: 1.25,
			outputPrice: 10.0,
			cachedPrice: 0.31,
			speed: 62,
			latency: 0.71,
			mmlu: 89.3,
			humanEval: 92.8,
			math: 91.6,
			rateLimit: 360,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: false
		},
		{
			id: 'orion-mini-3',
			name: 'Orion Mini 3',
			provider: 'Halcyon',
			context: 262_144,
			maxOutput: 32_768,
			cutoff: 'Nov 2025',
			inputModalities: ['text'],
			outputModalities: ['text'],
			hasOpenWeights: true,
			inputPrice: 0.05,
			outputPrice: 0.2,
			cachedPrice: 0.012,
			speed: 248,
			latency: 0.19,
			mmlu: 71.2,
			humanEval: 74.6,
			math: 58.9,
			rateLimit: 8_000,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: true
		},
		{
			id: 'orion-3-ultra',
			name: 'Orion 3 Ultra',
			provider: 'Halcyon',
			context: 524_288,
			maxOutput: 65_536,
			cutoff: 'Nov 2025',
			inputModalities: ['text', 'image', 'document'],
			outputModalities: ['text', 'image'],
			hasOpenWeights: true,
			inputPrice: 0.9,
			outputPrice: 2.7,
			cachedPrice: 0.22,
			speed: 96,
			latency: 0.48,
			mmlu: 85.1,
			humanEval: 89.2,
			math: 82.3,
			rateLimit: 1_200,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: true
		},
		{
			id: 'kestrel-v4-turbo',
			name: 'Kestrel V4 Turbo',
			provider: 'Sable AI',
			context: 400_000,
			maxOutput: 16_384,
			cutoff: 'Feb 2026',
			inputModalities: ['text', 'image', 'document'],
			outputModalities: ['text'],
			hasOpenWeights: false,
			inputPrice: 0.3,
			outputPrice: 1.2,
			cachedPrice: 0.075,
			speed: 142,
			latency: 0.33,
			mmlu: 82.6,
			humanEval: 87.3,
			math: 77.8,
			rateLimit: 3_000,
			hasStreaming: true,
			hasTools: true,
			hasFineTuning: false
		},
		{
			id: 'kestrel-v4-lite',
			name: 'Kestrel V4 Lite',
			provider: 'Sable AI',
			context: 128_000,
			maxOutput: 8_192,
			cutoff: 'Feb 2026',
			inputModalities: ['text'],
			outputModalities: ['text'],
			hasOpenWeights: false,
			inputPrice: 0.04,
			outputPrice: 0.16,
			cachedPrice: 0.01,
			speed: 265,
			latency: 0.17,
			mmlu: 68.4,
			humanEval: 70.1,
			math: 54.2,
			rateLimit: 10_000,
			hasStreaming: true,
			hasTools: false,
			hasFineTuning: false
		}
	];

	const MODEL_BY_ID = new Map(MODELS.map((model) => [model.id, model]));

	/**
	 * The three the page opens on. Three columns is the count a reader can hold in
	 * a single comparison — the fourth is a click away, and every column past the
	 * opening set is one the reader asked for rather than one they have to dismiss.
	 */
	const DEFAULT_SLOTS = ['atlas-4-flash', 'meridian-2-5-flash', 'kestrel-v4-turbo'];

	/** Below two columns there is nothing left to compare against. */
	const MIN_SLOTS = 2;

	// ============= FORMATTING =============

	// Pinned locale keeps the rendered output identical in every environment.
	const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
	const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const compact = new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	});
	const price = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 3
	});

	// ============= CRITERIA =============

	type GroupKey =
		| 'Overview'
		| 'Pricing'
		| 'Performance'
		| 'Availability'
		| 'Benchmarks'
		| 'Limits';

	// Availability sits with performance rather than after the benchmarks: whether
	// a service stayed up is an operational fact about running it, and it belongs
	// beside speed and latency instead of below the leaderboard scores.
	const GROUP_ORDER: GroupKey[] = [
		'Overview',
		'Pricing',
		'Performance',
		'Availability',
		'Benchmarks',
		'Limits'
	];

	/**
	 * A cell is a number when it can be ranked, and a string or boolean when it
	 * cannot. `better` is only meaningful on the numeric ones, which is why
	 * `bestByRow` ignores every other kind rather than trying to order them.
	 */
	type CellValue = number | string | boolean;

	interface SpecRow extends Record<string, unknown> {
		id: string;
		/**
		 * Carries its own unit, because the label column is one line per row. A
		 * second line under the label is the obvious place to put "per 1M tokens",
		 * and it is what makes rows different heights — which is precisely what
		 * defeats a vertical scan down a column.
		 */
		label: string;
		group: GroupKey;
		/** Omitted when the values differ without one being better. */
		better?: 'higher' | 'lower';
		get: (model: Model) => CellValue;
		/** Numbers only; strings render as-is and booleans render as a check. */
		format?: (value: number) => string;
		/** Trails the value in supporting text, e.g. "tokens" or "/1M". */
		unit?: string;
		/** Draws the value as a proportion of 100 alongside the number. */
		isScore?: boolean;
		/** Replaces the cell entirely. Skips ranking, so pair it with no `better`. */
		renderValue?: Snippet<[Model]>;
	}

	const SPEC_ROWS = $derived.by<SpecRow[]>(() => [
		{
			id: 'provider',
			group: 'Overview',
			label: 'Provider',
			get: (m) => m.provider
		},
		{
			id: 'context',
			group: 'Overview',
			label: 'Context window',
			unit: 'tokens',
			better: 'higher',
			get: (m) => m.context,
			format: (v) => compact.format(v)
		},
		{
			id: 'max-output',
			group: 'Overview',
			label: 'Max output',
			unit: 'tokens',
			better: 'higher',
			get: (m) => m.maxOutput,
			format: (v) => compact.format(v)
		},
		{
			id: 'cutoff',
			group: 'Overview',
			label: 'Knowledge cutoff',
			get: (m) => m.cutoff
		},
		{
			id: 'input-modalities',
			group: 'Overview',
			label: 'Input modalities',
			// Drawn in MODALITY_ORDER, not in the order the model happens to list, so
			// the glyphs line up slot for slot across every column and down both rows.
			get: (m) => m.inputModalities.join(', '),
			renderValue: inputModalityRail
		},
		{
			id: 'output-modalities',
			group: 'Overview',
			label: 'Output modalities',
			get: (m) => m.outputModalities.join(', '),
			renderValue: outputModalityRail
		},
		{
			id: 'open-weights',
			group: 'Overview',
			label: 'Open weights',
			get: (m) => m.hasOpenWeights
		},
		{
			id: 'input-price',
			group: 'Pricing',
			label: 'Input',
			unit: '/1M',
			better: 'lower',
			get: (m) => m.inputPrice,
			format: (v) => price.format(v)
		},
		{
			id: 'output-price',
			group: 'Pricing',
			label: 'Output',
			unit: '/1M',
			better: 'lower',
			get: (m) => m.outputPrice,
			format: (v) => price.format(v)
		},
		{
			id: 'cached-price',
			group: 'Pricing',
			label: 'Cached input',
			unit: '/1M',
			better: 'lower',
			get: (m) => m.cachedPrice,
			format: (v) => price.format(v)
		},
		{
			// Derived from the two rows above, on the 3:1 read-to-write split typical of
			// chat traffic. A blended figure is the only honest way to rank two prices
			// at once, and deriving it means it cannot fall out of step with them.
			id: 'blended-price',
			group: 'Pricing',
			label: 'Blended (3:1)',
			unit: '/1M',
			better: 'lower',
			get: (m) => (m.inputPrice * 3 + m.outputPrice) / 4,
			format: (v) => price.format(v)
		},
		{
			id: 'speed',
			group: 'Performance',
			label: 'Output speed',
			better: 'higher',
			unit: 'tok/s',
			get: (m) => m.speed,
			format: (v) => whole.format(v)
		},
		{
			id: 'latency',
			group: 'Performance',
			label: 'Time to first token',
			better: 'lower',
			unit: 'sec',
			get: (m) => m.latency,
			format: (v) => decimal.format(v)
		},
		{
			id: 'mmlu',
			group: 'Benchmarks',
			label: 'MMLU-Pro',
			better: 'higher',
			get: (m) => m.mmlu,
			format: (v) => decimal.format(v),
			isScore: true
		},
		{
			id: 'human-eval',
			group: 'Benchmarks',
			label: 'HumanEval',
			better: 'higher',
			get: (m) => m.humanEval,
			format: (v) => decimal.format(v),
			isScore: true
		},
		{
			id: 'math',
			group: 'Benchmarks',
			label: 'MATH',
			better: 'higher',
			get: (m) => m.math,
			format: (v) => decimal.format(v),
			isScore: true
		},
		{
			id: 'rate-limit',
			group: 'Limits',
			label: 'Rate limit',
			better: 'higher',
			unit: '/min',
			get: (m) => m.rateLimit,
			format: (v) => whole.format(v)
		},
		{
			id: 'streaming',
			group: 'Limits',
			label: 'Streaming',
			get: (m) => m.hasStreaming
		},
		{
			id: 'tools',
			group: 'Limits',
			label: 'Function calling',
			get: (m) => m.hasTools
		},
		{
			id: 'fine-tuning',
			group: 'Limits',
			label: 'Fine-tuning',
			get: (m) => m.hasFineTuning
		},
		{
			id: 'usage',
			// The window is named in the label rather than under it: this column
			// carries labels only, and a per-cell caption would repeat five times.
			group: 'Availability',
			label: 'Uptime (30d)',
			get: (m) => m.name,
			renderValue: uptimeStrip
		}
	]);

	// ============= COLUMNS =============

	const SPEC_COLUMN_WIDTH = 220;
	/**
	 * The floor a model column may not shrink past, not its width. The columns are
	 * proportional so three of them fill the table instead of stranding a third of
	 * the page as dead space, and the minimum is what turns the eighth column into
	 * a horizontal scroll rather than eight unreadable slivers.
	 */
	const MODEL_COLUMN_MIN_WIDTH = 236;

	/**
	 * One line of `large` text (17px on a 24px leading). Every cell reserves it,
	 * whether it holds a figure, an icon or a dash, so rows in a section stay the
	 * same height and the eye can travel across a row without stepping.
	 */
	const CELL_CONTENT_HEIGHT = 24;

	// The winner's wash, filling the whole cell rather than hugging the figure. The
	// values track `density="spacious"` on the Table below — the two have to be
	// changed together — and `content-box` keeps the shared 24px line height as the
	// content height, so a filled cell is exactly as tall as an unfilled one.
	const BEST_CELL_STYLE =
		'background-color: var(--color-background-blue); box-sizing: content-box; ' +
		'margin-block: calc(-1 * var(--spacing-3)); margin-inline: calc(-1 * var(--spacing-4)); ' +
		'padding-block: var(--spacing-3); padding-inline: var(--spacing-4);';

	// ============= ACTIVITY =============

	const UPTIME_DAYS = 30;

	/** The window ends on a fixed date so the template renders identically forever. */
	const UPTIME_END = new Date('2026-09-07T00:00:00Z');

	/**
	 * Deterministic daily uptime. An xorshift keyed on the model id gives each
	 * service its own incident history — one that never wobbles next to one that
	 * had a bad week — without a snapshot file or a seed that moves between
	 * renders.
	 *
	 * The shape is deliberately lopsided, the way a real status page is: most days
	 * are clean, a dip is uncommon, and a genuine outage is rare. A uniform spread
	 * would read as noise and tell the reader nothing.
	 */
	function dailyUptime(seed: number, days: number): number[] {
		let state = seed || 1;
		const next = () => {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			return Math.abs(state % 1000) / 1000;
		};
		// One draw decides how rough this model's month was, so the columns differ
		// the way the rest of the table does: a reader scanning the row should see
		// that one service held all month and another did not.
		const rough = next();
		const outageOdds = 0.01 + rough * 0.05;
		const degradedOdds = outageOdds + 0.03 + rough * 0.09;

		const out: number[] = [];
		for (let i = 0; i < days; i++) {
			const roll = next();
			if (roll < outageOdds) {
				// A real incident: minutes to hours of downtime in the day.
				out.push(96.5 + next() * 2.4);
			} else if (roll < degradedOdds) {
				// Degraded — elevated errors or latency, not a full outage.
				out.push(99.0 + next() * 0.9);
			} else {
				out.push(99.95 + next() * 0.05);
			}
		}
		return out;
	}

	function hashId(id: string): number {
		let h = 0;
		for (let i = 0; i < id.length; i++) {
			h = (h << 5) - h + id.charCodeAt(i);
		}
		return h;
	}

	function dayDate(index: number): Date {
		const d = new Date(UPTIME_END);
		d.setUTCDate(d.getUTCDate() - (UPTIME_DAYS - 1 - index));
		return d;
	}

	const dayFormat = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});

	const uptimeFormat = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	/**
	 * Bar geometry. One bar per day in a single strip, which is the shape every
	 * status page uses and therefore the one a reader already knows how to read.
	 */
	const BAR_GAP = 2;
	const BAR_HEIGHT = 28;
	/** Keeps the strip legible if the column is dragged very narrow. */
	const MIN_BAR = 2;
	/** One line of body text, held open whether or not a day is hovered. */
	const UPTIME_READING_HEIGHT = 24;

	/**
	 * Three states, not a gradient. Uptime is read as a verdict — did it hold, did
	 * it wobble, did it fall over — and a continuous ramp between 96% and 100%
	 * would make every day look mid. The thresholds are the ones the SLA is
	 * written against.
	 */
	function uptimeStatus(value: number): { color: string; status: string } {
		if (value >= 99.95) {
			return { color: 'var(--color-text-success)', status: 'Operational' };
		}
		if (value >= 99) {
			return { color: 'var(--color-text-warning)', status: 'Degraded' };
		}
		return { color: 'var(--color-text-error)', status: 'Outage' };
	}

	interface UptimeDay {
		/** Day index, left to right. */
		x: number;
		/** Constant: the strip is one row, but the geometry still reads it. */
		y: number;
		uptime: number;
		color: string;
		status: string;
		date: string;
	}

	// The month is a pure function of the pinned model ids, so it is built once —
	// upstream's `useMemo(…, [model.id])`, for the same reason.
	const UPTIME: Record<string, UptimeDay[]> = Object.fromEntries(
		MODELS.map((model) => [
			model.id,
			dailyUptime(hashId(model.id), UPTIME_DAYS).map((uptime, i) => ({
				x: i,
				y: 0,
				uptime,
				...uptimeStatus(uptime),
				date: dayFormat.format(dayDate(i))
			}))
		])
	);

	const UPTIME_AVERAGE: Record<string, number> = Object.fromEntries(
		MODELS.map((model) => {
			const days = UPTIME[model.id];
			return [model.id, days.reduce((total, day) => total + day.uptime, 0) / days.length];
		})
	);

	// Colour is the only encoding on a 5px bar, and the hover reading behind it
	// needs a pointer. The tally is the same reading in text, for a screen reader
	// and for anyone who cannot separate the three hues at this size.
	const UPTIME_SPOKEN: Record<string, string> = Object.fromEntries(
		MODELS.map((model) => {
			const tally: Record<string, number> = {};
			for (const day of UPTIME[model.id]) {
				tally[day.status] = (tally[day.status] ?? 0) + 1;
			}
			const parts = ['Operational', 'Degraded', 'Outage']
				.filter((status) => (tally[status] ?? 0) > 0)
				.map((status) => `${tally[status]} ${status.toLowerCase()}`)
				.join(', ');
			return [model.id, `Last ${UPTIME_DAYS} days: ${parts}.`];
		})
	);

	const uptimeWidths = $state<Record<string, number>>({});
	const uptimeHover = $state<Record<string, number | null>>({});

	// ============= STATE =============

	let slots = $state<string[]>(DEFAULT_SLOTS);
	let isHighlightOn = $state(true);
	let collapsedGroups = $state(new Set<string>());
	let activeSlot = $state<number | null>(null);

	function toggleGroup(groupKey: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(collapsedGroups);
		if (next.has(groupKey)) {
			next.delete(groupKey);
		} else {
			next.add(groupKey);
		}
		collapsedGroups = next;
	}

	const selectedModels = $derived(
		slots
			.map((id) => MODEL_BY_ID.get(id))
			.filter((model): model is Model => model != null)
	);

	/**
	 * The extreme value per row across the *selected* models. Rows without a
	 * direction, and rows whose values are not numbers, are absent from the map
	 * and so never mark a winner.
	 */
	const bestByRow = $derived.by(() => {
		const best = new Map<string, number>();
		for (const row of SPEC_ROWS) {
			if (row.better == null) {
				continue;
			}
			const values = selectedModels
				.map(row.get)
				.filter((value): value is number => typeof value === 'number');
			if (values.length === 0) {
				continue;
			}
			best.set(row.id, row.better === 'higher' ? Math.max(...values) : Math.min(...values));
		}
		return best;
	});

	function selectSlot(index: number, modelId: string) {
		slots = slots.map((current, i) => (i === index ? modelId : current));
	}

	function removeSlot(index: number) {
		slots = slots.filter((_, i) => i !== index);
	}

	// The first model not already on screen, or undefined once all are.
	const nextModel = $derived(MODELS.find((model) => !slots.includes(model.id)));

	function addModel() {
		if (nextModel != null) {
			slots = [...slots, nextModel.id];
		}
	}

	const grouped = useTableGroupedRows<SpecRow>(() => ({
		data: SPEC_ROWS,
		groupBy: (row) => row.group,
		groupOrder: GROUP_ORDER,
		collapsedGroups,
		onToggleGroup: toggleGroup,
		getRowKey: (row) => row.id,
		renderGroupHeader: groupHeader
	}));

	// `T` cannot be inferred from the config alone, so it is named explicitly.
	const sticky = useTableStickyColumns<SpecRow>(() => ({ startKeys: ['spec'] }));

	const PROVIDER_ICONS: Record<string, Snippet> = {
		Northwind: northwindIcon,
		'Calder Labs': calderIcon,
		Halcyon: halcyonIcon,
		'Sable AI': sableIcon
	};
</script>

<!-- ============= ICONS ============= -->

{#snippet northwindIcon()}
	<Icon icon={Cpu} size="sm" />
{/snippet}

{#snippet calderIcon()}
	<Icon icon={Sparkles} size="sm" />
{/snippet}

{#snippet halcyonIcon()}
	<Icon icon={Zap} size="sm" />
{/snippet}

{#snippet sableIcon()}
	<Icon icon={Box} size="sm" />
{/snippet}

{#snippet plusIcon()}
	<Icon icon={Plus} size="sm" />
{/snippet}

<!-- ============= CELL PIECES ============= -->

{#snippet modalityRail(supported: Modality[])}
	{@const explanation = MODALITY_ORDER.map(
		(modality) =>
			`${MODALITY_LABEL[modality]}: ${supported.includes(modality) ? 'supported' : 'not supported'}`
	).join('; ')}
	<Tooltip content={explanation} hasHoverIndication={false} touchTrigger="tap">
		<HStack
			gap={3}
			vAlign="center"
			hAlign="end"
			height={CELL_CONTENT_HEIGHT}
			tabindex={0}
			role="group"
			aria-label="Model modalities"
		>
			{#each MODALITY_ORDER as modality (modality)}
				{@const has = supported.includes(modality)}
				<HStack width={20} height={20} hAlign="center" vAlign="center">
					<Icon
						icon={MODALITY_ICON[modality]}
						size="md"
						color={has ? 'primary' : 'disabled'}
					/>
				</HStack>
			{/each}
		</HStack>
	</Tooltip>
{/snippet}

{#snippet inputModalityRail(model: Model)}
	{@render modalityRail(model.inputModalities)}
{/snippet}

{#snippet outputModalityRail(model: Model)}
	{@render modalityRail(model.outputModalities)}
{/snippet}

{#snippet scoreBar(value: number, isBest: boolean)}
	<HStack
		gap={1}
		vAlign="center"
		hAlign="end"
		height={CELL_CONTENT_HEIGHT}
		style={isBest ? BEST_CELL_STYLE : ''}
	>
		<HStack width={56} vAlign="center">
			<ProgressBar
				label={`Score ${decimal.format(value)} out of 100`}
				isLabelHidden
				{value}
				variant="accent"
			/>
		</HStack>
		<Text type="large" hasTabularNumbers weight={isBest ? 'semibold' : 'normal'}>
			{decimal.format(value)}
		</Text>
	</HStack>
{/snippet}

{#snippet uptimeStrip(model: Model)}
	{@const days = UPTIME[model.id]}
	{@const average = UPTIME_AVERAGE[model.id]}
	{@const spoken = UPTIME_SPOKEN[model.id]}
	{@const width = uptimeWidths[model.id] ?? 0}
	{@const hoveredIndex = uptimeHover[model.id] ?? null}
	{@const hovered =
		hoveredIndex === null || hoveredIndex >= days.length ? null : days[hoveredIndex]}
	{@const pitch = width / UPTIME_DAYS}
	{@const barWidth = Math.max(MIN_BAR, pitch - BAR_GAP)}
	{@const step = Math.max(barWidth + BAR_GAP, 1)}
	{@const stripWidth = Math.max(UPTIME_DAYS * step, 1)}
	<VStack gap={1} hAlign="end" width="100%">
		<VisuallyHidden>{spoken}</VisuallyHidden>
		<!-- Fixed height, so swapping the month's figure for a day's one does not
		     move the strip below it. -->
		<HStack height={UPTIME_READING_HEIGHT} vAlign="center">
			<Text type="body" color="primary">
				{hovered == null
					? `${uptimeFormat.format(average)}% average`
					: `${hovered.date} · ${uptimeFormat.format(hovered.uptime)}% · ${hovered.status}`}
			</Text>
		</HStack>
		<div class="uptime-strip" bind:clientWidth={uptimeWidths[model.id]}>
			{#if width > 0}
				<svg
					width={stripWidth}
					height={BAR_HEIGHT}
					role="presentation"
					onpointermove={(event) => {
						const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
						const index = Math.floor((event.clientX - bounds.left) / step);
						uptimeHover[model.id] = Math.max(0, Math.min(UPTIME_DAYS - 1, index));
					}}
					onpointerleave={() => (uptimeHover[model.id] = null)}
				>
					{#each days as day (day.x)}
						<!-- The pointer target is the whole slot, gap included: hit-testing
						     the drawn bar alone leaves the gaps dead, and the reading drops
						     back to the month's average in each one — crossing the strip
						     flickers about once per day. Slots tile the strip exactly, so
						     widening one does not steal from its neighbour. -->
						<rect
							x={day.x * step + (step - barWidth) / 2}
							y="0"
							width={barWidth}
							height={BAR_HEIGHT}
							rx="2"
							fill={day.color}
						/>
					{/each}
				</svg>
			{/if}
		</div>
	</VStack>
{/snippet}

<!-- ============= MODEL COLUMN HEADER ============= -->

{#snippet modelHeaderAt(index: number)}
	{@const modelId = slots[index] ?? ''}
	{@const isClearable = activeSlot === index && slots.length > MIN_SLOTS}
	{@const options = MODELS.map((option) => ({
		value: option.id,
		label: option.name,
		description: option.provider,
		icon: PROVIDER_ICONS[option.provider],
		// Taken elsewhere: shown, but not selectable twice.
		disabled: option.id !== modelId && slots.includes(option.id)
	}))}
	<HStack
		vAlign="center"
		width="100%"
		onmouseenter={() => (activeSlot = index)}
		onmouseleave={() => {
			if (activeSlot === index) activeSlot = null;
		}}
		onfocusin={() => (activeSlot = index)}
		onfocusout={(event) => {
			if (!event.currentTarget.contains(event.relatedTarget as Node | null)) activeSlot = null;
		}}
	>
		<StackItem size="fill">
			<!-- `hasClear` widens value and onChange to admit null, so the two states are
			     written as separate elements rather than one element with a boolean prop. -->
			{#if isClearable}
				<Selector
					label={`Model ${index + 1}`}
					isLabelHidden
					size="lg"
					{options}
					hasClear
					value={modelId}
					onChange={(next: string | null) =>
						next == null ? removeSlot(index) : selectSlot(index, next)}
				/>
			{:else}
				<Selector
					label={`Model ${index + 1}`}
					isLabelHidden
					size="lg"
					{options}
					value={modelId}
					onChange={(next: string) => selectSlot(index, next)}
				/>
			{/if}
		</StackItem>
	</HStack>
{/snippet}

<!-- Eight wrappers: the catalog holds eight models, so no slot can exceed them. -->
{#snippet modelHeader0()}{@render modelHeaderAt(0)}{/snippet}
{#snippet modelHeader1()}{@render modelHeaderAt(1)}{/snippet}
{#snippet modelHeader2()}{@render modelHeaderAt(2)}{/snippet}
{#snippet modelHeader3()}{@render modelHeaderAt(3)}{/snippet}
{#snippet modelHeader4()}{@render modelHeaderAt(4)}{/snippet}
{#snippet modelHeader5()}{@render modelHeaderAt(5)}{/snippet}
{#snippet modelHeader6()}{@render modelHeaderAt(6)}{/snippet}
{#snippet modelHeader7()}{@render modelHeaderAt(7)}{/snippet}

<!-- ============= MODEL COLUMN CELL ============= -->

{#snippet modelCellAt(index: number, row: SpecRow)}
	<!-- The grouped plugin replaces a synthetic header row's cells after this
	     renderer has run, so the renderer has to no-op on one. -->
	{#if typeof row.get !== 'function'}
		<!-- group-header row: its cells are discarded by the plugin -->
	{:else}
		{@const model = MODEL_BY_ID.get(slots[index] ?? '')}
		{#if model == null}
			<Text type="supporting">—</Text>
		{:else if row.renderValue != null}
			{@render row.renderValue(model)}
		{:else}
			{@const value = row.get(model)}
			{#if typeof value === 'boolean'}
				<!-- Both states are drawn, in opposing colours. An em dash for "no" reads
				     as missing data rather than as an answer, and it leaves the eye nothing
				     to catch when scanning a column of mostly-yes rows for the one that
				     differs. -->
				<HStack gap={1} vAlign="center" hAlign="end" height={CELL_CONTENT_HEIGHT}>
					<Icon
						icon={value ? CircleCheck : CircleX}
						size="md"
						color={value ? 'success' : 'error'}
						label={value ? 'Supported' : 'Not supported'}
					/>
				</HStack>
			{:else if typeof value === 'string'}
				<HStack gap={1} vAlign="center" hAlign="end" height={CELL_CONTENT_HEIGHT}>
					<!-- `large` is semibold by default; only a winning figure earns that
					     weight here, so the rest is set back down. -->
					<Text type="large" weight="normal">{value}</Text>
				</HStack>
			{:else}
				{@const best = bestByRow.get(row.id)}
				{@const isBest = isHighlightOn && best != null && value === best}
				{#if row.isScore}
					{@render scoreBar(value, isBest)}
				{:else}
					{@const formatted = row.format?.(value) ?? whole.format(value)}
					<HStack
						gap={1}
						vAlign="center"
						hAlign="end"
						height={CELL_CONTENT_HEIGHT}
						style={isBest ? BEST_CELL_STYLE : ''}
					>
						<Text type="large" hasTabularNumbers weight={isBest ? 'semibold' : 'normal'}>
							{formatted}
						</Text>
						<!-- Same size as the figure it qualifies, held apart by colour rather
						     than scale — `large` is semibold by default, which would have the
						     unit shouting over the number. Highlighted units use primary text
						     to retain AA contrast on the wash. -->
						{#if row.unit != null}
							<Text type="large" weight="normal" color={isBest ? 'primary' : 'secondary'}>
								{row.unit}
							</Text>
						{/if}
					</HStack>
				{/if}
			{/if}
		{/if}
	{/if}
{/snippet}

{#snippet modelCell0(row: SpecRow)}{@render modelCellAt(0, row)}{/snippet}
{#snippet modelCell1(row: SpecRow)}{@render modelCellAt(1, row)}{/snippet}
{#snippet modelCell2(row: SpecRow)}{@render modelCellAt(2, row)}{/snippet}
{#snippet modelCell3(row: SpecRow)}{@render modelCellAt(3, row)}{/snippet}
{#snippet modelCell4(row: SpecRow)}{@render modelCellAt(4, row)}{/snippet}
{#snippet modelCell5(row: SpecRow)}{@render modelCellAt(5, row)}{/snippet}
{#snippet modelCell6(row: SpecRow)}{@render modelCellAt(6, row)}{/snippet}
{#snippet modelCell7(row: SpecRow)}{@render modelCellAt(7, row)}{/snippet}

<!-- ============= SPEC LABEL CELL ============= -->

{#snippet specCell(row: SpecRow)}
	<HStack vAlign="center" height={CELL_CONTENT_HEIGHT}>
		<!-- The label alone. `unit` is deliberately not shown here: a second line under
		     the label is what made rows different heights, and the unit is more use
		     next to the figure it qualifies anyway. -->
		<Text type="label" color="secondary">{row.label}</Text>
	</HStack>
{/snippet}

<!-- ============= GROUP HEADER ============= -->

{#snippet groupHeader(groupKey: string)}
	<HStack gap={2} vAlign="center" style="position: sticky; inset-inline-start: var(--spacing-6); width: fit-content;">
		<!-- Sized as a heading rather than bold body text: these are the only
		     landmarks in a long matrix, and the criteria count they used to carry was
		     a number nobody acts on. Level 3 for the type scale, exposed as level 2 for
		     the outline: the page heading is the only thing above these. -->
		<Heading level={3} accessibilityLevel={2}>{groupKey}</Heading>
	</HStack>
{/snippet}

<!-- ============= PAGE ============= -->

{#snippet pageHeader()}
	<LayoutHeader padding={4}>
		<HStack gap={3} vAlign="center" wrap="wrap">
			<StackItem size="fill">
				<Heading level={1}>Compare models</Heading>
			</StackItem>
			<Switch
				label="Highlight best"
				size="sm"
				value={isHighlightOn}
				onChange={(checked) => (isHighlightOn = checked)}
			/>
			<Button
				label="Add model"
				variant="secondary"
				icon={plusIcon}
				isDisabled={nextModel == null}
				onclick={addModel}
			/>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet content()}
	<!-- Eight wrappers: the catalog holds eight models, so no slot can exceed them. -->
	{@const modelHeaders = [
		modelHeader0,
		modelHeader1,
		modelHeader2,
		modelHeader3,
		modelHeader4,
		modelHeader5,
		modelHeader6,
		modelHeader7
	]}
	{@const modelCells = [
		modelCell0,
		modelCell1,
		modelCell2,
		modelCell3,
		modelCell4,
		modelCell5,
		modelCell6,
		modelCell7
	]}
	{@const columns: TableColumn<SpecRow>[] = [
		{
			key: 'spec',
			// Names the header row it sits in — that row holds the model selectors,
			// not criteria.
			header: 'Models',
			width: pixel(SPEC_COLUMN_WIDTH),
			renderCell: specCell
		},
		...slots.map((_, index) => ({
			// Keyed by slot, not by model: the column is a position that holds
			// whichever model the reader picked, so it survives a swap.
			key: `slot-${index}`,
			width: proportional(1, { minWidth: MODEL_COLUMN_MIN_WIDTH }),
			align: 'end' as const,
			// The selector is the whole heading. The provider used to be repeated
			// underneath it, which said nothing the option list does not already say
			// when the menu is open.
			header: modelHeaders[index],
			renderCell: modelCells[index]
		}))
	]}
	<!-- No padding of its own: the table's cells carry the inset, so a second one
	     would inset them twice and pull the group headers off the card's edges. The
	     card is here for the border, the radius and the clip that keeps the corners
	     over the table. -->
	<LayoutContent padding={4}>
		<Card padding={5} class="table-frame">
			<Table
				data={grouped.data}
				{columns}
				idKey={grouped.idKey}
				density="spacious"
				dividers="grid"
				plugins={{ grouped: grouped.plugin, sticky }}
			/>
		</Card>
	</LayoutContent>
{/snippet}

<Layout
	height="auto"
	contentWidth={1440}
	header={pageHeader}
	{content}
/>

<style>
	/* Keep the card inside the content lane so Table's own wrapper, rather than an
	   outer page surface, owns horizontal overflow and sticky positioning. */
	:global(.table-frame) {
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	.uptime-strip {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}
</style>
