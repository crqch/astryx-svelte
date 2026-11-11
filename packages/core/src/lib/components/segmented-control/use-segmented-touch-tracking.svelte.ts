import { PanGestureRecognizer } from '../../gestures/pan-gesture-recognizer.js';
import { useGestureRecognizer } from '../../gestures/use-gesture-recognizer.svelte.js';
import { usePressTracker } from '../../gestures/use-press-tracker.svelte.js';
import { lockSelection } from '../../gestures/selection-lock.js';
import {
	createActionGroupTracker,
	type ActionGroupTarget
} from '../../hooks/action-group-tracker.js';
import { awaitBrowserClick, clickForLift } from '../../utils/browser-click-wait.js';
import { SEGMENT_SELECTOR, type SegmentedSelectionMotion } from './segmented-selection-motion.js';
import {
	liftTargetAt,
	measureLiftArea,
	measureSegments,
	type ClickWait,
	type ControlBounds,
	type SegmentSpan
} from './use-segmented-touch-tracking.js';

/**
 * Ported from Astryx's `SegmentedControl/useSegmentedTouchTracking.ts`.
 *
 * Tracks a press on the control as UIKit's segmented control does. The press
 * tracker reports the press from landing to lift. It never claims the pointer,
 * so a vertical drag still scrolls the page. A horizontal pan carries the lens.
 * It claims the pointer only past its slop, and the lift still ends the press.
 *
 * The lift decides the segment, wherever the press began. Inside the control,
 * or on a segment's touch hit band, the segment under the pointer counts, else
 * the nearest one. Outside them, nothing counts.
 *
 * A tap gets the browser's own click. A drag gets no click from the browser,
 * so the tracker clicks the segment at the lift. Either way the item's
 * `onClick` runs once and can cancel the selection. A mouse and a pen are
 * tracked as a finger is. Keyboard and assistive technology keep the click.
 */
export function useSegmentedTouchTracking(
	getTrack: () => HTMLElement | null,
	motion: SegmentedSelectionMotion,
	getIsEnabled: () => boolean
): ClickWait {
	/** The horizontal pan began for this touch: it is a drag, not a tap. */
	let isDragging = false;
	/** The segments as the finger found them (disabled ones too). */
	let segments: SegmentSpan[] = [];
	/** The lift area as the finger found it: a lift outside it cancels. */
	let area: ReadonlyArray<ControlBounds> = [];
	/** Click waits still running: an unmount ends them. */
	const pendingClicks = new Set<() => void>();
	/**
	 * A tap lifted and its click has not run. After a direct click, the
	 * browser's late copy can still move focus, so the wait then lasts until
	 * the next key or press.
	 */
	let clickToCome = false;
	const clickWait: ClickWait = {
		isAwaiting: () => clickToCome,
		end: () => {
			clickToCome = false;
		}
	};

	const tracker = createActionGroupTracker(() => ({
		roots: () => [getTrack()],
		itemSelector: SEGMENT_SELECTOR,
		highlightExpansion: 0,
		// The press controller writes the shared press paint on the touched
		// segment, as everywhere under a finger. The tracker paints nothing of
		// its own. A held lens shows the selected face.
		paintsHighlight: false,
		resolveTarget: (x: number, y: number, _targets: ReadonlyArray<ActionGroupTarget>) =>
			liftTargetAt(x, y, area, segments),
		onActivated: (item, cancelled) => {
			const track = getTrack();
			const value = item.dataset.value;
			if (track != null && value != null) {
				motion.clicked(track, value, cancelled);
			}
		},
		swallowsNativeClick: true
	}));

	$effect(() => {
		return () => {
			tracker.dispose();
			clickWait.end();
			for (const end of [...pendingClicks]) {
				end();
			}
		};
	});

	// Every pointer type is tracked. A disabled control attaches nothing.
	usePressTracker(getTrack, {
		isEnabled: getIsEnabled,
		onControlEvent: (event, touch) => {
			const track = getTrack();
			if (track == null) {
				return;
			}
			switch (event) {
				case 'touchDown': {
					clickWait.end();
					isDragging = false;
					segments = measureSegments(track);
					area = measureLiftArea(track, segments);
					tracker.begin(touch.x, touch.y);
					motion.begin(track, tracker.beganOn, touch.pointerType === 'touch');
					break;
				}
				case 'touchUpInside':
				case 'touchUpOutside': {
					// The lift decides, wherever the press began. A lift outside the
					// control commits nothing.
					tracker.move(touch.x, touch.y);
					const lifted = tracker.highlighted;
					const isTap =
						event === 'touchUpInside' &&
						!isDragging &&
						lifted != null &&
						lifted === tracker.beganOn;
					const value = motion.release(lifted);
					if (value != null && isTap && lifted != null) {
						// A tap: the browser's own click commits it.
						tracker.cancel();
						clickToCome = true;
						const endWait = awaitBrowserClick(lifted, {
							onClicked: (isCancelled) => {
								pendingClicks.delete(endWait);
								clickWait.end();
								motion.clicked(track, value, isCancelled);
							},
							onNoClick: () => {
								pendingClicks.delete(endWait);
								motion.clicked(track, value, clickForLift(lifted));
							}
						});
						pendingClicks.add(endWait);
					} else if (value != null) {
						// No click comes from the browser for a drag: the segment's own
						// click, inside the lift's event; its onClick may veto it.
						tracker.end();
					} else {
						tracker.cancel();
					}
					break;
				}
				case 'touchCancel':
					clickWait.end();
					tracker.cancel();
					motion.cancel();
					break;
				case 'touchDragInside':
				case 'touchDragOutside':
				case 'touchDragEnter':
				case 'touchDragExit':
					// The horizontal pan carries the lens.
					break;
			}
		}
	});

	useGestureRecognizer(
		getTrack,
		() =>
			new PanGestureRecognizer({
				name: 'segmented-control-drag',
				direction: 'horizontal',
				cancelsTouchesInView: false,
				// No title is selectable under a held finger, as in UIKit. A hold on
				// the track does something: a drag carries the lens and commits where
				// it lifts. So this recognizer brings the lock, and the host turns off
				// text selection and the callout on the track while a finger is down.
				selectionLock: lockSelection
			}),
		(recognizer) => {
			if (recognizer.state === 'began') {
				isDragging = true;
			}
			if (recognizer.state === 'began' || recognizer.state === 'changed') {
				const { x, y } = recognizer.location();
				// The lens chases the finger, then the tracker moves the highlight.
				motion.drag(x);
				tracker.move(x, y);
			}
		},
		{ isEnabled: getIsEnabled }
	);

	return clickWait;
}
