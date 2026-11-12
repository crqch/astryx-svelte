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
		 * Enable zoom on double-click, or Enter/Space/`+`/`-` via keyboard
		 * (images only). When zoomed, drag or use arrow keys to pan.
		 * @default false
		 */
		hasZoom?: boolean;
		/** Sets `autoplay` on a video item. @default false */
		hasAutoPlay?: boolean;
	}
</script>

<script lang="ts">
	import Icon from '../icon/icon.svelte';
	import IconButton from '../icon-button/icon-button.svelte';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { announceInModal } from '../../hooks/use-announce.js';
	import ModalAnnounceProvider from '../../hooks/modal-announce-provider.svelte';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { usePager } from '../../hooks/use-pager.svelte.js';
	import { useScrollLock } from '../../hooks/use-scroll-lock.svelte.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import { zoomMedia } from '../../motion/uikit/zoomMedia.js';
	import type { GestureTouch } from '../../gestures/types.js';
	import LayerDepthProvider from '../layer/layer-depth-provider.svelte';
	import { useLayerDismissal } from '../layer/use-layer-dismissal.svelte.js';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { rtlMirrorAttrs } from '../../utils/rtl.stylex.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { observeResize, unobserveResize } from '../../internal/shared-resize-observer.js';
	import {
		lightboxDialogAttrs,
		lightboxContainerAttrs,
		lightboxMediaGroupAttrs,
		lightboxImageWrapperAttrs,
		lightboxImageAttrs,
		lightboxTrackAttrs,
		lightboxPageAttrs,
		lightboxPageMediaAttrs,
		lightboxVideoAttrs,
		lightboxCaptionAttrs,
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

	/**
	 * A fullscreen overlay for viewing images at full resolution.
	 *
	 * Uses the native `<dialog>` element with `showModal()` for focus containment
	 * and top-layer promotion — there is no `Layer`, no Popover API and no
	 * `useFocusTrap`; the browser provides all three.
	 *
	 * Optionally supports zoom (double-click, Enter/Space on the image, or
	 * `+`/`-` to toggle 2x) and pan (drag or arrow keys when zoomed; arrows
	 * navigate the gallery when not zoomed).
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
	/**
	 * While the modal viewer is open, a screen reader reads only messages inside
	 * it, so the position and zoom messages go through the viewer's own region.
	 * The owner cannot read its own modal scope from context — the provider is
	 * rendered inside the dialog, below this component — so it names the dialog
	 * directly, as upstream's `announceInModal(dialog, …)` does.
	 */
	function announce(message: string): void {
		if (dialogEl != null) {
			announceInModal(dialogEl, message);
		}
	}
	// Upstream's `containerRef`. Not `$state`: written by `bind:this` and read
	// only inside the click handler, so nothing should re-run when it lands.
	// svelte-ignore non_reactive_update
	let containerEl: HTMLDivElement | null = null;
	// Upstream's `triggerElementRef`. A plain `let`: nothing renders from it.
	let triggerElement: Element | null = null;

	// Index state (controlled + uncontrolled). `defaultIndex` seeds this once and
	// is never re-synced, as upstream's `useState(defaultIndex)` is not.
	const isControlled = $derived(controlledIndex !== undefined);
	// svelte-ignore state_referenced_locally
	let uncontrolledIndex = $state(defaultIndex);
	const index = $derived(isControlled ? (controlledIndex as number) : uncontrolledIndex);

	function setIndex(value: number): void {
		if (!isControlled) {
			uncontrolledIndex = value;
		}
		onIndexChange?.(value);
	}

	// Zoom/pan state
	let zoom = $state(1);
	let pan = $state({ x: 0, y: 0 });
	let isDragging = $state(false);
	// Upstream's `dragStartRef`.
	let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

	const mediaArray = $derived(Array.isArray(media) ? media : [media]);
	const isGallery = $derived(mediaArray.length > 1);
	const currentItem = $derived(
		mediaArray.length > 0 ? mediaArray[Math.min(index, mediaArray.length - 1)] : null
	);
	const currentType = $derived(currentItem?.type ?? 'image');
	const isVideo = $derived(currentType === 'video');
	const canPrev = $derived(isGallery && index > 0);
	const canNext = $derived(isGallery && index < mediaArray.length - 1);
	// The current item and its neighbours; the pager shows one at rest.
	const pageIndexes = $derived(
		isGallery ? [index - 1, index, index + 1].filter((i) => i >= 0 && i < mediaArray.length) : []
	);

	// The touch presentation: keyed on a coarse primary pointer — a finger.
	// A touchscreen laptop reports its trackpad and keeps pointer behaviors.
	const isTouch = useMediaQuery(() => TOUCH_QUERY);

	useScrollLock(() => isOpen);

	// Reset zoom/pan when the active media item changes.
	const currentSrc = $derived(currentItem?.src);
	$effect(() => {
		// Read both so this tracks exactly upstream's `[index, currentItem?.src]`.
		// Both are load-bearing: `currentSrc` alone would miss the reset when
		// navigating between two gallery entries that share a `src` (a duplicated
		// image), and `index` alone would miss an in-place `media` swap.
		void index;
		void currentSrc;
		zoom = 1;
		pan = { x: 0, y: 0 };
	});

	/**
	 * Announce gallery navigation to screen readers. Moving between images only
	 * updates the visual counter, which is silent to assistive tech, so mirror
	 * each change in a polite live region ("<alt>, 3 of 12", or "Image 3 of 12"
	 * when the image has no alt). Announce only when the image changes during an
	 * already-open session — not on mount, not when opening (even at a new index,
	 * since the dialog's aria-label already names the current image), and not on
	 * close.
	 *
	 * The two trackers are plain `let`s because they are upstream's refs, and
	 * because the effect writes them: making them `$state` would re-enter it.
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
		// Upstream routed these two through `useTranslator` at 0.4.x; this port's
		// comment here used to say it hard-coded them, which was true at an earlier
		// pin and is why the strings stayed English after the catalogs moved on.
		const position = { index: currentIndex + 1, total: list.length };
		announce(
			item?.alt
				? t('@astryx.lightbox.mediaPosition', { alt: item.alt, ...position })
				: t('@astryx.lightbox.imagePosition', position)
		);
	});

	/**
	 * Open/close the dialog. Upstream uses `useIsomorphicLayoutEffect`; a plain
	 * `$effect` is its counterpart here, since effects never run on the server.
	 * (Not `$effect.pre`: this is a mutate-only layout effect, so it belongs
	 * after the DOM patch — `$effect.pre` would call `showModal()` before a
	 * simultaneous index change had patched the `<img src>`.)
	 *
	 * Upstream keys the effect on `[isOpen]` alone, because `dialogRef` is a ref.
	 * Ours also reads `dialogEl`, which is `$state` — deliberately, so the effect
	 * is ordering-proof if `bind:this` lands after it — and that widens the key
	 * set: the `<dialog>` lives inside `{#if currentItem}`, so it remounts
	 * whenever `media` goes empty and back. `wasShown` narrows the *capture* back
	 * to a genuine closed→open transition. Without it, a `media: [] → [item]`
	 * round-trip while open re-captures `triggerElement` at a moment when the
	 * modal has just left the top layer and `document.activeElement` is `<body>`,
	 * so the eventual close focuses the body instead of the trigger.
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
		} else if (!isOpen && dialog.open) {
			wasShown = false;
			dialog.close();
			if (triggerElement instanceof HTMLElement) {
				triggerElement.focus();
			}
		}
	});

	function handleClose(): void {
		onOpenChange(false);
	}

	/**
	 * Join the shared layer dismissal stack, which owns the single Escape
	 * listener and routes each press to the top-most layer — so a lightbox opened
	 * from inside a dialog closes only itself.
	 *
	 * Upstream passes `isActive` and `onDismiss` and nothing else, and so does
	 * this: the lightbox wraps its own content in `LayerDepthProvider`, so it
	 * needs no `getContainer` to have its nesting recovered from the DOM, and
	 * `isOpen` is the same prop `showModal()`/`close()` are driven from, so
	 * registration cannot lag what is on screen and there is nothing for
	 * `isPresent` to correct. It is always dismissible, so `escapeBehavior` stays
	 * at its `'close'` default.
	 */
	const { shouldDismissOnCloseRequest } = useLayerDismissal(() => ({
		isActive: isOpen,
		onDismiss: handleClose
	}));

	/**
	 * The native `cancel` event is the browser's own close-watcher firing: an
	 * Android back gesture, or a close request the stack never saw a press for.
	 * Escape presses the stack owns never arrive here — it `preventDefault()`s
	 * those, which suppresses the close watcher.
	 *
	 * Always `preventDefault` so the browser cannot close a controlled `<dialog>`
	 * behind our back, then answer with the stack's own rules: top-most only, and
	 * never while an IME composition is in progress.
	 */
	function handleCancel(e: Event): void {
		// Composed, not replaced. Upstream spreads `{...props}` last, so a consumer's
		// `onCancel` *replaces* this one and Escape silently stops calling
		// `onOpenChange(false)` — the divergence `port/debts.md` used to record as
		// "ours is the safer order". Destructuring the handler out and invoking it
		// explicitly is what `CLAUDE.md` requires anyway, and it makes the rest
		// spread's position a non-question: the consumer is heard *and* the dialog
		// still closes.
		oncancelProp?.(e as Event & { currentTarget: EventTarget & HTMLDialogElement });
		if (e.defaultPrevented) {
			// A consumer that called `preventDefault()` is pinning the dialog open.
			return;
		}
		e.preventDefault();
		if (!shouldDismissOnCloseRequest()) {
			return;
		}
		handleClose();
	}

	/**
	 * Backdrop click. The layout container fills the whole transparent dialog, so
	 * clicks on the visual backdrop (the dark area around the media) land on the
	 * container, never on the dialog element itself — treat both as the backdrop.
	 * A pan drag that ends over the backdrop still fires a click on the common
	 * ancestor; ignore it so releasing a drag doesn't dismiss.
	 */
	// Upstream's `didDragRef`.
	let didDrag = false;
	function handleBackdropClick(e: MouseEvent): void {
		if (didDrag) {
			didDrag = false;
			return;
		}
		if (e.target === e.currentTarget || e.target === containerEl) {
			handleClose();
		}
	}

	function goToPrev(): void {
		if (canPrev) {
			setIndex(index - 1);
		}
	}

	function goToNext(): void {
		if (canNext) {
			setIndex(index + 1);
		}
	}

	/**
	 * Zoom: double-click, Enter/Space on the image, or +/- keys toggle 1x <-> 2x.
	 * There is no wheel or pinch handler upstream, and no intermediate steps.
	 *
	 * Zoom changes are silent to assistive tech (only the transform changes), so
	 * mirror them in the polite live region, including a hint that arrow keys pan
	 * while zoomed.
	 */
	function applyZoom(next: number): void {
		if (!hasZoom || isVideo || next === zoom) {
			return;
		}
		zoom = next;
		pan = { x: 0, y: 0 };
		announce(next > 1 ? t('@astryx.lightbox.zoomedIn') : t('@astryx.lightbox.zoomedOut'));
	}

	function handleDoubleClick(): void {
		applyZoom(zoom === 1 ? 2 : 1);
	}

	// Keyboard navigation. While zoomed, arrows pan the image (matching common
	// lightbox conventions); when not zoomed they navigate the gallery.
	function handleKeyDown(e: KeyboardEvent): void {
		if (hasZoom && !isVideo) {
			if (e.key === '+' || e.key === '=') {
				e.preventDefault();
				applyZoom(2);
				return;
			}
			if (e.key === '-') {
				e.preventDefault();
				applyZoom(1);
				return;
			}
			if (zoom > 1 && KEYBOARD_PAN_OFFSETS[e.key] !== undefined) {
				e.preventDefault();
				const [dx, dy] = KEYBOARD_PAN_OFFSETS[e.key];
				pan = { x: pan.x + dx, y: pan.y + dy };
				return;
			}
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			goToPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			goToNext();
		}
	}

	// Enter/Space on the focused image wrapper (role="button") toggles zoom.
	function handleImageKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleDoubleClick();
		}
	}

	// Pan: drag when zoomed. Upstream applies no clamping, so a zoomed image can
	// be dragged entirely out of view — replicated.
	function handlePointerDown(e: PointerEvent): void {
		if (zoom <= 1 || !hasZoom) {
			return;
		}
		isDragging = true;
		didDrag = false;
		dragStart = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
	}

	$effect(() => {
		if (!isDragging) {
			return;
		}
		const handlePointerMove = (e: PointerEvent): void => {
			didDrag = true;
			pan = {
				x: dragStart.panX + (e.clientX - dragStart.x),
				y: dragStart.panY + (e.clientY - dragStart.y)
			};
		};
		const handlePointerUp = (): void => {
			isDragging = false;
		};
		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		};
	});

	const isZoomed = $derived(zoom > 1);
	const isZoomTarget = $derived(hasZoom && !isVideo);
	// Pan is divided by zoom because `scale` precedes `translate` in the list.
	const imageTransform = $derived(
		zoom === 1 ? null : `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
	);

	/** Set on the stage while a mouse or a pen hovers over the fitted photo. */
	const OVER_PHOTO_ATTRIBUTE = 'data-lightbox-over-photo';
	// Upstream's `imageWrapperRef` and `captionRef`, read by `placeCaption`.
	let imageWrapperEl = $state<HTMLDivElement | null>(null);
	let captionEl = $state<HTMLDivElement | null>(null);
	// Upstream's `trackRef`: a gallery's row of pages, which the pager moves.
	let trackEl = $state<HTMLDivElement | null>(null);

	/**
	 * With zoom the stage fills the viewer, so a caption would sit at the
	 * viewer's bottom. It moves up by the stage's space below the fitted photo,
	 * so it sits under the photo as it does without zoom.
	 */
	function placeCaption(): void {
		const caption = captionEl;
		if (caption == null) {
			return;
		}
		const photo = imageWrapperEl?.querySelector('img');
		const below =
			isZoomTarget && !isZoomed && imageWrapperEl != null && photo != null
				? (imageWrapperEl.clientHeight - photo.offsetHeight) / 2
				: 0;
		caption.style.translate = below > 0 ? `0 ${-below}px` : '';
	}

	$effect(() => {
		// Read each source upstream's `placeCaption` runs for: the layout changes
		// with the item, the zoom state, and the fitted/zoomed stage.
		void isZoomTarget;
		void isZoomed;
		void index;
		void currentSrc;
		void imageWrapperEl;
		void captionEl;
		placeCaption();
	});

	$effect(() => {
		const stage = imageWrapperEl;
		if (stage == null) {
			return;
		}
		observeResize(stage, placeCaption);
		return () => unobserveResize(stage);
	});

	/**
	 * Whether a mouse or a pen hovers over the fitted photo, for its cursor. The
	 * stage fills the viewer, so the photo's box is read, not the event target.
	 * The attribute is written on the stage, so hovering renders nothing.
	 */
	function markPointerOverPhoto(e: PointerEvent): void {
		if (e.pointerType === 'touch' || e.buttons !== 0) {
			return;
		}
		const stage = e.currentTarget as HTMLDivElement;
		const photo = stage.querySelector('[data-current] img') ?? stage.querySelector('img');
		const r = photo?.getBoundingClientRect();
		stage.toggleAttribute(
			OVER_PHOTO_ATTRIBUTE,
			r != null &&
				e.clientX >= r.left &&
				e.clientX <= r.right &&
				e.clientY >= r.top &&
				e.clientY <= r.bottom
		);
	}

	const theme = $derived(themeProps('lightbox'));
	const dialogAttrs = $derived(lightboxDialogAttrs(xstyle));
	const container = lightboxContainerAttrs();
	const mediaGroup = $derived(lightboxMediaGroupAttrs(isZoomTarget, isGallery));
	const mirror = rtlMirrorAttrs();
	const counter = $derived(lightboxCounterAttrs(hasZoom));
	const captionAttrs = lightboxCaptionAttrs();
	const video = lightboxVideoAttrs();
	const chromeLayer = lightboxChromeLayerAttrs();
	const closeBacking = lightboxCloseBackingAttrs();
	const navPrevBacking = lightboxNavPrevBackingAttrs();
	const navNextBacking = lightboxNavNextBackingAttrs();
	const imageWrapper = $derived(
		lightboxImageWrapperAttrs(
			isZoomTarget,
			!isVideo && hasZoom && !isZoomed,
			!isVideo && isZoomed,
			isGallery
		)
	);
	const image = $derived(lightboxImageAttrs(imageTransform));
	// A gallery's non-current pages keep the photo's resting box: only the
	// current page's photo carries the legacy zoom transform.
	const imageStatic = lightboxImageAttrs(null);
	const trackAttrs = $derived(
		lightboxTrackAttrs(isZoomTarget, isTouch.matches && !isZoomTarget && !isVideo)
	);
	const pageMediaAttrs = $derived(lightboxPageMediaAttrs(isZoomTarget));

	/**
	 * A video's native controls are taken as a band at its bottom edge, since
	 * browsers expose no control geometry. A drag that starts there stays the
	 * video's, as a scrubber's or a volume slider's drag.
	 */
	const VIDEO_CONTROLS_BAND = 48;
	function startsOnVideoControls(touch: GestureTouch | undefined): boolean {
		const videoEl = trackEl?.querySelector('[data-current] video[controls]');
		if (touch == null || videoEl == null) {
			return false;
		}
		const box = videoEl.getBoundingClientRect();
		return (
			touch.startX >= box.left &&
			touch.startX <= box.right &&
			touch.startY <= box.bottom &&
			touch.startY >= box.bottom - VIDEO_CONTROLS_BAND
		);
	}

	/**
	 * A gallery pages like Photos, on a UIKit paging scroll view's release. A
	 * drag or a flick moves one page at most, with Photos' 40 pt gap.
	 *
	 * Only the `pages: 'viewport'` mode is used here, so the pager's `count` is
	 * the media count while at most three pages render around the current one.
	 *
	 * The zoom stage (`useZoomCore`/`useZoomStage`) is not ported, so three
	 * parts of upstream's pager wiring are deliberately absent: the pan handoff
	 * at a zoomed photo's edge (`stage.isAtEdge`), the `onSettle` that clears
	 * that stage's inline `translate`/`scale` from the pages left behind, and
	 * `pageMediaRef` as the gallery's zoom stage. A zoomed photo keeps the
	 * legacy transform drag and the pager's pan stays off while it is zoomed.
	 */
	usePager(() => ({
		viewportRef: () => imageWrapperEl,
		trackRef: () => trackEl,
		count: mediaArray.length,
		gap: zoomMedia.viewer.pageGap,
		index,
		isPanEnabled: isOpen && isGallery && isTouch.matches,
		// Under the touch presentation a change of `index` slides the pager, and
		// a refused drag springs back. Under a fine pointer it moves at once, so
		// a refused button shows nothing.
		isControlledChangeAnimated: isTouch.matches,
		// In the touch presentation every pointer pages. A drag that starts on a
		// video's controls stays the video's.
		panOptions: {
			allowedPointerTypes: ['touch', 'pen', 'mouse'],
			maximumNumberOfTouches: 1,
			shouldBegin: (pan) => !startsOnVideoControls(pan.trackedTouches[0])
		},
		// The zoom-stage handoff (`stage.isAtEdge`) is deferred with that
		// subsystem; a zoomed photo keeps the whole drag.
		shouldBeginPan: () => !isZoomed,
		onIndexChange: (next, reason) => {
			if (reason === 'drag') {
				setIndex(next);
			}
		}
	}));
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
	directions. The `navPrev`/`navNext` wrappers already flip position via
	`insetInlineStart`/`insetInlineEnd`; without this the glyphs would stay
	pointing the way they do in LTR while the buttons swap sides.
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
	an empty alt and are hidden from the accessibility tree, as upstream does.
-->
{#snippet lightboxMedia(item: LightboxMedia, isCurrent: boolean)}
	{#if (item.type ?? 'image') === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={item.src}
			aria-label={item.alt}
			controls
			autoplay={isCurrent && hasAutoPlay}
			preload={isCurrent ? 'auto' : 'metadata'}
			class={video.class}
			style={video.style}
		></video>
	{:else}
		<img
			src={item.src}
			alt={isCurrent ? item.alt : ''}
			aria-hidden={isCurrent ? undefined : true}
			draggable={false}
			onload={placeCaption}
			class={isCurrent ? image.class : imageStatic.class}
			style={isCurrent ? image.style : imageStatic.style}
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
		aria-label={currentItem.alt || t('@astryx.lightbox.mediaViewer')}
		{...theme}
		class={cx(theme.class, dialogAttrs.class, className)}
		style={mergeStyle(dialogAttrs.style, styleProp as string | undefined)}
		{...rest}
	>
		<LayerDepthProvider>
			<ModalAnnounceProvider dialogRef={() => dialogEl} {isOpen}>
				<div bind:this={containerEl} class={container.class} style={container.style}>
					<div class={chromeLayer.class} style={chromeLayer.style}>
						{#if hasZoom}
							<span class={closeBacking.class} style={closeBacking.style}>
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
						Gallery nav: prev — stays mounted and is disabled at the start of the
						range so pressing/arrowing to the boundary doesn't unmount the focused
						control and drop focus to <body>.
					-->
						{#if isGallery}
							{#if hasZoom}
								<span class={navPrevBacking.class} style={navPrevBacking.style}>
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

					<!-- Media + caption group (centered together) -->
					<div class={mediaGroup.class} style={mediaGroup.style}>
						<!--
						The wrapper is a keyboard-operable zoom toggle when zoom is enabled:
						Enter/Space toggles, aria-pressed reflects state.
					-->
						<!--
						`role` is conditional, so the compiler cannot see that the element
						carrying `tabindex` is the one carrying `role="button"` — the two are
						set by the same flag and never appear apart.
					-->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div
							bind:this={imageWrapperEl}
							role={isZoomTarget ? 'button' : undefined}
							tabindex={isZoomTarget ? 0 : undefined}
							aria-pressed={isZoomTarget ? isZoomed : undefined}
							aria-label={isZoomTarget ? t('@astryx.lightbox.zoom') : undefined}
							data-zoom-dragging={isDragging ? '' : undefined}
							class={imageWrapper.class}
							style={imageWrapper.style}
							ondblclick={isVideo ? undefined : handleDoubleClick}
							onkeydown={isZoomTarget ? handleImageKeyDown : undefined}
							onpointerdown={isVideo ? undefined : handlePointerDown}
							onpointermove={isZoomTarget ? markPointerOverPhoto : undefined}
							onpointerleave={isZoomTarget
								? (e) => e.currentTarget.removeAttribute(OVER_PHOTO_ATTRIBUTE)
								: undefined}
						>
							{#if isGallery}
								<div bind:this={trackEl} class={trackAttrs.class} style={trackAttrs.style}>
									{#each pageIndexes as i (i)}
										{@const page = lightboxPageAttrs(i)}
										<!--
										Only the current page is on screen at rest: the others stay
										out of the tab order and the accessibility tree.
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
												class={pageMediaAttrs.class}
												style={pageMediaAttrs.style}
											>
												{@render lightboxMedia(mediaArray[i], i === index)}
											</div>
											{#if mediaArray[i].caption}
												<div
													data-lightbox-caption=""
													class={captionAttrs.class}
													style={captionAttrs.style}
												>
													{@render lightboxCaption(mediaArray[i].caption)}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								{@render lightboxMedia(currentItem, true)}
								{#if currentItem.caption}
									<div bind:this={captionEl} class={captionAttrs.class} style={captionAttrs.style}>
										{@render lightboxCaption(currentItem.caption)}
									</div>
								{/if}
							{/if}
						</div>
					</div>

					<div class={chromeLayer.class} style={chromeLayer.style}>
						<!--
						Gallery nav: next — see "prev" above; stays mounted and disabled at the
						end of the range instead of unmounting.
					-->
						{#if isGallery}
							{#if hasZoom}
								<span class={navNextBacking.class} style={navNextBacking.style}>
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
							<div class={counter.class} style={counter.style}>
								{index + 1} / {mediaArray.length}
							</div>
						{/if}
					</div>
				</div>
			</ModalAnnounceProvider>
		</LayerDepthProvider>
	</dialog>
{/if}
