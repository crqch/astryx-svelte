import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	focusVars,
	radiusVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { overlayPaddingReset } from '../../internal/padding.stylex.js';
import { zoomMedia } from '../../motion/uikit/zoomMedia.js';

/**
 * Ported from Astryx's `Lightbox/Lightbox.tsx` style block at 0.7.16.
 *
 * The viewer is a track of pages, each a photo and its caption band. Every
 * item is a page, a single photo too, so its photo and caption sit as a
 * gallery page's do. The pages share the track's two rows through subgrid, so
 * a photo centres on the same box with or without a caption, and paging never
 * resizes it.
 */

// The caption's backing: the controls' backing colour, darker, so the caption
// keeps 4.5:1 over any photo or backdrop behind it (WCAG 2.2 1.4.3).
const CAPTION_BACKING = `color-mix(in srgb, ${colorVars['--color-on-light']} 90%, transparent)`;

const styles = stylex.create({
	dialog: {
		position: 'fixed',
		inset: 0,
		width: '100vw',
		// The dynamic viewport: the height a mobile browser shows. Its 100vh is
		// the large viewport, measured with the toolbars retracted, so a viewer
		// that tall runs under Safari's bottom toolbar and hides the caption.
		height: stylex.firstThatWorks('100dvh', '100vh'),
		maxWidth: 'none',
		maxHeight: 'none',
		margin: 0,
		padding: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		overflow: 'hidden',
		outline: 'none',
		// The backdrop is the theme's overlay colour over a 2 px blur. A drag to
		// dismiss and its release remove the blur through
		// `--_lightbox-backdrop-filter`. A full-viewport blur repainted every
		// frame of the fade drops frames.
		'::backdrop': {
			backgroundColor: colorVars['--color-overlay'],
			backdropFilter: 'var(--_lightbox-backdrop-filter, blur(2px))'
		}
	},
	container: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%',
		position: 'relative'
	},
	// The stage is the pager's viewport, a single photo's too. It fills the
	// viewer on every presentation, so its pages have a size of their own.
	mediaGroup: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		alignSelf: 'stretch',
		flexGrow: 1,
		minHeight: 0,
		maxWidth: '100%',
		maxHeight: '100%',
		// ZOOM_DISMISSING_ATTRIBUTE on the stage inside: a photo dragged to
		// dismiss draws outside the box that hugs it.
		overflow: { default: 'hidden', ':has([data-zoom-dismissing])': 'visible' }
	},
	// The zoom button's box clips, so its focus ring sits inside its edge.
	zoomButtonFocusInset: {
		outlineOffset: {
			default: '0',
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		}
	},
	imageWrapper: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		alignSelf: 'stretch',
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		position: 'relative',
		// ZOOM_DISMISSING_ATTRIBUTE, on the current page's photo box: a photo
		// dragged to dismiss draws outside the stage.
		overflow: { default: 'hidden', ':has([data-zoom-dismissing])': 'visible' },
		cursor: 'default',
		userSelect: 'none',
		minHeight: 0
	},
	// In the touch presentation, a photo without zoom leaves pinch-zoom to the
	// page but takes one-finger drags. A drag down dismisses it.
	imageWrapperDismissTarget: {
		touchAction: 'pinch-zoom'
	},
	// The photo rows take the stage's own pinch, pan and double tap, for every
	// pointer. A descendant cannot allow what an ancestor's `touch-action`
	// rules out. So the track allows only the page's pinch-zoom, and a pinch on
	// the controls or a caption still zooms the page. The pager's pan manages
	// the stage's own `touch-action`.
	trackZoomTarget: {
		touchAction: 'pinch-zoom'
	},
	// The photo box is the zoom button. It takes the stage's cursor, not the
	// reset's button cursor, so the zoom-in cursor shows only over the photo.
	pageMediaZoomTarget: {
		touchAction: 'none',
		cursor: {
			default: 'inherit',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// Two rows that every page shares through subgrid: the photo's and the
	// caption band's. The band has one height on every page (`captionBand`). So
	// every photo centres on the same box, with or without a caption. The next
	// photo slides in level with the current one, and paging never resizes it.
	track: {
		position: 'absolute',
		inset: 0,
		display: 'grid',
		gridTemplateColumns: '100%',
		gridTemplateRows: 'minmax(0, 1fr) auto'
	},
	// One page per item, the stage's size, at index × (width + gap). The pages
	// stack in the track's one column, offset by their relative inset. Each has
	// its own layer. Through a busy main thread, Mobile Safari moves the track
	// but cannot paint what it had not painted. So a page that slides in must be
	// painted whole before it moves.
	page: {
		position: 'relative',
		gridColumn: '1',
		gridRow: '1 / span 2',
		display: 'grid',
		gridTemplateColumns: '100%',
		gridTemplateRows: 'subgrid',
		minHeight: 0,
		willChange: 'transform'
	},
	// A page's photo box: the zoom stage of the current page, in the photo
	// row. Its caption sits in the caption band below it, so the viewer's size
	// never changes with the item.
	pageMedia: {
		gridRow: '1',
		minHeight: 0,
		minWidth: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		// ZOOM_DISMISSING_ATTRIBUTE: a photo dragged to dismiss draws outside its
		// box, above its caption band and below the controls. The drag fades the
		// band, which makes it a stacking context painted after the box.
		overflow: { default: 'hidden', ':is([data-zoom-dismissing])': 'visible' },
		zIndex: { default: null, ':is([data-zoom-dismissing])': 1 }
	},
	// A gallery's caption band, under every page's photo. It is two caption
	// lines tall whatever the caption, so the photo area stays the same. Its
	// lines are the caption's own type, on the caption's backing. Its padding
	// clears the screen's bottom edge and the safe area there.
	captionBand: {
		gridRow: '2',
		position: 'relative',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'flex-start',
		minWidth: 0,
		boxSizing: 'content-box',
		// The caption Text's type, so `2lh` is two caption lines.
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		blockSize: `calc(${spacingVars['--spacing-2']} + 2lh)`,
		paddingBlockEnd: `calc(${spacingVars['--spacing-3']} + env(safe-area-inset-bottom, 0px))`,
		backgroundColor: CAPTION_BACKING
	},
	// The band under an open caption, which brings its own backing.
	captionBandUnderOpen: {
		backgroundColor: 'transparent'
	},
	// A page with no caption keeps the band's space, so its photo sits where
	// every other page's does. It shows no backing there.
	captionBandBare: {
		backgroundColor: 'transparent'
	},
	captionInBand: {
		display: 'flex',
		minWidth: 0,
		maxWidth: '100%'
	},
	// The caption's Text and its toggle. The toggle is out of the flow, so the
	// Text takes the whole width.
	captionBody: {
		position: 'relative',
		display: 'flex',
		alignItems: 'flex-start',
		minWidth: 0,
		maxWidth: '100%'
	},
	// Lets the clamped Text shrink inside the band.
	captionClamped: {
		flexShrink: 1,
		minWidth: 0
	},
	// The caption's lines in one block, so the clamp counts them and the floats
	// in it wrap them. Every state renders it, with or without a toggle.
	captionFlow: {
		display: 'block'
	},
	// Physical floats: StyleX keys `inline-end` on the page's direction. So a
	// right-to-left caption flips them, as the toggle follows its own.
	// The toggle's place at the end of the caption's last line. The text wraps
	// around it, so the clamp's ellipsis comes just before the toggle. Without
	// a toggle it has no box, so it moves no line.
	captionTogglePlace: {
		float: {
			default: 'right',
			':is([dir="rtl"] *)': 'left'
		},
		display: 'none',
		overflow: 'hidden',
		whiteSpace: 'pre',
		userSelect: 'none',
		// The clamp draws an ellipsis on its last line. The place shows nothing.
		visibility: 'hidden',
		// The lines are generated, so the caption's text and its ranges hold
		// none of them. Each line is a no-break space, and the place shows as
		// many as the caption does. An open caption scrolls once it passes 60 %
		// of the viewport, and then the place is not shown. 240 lines cover that
		// at a 10px line in a window 4,000px tall.
		'::before': {
			content: `"${'\\A0\\A'.repeat(239)}\\A0"`
		}
	},
	// The place shows one line box for each line the caption shows. Layout
	// rounds line boxes to its own grid, and each engine rounds them its own
	// way. So the place ends exactly where the caption's last line ends. Only
	// its last line keeps the text away.
	captionTogglePlaceShown: (width: number, lines: number) => ({
		display: '-webkit-box',
		WebkitBoxOrient: 'vertical',
		WebkitLineClamp: lines,
		inlineSize: width,
		marginInlineStart: spacingVars['--spacing-1'],
		shapeOutside: 'inset(calc(100% - 1lh + 0.5px) 0 0 0)'
	}),
	// The caption's link over its place: the caption's last line, inside the
	// Text's inline padding. It takes the caption's font and line height, so
	// it sits on that line as its text does.
	// SYNC: `caption`'s paddingInline.
	captionToggle: {
		position: 'absolute',
		insetInlineEnd: spacingVars['--spacing-3'],
		insetBlockEnd: 0
	},
	// The toggle's own display wins over `hidden`'s, so this hides it.
	captionToggleHidden: {
		display: 'none'
	},
	// An open caption that scrolls keeps its toggle's width clear at every
	// line's end. The toggle stays in view as the lines move.
	captionTextBesideToggle: (width: number) => ({
		paddingInlineEnd: `calc(${spacingVars['--spacing-3']} + ${width}px + ${spacingVars['--spacing-1']})`
	}),
	// The open caption: the same element, out of the band and over the
	// photo's bottom, on the controls' scrim. Its last line and the toggle stay
	// where they were, and it grows upward.
	captionOpen: {
		position: 'absolute',
		insetInline: 0,
		insetBlockEnd: 0,
		justifyContent: 'center',
		maxWidth: 'none',
		paddingBlockEnd: `calc(${spacingVars['--spacing-3']} + env(safe-area-inset-bottom, 0px))`,
		backgroundColor: CAPTION_BACKING
	},
	// The open caption's text, up to 60 % of the viewport tall. A finger
	// scrolls a longer one, and the toggle stays in view beside it. A pinch on
	// it still zooms the page.
	captionTextOpen: {
		maxBlockSize: `calc(60dvh - ${spacingVars['--spacing-3']} - env(safe-area-inset-bottom, 0px))`,
		overflowY: 'auto',
		touchAction: 'pan-y pinch-zoom'
	},
	// A fitted photo's zoom-in cursor shows only over the photo, where the
	// stage sets OVER_PHOTO_ATTRIBUTE. Beside it, a click closes the viewer.
	imageWrapperZoomable: {
		cursor: {
			default: 'default',
			':is([data-lightbox-over-photo])': 'zoom-in',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	imageWrapperZoomed: {
		cursor: {
			default: 'grab',
			// ZOOM_DRAGGING_ATTRIBUTE, set by the stage while a drag moves the photo.
			':is([data-zoom-dragging])': 'grabbing',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	image: {
		maxWidth: '100%',
		maxHeight: '100%',
		objectFit: 'contain',
		pointerEvents: 'none',
		// The zoom stage scales the photo about its top-left corner and moves it
		// with the individual `scale` and `translate` properties.
		transformOrigin: '0 0'
	},
	video: {
		maxWidth: '100%',
		maxHeight: '100%',
		objectFit: 'contain',
		outline: 'none'
	},
	// The caption's box. Its type and color are the caption Text's, and both
	// of its lines start at one edge.
	caption: {
		paddingBlockStart: spacingVars['--spacing-2'],
		paddingBlockEnd: 0,
		paddingInline: spacingVars['--spacing-3'],
		maxWidth: '600px',
		flexShrink: 0
	},
	// The caption Text's type, applied by hand because this port measures the
	// element directly (upstream's `<Text type="body">` supplies it).
	captionText: {
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		color: colorVars['--color-text-primary'],
		overflowWrap: 'break-word',
		whiteSpace: 'normal'
	},
	closeButton: {
		position: 'absolute',
		top: spacingVars['--spacing-3'],
		insetInlineEnd: spacingVars['--spacing-3'],
		zIndex: 1
	},
	navButton: {
		position: 'absolute',
		top: '50%',
		// The individual `translate` property, not `transform`. This style lands
		// on the Button root, or on its backing with zoom. A `transform` on the
		// Button root would replace its own transform rules: measured, the
		// `scale(0.98)` press feedback stops firing. `translate` composes with them.
		translate: '0 -50%',
		zIndex: 1
	},
	navPrev: {
		insetInlineStart: spacingVars['--spacing-3']
	},
	navNext: {
		insetInlineEnd: spacingVars['--spacing-3']
	},
	// The counter takes its own clicks in the click-through layer, so a click
	// on it leaves the viewer open.
	counter: {
		position: 'absolute',
		top: spacingVars['--spacing-3'],
		insetInlineStart: spacingVars['--spacing-3'],
		zIndex: 1,
		pointerEvents: 'auto'
	},
	controlButton: {
		pointerEvents: 'auto'
	},
	// The controls sit in layers over the viewer that pass clicks through. A
	// drag to dismiss fades the layers, which carry no transition of their own,
	// since a Button's opacity transition would trail the finger.
	// They sit above the stage, even a photo dragged to dismiss. While a fade
	// writes their opacity, each is a stacking context. The track's positioned
	// pages, later in tree order, would otherwise cover them and take the taps
	// meant for the controls.
	chromeLayer: {
		position: 'absolute',
		inset: 0,
		zIndex: 2,
		pointerEvents: 'none'
	},
	// With zoom a photo can lie under the controls. Lightbox's own translucent
	// backing keeps them readable over any photo: 3:1 for the buttons, 4.5:1
	// for the counter's text. A theme restyles the buttons, not the backing.
	controlBacking: {
		display: 'inline-flex',
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-on-light']} 75%, transparent)`,
		borderRadius: radiusVars['--radius-full']
	},
	counterBacking: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-on-light']} 75%, transparent)`,
		borderRadius: radiusVars['--radius-full'],
		paddingInline: spacingVars['--spacing-2']
	},
	// With zoom, the icons and the Counter's text keep the on-dark colour on
	// the backing, whatever a theme does to the buttons or to Text.
	controlIcon: {
		color: colorVars['--color-on-dark']
	},
	counterOnDark: {
		color: colorVars['--color-on-dark']
	},
	// The counter's type. Upstream renders it with `<Text type="body">`; this
	// port keeps the counter on a plain element and applies the same type.
	counterText: {
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		color: colorVars['--color-text-primary']
	}
});

const pageStyles = stylex.create({
	position: (index: number) => ({
		insetInlineStart: `calc(${index} * (100% + ${zoomMedia.viewer.pageGap}px))`
	})
});

export function lightboxDialogAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	// The overlay root is not inside any padded container, so the inherited
	// container padding vars are reset at its boundary.
	return sx(styles.dialog, overlayPaddingReset.reset, xstyle);
}

export function lightboxContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.container);
}

/** The stage: a track of pages, each a photo and its caption band. */
export function lightboxMediaGroupAttrs(): SvelteStyleAttrs {
	return sx(styles.mediaGroup);
}

/**
 * The image wrapper fills the stage. The zoom cursors are conditional; the
 * focus ring sits on the page's photo box, not here.
 */
export function lightboxImageWrapperAttrs(
	isZoomable: boolean,
	isZoomed: boolean
): SvelteStyleAttrs {
	return sx(
		styles.imageWrapper,
		isZoomable && styles.imageWrapperZoomable,
		isZoomed && styles.imageWrapperZoomed
	);
}

/** The track: allows the page's pinch-zoom, or the touch presentation's drag. */
export function lightboxTrackAttrs(
	isZoomTarget: boolean,
	isDismissTarget: boolean
): SvelteStyleAttrs {
	return sx(
		styles.track,
		isZoomTarget && styles.trackZoomTarget,
		isDismissTarget && styles.imageWrapperDismissTarget
	);
}

/** One gallery page, placed at index × (width + gap) in the track. */
export function lightboxPageAttrs(index: number): SvelteStyleAttrs {
	return sx(styles.page, pageStyles.position(index));
}

/** A page's photo box: the zoom stage of the current page. */
export function lightboxPageMediaAttrs(isZoomTarget: boolean): SvelteStyleAttrs {
	return sx(styles.pageMedia, isZoomTarget && styles.pageMediaZoomTarget);
}

/** The zoom button's focus ring, inset so the page's clip keeps it whole. */
export function lightboxZoomButtonFocusAttrs(isZoomTarget: boolean): SvelteStyleAttrs {
	return sx(
		isZoomTarget && focusOutlineStyles.focusVisible,
		isZoomTarget && styles.zoomButtonFocusInset
	);
}

/** A page's caption band: its backing, or bare when the page has no caption. */
export function lightboxCaptionBandAttrs(
	hasCaption: boolean,
	isCaptionOpen: boolean
): SvelteStyleAttrs {
	return sx(
		styles.captionBand,
		!hasCaption && styles.captionBandBare,
		isCaptionOpen && styles.captionBandUnderOpen
	);
}

/** The caption's own box, in the band or open over the photo. */
export function lightboxCaptionInBandAttrs(isCaptionOpen: boolean): SvelteStyleAttrs {
	return sx(styles.captionInBand, isCaptionOpen && styles.captionOpen);
}

export function lightboxCaptionBodyAttrs(): SvelteStyleAttrs {
	return sx(styles.captionBody);
}

/** The caption Text: clamped, or open and scrollable. */
export function lightboxCaptionTextAttrs(
	isCaptionOpen: boolean,
	isBesideToggle: boolean,
	toggleWidth: number
): SvelteStyleAttrs {
	return sx(
		styles.caption,
		styles.captionText,
		styles.captionClamped,
		// The clamp lives on the text itself. Only the clamped state uses it: an
		// open caption shows every line.
		!isCaptionOpen && dynamicStyles.captionClamp(2),
		isCaptionOpen && styles.captionTextOpen,
		isCaptionOpen && isBesideToggle && styles.captionTextBesideToggle(toggleWidth)
	);
}

export function lightboxCaptionFlowAttrs(): SvelteStyleAttrs {
	return sx(styles.captionFlow);
}

/** The toggle's place in the caption's last line, or no box when hidden. */
export function lightboxCaptionTogglePlaceAttrs(
	isShown: boolean,
	width: number,
	lines: number
): SvelteStyleAttrs {
	return sx(
		styles.captionTogglePlace,
		isShown && width > 0 && lines > 0 && styles.captionTogglePlaceShown(width, lines)
	);
}

export function lightboxCaptionToggleAttrs(isHidden: boolean): SvelteStyleAttrs {
	return sx(styles.captionToggle, isHidden && styles.captionToggleHidden);
}

export function lightboxVideoAttrs(): SvelteStyleAttrs {
	return sx(styles.video);
}

export function lightboxImageAttrs(transform: string | null): SvelteStyleAttrs {
	return sx(styles.image, transform != null && dynamicStyles.imageTransform(transform));
}

export function lightboxCounterAttrs(hasZoom: boolean): SvelteStyleAttrs {
	return sx(
		styles.counter,
		hasZoom && styles.counterBacking,
		styles.counterText,
		hasZoom && styles.counterOnDark
	);
}

/** The click-through layer the controls sit in. */
export function lightboxChromeLayerAttrs(): SvelteStyleAttrs {
	return sx(styles.chromeLayer);
}

/** Close control's backing: its place and the backing, on the wrapper span. */
export function lightboxCloseBackingAttrs(): SvelteStyleAttrs {
	return sx(styles.closeButton, styles.controlBacking);
}

/** Previous control's backing: nav's place, its side, and the backing. */
export function lightboxNavPrevBackingAttrs(): SvelteStyleAttrs {
	return sx(styles.navButton, styles.navPrev, styles.controlBacking);
}

/** Next control's backing: nav's place, its side, and the backing. */
export function lightboxNavNextBackingAttrs(): SvelteStyleAttrs {
	return sx(styles.navButton, styles.navNext, styles.controlBacking);
}

const dynamicStyles = stylex.create({
	imageTransform: (transform: string) => ({
		transform
	}),
	// Upstream's `<Text maxLines={2}>` owns this clamp. The caption is a plain
	// element here, so the clamp is its own style.
	captionClamp: (lines: number) => ({
		display: '-webkit-box',
		WebkitBoxOrient: 'vertical',
		WebkitLineClamp: lines,
		overflow: 'hidden'
	})
});

/**
 * Handed to `IconButton`'s `xstyle`, as upstream hands over the same styles.
 */
export const lightboxControlButtonStyle = styles.controlButton;
export const lightboxControlIconStyle = styles.controlIcon;
export const lightboxCloseButtonStyle = styles.closeButton;
export const lightboxNavButtonStyle = styles.navButton;
export const lightboxNavPrevStyle = styles.navPrev;
export const lightboxNavNextStyle = styles.navNext;
export const lightboxCounterOnDarkStyle = styles.counterOnDark;
