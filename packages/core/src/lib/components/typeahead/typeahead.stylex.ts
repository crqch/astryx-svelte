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
import { groupStyles } from '../input-group/group-styles.stylex.js';
import { sizeVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Typeahead/Typeahead.tsx`, where the styles are declared
 * inline in the component file under the group names `styles`/`wrapperSizeStyles`,
 * so neither needs a rename.
 */

const styles = stylex.create({
	wrapper: {
		position: 'relative',
		// No `flexWrap`. The shared field base does not wrap and neither does
		// TextInput; this field only ever holds one token, so there is no second
		// row to wrap to. It also cannot wrap and keep its end controls in flow:
		// flex moves an item to a new line rather than shrinking it, so a long
		// value put the clear button and spinner on a row of their own (a 280px
		// field grew to 46px tall). Unwrapped, the token ellipsizes instead.
		gap: spacingVars['--spacing-1'],
		// Standard padding minus border width to prevent height jump
		// when a token (28px) is added inside the input
		paddingBlock: `calc(${spacingVars['--spacing-1']} - 1px)`,
		cursor: {
			default: 'text',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// The busy indicator and the clear button, at the field's inline end.
	//
	// In flow, as a flex child — an in-flow box takes up room, so the input
	// cannot run underneath it and nothing has to be measured. That is
	// TextInput's arrangement for the same two controls.
	//
	// The `auto` margin keeps them in the corner in the states where the
	// content lane is not the only flexible item in the row (a start icon, a
	// grouped row): `auto` gives free space to the margin rather than to a
	// sibling, so it needs no sibling to exist.
	endLane: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		marginInlineStart: 'auto'
	},
	// The field's content lane: the input, and the token painted over it.
	//
	// This is the box the value is allowed to occupy, and it is what makes the
	// end lane's space its own — the lane is an ordinary flex item that ends
	// exactly where `endLane` begins, so a value bounded by it can never reach
	// the clear button or the spinner. Before it existed the token was
	// positioned against the whole field, so a value longer than the input ran
	// under the end controls and past the field's border (measured 33px of
	// overlap and 4px outside the border at a 180px field).
	//
	// `flex: 1` with `min-width: 0` is TextInput's own arrangement for its
	// input: the lane takes the free space so the end controls sit in the
	// corner, and yields all of it when the field is narrow, so a narrow field
	// never overflows. Stretched, so its padding box matches the field's
	// content box in the block direction and the token keeps the vertical
	// placement it has always had.
	contentLane: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		alignSelf: 'stretch',
		flex: 1,
		minWidth: 0
	},
	// While a token shows, the input keeps its place in the row and its own
	// intrinsic width — it is only made invisible and inert. That width is what
	// sizes the field, exactly as it does for TextInput, so a Typeahead is as
	// wide with a value as without one. Collapsing it to nothing instead left
	// the field measuring the token: in any shrink-to-fit parent it snapped to
	// the value's length (measured 199px to 57px, #5560), and block-level
	// parents hid it because they fill their container whatever their content
	// is, which is why no story caught it.
	inputHidden: {
		opacity: 0,
		// The token is painted over this space and owns the pointer; the input
		// must not swallow clicks meant for it, or for the wrapper's own
		// click-to-edit.
		pointerEvents: 'none'
	},
	// Painted over the input rather than beside it. In flow the token would add
	// its own width to the row, which is the same value-dependent sizing from
	// the other direction — a long value would grow the field.
	//
	// Bounded by the content lane at both ends. `fit-content` shrink-wraps the
	// label but resolves against the space left between the two insets, so a
	// long value ellipsizes at the lane's edge instead of running under the end
	// controls; the `auto` end margin is what keeps that pair of insets from
	// being over-constrained, which would drop the end one and let the token
	// overflow again. The negative inline start and the zero block start put it
	// where it has always sat: the lane's padding box is the field's content
	// box, 3px inside the field's own padding on both axes.
	tokenOverlay: {
		position: 'absolute' as const,
		insetBlockStart: 0,
		insetInlineStart: `calc(-1 * (${spacingVars['--spacing-1']} - 1px))`,
		insetInlineEnd: 0,
		width: 'fit-content',
		marginBlock: 0,
		marginInlineStart: 0,
		marginInlineEnd: 'auto'
	}
});

const wrapperSizeStyles = stylex.create({
	sm: { minHeight: sizeVars['--size-element-sm'] },
	md: { minHeight: sizeVars['--size-element-md'] },
	lg: { minHeight: sizeVars['--size-element-lg'] }
});

/** Published from `typeahead.svelte`, derived from the wrapper size keys. */
export type TypeaheadSize = keyof typeof wrapperSizeStyles;

/**
 * The bordered field surface: the token, the input and the clear button all sit
 * inside it, and it is the dropdown's anchor.
 *
 * `xstyle` reaches it only inside an `InputGroup` — outside one it goes to
 * `Field` instead, which is upstream's split.
 */
export function typeaheadWrapperAttrs(
	size: TypeaheadSize,
	statusType: InputStatusType | undefined,
	isDisabled: boolean,
	inGroup: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		styles.wrapper,
		wrapperSizeStyles[size],
		statusType && inputStatusBorderStyles[statusType],
		statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType],
		isDisabled && inputWrapperStyles.disabled,
		isDisabled && inputDisabledFocusStyles.nestedRing,
		inGroup && groupStyles.inGroup,
		inGroup && xstyle
	);
}

/** The field's content lane: the input, and the token painted over it. */
export function typeaheadContentLaneAttrs(): SvelteStyleAttrs {
	return sx(styles.contentLane);
}

/** The inline-end lane: the busy indicator and the clear button. */
export function typeaheadEndLaneAttrs(): SvelteStyleAttrs {
	return sx(styles.endLane);
}

/** `xstyle` for the selected-value `Token`, painted over the input. */
export const typeaheadTokenOverlayStyle: StyleArg = styles.tokenOverlay;

/** `xstyle` for the `BaseTypeahead` input while a token is showing. */
export const typeaheadInputHiddenStyle: StyleArg = styles.inputHidden;
