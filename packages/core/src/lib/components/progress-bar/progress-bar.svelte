<script lang="ts" module>
	import type { BaseProps } from '../../base-props.js';
	import type { ProgressBarVariant } from './progress-bar.stylex.js';

	/**
	 * A fixed target mark drawn on the progress track.
	 *
	 * Positioned by `value` in the same `0..max` scale as the bar's `value` prop —
	 * mirroring the object shape of Slider's `marks` so the two APIs stay
	 * consistent.
	 */
	export interface ProgressBarMark {
		/**
		 * Position of the mark in the same `0..max` scale as `value`. Values
		 * outside the range are clamped to the track edges.
		 */
		value: number;
		/**
		 * Names the mark. A mark stands for something meaningful on the track — a
		 * goal, a threshold, a quarter target — so a label is required: it is the
		 * mark's accessible name and the text revealed in a `Tooltip` on hover and
		 * keyboard focus. Can be the value itself (e.g. `'70%'`) or something
		 * richer (e.g. `'Q1 target: 50%'`).
		 */
		label: string;
	}

	export interface ProgressBarProps extends BaseProps<HTMLDivElement> {
		/** Ignored when `isIndeterminate`. @default 0 */
		value?: number;
		/** @default 100 */
		max?: number;
		/**
		 * Accessible name. Shown above the bar unless `isLabelHidden`; required
		 * either way.
		 */
		label: string;
		/** Keep the label for screen readers but take it off the screen. */
		isLabelHidden?: boolean;
		/** Show the formatted value beside the label. Ignored when indeterminate. */
		hasValueLabel?: boolean;
		/** @default (value, max) => `${Math.round((value / max) * 100)}%` */
		formatValueLabel?: (value: number, max: number) => string;
		/** @default 'accent' */
		variant?: ProgressBarVariant;
		/**
		 * Animate without a known value, for work whose length is unknown. `value`
		 * and `hasValueLabel` are ignored. Slows under `prefers-reduced-motion`.
		 */
		isIndeterminate?: boolean;
		/**
		 * Target marks drawn on the track at fixed points in the same `0..max`
		 * scale as `value` — e.g. a goal line. Marks stay visible whether progress
		 * is below or past them. Each mark's required `label` names it for
		 * assistive tech and is revealed via a `Tooltip` on hover/focus. Ignored
		 * when `isIndeterminate` is true.
		 */
		marks?: ReadonlyArray<ProgressBarMark>;
		/** Paint the bar and text in disabled colours, for cancelled work. */
		isDisabled?: boolean;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { formatMotionRoleValue } from '../../motion/roles.js';
	import { resolveMotion } from '../../motion/resolve-motion.js';
	import { progressBar } from '../../motion/uikit/progressBar.js';
	import { timing } from '../../motion/uikit/timing.js';
	import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';
	import {
		progressBarContainerAttrs,
		progressBarFillAttrs,
		progressBarHeaderAttrs,
		progressBarLabelAttrs,
		progressBarMarkAttrs,
		progressBarTrackAttrs,
		progressBarTrackContainerAttrs,
		progressBarValueLabelAttrs
	} from './progress-bar.stylex.js';
	import { useProgressBarTouch } from './use-progress-bar-touch.svelte.js';

	/**
	 * Determinate or indeterminate progress.
	 *
	 * Deliberately minimal — compose extra status icons and descriptions beside
	 * the bar with layout components rather than growing the prop list. The
	 * exception is on-track content like `marks`, which are positioned by value
	 * over the track.
	 *
	 * A mark's height, width and colour are directly themeable via the
	 * `progressbar-mark` target. The target reflects `data-placement` (`"fill"`
	 * when the mark sits inside the filled area, `"track"` when it is still out on
	 * the bare track) and `data-variant` (the fill's variant), so a theme can
	 * style the two cases separately — e.g. a taller "goal flag" tick that
	 * overhangs the bar (centred, so the overhang is symmetric):
	 *
	 * @example
	 * ```ts
	 * defineTheme({
	 *   name: 'campaign',
	 *   components: {
	 *     'progressbar-mark': { base: { height: '16px', backgroundColor: 'red' } }
	 *   }
	 * });
	 * ```
	 */
	const defaultFormatValueLabel = (value: number, max: number): string =>
		`${max > 0 ? Math.round((value / max) * 100) : 0}%`;

	const {
		value = 0,
		max = 100,
		label,
		isLabelHidden = false,
		hasValueLabel = false,
		formatValueLabel = defaultFormatValueLabel,
		variant = 'accent',
		isIndeterminate = false,
		isDisabled = false,
		marks,
		class: className,
		style: styleProp,
		xstyle,
		...rest
	}: ProgressBarProps = $props();

	// Server and client have to agree on this, since it wires aria-labelledby.
	const labelId = $props.id();

	// A non-finite value or max — a NaN out of some `loaded / total` where total
	// was 0 — would otherwise reach aria-valuenow, the value label and the fill
	// width as the literal string "NaN". Treat it as no progress, which is what
	// max=0 already does.
	const safeValue = $derived(Number.isFinite(value) ? value : 0);
	const safeMax = $derived(Number.isFinite(max) ? max : 0);
	const clampedValue = $derived(Math.min(Math.max(0, safeValue), safeMax));
	const percentage = $derived(safeMax > 0 ? (clampedValue / safeMax) * 100 : 0);
	const valueText = $derived(formatValueLabel(clampedValue, safeMax));

	const showValueLabel = $derived(hasValueLabel && !isIndeterminate);
	const fillVariant = $derived(isDisabled ? 'disabled' : variant);

	// Under a finger the fill moves as UIProgressView's does and draws at least
	// 16px; what that needs from script is the touch layer (ProgressBarTouch).
	const touch = useProgressBarTouch(
		() => percentage,
		() => !isIndeterminate && (marks?.length ?? 0) > 0
	);
	// The reduced-motion pulse plays the `progress.reducedMotionPulseMs` role on
	// the `timing.curves.move` curve, down to the progress table's floor.
	const pulseStyle = mergeStyle(
		`--_progress-bar-pulse:${resolveMotion(null, progressBar, 'reducedMotionPulseMs')}ms`,
		`--_progress-bar-pulse-curve:${formatMotionRoleValue(
			'curve',
			resolveMotion(null, timing.curves.move)
		)}`,
		`--_progress-bar-pulse-floor:${progressBar.reducedMotionPulseFloor}`
	);

	// Marks make no sense without a determinate value, so they are only drawn in
	// determinate mode. Non-finite mark values are dropped; the rest are clamped
	// to the track edges, matching the bar's own `clampedValue`.
	//
	// Each mark also records whether it lands on the filled part of the bar
	// (`isOnFill`), which decides its colour: a mark inside the fill reads against
	// the variant colour, one out on the bare track reads against the track. A
	// mark exactly at the fill's leading edge counts as on the fill — it is the
	// "reached the target" moment — except at zero progress, where there is no
	// fill for it to sit on.
	const resolvedMarks = $derived(
		!isIndeterminate && marks
			? marks
					.filter((mark) => Number.isFinite(mark.value))
					.map((mark) => {
						const clamped = Math.min(Math.max(0, mark.value), safeMax);
						const pct = safeMax > 0 ? (clamped / safeMax) * 100 : 0;
						return {
							value: mark.value,
							label: mark.label,
							pct,
							isOnFill: percentage > 0 && pct <= touch.drawnPercentage
						};
					})
			: []
	);

	const container = $derived(progressBarContainerAttrs(xstyle));
	const header = progressBarHeaderAttrs();
	const trackContainer = progressBarTrackContainerAttrs();
	const track = progressBarTrackAttrs();
	const labelAttrs = $derived(progressBarLabelAttrs(isLabelHidden, isDisabled));
	const valueLabelAttrs = $derived(progressBarValueLabelAttrs(isDisabled));
	const fill = $derived(
		progressBarFillAttrs(fillVariant, isIndeterminate, !isIndeterminate && percentage === 0)
	);
	const fillStyle = $derived(
		mergeStyle(
			fill.style,
			`--_progress-bar-fill:${percentage}%`,
			...Object.entries(touch.fillVars).map(([name, value]) => `${name}:${value}`)
		)
	);

	// `progressbar` ran the compound name together; themes styling it keep
	// working until the next major.
	const theme = $derived(themeProps('progress-bar', { variant }, { legacyNames: ['progressbar'] }));
	const trackTheme = themeProps('progress-bar-track', undefined, {
		legacyNames: ['progressbar-track']
	});
	const fillTheme = $derived(
		themeProps('progress-bar-fill', { variant: fillVariant }, { legacyNames: ['progressbar-fill'] })
	);
</script>

<!--
	The tick element. It is both the tooltip's anchor and the pending-branch
	fallback shown while the lazy tooltip chunk loads, so the tick is always
	visible and the label attaches once ready.

	`placement` is reflected as `data-placement` (and a class) so a theme can style
	the two cases separately on the `progress-bar-mark` target; `variant` mirrors
	the fill's variant for the same reason. Both are per-mark, so they are resolved
	here rather than once in the `<script>`.
-->
{#snippet markTick(pct: number, isOnFill: boolean, label: string)}
	{@const markTheme = themeProps(
		'progress-bar-mark',
		{ variant: fillVariant, placement: isOnFill ? 'fill' : 'track' },
		{ legacyNames: ['progressbar-mark'] }
	)}
	{@const markAttrs = progressBarMarkAttrs(fillVariant, isOnFill, isDisabled)}
	<!--
		Focusable and never `aria-hidden`: a mark always stands for something
		meaningful, and the tab stop is how a keyboard user reveals its label. It
		is a named image of its own, and the tooltip's `aria-describedby` adds the
		same label as a description.
	-->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<span
		role="img"
		aria-label={label}
		tabindex="0"
		{...markTheme}
		class={cx(markTheme.class, markAttrs.class)}
		style={mergeStyle(markAttrs.style, `inset-inline-start:${pct}%`)}
	></span>
{/snippet}

<div
	{...rest}
	{...theme}
	class={cx(theme.class, container.class, className)}
	style={mergeStyle(container.style, styleProp as string | undefined)}
>
	{#if !isLabelHidden || showValueLabel}
		<div class={header.class} style={header.style}>
			<span id={labelId} class={labelAttrs.class} style={labelAttrs.style}>{label}</span>
			{#if showValueLabel}
				<span class={valueLabelAttrs.class} style={valueLabelAttrs.style}>{valueText}</span>
			{/if}
		</div>
	{:else}
		<VisuallyHidden id={labelId}>{label}</VisuallyHidden>
	{/if}

	<!--
		The in-flow track determines this container's actual height. Marks share
		its geometry without depending on the label row's height or entering the
		progressbar's presentational subtree.
	-->
	<div class={trackContainer.class} style={trackContainer.style}>
		<!--
			The semantic rail — the `role="progressbar"` element. It holds only the
			fill, so the focusable marks stay outside its presentational subtree, and
			it clips the fill to the rounded rail: the determinate fill slides in
			from the inline-start side and the indeterminate one overshoots both
			ends.
		-->
		<div
			{...trackTheme}
			class={cx(trackTheme.class, track.class)}
			style={track.style}
			role="progressbar"
			aria-valuenow={isIndeterminate ? undefined : clampedValue}
			aria-valuemin={isIndeterminate ? undefined : 0}
			aria-valuemax={isIndeterminate ? undefined : safeMax}
			aria-valuetext={isIndeterminate ? undefined : valueText}
			aria-labelledby={labelId}
			{@attach touch.attachTrack}
		>
			{#if isIndeterminate}
				<div
					{...fillTheme}
					class={cx(fillTheme.class, fill.class)}
					style={mergeStyle(fill.style, pulseStyle)}
				></div>
			{:else}
				<div {...fillTheme} class={cx(fillTheme.class, fill.class)} style={fillStyle}></div>
			{/if}
		</div>
		<!--
			Target marks — siblings of the semantic rail, layered above the fill so
			they show whether progress is below or past them. Each mark is labelled,
			so it is a focusable tooltip trigger.

			The tooltip is loaded lazily, as upstream's `lazy()` + `Suspense` does, so
			a consumer that only renders mark-less ProgressBars never pulls `Tooltip`
			(and the `Layer` overlay machinery behind it) into its bundle — the shape
			`Timestamp` already uses for its hover card. `{#await}`'s pending branch is
			the `Suspense` fallback: the bare tick stays visible while the chunk loads
			and the tooltip simply attaches once ready. With no marks the `{#each}`
			body never runs, so the `import()` is never even called.

			Upstream keys the list on `${value}:${label}`. Two marks may legitimately
			carry the same pair, and Svelte *throws* on a duplicate key where React
			only warns — so the positional index is the key here, as
			`TimestampHoverCard`'s rows already do for the same reason.
		-->
		{#each resolvedMarks as mark, index (index)}
			{#await import('./progress-bar-mark-tooltip.svelte')}
				{@render markTick(mark.pct, mark.isOnFill, mark.label)}
			{:then { default: ProgressBarMarkTooltip }}
				<ProgressBarMarkTooltip content={mark.label}>
					{@render markTick(mark.pct, mark.isOnFill, mark.label)}
				</ProgressBarMarkTooltip>
			{/await}
		{/each}
	</div>
</div>
