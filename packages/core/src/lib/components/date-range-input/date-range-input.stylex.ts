import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	inputStatusBorderStyles,
	inputStatusFocusWithinStyles,
	inputStatusHoverShadowStyles,
	inputWrapperStyles
} from '../field/input-styles.stylex.js';
import { inputDisabledFocusStyles } from '../field/input-disabled-focus.stylex.js';
import type { InputStatusType } from '../field/types.js';
import {
	borderVars,
	colorVars,
	radiusVars,
	sizeVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';

/**
 * Ported from Astryx's `DateRangeInput/DateRangeInput.tsx`, where the styles are
 * inline in the component file rather than in a module of their own.
 *
 * Note there is **no** `groupStyles.inGroup` here, unlike `DateInput`/
 * `TimeInput`/`NumberInput`: `DateRangeInput` does not read the `InputGroup`
 * context at all upstream, so it has no in-group appearance to compose. That is
 * an upstream asymmetry, replicated rather than smoothed over.
 *
 * `trigger` is a `<button>` styled to read as an input — it restates the shared
 * input typography but adds `cursor: pointer`, `textAlign: start` and the
 * `nowrap`/`hidden`/`ellipsis` truncation trio, because a formatted range
 * ("Jan 5 – Feb 12") overflows a narrow field where a single date does not.
 */

const styles = stylex.create({
	trigger: {
		display: 'block',
		flex: 1,
		minWidth: 0,
		borderWidth: 0,
		borderStyle: 'none',
		padding: 0,
		fontFamily: typographyVars['--font-family-body'],
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			// The 16px floor is iOS-only: iOS Safari zooms the page when a focused
			// control sits under 16px, and only iOS WebKit implements
			// -webkit-touch-callout to key the coarse-pointer floor to it. A coarse
			// pointer alone is not the signal — a tablet with a mouse matches it.
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: typeScaleVars['--text-body-leading'],
		color: colorVars['--color-text-primary'],
		backgroundColor: 'transparent',
		outline: 'none',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textAlign: 'start',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis'
	},
	triggerPlaceholder: {
		color: colorVars['--color-text-secondary']
	},
	triggerDisabled: {
		cursor: 'default'
	},
	iconButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		borderRadius: radiusVars['--radius-element']
	},
	iconButtonDisabled: {
		cursor: 'default'
	},
	// The popover content scrolls inside the layer's block cap, so a stacked
	// calendar stays reachable on a short screen.
	popoverScroll: {
		overflowY: 'auto',
		overscrollBehavior: 'contain',
		maxBlockSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxBlockSize})`,
			`calc(${layerViewportInset.maxBlockSizeFallback})`
		)
	},
	popoverLayout: {
		display: 'flex',
		// When the presets and a one-month calendar do not fit side by side, the
		// row wraps and the presets stack above the calendar, in DOM order. The
		// preset group draws a divider on its inline end and its block end. A
		// negative margin moves each divider 1 border width past the group's margin
		// box, and this row clips at its edges. Thus only the divider between the
		// two parts shows: the inline-end one side by side, the block-end one when
		// stacked. The row clips, not the scroller, so the overhang is never
		// scrollable overflow.
		flexWrap: 'wrap',
		overflow: 'clip'
	},
	presetSidebar: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-3'],
		borderInlineEndWidth: borderVars['--border-width'],
		borderInlineEndStyle: 'solid',
		borderInlineEndColor: colorVars['--color-border-emphasized'],
		borderBlockEndWidth: borderVars['--border-width'],
		borderBlockEndStyle: 'solid',
		borderBlockEndColor: colorVars['--color-border-emphasized'],
		marginInlineEnd: `calc(-1 * ${borderVars['--border-width']})`,
		marginBlockEnd: `calc(-1 * ${borderVars['--border-width']})`,
		// Alone on its line, the group fills the line, so its inline-end divider
		// reaches the clipped edge.
		flexGrow: 1,
		minWidth: 140
	},
	calendarPane: {
		// Gives back the border width the preset group's margin takes, so the
		// calendar keeps its side-by-side position.
		marginInlineStart: borderVars['--border-width'],
		// The row wraps on the calendar's one-month width, and the calendar then
		// takes the free space, so its months sit in a row where they fit. The
		// large factor keeps the preset group at its own width beside it.
		flexBasis: 'min-content',
		flexGrow: 1_000_000
	},
	presetButton: {
		display: 'block',
		width: '100%',
		padding: `${spacingVars['--spacing-1']} ${spacingVars['--spacing-2']}`,
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: {
			default: 'transparent',
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		color: colorVars['--color-text-primary'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textAlign: 'start'
	},
	presetButtonDisabled: {
		color: colorVars['--color-text-disabled'],
		cursor: 'default',
		backgroundColor: 'transparent'
	},
	presetButtonActive: {
		backgroundColor: colorVars['--color-accent-muted'],
		color: colorVars['--color-text-accent']
	}
});

const sizeStyles = stylex.create({
	sm: {
		height: sizeVars['--size-element-sm'],
		minWidth: 180
	},
	md: {
		height: sizeVars['--size-element-md'],
		minWidth: 180
	},
	lg: {
		height: sizeVars['--size-element-lg'],
		minWidth: 180
	}
});

/**
 * Upstream declares this as a literal `'sm' | 'md' | 'lg'` rather than deriving
 * it from the size keys, which is what its siblings do. Transcribed as-is; the
 * two are the same type, and the declaration site is the published contract.
 */
export type DateRangeInputSize = 'sm' | 'md' | 'lg';

/** The bordered surface: trigger chrome, popover anchor and tooltip anchor. */
export function dateRangeInputWrapperAttrs(
	size: DateRangeInputSize,
	statusType: InputStatusType | undefined,
	isEffectivelyDisabled: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		sizeStyles[size],
		isEffectivelyDisabled && inputWrapperStyles.disabled,
		isEffectivelyDisabled && inputDisabledFocusStyles.withinRing,
		statusType && inputStatusBorderStyles[statusType],
		statusType && !isEffectivelyDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType],
		xstyle
	);
}

/**
 * The calendar-toggle button and the clear button both. The disabled variant is
 * only ever applied to the toggle — the clear button is not rendered while the
 * field is effectively disabled.
 */
export function dateRangeInputIconButtonAttrs(isDisabled = false): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.iconButton,
		isDisabled && styles.iconButtonDisabled
	);
}

/**
 * The `<button>` that reads as the field's value. `triggerPlaceholder` narrows
 * `color` only, so it *replaces* `trigger`'s rather than joining it — the same
 * merge the `inputInvalid` keys elsewhere in this family rely on.
 */
export function dateRangeInputTriggerAttrs(
	isPlaceholder: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.trigger,
		isPlaceholder && styles.triggerPlaceholder,
		isDisabled && styles.triggerDisabled
	);
}

/** The popover's flex row: preset sidebar beside the calendar. */
export function dateRangeInputPopoverLayoutAttrs(): SvelteStyleAttrs {
	return sx(styles.popoverLayout);
}

/**
 * The popover's scrolling shell, capped at the layer's block size so a stacked
 * calendar stays reachable on a short screen.
 */
export function dateRangeInputPopoverScrollAttrs(): SvelteStyleAttrs {
	return sx(styles.popoverScroll);
}

/** The bordered preset rail. */
export function dateRangeInputPresetSidebarAttrs(): SvelteStyleAttrs {
	return sx(styles.presetSidebar);
}

/**
 * `xstyle` for the calendar beside the preset rail. Passed to `Calendar`, so the
 * key survives as an object rather than folding into an inline string — the
 * arrangement `popover` and `divider` already take.
 */
export const dateRangeInputCalendarPaneStyle: StyleArg = styles.calendarPane;

/**
 * One preset row; the applied preset takes the accent treatment, and a preset
 * whose range violates the span bounds is shown disabled rather than hidden.
 */
export function dateRangeInputPresetButtonAttrs(
	isActive: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.presetButton,
		isActive && styles.presetButtonActive,
		isDisabled && styles.presetButtonDisabled
	);
}
