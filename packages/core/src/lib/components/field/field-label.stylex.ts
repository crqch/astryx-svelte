import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Field/FieldLabel.tsx`.
 *
 * `srOnly` is declared here rather than reusing `VisuallyHidden`'s, and that is
 * deliberate: upstream's uses the **physical** `left`/`top`, where ours uses the
 * logical `insetInlineStart`/`insetBlockStart`.
 *
 * The divergence is one class wide, on the inline axis only — StyleX collapses
 * `insetBlockStart` and `top` to the same atomic class, since the block axis is
 * not RTL-flippable, but keeps `inset-inline-start:0` (`x1o0tod`) distinct from
 * `left:0` (`xu96u03`). Sharing would emit CSS upstream does not.
 */
const styles = stylex.create({
	// The label and its description read as a single block, with no space
	// between them. They need a wrapper of their own to get that: as bare
	// siblings they pick up the column gap of whichever caller holds them
	// (Field, CheckboxInput, Switch), which is the spacing meant to separate
	// the label group from the control below it.
	labelGroup: {
		display: 'flex',
		flexDirection: 'column'
	},
	// A hidden label group must not take a slot in the caller's layout, or an
	// empty box would draw the caller's gap around nothing. Dropping the
	// wrapper box leaves the sr-only children out of flow directly under the
	// caller, so the group occupies no space at all.
	labelGroupHidden: {
		display: 'contents'
	},
	label: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-secondary'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	labelDisabled: {
		color: colorVars['--color-text-disabled'],
		cursor: 'default'
	},
	// A button inside a label also activates the label's control, so the info
	// button sits outside it, in one row with the label.
	labelRow: {
		display: 'inline-flex',
		alignItems: 'center',
		// In a block label cell, keep the row's top on the cell's top, not on a
		// text baseline.
		verticalAlign: 'top',
		gap: spacingVars['--spacing-1']
	},
	// With a hidden label the row takes no slot in the caller's layout.
	labelRowHidden: {
		display: 'contents'
	},
	// A hidden label's info button takes no layout slot. While it has keyboard
	// focus, it moves into flow above the control. There nothing covers or clips
	// it. It stays positioned, because InfoTip's touch band needs a positioned
	// host.
	infoTipHidden: {
		position: { default: 'absolute', ':focus-visible': 'relative' },
		alignSelf: 'flex-start',
		clip: { default: 'rect(0, 0, 0, 0)', ':focus-visible': 'auto' },
		overflow: { default: 'hidden', ':focus-visible': 'visible' },
		whiteSpace: 'nowrap'
	},
	srOnly: {
		borderStyle: 'none',
		clip: 'rect(0, 0, 0, 0)',
		height: 1,
		insetInlineStart: 0,
		margin: -1,
		overflow: 'hidden',
		padding: 0,
		pointerEvents: 'none',
		position: 'absolute',
		top: 0,
		userSelect: 'none',
		whiteSpace: 'nowrap',
		width: 1
	},
	optionalRequired: {
		fontWeight: fontWeightVars['--font-weight-normal'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary']
	},
	description: {
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		fontWeight: fontWeightVars['--font-weight-normal'],
		color: colorVars['--color-text-secondary']
	},
	// When the description forwards clicks to a click-activatable control
	// (checkbox/switch), it reads as part of the same hit target as the label.
	descriptionClickable: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	}
});

/** The wrapper around the label and its description, when there is one. */
export function fieldLabelLabelGroupAttrs(isLabelHidden: boolean): SvelteStyleAttrs {
	return sx(styles.labelGroup, isLabelHidden && styles.labelGroupHidden);
}

/** The row holding the label and its trailing info button, when there is one. */
export function fieldLabelLabelRowAttrs(isLabelHidden: boolean): SvelteStyleAttrs {
	return sx(styles.labelRow, isLabelHidden && styles.labelRowHidden);
}

/** Handed to the trailing `InfoTip` as `xstyle` when the label is hidden. */
export const infoTipHiddenStyle: StyleArg = styles.infoTipHidden;

/** The label element itself — `<label>`, or `<span>` for a group label. */
export function fieldLabelAttrs(
	isDisabled: boolean,
	isLabelHidden: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.label,
		isDisabled && styles.labelDisabled,
		isLabelHidden && styles.srOnly,
		xstyle
	);
}

/** The trailing "Optional" / "Required" run inside the label. */
export function fieldLabelStatusTextAttrs(): SvelteStyleAttrs {
	return sx(styles.optionalRequired);
}

/**
 * The description that follows the label. `isClickable` adds the pointer cursor
 * for the 0.3.0 description-click forwarding — it is only set when forwarding is
 * actually active, so a group label (which has no single control to forward to)
 * keeps the default cursor.
 */
export function fieldLabelDescriptionAttrs(
	isLabelHidden: boolean,
	isClickable = false
): SvelteStyleAttrs {
	// Upstream's order — `descriptionClickable` BEFORE `srOnly`. Composition order
	// decides which declaration wins on a shared property, so this is not
	// cosmetic; reversing it changes the emitted class string.
	return sx(
		styles.description,
		isClickable && styles.descriptionClickable,
		isLabelHidden && styles.srOnly
	);
}
