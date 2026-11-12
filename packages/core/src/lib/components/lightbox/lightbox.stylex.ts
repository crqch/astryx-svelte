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
	mediaGroup: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		maxWidth: '100%',
		maxHeight: '100%',
		// ZOOM_DISMISSING_ATTRIBUTE on the stage inside: a photo dragged to
		// dismiss draws outside the box that hugs it.
		overflow: { default: 'hidden', ':has([data-zoom-dismissing])': 'visible' }
	},
	// A zoomable photo's stage fills the viewer for every pointer, as a photo
	// viewer's zooming scroll view does. Only a zoom target does this: around
	// any other item, a tap on the dark area still closes the viewer.
	mediaGroupZoom: {
		alignSelf: 'stretch',
		flexGrow: 1,
		minHeight: 0
	},
	// A gallery's stage is the pager's viewport: it fills the viewer on every
	// presentation, so its pages have a size of their own.
	mediaGroupGallery: {
		alignSelf: 'stretch',
		flexGrow: 1,
		minHeight: 0
	},
	imageWrapperFill: {
		alignSelf: 'stretch',
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0
	},
	// The filling stage's group clips, so its focus ring sits inside its edge.
	imageWrapperFocusInset: {
		outlineOffset: {
			default: '0',
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		}
	},
	imageWrapper: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		// ZOOM_DISMISSING_ATTRIBUTE, on this stage or a gallery page's: a photo
		// dragged to dismiss draws outside it, above its caption and below the
		// controls.
		overflow: {
			default: 'hidden',
			':is([data-zoom-dismissing])': 'visible',
			':has([data-zoom-dismissing])': 'visible'
		},
		zIndex: { default: null, ':is([data-zoom-dismissing])': 1 },
		cursor: 'default',
		userSelect: 'none',
		minHeight: 0
	},
	// The stage's own pinch, pan and double tap take every touch on it, whatever
	// the primary pointer. It fills the viewer (mediaGroupZoom, imageWrapperFill).
	imageWrapperZoomTarget: {
		touchAction: 'none'
	},
	// In a gallery the photo rows take the stage's touches, for every pointer
	// (as imageWrapperZoomTarget). A descendant cannot allow what an ancestor's
	// `touch-action` rules out. So the track allows only the page's pinch-zoom,
	// and a pinch on a caption still zooms the page. The pager's pan manages the
	// stage's own `touch-action`.
	trackZoomTarget: {
		touchAction: 'pinch-zoom'
	},
	// A zoomable page's photo box fills the page above its caption, as a
	// single item's stage does.
	pageMediaZoomTarget: {
		touchAction: 'none',
		alignSelf: 'stretch',
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0
	},
	// In the touch presentation, a photo without zoom leaves pinch-zoom to the
	// page but takes one-finger drags. A drag down dismisses it.
	imageWrapperDismissTarget: {
		touchAction: 'pinch-zoom'
	},
	imageWrapperGallery: {
		alignSelf: 'stretch',
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		position: 'relative'
	},
	// The pages stack in the track's one cell, each offset by its relative
	// inset.
	track: {
		position: 'absolute',
		inset: 0,
		display: 'grid',
		gridTemplateColumns: '100%',
		gridTemplateRows: '100%'
	},
	// One page per item, the stage's size, at index × (width + gap). A page
	// lays out its photo and caption as a single item does: the caption right
	// under the photo, and the pair centred. Each page has its own layer.
	// Through a busy main thread, Mobile Safari moves the track but cannot
	// paint what it had not painted. So a page that slides in must be painted
	// whole before it moves.
	page: {
		position: 'relative',
		gridArea: '1 / 1',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 0,
		minWidth: 0,
		willChange: 'transform'
	},
	// A page's photo box: the zoom stage of the current page.
	pageMedia: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		// As the single item's stage, while a photo is dragged to dismiss.
		overflow: { default: 'hidden', ':is([data-zoom-dismissing])': 'visible' },
		zIndex: { default: null, ':is([data-zoom-dismissing])': 1 },
		minHeight: 0,
		minWidth: 0,
		maxWidth: '100%'
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
	caption: {
		color: colorVars['--color-on-dark'],
		fontSize: typeScaleVars['--text-large-size'],
		lineHeight: typeScaleVars['--text-large-leading'],
		textAlign: 'center',
		paddingBlockStart: spacingVars['--spacing-2'],
		paddingBlockEnd: 0,
		paddingInline: spacingVars['--spacing-3'],
		maxWidth: '600px',
		flexShrink: 0
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
		// The individual `translate` property, not `transform`: this style now
		// lands on the Button root, and a `transform` here replaces the Button's
		// own transform rules — measured: the `scale(0.98)` press feedback stops
		// firing. `translate` composes with them, reproducing exactly what the
		// removed wrapper element did (wrapper translated, button scaled).
		translate: '0 -50%',
		zIndex: 1
	},
	navPrev: {
		insetInlineStart: spacingVars['--spacing-3']
	},
	navNext: {
		insetInlineEnd: spacingVars['--spacing-3']
	},
	counter: {
		position: 'absolute',
		top: spacingVars['--spacing-3'],
		insetInlineStart: spacingVars['--spacing-3'],
		color: colorVars['--color-on-dark'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		zIndex: 1,
		// The counter takes its own clicks in the click-through layer, so a click
		// on it leaves the viewer open.
		pointerEvents: 'auto'
	},
	controlButton: {
		color: colorVars['--color-on-dark'],
		pointerEvents: 'auto'
	},
	// The controls sit in layers over the viewer that pass clicks through. A
	// drag to dismiss fades the layers, which carry no transition of their own,
	// since a Button's opacity transition would trail the finger. They sit above
	// the stage, even a photo dragged to dismiss.
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
	controlIcon: {
		color: colorVars['--color-on-dark']
	},
	counterBacking: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-on-light']} 75%, transparent)`,
		borderRadius: radiusVars['--radius-full'],
		paddingInline: spacingVars['--spacing-2']
	}
});

const dynamicStyles = stylex.create({
	imageTransform: (transform: string) => ({
		transform
	}),
	// One page per item, the stage's size, at index × (width + gap).
	pagePosition: (index: number) => ({
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

export function lightboxMediaGroupAttrs(
	isZoomTarget: boolean,
	isGallery: boolean
): SvelteStyleAttrs {
	return sx(
		styles.mediaGroup,
		isZoomTarget && !isGallery && styles.mediaGroupZoom,
		isGallery && styles.mediaGroupGallery
	);
}

/**
 * Declaration order matters and is upstream's: the gallery/fill keys set the
 * stage's box, then the focus ring, then the two cursor styles. `zoomed` beats
 * `zoomable`. The compiled lookup table in the published `dist/` encodes that
 * precedence, so reordering these would change the merge.
 *
 * The shared focus ring sits after the fill keys, as upstream applies it — it is
 * the wrapper's `role="button"` focus affordance. Through 0.3.0 this was a local
 * `zoomTarget` key holding a hand-written ring; upstream 0.4.1 replaced the key
 * outright with `focusOutlineStyles.focusVisible`.
 *
 * A drag's cursor comes from `data-zoom-dragging`, which the element carries
 * while a pan moves the photo; `imageWrapperZoomed` owns that selector.
 */
export function lightboxImageWrapperAttrs(
	isZoomTarget: boolean,
	isZoomable: boolean,
	isZoomed: boolean,
	isGallery: boolean
): SvelteStyleAttrs {
	return sx(
		styles.imageWrapper,
		isGallery && styles.imageWrapperGallery,
		isZoomTarget && styles.imageWrapperZoomTarget,
		isZoomTarget && styles.imageWrapperFill,
		isZoomTarget && focusOutlineStyles.focusVisible,
		isZoomTarget && styles.imageWrapperFocusInset,
		isZoomable && styles.imageWrapperZoomable,
		isZoomed && styles.imageWrapperZoomed
	);
}

export function lightboxImageAttrs(transform: string | null): SvelteStyleAttrs {
	return sx(styles.image, transform != null && dynamicStyles.imageTransform(transform));
}

/**
 * The gallery's track: the stage the pages stack in. It allows the page's own
 * pinch-zoom unless the stage is a zoom target, and the touch presentation's
 * one-finger drag otherwise — the same `touch-action` either way, and the
 * pager's pan manages the stage's own.
 */
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
	return sx(styles.page, dynamicStyles.pagePosition(index));
}

/** A page's photo box: the zoom stage of the current page. */
export function lightboxPageMediaAttrs(isZoomTarget: boolean): SvelteStyleAttrs {
	return sx(styles.pageMedia, isZoomTarget && styles.pageMediaZoomTarget);
}

export function lightboxVideoAttrs(): SvelteStyleAttrs {
	return sx(styles.video);
}

export function lightboxCaptionAttrs(): SvelteStyleAttrs {
	return sx(styles.caption);
}

export function lightboxCounterAttrs(hasZoom: boolean): SvelteStyleAttrs {
	return sx(styles.counter, hasZoom && styles.counterBacking);
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

/**
 * Handed to `IconButton`'s `xstyle`, as upstream hands over the same styles.
 *
 * These were `…Attrs()` builders on wrapper `<div>`s until #4775, which deleted
 * the wrappers and put the positioning on the Button root itself. That is why
 * `navButton` had to move from `transform` to `translate` — see the note at the
 * declaration.
 */
export const lightboxControlButtonStyle = styles.controlButton;
export const lightboxControlIconStyle = styles.controlIcon;
export const lightboxCloseButtonStyle = styles.closeButton;
export const lightboxNavButtonStyle = styles.navButton;
export const lightboxNavPrevStyle = styles.navPrev;
export const lightboxNavNextStyle = styles.navNext;
