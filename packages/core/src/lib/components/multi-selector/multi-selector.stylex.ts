import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	inputStatusBorderStyles,
	inputStatusHoverShadowStyles,
	inputWrapperStyles
} from '../field/input-styles.stylex.js';
import { inputDisabledFocusStyles } from '../field/input-disabled-focus.stylex.js';
import type { InputStatusType } from '../field/types.js';
import { groupStyles } from '../input-group/group-styles.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	fontWeightVars,
	radiusVars,
	sizeVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';

/**
 * Ported from Astryx's `MultiSelector/MultiSelector.tsx`, where the styles are
 * inline in the component file rather than in a module of their own. The four
 * group names (`styles`/`sizeStyles`/`itemSizeStyles`/`selectAllSizeStyles`) are
 * upstream's, so none is renamed.
 *
 * Deliberately *not* shared with `selector.stylex.ts`: the two declare a dozen
 * identically-named keys, but they are separate `stylex.create` calls upstream
 * and several differ (`MultiSelector`'s `triggerContainer` has no coarse-pointer
 * font-size bump, its `trigger` carries a `borderRadius`, its `item` has no
 * `justifyContent` and adds a `fontWeight`, and it has no `dropdownInput` /
 * `searchRowInput` pair). Folding them together would be an invention.
 */

const styles = stylex.create({
	// Trigger container — the enhanced click target wrapping the combobox button and clear button as siblings
	triggerContainer: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		color: colorVars['--color-text-primary'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// Trigger button — the actual combobox button, visually integrated with the container
	trigger: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
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
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		// The wrapper (inputWrapperStyles.base) renders the focus ring via
		// :focus-within when this button is focused, matching
		// TextInput/NumberInput/Selector. The button must not draw its own
		// :focus-visible outline or the two stack into a doubled ring over the
		// trigger.
		outline: 'none',
		borderRadius: radiusVars['--radius-element']
	},
	triggerPlaceholder: {
		color: colorVars['--color-text-secondary']
	},
	triggerContent: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		minWidth: 0,
		overflow: 'hidden'
	},
	triggerText: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	triggerBadges: {
		display: 'flex',
		flexWrap: 'wrap',
		gap: spacingVars['--spacing-1'],
		alignItems: 'center'
	},
	triggerOverflow: {
		flexShrink: 0,
		fontSize: typeScaleVars['--text-label-size'],
		color: colorVars['--color-text-secondary'],
		fontWeight: fontWeightVars['--font-weight-medium']
	},
	// Only what Icon does not already provide: `size="sm"` gives the 16px box
	// and `color` the token, but the glyph still must not shrink inside the flex
	// trigger.
	triggerIcon: {
		flexShrink: 0
	},
	// Rotation lives on the chevron glyph itself (passed through `xstyle`), not
	// on the layout wrapper above, so the icon's `multi-selector-indicator-icon`
	// theme target and the open/closed transform sit on one element — a theme can
	// restyle the mark and its rotation through a single selector. The wrapper
	// keeps only layout. The status branch renders a different icon, so it never
	// picks these up and needs no transition opt-out.
	triggerIconRotation: {
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
		transformOrigin: 'center'
	},
	triggerIconOpen: {
		transform: 'rotate(180deg)'
	},
	triggerGhost: {
		width: 'auto',
		borderWidth: 0,
		backgroundColor: 'transparent',
		boxShadow: {
			default: 'none',
			':hover:not(:focus-within):where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': 'none'
			},
			':focus-within': 'none'
		},
		fontWeight: fontWeightVars['--font-weight-medium'],
		transitionProperty: 'background-image, background-color, color, opacity, transform',
		transform: {
			default: 'scale(1)',
			// A mouse press; under a coarse pointer the touch press model writes
			// `data-astryx-press` instead (see interaction-overlay.stylex.ts).
			':active': {
				default: 'scale(0.98)',
				'@media (pointer: coarse)': 'scale(1)'
			},
			'[data-astryx-press="on"]': 'scale(0.98)'
		}
	},
	// Keep the input-family width contract while reusing ghost's borderless paint
	// and the neutral resting fill used by secondary buttons.
	triggerSecondary: {
		borderWidth: 0,
		backgroundColor: colorVars['--color-neutral'],
		boxShadow: {
			default: 'none',
			':hover:not(:focus-within):where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': 'none'
			},
			':focus-within': 'none'
		},
		fontWeight: fontWeightVars['--font-weight-medium'],
		transitionProperty: 'background-image, background-color, color, opacity, transform',
		transform: {
			default: 'scale(1)',
			':active': {
				default: 'scale(0.98)',
				'@media (pointer: coarse)': 'scale(1)'
			},
			'[data-astryx-press="on"]': 'scale(0.98)'
		}
	},
	triggerGhostDisabled: {
		backgroundImage: 'none',
		transform: {
			default: 'none',
			':active': 'none',
			'[data-astryx-press="on"]': 'none'
		}
	},
	triggerReadOnly: {
		cursor: 'default'
	},
	triggerGhostReadOnly: {
		backgroundImage: 'none',
		transform: {
			default: 'none',
			':active': 'none',
			'[data-astryx-press="on"]': 'none'
		}
	},

	// Clear button
	statusButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		color: 'inherit',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		borderRadius: radiusVars['--radius-element']
	},

	// A panel with a search field, capped as a whole.
	searchPanel: {
		display: 'flex',
		flexDirection: 'column',
		// No taller than its layer's block-size cap, which folds in the software
		// keyboard's. The search field's row keeps its height, and the list takes
		// what is left.
		maxHeight: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxBlockSize})`,
			`calc(${layerViewportInset.maxBlockSizeFallback})`
		)
	},

	// Dropdown container
	dropdown: {
		boxSizing: 'border-box',
		// In a search panel, the list shrinks below its content to fit the cap.
		minHeight: 0,
		// 300 px, and no taller than its layer's block-size cap, which folds in
		// the software keyboard's: the list ends above the keyboard with the
		// layer.
		maxHeight: stylex.firstThatWorks(
			`min(300px, ${layerViewportInset.maxBlockSize})`,
			`min(300px, ${layerViewportInset.maxBlockSizeFallback})`
		),
		overflowY: 'auto',
		padding: spacingVars['--spacing-1']
	},
	listbox: {
		outline: 'none'
	},

	// Popover container (for anchor positioning)
	popover: {
		minWidth: 'anchor-size(width)'
	},

	// Select-all wrapper
	selectAllWrapper: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},

	// Section heading. Plain secondary text, no rules — the same treatment
	// DropdownMenu and CommandPaletteGroup already use for a group heading in a
	// panel list. A labelled Divider (line–text–line) reads as a separator, and
	// next to the search row's own divider it stacked two rules a few pixels
	// apart.
	sectionHeading: {
		paddingBlock: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-2'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary'],
		userSelect: 'none'
	},

	// Divider
	divider: {
		marginBlock: spacingVars['--spacing-1']
	},

	// Individual item
	item: {
		boxSizing: 'border-box',
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		borderRadius: radiusVars['--radius-element'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		// Row typography lives here, not on the label span, so a theme override on
		// the row target reaches both the fallback label and renderOption output
		// (a declaration on the span would win over the inherited row value).
		// Matches Selector, whose option row owns its typography the same way.
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-primary'],
		backgroundColor: 'transparent',
		borderWidth: 0,
		borderStyle: 'none',
		outline: 'none'
	},
	itemHighlighted: {
		backgroundColor: colorVars['--color-overlay-hover']
	},
	itemDisabled: {
		opacity: 0.5,
		color: colorVars['--color-text-disabled'],
		cursor: 'default'
	},

	// Decorative checkbox (non-interactive, purely visual)
	checkboxDecorative: {
		pointerEvents: 'none',
		display: 'flex',
		flexShrink: 0
	},
	// Pushed to the row's far edge rather than sitting against the label, which
	// is what an end-positioned control means here. The row is not
	// `space-between` (a truncating label plus a trailing control is what wants
	// the auto margin), and `renderOption` content is not wrapped in a growing
	// span, so the margin has to live on the checkbox itself.
	checkboxDecorativeEnd: {
		marginInlineStart: 'auto'
	},

	// Label text for items (rendered outside checkbox for correct click
	// behavior). Typography is inherited from the row; this only handles
	// truncation.
	itemLabel: {
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},

	// Grid rows (spec:AST-058): the row carries today's option chrome (padding,
	// radius, highlight); its two cells split it into the option's click
	// target and the action's slot. The action cell is a real cell for the
	// active-descendant ring, drawn with the shared focus-outline parts because
	// no element inside the popup has DOM focus.
	gridRow: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2']
	},
	optionCell: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexGrow: 1,
		flexShrink: 1,
		minWidth: 0,
		alignSelf: 'stretch'
	},
	actionCell: {
		display: 'flex',
		alignItems: 'center',
		flexShrink: 0,
		borderRadius: radiusVars['--radius-element']
	},
	// The standard ring, from the focus tokens themselves: inside
	// `stylex.create` StyleX resolves an imported `defineVars` group, and a
	// plain object such as `FOCUS_OUTLINE_PARTS` compiles to variables nothing
	// defines.
	actionCellActive: {
		outlineWidth: focusVars['--focus-outline-width'],
		outlineStyle: focusVars['--focus-outline-style'],
		outlineColor: focusVars['--focus-outline-color'],
		outlineOffset: focusVars['--focus-outline-offset']
	},

	// Empty state
	emptyState: {
		padding: spacingVars['--spacing-3'],
		textAlign: 'center',
		color: colorVars['--color-text-secondary'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size']
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

const itemSizeStyles = stylex.create({
	sm: {
		padding: spacingVars['--spacing-1']
	},
	md: {
		paddingBlock: spacingVars['--spacing-1-5'],
		paddingInline: spacingVars['--spacing-2']
	},
	lg: {
		padding: spacingVars['--spacing-2']
	}
});

const selectAllSizeStyles = stylex.create({
	sm: {
		paddingInline: spacingVars['--spacing-1'],
		paddingBlock: spacingVars['--spacing-0-5']
	},
	md: {
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1']
	},
	lg: {
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1']
	}
});

/** Published from `multi-selector.svelte`, derived from the size style keys. */
export type MultiSelectorSize = keyof typeof sizeStyles;

/**
 * Visual style of the trigger. Declared here rather than in
 * `multi-selector.svelte` because `multiSelectorTriggerContainerAttrs` needs it,
 * the same arrangement `ButtonVariant` takes; upstream declares it in
 * `MultiSelector.tsx` beside the styles it gates.
 *
 * Deliberately absent from `src/lib/index.ts`: upstream's
 * `MultiSelector/index.ts` publishes `MultiSelectorProps`/`MultiSelectorSize`/
 * `MultiSelectorStatusType` and withholds `MultiSelectorVariant`, so the barrel
 * does too.
 */
export type MultiSelectorVariant = 'input' | 'secondary' | 'ghost';

/** The bordered surface wrapping the trigger button, spinner, clear and chevron. */
export function multiSelectorTriggerContainerAttrs(
	size: MultiSelectorSize,
	variant: MultiSelectorVariant,
	statusType: InputStatusType | undefined,
	isDisabled: boolean,
	isReadOnly: boolean,
	isEmpty: boolean,
	inGroup: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		styles.triggerContainer,
		sizeStyles[size],
		variant === 'secondary' && styles.triggerSecondary,
		variant === 'ghost' && styles.triggerGhost,
		// Upstream 0.5.1 moved the ghost trigger's hover/pressed overlay into the
		// shared module, under the same non-input gate and in upstream's position;
		// `secondary` joined it when that variant landed.
		variant !== 'input' && interactionOverlayStyles.backgroundImage,
		// A ghost or secondary trigger has no bordered wrapper of its own, so the
		// shared ring is what makes its keyboard focus visible (#4935/#4973).
		// `focusWithin` is `:has(:focus-visible)`, so a pointer click does not draw
		// it.
		variant !== 'input' && focusOutlineStyles.focusWithin,
		isDisabled && inputWrapperStyles.disabled,
		// The shared disabled style drops the focus ring; restore it while the
		// trigger, a direct child, has keyboard focus (`spec:AST-085` FR6).
		variant === 'input' && isDisabled && inputDisabledFocusStyles.ring,
		isReadOnly && styles.triggerReadOnly,
		variant !== 'input' && isDisabled && styles.triggerGhostDisabled,
		variant !== 'input' && isReadOnly && styles.triggerGhostReadOnly,
		isEmpty && styles.triggerPlaceholder,
		variant === 'input' && statusType && inputStatusBorderStyles[statusType],
		variant === 'input' && statusType && !isDisabled && inputStatusHoverShadowStyles[statusType],
		variant !== 'ghost' && inGroup && groupStyles.inGroup,
		xstyle
	);
}

/** The combobox button itself (a plain button in `hasSearch` mode). */
export function multiSelectorTriggerAttrs(): SvelteStyleAttrs {
	return sx(styles.trigger);
}

/** The span inside the trigger that holds the display content. */
export function multiSelectorTriggerContentAttrs(): SvelteStyleAttrs {
	return sx(styles.triggerContent);
}

/** The truncating text for the `count`/`labels` displays and the placeholder. */
export function multiSelectorTriggerTextAttrs(): SvelteStyleAttrs {
	return sx(styles.triggerText);
}

/** The wrapping row of badges for the `badges` display. */
export function multiSelectorTriggerBadgesAttrs(): SvelteStyleAttrs {
	return sx(styles.triggerBadges);
}

/** The trailing `+N` count beside the badges. */
export function multiSelectorTriggerOverflowAttrs(): SvelteStyleAttrs {
	return sx(styles.triggerOverflow);
}

/**
 * `xstyle` for the on-field status glyph — the no-shrink rule alone. The status
 * branch renders a different icon from the chevron, so it never picks up the
 * rotation and needs no transition opt-out.
 */
export const multiSelectorTriggerIconStyle: StyleArg = styles.triggerIcon;

/**
 * `xstyle` for the chevron glyph: the no-shrink rule, the rotation transition,
 * and the flip while open. Handed to `Icon` so one element carries the mark, its
 * transform and the `multi-selector-indicator-icon` theme target.
 */
export function multiSelectorChevronXstyle(isOpen: boolean): StyleArg {
	return [styles.triggerIcon, styles.triggerIconRotation, isOpen && styles.triggerIconOpen];
}

/** The focusable status button that opens the `tooltip` variant's info-tip. */
export function multiSelectorStatusButtonAttrs(): SvelteStyleAttrs {
	return sx(focusOutlineStyles.focusVisible, styles.statusButton);
}

/**
 * The scrolling container the option list sits in. With a search row it is a
 * sibling of the header rather than its parent, so the field stays put while the
 * options scroll under it.
 */
export function multiSelectorDropdownAttrs(): SvelteStyleAttrs {
	return sx(styles.dropdown);
}

/**
 * The whole popup with a search row: header, divider and the scrolling list,
 * capped together at the layer's block-size limit. Without it the header would
 * scroll with the list and the field would slide out of reach.
 */
export function multiSelectorSearchPanelAttrs(): SvelteStyleAttrs {
	return sx(styles.searchPanel);
}

/**
 * The listbox itself, inside the scrolling dropdown. `outline: none` because the
 * row, not the container, carries the highlight — a sheet-presented listbox owns
 * the keyboard, and the container must not draw a focus ring of its own.
 */
export function multiSelectorListboxAttrs(): SvelteStyleAttrs {
	return sx(styles.listbox);
}

/** The `aria-hidden` heading inside a `role="group"`. */
export function multiSelectorSectionHeadingAttrs(): SvelteStyleAttrs {
	return sx(styles.sectionHeading);
}

/**
 * A single `role="option"` row. The select-all row takes its own size ramp and
 * the `selectAllWrapper` layout, as upstream's conditional does. In a grid the
 * row also takes the `gridRow` layout, which its two cells then split.
 */
export function multiSelectorItemAttrs(
	size: MultiSelectorSize,
	isSelectAll: boolean,
	isHighlighted: boolean,
	isDisabled: boolean,
	isGrid: boolean
): SvelteStyleAttrs {
	return sx(
		styles.item,
		isSelectAll ? selectAllSizeStyles[size] : itemSizeStyles[size],
		isSelectAll && styles.selectAllWrapper,
		isHighlighted && styles.itemHighlighted,
		isDisabled && styles.itemDisabled,
		isGrid && styles.gridRow
	);
}

/** The option's cell in a grid row: its click target. */
export function multiSelectorOptionCellAttrs(): SvelteStyleAttrs {
	return sx(styles.optionCell);
}

/**
 * The action's cell in a grid row. The active variant draws the standard focus
 * ring, since no element inside the popup holds DOM focus.
 */
export function multiSelectorActionCellAttrs(isActive: boolean): SvelteStyleAttrs {
	return sx(styles.actionCell, isActive && styles.actionCellActive);
}

/**
 * The `inert` wrapper around the purely visual checkbox. At `indicatorPosition:
 * 'end'` it is pushed to the row's far edge with an auto inline-start margin.
 */
export function multiSelectorCheckboxDecorativeAttrs(isEnd: boolean): SvelteStyleAttrs {
	return sx(styles.checkboxDecorative, isEnd && styles.checkboxDecorativeEnd);
}

/**
 * The option's label text, rendered outside the checkbox. Truncation only — the
 * row owns the typography, including the disabled colour.
 */
export function multiSelectorItemLabelAttrs(): SvelteStyleAttrs {
	return sx(styles.itemLabel);
}

/** The "No results found" row. */
export function multiSelectorEmptyStateAttrs(): SvelteStyleAttrs {
	return sx(styles.emptyState);
}

/** `xstyle` for a plain divider between option groups. */
export const multiSelectorDividerStyle: StyleArg = styles.divider;

/** `xstyle` for the layer container — upstream's `styles.popover`. */
export const multiSelectorPopoverStyle: StyleArg = styles.popover;

/**
 * The system's standard menu clearance, passed to `<PopoverLayer offset>`
 * (#4951). It replaces the `marginBlockStart` this module used to bake into
 * `popover`, which a `position-try-fallbacks` flip would have applied to the
 * wrong edge. A token cannot be read from a `.svelte` file, so it is re-exported
 * here — the arrangement `powerSearchPopoverOffset` settled.
 */
export const multiSelectorPopoverOffset: string = spacingVars['--spacing-1'];
