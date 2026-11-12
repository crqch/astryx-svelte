import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { rtlStyles } from '../../utils/rtl.stylex.js';
import {
	colorVars,
	spacingVars,
	radiusVars,
	durationVars,
	easeVars,
	typographyVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';

/**
 * `Slider`'s styles, ported from Astryx's `Slider/Slider.tsx`.
 *
 * Every positional value — thumb progress, filled-track extent, mark
 * placement — is a plain inline style, not a StyleX dynamic style, so this
 * module only carries the static geometry. There is no `defineMarker` either:
 * the thumb's hover and focus rules are element-local (`:hover` /
 * `:focus-visible`), unlike `Switch`/`CheckboxInput`, whose rules key off an
 * ancestor row.
 *
 * The filled range is a full-length bar moved into place inside two clips, so
 * it travels by `translate` alone. The thumbs travel the same way, from the
 * `--_slider-progress` custom property each one publishes inline.
 */

const TRACK_SIZE = 4;
/**
 * Exported because the component needs the same number for its thumb-travel
 * geometry. Upstream is one file, so it reads a module-private const; the split
 * here means the number has to cross the module boundary rather than be written
 * down twice.
 */
export const THUMB_SIZE = 20;
/** Half a thumb: the inset of the thumb's travel at each end of the track. */
const THUMB_INSET_PX = THUMB_SIZE / 2;

/** The private property a thumb and the fill parts publish inline. */
export const THUMB_PROGRESS = '--_slider-progress';
/** The filled range's ends as progress, written inline on the fill parts. */
export const FILL_START = '--_slider-fill-start';
export const FILL_END = '--_slider-fill-end';
/** A thumb's touch-target insets under a finger, which its `::before` draws. */
export const HIT_INSET = {
	top: '--_slider-hit-top',
	bottom: '--_slider-hit-bottom',
	inlineStart: '--_slider-hit-start',
	inlineEnd: '--_slider-hit-end'
} as const;

const styles = stylex.create({
	sliderRow: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2']
	},
	trackContainer: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		flexGrow: 1,
		// Under a finger (a coarse primary pointer) the control leaves the browser
		// its pans, so a swipe from the track or across a thumb scrolls the page.
		// `useSliderTouch`'s gesture host narrows that per element from the
		// recognizers attached to it (a thumb's pan keeps its own axis) and never
		// widens it. A mouse or a trackpad keeps the control's `none`.
		touchAction: {
			default: 'none',
			'@media (pointer: coarse)': 'manipulation'
		},
		// The control's text is never selectable. WebKit applies only the
		// prefixed property, so both are written.
		WebkitUserSelect: 'none',
		userSelect: 'none',
		isolation: 'isolate'
	},
	// Every part of the control sits in this box, which fills the control's
	// padding box. The thumbs and the fill travel in container units of it
	// (`cqi` / `cqb`). Its size never depends on its content.
	travelBox: {
		position: 'absolute',
		inset: 0,
		containerType: 'size'
	},
	// Where layout places a thumb at its value: the value tooltip's position
	// anchor. CSS anchor positioning reads the anchor's layout box, which the
	// thumb's `translate` does not move in every engine.
	valueAnchor: {
		position: 'absolute',
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		pointerEvents: 'none'
	},
	valueAnchorHorizontal: {
		top: `calc(50% - ${THUMB_SIZE / 2}px)`,
		insetInlineStart: `calc(var(${THUMB_PROGRESS}) * (100cqi - ${THUMB_SIZE}px))`
	},
	valueAnchorVertical: {
		insetInlineStart: `calc(50% - ${THUMB_SIZE / 2}px)`,
		bottom: `calc(var(${THUMB_PROGRESS}) * (100cqb - ${THUMB_SIZE}px))`
	},
	trackContainerHorizontal: {
		height: THUMB_SIZE,
		// The whole track is the tap target (a click anywhere on it moves the
		// slider), but it is only THUMB_SIZE (20px) tall — under the WCAG 2.5.8 AA
		// 24px minimum. Floor its block size to 24px on touch pointers only. The
		// rail and thumb center on 50%, so they stay put; only the invisible
		// tappable area grows. Desktop (fine pointer) is unchanged.
		minBlockSize: {
			default: null,
			'@media (pointer: coarse)': '24px'
		},
		width: '100%',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	trackContainerVertical: {
		width: THUMB_SIZE,
		height: 160,
		// Same tap target, rotated: the vertical track is the thing you press, and
		// it is only THUMB_SIZE (20px) wide. `minBlockSize` above floors the
		// horizontal track's short axis; here the short axis is the inline one
		// (the block size is already 160px), so floor that instead. The rail,
		// fill, marks and thumb all center on the inline 50%, so they stay put;
		// only the invisible tappable area grows. Desktop is unchanged.
		minInlineSize: {
			default: null,
			'@media (pointer: coarse)': '24px'
		},
		flexDirection: 'column',
		justifyContent: 'center',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	trackContainerDisabled: {
		opacity: 0.5,
		cursor: 'default'
	},
	track: {
		position: 'absolute',
		backgroundColor: colorVars['--color-track'],
		borderRadius: radiusVars['--radius-full']
	},
	trackHorizontal: {
		insetInlineStart: 0,
		insetInlineEnd: 0,
		height: TRACK_SIZE,
		top: '50%',
		transform: 'translateY(-50%)'
	},
	trackVertical: {
		top: 0,
		bottom: 0,
		width: TRACK_SIZE
	},
	// The filled range is a full-length bar moved into place inside two
	// clips, so it travels by translate alone. The clip has the track's shape
	// and rounds the start of a single slider's fill. The mover's start edge
	// cuts the fill at the range's start, and the fill's own end sits at the
	// range's end. Both ends of a range hide under its thumbs.
	fillClip: {
		position: 'absolute',
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-full'],
		pointerEvents: 'none'
	},
	fillClipHorizontal: {
		insetInlineStart: 0,
		insetInlineEnd: 0,
		height: TRACK_SIZE,
		top: '50%',
		transform: 'translateY(-50%)'
	},
	fillClipVertical: {
		top: 0,
		bottom: 0,
		width: TRACK_SIZE
	},
	fillMover: {
		position: 'absolute',
		inset: 0,
		overflow: 'hidden'
	},
	// A range's start is round, like the track's ends (the clip already
	// rounds a single slider's start). It shows through a disabled thumb's
	// translucent fill.
	fillMoverRangeStartHorizontal: {
		borderStartStartRadius: radiusVars['--radius-full'],
		borderEndStartRadius: radiusVars['--radius-full']
	},
	fillMoverRangeStartVertical: {
		borderEndStartRadius: radiusVars['--radius-full'],
		borderEndEndRadius: radiusVars['--radius-full']
	},
	fillMoverRangeHorizontal: {
		translate: {
			default: `calc(${THUMB_INSET_PX}px + var(${FILL_START}) * (100cqi - ${THUMB_SIZE}px)) 0`,
			':dir(rtl)': `calc(-${THUMB_INSET_PX}px - var(${FILL_START}) * (100cqi - ${THUMB_SIZE}px)) 0`
		}
	},
	fillMoverRangeVertical: {
		translate: `0 calc(-${THUMB_INSET_PX}px - var(${FILL_START}) * (100cqb - ${THUMB_SIZE}px))`
	},
	filledTrack: {
		position: 'absolute',
		inset: 0,
		backgroundColor: colorVars['--color-accent']
	},
	// The fill's end is round too, under the thumb.
	filledTrackHorizontal: {
		borderStartEndRadius: radiusVars['--radius-full'],
		borderEndEndRadius: radiusVars['--radius-full']
	},
	filledTrackVertical: {
		borderStartStartRadius: radiusVars['--radius-full'],
		borderStartEndRadius: radiusVars['--radius-full']
	},
	// A single slider's fill runs from the track's start to the thumb's center.
	filledTrackSingleHorizontal: {
		translate: {
			default: `calc(${THUMB_INSET_PX}px + var(${FILL_END}) * (100cqi - ${THUMB_SIZE}px) - 100cqi) 0`,
			':dir(rtl)': `calc(100cqi - ${THUMB_INSET_PX}px - var(${FILL_END}) * (100cqi - ${THUMB_SIZE}px)) 0`
		}
	},
	filledTrackSingleVertical: {
		translate: `0 calc(100cqb - ${THUMB_INSET_PX}px - var(${FILL_END}) * (100cqb - ${THUMB_SIZE}px))`
	},
	// A range's fill runs from the lower thumb's center to the upper's. The
	// mover already sits at the lower one.
	filledTrackRangeHorizontal: {
		translate: {
			default: `calc((var(${FILL_END}) - var(${FILL_START})) * (100cqi - ${THUMB_SIZE}px) - 100cqi) 0`,
			':dir(rtl)': `calc(100cqi - (var(${FILL_END}) - var(${FILL_START})) * (100cqi - ${THUMB_SIZE}px)) 0`
		}
	},
	filledTrackRangeVertical: {
		translate: `0 calc(100cqb - (var(${FILL_END}) - var(${FILL_START})) * (100cqb - ${THUMB_SIZE}px))`
	},
	thumb: {
		position: 'absolute',
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-accent'],
		transitionProperty: 'background-color, box-shadow',
		transitionDuration: {
			default: durationVars['--duration-fast'],
			'@media (prefers-reduced-motion: reduce)': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		outline: 'none',
		cursor: {
			default: 'grab',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		zIndex: 1
	},
	thumbHorizontal: {
		// Centered by its offset, not by a transform: the touch lift scales the
		// thumb (`scale`), and CSS applies `transform` inside `scale`. So a
		// centering translate would grow with it and lift the thumb off the
		// track.
		top: `calc(50% - ${THUMB_SIZE / 2}px)`,
		insetInlineStart: 0,
		// The thumb starts at the track's inline start (the right edge under
		// RTL). It travels by its progress along the track minus its own size,
		// so its center lands where `insetPosition` places the fill and the
		// marks. `translate` is physical, so it flips its sign under RTL.
		translate: {
			default: `calc(var(${THUMB_PROGRESS}) * (100cqi - ${THUMB_SIZE}px)) 0`,
			':dir(rtl)': `calc(var(${THUMB_PROGRESS}) * (${THUMB_SIZE}px - 100cqi)) 0`
		}
	},
	// A thumb's touch target under a finger: the thumb's own `::before`,
	// invisible and centered on it, larger than it. Each side grows by the
	// inset `thumbHitInsets` sets on the thumb.
	thumbHit: {
		'::before': {
			content: '""',
			position: 'absolute',
			top: `var(${HIT_INSET.top})`,
			bottom: `var(${HIT_INSET.bottom})`,
			insetInlineStart: `var(${HIT_INSET.inlineStart})`,
			insetInlineEnd: `var(${HIT_INSET.inlineEnd})`
		}
	},
	thumbVertical: {
		bottom: 0,
		// Centered by its offset (see thumbHorizontal): the same in both
		// directions, since the thumb is symmetric.
		insetInlineStart: `calc(50% - ${THUMB_SIZE / 2}px)`,
		translate: `0 calc(var(${THUMB_PROGRESS}) * (${THUMB_SIZE}px - 100cqb))`
	},
	thumbHover: {
		backgroundColor: {
			default: colorVars['--color-accent'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': `color-mix(in srgb, ${colorVars['--color-accent']}, ${colorVars['--color-tint-hover']} 15%)`
			}
		}
	},
	// Pressed: the system's pressed overlay over the thumb's fill for as long
	// as the thumb is being dragged. A slider is a drag, not a tap, so the
	// pressed paint follows the drag state the pointer handlers keep.
	thumbPressed: {
		backgroundImage: `linear-gradient(${colorVars['--color-overlay-pressed']}, ${colorVars['--color-overlay-pressed']})`
	},
	thumbDisabled: {
		backgroundColor: colorVars['--color-background-muted'],
		cursor: 'default'
	},
	textValue: {
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		color: colorVars['--color-text-primary'],
		whiteSpace: 'nowrap',
		flexShrink: 0
	},
	marksContainer: {
		position: 'absolute'
	},
	marksContainerHorizontal: {
		insetInlineStart: 0,
		insetInlineEnd: 0,
		top: '50%'
	},
	marksContainerVertical: {
		top: 0,
		bottom: 0,
		insetInlineStart: '50%'
	},
	mark: {
		position: 'absolute',
		backgroundColor: colorVars['--color-track'],
		borderRadius: radiusVars['--radius-full']
	},
	// Marks over the filled region (at or behind the thumb in single mode,
	// between the thumbs in range mode) take the fill color so they read as
	// part of the filled track rather than the unfilled rail.
	markFilled: {
		backgroundColor: colorVars['--color-accent']
	},
	markHorizontal: {
		width: 2,
		height: 8,
		transform: {
			default: 'translate(-50%, -50%)',
			':is([dir="rtl"] *)': 'translate(50%, -50%)'
		}
	},
	markVertical: {
		height: 2,
		width: 8,
		transform: 'translate(-50%, 50%)'
	},
	markLabel: {
		position: 'absolute',
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap'
	},
	markLabelHorizontal: {
		transform: {
			default: 'translateX(-50%)',
			':is([dir="rtl"] *)': 'translateX(50%)'
		},
		top: THUMB_SIZE / 2 + 4
	},
	markLabelVertical: {
		transform: 'translateY(50%)',
		insetInlineStart: THUMB_SIZE / 2 + 4
	}
});

/** The flex row holding the track container and the optional text readout. */
export function sliderRowAttrs(): SvelteStyleAttrs {
	return sx(styles.sliderRow);
}

/** The positioned, pointer-handling box the track, marks and thumbs sit in. */
export function sliderTrackContainerAttrs(
	isHorizontal: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.trackContainer,
		isHorizontal ? styles.trackContainerHorizontal : styles.trackContainerVertical,
		isDisabled && styles.trackContainerDisabled
	);
}

/** The control-sized box whose container units the parts travel in. */
export function sliderTravelBoxAttrs(): SvelteStyleAttrs {
	return sx(styles.travelBox);
}

/** The unfilled rail. */
export function sliderTrackAttrs(isHorizontal: boolean): SvelteStyleAttrs {
	return sx(
		styles.track,
		isHorizontal ? styles.trackHorizontal : [styles.trackVertical, rtlStyles.centerInline('0px')]
	);
}

/** The clip that gives the filled range the track's shape. */
export function sliderFillClipAttrs(isHorizontal: boolean): SvelteStyleAttrs {
	return sx(
		styles.fillClip,
		isHorizontal
			? styles.fillClipHorizontal
			: [styles.fillClipVertical, rtlStyles.centerInline('0px')]
	);
}

/** The mover that cuts the fill at a range's start. */
export function sliderFillMoverAttrs(isHorizontal: boolean, isRange: boolean): SvelteStyleAttrs {
	return sx(
		styles.fillMover,
		isRange &&
			(isHorizontal
				? [styles.fillMoverRangeHorizontal, styles.fillMoverRangeStartHorizontal]
				: [styles.fillMoverRangeVertical, styles.fillMoverRangeStartVertical])
	);
}

/** The accent-filled portion of the rail; its extent is an inline style. */
export function sliderFilledTrackAttrs(isHorizontal: boolean, isRange: boolean): SvelteStyleAttrs {
	return sx(
		styles.filledTrack,
		isHorizontal ? styles.filledTrackHorizontal : styles.filledTrackVertical,
		isRange
			? isHorizontal
				? styles.filledTrackRangeHorizontal
				: styles.filledTrackRangeVertical
			: isHorizontal
				? styles.filledTrackSingleHorizontal
				: styles.filledTrackSingleVertical
	);
}

/** The absolutely-positioned box the marks are placed within. */
export function sliderMarksContainerAttrs(isHorizontal: boolean): SvelteStyleAttrs {
	return sx(
		styles.marksContainer,
		isHorizontal ? styles.marksContainerHorizontal : styles.marksContainerVertical
	);
}

/** A single tick; its offset along the rail is an inline style. */
export function sliderMarkAttrs(isHorizontal: boolean, isFilled: boolean): SvelteStyleAttrs {
	return sx(
		styles.mark,
		isHorizontal ? styles.markHorizontal : styles.markVertical,
		isFilled && styles.markFilled
	);
}

/** A tick's caption; its offset along the rail is an inline style. */
export function sliderMarkLabelAttrs(isHorizontal: boolean): SvelteStyleAttrs {
	return sx(styles.markLabel, isHorizontal ? styles.markLabelHorizontal : styles.markLabelVertical);
}

/** The `valueDisplay="text"` readout beside the track. */
export function sliderTextValueAttrs(): SvelteStyleAttrs {
	return sx(styles.textValue);
}

/** A draggable thumb's geometry; its progress is an inline custom property. */
export function sliderThumbAttrs(
	isHorizontal: boolean,
	isDisabled: boolean,
	isDragging: boolean,
	hasTouchTargets: boolean
): SvelteStyleAttrs {
	return sx(
		styles.thumb,
		isHorizontal ? styles.thumbHorizontal : styles.thumbVertical,
		!isDisabled && styles.thumbHover,
		!isDisabled && isDragging && styles.thumbPressed,
		!isDisabled && focusOutlineStyles.focusVisible,
		isDisabled && styles.thumbDisabled,
		hasTouchTargets && styles.thumbHit
	);
}

/** A thumb's value-tooltip anchor: a thumb-sized box layout places at the value. */
export function sliderValueAnchorAttrs(isHorizontal: boolean): SvelteStyleAttrs {
	return sx(
		styles.valueAnchor,
		isHorizontal ? styles.valueAnchorHorizontal : styles.valueAnchorVertical
	);
}
