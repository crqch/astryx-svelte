import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';
import type { StepperIndicatorPosition, StepperOrientation } from './stepper-context.svelte.js';

/**
 * Ported from the `stylex.create` block in Astryx's `Stepper/Stepper.tsx`.
 *
 * The `<ol>` is a flex line whose direction follows `orientation`; the on-track
 * variants exist because those steps must abut so their connector segments form
 * one continuous line, which collapses the inter-step gap to zero.
 */
const styles = stylex.create({
	root: {
		// Horizontal consumer styles live on the frame. Explicit inheritance keeps
		// the public variable discoverable on this theme target without masking a
		// frame value; the connector use site supplies the 0px default.
		'--step-connector-gap': 'inherit',
		display: 'flex',
		width: '100%',
		listStyleType: 'none',
		margin: 0,
		padding: 0
	},
	// The gap between steps is the break between connector segments, so it is
	// sized to match the connector's own thickness (BAR_WIDTH, the same token).
	// That keeps the track reading as one dashed line rather than as bars with
	// an arbitrary space between them, and holds at any theme scale.
	horizontal: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: spacingVars['--spacing-1']
	},
	vertical: {
		flexDirection: 'column',
		gap: spacingVars['--spacing-1']
	},
	// On-track: steps must abut so their connector segments form one continuous
	// line, so the inter-step gap collapses to zero.
	horizontalOnTrack: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 0
	},
	verticalOnTrack: {
		flexDirection: 'column',
		gap: 0
	},
	// The horizontal component's public layout box: consumer styling sizes and
	// places the track and compact summary together. The list fills this frame,
	// so observing its width still measures the complete component constraint.
	frame: {
		'--step-connector-gap': '0px',
		display: 'flex',
		flexDirection: 'column',
		gap: 0,
		width: '100%'
	},
	// Laid out as a row so the controls can bracket the step: they belong at
	// the edges the flow moves between, and the name reads between them.
	summary: {
		alignItems: 'center',
		display: 'flex',
		gap: spacingVars['--spacing-2'],
		justifyContent: 'space-between',
		minWidth: 0
	},
	// Centred, so the name sits under the middle of the track rather than
	// drifting toward whichever control happens to be enabled.
	summaryBody: {
		display: 'flex',
		flexDirection: 'column',
		flexGrow: 1,
		minWidth: 0,
		textAlign: 'center'
	}
});

export interface StepperRootOptions {
	orientation: StepperOrientation;
	indicatorPosition: StepperIndicatorPosition;
}

/** The `<ol>` that holds the steps. */
export function stepperRootAttrs(
	{ orientation, indicatorPosition }: StepperRootOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	const isOnTrack = indicatorPosition === 'on-track';
	const orientationStyle =
		orientation === 'horizontal'
			? isOnTrack
				? styles.horizontalOnTrack
				: styles.horizontal
			: isOnTrack
				? styles.verticalOnTrack
				: styles.vertical;

	return sx(styles.root, orientationStyle, xstyle);
}

/** The horizontal component's layout box: list and compact summary together. */
export function stepperFrameAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.frame, xstyle);
}

/** The compact row beneath a collapsed horizontal track. */
export function stepperSummaryAttrs(): SvelteStyleAttrs {
	return sx(styles.summary);
}

/** The centred slot the active step draws its compact label into. */
export function stepperSummaryBodyAttrs(): SvelteStyleAttrs {
	return sx(styles.summaryBody);
}
