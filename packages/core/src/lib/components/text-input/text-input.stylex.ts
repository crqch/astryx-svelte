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
import { colorVars, sizeVars, typeScaleVars, typographyVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `TextInput/TextInput.tsx`.
 *
 * Like `TextArea`, the wrapper builds on `Field`'s shared `inputWrapperStyles`
 * rather than restating the border/focus/hover chrome. The `<input>` itself,
 * its disabled cursor and the size heights are the only styles local to this
 * component; when the field sits inside an `InputGroup`, `groupStyles.inGroup`
 * collapses the shared border.
 *
 * There is no `clearButton` here. 0.4.x (#4876) converged the whole input
 * family on the shared `InputClearButton`, which draws the ring from
 * `focusOutlineStyles` — this module's copy was one of the two that hand-drew a
 * 1px `--color-accent` ring nothing else in the system used.
 */

const styles = stylex.create({
	input: {
		display: 'block',
		flex: 1,
		minWidth: 0,
		borderWidth: 0,
		borderStyle: 'none',
		padding: 0,
		fontFamily: typographyVars['--font-family-body'],
		// The 16px floor is iOS-only: iOS Safari zooms the page when a focused
		// control sits under 16px, and only iOS WebKit implements
		// `-webkit-touch-callout` to key the coarse-pointer floor to it.
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
		'::placeholder': {
			color: colorVars['--color-text-secondary']
		}
	},
	inputDisabled: {
		cursor: 'default'
	}
});

const sizeStyles = stylex.create({
	sm: {
		height: sizeVars['--size-element-sm']
	},
	md: {
		height: sizeVars['--size-element-md']
	},
	lg: {
		height: sizeVars['--size-element-lg']
	}
});

export type TextInputSize = keyof typeof sizeStyles;

/** The bordered surface: input chrome, click-to-focus host and tooltip anchor. */
export function textInputWrapperAttrs(
	size: TextInputSize,
	statusType: InputStatusType | undefined,
	isDisabled: boolean,
	inGroup: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		sizeStyles[size],
		isDisabled && inputWrapperStyles.disabled,
		isDisabled && inputDisabledFocusStyles.ring,
		statusType && inputStatusBorderStyles[statusType],
		statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType],
		inGroup && groupStyles.inGroup,
		xstyle
	);
}

/** The `<input>` itself. */
export function textInputAttrs(isDisabled: boolean): SvelteStyleAttrs {
	return sx(styles.input, isDisabled && styles.inputDisabled);
}
