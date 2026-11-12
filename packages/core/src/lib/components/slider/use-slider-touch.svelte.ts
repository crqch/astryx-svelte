import {
	SliderTouchController,
	type SliderTouchModel,
	type SliderTouchParts
} from './slider-touch-controller.js';

/**
 * Ported from Astryx's `Slider/useSliderTouch.ts`.
 *
 * Wires UISlider's tracking to a rendered Slider for every pointer, while it
 * is enabled. Slider's own pointer handlers then take only a mouse press on
 * the track.
 *
 * The React hook keeps one controller for the component's life, reads its
 * model through a ref in a layout effect, and attaches in an effect. This port
 * creates the controller at initialisation, hands it this render's model in a
 * pre-effect (Svelte's counterpart of `useIsomorphicLayoutEffect`), and
 * re-attaches when the thumbs or the orientation change. An attachment is an
 * effect itself, so reading those getters in it re-runs the registration.
 */

export interface UseSliderTouchOptions {
	/** The slider is enabled: its gestures attach for every pointer. */
	isEnabled: () => boolean;
	/** The model to hand the controller this render. */
	getModel: () => SliderTouchModel;
	/** The rendered parts, read fresh when the controller needs them. */
	getParts: () => SliderTouchParts | null;
	/** Re-attaches when the thumbs or the orientation change. */
	getThumbCount: () => number;
	/**
	 * Whether each thumb renders inside its value tooltip: changing it mounts
	 * new thumbs. So the gestures re-attach.
	 */
	getThumbsWrapped: () => boolean;
	/** The current orientation, which also re-attaches the gestures. */
	getIsHorizontal: () => boolean;
}

export function useSliderTouch({
	isEnabled,
	getModel,
	getParts,
	getThumbCount,
	getThumbsWrapped,
	getIsHorizontal
}: UseSliderTouchOptions): void {
	// The parts getter reads only refs. So the first one stays current.
	const controller = new SliderTouchController(getModel(), getParts);

	// Hands the controller this render's model: the values and callbacks it
	// reads from gesture callbacks outside Svelte's render.
	$effect.pre(() => {
		controller.setModel(getModel());
	});

	// Synchronizes the thumbs with the document's gesture host. Their
	// PressTrackers and pans attach while the slider is enabled. They detach,
	// ending any interaction silently, when it is disabled or the thumbs
	// change.
	$effect(() => {
		const enabled = isEnabled();
		const thumbCount = getThumbCount();
		const isHorizontal = getIsHorizontal();
		const thumbsWrapped = getThumbsWrapped();
		if (!enabled) {
			return;
		}
		void thumbCount;
		void isHorizontal;
		void thumbsWrapped;
		return controller.attach();
	});

	// Releases the controller's animators and gesture host listeners on
	// unmount.
	$effect(() => () => controller.dispose());
}
