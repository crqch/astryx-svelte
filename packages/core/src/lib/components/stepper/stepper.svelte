<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { StepperIndicatorPosition, StepperOrientation } from './stepper-context.svelte.js';

	export type StepperCollapsedVariant = 'withLabelAndControls' | 'withLabel' | 'hiddenLabel';

	export interface StepperHorizontalOptions {
		/**
		 * Minimum width in pixels allocated to each step before a horizontal
		 * Stepper collapses.
		 * @default 112
		 */
		minimumStepWidth: number;
		/**
		 * Presentation used when the horizontal Stepper collapses.
		 * - `withLabelAndControls`: current-step label and navigation controls.
		 * - `withLabel`: current-step label without controls.
		 * - `hiddenLabel`: bare progress track with no compact row.
		 * `withLabelAndControls` renders its controls only when `onStepClick` is set.
		 * @default 'withLabelAndControls'
		 */
		collapsedVariant: StepperCollapsedVariant;
	}

	export interface StepperProps extends BaseProps<HTMLOListElement> {
		/**
		 * Zero-based index of the active step.
		 */
		activeStep: number;
		/**
		 * Step elements to render.
		 */
		children: Snippet;
		/**
		 * Layout direction of the stepper.
		 * @default 'horizontal'
		 */
		orientation?: StepperOrientation;
		/**
		 * Called when a step indicator is clicked. Enables non-linear navigation.
		 * When provided, completed and current steps become clickable.
		 */
		onStepClick?: (index: number) => void;
		/**
		 * Accessible label describing the set of steps. Defaults to a translated
		 * "Progress" when unset.
		 */
		label?: string;
		/**
		 * Controls density (padding) of all steps.
		 * @default 'balanced'
		 */
		density?: 'compact' | 'balanced' | 'spacious';
		/**
		 * Controls where each step's indicator sits relative to the connector track.
		 * - 'separated': indicator lives in the label row, distinct from the progress
		 *   bar (the original Astryx layout).
		 * - 'on-track': indicator is slotted into the connector line as a node on the
		 *   track (the on-track indicator design).
		 * @default 'separated'
		 */
		indicatorPosition?: StepperIndicatorPosition;
		/**
		 * Options specific to the horizontal layout. `minimumStepWidth` controls
		 * the per-step collapse threshold; `collapsedVariant` selects a label with
		 * controls (`'withLabelAndControls'`), a label alone (`'withLabel'`), or a
		 * bare progress track (`'hiddenLabel'`).
		 * @default {minimumStepWidth: 112, collapsedVariant: 'withLabelAndControls'}
		 */
		horizontalOptions?: StepperHorizontalOptions;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { observeResize } from '../../internal/shared-resize-observer.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { rtlStyles } from '../../utils/rtl.stylex.js';
	import Icon from '../icon/icon.svelte';
	import IconButton from '../icon-button/icon-button.svelte';
	import {
		setStepperContext,
		setStepperInternalContext,
		type StepperContextValue,
		type StepperRegistrationOptions
	} from './stepper-context.svelte.js';
	import {
		stepperFrameAttrs,
		stepperRootAttrs,
		stepperSummaryAttrs,
		stepperSummaryBodyAttrs
	} from './stepper.stylex.js';

	/** Default width below which a step can no longer hold its own label. */
	const DEFAULT_MIN_STEP_WIDTH = 112;
	const DEFAULT_COLLAPSED_VARIANT: StepperCollapsedVariant = 'withLabelAndControls';

	/**
	 * A stepper component for multi-step workflows. Displays numbered steps
	 * with visual indicators for completed, active, and upcoming states.
	 *
	 * Each Step child must provide a `step` prop (zero-based index) so it
	 * can derive its state from the parent's activeStep. The on-track layout
	 * hides the leading connector on the first step and the trailing connector
	 * on the last step structurally, from each step's own `<li>` position, so
	 * it works regardless of how the steps are grouped.
	 *
	 * Rendered as an ordered list (`<ol>`/`<li>`) rather than a `nav`
	 * landmark: a stepper communicates *progress through a sequence*, not a
	 * set of site navigation links. The active step is marked with
	 * `aria-current="step"` (handled per-step) and the list carries an
	 * accessible `label`. This follows the WAI-ARIA pattern for steppers /
	 * progress sequences and avoids polluting the page's landmark map.
	 *
	 * @example
	 * ```svelte
	 * <Stepper activeStep={1}>
	 *   <Step step={0} label="Account" />
	 *   <Step step={1} label="Profile" />
	 *   <Step step={2} label="Review" />
	 * </Stepper>
	 * ```
	 */
	const {
		activeStep,
		children,
		orientation = 'horizontal',
		onStepClick,
		label: labelFromProps,
		density = 'balanced',
		indicatorPosition = 'separated',
		horizontalOptions,
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: StepperProps = $props();

	const t = useTranslator();
	const label = $derived(labelFromProps ?? t('@astryx.stepper.label'));
	const minimumStepWidth = $derived(horizontalOptions?.minimumStepWidth ?? DEFAULT_MIN_STEP_WIDTH);
	const collapsedVariant = $derived(
		horizontalOptions?.collapsedVariant ?? DEFAULT_COLLAPSED_VARIANT
	);

	// Dev-mode duplicate step index detection. Steps register on mount and
	// deregister on unmount; a Map tracks count per index so we can warn when
	// two Steps share the same `step` value (which breaks aria-current).
	//
	// A plain `Map` in a plain `let`, which is what upstream's `useRef` is: a
	// mutable box nothing renders from. Making it `$state` would schedule a
	// re-render on every mount for a value only a `console.warn` reads.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const stepCounts = new Map<number, number>();
	// Compact navigation reads each Step's disabled state through the getter it
	// registered, so the registry does not copy state that belongs to the Step.
	// A Set keeps cleanup correct even for the invalid duplicate-index case.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const disabledGetters = new Map<number, Set<() => boolean>>();
	// How many steps there are, which the stepper needs for real and not only
	// for the warning: the width each step is getting is this divided into the
	// width the stepper got. Counted from what registers rather than from the
	// children, so grouping steps in a snippet or an array cannot change the
	// answer.
	let stepCount = $state(0);
	// Registration changes can leave the total step count unchanged (for example
	// when a Step's disabled state changes), so this revision still prompts the
	// parent to refresh compact control availability.
	let registrationRevision = $state(0);

	function registerStep(index: number, options?: StepperRegistrationOptions): () => void {
		const prev = stepCounts.get(index) ?? 0;
		stepCounts.set(index, prev + 1);
		// Upstream writes this as a bare, `NODE_ENV`-gated `console.warn` rather
		// than routing it through `devWarning`, and the message text is part of
		// what a consumer greps for — kept verbatim, as `Avatar`'s is.
		if (process.env.NODE_ENV !== 'production' && prev + 1 > 1) {
			console.warn(
				`[Stepper] Duplicate step index ${index}: two <Step> elements share the same \`step\` value. ` +
					`This breaks \`aria-current="step"\` and causes both to show as active simultaneously.`
			);
		}

		const getIsDisabled = options?.getIsDisabled;
		if (getIsDisabled) {
			const getters = disabledGetters.get(index) ?? new Set();
			getters.add(getIsDisabled);
			disabledGetters.set(index, getters);
		}

		// Registering runs from a Step's effect. `untrack` keeps that effect from
		// taking a dependency on the parent's counters, which this write changes —
		// a tracked read here re-runs the effect forever.
		untrack(() => {
			stepCount += 1;
			registrationRevision += 1;
		});
		return () =>
			untrack(() => {
				const cur = stepCounts.get(index) ?? 1;
				if (cur <= 1) {
					stepCounts.delete(index);
				} else {
					stepCounts.set(index, cur - 1);
				}

				if (getIsDisabled) {
					const getters = disabledGetters.get(index);
					getters?.delete(getIsDisabled);
					if (getters?.size === 0) {
						disabledGetters.delete(index);
					}
				}

				stepCount -= 1;
				registrationRevision += 1;
			});
	}

	// The step we came *from*. Steps need it to stagger their connector fill:
	// the distance and direction of the change decide which segment moves first
	// and how long the whole sweep may take (see `step.stylex.ts`'s CONNECTOR
	// FILL block).
	//
	// Upstream derives this during render from state — an effect runs after
	// paint, so the browser would already have committed the new fill states with
	// last render's delays, and on a jump of one that wrong first frame is the
	// entire animation. `$derived` is the same position in the Svelte lifecycle:
	// it recomputes when `activeStep` invalidates, before the DOM is updated, so
	// the classes and the timings land in the same commit.
	//
	// `seenCurrent`/`seenPrevious` are plain `let`s, not `$state`: writing to
	// `$state` from inside a `$derived` is a cycle, and nothing renders from them
	// directly. The step is idempotent for the same reason upstream's is stable
	// under StrictMode's double render — a second evaluation for an unchanged
	// `activeStep` finds `seenCurrent === activeStep` and changes nothing.
	//
	// Seeding both halves from the current `activeStep` is what suppresses the
	// cascade on mount: a stepper that opens on step 3 has no previous step to
	// have travelled from, so its completed segments paint filled at once. That
	// also makes the first evaluation identical on the server, so there is
	// nothing for hydration to disagree about.
	// `untrack` because the initial read is deliberately a snapshot — the
	// `$derived` below is the only thing that may follow `activeStep`.
	let seenCurrent = untrack(() => activeStep);
	let seenPrevious = untrack(() => activeStep);
	const previousActiveStep = $derived.by(() => {
		if (seenCurrent !== activeStep) {
			seenPrevious = seenCurrent;
			seenCurrent = activeStep;
		}
		return seenPrevious;
	});

	const isHorizontal = $derived(orientation === 'horizontal');

	// A vertical stepper gives every label a row of its own and can never run
	// out of width for them, so it opts out of all of this and renders exactly
	// the DOM it always has. A horizontal Stepper's public layout styles live on
	// its frame so they size the list and summary together; the semantic list
	// still owns the ref and DOM pass-throughs and fills that frame, so its width
	// is the effective component width to observe.
	let rootWidth = $state(0);
	function attachRoot(node: HTMLElement): (() => void) | undefined {
		if (!isHorizontal) {
			return;
		}
		// `observeResize` calls back once, synchronously, as it subscribes. That
		// is what keeps the collapse off the screen: an attachment runs before
		// paint, so the width lands and the update happens before the browser
		// shows the uncollapsed stepper it would otherwise paint first.
		return observeResize(node, (entry) => {
			const width = (entry.target as HTMLElement).clientWidth;
			// A same-width delivery writes nothing: the observer fires once on
			// registration and again on every observed box change, and most of
			// those leave the step width where it was.
			if (width !== rootWidth) {
				rootWidth = width;
			}
		});
	}

	// Width is measured rather than asked of a container query because the
	// answer changes what is *rendered*, not just how it looks: the labels and
	// their click targets leave the DOM entirely. A query could only have hidden
	// them, which would leave every step's text in the tree for a consumer's
	// `getByText` to trip over and every collapsed step still holding a focus
	// stop with nothing visible to show for it. Step content is the exception:
	// it stays mounted and is hidden so local state survives a resize.
	//
	// Either value being zero means the stepper has not been told something it
	// needs yet — on the server, and for the one commit before the observer
	// fires and the steps register — and until it has, it renders whole.
	const isCompact = $derived(
		isHorizontal && rootWidth > 0 && stepCount > 0 && rootWidth / stepCount < minimumStepWidth
	);

	let summarySlot = $state<HTMLElement | null>(null);

	// Controls appear only in the variant that asks for them and where there is
	// something for them to do. `onStepClick` answers whether the steps are
	// navigable at all; `collapsedVariant` answers whether this stepper should be
	// the thing that navigates them once collapsed.
	const showsControls = $derived(
		collapsedVariant === 'withLabelAndControls' && onStepClick != null
	);
	// `hiddenLabel` deliberately renders only the progress track. Omitting the
	// whole row also avoids spending the frame's gap on empty layout.
	const showsSummary = $derived(isCompact && collapsedVariant !== 'hiddenLabel');

	/** The nearest enabled step in `delta` direction, read live. */
	function adjacentEnabledStep(delta: -1 | 1): number | null {
		void registrationRevision;
		let target: number | null = null;
		for (const index of stepCounts.keys()) {
			if ([...(disabledGetters.get(index) ?? [])].some((getIsDisabled) => getIsDisabled())) {
				continue;
			}
			if (
				delta === -1
					? index < activeStep && (target == null || index > target)
					: index > activeStep && (target == null || index < target)
			) {
				target = index;
			}
		}
		return target;
	}

	const previousTarget = $derived(adjacentEnabledStep(-1));
	const nextTarget = $derived(adjacentEnabledStep(1));

	// A getter, never a frozen value: `activeStep` and `previousActiveStep` move
	// on every navigation and every Step reads both.
	const publicCtxValue = (): StepperContextValue => ({
		activeStep,
		previousActiveStep,
		orientation,
		isNonLinear: onStepClick != null,
		onStepClick: onStepClick ?? null,
		density,
		indicatorPosition,
		registerStep
	});
	setStepperContext(publicCtxValue);
	setStepperInternalContext(() => ({
		...publicCtxValue(),
		stepCount,
		isCompact,
		summarySlot
	}));

	const theme = $derived(themeProps('stepper', { orientation, indicatorPosition }));
	const frameTheme = themeProps('stepper-frame');
	const summaryTheme = themeProps('stepper-summary');
	const rootAttrs = $derived(
		stepperRootAttrs({ orientation, indicatorPosition }, isHorizontal ? undefined : xstyle)
	);
	const frameAttrs = $derived(stepperFrameAttrs(xstyle));
	const summaryAttrs = stepperSummaryAttrs();
	const summaryBodyAttrs = stepperSummaryBodyAttrs();
</script>

{#snippet control(delta: -1 | 1)}
	{@const target = delta === -1 ? previousTarget : nextTarget}
	{@const name = delta === -1 ? t('@astryx.stepper.previousStep') : t('@astryx.stepper.nextStep')}
	<IconButton
		variant="ghost"
		label={name}
		tooltip={name}
		isDisabled={target == null}
		onclick={() => {
			// A custom registration may read state that changed without causing
			// Stepper to render. Resolve again at activation so a target that
			// became disabled cannot be selected from the render-time snapshot.
			const currentTarget = adjacentEnabledStep(delta);
			if (currentTarget != null) {
				onStepClick?.(currentTarget);
			}
		}}
	>
		{#snippet icon()}
			<Icon icon={delta === -1 ? 'chevronLeft' : 'chevronRight'} xstyle={rtlStyles.mirror} />
		{/snippet}
	</IconButton>
{/snippet}

{#snippet list()}
	<ol
		{@attach attachRoot}
		aria-label={label}
		{...rest}
		{...theme}
		class={cx(theme.class, rootAttrs.class, isHorizontal ? undefined : className)}
		style={mergeStyle(
			rootAttrs.style,
			isHorizontal ? undefined : (styleProp as string | undefined)
		)}
	>
		<!-- Each step renders its own progress bar segment; no child introspection
		     needed — steps derive state from context. -->
		{@render children()}
	</ol>
{/snippet}

{#if isHorizontal}
	<div
		{...frameTheme}
		class={cx(frameTheme.class, frameAttrs.class, className)}
		style={mergeStyle(frameAttrs.style, styleProp as string | undefined)}
	>
		{@render list()}
		{#if showsSummary}
			<div
				{...summaryTheme}
				class={cx(summaryTheme.class, summaryAttrs.class)}
				style={summaryAttrs.style}
			>
				{#if showsControls}
					{@render control(-1)}
				{/if}
				<!-- The list above still carries every step's name and status, so
				this visual row is hidden from assistive technology to avoid
				announcing the current step twice. hiddenLabel withholds the
				entire row above, leaving the accessible list as a bare track. -->
				<div
					bind:this={summarySlot}
					aria-hidden="true"
					class={summaryBodyAttrs.class}
					style={summaryBodyAttrs.style}
				></div>
				{#if showsControls}
					{@render control(1)}
				{/if}
			</div>
		{/if}
	</div>
{:else}
	{@render list()}
{/if}
