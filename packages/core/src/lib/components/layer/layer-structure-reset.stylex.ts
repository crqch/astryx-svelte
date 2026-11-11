import * as stylex from '@stylexjs/stylex';

/**
 * Ported from Astryx's `Layer/layerStructureReset.stylex.ts`.
 *
 * Stops inherited structural custom properties at a layer's content boundary.
 * Apply beside `layerTextReset`, before component and consumer styles. Name
 * each property: a structural channel stops here only once it is known. Theme
 * tokens and writing context must keep inheriting, so this never resets by
 * prefix.
 */
export const layerStructureReset = stylex.create({
	reset: {
		// A Stepper reads its connector gap from the nearest ancestor that sets
		// it, so a Stepper opened in a layer from one of its steps would inherit
		// the outer track's gap. `initial` hands the connector back its own 0px
		// fallback.
		'--step-connector-gap': 'initial',
		// A container that wraps with `overflow-wrap: anywhere` passes it to the
		// Text inside it. `initial` makes the variable invalid, so Text falls
		// back to its own `break-word`.
		'--_astryx-text-overflow-wrap': 'initial'
	}
});
