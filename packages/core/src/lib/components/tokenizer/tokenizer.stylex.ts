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
import { colorVars, sizeVars, spacingVars, typeScaleVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Tokenizer/Tokenizer.tsx`, where the styles are inline in
 * the component file rather than in a module of their own. The five group names
 * (`styles`/`sizeStyles`/`endSectionSizeStyles`/`truncatedSizeStyles`/
 * `layerPlaceholderSizeStyles`) are upstream's, so none is renamed.
 */

// How far the end lane sits from the field's inline-end border, named once
// because the input's reserve is derived from the same value.
const TOKEN_ROW_INSET = `calc(${spacingVars['--spacing-1']} - 1px)`;
// Kept in sync with useEndLaneReserve: wrapperWithTokens reads the custom
// property directly, to keep token rows and the input short of the lane.
const END_LANE_RESERVE_VAR = '--_tokenizer-end-lane-reserve';
const END_LANE_INSET = spacingVars['--spacing-2'];

/**
 * Where a grouped strip's edge fade turns opaque, and how far focus scrolling
 * keeps a focused control from a faded edge. The fade is transparent across
 * the strip's focus-ring bleed, so a faded edge never paints into the row
 * padding.
 */
const TRACK_FADE_INSET = `calc(${TOKEN_ROW_INSET} + ${spacingVars['--spacing-6']})`;
const TRACK_FADE_FROM_LEFT = `linear-gradient(to right, transparent ${TOKEN_ROW_INSET}, black ${TRACK_FADE_INSET})`;
const TRACK_FADE_FROM_RIGHT = `linear-gradient(to left, transparent ${TOKEN_ROW_INSET}, black ${TRACK_FADE_INSET})`;

const styles = stylex.create({
	wrapper: {
		position: 'relative',
		flexWrap: 'wrap',
		gap: spacingVars['--spacing-1'],
		cursor: {
			default: 'text',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		height: 'auto'
	},
	wrapperWithTokens: {
		// Override padding for border concentricity: token border-radius
		// (radius-1: 4px) sits concentric with wrapper border-radius
		// (radius-2: 8px) when inset = radius-2 - radius-1 - border
		// = 8 - 4 - 1 = 3px.
		paddingBlock: TOKEN_ROW_INSET,
		paddingInline: TOKEN_ROW_INSET,
		// The end lane is out of flow, so tokens would wrap under it. Every row
		// stops short of the measured lane instead; with no lane the variable
		// is absent and this is the ordinary inset.
		paddingInlineEnd: `calc(${TOKEN_ROW_INSET} + var(${END_LANE_RESERVE_VAR}, 0px))`,
		// Row gap must match paddingBlock so wrapped rows look evenly spaced.
		rowGap: TOKEN_ROW_INSET
	},
	// Inside an InputGroup the tokenizer is a single-line surface: its tokens
	// keep to one scrolling strip beside the end controls. Ported as styles at
	// 0.7.16; the grouped presentation itself is not wired yet (port/debts.md).
	inGroupWrapper: {
		// InputGroup is a fixed-height, single-line surface: a second row would
		// spill past the group's shared border, so the row never wraps. A single
		// row of tokens fits the group height.
		flexWrap: 'nowrap'
	},
	inGroupTrack: {
		// The grouped row keeps to one line by scrolling, and only this track
		// scrolls. The end lane is its sibling, so tokens are clipped beside the
		// end controls instead of painting under them, and the controls hold the
		// row's inline end while the tokens move. useScrollableArea owns the
		// overflow declarations.
		display: 'flex',
		alignItems: 'center',
		alignSelf: 'stretch',
		flex: '1 1 0',
		minWidth: 0,
		// A scroll container clips at its own padding edge. Bleed back out to the
		// row's, so a token's focus ring keeps the room the row padding gives it.
		margin: `calc(-1 * ${TOKEN_ROW_INSET})`,
		padding: TOKEN_ROW_INSET,
		// A native scrollbar would take most of a 28-32px row. The edge fades show
		// what is out of view instead, and the keyboard reaches it through the
		// remove buttons or, when disabled, through the track itself. Forced
		// colors restore the platform scrollbar.
		scrollbarWidth: {
			default: 'none',
			// A classic scrollbar at full width takes half the row.
			'@media (forced-colors: active)': 'thin'
		},
		scrollPaddingInline: TRACK_FADE_INSET
	},
	inGroupTrackContent: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		flex: 'none',
		// At least the track's width, so the input can take what the tokens leave;
		// wider once they overflow, which is the range the track scrolls.
		minWidth: '100%'
	},
	inGroupTrackContentTruncated: {
		// The "+N more" summary measures this box, so it holds the track's width.
		width: '100%'
	},
	// Each fade masks an edge that hides tokens. Forced colors drop the fades,
	// since the native scrollbar is back there.
	trackFadeStart: {
		maskImage: {
			default: TRACK_FADE_FROM_LEFT,
			':dir(rtl)': {
				default: TRACK_FADE_FROM_RIGHT,
				'@media (forced-colors: active)': 'none'
			},
			'@media (forced-colors: active)': 'none'
		}
	},
	trackFadeEnd: {
		maskImage: {
			default: TRACK_FADE_FROM_RIGHT,
			':dir(rtl)': {
				default: TRACK_FADE_FROM_LEFT,
				'@media (forced-colors: active)': 'none'
			},
			'@media (forced-colors: active)': 'none'
		}
	},
	trackFadeBoth: {
		maskImage: {
			default: `linear-gradient(to right, transparent ${TOKEN_ROW_INSET}, black ${TRACK_FADE_INSET}, black calc(100% - ${TRACK_FADE_INSET}), transparent calc(100% - ${TOKEN_ROW_INSET}))`,
			'@media (forced-colors: active)': 'none'
		}
	},
	inGroupInput: {
		// Always in flow after the last token. The empty-query hit surface of
		// inputCompact keeps a wrapping field from growing a blank row; a grouped
		// row cannot wrap, and its in-flow lane needs no reserve.
		minWidth: '40px',
		flex: '1 1 40px',
		width: 0,
		paddingInlineStart: `calc(${spacingVars['--spacing-2']} - ${spacingVars['--spacing-1']} + 1px)`
	},
	inGroupEndSection: {
		// In flow beside the track: with one row there is no first row to pin to,
		// so the lane takes its own width out of the row and needs no measuring.
		position: 'static',
		transform: 'none',
		// Give back the gap the track's bleed takes.
		marginInlineStart: TOKEN_ROW_INSET
	},
	inGroupEndSectionWithTokens: {
		// Restore the lane's 8px inset from the border, since wrapperWithTokens
		// reduces the row padding to 3px.
		marginInlineEnd: `calc(${END_LANE_INSET} - ${TOKEN_ROW_INSET})`
	},
	startIconWithTokens: {
		// Restore the default 8px inline-start inset when tokens are present,
		// since wrapperWithTokens reduces padding to 3px for border concentricity.
		marginInlineStart: `calc(${spacingVars['--spacing-2']} - ${spacingVars['--spacing-1']} + 1px)`,
		position: 'relative',
		zIndex: 1
	},
	token: {
		display: 'flex',
		flexShrink: 0,
		// A renderToken wrapper sizes to its content; cap it at the row so the
		// pill inside truncates instead of running past the field.
		maxWidth: '100%',
		position: 'relative',
		zIndex: 1
	},
	endSection: {
		position: 'absolute',
		// Match the field's inline padding (inputWrapperStyles.base uses
		// spacing-2) so end content (clear button, resultCount) lines up with
		// the text/start-icon inset instead of hugging the border at ~3px.
		insetInlineEnd: spacingVars['--spacing-2'],
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexShrink: 0,
		zIndex: 1
	},
	idleSpinner: {
		// Hides the Spinner's own box too, which a theme may paint, and covers
		// engines without content-visibility. Both keep the box's size.
		visibility: 'hidden',
		// Skips the ring's rendering, and with it the infinite arc animation,
		// while the root keeps its own explicit, themed width and height.
		contentVisibility: 'hidden'
	},
	inputAtMax: {
		width: 0,
		minWidth: 0,
		flex: '0 0 0',
		padding: 0,
		opacity: 0,
		position: 'absolute'
	},
	inputCompact: {
		position: 'relative',
		boxSizing: 'border-box',
		zIndex: 0,
		// The input follows the last token in flow, so a focused empty input's
		// caret sits where typed text will start. Empty, it asks only for that
		// inset, and only while focused and editable: blurred or read-only (a
		// disabled field with a disabledMessage stays focusable), it claims no
		// room at all, not even the column gap, so it never grows the field a
		// blank row. Typing restores the full editing width, which may wrap.
		minWidth: {
			default: '40px',
			':placeholder-shown': 0
		},
		flex: {
			default: '1 1 40px',
			':placeholder-shown': '1 1 0px'
		},
		width: 0,
		marginInlineStart: {
			default: 0,
			':placeholder-shown:is(:not(:focus), :read-only)': `calc(-1 * ${spacingVars['--spacing-1']})`
		},
		// Restore normal text inset when input follows tokens, since the
		// wrapper padding is reduced for border concentricity.
		paddingInlineStart: {
			default: `calc(${spacingVars['--spacing-2']} - ${spacingVars['--spacing-1']} + 1px)`,
			':placeholder-shown:is(:not(:focus), :read-only)': 0
		},
		// wrapperWithTokens already keeps the in-flow input short of the lane.
		paddingInlineEnd: 0
	},
	truncatedWrapper: {
		flexWrap: 'nowrap',
		overflow: 'hidden'
	},
	layerPopover: {
		// Top-layer popover: match the anchor width exactly so the expanded
		// tokenizer looks like an in-place expansion, overlapping the
		// placeholder from its top edge.
		width: 'anchor-size(width)'
	},
	overflowText: {
		flexShrink: 0,
		whiteSpace: 'nowrap',
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary'],
		paddingInline: spacingVars['--spacing-1']
	},
	// The sheet presentation's field: the inline field's own control box. A
	// button cannot contain controls, so the trigger, the tokens and the end lane
	// are siblings in this box. `endContent` and a custom token can then hold their
	// own controls. There is no input to type into, so the cursor says "press".
	sheetField: {
		width: '100%',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// The box carries no aria-disabled: that would expose a caller's operable
	// `endContent` as disabled. The trigger carries it, so the box keys its
	// disabled cursor on the prop.
	sheetFieldDisabled: {
		cursor: 'default'
	},
	// With tokens, the button covers the box beneath them. A tap on a token or
	// on empty space then opens the sheet. The box draws the focus ring, so the
	// button draws none.
	sheetTrigger: {
		appearance: 'none',
		flexGrow: 1,
		alignSelf: 'stretch',
		display: 'flex',
		alignItems: 'center',
		minWidth: 0,
		padding: 0,
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		fontFamily: 'inherit',
		fontSize: 'inherit',
		lineHeight: 'inherit',
		color: 'inherit',
		textAlign: 'start',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		outline: 'none'
	},
	sheetTriggerWithTokens: {
		position: 'absolute',
		inset: 0
	},
	// An aria-disabled button gets no system disabled paint in forced colors;
	// GrayText is the platform's disabled affordance there. Defaults repeat the
	// base values, since StyleX merges per property.
	sheetTriggerDisabled: {
		borderColor: {
			default: colorVars['--color-border-emphasized'],
			'@media (forced-colors: active)': 'GrayText'
		},
		color: {
			default: null,
			'@media (forced-colors: active)': 'GrayText'
		}
	},
	sheetTriggerPlaceholder: {
		color: colorVars['--color-text-secondary'],
		// Match the input's text inset so the placeholder sits where the typed
		// query would.
		paddingInline: spacingVars['--spacing-1']
	},
	sheetTriggerPlaceholderDisabled: {
		color: {
			default: colorVars['--color-text-secondary'],
			'@media (forced-colors: active)': 'GrayText'
		}
	},
	// A Token authors its own color, which forced colors replace with
	// CanvasText; GrayText marks the tokens of a disabled trigger as disabled.
	// The default repeats Token's own default color.
	sheetTokenDisabled: {
		color: {
			default: colorVars['--color-text-primary'],
			'@media (forced-colors: active)': 'GrayText'
		}
	}
});

const sizeStyles = stylex.create({
	sm: { minHeight: sizeVars['--size-element-sm'] },
	md: { minHeight: sizeVars['--size-element-md'] },
	lg: { minHeight: sizeVars['--size-element-lg'] }
});

const endSectionSizeStyles = stylex.create({
	sm: {
		top: `calc(${sizeVars['--size-element-sm']} / 2 - 1px)`,
		transform: 'translateY(-50%)'
	},
	md: {
		top: `calc(${sizeVars['--size-element-md']} / 2 - 1px)`,
		transform: 'translateY(-50%)'
	},
	lg: {
		top: `calc(${sizeVars['--size-element-lg']} / 2 - 1px)`,
		transform: 'translateY(-50%)'
	}
});

const truncatedSizeStyles = stylex.create({
	sm: { height: sizeVars['--size-element-sm'] },
	md: { height: sizeVars['--size-element-md'] },
	lg: { height: sizeVars['--size-element-lg'] }
});

const layerPlaceholderSizeStyles = stylex.create({
	sm: { height: sizeVars['--size-element-sm'] },
	md: { height: sizeVars['--size-element-md'] },
	lg: { height: sizeVars['--size-element-lg'] }
});

/** Published from `tokenizer.svelte`, derived from the size style keys. */
export type TokenizerSize = keyof typeof sizeStyles;

/**
 * The `role="group"` input wrapper — the bordered surface holding the tokens,
 * the typeahead input and the end section.
 */
export function tokenizerWrapperAttrs(
	size: TokenizerSize,
	statusType: InputStatusType | undefined,
	hasTokens: boolean,
	isTruncated: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		styles.wrapper,
		hasTokens && styles.wrapperWithTokens,
		isTruncated ? truncatedSizeStyles[size] : sizeStyles[size],
		isTruncated && styles.truncatedWrapper,
		isDisabled && inputWrapperStyles.disabled,
		isDisabled && inputDisabledFocusStyles.nestedRing,
		statusType && inputStatusBorderStyles[statusType],
		// `!isDisabled` is upstream's guard (`Tokenizer.tsx:742`), and it is the only
		// thing that removes the ring — not belt-and-braces over the `disabled` style
		// above. styleq keys a *conditional* declaration separately from an
		// unconditional one, so `inputWrapperStyles.disabled`'s flat
		// `boxShadow: 'none'` replaces only the default `boxShadow` key and never
		// touches the ring's `:hover:not(:focus-within)` key. Declaration order is
		// therefore irrelevant here: without this guard a disabled tokenizer carrying
		// a status keeps a hover ring upstream removes, however the two are ordered.
		//
		// An earlier version of this comment claimed styleq merged the two under one
		// key, last-wins — which would have made the guard redundant wherever
		// `disabled` came second, and led to one of the thirteen sites being written
		// off as inert. `input-status-hover-guard.svelte.test.ts` disproves it by
		// deleting each guard individually; every one fails its own case.
		statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType]
	);
}

/**
 * The in-flow placeholder that `unfocusedLayer` mode leaves behind while the
 * real wrapper is promoted into the top layer.
 */
export function tokenizerLayerPlaceholderAttrs(
	size: TokenizerSize,
	statusType: InputStatusType | undefined,
	hasTokens: boolean,
	isTruncated: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		styles.wrapper,
		hasTokens && styles.wrapperWithTokens,
		layerPlaceholderSizeStyles[size],
		isTruncated && styles.truncatedWrapper,
		isDisabled && inputWrapperStyles.disabled,
		statusType && inputStatusBorderStyles[statusType],
		// Same guard as the wrapper above, per upstream `Tokenizer.tsx:842`.
		statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType]
	);
}

/** The span that restores the start icon's inset once tokens are present. */
export function tokenizerStartIconAttrs(hasTokens: boolean): SvelteStyleAttrs {
	return sx(hasTokens && styles.startIconWithTokens);
}

/** The absolutely positioned end section holding `endContent` and the clear button. */
export function tokenizerEndSectionAttrs(size: TokenizerSize): SvelteStyleAttrs {
	return sx(styles.endSection, endSectionSizeStyles[size]);
}

/** The `+N more` indicator inside a truncated token row. */
export function tokenizerOverflowTextAttrs(): SvelteStyleAttrs {
	return sx(styles.overflowText);
}

/** `xstyle` for a rendered token (and the `<span>` wrapping a custom one). */
export const tokenizerTokenStyle: StyleArg = styles.token;

/** The wrapper a custom `renderToken` result is placed in. */
export function tokenizerTokenAttrs(): SvelteStyleAttrs {
	return sx(styles.token);
}

/** `inputXStyle` for the input once `maxEntries` is reached or the row is truncated. */
export const tokenizerInputAtMaxStyle: StyleArg = styles.inputAtMax;

/** `inputXStyle` for the input when it follows tokens. */
export const tokenizerInputCompactStyle: StyleArg = styles.inputCompact;

/** `xstyle` for the `unfocusedLayer` popover container. */
export const tokenizerLayerPopoverStyle: StyleArg = styles.layerPopover;

/** `xstyle` for a search Spinner that holds its slot while idle. */
export const tokenizerIdleSpinnerStyle: StyleArg = styles.idleSpinner;

/**
 * The sheet presentation's field box: the inline field's control box, kept for
 * its box, theming target and focus ring, with a press cursor instead of a
 * text one.
 */
export function tokenizerSheetFieldAttrs(
	size: TokenizerSize,
	statusType: InputStatusType | undefined,
	hasTokens: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		inputWrapperStyles.textField,
		styles.wrapper,
		styles.sheetField,
		isDisabled && styles.sheetFieldDisabled,
		// The field keeps the inline field's height for its size step, as
		// Selector's bottom-sheet trigger does; the sheet's own rows and search
		// field carry the touch-sized targets.
		sizeStyles[size],
		hasTokens && styles.wrapperWithTokens,
		isDisabled && inputWrapperStyles.disabled,
		isDisabled && styles.sheetTriggerDisabled,
		statusType && inputStatusBorderStyles[statusType],
		statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		statusType && inputStatusFocusWithinStyles[statusType]
	);
}

/** The trigger button inside the sheet field. */
export function tokenizerSheetTriggerAttrs(
	hasTokens: boolean,
	laneReserve: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.sheetTrigger,
		hasTokens && styles.sheetTriggerWithTokens,
		// With no token the placeholder stops short of the end lane, as the
		// inline input's text does.
		!hasTokens && laneReserve
	);
}

/** The placeholder span inside an empty sheet trigger. */
export function tokenizerSheetTriggerPlaceholderAttrs(isDisabled: boolean): SvelteStyleAttrs {
	return sx(styles.sheetTriggerPlaceholder, isDisabled && styles.sheetTriggerPlaceholderDisabled);
}

/** `xstyle` for a default Token in the sheet field when the field is disabled. */
export function tokenizerSheetTokenStyle(isDisabled: boolean): StyleArg {
	return isDisabled ? styles.sheetTokenDisabled : undefined;
}

/**
 * The grouped presentation's styles, ported at 0.7.16 but not wired into the
 * component yet: the single-line strip inside an `InputGroup` is a follow-up
 * (port/debts.md). The builders keep the keys referenced, so the class oracle
 * can compare them against upstream, and give the eventual wiring one shape.
 */
export function tokenizerInGroupWrapperAttrs(): SvelteStyleAttrs {
	return sx(styles.inGroupWrapper);
}

/** The scrolling track, with the edge fade for the edge that hides tokens. */
export function tokenizerInGroupTrackAttrs(
	fade: 'start' | 'end' | 'both' | null
): SvelteStyleAttrs {
	return sx(
		styles.inGroupTrack,
		fade === 'start' && styles.trackFadeStart,
		fade === 'end' && styles.trackFadeEnd,
		fade === 'both' && styles.trackFadeBoth
	);
}

/** The strip's content: at least the track's width, or exactly it when truncated. */
export function tokenizerInGroupTrackContentAttrs(isTruncated: boolean): SvelteStyleAttrs {
	return sx(styles.inGroupTrackContent, isTruncated && styles.inGroupTrackContentTruncated);
}

/** The inline input lane after the last token. */
export function tokenizerInGroupInputAttrs(): SvelteStyleAttrs {
	return sx(styles.inGroupInput);
}

/** The end lane, in flow beside the track. */
export function tokenizerInGroupEndSectionAttrs(hasTokens: boolean): SvelteStyleAttrs {
	return sx(styles.inGroupEndSection, hasTokens && styles.inGroupEndSectionWithTokens);
}
