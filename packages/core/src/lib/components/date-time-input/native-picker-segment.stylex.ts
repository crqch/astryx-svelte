import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import {
	colorVars,
	radiusVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `DateTimeInput/nativePickerSegmentStyles.ts`.
 *
 * Shared styling for the native date and time controls `DateTimeInput` renders
 * in its native presentation. The declarations are transcribed from the module
 * upstream keeps them in, including the `styles` group's keys.
 *
 * `nativeRow` lives here rather than beside the other row styles in
 * `date-time-input.stylex.ts`: the class-parity oracle maps that module to
 * upstream's `DateTimeInput.js` and carries a `styles.nativeRow` deferral, which
 * is not editable here. The declaration is upstream's exactly, so the compiler
 * emits the same atomic class from either file.
 */
const styles = stylex.create({
	// Match DateInput's closed-field floor. Without one, WebKit reports almost
	// no intrinsic width for appearance:none temporal inputs with overlays.
	nativeRow: {
		minInlineSize: 180
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
	input: {
		display: 'block',
		flex: 1,
		minWidth: 0,
		borderWidth: 0,
		borderStyle: 'none',
		padding: 0,
		fontFamily: typographyVars['--font-family-body'],
		// Below 16px iOS zooms the page when the field takes focus. Only iOS
		// WebKit implements -webkit-touch-callout, so the coarse-pointer floor is
		// keyed to iOS alone.
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: typeScaleVars['--text-body-leading'],
		color: colorVars['--color-text-primary'],
		backgroundColor: 'transparent',
		outline: 'none',
		// Native date/time controls size from their internal edit fields. Pin the
		// box to one text line so both segments stay aligned. The calc fallback
		// mirrors the iOS-only floor above; browsers with `1lh` track it for free.
		height: {
			default: stylex.firstThatWorks(
				'1lh',
				`calc(${typeScaleVars['--text-body-size']} * ${typeScaleVars['--text-body-leading']})`
			),
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': stylex.firstThatWorks(
					'1lh',
					`calc(max(1rem, ${typeScaleVars['--text-body-size']}) * ${typeScaleVars['--text-body-leading']})`
				)
			}
		},
		WebkitAppearance: 'none',
		appearance: 'none',
		// DateTimeInput renders its own calendar/clock affordances.
		'::-webkit-calendar-picker-indicator': {
			display: 'none'
		},
		'::-webkit-date-and-time-value': {
			textAlign: 'start',
			marginBlock: 0,
			marginInline: 0,
			paddingBlock: 0,
			paddingInline: 0,
			lineHeight: 'inherit',
			minHeight: 0
		},
		'::-webkit-datetime-edit': {
			paddingBlock: 0,
			paddingInline: 0,
			lineHeight: 'inherit'
		}
	},
	inputDisabled: {
		cursor: 'default'
	},
	inputInvalid: {
		color: colorVars['--color-text-secondary']
	},
	inputTextHidden: {
		color: 'transparent',
		WebkitTextFillColor: 'transparent'
	},
	slot: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		flex: 1,
		minInlineSize: 0
	},
	overlay: {
		position: 'absolute',
		insetInlineStart: 0,
		insetInlineEnd: 0,
		insetBlock: 0,
		display: 'block',
		// The same iOS-only floor as the input it covers, shared baselines.
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: typeScaleVars['--text-body-leading'],
		pointerEvents: 'none',
		overflow: 'hidden',
		whiteSpace: 'nowrap',
		textOverflow: 'ellipsis'
	},
	overlayValue: {
		color: colorVars['--color-text-primary']
	},
	overlayPlaceholder: {
		color: colorVars['--color-text-secondary']
	}
});

/** The row's native-only inline floor, composed beside `styles.row`. */
export function nativePickerSegmentRowAttrs(): SvelteStyleAttrs {
	return sx(styles.nativeRow);
}

/** The picker-raising calendar/clock toggle. */
export function nativePickerSegmentIconButtonAttrs(isDisabled: boolean): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.iconButton,
		isDisabled && styles.iconButtonDisabled
	);
}

/** The positioned box the control and its text overlay share. */
export function nativePickerSegmentSlotAttrs(): SvelteStyleAttrs {
	return sx(styles.slot);
}

/**
 * The native `<input type="date"|"time">`. `inputTextHidden` and `inputInvalid`
 * both narrow `color`, so each replaces `input`'s rather than joining it — the
 * order is load-bearing, as in upstream's compiled lookup table.
 */
export function nativePickerSegmentInputAttrs(
	showsOverlay: boolean,
	isDisabled: boolean,
	isInvalid: boolean
): SvelteStyleAttrs {
	return sx(
		styles.input,
		showsOverlay && styles.inputTextHidden,
		isDisabled && styles.inputDisabled,
		isInvalid && styles.inputInvalid
	);
}

/** The localized text painted over the control. */
export function nativePickerSegmentOverlayAttrs(
	hasValue: boolean,
	isDisabled: boolean,
	isInvalid: boolean
): SvelteStyleAttrs {
	return sx(
		styles.overlay,
		hasValue ? styles.overlayValue : styles.overlayPlaceholder,
		isDisabled && styles.inputDisabled,
		isInvalid && hasValue && styles.inputInvalid
	);
}
