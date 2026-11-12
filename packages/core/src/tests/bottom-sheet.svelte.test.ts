/** PORTS: BottomSheet/BottomSheet.test.tsx */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRawSnippet, tick } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import { render } from 'vitest-browser-svelte';
import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';
import ExitHarness from './fixtures/bottom-sheet-exit-harness.svelte';
import SwitcherHarness from './fixtures/bottom-sheet-switcher-harness.svelte';
import FocusRestoreHarness from './fixtures/bottom-sheet-focus-restore-harness.svelte';
import FinalFocusHarness from './fixtures/bottom-sheet-final-focus-harness.svelte';
import EscapeGateHarness from './fixtures/bottom-sheet-escape-gate-harness.svelte';
import ControlledHarness from './fixtures/bottom-sheet-controlled-harness.svelte';
import NestedHarness from './fixtures/bottom-sheet-nested-harness.svelte';
import { __resetInteractionModalityForTest } from '$lib/utils/interaction-modality.js';
import { stubMatchMedia } from './stub-match-media.js';

/**
 * Ported from Astryx's `BottomSheet/BottomSheet.test.tsx` (0.7.13).
 *
 * Runs in the **client** project, in real Chromium, where upstream's is jsdom.
 * That difference drives every restatement below, and each is a difference in
 * how the case is *driven*, never in what it asserts:
 *
 * - **Geometry is measured at zero**, as jsdom measures it, so upstream's
 *   numbers stay upstream's numbers rather than being rescaled to whatever
 *   window the test browser happens to have. See `stubZeroRects`.
 * - **The sheet is given a real transition rule.** The browser project loads no
 *   stylesheet, so `transition-duration` would compute to its initial `0s` and
 *   every two-phase snap would collapse into one render. jsdom reaches
 *   upstream's behaviour from the other side: no stylesheet at all reads back
 *   as *unresolved* timing, so the native event stays authoritative.
 * - **Assertions on the DOM wait for a flush.** `fireEvent` re-renders React
 *   synchronously; a Svelte `$state` write lands on the microtask queue.
 *   Assertions on a mock, which a handler calls synchronously, do not wait.
 *   Cases upstream drives "in one task" are therefore restated as one
 *   dispatch followed by `flush()`; their claims about React's pending render
 *   are not restated.
 * - **`scrollTop` is tracked by hand** where a case asserts on it: Chromium
 *   ignores a write to a non-overflowing element, and it *has* `scrollBy`,
 *   which sends the hook down a branch jsdom never reaches.
 * - **`<dialog>` is stubbed.** jsdom has no `showModal`/`show`/`close`, so
 *   upstream installs prototype stubs that toggle the `open` attribute. Real
 *   Chromium has them, but the assertions are about *which* one the host calls,
 *   and a genuine top-layer dialog inside a test harness moves focus in ways the
 *   focus cases would then be measuring instead of the sheet. The stubs stay,
 *   restored per case rather than through `unstubAllGlobals` — they are
 *   prototype methods, not globals.
 * - **Pointer capture is stubbed too.** Upstream installs it only if missing;
 *   Chromium has the real one, and it throws on a synthetic `pointerId`.
 * - **`matchMedia` uses this repo's query-aware stub**, not a blanket one, so
 *   `prefers-reduced-motion` stays false while width queries answer as before —
 *   the settle path these cases exercise is skipped entirely under reduced
 *   motion. Cases that change motion or pointer call it again.
 * - **`ref` is an attachment**, this port's standing ref-callback translation.
 * - **Handler and prop names are Svelte's**: `onclick`, `class`, and `children`
 *   as a snippet.
 *
 * Cases **not ported**, and why. Every one needs infrastructure that does not
 * exist in this port yet, not a weaker assertion. Upstream's
 * `opens non-modally: a manual popover instead of showModal(), no aria-modal`
 * is not in this list: it is ported under the restated name
 * `opens non-modally: show() instead of showModal(), no aria-modal` in the
 * `hasScrim={false}` block, because this port presents non-modal sheets with
 * `dialog.show()`.
 *
 * **Non-modal Popover presentation** (this port still calls `dialog.show()`,
 * where 0.7.13 presents a manual popover and measures the engine's
 * `showPopover` focus landing):
 *
 * - `focuses the panel, as show() did, when the browser focuses the popover on show (an engine whose show() lands on the panel container)`
 * - `measures the engine inside its own dialog, so a first non-modal sheet opened inside an open modal does not cache the wrong answer`
 * - `falls back to show() below the Popover API support floor`
 *
 * **React render scheduling** (`Profiler` and `IS_REACT_ACT_ENVIRONMENT`;
 * a Svelte DOM flush is a microtask, so the claim has no counterpart):
 *
 * - `restores the layout height in the same task as the transform when a drag crosses its detent, without a synchronous render`
 *
 * **Focus-region containment** (`useFocusRegionContainment` is not ported;
 * the sheet renders no Tab-containment code to exercise):
 *
 * - `wraps Tab and Shift+Tab inside an open modal sheet`
 * - `leaves Tab alone in a non-modal sheet`
 * - `wraps Tab from the checked radio of a group that ends the sheet`
 * - `wraps Shift+Tab from the checked radio of a group that starts the sheet`
 *
 * **0.7.13's keyboard subsystem** (this port's `useMobileKeyboard` predates the
 * keyboard model, layout guide, pointer-capability gating and animator rides):
 *
 * - Pointer capability: `registers no touch listener for a presented Tall sheet under a fine pointer (architecture INV13, spec:AST-094 FR24)`,
 *   `installs no focus takeover for a presented Tall sheet under a fine pointer (architecture INV13, spec:AST-094 FR24)`,
 *   `installs the focus takeover for each presented Tall sheet under a coarse pointer, through the one shared listener (spec:AST-094 FR24)`,
 *   `registers one touch listener for two presented Tall sheets under a coarse pointer (spec:AST-094 FR24)`, and
 *   `leaves focus to desktop Safari and Firefox, which measure but have a fine pointer (AST-017 FR59)`.
 * - Partial viewport recovery:
 *   `restores a top field when interactive keyboard dismissal leaves only the accessory bar`,
 *   `re-reveals a later focused field after full keyboard recovery restores the opening scroll position`, and
 *   `retains the accommodated body scroll through partial viewport recovery while focus is leaving`.
 * - Gboard slides in Chrome on Android:
 *   `lands the body at once at the keyboard's report, and the content's ride ends with no translate left`,
 *   `keeps the room through the keyboard's hide while the content rides down to the scroll from before the keyboard, then drops both at rest`,
 *   `rides the content down and keeps the room through the hide when focus moves to %s, whose picker Chrome opens over the page` (a select / a date input),
 *   `rides by the scroll the room's drop takes back where the room adds less range than its height, as in Chrome 124`,
 *   `attaches nothing of the ride under a fine pointer: the room drops at Chrome's hide report`,
 *   `keeps the content where the slide leaves it until the keyboard's report of its hide, then clears the room with nothing drawn moving`,
 *   `rides the content back up with the keyboard when the field takes focus again before Chrome reports the hide`, and
 *   `rides the content back up once the check after the slide reads the keyboard still up, when focus moves into a frame whose field keeps it`.
 * - Keyboard layout guide:
 *   `subscribes no keyboard layout guide where the keyboard moves on Safari's schedule, whose transitions the sheet never rides (spec:AST-099 FR8)`.
 * - Pinch zoom:
 *   `keeps the keyboard room when the page is pinch-zoomed past 2x with the keyboard up`.
 * - Reveal at the keyboard's report:
 *   `reveals the field in the report's own frame`,
 *   `keeps the smooth reveal where the browser does not pan to the field`,
 *   `puts back the browser's own pan to the field and reveals at once from then on`,
 *   `puts the pan back without a second scroll while the smooth reveal is still on its way`,
 *   `keeps the browser's reveal when the sheet cannot bring the field above the keyboard`,
 *   `leaves a pan the reader makes`, and
 *   `leaves a document scroll, which is not the browser revealing the field`.
 * - iOS ride:
 *   `rides the content down on the keyboard's spring from the blur, and the report then moves nothing`,
 *   `rides nothing under a fine pointer: the content stays put until the report clears the room`,
 *   `dips the content out and back in at its resting place under Reduce Motion, and the report then moves nothing (design:reduced-motion DR2)`,
 *   `starts no ride when focus moves from a field to a select, whose picker iOS puts where the keyboard was`,
 *   `rides the content down when focus moves from a field to a plain button inside an open shadow host, as a blur does`,
 *   `rides the content down from the blur once focus settles on a plain button inside an open shadow host`,
 *   `starts no ride when focus moves from a field into %s, whose own field can keep the keyboard up` (an open shadow host / a frame),
 *   `rides the content back up when a field takes focus before the keyboard is gone`,
 *   `rides the content back up when focus moves into %s before the keyboard is gone` (an open shadow host / a frame), and
 *   `glides the content to its new place when the keyboard goes while its field keeps focus, as a downward dismissal leaves it`.
 *
 * **Reduced-motion touch dismissals** (the gesture hook does not expose
 * `isDismissedByTouchDrag`, so a fine-pointer touch exit takes the non-touch
 * arm; recorded in `port/debts.md` and retired when the hook exposes it):
 *
 * - `a touch swipe dismissal under reduced motion fades out in place on a fine pointer (design:reduced-motion DR2, a touch drag's release)`
 * - `a touch swipe dismissal does not outlive the sheet: reopened and closed from a control, it leaves at once again`
 */

// A sheet has no stops unless its host asks for them, so the cases that
// exercise detents pass their own. These three — a 14% peek, a half-height
// stop, and a 92% stop the Tall budget already covers — are the geometry the
// height assertions below are written against.
const SNAP_POINTS: ReadonlyArray<number> = [0.14, 0.5, 0.92];

let rafMock: ReturnType<typeof vi.fn>;

const dialogPrototype = HTMLDialogElement.prototype;
const elementPrototype = Element.prototype;
let restoreDialog: (() => void) | null = null;
let restorePointerCapture: (() => void) | null = null;
let restoreRects: (() => void) | null = null;
let sheetTransitionRule: HTMLStyleElement | null = null;

function stubDialogMethods(): void {
	const original = {
		showModal: dialogPrototype.showModal,
		show: dialogPrototype.show,
		close: dialogPrototype.close
	};
	dialogPrototype.showModal = vi.fn(function (this: HTMLDialogElement) {
		this.setAttribute('open', '');
	});
	dialogPrototype.show = vi.fn(function (this: HTMLDialogElement) {
		this.setAttribute('open', '');
	});
	dialogPrototype.close = vi.fn(function (this: HTMLDialogElement) {
		this.removeAttribute('open');
	});
	restoreDialog = () => {
		dialogPrototype.showModal = original.showModal;
		dialogPrototype.show = original.show;
		dialogPrototype.close = original.close;
	};
}

/**
 * Measure every element at zero, the way jsdom does.
 *
 * Upstream's geometry cases are written against that baseline: the sheet's
 * height comes from the `ResizeObserver` entry each case feeds in, and nothing
 * else. Chromium measures a real 872px sheet instead, which would silently
 * replace every number in this file with one derived from the test browser's
 * window. Cases that need a specific rect install their own spy on the element
 * they care about, and an own property shadows this prototype stub.
 */
function stubZeroRects(): void {
	const original = elementPrototype.getBoundingClientRect;
	elementPrototype.getBoundingClientRect = function () {
		return rect({ top: 0, bottom: 0 });
	};
	restoreRects = () => {
		elementPrototype.getBoundingClientRect = original;
	};
}

/**
 * Give the sheet a resolvable transition, as a themed page does.
 *
 * The browser project loads no stylesheet, so the sheet's compiled rule is
 * absent and `transition-duration` computes to its initial `0s` — every
 * transition would then resolve on the frame it starts, collapsing the
 * two-phase snap these cases are about into one render. jsdom reaches upstream's
 * behaviour from the opposite direction: with no stylesheet at all the timing
 * reads back as *unresolved*, so `waitForTransition` keeps the native event
 * authoritative and each case drives it by hand.
 *
 * A real rule rather than an inline style, because the hook suppresses the
 * transition mid-drag with an inline `transition: none` — which has to keep
 * winning, and would not against inline longhands of the harness's own.
 */
function giveTheSheetATransition(): void {
	sheetTransitionRule = document.createElement('style');
	sheetTransitionRule.textContent =
		'.astryx-bottom-sheet { transition-property: transform, opacity; transition-duration: 410ms; transition-delay: 0s; }';
	document.head.append(sheetTransitionRule);
}

function stubPointerCapture(): void {
	const original = {
		setPointerCapture: elementPrototype.setPointerCapture,
		releasePointerCapture: elementPrototype.releasePointerCapture
	};
	elementPrototype.setPointerCapture = vi.fn();
	elementPrototype.releasePointerCapture = vi.fn();
	restorePointerCapture = () => {
		elementPrototype.setPointerCapture = original.setPointerCapture;
		elementPrototype.releasePointerCapture = original.releasePointerCapture;
	};
}

beforeEach(() => {
	stubDialogMethods();
	stubPointerCapture();
	stubZeroRects();
	giveTheSheetATransition();
	stubMatchMedia({ reduceMotion: false, matches: false });
	rafMock = vi.fn((callback: FrameRequestCallback) => {
		callback(0);
		return 1;
	});
	vi.stubGlobal('requestAnimationFrame', rafMock);
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
	restoreDialog?.();
	restoreDialog = null;
	restorePointerCapture?.();
	restorePointerCapture = null;
	restoreRects?.();
	restoreRects = null;
	sheetTransitionRule?.remove();
	sheetTransitionRule = null;
	vi.unstubAllGlobals();
});

function text(value: string) {
	return createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));
}

function html(markup: string) {
	return createRawSnippet(() => ({ render: () => markup }));
}

function getDialog(): HTMLDialogElement {
	const dialog = document.querySelector('dialog');
	if (!dialog) {
		throw new Error('sheet dialog not found');
	}
	return dialog;
}

function getSheet(): HTMLElement {
	const sheet = document.querySelector<HTMLElement>('.astryx-bottom-sheet');
	if (!sheet) {
		throw new Error('sheet panel not found');
	}
	return sheet;
}

function getBody(): HTMLElement {
	const body = getSheet().lastElementChild;
	if (!(body instanceof HTMLElement)) {
		throw new Error('sheet scroll body not found');
	}
	return body;
}

// The grab handle is the panel's first child (decorative, aria-hidden).
function getHandle(): HTMLElement {
	const handle = getSheet().querySelector<HTMLElement>('[aria-hidden="true"]');
	if (!handle) {
		throw new Error('grab handle not found');
	}
	return handle;
}

function finishSheetExit(): void {
	getSheet().dispatchEvent(
		new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true })
	);
}

/** Drive a pointer drag on the grab handle. */
function drag(
	handle: HTMLElement,
	points: { y: number }[],
	pointerType: 'mouse' | 'touch' | 'pen' = 'mouse'
): void {
	const [down, ...rest] = points;
	handle.dispatchEvent(
		new PointerEvent('pointerdown', {
			pointerId: 1,
			clientY: down.y,
			button: 0,
			isPrimary: true,
			pointerType,
			bubbles: true,
			cancelable: true
		})
	);
	for (const point of rest) {
		handle.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 1,
				clientY: point.y,
				pointerType,
				bubbles: true,
				cancelable: true
			})
		);
	}
	const last = points[points.length - 1];
	handle.dispatchEvent(
		new PointerEvent('pointerup', {
			pointerId: 1,
			clientY: last.y,
			pointerType,
			bubbles: true,
			cancelable: true
		})
	);
}

function rect({ top, bottom }: { top: number; bottom: number }): DOMRect {
	return {
		x: 0,
		y: top,
		top,
		right: 400,
		bottom,
		left: 0,
		width: 400,
		height: bottom - top,
		toJSON: () => ({})
	} as DOMRect;
}

function resizeEntry(
	borderBoxHeight: number,
	contentBoxHeight = borderBoxHeight
): ResizeObserverEntry {
	// Core typechecks its tests, so this partial stands in for the full entry
	// the way `shared-resize-observer` does: only the fields the sheet reads.
	const entry: Partial<ResizeObserverEntry> = {
		borderBoxSize: [{ blockSize: borderBoxHeight, inlineSize: 100 }],
		contentRect: rect({ top: 0, bottom: contentBoxHeight })
	};
	return entry as ResizeObserverEntry;
}

function mockVisualViewport(height: number, offsetTop = 0) {
	const viewport = Object.assign(new EventTarget(), { height, offsetTop });
	vi.stubGlobal('visualViewport', viewport);
	return viewport;
}

// The layout viewport — `100dvh`, `window.innerHeight` — which is what the
// sheet's height budget and its detents are measured against. Deliberately
// separate from the visual viewport above: the mobile keyboard shrinks that one
// and leaves this one alone, and the sheet has to tell them apart.
function mockWindowHeight(height: number): void {
	vi.stubGlobal('innerHeight', height);
}

interface ResizeObserverRecord {
	callback: ResizeObserverCallback;
	observed: Set<Element>;
}

function mockResizeObserverInstances(): ResizeObserverRecord[] {
	const observers: ResizeObserverRecord[] = [];
	class ResizeObserverMock {
		callback: ResizeObserverCallback;
		observed = new Set<Element>();

		constructor(callback: ResizeObserverCallback) {
			this.callback = callback;
			observers.push(this);
		}

		observe(target: Element) {
			this.observed.add(target);
		}

		unobserve(target: Element) {
			this.observed.delete(target);
		}

		disconnect() {
			this.observed.clear();
		}
	}
	vi.stubGlobal('ResizeObserver', ResizeObserverMock);
	return observers;
}

/** Deliver a measurement to the observer watching the sheet. */
async function measureSheet(
	observers: ResizeObserverRecord[],
	borderBoxHeight: number,
	contentBoxHeight?: number
): Promise<void> {
	const sheet = getSheet();
	const sheetObserver = observers.find((instance) => instance.observed.has(sheet));
	sheetObserver?.callback(
		[resizeEntry(borderBoxHeight, contentBoxHeight)],
		sheetObserver as unknown as ResizeObserver
	);
	await flush();
}

/**
 * Lay a sheet out `height` px tall, for a case that works with a specific
 * element — a sheet nested in another sheet's content is not `getSheet()`.
 */
async function layOutSheet(
	observers: ResizeObserverRecord[],
	sheet: HTMLElement,
	height = 400
): Promise<void> {
	const observer = observers.find((instance) => instance.observed.has(sheet));
	observer?.callback([resizeEntry(height)], observer as unknown as ResizeObserver);
	await flush();
}

/** The primary pointer a case reports through `matchMedia`. */
function mockPrimaryPointer(pointer: 'fine' | 'coarse'): void {
	stubMatchMedia({ reduceMotion: false, pointer, matches: false });
}

/** A touch screen whose user asked for reduced motion. */
function mockReducedMotion(pointer: 'fine' | 'coarse'): void {
	// Ported from upstream's `stubReducedMotion`: the plain reduce query is true,
	// and the compound coarse query follows the pointer. `stubMatchMedia` cannot
	// express this — it answers the compound query from `reduceMotion` alone, so
	// it would report a coarse pointer on a fine one.
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches:
				query === '(prefers-reduced-motion: reduce)' ||
				(pointer === 'coarse' &&
					query === '(prefers-reduced-motion: reduce) and (pointer: coarse)'),
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		}))
	);
}

/** A browser with its own keyboard geometry API, as Chrome on Android has. */
function mockKeyboardGeometryApi(): void {
	// `navigator.userAgent` is brand-checked in Chromium: reading it through an
	// `Object.create(navigator)` stand-in throws `Illegal invocation`. jsdom
	// allows the prototype lookup upstream's helper relies on, so the fields the
	// hook reads are defined on the stand-in here.
	const navigatorMock = Object.create(window.navigator);
	Object.defineProperties(navigatorMock, {
		userAgent: { configurable: true, value: window.navigator.userAgent },
		maxTouchPoints: { configurable: true, value: window.navigator.maxTouchPoints },
		virtualKeyboard: { configurable: true, value: { overlaysContent: false } }
	});
	vi.stubGlobal('navigator', navigatorMock);
}

/**
 * End one of the sheet's transitions.
 *
 * Flushes first for the same reason `endTransform` does: the listener that
 * `waitForTransition` attaches lives in an effect, which has not run when a
 * synthetic event is dispatched in the same task as the state change.
 */
async function endTransition(propertyName: 'transform' | 'opacity'): Promise<void> {
	await flush();
	getSheet().dispatchEvent(new TransitionEvent('transitionend', { propertyName, bubbles: true }));
	await flush();
}

/**
 * A pointer event with a controlled `timeStamp`, which the velocity branch
 * reads. Constructed as a plain `Event` with the fields defined on it, as
 * upstream does — a real `PointerEvent` takes its timestamp from the clock.
 */
function fireTimedPointer(
	target: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	{ time, y }: { time: number; y: number }
): boolean {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		button: { value: 0 },
		clientY: { value: y },
		isPrimary: { value: true },
		pointerId: { value: 1 },
		timeStamp: { value: time }
	});
	return target.dispatchEvent(event);
}

/**
 * End the sheet's transform transition.
 *
 * Flushes first: React re-renders synchronously inside `fireEvent`, so upstream
 * can fire `transitionEnd` on the line after a release and the listener is
 * already attached. Here the effect that attaches it runs on the microtask
 * queue, and an event dispatched before that lands on nothing.
 */
async function endTransform(): Promise<void> {
	await flush();
	getSheet().dispatchEvent(
		new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true })
	);
	await flush();
}

/** Collect reconciliation frames instead of running them, so the intermediate
 * render stays visible to the assertions that follow. */
function holdAnimationFrames(): FrameRequestCallback[] {
	const frames: FrameRequestCallback[] = [];
	rafMock.mockImplementation((callback: FrameRequestCallback) => {
		frames.push(callback);
		return frames.length;
	});
	return frames;
}

async function runHeldFrames(frames: FrameRequestCallback[]): Promise<void> {
	frames.splice(0).forEach((frame) => frame(0));
	await flush();
}

function getPositioner(): HTMLElement {
	const positioner = getSheet().parentElement;
	if (!(positioner instanceof HTMLElement)) {
		throw new Error('sheet positioner not found');
	}
	return positioner;
}

function field(name: string): HTMLInputElement {
	const input = document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);
	if (!input) {
		throw new Error(`field ${name} not found`);
	}
	return input;
}

/**
 * Make a scroll the hook performs observable.
 *
 * Chromium ignores a `scrollTop` write on an element that does not overflow,
 * and it *has* `scrollBy`, so the hook takes the smooth-scroll branch where
 * jsdom sends it down the `scrollTop +=` fallback. Tracking both against one
 * value keeps upstream's assertion — how far the field moved — meaningful in
 * either browser.
 */
function trackScrollTop(element: HTMLElement): void {
	let scrollTop = 0;
	Object.defineProperty(element, 'scrollTop', {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		}
	});
}

function trackBodyScroll(body: HTMLElement): void {
	trackScrollTop(body);
	Object.defineProperty(body, 'scrollBy', {
		configurable: true,
		value: (options: ScrollToOptions) => {
			body.scrollTop += options.top ?? 0;
		}
	});
}

function mockIOSWebKit(): void {
	const navigatorMock = Object.create(window.navigator);
	Object.defineProperties(navigatorMock, {
		userAgent: {
			configurable: true,
			value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
		},
		maxTouchPoints: { configurable: true, value: 5 },
		// jsdom has no `vibrate`, so upstream's haptic tick is simply skipped
		// there. Chromium inherits a real one, and calling it on this stand-in
		// throws `Illegal invocation` — the mock is not a Navigator.
		vibrate: { configurable: true, value: () => true }
	});
	vi.stubGlobal('navigator', navigatorMock);
}

/** A blur naming where focus is going, which is how the hook sees a transition. */
function blurTo(from: HTMLElement, relatedTarget: HTMLElement | null): void {
	from.dispatchEvent(new FocusEvent('blur', { relatedTarget, bubbles: false }));
}

function closeButton(): HTMLButtonElement {
	const button = [...document.querySelectorAll('button')].find(
		(candidate) => candidate.textContent === 'Close sheet'
	);
	if (!button) {
		throw new Error('close button not found');
	}
	return button;
}

/**
 * Let Svelte apply what an event just changed.
 *
 * React's `fireEvent` flushes the render synchronously, so upstream reads the
 * DOM on the next line. A Svelte `$state` write lands on the microtask queue, so
 * every DOM assertion that follows a dispatched event waits for `tick()` first.
 * Assertions on a mock, which the handler calls synchronously, do not.
 */
async function flush(): Promise<void> {
	await tick();
}

/**
 * Dispatch a keydown and report whether it was claimed.
 *
 * `isComposing` and `keyCode` are defined rather than passed in the init
 * dictionary: Chromium ignores the legacy `keyCode` there, and the IME guard
 * reads both signals.
 */
function press(
	target: Element,
	key: string,
	init: { isComposing?: boolean; keyCode?: number } = {}
): boolean {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	if (init.isComposing) {
		Object.defineProperty(event, 'isComposing', { value: true });
	}
	if (init.keyCode != null) {
		Object.defineProperty(event, 'keyCode', { value: init.keyCode });
	}
	return target.dispatchEvent(event);
}

function click(target: Element): void {
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('BottomSheet', () => {
	it('renders children when open and applies the accessible label', async () => {
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange: () => {},
				label: 'Filters',
				children: text('Sheet content')
			}
		});
		const dialog = getDialog();
		expect(dialog).toBeInTheDocument();
		expect(dialog).toHaveAccessibleName('Filters');
		expect(dialog.textContent).toContain('Sheet content');
	});

	it('forwards DOM props and refs to the visual panel, not the dialog host', async () => {
		const attached: (HTMLElement | null)[] = [];
		const onclick = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange: () => {},
				label: 'Filters',
				'data-testid': 'filters-panel',
				'data-sheet-owner': 'search',
				class: 'custom-panel',
				onclick,
				children: text('Content'),
				[createAttachmentKey()]: (node: HTMLElement) => {
					attached.push(node);
				}
			}
		});

		const panel = document.querySelector<HTMLElement>('[data-testid="filters-panel"]')!;
		const dialog = getDialog();
		expect(attached).toEqual([panel]);
		expect(panel.tagName).toBe('DIV');
		expect(panel.classList.contains('astryx-bottom-sheet')).toBe(true);
		expect(panel.classList.contains('custom-panel')).toBe(true);
		expect(panel.getAttribute('data-sheet-owner')).toBe('search');
		expect(dialog.hasAttribute('data-testid')).toBe(false);

		click(panel);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('keeps consumer content first and last inside the observed content box', async () => {
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange: () => {},
				label: 'Filters',
				children: html('<div data-testid="consumer-content">Sheet content</div>')
			}
		});
		const body = getBody();
		const consumer = document.querySelector('[data-testid="consumer-content"]')!;

		expect(body.children).toHaveLength(1);
		const content = body.lastElementChild;
		expect(content).toHaveAttribute('data-scroll-content');
		expect(content?.lastElementChild).toBe(consumer);
		expect(consumer.matches(':first-child')).toBe(true);
		expect(consumer.matches(':last-child')).toBe(true);
	});

	it('does not show when isOpen is false', async () => {
		await render(BottomSheet, {
			props: {
				isOpen: false,
				onOpenChange: () => {},
				label: 'Filters',
				children: text('Hidden')
			}
		});
		expect(dialogPrototype.showModal).not.toHaveBeenCalled();
	});

	it('opens modally (showModal + aria-modal)', async () => {
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange: () => {},
				label: 'Filters',
				children: text('Content')
			}
		});
		expect(dialogPrototype.showModal).toHaveBeenCalled();
		expect(getDialog().getAttribute('aria-modal')).toBe('true');
	});

	it('requests close on Escape', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: { isOpen: true, onOpenChange, label: 'Filters', children: text('Content') }
		});
		press(getDialog(), 'Escape');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('ignores Escape while an IME composition is active', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange,
				label: 'Filters',
				children: html('<input aria-label="Search" />')
			}
		});
		const dialog = getDialog();

		press(dialog, 'Escape', { isComposing: true });
		press(dialog, 'Escape', { keyCode: 229 });

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('claims the composing Escape so no native close request follows', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange,
				label: 'Filters',
				children: html('<input aria-label="Search" />')
			}
		});

		// An unclaimed Escape lets the browser raise its own close request, which
		// arrives as `cancel` and dismisses the sheet on the same keypress. The
		// guard has to swallow the composing Escape, not merely skip dismissal.
		const wasNotClaimed = press(getDialog(), 'Escape', { isComposing: true });

		expect(wasNotClaimed).toBe(false);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('keeps a form sheet open when Escape cancels a field composition', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				purpose: 'form',
				onOpenChange,
				label: 'Edit profile',
				children: html('<input aria-label="Name" />')
			}
		});

		// The reported path: the keydown starts at the composing field and bubbles
		// to the sheet's <dialog>, so the guard has to survive the trip.
		press(field('Name'), 'Escape', { isComposing: true });

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('still dismisses on the Escape after a composition is cancelled', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange,
				label: 'Filters',
				children: html('<input aria-label="Search" />')
			}
		});
		const dialog = getDialog();

		press(dialog, 'Escape', { isComposing: true });
		expect(onOpenChange).not.toHaveBeenCalled();

		press(dialog, 'Escape');

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('leaves the IME the composition keys that are not Escape', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				onOpenChange,
				label: 'Filters',
				children: html('<input aria-label="Search" />')
			}
		});
		const dialog = getDialog();

		// Enter commits a candidate and the arrows walk the candidate window. The
		// sheet must claim neither, or the IME loses keys it owns.
		const enterUnclaimed = press(dialog, 'Enter', { isComposing: true });
		const arrowUnclaimed = press(dialog, 'ArrowDown', { isComposing: true });

		expect(enterUnclaimed).toBe(true);
		expect(arrowUnclaimed).toBe(true);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("the internal Escape gate (Popover's sheet) blocks Escape and the close request, not the scrim or swipe", async () => {
		const onOpenChange = vi.fn();
		await render(EscapeGateHarness, {
			props: { isOpen: true, onOpenChange, children: text('Content') }
		});
		const dialog = getDialog();

		press(dialog, 'Escape');
		dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		expect(onOpenChange).not.toHaveBeenCalled();

		click(dialog);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }]);
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
	});

	it('stays open when a file picker inside it is dismissed, and still closes on its own close request', async () => {
		// A file input fires a bubbling `cancel` at itself when its picker is
		// dismissed. It reaches the <dialog> like a close request but is not one.
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				purpose: 'form',
				onOpenChange,
				label: 'Upload',
				children: html('<input type="file" aria-label="Picture" />')
			}
		});

		const fromPicker = new Event('cancel', { bubbles: true, cancelable: true });
		field('Picture').dispatchEvent(fromPicker);

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(fromPicker.defaultPrevented).toBe(false);

		getDialog().dispatchEvent(new Event('cancel', { cancelable: true }));

		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('requests close when the scrim (dialog element itself) is clicked', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: { isOpen: true, onOpenChange, label: 'Filters', children: text('Content') }
		});
		click(getDialog());
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('purpose=form blocks scrim and swipe dismissal but allows Escape', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				purpose: 'form',
				onOpenChange,
				label: 'Edit profile',
				children: text('Content')
			}
		});
		const dialog = getDialog();

		click(dialog);
		drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }]);

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(dialog.style.getPropertyValue('--_sheet-scrim-opacity')).toBe('1');

		press(dialog, 'Escape');
		dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
		expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
	});

	it('purpose=required blocks every implicit dismissal path', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: {
				isOpen: true,
				purpose: 'required',
				onOpenChange,
				label: 'Required action',
				children: text('Content')
			}
		});
		const dialog = getDialog();
		expect(dialog.getAttribute('role')).toBe('alertdialog');

		click(dialog);
		press(dialog, 'Escape');
		dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }]);

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(dialog.style.getPropertyValue('--_sheet-scrim-opacity')).toBe('1');
	});

	it('keeps a standalone modal sheet presented through its exit animation', async () => {
		await render(ExitHarness, { props: {} });
		const dialog = getDialog();

		click(closeButton());
		await vi.waitFor(() => expect(dialog.hasAttribute('inert')).toBe(true));

		expect(dialog).toHaveAttribute('open');
		expect(dialog).toHaveAttribute('aria-hidden', 'true');
		expect(dialog.hasAttribute('aria-modal')).toBe(false);
		expect(dialog.style.getPropertyValue('--_sheet-scrim-opacity')).toBe('0');
		expect(document.body.style.position).toBe('fixed');

		finishSheetExit();
		await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));

		expect(document.body.style.position).not.toBe('fixed');
	});

	it('does not dismiss when the sheet surface itself is clicked', async () => {
		const onOpenChange = vi.fn();
		await render(BottomSheet, {
			props: { isOpen: true, onOpenChange, label: 'Filters', children: text('Content') }
		});
		// Only a click that lands on the dialog (the transparent area) dismisses;
		// clicks bubbling up from the sheet must not.
		click(getSheet());
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	describe('hasScrim={false} (non-modal)', () => {
		it('opens non-modally: show() instead of showModal(), no aria-modal', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					hasScrim: false,
					children: text('Content')
				}
			});
			expect(dialogPrototype.show).toHaveBeenCalled();
			expect(dialogPrototype.showModal).not.toHaveBeenCalled();
			expect(getDialog().hasAttribute('aria-modal')).toBe(false);
		});

		it('leaves focus on the first control, as show() did, in an engine whose show() skips the panel container', async () => {
			// Firefox's `show()` and `showPopover()` both land on the first
			// control in the sheet. Nothing is re-targeted, so a lone non-modal
			// sheet focuses as it did with `show()` there too.
			const show = dialogPrototype.show;
			dialogPrototype.show = vi.fn(function (this: HTMLDialogElement) {
				this.setAttribute('open', '');
				this.querySelector<HTMLElement>('button')?.focus();
			});
			try {
				const opener = document.createElement('button');
				document.body.append(opener);
				opener.focus();
				await render(BottomSheet, {
					props: {
						isOpen: true,
						onOpenChange: () => {},
						label: 'Filters',
						hasScrim: false,
						children: html('<button type="button">First action</button>')
					}
				});
				expect(document.activeElement?.textContent).toBe('First action');
				expect(getSheet().hasAttribute('autofocus')).toBe(false);
				opener.remove();
			} finally {
				dialogPrototype.show = show;
			}
		});

		it('returns focus to its opener on close when the person was still in the sheet', async () => {
			const opener = document.createElement('button');
			opener.textContent = 'Open';
			document.body.append(opener);
			opener.focus();
			try {
				await render(ExitHarness, { props: { hasScrim: false } });
				// The person moved into the sheet (e.g. tabbed to its control).
				closeButton().focus();
				press(getDialog(), 'Escape');
				await endTransform();
				expect(getDialog().hasAttribute('open')).toBe(false);
				expect(document.activeElement).toBe(opener);
			} finally {
				opener.remove();
			}
		});

		it('leaves focus where the person took it when the sheet closes from the page', async () => {
			const opener = document.createElement('button');
			const elsewhere = document.createElement('input');
			document.body.append(opener, elsewhere);
			opener.focus();
			try {
				await render(ExitHarness, { props: { hasScrim: false } });
				// The page stayed live: the person moved on, then the sheet closed
				// (a timer, a page control).
				elsewhere.focus();
				click(closeButton());
				await endTransform();
				expect(document.activeElement).toBe(elsewhere);
			} finally {
				opener.remove();
				elsewhere.remove();
			}
		});

		it('leaves focus alone when the browser does not move it on show', async () => {
			const opener = document.createElement('button');
			document.body.append(opener);
			opener.focus();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					hasScrim: false,
					children: html('<button type="button">First action</button>')
				}
			});
			expect(document.activeElement).toBe(opener);
			opener.remove();
		});

		it('does not dismiss when the shell (dialog element itself) is clicked', async () => {
			// No scrim: a tap on the transparent shell must pass through to the
			// page, not dismiss the sheet.
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange,
					label: 'Filters',
					hasScrim: false,
					children: text('Content')
				}
			});
			click(getDialog());
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it('still closes on Escape while focus is inside', async () => {
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange,
					label: 'Filters',
					hasScrim: false,
					children: text('Content')
				}
			});
			press(getDialog(), 'Escape');
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		it('ignores Escape while an IME composition is active', async () => {
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					hasScrim: false,
					onOpenChange,
					label: 'Filters',
					children: html('<input aria-label="Search" />')
				}
			});

			// Escape is this sheet's only keyboard route out — there is no native
			// close request behind it — so the guard is all that stands between a
			// composing CJK user and a dismissed sheet.
			press(getDialog(), 'Escape', { isComposing: true });

			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it('still dismisses on a downward swipe past the threshold', async () => {
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange,
					label: 'Filters',
					hasScrim: false,
					children: text('Content')
				}
			});
			drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }]);
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		it('does not steal focus onto the panel on open', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					hasScrim: false,
					children: html('<button type="button">First action</button>')
				}
			});
			// The background stays interactive, so the sheet must not grab focus.
			expect(document.activeElement).not.toBe(getSheet());
		});

		it('still honors a descendant with data-autofocus', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					hasScrim: false,
					children: html('<input data-autofocus aria-label="Search" />')
				}
			});
			expect(document.activeElement).toBe(document.querySelector('input[data-autofocus]'));
		});

		it('keeps a standalone non-modal sheet visible until its exit ends', async () => {
			await render(ExitHarness, { props: { hasScrim: false } });
			const dialog = getDialog();

			click(closeButton());
			await vi.waitFor(() => expect(dialog.hasAttribute('inert')).toBe(true));

			expect(dialog).toHaveAttribute('open');
			expect(document.body.style.position).not.toBe('fixed');

			finishSheetExit();
			await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
		});
	});

	describe('grab handle', () => {
		it('renders a decorative handle hidden from assistive tech', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					children: text('Content')
				}
			});
			expect(getHandle()).toHaveAttribute('aria-hidden', 'true');
		});
	});

	describe('height', () => {
		it('renders for each named height without error', async () => {
			for (const height of ['hug', 'capped', 'tall'] as const) {
				const screen = await render(BottomSheet, {
					props: {
						isOpen: true,
						onOpenChange: () => {},
						label: 'Filters',
						height,
						children: text('Content')
					}
				});
				expect(getDialog()).toBeInTheDocument();
				screen.unmount();
			}
		});

		it('accepts a freeform height (number or CSS length)', async () => {
			for (const height of [480, '70dvh'] as const) {
				const screen = await render(BottomSheet, {
					props: {
						isOpen: true,
						onOpenChange: () => {},
						label: 'Filters',
						height,
						children: text('Content')
					}
				});
				expect(getDialog()).toBeInTheDocument();
				screen.unmount();
			}
		});

		it('keeps the full layout height at the peek detent', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// Settle on the shortest 112px peek: offset 736 - 112 = 624.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 600 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 600 });
			await endTransform();

			// A glance state does not reflow the content into a sliver: the sheet
			// keeps its full layout height and slides below the viewport instead.
			expect(sheet.style.height).toBe('');
			expect(sheet.style.transform).toBe('translateY(624px)');
			expect(getBody().style.paddingBlockEnd).toBe('');

			// Dragging back up off the peek stays transform-only for the same
			// reason — there is no shortened layout to restore first.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 600 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 400 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(424px)');
			expect(sheet.style.height).toBe('784px');
			expect(getBody().style.paddingBlockEnd).toBe('');

			// Releasing at the taller p50 detent resizes the scrolling area.
			fireTimedPointer(getHandle(), 'pointerup', { time: 5000, y: 400 });
			await endTransform();
			expect(sheet.style.height).toBe('448px');
			expect(sheet.style.transform).toBe('');
		});

		it('swaps height for transform without a transition when released on a detent', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// The magnetise step lands a slow drag exactly on the p50 detent
			// (offset 336), so the release has no travel left to animate and
			// reconciles at once.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 336 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(336px)');
			expect(sheet.style.height).toBe('784px');

			const frames = holdAnimationFrames();
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 336 });
			await flush();

			// Height and transform swap roles in this one render. That is only
			// invisible with transitions off; live, the composited transform would
			// animate the whole 336px swap while the height jumped, and the sheet
			// would lurch away from the detent before coming back to it.
			expect(sheet.style.height).toBe('448px');
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.transition).toBe('none');

			// Transitions come back for the next gesture.
			await runHeldFrames(frames);
			expect(sheet.style.transition).toBe('');
		});

		it("rests at the detent's height when the finger lifts in the same task as the move that crossed it", async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// Rest on p50 (offset 336) with the 336px layout split.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 336 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 336 });
			await flush();
			expect(sheet.style.height).toBe('448px');
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 336 });

			// A 3px nudge up crosses the detent, and the finger lifts before the
			// render that move scheduled has committed. Both are dispatched in one
			// task and the DOM is flushed once afterwards; a Svelte update is a
			// microtask, so the React claim about a pending render has no
			// counterpart, while the release's use of the crossing move does.
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 333 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 4500, y: 333 });
			await flush();

			// At rest it is drawn at p50 again: the split height, no offset, and no
			// end inset left over from the drag.
			expect(sheet.style.height).toBe('448px');
			expect(sheet.style.transform).toBe('');
			expect(getBody().style.paddingBlockEnd).toBe('');
		});

		describe('with a caller-set height', () => {
			// Rests on p50 (offset 336), presses the handle again, and returns the
			// sheet. Upstream delivers events outside `act()` so a React render is
			// still pending when each input task ends; Svelte's update is a
			// microtask, so each dispatch is followed by `flush()` before the
			// height is read.
			async function restOnHalfWithCallerHeight() {
				const observers = mockResizeObserverInstances();
				mockVisualViewport(800);
				mockWindowHeight(800);
				await render(BottomSheet, {
					props: {
						isOpen: true,
						onOpenChange: () => {},
						label: 'Release notes',
						snapPoints: SNAP_POINTS,
						height: 'tall',
						style: 'height: 500px',
						children: text('Content')
					}
				});
				const sheet = getSheet();
				await measureSheet(observers, 784, 736);
				fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
				fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 336 });
				fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 336 });
				await flush();
				fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 336 });
				return { sheet };
			}

			it('keeps the caller height through a drag across the detent and back', async () => {
				const { sheet } = await restOnHalfWithCallerHeight();
				expect(sheet.style.height).toBe('500px');

				const heights: string[] = [];
				fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 136 });
				await flush();
				heights.push(sheet.style.height);
				fireTimedPointer(getHandle(), 'pointermove', { time: 5000, y: 436 });
				await flush();
				heights.push(sheet.style.height);
				fireTimedPointer(getHandle(), 'pointerup', { time: 6000, y: 336 });
				await flush();

				// The caller's height owns the element: the crossing writes only the
				// transform and the end inset, and nothing replaces the height after.
				expect(heights).toEqual(['500px', '500px']);
				expect(sheet.style.height).toBe('500px');
			});

			it('keeps the caller height when the finger lifts in the same task as the crossing move', async () => {
				const { sheet } = await restOnHalfWithCallerHeight();

				fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 333 });
				await flush();
				const heightAboveDetent = sheet.style.height;
				fireTimedPointer(getHandle(), 'pointerup', { time: 4500, y: 333 });
				await flush();

				expect(heightAboveDetent).toBe('500px');
				expect(sheet.style.height).toBe('500px');
			});
		});

		it('uses transforms while dragging and resizes to the visible snapped height', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			// A Tall sheet has 736px visible height in this 800px viewport plus the
			// 48px border-box reserve held below the viewport.
			await measureSheet(observers, 784, 736);

			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 240 });
			await flush();

			expect(sheet.style.transform).toBe('translateY(240px)');
			expect(sheet.style.height).toBe('784px');
			expect(sheet.style.transition).toBe('none');

			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 240 });
			await flush();
			// Release remains transform-only until the snap finishes.
			// p50 is a visible 400px sheet: 784 - 48 - 400 = 336px offset.
			expect(sheet.style.transform).toBe('translateY(336px)');
			expect(sheet.style.height).toBe('784px');
			expect(sheet.style.transition).toBe('');

			const frames = holdAnimationFrames();
			await endTransform();
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('448px');
			// The transform reset is transition-free so it cannot produce a second
			// fly-in animation after the snap has already reached its destination.
			expect(sheet.style.transition).toBe('none');
			expect(frames.length).toBeGreaterThan(0);
			await runHeldFrames(frames);
			expect(sheet.style.transition).toBe('');

			// Ignore ResizeObserver frames from the height reconciliation. The next
			// drag must still use the original 784px border-box height.
			await measureSheet(observers, 500, 452);
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 240 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 140 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(236px)');
			expect(sheet.style.height).toBe('784px');
			expect(getBody().style.paddingBlockEnd).toBe('336px');

			// Reversing below the settled point restores the settled height and
			// translates only the distance travelled from that detent. The temporary
			// scroll-preservation inset leaves with the temporary expanded layout.
			fireTimedPointer(getHandle(), 'pointermove', { time: 5000, y: 340 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(100px)');
			expect(sheet.style.height).toBe('448px');
			expect(getBody().style.paddingBlockEnd).toBe('');
		});

		it('reconciles the snapped height immediately when transitions are disabled', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					style: 'transition: none',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 240 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 240 });
			await flush();

			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('448px');
		});

		it('restores the maximum height before an upward drag and reconciles at snap', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// Start at the middle 400px detent.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 240 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 240 });
			await endTransform();
			expect(sheet.style.height).toBe('448px');

			// The upward gesture renders the full 784px surface below the viewport
			// and translates it to preserve the visible top edge.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 240 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 0 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(96px)');
			expect(sheet.style.height).toBe('784px');
			expect(getBody().style.paddingBlockEnd).toBe('336px');

			// Release first animates only the transform, keeping the source layout
			// and scroll range fixed for the entire snap.
			fireTimedPointer(getHandle(), 'pointerup', { time: 5000, y: 0 });
			await flush();
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('784px');
			expect(getBody().style.paddingBlockEnd).toBe('336px');

			// At transition end, height and preservation spacing reconcile in one
			// render with the same visible geometry.
			await endTransform();
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('');
			expect(getBody().style.paddingBlockEnd).toBe('336px');

			// Once ordinary scrolling brings the content back within its natural
			// range, the retained end padding is no longer needed and is discarded.
			const body = getBody();
			Object.defineProperties(body, {
				clientHeight: { configurable: true, value: 600 },
				scrollHeight: { configurable: true, value: 1000 },
				scrollTop: { configurable: true, value: 64, writable: true }
			});
			body.dispatchEvent(new Event('scroll'));
			await flush();
			expect(body.style.paddingBlockEnd).toBe('');
		});

		it('keeps the settled height stable while dismissing', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(ExitHarness, { props: { snapPoints: SNAP_POINTS } });
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// First settle at the middle detent.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 240 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 240 });
			await endTransform();
			expect(sheet.style.height).toBe('448px');

			// A later dismiss stays transform-only and preserves that settled
			// scroll-area height throughout the exit.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 240 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 1000 });
			await flush();
			expect(sheet.style.transform).toBe('translateY(760px)');
			expect(sheet.style.height).toBe('448px');
			fireTimedPointer(getHandle(), 'pointerup', { time: 5000, y: 1000 });
			await flush();
			expect(sheet.style.height).toBe('448px');

			await measureSheet(observers, 200, 152);
			expect(sheet.style.height).toBe('448px');
		});

		it('re-resolves the settled detent when the window resizes', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			// Settle on the half-height detent: 784 - 48 - 400 = 336px of travel.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 336 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 336 });
			const frames = holdAnimationFrames();
			await endTransform();
			await runHeldFrames(frames);
			// 448px of layout height shows 400px of sheet: half the 800px window.
			expect(sheet.style.height).toBe('448px');

			// Shrink the window. The sheet's budget is `92dvh`, so its border box
			// follows: 0.92 * 600 + the 48px reserve = 600px.
			vi.spyOn(sheet, 'getBoundingClientRect').mockImplementation(() =>
				rect({
					top: 0,
					bottom: sheet.style.height ? Number.parseFloat(sheet.style.height) : 600
				})
			);
			mockWindowHeight(600);
			window.dispatchEvent(new Event('resize'));
			await flush();

			// Still the half-height detent, re-resolved against the new window:
			// 348px of layout height shows 300px, half of 600. Before this, the
			// sheet kept its 448px and showed 400px — three quarters of the window.
			expect(sheet.style.height).toBe('348px');
			expect(sheet.style.transform).toBe('');
			// Re-anchoring is not a gesture, so it does not animate.
			expect(sheet.style.transition).toBe('none');
			await runHeldFrames(frames);
			expect(sheet.style.transition).toBe('');
		});

		it('keeps its detents when the keyboard shrinks the visual viewport', async () => {
			const observers = mockResizeObserverInstances();
			const viewport = mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Release notes',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			await measureSheet(observers, 784, 736);

			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 336 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 336 });
			await endTransform();
			expect(sheet.style.height).toBe('448px');

			// The keyboard opens: the visual viewport shrinks, the layout viewport
			// the sheet is measured in does not.
			viewport.height = 500;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(sheet.style.height).toBe('448px');

			// The next drag still snaps to the window's detents, not to fractions of
			// the space the keyboard left over.
			fireTimedPointer(getHandle(), 'pointerdown', { time: 3000, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 4000, y: 288 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 5000, y: 288 });
			await flush();
			// The peek of an 800px window: 736 - 112 = 624px of travel.
			expect(sheet.style.transform).toBe('translateY(624px)');
		});
	});

	describe('mobile keyboard', () => {
		it('claims a transition between fields and delivers it with preventScroll', async () => {
			mockIOSWebKit();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<div><input aria-label="Title" /><input aria-label="Comment" /></div>')
				}
			});
			const title = field('Title');
			const comment = field('Comment');
			title.focus();
			const focus = vi.spyOn(comment, 'focus');

			// The keyboard's Next, Tab, and a programmatic focus() all arrive as this
			// one transition, named by relatedTarget on the outgoing blur.
			blurTo(title, comment);

			// Delivered by us, with the browser's reveal refused.
			expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		});

		it('does not park focus on a sheet that is closing', async () => {
			mockIOSWebKit();
			const props = (isOpen: boolean) => ({
				isOpen,
				onOpenChange: () => {},
				label: 'Add a comment',
				height: 'tall' as const,
				children: html('<input aria-label="Comment" />')
			});
			const view = await render(BottomSheet, { props: props(true) });
			const sheet = getSheet();
			field('Comment').focus();
			const sheetFocus = vi.spyOn(sheet, 'focus');

			// Closing blurs the field as well, and that blur names no destination —
			// the same shape as Done. There is no next tap to keep claimable here,
			// and the host is about to hand focus back to whatever opened the sheet.
			await view.rerender(props(false));
			await flush();

			expect(sheetFocus).not.toHaveBeenCalled();
		});

		it('autofocuses a field without letting the browser reveal it', async () => {
			mockIOSWebKit();
			const focus = vi.spyOn(HTMLInputElement.prototype, 'focus');
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" data-autofocus />')
				}
			});
			// A prototype spy outlives this case unless it is put back by hand.
			const calls = [...focus.mock.calls];
			focus.mockRestore();

			// Opening focuses the field itself, so there is no transition to claim —
			// nothing was focused to blur. The presenting call has to refuse the
			// reveal on its own, or the browser scrolls the page to show a field the
			// sheet was about to show anyway.
			expect(document.activeElement).toBe(field('Comment'));
			expect(calls).toContainEqual([{ preventScroll: true }]);
		});

		it('parks focus on the sheet when the keyboard Done button takes it', async () => {
			mockIOSWebKit();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const sheet = getSheet();
			const input = field('Comment');
			input.focus();
			const sheetFocus = vi.spyOn(sheet, 'focus');

			// Done dismisses the keyboard and drops focus on the body. Left there,
			// the field is still document.activeElement on the next tap, so no
			// transition fires and the browser reveals it its own way. Parking focus
			// on the sheet keeps the next tap a transition this hook can claim.
			blurTo(input, null);

			expect(sheetFocus).toHaveBeenCalledWith({ preventScroll: true });
		});

		it('does not alter ordinary desktop focus when the viewport is unobstructed', async () => {
			mockVisualViewport(800);
			mockWindowHeight(800);
			const onFocus = vi.fn();
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const input = field('Comment');
			// Upstream passes `onFocus` as a JSX prop on the child. The children here
			// are a snippet of markup, so the listener is attached to the same node
			// instead — the assertion is about what reaches the field either way.
			input.addEventListener('focus', onFocus);
			const focus = vi.spyOn(input, 'focus');

			input.focus();
			await flush();

			expect(focus).not.toHaveBeenCalledWith({ preventScroll: true });
			expect(onFocus).toHaveBeenCalledTimes(1);
			expect(getBody().style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('lays out no keyboard room when the body overhangs the viewport by a fraction of a pixel', async () => {
			// On Chrome for Android, the visual viewport can be 0.3 px taller than
			// the layout viewport. A sheet sized to it ends that far below it.
			mockIOSWebKit();
			mockWindowHeight(800);
			mockVisualViewport(800.3);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800.3 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 700, bottom: 740 }));

			input.focus();
			await flush();

			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('scrolls nothing for a field in the bottom clearance band when the body overhangs the viewport by a fraction of a pixel', async () => {
			// Chrome on Android: the visual viewport can be 0.3 px taller than the
			// layout viewport. With no keyboard up, a field in the sheet's bottom
			// 48 px is already visible: the suggestion clearance is for a keyboard.
			mockIOSWebKit();
			mockWindowHeight(800);
			mockVisualViewport(800.3);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800.3 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 760, bottom: 790 }));
			const scrollBy = vi.fn();
			Object.defineProperty(body, 'scrollBy', { configurable: true, value: scrollBy });

			input.focus();
			await flush();

			expect(scrollBy).not.toHaveBeenCalled();
			expect(body.scrollTop).toBe(0);
		});

		it('keeps Tall geometry fixed while extending and cleaning up its internal scroll range', async () => {
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const sheet = getSheet();
			const positioner = getPositioner();
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 800 }));
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);

			const initialRect = sheet.getBoundingClientRect();

			input.focus();
			await flush();

			expect(sheet.getBoundingClientRect()).toEqual(initialRect);
			expect(sheet.style.height).toBe('');
			expect(sheet.style.getPropertyValue('--_sheet-budget')).toBe('92dvh');
			expect(positioner.style.getPropertyValue('--_sheet-keyboard-lift')).toBe('');
			// 300px keyboard overlap + 48px room for Android suggestion UI.
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');
			// Visible bottom is 500px; preserve the same 48px focus gap.
			expect(body.scrollTop).toBe(248);

			viewport.height = 800;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
			expect(sheet.getBoundingClientRect()).toEqual(initialRect);
			expect(sheet.style.height).toBe('');
		});

		it('smoothly scrolls a focused Tall control above the keyboard', async () => {
			mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackScrollTop(body);
			const scrollBy = vi.fn((options: ScrollToOptions) => {
				body.scrollTop += options.top ?? 0;
			});
			Object.defineProperty(body, 'scrollBy', { configurable: true, value: scrollBy });
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);

			input.focus();
			await flush();

			expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: 'smooth' });
		});

		it('does not accommodate the keyboard at a shorter Tall detent', async () => {
			mockIOSWebKit();
			const observers = mockResizeObserverInstances();
			const viewport = mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					snapPoints: SNAP_POINTS,
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const sheet = getSheet();
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			await measureSheet(observers, 784);

			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 240 });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y: 240 });
			await endTransform();
			// Settled at the p50 detent: 400px of visible sheet plus the 48px
			// border-box reserve held below the viewport.
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('448px');

			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 500, bottom: 1200 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 700, bottom: 740 }));
			viewport.height = 500;
			const focus = vi.spyOn(input, 'focus');
			// A transition the browser would drive: at a shorter detent the hook must
			// not claim it, so nothing focuses the field but the caller.
			blurTo(sheet, input);
			expect(focus).not.toHaveBeenCalled();

			focus.mockRestore();
			input.focus();
			viewport.dispatchEvent(new Event('resize'));
			await flush();

			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
			expect(body.scrollTop).toBe(0);
			// The keyboard moved nothing: the sheet still rests at that detent.
			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('448px');
		});

		it.each([
			['Hug', 'hug'],
			['Capped', 'capped'],
			['numeric', 480],
			['custom CSS', '70dvh']
		] as const)('does not add keyboard behavior to a %s height', async (_label, height) => {
			mockIOSWebKit();
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height,
					children: html('<input aria-label="Comment" />')
				}
			});
			const sheet = getSheet();
			const positioner = getPositioner();
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			const focus = vi.spyOn(input, 'focus');
			const sheetFocus = vi.spyOn(sheet, 'focus');
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 400, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 700, bottom: 740 }));
			body.scrollTop = 20;

			input.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
			// These heights opt out, so a browser-driven transition is left alone.
			blurTo(sheet, input);
			input.dispatchEvent(
				new PointerEvent('pointerdown', { pointerId: 1, clientY: 200, bubbles: true })
			);
			body.scrollTop = 120;
			input.dispatchEvent(new FocusEvent('focus', { relatedTarget: null }));
			viewport.dispatchEvent(new Event('resize'));
			await flush();

			expect(body.scrollTop).toBe(120);
			expect(focus).not.toHaveBeenCalled();
			expect(sheetFocus).not.toHaveBeenCalled();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('');
			expect(positioner.style.getPropertyValue('--_sheet-keyboard-lift')).toBe('');
			expect(sheet.style.height).toBe('');
		});

		it.each([
			['standalone no-scrim', 'standalone', false],
			['modal switcher', 'switcher', true],
			['no-scrim switcher', 'switcher', false]
		] as const)(
			'supports Tall internal keyboard scrolling in a %s presentation',
			async (_label, host, hasScrim) => {
				mockVisualViewport(500);
				const view =
					host === 'standalone'
						? await render(BottomSheet, {
								props: {
									isOpen: true,
									onOpenChange: () => {},
									label: 'Add a comment',
									height: 'tall',
									hasScrim,
									children: html('<input aria-label="Comment" />')
								}
							})
						: await render(SwitcherHarness, {
								props: {
									activeSheet: 'comment',
									hasScrim,
									first: html('<input aria-label="Comment" />')
								}
							});
				const body = getBody();
				const input = field('Comment');
				trackBodyScroll(body);
				vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
				vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
					rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
				);

				input.focus();
				await flush();

				expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');
				expect(body.scrollTop).toBe(248);
				view.unmount();
			}
		);

		it('re-reveals a focused Tall control when content layout changes', async () => {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			let layoutShift = 0;
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({
					top: 660 + layoutShift - body.scrollTop,
					bottom: 700 + layoutShift - body.scrollTop
				})
			);

			input.focus();
			await flush();
			expect(body.scrollTop).toBe(248);

			layoutShift = 200;
			const observer = observers.find((instance) => instance.observed.has(input));
			expect(observer).toBeDefined();
			observer?.callback([], observer as unknown as ResizeObserver);
			await flush();

			expect(body.scrollTop).toBe(448);
		});

		it('retains Tall keyboard scroll space during travel until the viewport recovers', async () => {
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const sheet = getSheet();
			const positioner = getPositioner();
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, bottom: 800 }));
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);

			input.focus();
			await flush();
			expect(body.scrollTop).toBe(248);
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			const pointerDownAllowed = fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			expect(pointerDownAllowed).toBe(false);
			expect(document.activeElement).toBe(input);

			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y: 40 });
			await flush();

			expect(document.activeElement).toBe(sheet);
			expect(positioner.style.getPropertyValue('--_sheet-keyboard-lift')).toBe('');
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');
			expect(body.scrollTop).toBe(248);

			viewport.height = 800;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('retains Tall keyboard scroll space after blur until the viewport recovers', async () => {
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);
			input.focus();
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			input.blur();
			await flush();

			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			viewport.height = 800;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('blurs the focused Tall field and retains its inset until the viewport recovers', async () => {
			const viewport = mockVisualViewport(500);
			const onOpenChange = vi.fn();
			const props = (isOpen: boolean) => ({
				isOpen,
				onOpenChange,
				label: 'Add a comment',
				height: 'tall' as const,
				children: html('<input aria-label="Comment" />')
			});
			const view = await render(BottomSheet, { props: props(true) });
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);
			input.focus();
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			await view.rerender(props(false));
			await flush();

			expect(document.activeElement).not.toBe(input);
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			viewport.height = 800;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('retains Tall keyboard scroll space through a switcher handoff until the viewport recovers', async () => {
			const viewport = mockVisualViewport(500);
			const props = (activeSheet: string) => ({
				activeSheet,
				onActiveSheetChange: () => {},
				first: html('<input aria-label="Comment" />'),
				second: text('Confirmation')
			});
			const view = await render(SwitcherHarness, { props: props('comment') });
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);
			input.focus();
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			await view.rerender(props('confirmation'));
			await flush();

			expect(document.activeElement).not.toBe(input);
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');

			viewport.height = 800;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
		});

		it('does not add clearance or scroll when the viewport is unobstructed', async () => {
			mockVisualViewport(800);
			mockWindowHeight(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 760, bottom: 790 }));

			input.focus();
			await flush();

			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
			expect(body.scrollTop).toBe(0);
		});

		it('puts back a document scroll the browser makes to reveal a field', async () => {
			mockVisualViewport(377);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 57, bottom: 714 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 600 - body.scrollTop, bottom: 640 - body.scrollTop })
			);
			input.focus();
			await flush();
			const scrollTo = vi.mocked(window.scrollTo);
			scrollTo.mockClear();
			const scrolledBy = body.scrollTop;

			// The page numbers an iPhone 17 produces when the browser reveals a
			// focused field in a scroll-locked, fixed sheet: it scrolls the DOCUMENT,
			// and the sheet — fixed — travels with it.
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 337 });
			window.dispatchEvent(new Event('scroll'));
			await flush();

			expect(scrollTo).toHaveBeenCalledWith(0, 0);
			// …and the control is still inside the safe area afterwards: the sheet's
			// own scroller holds it there, so putting the document back does not hide
			// what the browser was trying to reveal.
			expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(377 - 48);
			expect(body.scrollTop).toBe(scrolledBy);
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
		});

		it('puts back only the page\u2019s own scroll, never an element\u2019s scroll that reaches the window', async () => {
			mockVisualViewport(377);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 57, bottom: 714 }));
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 600 - body.scrollTop, bottom: 640 - body.scrollTop })
			);
			input.focus();
			await flush();
			const scrollTo = vi.mocked(window.scrollTo);
			scrollTo.mockClear();
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 337 });
			try {
				body.dispatchEvent(new Event('scroll'));
				await flush();
				expect(scrollTo).not.toHaveBeenCalled();
				window.dispatchEvent(new Event('scroll'));
				await flush();
				expect(scrollTo).toHaveBeenCalledWith(0, 0);
			} finally {
				Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
			}
		});

		it('lays out the keyboard room in Chrome on Android, which has its own keyboard geometry API (spec:AST-099 DEC-4)', async () => {
			// Gboard shrinks Chrome's visual viewport while the layout viewport
			// keeps its height; the VirtualKeyboard API is not read.
			mockKeyboardGeometryApi();
			mockPrimaryPointer('coarse');
			mockWindowHeight(800);
			mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 300, bottom: 340 }));

			input.focus();
			await flush();

			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');
		});

		it('makes no keyboard room beside a classic scrollbar with no keyboard', async () => {
			// A desktop page with a 17 px vertical scrollbar: innerWidth counts it,
			// the document's client width and the visual viewport do not.
			mockPrimaryPointer('fine');
			mockWindowHeight(800);
			vi.stubGlobal('innerWidth', 1280);
			Object.assign(mockVisualViewport(800), { width: 1263, scale: 1 });
			Object.defineProperty(document.documentElement, 'clientWidth', {
				configurable: true,
				value: 1263
			});
			try {
				await render(BottomSheet, {
					props: {
						isOpen: true,
						onOpenChange: () => {},
						label: 'Add a comment',
						height: 'tall',
						children: html('<input aria-label="Comment" />')
					}
				});
				const body = getBody();
				const input = field('Comment');
				vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
				vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 700, bottom: 740 }));

				input.focus();
				await flush();

				expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('0px');
			} finally {
				Reflect.deleteProperty(document.documentElement, 'clientWidth');
				vi.unstubAllGlobals();
			}
		});

		it('leaves the document alone when no keyboard is measured', async () => {
			mockVisualViewport(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 57, bottom: 700 }));
			vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect({ top: 600, bottom: 640 }));
			input.focus();
			await flush();
			const scrollTo = vi.mocked(window.scrollTo);
			scrollTo.mockClear();

			// An ordinary page scroll with no keyboard up is the user's, not the
			// browser's, and a non-modal sheet leaves the page scrollable.
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
			window.dispatchEvent(new Event('scroll'));
			await flush();

			expect(scrollTo).not.toHaveBeenCalled();
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
		});

		it('delivers a browser-driven transition itself, then reveals the field', async () => {
			mockIOSWebKit();
			mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<div><input aria-label="Title" /><input aria-label="Comment" /></div>')
				}
			});
			const body = getBody();
			const title = field('Title');
			const comment = field('Comment');
			trackScrollTop(body);
			const scrolls: { top: number; behavior?: ScrollBehavior; focusLanded: boolean }[] = [];
			Object.defineProperty(body, 'scrollBy', {
				configurable: true,
				value: (options: ScrollToOptions) => {
					body.scrollTop += options.top ?? 0;
					scrolls.push({
						top: options.top ?? 0,
						behavior: options.behavior,
						focusLanded: document.activeElement === comment
					});
				}
			});
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(title, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 150 - body.scrollTop, bottom: 190 - body.scrollTop })
			);
			vi.spyOn(comment, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);

			// The first field opens the keyboard and is already inside the safe area,
			// so nothing has to move for it.
			title.focus();
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe('348px');
			expect(scrolls).toEqual([]);

			// A keyboard accessory "Next" or a Tab arrives as a blur naming the
			// destination. We deliver that focus with preventScroll — refusing the
			// browser's reveal — and then reveal the field ourselves, inside the
			// sheet.
			blurTo(title, comment);
			await flush();

			expect(document.activeElement).toBe(comment);
			expect(scrolls).toEqual([{ top: 248, behavior: 'smooth', focusLanded: true }]);
			expect(body.scrollTop).toBe(248);
		});

		it('does not scroll a browser-driven transition when the viewport is unobstructed', async () => {
			mockIOSWebKit();
			mockVisualViewport(800);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<div><input aria-label="Title" /><input aria-label="Comment" /></div>')
				}
			});
			const body = getBody();
			const title = field('Title');
			const comment = field('Comment');
			trackScrollTop(body);
			const scrolls: number[] = [];
			Object.defineProperty(body, 'scrollBy', {
				configurable: true,
				// Apply the scroll, as the real scroller would: a reveal that has
				// already happened must read as no distance left to travel, otherwise
				// every later reveal looks like a fresh one.
				value: (options: ScrollToOptions) => {
					body.scrollTop += options.top ?? 0;
					scrolls.push(options.top ?? 0);
				}
			});
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ top: 100, bottom: 800 }));
			vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect({ top: 150, bottom: 190 }));
			// Below the body's visible area, so a reveal has somewhere to travel.
			vi.spyOn(comment, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 860 - body.scrollTop, bottom: 900 - body.scrollTop })
			);

			title.focus();
			await flush();
			scrolls.length = 0;
			const scrollTo = vi.mocked(window.scrollTo);
			scrollTo.mockClear();
			blurTo(title, comment);
			await flush();

			// With no keyboard there is no clearance to leave and nothing to race, but
			// the control still has to end up visible — brought there once, by the
			// sheet's own scroller, with the page left alone.
			expect(scrolls).toEqual([100]);
			expect(scrollTo).not.toHaveBeenCalled();
		});

		it('leaves the page alone behind a non-modal sheet', async () => {
			const layoutBottom = window.innerHeight;
			mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					hasScrim: false,
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(
				rect({ top: 100, bottom: layoutBottom })
			);
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 600 - body.scrollTop, bottom: 640 - body.scrollTop })
			);
			input.focus();
			await flush();
			const scrollTo = vi.mocked(window.scrollTo);
			scrollTo.mockClear();

			// Without a scrim the page behind stays scrollable, so a document scroll
			// is the user's. Putting it back would fight them.
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
			window.dispatchEvent(new Event('scroll'));
			await flush();

			expect(scrollTo).not.toHaveBeenCalled();
			Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
		});

		it('holds the keyboard scroll range through a pan, on the blur path', async () => {
			// A fully expanded Tall sheet — the only shape this hook runs in — is
			// pinned to the layout viewport bottom, so the body's bottom IS
			// innerHeight. Giving it a cushion below that would hide every bug in this
			// file: the cushion, not the measurement, would keep the overlap positive
			// under a pan.
			const layoutBottom = window.innerHeight;
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<input aria-label="Comment" />')
				}
			});
			const body = getBody();
			const input = field('Comment');
			trackBodyScroll(body);
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(
				rect({ top: 100, bottom: layoutBottom })
			);
			vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 660 - body.scrollTop, bottom: 700 - body.scrollTop })
			);
			input.focus();
			await flush();
			const inset = body.style.getPropertyValue('--_sheet-keyboard-inset');
			expect(inset).toBe(`${layoutBottom - (500 - 48)}px`);

			// The browser pans the page up to reveal a field: the same 500px of
			// visible page, now offset so its bottom edge coincides with the layout
			// viewport bottom — with the keyboard still on screen. Read the bottom and
			// that is indistinguishable from the keyboard closing.
			viewport.offsetTop = window.innerHeight - 500;
			input.blur();
			await flush();

			// The keyboard did not change size, so neither does the scroll range.
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe(inset);
		});

		it('keeps defending a pinned sheet after the browser has panned it once', async () => {
			// The regression that made the device symptom permanent: one pan read as
			// "no keyboard" cleared the inset AND cleared hasKeyboardLayout, which
			// disarms the head start below — so every subsequent reveal panned, and
			// the sheet never recovered.
			const layoutBottom = window.innerHeight;
			mockIOSWebKit();
			const viewport = mockVisualViewport(500);
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Add a comment',
					height: 'tall',
					children: html('<div><input aria-label="Title" /><input aria-label="Comment" /></div>')
				}
			});
			const body = getBody();
			const title = field('Title');
			const comment = field('Comment');
			trackScrollTop(body);
			const scrolls: { top: number; focusLanded: boolean }[] = [];
			Object.defineProperty(body, 'scrollBy', {
				configurable: true,
				value: (options: ScrollToOptions) => {
					body.scrollTop += options.top ?? 0;
					scrolls.push({
						top: options.top ?? 0,
						focusLanded: document.activeElement === comment
					});
				}
			});
			vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(
				rect({ top: 100, bottom: layoutBottom })
			);
			vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect({ top: 150, bottom: 190 }));
			vi.spyOn(comment, 'getBoundingClientRect').mockImplementation(() =>
				rect({ top: 700 - body.scrollTop, bottom: 740 - body.scrollTop })
			);

			title.focus();
			await flush();
			const inset = body.style.getPropertyValue('--_sheet-keyboard-inset');
			expect(inset).toBe(`${layoutBottom - (500 - 48)}px`);

			viewport.offsetTop = layoutBottom - 500;
			viewport.dispatchEvent(new Event('resize'));
			await flush();
			expect(body.style.getPropertyValue('--_sheet-keyboard-inset')).toBe(inset);

			// And the next browser-driven transition is still claimed and revealed, by
			// a distance measured against the unshifted keyboard boundary.
			scrolls.length = 0;
			blurTo(title, comment);
			await flush();

			expect(document.activeElement).toBe(comment);
			expect(scrolls[0]).toEqual({ top: 740 - (500 - 48), focusLanded: true });
		});
	});

	describe('snapPoints', () => {
		// A Tall sheet in an 800px window: a 784px border box, 48px of which is the
		// reserve below the fold, so 736px of it is visible.
		async function renderTallSheet(
			snapPoints?: ReadonlyArray<number | string>,
			onOpenChange: (isOpen: boolean) => void = () => {}
		) {
			const observers = mockResizeObserverInstances();
			mockVisualViewport(800);
			mockWindowHeight(800);
			const view = await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange,
					label: 'Release notes',
					snapPoints,
					height: 'tall',
					children: text('Content')
				}
			});
			await measureSheet(observers, 784, 736);
			return { sheet: getSheet(), view };
		}

		async function dragHandleTo(y: number) {
			fireTimedPointer(getHandle(), 'pointerdown', { time: 0, y: 0 });
			fireTimedPointer(getHandle(), 'pointermove', { time: 1000, y });
			fireTimedPointer(getHandle(), 'pointerup', { time: 2000, y });
			await endTransform();
		}

		it('has no stops of its own, so a released drag springs back', async () => {
			const onOpenChange = vi.fn();
			const { sheet } = await renderTallSheet(undefined, onOpenChange);

			// 200px down is well short of the dismiss threshold, and there is no stop
			// to catch it, so the sheet returns to fully open.
			await dragHandleTo(200);

			expect(sheet.style.transform).toBe('');
			expect(sheet.style.height).toBe('');
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it('rests at a stop given as a fraction of the viewport', async () => {
			const { sheet } = await renderTallSheet([0.5]);

			// Half of the 800px window is 400px of visible sheet: 736 - 400 = 336px
			// of travel, taken as layout height once the snap lands.
			await dragHandleTo(336);

			expect(sheet.style.height).toBe('448px');
			expect(sheet.style.transform).toBe('');
		});

		it('reads a percentage as the same stop as the fraction', async () => {
			const { sheet } = await renderTallSheet(['50%']);
			await dragHandleTo(336);
			expect(sheet.style.height).toBe('448px');
		});

		it('rests at a stop given as an absolute px length', async () => {
			const { sheet } = await renderTallSheet(['320px']);

			// A 320px stop sits 736 - 320 = 416px down, whatever the window does.
			await dragHandleTo(416);

			expect(sheet.style.height).toBe('368px');
			expect(sheet.style.transform).toBe('');
		});

		it('re-anchors to the same stop when the points change under a resting sheet', async () => {
			const { sheet, view } = await renderTallSheet([0.5]);
			await dragHandleTo(336);
			expect(sheet.style.height).toBe('448px');

			// Without an inline height the sheet renders its natural 92dvh budget.
			vi.spyOn(sheet, 'getBoundingClientRect').mockImplementation(() =>
				rect({
					top: 0,
					bottom: sheet.style.height ? Number.parseFloat(sheet.style.height) : 784
				})
			);

			// The host moves its one stop from half the window to a quarter of it.
			// The sheet is resting on that stop, so it follows — no gesture, and
			// nothing to animate.
			await view.rerender({
				isOpen: true,
				onOpenChange: () => {},
				label: 'Release notes',
				snapPoints: [0.25],
				height: 'tall',
				children: text('Content')
			});
			await flush();

			// 200px of visible sheet is 736 - 200 = 536px of travel.
			expect(sheet.style.height).toBe('248px');
			expect(sheet.style.transform).toBe('');
		});

		it('ignores a stop it cannot resolve, and warns which one', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			// 200 is the px mistake: a bare number is a fraction, never a length.
			const { sheet } = await renderTallSheet([0.5, 200]);

			expect(warn.mock.calls.some((args) => String(args[0]).includes('200'))).toBe(true);

			// The stop it could read still works.
			await dragHandleTo(336);
			expect(sheet.style.height).toBe('448px');
			warn.mockRestore();
		});
	});

	describe('focus restore', () => {
		it('restores focus to the opener after close', async () => {
			await render(FocusRestoreHarness, { props: {} });
			const buttons = [...document.querySelectorAll('button')];
			const opener = buttons.find((button) => button.textContent === 'Open sheet')!;
			opener.focus();
			click(opener);
			await flush();
			const done = [...document.querySelectorAll('button')].find(
				(button) => button.textContent === 'Done'
			)!;
			click(done);
			await endTransform();

			expect(document.activeElement).toBe(opener);
		});

		it('always focuses finalFocusRef on close, even when focus had left the sheet', async () => {
			await render(FinalFocusHarness, { props: { hasScrim: false } });
			const buttons = [...document.querySelectorAll('button')];
			const opener = buttons.find((button) => button.textContent === 'Open sheet')!;
			const target = buttons.find((button) => button.textContent === 'Adaptive trigger')!;
			const closeFromPage = buttons.find((button) => button.textContent === 'Close from page')!;

			click(opener);
			await flush();

			// The page stayed live: the person moved on, then a page control closed
			// the sheet. The explicit target still receives focus.
			closeFromPage.focus();
			click(closeFromPage);
			await endTransform();

			expect(document.activeElement).toBe(target);
		});

		it('prefers an explicit final focus target', async () => {
			await render(FinalFocusHarness, { props: {} });
			const buttons = [...document.querySelectorAll('button')];
			const opener = buttons.find((button) => button.textContent === 'Open sheet')!;
			const target = buttons.find((button) => button.textContent === 'Adaptive trigger')!;
			const done = buttons.find((button) => button.textContent === 'Done')!;

			click(opener);
			await flush();
			click(done);
			await endTransform();

			expect(document.activeElement).toBe(target);
		});

		// The returned focus shows the focus-visible ring only after keyboard
		// input (`architecture:interaction-modality` INV1). A plain focus() leaves
		// that to the browser, which rings it after a pointer close: WebKit after
		// a tap, and Chromium when the sheet was opened from the keyboard.
		describe('ring on the returned focus', () => {
			beforeEach(() => {
				__resetInteractionModalityForTest();
			});

			afterEach(() => {
				vi.restoreAllMocks();
			});

			async function openThenClose(closeWith: 'pointer' | 'keyboard') {
				await render(FocusRestoreHarness, { props: {} });
				const buttons = [...document.querySelectorAll('button')];
				const opener = buttons.find((button) => button.textContent === 'Open sheet')!;
				opener.focus();
				click(opener);
				await flush();
				const done = buttons.find((button) => button.textContent === 'Done')!;
				if (closeWith === 'pointer') {
					done.dispatchEvent(
						new PointerEvent('pointerdown', {
							pointerId: 1,
							button: 0,
							isPrimary: true,
							bubbles: true,
							cancelable: true
						})
					);
				} else {
					press(done, 'Enter');
				}
				click(done);
				await flush();
				return opener;
			}

			it('asks the browser for no ring after a pointer close', async () => {
				const opener = await openThenClose('pointer');
				const focus = vi.spyOn(opener, 'focus');
				await endTransform();

				expect(opener).toHaveFocus();
				// The return reveals nothing: the opener was on screen when the sheet
				// opened and the page has not moved since.
				expect(focus.mock.calls).toEqual([[{ preventScroll: true, focusVisible: false }]]);
			});

			it('leaves the ring to the browser after a keyboard close', async () => {
				const opener = await openThenClose('keyboard');
				const focus = vi.spyOn(opener, 'focus');
				await endTransform();

				expect(opener).toHaveFocus();
				expect(focus.mock.calls).toEqual([[{ preventScroll: true }]]);
			});

			it('clears a ring the native close already drew before refocusing', async () => {
				const opener = await openThenClose('pointer');
				// The browser's own dialog close restores focus to the opener, with a
				// ring, before the sheet moves focus, and focusing the focused element
				// changes nothing.
				const close = dialogPrototype.close;
				dialogPrototype.close = vi.fn(function (this: HTMLDialogElement) {
					this.removeAttribute('open');
					opener.focus();
				});
				const matches = HTMLElement.prototype.matches;
				vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
					this: HTMLElement,
					selector: string
				) {
					return selector === ':focus-visible' ? this === opener : matches.call(this, selector);
				});
				const blur = vi.spyOn(opener, 'blur');
				const focus = vi.spyOn(opener, 'focus');
				try {
					await endTransform();

					expect(blur).toHaveBeenCalledTimes(1);
					expect(focus.mock.calls.at(-1)).toEqual([{ preventScroll: true, focusVisible: false }]);
					expect(blur.mock.invocationCallOrder[0]).toBeLessThan(
						focus.mock.invocationCallOrder.at(-1) ?? 0
					);
					expect(opener).toHaveFocus();
				} finally {
					dialogPrototype.close = close;
				}
			});

			it('asks for no ring on an explicit final focus target too', async () => {
				await render(FinalFocusHarness, { props: {} });
				const buttons = [...document.querySelectorAll('button')];
				const opener = buttons.find((button) => button.textContent === 'Open sheet')!;
				const target = buttons.find((button) => button.textContent === 'Adaptive trigger')!;
				const done = buttons.find((button) => button.textContent === 'Done')!;
				click(opener);
				await flush();
				done.dispatchEvent(
					new PointerEvent('pointerdown', {
						pointerId: 1,
						button: 0,
						isPrimary: true,
						bubbles: true,
						cancelable: true
					})
				);
				click(done);
				await flush();
				const focus = vi.spyOn(target, 'focus');
				await endTransform();

				expect(target).toHaveFocus();
				expect(focus.mock.calls).toEqual([[{ preventScroll: true, focusVisible: false }]]);
			});
		});
	});

	describe('initial focus', () => {
		it('focuses the sheet panel on open, not the first control', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					children: html('<button type="button">First action</button>')
				}
			});
			const panel = getSheet();
			expect(document.activeElement).toBe(panel);
			expect(document.activeElement).not.toBe(document.querySelector('button'));
		});

		it('honors a descendant with data-autofocus', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					children: html('<input data-autofocus aria-label="Search" />')
				}
			});
			expect(document.activeElement).toBe(field('Search'));
		});
	});

	describe('data-autofocus eligibility on open (AR4)', () => {
		async function openWith(markup: string, hasScrim = true) {
			// A raw snippet must resolve to a single root element; upstream's JSX
			// fragments can hold siblings, so the arm is wrapped here.
			return render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					hasScrim,
					children: html(`<div>${markup}</div>`)
				}
			});
		}
		const own = () => field('Own');

		it('focuses the field over a control placed before it, modal or not', async () => {
			// Land on the first control, as Firefox's native focusing steps do, so
			// the test shows that the native landing does not count as placed. The
			// non-modal arm stubs `show()` where upstream stubs `showPopover()`:
			// that is the presentation call this port makes.
			const landOnFirstControl = function (this: HTMLDialogElement) {
				this.setAttribute('open', '');
				this.querySelector<HTMLElement>('button')?.focus();
			};
			const showModal = dialogPrototype.showModal;
			const show = dialogPrototype.show;
			dialogPrototype.showModal = vi.fn(landOnFirstControl);
			dialogPrototype.show = vi.fn(landOnFirstControl);
			try {
				for (const hasScrim of [true, false]) {
					const view = await openWith(
						'<button type="button">First action</button>' +
							'<input data-autofocus aria-label="Own" />',
						hasScrim
					);
					expect(document.activeElement).toBe(own());
					view.unmount();
				}
			} finally {
				dialogPrototype.showModal = showModal;
				dialogPrototype.show = show;
			}
		});

		it('skips a field that belongs to a sheet nested in the content', async () => {
			await openWith(
				'<dialog><input data-autofocus aria-label="Nested" /></dialog>' +
					'<input data-autofocus aria-label="Own" />'
			);
			expect(document.activeElement).toBe(own());
		});

		it('skips an inert field', async () => {
			await openWith(
				'<div inert><input data-autofocus aria-label="Inert" /></div>' +
					'<input data-autofocus aria-label="Own" />'
			);
			expect(document.activeElement).toBe(own());
		});

		it('skips a field that is not rendered', async () => {
			// jsdom has no layout, so upstream's stub reads `hidden`. Chromium's
			// `hidden` also computes to `display:none`, but the same stub keeps the
			// assertion about the eligibility check rather than the UA stylesheet.
			const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'checkVisibility');
			Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
				configurable: true,
				value(this: HTMLElement) {
					return this.closest('[hidden]') == null;
				}
			});
			try {
				await openWith(
					'<input data-autofocus aria-label="Hidden" hidden />' +
						'<input data-autofocus aria-label="Own" />'
				);
				expect(document.activeElement).toBe(own());
			} finally {
				if (original) {
					Object.defineProperty(HTMLElement.prototype, 'checkVisibility', original);
				} else {
					Reflect.deleteProperty(HTMLElement.prototype, 'checkVisibility');
				}
			}
		});

		it('moves on from a candidate that refuses focus', async () => {
			await openWith(
				'<div data-autofocus>Not focusable</div>' + '<input data-autofocus aria-label="Own" />'
			);
			expect(document.activeElement).toBe(own());
		});
	});

	describe('accessible name', () => {
		it('warns in development when label is empty', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: '',
					children: text('Content')
				}
			});
			await flush();
			expect(warn.mock.calls.some((args) => String(args[0]).includes('BottomSheet'))).toBe(true);
			warn.mockRestore();
		});
	});

	describe('reduced motion', () => {
		it('opens without throwing when prefers-reduced-motion is set', async () => {
			stubMatchMedia({ reduceMotion: true, matches: true });
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					children: text('Content')
				}
			});
			expect(getDialog()).toBeInTheDocument();
		});

		function control(name: string): HTMLButtonElement {
			const button = [...document.querySelectorAll('button')].find(
				(candidate) => candidate.textContent === name
			);
			if (!button) {
				throw new Error(`${name} button not found`);
			}
			return button;
		}

		it('a refused touch swipe spends its request: a guarded onOpenChange keeps the sheet open, and the next close from a control leaves at once', async () => {
			mockReducedMotion('fine');
			await render(ControlledHarness, { props: { variant: 'guarded' } });
			const dialog = getDialog();
			drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }], 'touch');
			// Refused: the sheet stays open.
			expect(dialog).toHaveAttribute('open');
			click(control('Unlock'));
			click(control('Close'));
			// A control close: its collapsed transform end closes the dialog; the
			// spent swipe request does not turn it into a cross-fade.
			await endTransition('transform');
			expect(dialog).not.toHaveAttribute('open');
		});

		it('a mouse drag dismissal under reduced motion on a fine pointer leaves at once (DR3): a mouse or pen drag is not a touch drag', async () => {
			mockReducedMotion('fine');
			await render(ControlledHarness, { props: {} });
			const dialog = getDialog();
			drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }], 'mouse');
			await endTransition('transform');
			expect(dialog).not.toHaveAttribute('open');
		});

		it('a dismissal from a control under reduced motion on a fine pointer leaves at once (DR3): its (collapsed) transform end closes the dialog', async () => {
			mockReducedMotion('fine');
			await render(ControlledHarness, { props: {} });
			const dialog = getDialog();
			click(control('Close'));
			await endTransition('transform');
			expect(dialog).not.toHaveAttribute('open');
		});

		it('a dismissal from a control under reduced motion on a coarse pointer fades out (DR2)', async () => {
			mockReducedMotion('coarse');
			await render(ControlledHarness, { props: {} });
			const dialog = getDialog();
			click(control('Close'));
			await flush();
			getSheet().dispatchEvent(
				new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true })
			);
			await flush();
			expect(dialog).toHaveAttribute('open');
			getSheet().dispatchEvent(
				new TransitionEvent('transitionend', { propertyName: 'opacity', bubbles: true })
			);
			await flush();
			expect(dialog).not.toHaveAttribute('open');
		});
	});

	describe('container padding isolation', () => {
		it('resets container padding custom properties to 0px on the sheet panel element', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					children: text('Content')
				}
			});
			const sheet = getSheet();
			const computed = window.getComputedStyle(sheet);
			expect(computed.getPropertyValue('--container-padding-inline-start')).toBe('0px');
			expect(computed.getPropertyValue('--container-padding-inline-end')).toBe('0px');
			expect(computed.getPropertyValue('--container-padding-block-start')).toBe('0px');
			expect(computed.getPropertyValue('--container-padding-block-end')).toBe('0px');
		});
	});

	describe('container padding', () => {
		it('passes padding to the content box of a standalone sheet', async () => {
			await render(BottomSheet, {
				props: {
					isOpen: true,
					onOpenChange: () => {},
					label: 'Filters',
					padding: 0,
					children: html('<span data-testid="sheet-child">Content</span>')
				}
			});
			const box = document.querySelector<HTMLElement>(
				'[data-testid="sheet-child"]'
			)!.parentElement!;
			const computed = getComputedStyle(box);
			// Chromium resolves the token through a custom property; jsdom reports
			// the specified `var(--spacing-0)` upstream asserts. Comparing against
			// the token's own computed value keeps the claim about the same token.
			expect(computed.getPropertyValue('--container-padding-inline-start')).toBe(
				computed.getPropertyValue('--spacing-0')
			);
			expect(getSheet().hasAttribute('padding')).toBe(false);
		});

		it('passes padding to the content box of a switcher sheet', async () => {
			await render(SwitcherHarness, {
				props: {
					activeSheet: 'comment',
					padding: 2,
					first: html('<span data-testid="switcher-child">Content</span>')
				}
			});
			const box = document.querySelector<HTMLElement>(
				'[data-testid="switcher-child"]'
			)!.parentElement!;
			const computed = getComputedStyle(box);
			expect(computed.getPropertyValue('--container-padding-inline-start')).toBe(
				computed.getPropertyValue('--spacing-2')
			);
		});
	});

	describe('swipe to dismiss', () => {
		it("a sheet opened from inside another sheet's content drags to dismiss by its own handle, and the covered host neither drags nor takes the pointer (FR6, FR7)", async () => {
			const onInnerOpenChange = vi.fn();
			const onOuterOpenChange = vi.fn();
			const observers = mockResizeObserverInstances();
			await render(NestedHarness, { props: { onInnerOpenChange, onOuterOpenChange } });
			const dialogs = document.querySelectorAll('dialog');
			expect(dialogs).toHaveLength(2);
			const [outerDialog, innerDialog] = dialogs;
			// The inner sheet's dialog is rendered inside the outer sheet's body,
			// so its events bubble through the outer body's gesture listeners.
			expect(outerDialog.contains(innerDialog)).toBe(true);
			const outerPanel = outerDialog.querySelector<HTMLElement>('.astryx-bottom-sheet')!;
			const outerBody = outerPanel.querySelector<HTMLElement>(':scope > :not([aria-hidden])')!;
			const innerPanel = innerDialog.querySelector<HTMLElement>('.astryx-bottom-sheet')!;
			const innerHandle = innerPanel.querySelector<HTMLElement>(':scope > [aria-hidden="true"]')!;
			await layOutSheet(observers, innerPanel);
			// `setPointerCapture` is a prototype stub here, so record who captures.
			const captured: Element[] = [];
			const capture = vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(function (
				this: Element
			) {
				captured.push(this);
			});
			drag(innerHandle, [{ y: 0 }, { y: 40 }, { y: 120 }], 'touch');
			capture.mockRestore();
			// The inner sheet's own drag ran to its dismissal.
			expect(onInnerOpenChange).toHaveBeenCalledWith(false);
			// The covered host saw the same pointer bubble up and did nothing with
			// it: no drag of its own (its panel keeps its resting transform) and no
			// pointer capture, which would have cancelled the inner handle's drag.
			expect(onOuterOpenChange).not.toHaveBeenCalled();
			expect(captured).toContain(innerHandle);
			expect(captured).not.toContain(outerBody);
			expect(outerPanel.style.transform).toBe('');
		});

		it('requests close when dragged past the dismiss threshold', async () => {
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: { isOpen: true, onOpenChange, label: 'Filters', children: text('Content') }
			});
			// No measured height (see `stubZeroRects`) -> any downward drag dismisses
			// via the distance branch (offset > 0.25) once released downward.
			drag(getHandle(), [{ y: 0 }, { y: 40 }, { y: 120 }]);
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		it('restores the sheet when a context menu interrupts an active drag', async () => {
			const onOpenChange = vi.fn();
			await render(BottomSheet, {
				props: { isOpen: true, onOpenChange, label: 'Filters', children: text('Content') }
			});
			const handle = getHandle();
			const dialog = getDialog();

			handle.dispatchEvent(
				new PointerEvent('pointerdown', {
					pointerId: 1,
					clientY: 0,
					button: 0,
					isPrimary: true,
					bubbles: true,
					cancelable: true
				})
			);
			handle.dispatchEvent(
				new PointerEvent('pointermove', {
					pointerId: 1,
					clientY: 300,
					bubbles: true,
					cancelable: true
				})
			);
			await flush();
			expect(getSheet().style.transform).toBe('translateY(300px)');

			expect(
				handle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
			).toBe(false);

			await flush();
			expect(getSheet().style.transform).toBe('');
			expect(dialog.style.getPropertyValue('--_sheet-scrim-opacity')).toBe('1');
			expect(onOpenChange).not.toHaveBeenCalled();
		});
	});
});

export { SNAP_POINTS };
