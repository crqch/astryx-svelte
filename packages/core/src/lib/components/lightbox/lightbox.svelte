<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';

	/** The kind of media a `LightboxMedia` entry points at. */
	export type LightboxMediaType = 'image' | 'video';

	export interface LightboxMedia {
		/** Media source URL. */
		src: string;
		/** Alternative text. Also the dialog's accessible name when non-empty. */
		alt: string;
		/**
		 * Caption rendered under the media.
		 *
		 * Upstream types this `ReactNode`; a toast-style leaf slot here, so a bare
		 * string works and a `Snippet` covers rich content.
		 */
		caption?: string | Snippet;
		/** @default 'image' */
		type?: LightboxMediaType;
	}

	export interface LightboxProps extends BaseProps<HTMLDialogElement> {
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		media: LightboxMedia | LightboxMedia[];
		/** Controlled index. Leave undefined for uncontrolled. */
		index?: number;
		/** @default 0 */
		defaultIndex?: number;
		onIndexChange?: (index: number) => void;
		/**
		 * Enable zoom (images only). A pinch or a ctrl-wheel zooms about the
		 * fingers or the pointer. A double tap fills the viewer and a double-click
		 * zooms 2×, about that point, and the next goes back. Enter, Space, `+` and
		 * `-` zoom 2× about the centre and back, and `0` returns to the fitted
		 * size. When zoomed, drag or scroll a trackpad to pan, or use the arrow
		 * keys. On a phone or a tablet, the pan has momentum. The gestures work
		 * for every pointer.
		 * @default false
		 */
		hasZoom?: boolean;
		/** Sets `autoplay` on a video item. @default false */
		hasAutoPlay?: boolean;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import Icon from '../icon/icon.svelte';
	import IconButton from '../icon-button/icon-button.svelte';
	import Link from '../link/link.svelte';
	import MediaTheme from '../../theme/media-theme.svelte';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { announceInModal } from '../../hooks/use-announce.js';
	import ModalAnnounceProvider from '../../hooks/modal-announce-provider.svelte';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { usePager } from '../../hooks/use-pager.svelte.js';
	import { useScrollLock } from '../../hooks/use-scroll-lock.svelte.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import { zoomMedia } from '../../motion/uikit/zoomMedia.js';
	import { animatorFor, type Animator } from '../../motion/animator.js';
	import { resolveMotion } from '../../motion/resolve-motion.js';
	import { springs } from '../../motion/uikit/springs.js';
	import type { GestureTouch } from '../../gestures/types.js';
	import LayerDepthProvider from '../layer/layer-depth-provider.svelte';
	import { useLayerDismissal } from '../layer/use-layer-dismissal.svelte.js';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { rtlMirrorAttrs } from '../../utils/rtl.stylex.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { observeResize } from '../../internal/shared-resize-observer.js';
	import { trackInteractionModality } from '../../utils/interaction-modality.js';
	import {
		focusForLastInput,
		noteFocusWithin,
		moveFocusLeftBehind,
		prepareFocusReturnOnRemoval,
		returnFocusForLastInput,
		type FocusWithin
	} from '../../utils/focus-return.js';
	import { isRtlElement } from '../../hooks/is-rtl-element.js';
	import { useTruncation } from '../../internal/truncation.svelte.js';
	import { useTouchHitArea } from '../../utils/touch-hit-area.svelte.js';
	import { touchHitAreaStyles } from '../../internal/touch-hit-area.stylex.js';
	import { useZoomCore, type ZoomStage } from './use-zoom-core.svelte.js';
	import { useZoomStage, ZOOM_DISMISSING_ATTRIBUTE } from './use-zoom-stage.svelte.js';
	import { dismissBackdropAlpha, dismissChromeAlpha } from './zoom-stage.js';
	import {
		lightboxDialogAttrs,
		lightboxContainerAttrs,
		lightboxMediaGroupAttrs,
		lightboxImageWrapperAttrs,
		lightboxImageAttrs,
		lightboxTrackAttrs,
		lightboxPageAttrs,
		lightboxPageMediaAttrs,
		lightboxZoomButtonFocusAttrs,
		lightboxCaptionBandAttrs,
		lightboxCaptionInBandAttrs,
		lightboxCaptionBodyAttrs,
		lightboxCaptionTextAttrs,
		lightboxCaptionFlowAttrs,
		lightboxCaptionTogglePlaceAttrs,
		lightboxCaptionToggleAttrs,
		lightboxVideoAttrs,
		lightboxCounterAttrs,
		lightboxChromeLayerAttrs,
		lightboxCloseBackingAttrs,
		lightboxNavPrevBackingAttrs,
		lightboxNavNextBackingAttrs,
		lightboxControlButtonStyle,
		lightboxControlIconStyle,
		lightboxCloseButtonStyle,
		lightboxNavButtonStyle,
		lightboxNavPrevStyle,
		lightboxNavNextStyle
	} from './lightbox.stylex.js';

	/**
	 * Pan distance (px) per arrow-key press while zoomed. Offsets move the
	 * viewport in the arrow's direction — pressing ArrowRight reveals content to
	 * the right, so the image itself shifts left (negative x), matching how
	 * scrolling and pointer-drag panning feel.
	 */
	const KEYBOARD_PAN_STEP = 50;
	const KEYBOARD_PAN_OFFSETS: Record<string, [number, number]> = {
		ArrowLeft: [KEYBOARD_PAN_STEP, 0],
		ArrowRight: [-KEYBOARD_PAN_STEP, 0],
		ArrowUp: [0, KEYBOARD_PAN_STEP],
		ArrowDown: [0, -KEYBOARD_PAN_STEP]
	};

	/** The height of a video's native controls, px: no browser reports it. */
	const VIDEO_CONTROLS_BAND = 48;

	/**
	 * A fullscreen overlay for viewing images and videos at full resolution.
	 *
	 * Every item is a page of a track, a single photo too, so its photo and
	 * caption sit as a gallery page's do. The caption is a two-line band under
	 * the photo, over the viewer's full width, with a More/Less toggle when two
	 * lines cut it short.
	 *
	 * Optionally supports zoom like a photo viewer. A pinch or a ctrl-wheel zooms
	 * about the fingers or the pointer, gives past the limits and springs back. A
	 * double tap or a double-click zooms in at that point and back. Enter or
	 * Space on the image, and `+`, `-` or `0` from the keyboard, zoom too. When
	 * zoomed, a drag or a trackpad's scroll pans. On a phone or a tablet, the
	 * pan has momentum and a drag down dismisses the viewer.
	 *
	 * Uses the native `<dialog>` element with `showModal()` for focus
	 * containment and top-layer promotion. Dismiss via Escape, close button, a
	 * backdrop click, or a drag down on touch.
	 *
	 * @example
	 * ```svelte
	 * <Lightbox
	 *   isOpen={isOpen}
	 *   onOpenChange={(open) => (isOpen = open)}
	 *   media={photos}
	 *   index={currentIndex}
	 *   onIndexChange={(i) => (currentIndex = i)}
	 * />
	 * ```
	 */
	const {
		isOpen,
		onOpenChange,
		media,
		index: controlledIndex,
		defaultIndex = 0,
		onIndexChange,
		hasZoom = false,
		hasAutoPlay = false,
		xstyle,
		class: className,
		style: styleProp,
		onclick: onclickProp,
		onkeydown: onkeydownProp,
		oncancel: oncancelProp,
		...rest
	}: LightboxProps = $props();

	const t = useTranslator();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);
	let mediaGroupEl = $state<HTMLDivElement | null>(null);
	let imageWrapperEl = $state<HTMLDivElement | null>(null);
	let trackEl = $state<HTMLDivElement | null>(null);
	// The current page's elements. State, not plain lets: an attachment writes
	// them, and the effects that measure the caption and the toggle read them.
	let pageMediaEl = $state<HTMLElement | null>(null);
	let triggerElement: Element | null = null;

	// The caption's elements and measurements, for the current page.
	let bandCaptionEl = $state<HTMLElement | null>(null);
	let bandCaptionFlowEl = $state<HTMLElement | null>(null);
	let captionToggleEl = $state<HTMLElement | null>(null);
	let captionBandEl = $state<HTMLElement | null>(null);

	// Index state (controlled + uncontrolled).
	const isControlled = $derived(controlledIndex !== undefined);
	// svelte-ignore state_referenced_locally
	let uncontrolledIndex = $state(defaultIndex);
	const requestedIndex = $derived(isControlled ? (controlledIndex as number) : uncontrolledIndex);

	function setIndex(value: number): void {
		if (!isControlled) {
			uncontrolledIndex = value;
		}
		onIndexChange?.(value);
	}

	const mediaArray = $derived(Array.isArray(media) ? media : [media]);
	// Every item is a page of the track, a single photo too, so its photo and
	// caption sit as a gallery page's do. Only paging needs more than one item.
	const isGallery = $derived(mediaArray.length > 1);
	// The item shown is current in every respect: its page, the counter, the
	// pager and the announcement. A NaN shows the first item; a fraction rounds.
	const wholeIndex = $derived(Number.isNaN(requestedIndex) ? 0 : Math.round(requestedIndex));
	const index = $derived(
		mediaArray.length > 0 ? Math.max(0, Math.min(wholeIndex, mediaArray.length - 1)) : 0
	);
	const currentItem = $derived(mediaArray.length > 0 ? mediaArray[index] : null);
	const currentType = $derived(currentItem?.type ?? 'image');
	const isVideo = $derived(currentType === 'video');
	const canPrev = $derived(isGallery && index > 0);
	const canNext = $derived(isGallery && index < mediaArray.length - 1);
	// The current item and its neighbours; the pager shows one at rest.
	const pageIndexes = $derived(
		[index - 1, index, index + 1].filter((i) => i >= 0 && i < mediaArray.length)
	);

	const isTouch = useMediaQuery(() => TOUCH_QUERY);

	useScrollLock(() => isOpen);

	// The last input in the viewer's own document decides whether focus the
	// viewer moves shows a ring.
	$effect(() => {
		trackInteractionModality();
	});

	// Zoom state. The zoom and pan themselves live in the stage, outside Svelte;
	// only the discrete zoomed state renders.
	let isZoomed = $state(false);
	const isZoomTarget = $derived(hasZoom && !isVideo);
	const currentSrc = $derived(currentItem?.src);
	const itemKey = $derived(`${index}:${currentSrc ?? ''}`);

	// The caption's open state. Paging closes it.
	let openCaptionIndex = $state<number | null>(null);
	const isCaptionOpen = $derived(openCaptionIndex === index);
	let captionShownLines = $state(0);
	let captionToggleWidth = $state(0);
	let isCaptionScrolling = $state(false);

	// A new media item starts unzoomed and with its caption closed, before it
	// paints.
	$effect.pre(() => {
		void itemKey;
		isZoomed = false;
		openCaptionIndex = null;
		captionShownLines = 0;
		captionToggleWidth = 0;
		isCaptionScrolling = false;
	});

	/**
	 * While the modal viewer is open, a screen reader reads only messages inside
	 * it, so the position and zoom messages go through the viewer's own region.
	 */
	function announce(message: string): void {
		if (dialogEl != null) {
			announceInModal(dialogEl, message);
		}
	}

	/**
	 * Announce gallery navigation to screen readers. Moving between images only
	 * updates the visual counter, which is silent to assistive tech, so mirror
	 * each change in a polite live region. Announce only when the image changes
	 * during an already-open session — not on mount, not when opening, and not
	 * on close.
	 */
	// svelte-ignore state_referenced_locally
	let prevIndex = index;
	// svelte-ignore state_referenced_locally
	let wasOpenTracker = isOpen;
	$effect(() => {
		const currentIndex = index;
		const open = isOpen;
		const list = mediaArray;
		const indexChanged = prevIndex !== currentIndex;
		const wasOpen = wasOpenTracker;
		prevIndex = currentIndex;
		wasOpenTracker = open;
		if (!indexChanged || !open || !wasOpen) {
			return;
		}
		const item = list[Math.min(currentIndex, list.length - 1)];
		const position = { index: currentIndex + 1, total: list.length };
		announce(
			item?.alt
				? t('@astryx.lightbox.mediaPosition', { alt: item.alt, ...position })
				: t('@astryx.lightbox.imagePosition', position)
		);
	});

	/**
	 * Open/close the dialog. Upstream uses a layout effect; a plain `$effect` is
	 * its counterpart here, since effects never run on the server.
	 */
	let wasShown = false;
	$effect(() => {
		const dialog = dialogEl;
		if (!dialog) {
			return;
		}
		if (isOpen && !dialog.open) {
			if (!wasShown) {
				triggerElement = document.activeElement;
			}
			wasShown = true;
			dialog.showModal();
			// The browser focuses the viewer's first control as it opens. Its ring
			// follows the last input, so a tap or a click shows none.
			const focused = dialog.ownerDocument.activeElement;
			if (focused instanceof HTMLElement && dialog.contains(focused)) {
				focusForLastInput(focused);
			}
		} else if (!isOpen && dialog.open) {
			wasShown = false;
			dialog.close();
			if (triggerElement instanceof HTMLElement) {
				returnFocusForLastInput(triggerElement);
			}
		}
	});

	// A viewer that unmounts while open (rendered only while open, or removed
	// with the rest of a view) never runs the close branch above. Focus the
	// removal lost goes back to the opener while the opener is still on the
	// page.
	$effect(() => {
		const dialog = dialogEl;
		if (dialog == null) {
			return;
		}
		const returnFocusOnRemoval = prepareFocusReturnOnRemoval(dialog);
		return () => {
			if (dialog.open) {
				returnFocusOnRemoval(triggerElement);
			}
		};
	});

	function handleClose(): void {
		onOpenChange(false);
	}

	/**
	 * Join the shared layer dismissal stack, which owns the single Escape
	 * listener and routes each press to the top-most layer — so a lightbox opened
	 * from inside a dialog closes only itself.
	 */
	const { shouldDismissOnCloseRequest } = useLayerDismissal(() => ({
		isActive: isOpen,
		onDismiss: handleClose,
		// The dialog's document is this layer's: rendered into an iframe or a
		// Picture-in-Picture window, it ranks with the layers opened inside it.
		getContainer: () => dialogEl
	}));

	/**
	 * The native `cancel` event is the browser's own close-watcher firing: an
	 * Android back gesture, or a close request the stack never saw a press for.
	 * Always `preventDefault` so the browser cannot close a controlled `<dialog>`
	 * behind our back, then answer with the stack's own rules.
	 */
	function handleCancel(e: Event): void {
		// A cancel that bubbles up from inside (a dismissed file picker) is not
		// a close request; the platform's is fired at the dialog itself.
		if (e.target !== e.currentTarget) {
			return;
		}
		oncancelProp?.(e as Event & { currentTarget: EventTarget & HTMLDialogElement });
		if (e.defaultPrevented) {
			return;
		}
		e.preventDefault();
		if (!shouldDismissOnCloseRequest()) {
			return;
		}
		handleClose();
	}

	// The last press's pointer type, which the browser's `dblclick` does not
	// carry. A finger's double tap is the stage's own.
	let pointerType = '';
	// Where the last press on the media started, which a click does not carry.
	let pressPoint: { x: number; y: number } | null = null;
	// A zoomed drag sets this, so its click is ignored.
	let didDrag = false;

	/**
	 * Whether a mouse's or a pen's click on the media closes the viewer. It does
	 * when its press or its release lands outside the current page's media. That
	 * is the fitted photo's laid-out box, the caption's band and the caption's
	 * own box. While zoomed, the photo's shown box is media too.
	 */
	function isClickOutsideMedia(e: MouseEvent): boolean {
		const viewer = imageWrapperEl;
		const page = viewer?.querySelector('[data-current]');
		const mediaEl = page?.querySelector('img') ?? page?.querySelector('video');
		// The page's photo box, which centres the photo.
		const box = mediaEl?.parentElement;
		const group = mediaGroupEl;
		if (
			e.detail === 0 ||
			pointerType === 'touch' ||
			viewer == null ||
			page == null ||
			mediaEl == null ||
			box == null ||
			group == null ||
			!(e.target instanceof Node) ||
			!group.contains(e.target)
		) {
			return false;
		}
		const space = (box.clientHeight - mediaEl.offsetHeight) / 2;
		const boxRect = box.getBoundingClientRect();
		const top = boxRect.top + space;
		const bottom = top + mediaEl.offsetHeight;
		const captionBoxEl = page.querySelector<HTMLElement>('[data-lightbox-caption]');
		const width = mediaEl.offsetWidth;
		const middle = boxRect.left + box.clientWidth / 2;
		const shown = mediaEl.getBoundingClientRect();
		// The caption band can sit apart from the photo. There the media is the
		// photo's rows, the band and the caption's own box, which an open caption
		// lifts over the photo. So the space between the photo and the band is
		// outside it.
		const captionRect = captionBoxEl?.getBoundingClientRect();
		const bandRect = captionBoxEl?.parentElement?.getBoundingClientRect();
		const isOutside = ({ x, y }: { x: number; y: number }) => {
			const isOnShownPhoto =
				x >= shown.left && x <= shown.right && y >= shown.top && y <= shown.bottom;
			if (isOnShownPhoto) {
				return false;
			}
			if (captionRect == null) {
				return y < top || y > bottom || Math.abs(x - middle) > width / 2;
			}
			const isOnPhotoRows =
				y >= top && y <= top + mediaEl.offsetHeight && Math.abs(x - middle) <= width / 2;
			const isOnCaption =
				y >= captionRect.top &&
				y <= captionRect.bottom &&
				x >= captionRect.left &&
				x <= captionRect.right;
			const isOnBand =
				bandRect != null &&
				y >= bandRect.top &&
				y <= bandRect.bottom &&
				x >= bandRect.left &&
				x <= bandRect.right;
			return !isOnPhotoRows && !isOnCaption && !isOnBand;
		};
		return (
			isOutside({ x: e.clientX, y: e.clientY }) || (pressPoint != null && isOutside(pressPoint))
		);
	}

	function handleBackdropClick(e: MouseEvent): void {
		if (didDrag) {
			didDrag = false;
			return;
		}
		const isMediaClose = pointerType !== 'touch' && isClickOutsideMedia(e);
		if (e.target === e.currentTarget || e.target === containerEl || isMediaClose) {
			handleClose();
		}
	}

	const captionTruncation = useTruncation(() => ({
		maxLines: 2,
		isExpanded: isCaptionOpen
	}));
	const hasCaptionBand = $derived(mediaArray.some((item) => hasCaptionOf(item)));
	const hasCaptionToggle = $derived(captionTruncation.isTruncated || isCaptionOpen);
	// Its place ends the caption's last line, unless the open caption scrolls.
	const hasCaptionTogglePlace = $derived(hasCaptionToggle && !isCaptionScrolling);

	function hasCaptionOf(item: LightboxMedia | null | undefined): boolean {
		return item?.caption != null && item.caption !== '';
	}

	/** The caption's line height and content box, for line counts. */
	function captionLineMetrics(): { line: number; top: number; bottom: number } | null {
		const caption = bandCaptionEl;
		if (caption == null) {
			return null;
		}
		const view = caption.ownerDocument.defaultView ?? window;
		const style = view.getComputedStyle(caption);
		const line = parseFloat(style.lineHeight);
		if (!Number.isFinite(line) || line <= 0) {
			return null;
		}
		return {
			line,
			top: parseFloat(style.paddingTop),
			bottom: parseFloat(style.paddingBottom)
		};
	}

	/**
	 * Reads the caption's laid-out size: how many lines it shows, and whether
	 * the open caption scrolls. The truncation hook owns whether the clamp cuts
	 * the text off.
	 */
	function measureCaption(): void {
		const caption = bandCaptionEl;
		const metrics = captionLineMetrics();
		if (caption == null || metrics == null) {
			isCaptionScrolling = false;
			return;
		}
		const contentHeight = caption.clientHeight - metrics.top - metrics.bottom;
		const lineCount = Math.max(0, Math.round(contentHeight / metrics.line));
		captionShownLines = lineCount;
		// The truncation hook measures the clamp; this reads the panel's own
		// scroll state for the open caption's place and line count.
		isCaptionScrolling = isCaptionOpen && caption.scrollHeight > caption.clientHeight + 1;
	}

	/** Counts the open caption's text lines, without its toggle's place. */
	function countOpenCaption(): void {
		const caption = bandCaptionEl;
		const flow = bandCaptionFlowEl;
		const metrics = captionLineMetrics();
		if (caption == null || flow == null || metrics == null) {
			return;
		}
		const toggleWidth = captionToggleEl?.offsetWidth ?? 0;
		if (toggleWidth > 0) {
			captionToggleWidth = toggleWidth;
		}
		const textLines = Math.max(0, Math.round(flow.getBoundingClientRect().height / metrics.line));
		captionShownLines = Math.max(
			textLines,
			Math.round((caption.clientHeight - metrics.top - metrics.bottom) / metrics.line)
		);
	}

	async function toggleCaption(): Promise<void> {
		if (isCaptionOpen) {
			openCaptionIndex = null;
			await tick();
			measureCaption();
			return;
		}
		// The opened caption lays out without the toggle's place before its
		// lines are counted.
		captionShownLines = 0;
		openCaptionIndex = index;
		await tick();
		countOpenCaption();
		measureCaption();
	}

	// Syncs the caption's place, lines and scroll with its laid-out size.
	$effect(() => {
		const caption = bandCaptionEl;
		if (caption == null || !isOpen) {
			return;
		}
		// A new caption has no measure yet, so an open caption's first delivery
		// counts its text's lines, as a new width does.
		measureCaption();
		return observeResize(caption, () => {
			measureCaption();
		});
	});

	// The toggle's width, which its place in the caption's last line takes.
	$effect(() => {
		const toggle = captionToggleEl;
		if (toggle == null) {
			return;
		}
		return observeResize(toggle, () => {
			const width = toggle.offsetWidth;
			if (width > 0) {
				captionToggleWidth = width;
			}
		});
	});

	useTouchHitArea(
		() => captionToggleEl,
		() => hasCaptionToggle
	);

	/**
	 * The drag to close fades the backdrop and controls with the photo's travel.
	 */
	let fadedAnimators: Animator[] = [];
	let dismissalAnswered = false;
	let backdropMoves = 0;

	function setBackdropMoving(moving: boolean): void {
		const dialog = dialogEl;
		if (moving) {
			dialog?.style.setProperty('--_lightbox-backdrop-filter', 'none');
		} else {
			dialog?.style.removeProperty('--_lightbox-backdrop-filter');
		}
	}

	function dismissFades(): { backdrop: Animator | null; chrome: Animator[] } {
		const dialog = dialogEl;
		const container = containerEl;
		if (dialog == null || container == null) {
			return { backdrop: null, chrome: [] };
		}
		// A caption in a band fades as the band, which carries its backing.
		const band = captionBandEl;
		const chrome: HTMLElement[] = band == null ? [] : [band];
		for (const element of container.querySelectorAll<HTMLElement>(
			'[data-lightbox-chrome], [data-lightbox-page]:not([data-current]), [data-lightbox-caption]'
		)) {
			if (
				element.parentElement?.closest('[data-lightbox-page]:not([data-current])') == null &&
				band?.contains(element) !== true
			) {
				chrome.push(element);
			}
		}
		return {
			backdrop: animatorFor(dialog, { pseudoElement: '::backdrop' }),
			chrome: chrome.map((element) => animatorFor(element))
		};
	}

	function onDragStart(): void {
		didDrag = true;
	}

	const zoom = useZoomCore(() => ({
		stageRef: () => pageMediaEl,
		surfaceRef: () => trackEl,
		isEnabled: isOpen && isZoomTarget,
		itemKey,
		onZoomedChange: (next) => {
			isZoomed = next;
			announce(next ? t('@astryx.lightbox.zoomedIn') : t('@astryx.lightbox.zoomedOut'));
		}
	}));

	function startsOnCaption(touch: GestureTouch | undefined): boolean {
		const target = touch?.target;
		return target instanceof Element && target.closest('[data-lightbox-caption]') != null;
	}

	const stage = useZoomStage(zoom, () => ({
		stageRef: () => pageMediaEl,
		surfaceRef: () => trackEl,
		isEnabled: isOpen && isZoomTarget,
		itemKey,
		// The stage shares its surface with the page around it. A tap there
		// closes, as on the backdrop, unless it lands on the caption.
		onTapOutside: ({ x, y }) => {
			const rect = trackEl
				?.querySelector('[data-current] [data-lightbox-caption]')
				?.getBoundingClientRect();
			if (rect != null && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
				return;
			}
			handleClose();
		},
		onDragStart,
		isTouchPresentation: isTouch.matches,
		// Only a gallery's touch pager takes a drag past a zoomed photo's edge.
		hasOuterPager: isGallery && isTouch.matches,
		// A pinch whose first finger lands on a caption is the page's.
		shouldBeginPinch: (recognizer) => !startsOnCaption(recognizer.trackedTouches[0]),
		dismiss: {
			// Part of the touch presentation, which applies under a coarse primary
			// pointer. Where it is fine, a drag leaves the photo in place. A video
			// keeps its own controls' drags.
			isEnabled: isOpen && !isVideo && isTouch.matches,
			onDrag: (travel) => {
				const { backdrop, chrome } = dismissFades();
				fadedAnimators = backdrop == null ? chrome : [backdrop, ...chrome];
				backdropMoves += 1;
				setBackdropMoving(true);
				backdrop?.set({ opacity: dismissBackdropAlpha(travel) });
				const opacity = dismissChromeAlpha(travel);
				for (const animator of chrome) {
					animator.set({ opacity });
				}
			},
			onRelease: (dismisses, touch) => {
				const { backdrop, chrome } = dismissFades();
				fadedAnimators = backdrop == null ? chrome : [backdrop, ...chrome];
				// They keep pace with the photo: the dismissal's measured spring, or
				// on a cancel the shared settle spring, read where the stage is.
				const spring = dismisses
					? zoomMedia.dismiss.dismissSizeSpring
					: resolveMotion(pageMediaEl, springs.settle);
				const opacity = dismisses ? 0 : 1;
				const move = (backdropMoves += 1);
				setBackdropMoving(true);
				const backdropMotion = backdrop?.animate({ opacity }, { spring }, { touchRelease: touch });
				for (const animator of chrome) {
					animator.animate({ opacity }, { spring }, { touchRelease: touch });
				}
				// Back at rest: the blur returns, unless the backdrop moved again.
				void backdropMotion?.finished.then(() => {
					if (!dismisses && backdropMoves === move) {
						setBackdropMoving(false);
					}
				});
			},
			onDismissed: () => {
				handleClose();
				// A caller may keep the viewer open, since the close is its call. The
				// render after its answer brings the photo, the backdrop and the
				// controls back, so no open dialog stays invisible.
				dismissalAnswered = true;
			}
		}
	}));

	// Restore the photo, the backdrop and the controls only when the viewer
	// opens or a dismissal is answered.
	function restoreAfterDismissal(): void {
		stage.reset();
		backdropMoves += 1;
		setBackdropMoving(false);
		const faded = fadedAnimators;
		fadedAnimators = [];
		for (const animator of faded) {
			animator.set({ opacity: 1 });
		}
	}

	$effect(() => {
		if (isOpen) {
			restoreAfterDismissal();
		}
	});
	$effect(() => {
		void isOpen;
		if (!dismissalAnswered) {
			return;
		}
		dismissalAnswered = false;
		if (isOpen) {
			restoreAfterDismissal();
		}
	});

	/**
	 * Whether a mouse or a pen hovers over the fitted photo, for its cursor. The
	 * stage fills the viewer, so the photo's box is read, not the event target.
	 */
	const OVER_PHOTO_ATTRIBUTE = 'data-lightbox-over-photo';
	function markPointerOverPhoto(e: PointerEvent): void {
		if (e.pointerType === 'touch' || e.buttons !== 0) {
			return;
		}
		const stageEl = e.currentTarget as HTMLDivElement;
		const photo = stageEl.querySelector('[data-current] img') ?? stageEl.querySelector('img');
		const r = photo?.getBoundingClientRect();
		stageEl.toggleAttribute(
			OVER_PHOTO_ATTRIBUTE,
			r != null &&
				e.clientX >= r.left &&
				e.clientX <= r.right &&
				e.clientY >= r.top &&
				e.clientY <= r.bottom
		);
	}

	/** A video's native controls are taken as a band at its bottom edge. */
	function startsOnVideoControls(touch: GestureTouch | undefined): boolean {
		const video = trackEl?.querySelector('[data-current] video[controls]');
		if (touch == null || video == null) {
			return false;
		}
		const box = video.getBoundingClientRect();
		return (
			touch.startX >= box.left &&
			touch.startX <= box.right &&
			touch.startY <= box.bottom &&
			touch.startY >= box.bottom - VIDEO_CONTROLS_BAND
		);
	}

	// Paging turns the page that holds focus inert, which drops focus inside it.
	// Such focus moves to the new page's photo, or to Close without zoom, so the
	// arrow keys keep paging.
	let pagingFocus: FocusWithin | null = null;
	function noteFocusBeforePaging(): void {
		pagingFocus = noteFocusWithin(imageWrapperEl?.querySelector<HTMLElement>('[data-current]'));
	}
	$effect(() => {
		void index;
		void isZoomTarget;
		const note = pagingFocus;
		pagingFocus = null;
		moveFocusLeftBehind(
			note,
			isZoomTarget
				? pageMediaEl
				: (dialogEl?.querySelector<HTMLElement>('[data-lightbox-chrome] button') ?? null),
			note?.container
		);
	});

	usePager(() => ({
		viewportRef: () => imageWrapperEl,
		// A single photo has no pager, since it has nothing to page to. Its track
		// still holds its one page and takes the zoom's gestures.
		trackRef: () => (isGallery ? trackEl : null),
		count: mediaArray.length,
		gap: zoomMedia.viewer.pageGap,
		index,
		// The drag paging is part of the touch presentation. Under a fine pointer
		// the buttons and the arrow keys page, and the page keeps its scroll.
		isPanEnabled: isOpen && isGallery && isTouch.matches,
		// Under the touch presentation a change of `index` slides the pager, and
		// a refused drag springs back. Under a fine pointer it moves at once.
		isControlledChangeAnimated: isTouch.matches,
		panOptions: {
			allowedPointerTypes: ['touch', 'pen', 'mouse'],
			maximumNumberOfTouches: 1,
			shouldBegin: (pan) => !startsOnVideoControls(pan.trackedTouches[0])
		},
		shouldBeginPan: (direction) => !stage.isZoomed() || stage.isAtEdge(direction),
		onIndexChange: (next, reason) => {
			if (reason === 'drag') {
				noteFocusBeforePaging();
				setIndex(next);
			}
		},
		// The pager names the page it rests on. Its report can come before the
		// render that marks that page current, so the page, not the mark, decides.
		onSettle: (settled) => {
			for (const page of trackEl?.querySelectorAll<HTMLElement>(':scope > [data-lightbox-page]') ??
				[]) {
				const img = page.querySelector<HTMLElement>('img');
				if (img != null && page.dataset.lightboxPage !== String(settled)) {
					img.style.translate = '';
					img.style.scale = '';
				}
			}
		}
	}));

	function goToPrev(): void {
		if (canPrev) {
			noteFocusBeforePaging();
			setIndex(index - 1);
		}
	}

	function goToNext(): void {
		if (canNext) {
			noteFocusBeforePaging();
			setIndex(index + 1);
		}
	}

	/**
	 * Keyboard navigation. While zoomed, arrows pan the image; when not zoomed
	 * they navigate the gallery. Gallery arrows follow the rendered direction.
	 */
	function handleKeyDown(e: KeyboardEvent): void {
		if (isZoomTarget) {
			if (e.key === '+' || e.key === '=') {
				e.preventDefault();
				stage.zoomIn();
				return;
			}
			if (e.key === '-') {
				e.preventDefault();
				stage.zoomOut();
				return;
			}
			// Ctrl or Cmd with 0 resets the browser's page zoom; leave it.
			if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				stage.zoomOut();
				return;
			}
			if (stage.isZoomed() && KEYBOARD_PAN_OFFSETS[e.key] !== undefined) {
				e.preventDefault();
				const [dx, dy] = KEYBOARD_PAN_OFFSETS[e.key];
				stage.panBy(dx, dy);
				return;
			}
		}
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			const towardEnd = (e.key === 'ArrowRight') !== isRtlElement(dialogEl);
			if (towardEnd) {
				goToNext();
			} else {
				goToPrev();
			}
		}
	}

	// Enter/Space on the focused zoom button toggles zoom. Keys from a child
	// stay the child's.
	function handleImageKeyDown(e: KeyboardEvent): void {
		if (e.target !== e.currentTarget) {
			return;
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			stage.toggle();
		}
	}

	// A video left on another page stops: the pager keeps the neighbours
	// mounted, and a playing one would go on, with its sound, off screen. The
	// closed dialog keeps them mounted too, so closing stops a playing video.
	$effect(() => {
		const container = containerEl;
		if (container == null) {
			return;
		}
		if (!isOpen) {
			for (const video of container.querySelectorAll<HTMLVideoElement>('video')) {
				if (!video.paused) {
					video.pause();
				}
			}
			return;
		}
		for (const video of container.querySelectorAll<HTMLVideoElement>(
			'[data-lightbox-page]:not([data-current]) video'
		)) {
			if (!video.paused) {
				video.pause();
			}
		}
		const onAPage = container.querySelector('[data-lightbox-page]') != null;
		const current = onAPage
			? container.querySelector<HTMLVideoElement>(
					'[data-lightbox-page][data-current] [data-lightbox-page-media] video'
				)
			: (imageWrapperEl?.querySelector<HTMLVideoElement>('video') ?? null);
		if (hasAutoPlay && current != null && current.paused) {
			// A browser can refuse playback without a user's gesture.
			void current.play()?.catch(() => {});
		}
	});

	const noAttach: Attachment<HTMLElement> = () => {};

	/** Binds an element to a slot for the current page only. */
	function attachCurrentPage(
		read: () => HTMLElement | null,
		set: (el: HTMLElement | null) => void
	): Attachment<HTMLElement> {
		return (element) => {
			set(element);
			return () => {
				if (read() === element) {
					set(null);
				}
			};
		};
	}

	const attachPageMedia = attachCurrentPage(
		() => pageMediaEl,
		(el) => (pageMediaEl = el)
	);
	const attachCaptionBand = attachCurrentPage(
		() => captionBandEl,
		(el) => (captionBandEl = el)
	);
	const attachCaptionText = attachCurrentPage(
		() => bandCaptionEl,
		(el) => (bandCaptionEl = el)
	);
	const attachCaptionFlow = attachCurrentPage(
		() => bandCaptionFlowEl,
		(el) => (bandCaptionFlowEl = el)
	);
	const attachCaptionToggle = attachCurrentPage(
		() => captionToggleEl,
		(el) => (captionToggleEl = el)
	);

	const contentAttach: Attachment<HTMLElement> = (element) => zoom.api.contentAttach(element);

	const imageWrapperAttrs = $derived(
		lightboxImageWrapperAttrs(isZoomTarget && !isZoomed, isZoomTarget && isZoomed)
	);
	const trackAttrs = $derived(
		lightboxTrackAttrs(isZoomTarget, isTouch.matches && !isZoomTarget && !isVideo)
	);
	const closeBackingAttrs = lightboxCloseBackingAttrs();
	const navPrevBackingAttrs = lightboxNavPrevBackingAttrs();
	const navNextBackingAttrs = lightboxNavNextBackingAttrs();

	const theme = $derived(themeProps('lightbox'));
	const dialogAttrs = $derived(lightboxDialogAttrs(xstyle));
	const containerAttrs = lightboxContainerAttrs();
	const mediaGroupAttrs = lightboxMediaGroupAttrs();
	const mirror = rtlMirrorAttrs();
	const chromeLayer = lightboxChromeLayerAttrs();
	const counterAttrs = $derived(lightboxCounterAttrs(hasZoom));
	const videoAttrs = lightboxVideoAttrs();
	const imageAttrs = lightboxImageAttrs(null);
</script>

{#snippet closeIcon()}
	<Icon
		icon="close"
		size="sm"
		color="inherit"
		xstyle={hasZoom ? lightboxControlIconStyle : undefined}
	/>
{/snippet}

<!--
	Mirrored under RTL so "previous" points toward the previous slide in both
	directions.
-->
{#snippet prevIcon()}
	<span class={mirror.class} style={mirror.style}>
		<Icon
			icon="chevronLeft"
			size="sm"
			color="inherit"
			xstyle={hasZoom ? lightboxControlIconStyle : undefined}
		/>
	</span>
{/snippet}

{#snippet nextIcon()}
	<span class={mirror.class} style={mirror.style}>
		<Icon
			icon="chevronRight"
			size="sm"
			color="inherit"
			xstyle={hasZoom ? lightboxControlIconStyle : undefined}
		/>
	</span>
{/snippet}

<!--
	One item's media. Only the current gallery page is exposed: the others keep
	an empty alt and are hidden from the accessibility tree.
-->
{#snippet lightboxMedia(item: LightboxMedia, isCurrent: boolean)}
	{#if (item.type ?? 'image') === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={item.src}
			aria-label={item.alt}
			controls
			autoplay={isOpen && isCurrent && hasAutoPlay}
			preload={isCurrent ? 'auto' : 'metadata'}
			class={videoAttrs.class}
			style={videoAttrs.style}
		></video>
	{:else}
		<img
			src={item.src}
			alt={isCurrent ? item.alt : ''}
			aria-hidden={isCurrent ? undefined : true}
			draggable={false}
			{@attach isCurrent ? contentAttach : noAttach}
			class={imageAttrs.class}
			style={imageAttrs.style}
		/>
	{/if}
{/snippet}

{#snippet lightboxCaption(caption: string | Snippet | undefined)}
	{#if typeof caption === 'function'}
		{@render caption()}
	{:else if caption}
		{caption}
	{/if}
{/snippet}

<!--
	Upstream returns `null` when there is no current item, so an empty `media`
	array renders nothing at all — not even the <dialog>.
-->
{#if currentItem}
	<dialog
		bind:this={dialogEl}
		oncancel={handleCancel}
		onclick={(e) => {
			handleBackdropClick(e);
			onclickProp?.(e);
		}}
		onkeydown={(e) => {
			handleKeyDown(e);
			onkeydownProp?.(e);
		}}
		onpointerdown={(e) => {
			pointerType = e.pointerType;
			pressPoint = { x: e.clientX, y: e.clientY };
			const isOnStage = e.target instanceof Node && imageWrapperEl?.contains(e.target) === true;
			if (e.pointerType !== 'touch' || isOnStage) {
				didDrag = false;
			}
		}}
		aria-label={currentItem.alt || t('@astryx.lightbox.mediaViewer')}
		aria-describedby={hasCaptionOf(currentItem) ? `lightbox-caption-${index}` : undefined}
		{...theme}
		class={cx(theme.class, dialogAttrs.class, className)}
		style={mergeStyle(dialogAttrs.style, styleProp as string | undefined)}
		{...rest}
	>
		<LayerDepthProvider>
			<ModalAnnounceProvider dialogRef={() => dialogEl} {isOpen}>
				<!-- A media surface: the controls and the caption take the dark
				surface tokens and the theme's rules for them. -->
				<MediaTheme mode="dark">
					<div bind:this={containerEl} class={containerAttrs.class} style={containerAttrs.style}>
						<div data-lightbox-chrome="" class={chromeLayer.class} style={chromeLayer.style}>
							<!-- Close: with zoom it sits on its own translucent backing, and its
							icon keeps the on-dark colour. -->
							{#if hasZoom}
								<span class={closeBackingAttrs.class} style={closeBackingAttrs.style}>
									<IconButton
										icon={closeIcon}
										label={t('@astryx.lightbox.close')}
										variant="ghost"
										onclick={handleClose}
										xstyle={lightboxControlButtonStyle}
									/>
								</span>
							{:else}
								<IconButton
									icon={closeIcon}
									label={t('@astryx.lightbox.close')}
									variant="ghost"
									onclick={handleClose}
									xstyle={[lightboxCloseButtonStyle, lightboxControlButtonStyle]}
								/>
							{/if}

							<!--
								Gallery nav: prev — stays mounted and is disabled at the start
								of the range so pressing/arrowing to the boundary doesn't
								unmount the focused control and drop focus to <body>.
							-->
							{#if isGallery}
								{#if hasZoom}
									<span class={navPrevBackingAttrs.class} style={navPrevBackingAttrs.style}>
										<IconButton
											icon={prevIcon}
											label={t('@astryx.lightbox.previous')}
											variant="ghost"
											isDisabled={!canPrev}
											onclick={goToPrev}
											xstyle={lightboxControlButtonStyle}
										/>
									</span>
								{:else}
									<IconButton
										icon={prevIcon}
										label={t('@astryx.lightbox.previous')}
										variant="ghost"
										isDisabled={!canPrev}
										onclick={goToPrev}
										xstyle={[
											lightboxNavButtonStyle,
											lightboxNavPrevStyle,
											lightboxControlButtonStyle
										]}
									/>
								{/if}
							{/if}
						</div>

						<!-- The stage: a track of pages, each a photo and its caption -->
						<div
							bind:this={mediaGroupEl}
							data-lightbox-media=""
							class={mediaGroupAttrs.class}
							style={mediaGroupAttrs.style}
						>
							<div
								bind:this={imageWrapperEl}
								class={imageWrapperAttrs.class}
								style={imageWrapperAttrs.style}
								onpointermove={isZoomTarget ? markPointerOverPhoto : undefined}
								onpointerleave={isZoomTarget
									? (e) => e.currentTarget.removeAttribute(OVER_PHOTO_ATTRIBUTE)
									: undefined}
								ondblclick={isZoomTarget
									? (e) => {
											// A finger's double tap is the stage's own.
											if (pointerType !== 'touch') {
												stage.doubleClickAt(e.clientX, e.clientY);
											}
										}
									: undefined}
							>
								<div bind:this={trackEl} class={trackAttrs.class} style={trackAttrs.style}>
									{#each pageIndexes as i (i)}
										{@const page = lightboxPageAttrs(i)}
										{@const pageMedia = lightboxPageMediaAttrs(isZoomTarget)}
										{@const focusAttrs = lightboxZoomButtonFocusAttrs(isZoomTarget && i === index)}
										{@const band = lightboxCaptionBandAttrs(
											hasCaptionOf(mediaArray[i]),
											i === index && isCaptionOpen
										)}
										<!--
											Only the current page is on screen at rest: the others
											stay out of the tab order and the accessibility tree.
										-->
										<div
											data-lightbox-page={i}
											data-current={i === index ? '' : undefined}
											inert={i !== index ? true : undefined}
											aria-hidden={i !== index ? true : undefined}
											class={page.class}
											style={page.style}
										>
											<div
												data-lightbox-page-media=""
												role={isZoomTarget && i === index ? 'button' : undefined}
												tabindex={isZoomTarget && i === index ? 0 : undefined}
												aria-pressed={isZoomTarget && i === index ? isZoomed : undefined}
												aria-label={isZoomTarget && i === index
													? t('@astryx.lightbox.zoom')
													: undefined}
												class={cx(pageMedia.class, focusAttrs.class)}
												style={cx(pageMedia.style, focusAttrs.style)}
												onkeydown={isZoomTarget && i === index ? handleImageKeyDown : undefined}
												{@attach i === index ? attachPageMedia : noAttach}
											>
												{@render lightboxMedia(mediaArray[i], i === index)}
											</div>
											{#if hasCaptionBand}
												<div
													data-lightbox-caption={hasCaptionOf(mediaArray[i]) ? '' : undefined}
													class={band.class}
													style={band.style}
													{@attach i === index ? attachCaptionBand : noAttach}
												>
													{#if hasCaptionOf(mediaArray[i])}
														<!-- The page's one caption: clamped in the band, or open
														over the photo's bottom. -->
														<div
															id={i === index ? `lightbox-caption-${index}` : undefined}
															class={lightboxCaptionInBandAttrs(i === index && isCaptionOpen).class}
															style={lightboxCaptionInBandAttrs(i === index && isCaptionOpen).style}
														>
															<div
																class={lightboxCaptionBodyAttrs().class}
																style={lightboxCaptionBodyAttrs().style}
															>
																<div
																	class={lightboxCaptionTextAttrs(
																		i === index && isCaptionOpen,
																		i === index && hasCaptionToggle && isCaptionScrolling,
																		captionToggleWidth
																	).class}
																	style={lightboxCaptionTextAttrs(
																		i === index && isCaptionOpen,
																		i === index && hasCaptionToggle && isCaptionScrolling,
																		captionToggleWidth
																	).style}
																	{@attach i === index ? attachCaptionText : noAttach}
																	{@attach i === index ? captionTruncation.attach : noAttach}
																>
																	<div
																		class={lightboxCaptionFlowAttrs().class}
																		style={lightboxCaptionFlowAttrs().style}
																		{@attach i === index ? attachCaptionFlow : noAttach}
																	>
																		<span
																			aria-hidden="true"
																			class={lightboxCaptionTogglePlaceAttrs(
																				i === index && hasCaptionTogglePlace,
																				captionToggleWidth,
																				captionShownLines
																			).class}
																			style={lightboxCaptionTogglePlaceAttrs(
																				i === index && hasCaptionTogglePlace,
																				captionToggleWidth,
																				captionShownLines
																			).style}
																		></span>
																		{@render lightboxCaption(mediaArray[i].caption)}
																	</div>
																</div>
																{#if i === index}
																	<!-- Mounted with the caption, and hidden until the
																	caption needs it. So a measurement only shows or
																	hides it, and adds no element. -->
																	<span
																		class={lightboxCaptionToggleAttrs(!hasCaptionToggle).class}
																		style={lightboxCaptionToggleAttrs(!hasCaptionToggle).style}
																		{@attach attachCaptionToggle}
																	>
																		<Link
																			type="inherit"
																			color="inherit"
																			hasUnderline
																			aria-expanded={isCaptionOpen}
																			aria-controls={`lightbox-caption-${index}`}
																			onclick={() => void toggleCaption()}
																			xstyle={touchHitAreaStyles.layer}
																		>
																			{isCaptionOpen
																				? t('@astryx.lightbox.captionLess')
																				: t('@astryx.lightbox.captionMore')}
																		</Link>
																	</span>
																{/if}
															</div>
														</div>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>

						<div data-lightbox-chrome="" class={chromeLayer.class} style={chromeLayer.style}>
							<!--
								Gallery nav: next — see "prev" above; stays mounted and disabled
								at the end of the range instead of unmounting.
							-->
							{#if isGallery}
								{#if hasZoom}
									<span class={navNextBackingAttrs.class} style={navNextBackingAttrs.style}>
										<IconButton
											icon={nextIcon}
											label={t('@astryx.lightbox.next')}
											variant="ghost"
											isDisabled={!canNext}
											onclick={goToNext}
											xstyle={lightboxControlButtonStyle}
										/>
									</span>
								{:else}
									<IconButton
										icon={nextIcon}
										label={t('@astryx.lightbox.next')}
										variant="ghost"
										isDisabled={!canNext}
										onclick={goToNext}
										xstyle={[
											lightboxNavButtonStyle,
											lightboxNavNextStyle,
											lightboxControlButtonStyle
										]}
									/>
								{/if}
							{/if}

							<!-- Gallery counter -->
							{#if isGallery && mediaArray.length > 1}
								<div class={counterAttrs.class} style={counterAttrs.style}>
									{index + 1} / {mediaArray.length}
								</div>
							{/if}
						</div>
					</div>
				</MediaTheme>
			</ModalAnnounceProvider>
		</LayerDepthProvider>
	</dialog>
{/if}
