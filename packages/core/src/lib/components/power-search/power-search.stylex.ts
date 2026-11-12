import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	sizeVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import {
	inputStatusBorderStyles,
	inputStatusFocusWithinStyles,
	inputStatusHoverShadowStyles,
	inputWrapperStyles
} from '../field/input-styles.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';
import type { InputStatus } from '../field/types.js';

/**
 * Ported from Astryx's `PowerSearch.tsx` styles — the popover and the sheet
 * trigger's presentation.
 *
 * `tokenValueStyles.value` and `resultCountStyles.text` reach `stylex.props`
 * at fixed call sites, so upstream's compiler folded each into a literal class
 * string (22 sites and 1 respectively): `inline` mode. The extractor keys an
 * inline string by its content, so one case entry claims all 22.
 *
 * `popoverLayerStyles.layer` is passed as an **`xstyle`**, never to
 * `stylex.props`, so it survives in `dist/` as an object: `object` mode. It is
 * therefore exported raw rather than through `sx()`.
 *
 * The sheet trigger's styles are split the same way upstream's build splits
 * them: `wrapper`/`wrapperWithTokens` and the three `sm`/`md`/`lg` sizes stay
 * live objects because their call site combines nine style arguments with
 * conditions, while every other key reaches one plain call site and folds into
 * a literal string. Every key is still written through an attrs helper here —
 * a `stylex.create` key nothing references is compiled away, and the oracle
 * would then report it absent rather than stale.
 *
 * `sheetTriggerStyles` reproduces the same control box as the tokenizer field
 * with display-only tokens and one button as its only tab stop. The end lane
 * sits outside that button so a caller's action keeps its own tab stop.
 */
const tokenValueStyles = stylex.create({
	value: {
		fontWeight: fontWeightVars['--font-weight-bold']
	}
});

export const popoverLayerStyles = stylex.create({
	layer: {
		width: 'anchor-size(width)',
		// Floor for comfortable editing, clamped by the layer runtime's viewport
		// cap rather than by the room beside the anchor; the runtime flips or
		// slides the editor into view when it does not fit there (#4761).
		minWidth: stylex.firstThatWorks(
			`min(400px, ${layerViewportInset.maxInlineSize})`,
			`min(400px, ${layerViewportInset.maxInlineSizeFallback})`
		)
	}
});

/**
 * The clearance upstream passes as `popover.render(…, {offset})` at 0.4.x
 * (#4951). It used to be a `marginTop` baked into `layer` above, which a
 * `position-try-fallbacks` flip would strand on the wrong edge. Exported from
 * here rather than read in the markup, so the token import stays out of the
 * `.svelte` file.
 */
export const powerSearchPopoverOffset = spacingVars['--spacing-1'];

const resultCountStyles = stylex.create({
	text: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap'
	}
});

// The sheet presentation's trigger field: the same control box as the
// tokenizer field, with display-only tokens and one button as its only tab
// stop.
const sheetTriggerSizeStyles = stylex.create({
	sm: { minHeight: sizeVars['--size-element-sm'] },
	md: { minHeight: sizeVars['--size-element-md'] },
	lg: { minHeight: sizeVars['--size-element-lg'] }
});

const sheetTriggerStyles = stylex.create({
	wrapper: {
		position: 'relative',
		flexWrap: 'nowrap',
		gap: spacingVars['--spacing-1'],
		height: 'auto',
		cursor: {
			default: 'pointer',
			':is([aria-disabled="true"])': 'default'
		}
	},
	wrapperWithTokens: {
		paddingBlock: `calc(${spacingVars['--spacing-1']} - 1px)`,
		paddingInline: `calc(${spacingVars['--spacing-1']} - 1px)`
	},
	contentSection: {
		position: 'relative',
		minWidth: 0,
		flexGrow: 1,
		display: 'flex',
		alignItems: 'center',
		flexWrap: 'wrap',
		columnGap: spacingVars['--spacing-1'],
		rowGap: `calc(${spacingVars['--spacing-1']} - 1px)`
	},
	startIconWithTokens: {
		marginInlineStart: `calc(${spacingVars['--spacing-2']} - ${spacingVars['--spacing-1']} + 1px)`
	},
	// The only tab stop in the field. It stays visually borderless while the
	// wrapper delegates taps on tokens and empty space to it.
	trigger: {
		appearance: 'none',
		flex: '1 1 40px',
		minWidth: '40px',
		alignSelf: 'stretch',
		display: 'flex',
		alignItems: 'center',
		paddingBlock: 0,
		paddingInline: spacingVars['--spacing-1'],
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		color: colorVars['--color-text-secondary'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		textAlign: 'start',
		whiteSpace: 'nowrap',
		cursor: {
			default: 'pointer',
			':is([aria-disabled="true"])': 'default'
		},
		outline: 'none'
	},
	// A placeholder longer than the trigger ends in an ellipsis inside it, as
	// Selector's value does. It never runs under the result count or past the
	// field's border.
	placeholder: {
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	// Once a token is present the empty trigger covers the token lane instead
	// of reserving 40px or wrapping onto an otherwise blank row.
	triggerWithTokens: {
		position: 'absolute',
		inset: 0,
		minWidth: 0,
		padding: 0
	},
	endSection: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexShrink: 0,
		paddingInlineEnd: spacingVars['--spacing-1']
	}
});

/** The `<span>` carrying a token's formatted value. */
export function powerSearchTokenValueAttrs(): SvelteStyleAttrs {
	return sx(tokenValueStyles.value);
}

/** The `<span>` carrying the result count in the tokenizer's end slot. */
export function powerSearchResultCountAttrs(): SvelteStyleAttrs {
	return sx(resultCountStyles.text);
}

/**
 * The sheet trigger's control box: the tokenizer field's own wrapper styles,
 * the trigger's layout, and the status treatment Field gives an input. One
 * merged `sx()` call because the trigger's `gap` and padding must beat the
 * field's defaults, which is what `stylex.props` merge order gives upstream.
 */
export function powerSearchSheetTriggerWrapperAttrs({
	hasTokens,
	size,
	isDisabled,
	status
}: {
	hasTokens: boolean;
	size: 'sm' | 'md' | 'lg';
	isDisabled: boolean;
	status?: InputStatus;
}): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		inputWrapperStyles.textField,
		sheetTriggerStyles.wrapper,
		hasTokens && sheetTriggerStyles.wrapperWithTokens,
		sheetTriggerSizeStyles[size],
		isDisabled && inputWrapperStyles.disabled,
		status && inputStatusBorderStyles[status.type],
		status && !isDisabled && inputStatusHoverShadowStyles[status.type],
		status && inputStatusFocusWithinStyles[status.type]
	);
}

/** The flex lane holding the start icon and display-only tokens. */
export function powerSearchSheetContentAttrs(): SvelteStyleAttrs {
	return sx(sheetTriggerStyles.contentSection);
}

/** The start icon's inset once tokens precede it. */
export function powerSearchSheetStartIconAttrs(hasTokens: boolean): SvelteStyleAttrs {
	return sx(hasTokens && sheetTriggerStyles.startIconWithTokens);
}

/** The borderless button that opens the flow; the field's only tab stop. */
export function powerSearchSheetTriggerAttrs(hasTokens: boolean): SvelteStyleAttrs {
	return sx(sheetTriggerStyles.trigger, hasTokens && sheetTriggerStyles.triggerWithTokens);
}

/** The placeholder shown while no filter is applied. */
export function powerSearchSheetPlaceholderAttrs(): SvelteStyleAttrs {
	return sx(sheetTriggerStyles.placeholder);
}

/** The result count and `endContent` lane, outside the trigger button. */
export function powerSearchSheetEndSectionAttrs(): SvelteStyleAttrs {
	return sx(sheetTriggerStyles.endSection);
}
