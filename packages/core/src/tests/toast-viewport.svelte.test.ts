/** PORTS: Toast/ToastViewport.test.tsx */

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import Harness from './fixtures/toast-viewport-harness.svelte';
import EndContentHarness from './fixtures/toast-swipe-end-content.svelte';
import RenderContentHarness from './fixtures/toast-render-content.svelte';
import NestedViewports from './fixtures/toast-nested-viewports.svelte';
import TwoViewports from './fixtures/toast-two-viewports.svelte';
import LongBody from './fixtures/toast-long-body.svelte';
import ToastFlows from './fixtures/toast-flows.svelte';
import Toast from '$lib/components/toast/toast.svelte';
import EffectDispatch from './fixtures/toast-effect-dispatch.svelte';
import { __resetLiveRegionsForTest, type AnnouncePoliteness } from '$lib/hooks/use-announce.js';
import type { ToastOptions, ToastPosition } from '$lib/components/toast/types.js';
import type { ToastProps } from '$lib/components/toast/toast.svelte';
import type { ToastViewportProps } from '$lib/components/toast/toast-viewport.svelte';

/**
 * Ported from Astryx's `Toast/ToastViewport.test.tsx`. What is here and what is
 * short of it is measured in `port/status.md`'s case delta, from the `PORTS:`
 * marker above — this header states no count, per CLAUDE.md.
 *
 * Every upstream block has a counterpart, including the four 0.5.1 added that
 * assert on **computed styles** — `Toast responsive layout`, `ToastViewport
 * placement`, `ToastViewport visible limit` and `Toast native motion contract`.
 * jsdom echoes a computed style back as the declaration and Chromium resolves
 * it, so those four are the ones whose assertions are *resolved* rather than
 * transcribed; see `resolves()` below.
 *
 * The region-ARIA pair at the end is upstream's own 0.5.1 split: the landmark is
 * now gated on there being something to announce, so an empty viewport exposes
 * no region at all. Ours asserted the region unconditionally and timed out
 * against the gate. Many cases are restated rather than transcribed — every one
 * says so at its site, and the reasons cluster into the sections below.
 *
 * ## Swipe dismissal: real pointer and touch events
 *
 * `describe('Toast swipe dismissal')` drives `use-toast-gesture.ts`, which is
 * spread onto the `[data-type]` card by `toast-surface.svelte` and writes the
 * `--_toast-swipe-*` custom properties the cases read back. Upstream's
 * `fireEvent.pointerDown(el, {...})` becomes a dispatched `PointerEvent` and its
 * hand-built touch objects become real `Touch`/`TouchEvent`s, because Chromium
 * implements both and jsdom implements neither — which is also what makes the
 * `defaultPrevented` assertions mean something here: they observe a non-passive
 * `touchmove` listener actually taking effect rather than a flag on a synthetic
 * object.
 *
 * Two environment differences are load-bearing. `setPointerCapture` throws for
 * a pointer id the compositor never saw, so it is stubbed on the prototype; and
 * a computed `transform` is a matrix, so upstream's
 * `not.toContain('translateX')` — which cannot fail here — is restated as a read
 * of the matrix's own horizontal translation. A third is this browser's input
 * mode: a desktop Chromium has no `ontouchstart`, so the sensor host does not
 * route the synthetic TouchEvents to the card's pan. The card's own listener
 * therefore makes the pan's one-way first-move decision (see
 * `use-toast-gesture.ts`), which is what lets a page-owned first touch stay
 * page-owned — and `claim.state` is still what tells it the pan failed when a
 * real pointer move got there first.
 *
 * The sibling `Toast/useToast.test.tsx` still lives in `use-toast.svelte.test.ts`.
 *
 * ## Announcements: the sink is observed, not a mocked module
 *
 * Upstream wraps `useAnnounce` with `vi.mock` so every call lands on a spy while
 * the real singleton regions still fill. That is avoided here: the client
 * project's setup file imports the whole `$lib` barrel, so `use-announce.js` is
 * already in the module graph before any test file runs, and a hoisted module
 * mock would have to invalidate it transitively. `recordAnnouncements()` watches
 * the regions themselves instead — the exact sink upstream's spy feeds. One
 * announce writes one non-empty text node (the hook clears the region, then sets
 * the message on the next frame), so the recorded `[message, politeness]` pairs
 * are the same evidence the spy provides, one step closer to the DOM.
 *
 * `__resetLiveRegionsForTest()` runs after every case: the regions outlive each
 * render, so text from one case would otherwise leak into the next.
 *
 * ## Live regions make body-wide text queries ambiguous
 *
 * A toast's text now appears twice in `document.body` — in the toast, and in the
 * polite/assertive region on `<body>`. `screen.getByText(...)` is page-wide, so
 * the F6 case scopes its toast-text assertion with `screen.locator` (this repo's
 * `within(container)`, documented in `date-input.svelte.test.ts`). The blur-timer
 * case already read `screen.container.textContent`, which excludes the regions,
 * and every other case queries trigger labels or button roles.
 *
 * ## Project
 *
 * Client (real Chromium). Every case turns on `document.activeElement`, a real
 * focus ring inside a `position: fixed` viewport, and — for the two timer cases
 * — a DOM whose CSS transitions actually exist. The suite would be testing jsdom
 * otherwise.
 *
 * ## Upstream's `beforeAll` popover polyfill: dropped
 *
 * Upstream stubs `HTMLElement.prototype.showPopover`/`hidePopover` because jsdom
 * implements neither. Chromium implements both natively, and every case here
 * renders with `isTopLayer={false}` (upstream's own choice), so the viewport
 * never calls them at all. Keeping the stub would fake an API that is real here
 * and unused by the suite either way.
 *
 * ## `renderHook`'s absence, and `act()`'s
 *
 * `useToast()` must run during component init, so upstream's `ShowToastButton`
 * becomes a fixture verbatim (`fixtures/show-toast-button.svelte`) and
 * `renderViewport(children)` becomes `fixtures/toast-viewport-harness.svelte`,
 * which takes the trigger list as data. `act()` disappears — a `$state` write
 * flushes on its own; where a case needs the DOM *and effects* settled before it
 * reads `document.activeElement`, `await tick()` stands in.
 *
 * ## Clicks are synchronous on purpose
 *
 * Upstream's `fireEvent.click` dispatches a click without moving focus, which is
 * load-bearing in cases 1 and 3 (the trigger must stay focused so F6 has
 * somewhere to return to) and in case 6 (two dismissals inside one exit window).
 * `HTMLElement.click()` is the exact equivalent; the browser-driver `.click()`
 * of `vitest-browser-svelte` is a real mouse press and would move focus and
 * interleave frames.
 *
 * ## Fake timers
 *
 * Only `setTimeout`/`clearTimeout`, as in this repo's `useLongPress` port:
 * Vitest's default set includes `queueMicrotask`, which is what Svelte schedules
 * its flush on, so faking everything stalls mount. `Date.now()` therefore stays
 * real, which only means `pauseTimer` books a few real milliseconds of elapsed
 * time against `remaining` — well inside the margins both timer cases advance
 * by. Under fake timers the assertions are synchronous DOM reads rather than
 * `expect.element`, whose retry loop would have nothing to run on.
 */

// Module-level constant default props, as upstream (its `EMPTY_OPTIONS` lives in
// the fixture, since a Svelte default is written at the destructure).
const INFO_A: ToastOptions = { body: 'Toast A' };
const INFO_B: ToastOptions = { body: 'Toast B' };
const AUTO_TOAST: ToastOptions = { body: 'Auto toast', autoHideDuration: 3000 };
const SWIPE_TOAST: ToastOptions = { body: 'Swipe toast', isAutoHide: false };
const LONG_TOAST_BODY = 'Arbeitsbereichsbenachrichtigungseinstellungen gespeichert';

/**
 * Pointer capture, stubbed on the prototype for the swipe block.
 *
 * `setPointerCapture` throws `NotFoundError` in a real browser when the pointer
 * id was never seen by the compositor, which is every id a dispatched
 * `PointerEvent` carries. jsdom no-ops instead, so upstream's cases can assert
 * on the calls without stubbing anything. Same shape as
 * `bottom-sheet.svelte.test.ts`'s `stubPointerCapture`.
 */
let restorePointerCapture: (() => void) | undefined;
function stubPointerCapture(): void {
	const proto = Element.prototype;
	const original = {
		setPointerCapture: proto.setPointerCapture,
		releasePointerCapture: proto.releasePointerCapture
	};
	proto.setPointerCapture = vi.fn();
	proto.releasePointerCapture = vi.fn();
	restorePointerCapture = () => {
		proto.setPointerCapture = original.setPointerCapture;
		proto.releasePointerCapture = original.releasePointerCapture;
	};
}

/**
 * Upstream's `fireEvent.pointerDown(el, {...})`, as the real event it stands
 * for. `pointerType` defaults to `'pen'` because that is the only type the
 * gesture accepts and the type all but one case passes.
 */
function pen(
	element: HTMLElement,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	init: {
		pointerId: number;
		clientX: number;
		clientY: number;
		button?: number;
		pointerType?: string;
		timeStamp?: number;
	}
): PointerEvent {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerType: init.pointerType ?? 'pen',
		pointerId: init.pointerId,
		clientX: init.clientX,
		clientY: init.clientY,
		button: init.button ?? 0
	});
	// Chromium timestamps an event from the time origin, not from the test's
	// clock, and `EventInit` has no `timeStamp`. Shadow it so a case can pin
	// input timing the way jsdom's `Date.now()`-based stamps already do.
	Object.defineProperty(event, 'timeStamp', { value: init.timeStamp ?? Date.now() });
	element.dispatchEvent(event);
	return event;
}

/**
 * Upstream builds a bare `Event` and hangs `touches`/`changedTouches` on it with
 * `Object.defineProperty`, because jsdom implements neither `Touch` nor
 * `TouchEvent`. Chromium implements both, so these are the real thing — which
 * also means `preventDefault()` on the `{passive: false}` `touchmove` listener
 * is honoured rather than assumed, and that is the property three of these cases
 * are about.
 */
function touch(
	element: HTMLElement,
	type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
	init: { clientY: number; clientX?: number; identifier?: number; timeStamp?: number }
): TouchEvent {
	const point = new Touch({
		identifier: init.identifier ?? 31,
		target: element,
		clientX: init.clientX ?? 10,
		clientY: init.clientY
	});
	const settled = type === 'touchend' || type === 'touchcancel';
	const event = new TouchEvent(type, {
		bubbles: true,
		cancelable: true,
		touches: settled ? [] : [point],
		targetTouches: settled ? [] : [point],
		changedTouches: [point]
	});
	Object.defineProperty(event, 'timeStamp', { value: init.timeStamp ?? Date.now() });
	element.dispatchEvent(event);
	return event;
}

/**
 * A multi-contact touch event, for the cases upstream builds by hand: a second
 * finger, or a lift while another contact remains. Each contact is a real
 * `Touch`, so the card's listeners see the same shape a browser gives them.
 */
function dispatchTouch(
	element: HTMLElement,
	type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
	touches: { identifier: number; clientX: number; clientY: number }[],
	changedTouches: { identifier: number; clientX: number; clientY: number }[] = touches,
	timeStamp = Date.now()
): TouchEvent {
	const points = touches.map(
		(touch) =>
			new Touch({
				identifier: touch.identifier,
				target: element,
				clientX: touch.clientX,
				clientY: touch.clientY
			})
	);
	const changed = changedTouches.map(
		(touch) =>
			new Touch({
				identifier: touch.identifier,
				target: element,
				clientX: touch.clientX,
				clientY: touch.clientY
			})
	);
	const event = new TouchEvent(type, {
		bubbles: true,
		cancelable: true,
		touches: points,
		targetTouches: points,
		changedTouches: changed
	});
	Object.defineProperty(event, 'timeStamp', { value: timeStamp });
	element.dispatchEvent(event);
	return event;
}

/**
 * The horizontal component of the card's computed transform.
 *
 * Upstream asserts `getComputedStyle(el).transform).not.toContain('translateX')`,
 * which is a **string** match against jsdom's echo of the declaration. Chromium
 * resolves a transform to a matrix, so that assertion can never fail here and
 * would pass over a real sideways throw. Reading the matrix's translation
 * instead checks what the case titles claim — no horizontal drift — and checks
 * it more strictly than upstream can.
 *
 * It is not vacuous, which was verified rather than assumed: at the assertion
 * point the card computes to `matrix(1, 0, 0, 1, 0, 8)` — the throw is live in
 * the vertical component, and `m41` is the horizontal one that must stay 0.
 */
function horizontalDriftOf(element: HTMLElement): number {
	const { transform } = getComputedStyle(element);
	return transform === 'none' ? 0 : new DOMMatrix(transform).m41;
}

function renderViewport(
	triggers: { options?: ToastOptions; triggerLabel?: string }[],
	position?: ToastPosition
) {
	return render(Harness, { props: { triggers, position } });
}

// Fire the transition-end that ToastViewport listens for to unmount an exiting
// toast. Chromium *does* run the real transition, but on real time — these cases
// must not wait for it, and case 4/7 run under fake timers where the exit would
// still take real wall-clock milliseconds.
function completeExit(toastId: string): void {
	const node = document.querySelector<HTMLElement>(`[data-toast-id="${toastId}"]`);
	if (node) {
		node.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true,
				cancelable: true
			})
		);
	}
}

/**
 * Upstream's `getVisualToastByText`, without the `screen.getByText` step.
 *
 * A toast's text is on the page twice — in the card and in the singleton live
 * region on `<body>` — so a page-wide text query is ambiguous here where
 * upstream's is not (see the header). Walking the cards is the same lookup with
 * the ambiguity removed: only one of the two nodes is inside a `[data-type]`.
 */
function getVisualToastByText(text: string): HTMLElement {
	for (const node of document.querySelectorAll<HTMLElement>('[data-type]')) {
		if (node.textContent?.includes(text)) return node;
	}
	throw new Error(`Toast visual for ${text} not found`);
}

/**
 * Upstream's `screen.getByText(text).closest('.astryx-toast')`, with the same
 * ambiguity removed as `getVisualToastByText` above — the live-region copy of
 * the text has no `.astryx-toast` ancestor, but a page-wide text query still
 * finds it first.
 */
function getToastCardByText(text: string): HTMLElement {
	for (const node of document.querySelectorAll<HTMLElement>('.astryx-toast')) {
		if (node.textContent?.includes(text)) return node;
	}
	throw new Error(`Toast card for ${text} not found`);
}

/**
 * Every notifications landmark, in DOM order. The placement cases render two
 * viewports at once and index into them, which a `getByRole` locator cannot do
 * without resolving to a strict-mode violation first.
 */
function notificationRegions(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>('[role="region"][aria-label="Notifications"]')];
}

/** The visible text of each toast card inside `region`, in DOM order. */
function cardTextsIn(region: HTMLElement): string[] {
	return [...region.querySelectorAll<HTMLElement>('[data-type]')].map((card) =>
		(card.textContent ?? '').replace(/\s+/g, ' ').trim()
	);
}

/**
 * Upstream asserts `getComputedStyle(viewport).width).not.toBe('100%')`, which
 * is jsdom echoing the declaration back. Chromium resolves `width` to pixels, so
 * that assertion can never fail here — and the two spellings it distinguishes
 * (`inset-inline: 0` versus `width: 100%`) resolve to the *same* used width, so
 * there is no computed value that tells them apart.
 *
 * What the declaration is guarding is observable, though: `width: 100%` beside
 * the viewport's own inline padding is what overflows, which is why upstream
 * asserts `box-sizing: border-box` in the same breath. So the restatement checks
 * the consequence — the landmark spans the inline axis and does not exceed it.
 */
function expectSpansInlineAxisWithoutOverflowing(viewport: HTMLElement): void {
	const available = document.documentElement.clientWidth;
	expect(getComputedStyle(viewport).boxSizing).toBe('border-box');
	expect(viewport.getBoundingClientRect().width).toBeLessThanOrEqual(available);
	expect(viewport.getBoundingClientRect().width).toBeGreaterThan(available / 2);
	// The bounds above cannot see the declaration upstream names: with
	// `box-sizing: border-box` and `inset-inline: 0`, a declared `width: 100%`
	// resolves to exactly the same used width, so both bounds still hold. The
	// declaration is checked directly instead, the same way this suite checks
	// for `100lvh`/`100dvh`.
	expect(someRuleFor([viewport], 'width: 100%')).toBe(false);
}

/**
 * Waits for a toast's entry to finish.
 *
 * A toast enters with a real CSS transition here, and `@starting-style` supplies
 * its start state — `grid-template-rows: 0fr` and `padding-block-end: 0` on the
 * wrapper, plus the `--_toast-slide-y` offset on the card. Read synchronously
 * after mount, `getComputedStyle` therefore reports the *starting* values: the
 * inter-toast gap is still 0 and the card still carries `translateY(8px)`.
 *
 * jsdom implements neither transitions nor `@starting-style`, so upstream's
 * cases read the settled values immediately and never had to wait. Every case
 * here that reads a transitioned property waits first, or it is asserting about
 * the entry animation while claiming to assert about the resting style.
 */
async function settleEntry(element: HTMLElement): Promise<void> {
	const animations = element.getAnimations({ subtree: true });
	await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}

/** Upstream's `getToastWrapperByText`: the `[data-toast-id]` around a card. */
function getToastWrapperByText(text: string): HTMLElement {
	const wrapper = getVisualToastByText(text).closest('[data-toast-id]');
	if (!(wrapper instanceof HTMLElement)) throw new Error(`Toast wrapper for ${text} not found`);
	return wrapper;
}

/**
 * What a declaration *resolves to* in a given element's context.
 *
 * The motion and layout blocks read computed styles that upstream asserts as
 * literal token expressions — `'var(--duration-fast)'`,
 * `'var(--spacing-2)'`, `'calc(var(--text-body-size) * var(--text-body-leading))'`.
 * That is jsdom echoing the declaration back; Chromium substitutes and computes,
 * so every one of those assertions would fail here for a reason that is about
 * the environment rather than the styles.
 *
 * Transcribing the resolved pixel value instead would pin the *token's* value —
 * a theme change would fail the toast's suite. So the expression is resolved the
 * same way the browser resolves the real one: a probe element inheriting from
 * the same host, carrying the same declaration. The assertion then reads
 * "computes to whatever `var(--duration-fast)` computes to here", which is
 * upstream's assertion evaluated rather than restated.
 *
 * `host` is where the probe is appended, and therefore what it inherits from.
 * For a percentage or any other value resolved against the containing block,
 * pass the element's *parent* so the probe shares its containing block.
 */
function resolves(host: HTMLElement, property: string, expression: string): string {
	const probe = document.createElement('div');
	probe.style.setProperty(property, expression);
	host.appendChild(probe);
	const value = getComputedStyle(probe).getPropertyValue(property);
	probe.remove();
	return value;
}

/**
 * Every CSS rule text on the page, de-duplicated.
 *
 * Three upstream cases assert on the *source text* of `Toast.tsx` /
 * `ToastViewport.tsx` through `readFileSync`, which a browser-project test
 * cannot do. The compiled sheet is the better subject anyway: it is what ships,
 * where the source is one input to it.
 *
 * The walk descends into grouping rules because this port's output sits inside
 * `@layer` blocks, and de-duplicates by rule text because the sheet is on the
 * page twice — Vite injects it for the module graph and `setup-stylex.ts`
 * appends its own copy. Both hazards are documented in CLAUDE.md.
 */
function allCssRuleTexts(): Set<string> {
	const seen = new Set<string>();
	const walk = (rules: CSSRuleList): void => {
		for (const rule of rules) {
			seen.add(rule.cssText);
			const nested = (rule as CSSGroupingRule).cssRules;
			if (nested) walk(nested);
		}
	};
	for (const sheet of document.styleSheets) {
		try {
			walk(sheet.cssRules);
		} catch {
			// A cross-origin sheet throws on access; none of ours is one.
		}
	}
	return seen;
}

/**
 * The compiled rules that actually apply to `element`.
 *
 * Scoping matters: upstream's source-text assertions name one file, and a
 * page-wide scan of the sheet answers a different question. `scale(0.98)`
 * appears in this repo's CSS — some other component uses it — so an unscoped
 * `not.toContain` fails for a reason that has nothing to do with Toast.
 */
function rulesMatching(element: HTMLElement): string[] {
	const out: string[] = [];
	for (const text of allCssRuleTexts()) {
		const brace = text.indexOf('{');
		if (brace < 0) continue;
		const selector = text.slice(0, brace).trim();
		if (!selector || selector.startsWith('@')) continue;
		try {
			if (element.matches(selector)) out.push(text);
		} catch {
			// Not a selector this element can be matched against.
		}
	}
	return out;
}

/**
 * The text of every `@media (prefers-reduced-motion: reduce)` block on the page,
 * whole. `rulesMatching` deliberately flattens at-rules away, which is right for
 * "does this rule apply to this element" and wrong for "is this value *inside*
 * the reduced-motion block" — the pairing is what upstream's source read pins.
 */
function reducedMotionRules(): string[] {
	return [...allCssRuleTexts()].filter((rule) =>
		rule.startsWith('@media (prefers-reduced-motion: reduce)')
	);
}

/** Whether any rule applying to one of `elements` contains `text`. */
function someRuleFor(elements: HTMLElement[], text: string): boolean {
	return elements.some((element) => rulesMatching(element).some((rule) => rule.includes(text)));
}
function toastIds(): string[] {
	return [...document.querySelectorAll('[data-toast-id]')].map(
		(node) => node.getAttribute('data-toast-id') as string
	);
}

function dismissButtons(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>('button[aria-label="Dismiss notification"]')];
}

/** A recorded announcement: the message and the region it reached. */
type AnnounceRecord = [message: string, politeness: AnnouncePoliteness];

/**
 * Records every announcement that reaches `useAnnounce`'s singleton live
 * regions — see the file header for why this stands in for upstream's
 * `vi.mock`ed spy. The regions do not exist until the first announce, so the
 * observer watches `document.body`'s subtree and filters to them.
 */
function recordAnnouncements(): { calls: AnnounceRecord[]; stop: () => void } {
	const calls: AnnounceRecord[] = [];
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			const region = record.target;
			if (!(region instanceof HTMLElement)) continue;
			const politeness = region.getAttribute('data-astryx-live-region');
			if (politeness !== 'polite' && politeness !== 'assertive') continue;
			for (const node of record.addedNodes) {
				const text = node.textContent ?? '';
				if (text) calls.push([text, politeness]);
			}
		}
	});
	observer.observe(document.body, { subtree: true, childList: true });
	return { calls, stop: () => observer.disconnect() };
}

function regionText(politeness: AnnouncePoliteness): string {
	return document.querySelector(`[data-astryx-live-region="${politeness}"]`)?.textContent ?? '';
}

/**
 * Waits long enough for an announcement to have landed (or provably not to
 * have): the hook sets the message on the frame after the dispatch, and the
 * MutationObserver callback runs as a microtask after that.
 */
async function settleAnnouncements(): Promise<void> {
	await tick();
	for (let i = 0; i < 3; i++) {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}
	await tick();
}

afterEach(() => {
	vi.mocked(document.hasFocus).mockRestore?.();
	vi.useRealTimers();
	__resetLiveRegionsForTest();
});

// jsdom reports no window focus until an element is focused, but a test page
// stands for a focused window: a toast raised while the window is blurred
// starts held (FR2), which the blur tests set up on purpose.
beforeEach(() => {
	vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

describe('Toast responsive layout', () => {
	it('keeps placement on ToastViewport rather than exposing a non-positioning Toast prop', async () => {
		expectTypeOf<ToastProps>().not.toHaveProperty('position');
		expectTypeOf<ToastViewportProps>().toHaveProperty('position');

		// `expectTypeOf` compiles to nothing, and this project runs with
		// `expect.requireAssertions` — a case that asserts nothing at runtime
		// fails. The type half above is still checked, by `svelte-check` in the
		// gate; what follows is the same claim made of the rendered output, which
		// is what the title is really about. `ToastProps` is a closed list with no
		// rest spread, so a `position` handed to a `Toast` reaches nothing at all.
		const stray = {
			type: 'info',
			body: 'Placed',
			isAutoHide: false,
			autoHideDuration: 5000,
			onDismiss: () => {},
			position: 'topEnd'
		} as unknown as ToastProps;
		await render(Toast, { props: stray });
		const card = getVisualToastByText('Placed');
		expect(card.hasAttribute('position')).toBe(false);
		expect(card.closest('[data-toast-id]')).toBeNull();

		// The viewport's `position` is the one that places the stack.
		const placed = await renderViewport([{ options: INFO_A }], 'topEnd');
		(placed.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(getComputedStyle(notificationRegions()[0]).top).toBe('0px');
	});

	it('keeps real trailing controls on the first line while long body text wraps', async () => {
		const screen = await render(LongBody, { props: { body: LONG_TOAST_BODY } });
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();

		const toast = getVisualToastByText(LONG_TOAST_BODY);
		await settleEntry(toast);
		const mediaWrapper = toast.firstElementChild as HTMLElement;
		const layoutRow = mediaWrapper.firstElementChild as HTMLElement;
		const body = [...layoutRow.querySelectorAll<HTMLElement>('*')].find(
			(node) => node.textContent === LONG_TOAST_BODY
		) as HTMLElement;
		const endArea = body.nextElementSibling as HTMLElement;
		const actionControl = endArea.firstElementChild as HTMLElement;
		const dismissControl = endArea.querySelector<HTMLElement>(
			'button[aria-label="Dismiss notification"]'
		) as HTMLElement;

		expect(getComputedStyle(layoutRow).flexWrap).toBe('nowrap');
		// Chromium 158 normalises flex alignment keywords to their flow-* spelling
		// for a block container; accept both spellings of the same used value.
		expect(['flex-start', 'flow-start']).toContain(getComputedStyle(layoutRow).alignItems);
		expect(getComputedStyle(body).minWidth).toBe('0px');
		expect(getComputedStyle(body).overflowWrap).toBe('anywhere');
		expect(getComputedStyle(endArea).alignItems).toBe('center');
		expect(getComputedStyle(endArea).height).toBe(
			resolves(endArea, 'height', 'calc(var(--text-body-size) * var(--text-body-leading))')
		);
		expect(getComputedStyle(actionControl).height).toBe(
			resolves(actionControl, 'height', 'var(--size-element-lg)')
		);
		expect(getComputedStyle(dismissControl).height).toBe(
			resolves(dismissControl, 'height', 'var(--size-element-sm)')
		);
	});

	it('uses the viewport as the inline constraint for edge placements', async () => {
		const screen = await renderViewport([{ options: INFO_A }]);
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();

		const viewport = notificationRegions()[0];
		const style = getComputedStyle(viewport);

		// Upstream reads `ToastViewport.tsx` and asserts it does not contain
		// `100lvh - 100dvh`, a viewport-unit trick for the mobile URL bar that
		// would move the toast stack as the bar shows and hides. Against the
		// compiled rules instead, scoped to the landmark's own — see `rulesMatching`.
		expect(someRuleFor([viewport], '100lvh')).toBe(false);
		expect(someRuleFor([viewport], '100dvh')).toBe(false);
		expect(style.boxSizing).toBe('border-box');
		expectSpansInlineAxisWithoutOverflowing(viewport);
		expect(style.paddingInlineEnd).not.toBe('0px');
		// Upstream's `'0'` is jsdom echoing the declaration; Chromium computes a
		// used length.
		expect(style.insetInlineStart).toBe('0px');
		expect(style.insetInlineEnd).toBe('0px');
	});

	it('preserves custom start and end insets in LTR and RTL without forcing full width', async () => {
		for (const dir of ['ltr', 'rtl'] as const) {
			const screen = await render(LongBody, {
				props: { body: 'Inset toast', inset: { bottom: 24, start: 24, end: 40 } }
			});
			document.documentElement.dir = dir;
			(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
			await tick();

			const viewport = notificationRegions()[0];
			// Inline styles, so these read the same on both sides.
			expect(viewport.style.bottom).toBe('24px');
			expect(viewport.style.insetInlineStart).toBe('24px');
			expect(viewport.style.insetInlineEnd).toBe('40px');
			expect(viewport.getBoundingClientRect().width).toBeLessThan(
				document.documentElement.clientWidth
			);

			screen.unmount();
			document.documentElement.dir = '';
		}
	});
});
describe('ToastViewport placement', () => {
	async function renderPlacement({
		position,
		triggerLabel = 'Trigger',
		body = 'Placed'
	}: { position?: ToastPosition; triggerLabel?: string; body?: string } = {}) {
		const screen = await render(Harness, {
			props: { triggers: [{ options: { body, isAutoHide: false }, triggerLabel }], position }
		});
		(screen.getByText(triggerLabel, { exact: true }).element() as HTMLElement).click();
		await tick();
		return { screen, viewport: notificationRegions()[0] };
	}

	it('defaults to bottomEnd with an end-aligned full-inline viewport', async () => {
		const { viewport } = await renderPlacement();

		expect(getComputedStyle(viewport).bottom).toBe('0px');
		expect(['flex-end', 'flow-end']).toContain(getComputedStyle(viewport).alignItems);
		expectSpansInlineAxisWithoutOverflowing(viewport);
	});

	// The viewport is positioned by spanning the inline axis and aligning within
	// itself, which only works if the box actually spans. `popover` makes that
	// conditional: the UA stylesheet gives every popover `width: fit-content`,
	// and a shrink-wrapped box cannot honour both inset edges — it resolves
	// against the start edge, and an end-aligned toast lands on the LEFT.
	//
	// jsdom resolves no UA popover styles and no cascade, so it cannot reproduce
	// that. What it CAN hold is the reset itself: the declaration is what stops
	// the UA rule applying, so its absence is the regression. Chromium computes
	// `width: auto` to a used pixel value, so the declaration is read from the
	// rules that apply to the landmark (see `rulesMatching`), and the rendered
	// consequence is the inline span checked beside it.
	it('resets the UA popover width so the viewport can span the inline axis', async () => {
		const { viewport } = await renderPlacement();

		expect(someRuleFor([viewport], 'width: auto')).toBe(true);
		expect(someRuleFor([viewport], 'width: fit-content')).toBe(false);
		expect(getComputedStyle(viewport).width).not.toBe('fit-content');
		expectSpansInlineAxisWithoutOverflowing(viewport);
	});

	it('maps explicit top and bottom placements to their configured edge', async () => {
		const top = await renderPlacement({ position: 'topEnd' });
		expect(getComputedStyle(top.viewport).top).toBe('0px');
		expect(['flex-end', 'flow-end']).toContain(getComputedStyle(top.viewport).alignItems);
		expect(getComputedStyle(top.viewport).flexDirection).toBe('column-reverse');
		top.screen.unmount();

		const bottom = await renderPlacement({
			position: 'bottomStart',
			triggerLabel: 'Bottom trigger',
			body: 'Bottom start'
		});
		expect(getComputedStyle(bottom.viewport).bottom).toBe('0px');
		expect(['flex-start', 'flow-start']).toContain(getComputedStyle(bottom.viewport).alignItems);
		bottom.screen.unmount();
	});
});

it('keeps newest toasts nearest the configured edge in wide stacks', async () => {
	const screen = await render(TwoViewports);
	for (const label of [
		'Bottom first',
		'Bottom second',
		'Bottom third',
		'Top first',
		'Top second',
		'Top third'
	]) {
		(screen.getByText(label, { exact: true }).element() as HTMLElement).click();
		await tick();
	}

	const [bottom, top] = notificationRegions();
	expect(getComputedStyle(bottom).flexDirection).toBe('column');
	expect(cardTextsIn(bottom)).toEqual(['Bottom first', 'Bottom second', 'Bottom third']);
	expect(getComputedStyle(top).flexDirection).toBe('column-reverse');
	expect(cardTextsIn(top)).toEqual(['Top first', 'Top second', 'Top third']);
});

describe('ToastViewport visible limit', () => {
	async function renderMany(maxVisible?: number) {
		const screen = await render(Harness, {
			props: {
				triggers: [
					{ options: { body: 'One', isAutoHide: false }, triggerLabel: 'One' },
					{ options: { body: 'Two', isAutoHide: false }, triggerLabel: 'Two' },
					{ options: { body: 'Three', isAutoHide: false }, triggerLabel: 'Three' }
				],
				maxVisible
			}
		});
		for (const label of ['One', 'Two', 'Three']) {
			(screen.getByText(label, { exact: true }).element() as HTMLElement).click();
		}
		await tick();
		return { screen, viewport: notificationRegions()[0] };
	}

	it('keeps the five-toast default and supports an explicit one-visible cap', async () => {
		const all = await renderMany();
		expect(all.viewport.querySelectorAll('button[aria-label="Dismiss notification"]')).toHaveLength(
			3
		);
		all.screen.unmount();

		const capped = await renderMany(1);
		expect(
			capped.viewport.querySelectorAll('button[aria-label="Dismiss notification"]')
		).toHaveLength(1);
		expect(capped.viewport.textContent).toContain('Three');
		capped.screen.unmount();
	});
});

describe('dismissing a toast that has no mounted row', () => {
	it('reports a hidden toast once when it is dismissed twice before the viewport renders again', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'hidden-twice', maxVisible: 1, onHide }
		});
		(screen.getByText('Show A', { exact: true }).element() as HTMLElement).click();
		(screen.getByText('Show B', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(screen.locator.getByText('Toast A', { exact: true }).query()).toBeNull();

		// Both calls land in one batch, before the list renders without A.
		(screen.getByText('Dismiss A twice', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
	});

	it('frees the slot of a toast dismissed while it was hidden past maxVisible', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'hidden-slot', maxVisible: 2, onHide }
		});
		for (const label of ['Show A', 'Show B', 'Show C']) {
			(screen.getByText(label, { exact: true }).element() as HTMLElement).click();
		}
		await tick();
		// Only the newest two are shown: A is hidden past the limit.
		expect(screen.locator.getByText('Toast A', { exact: true }).query()).toBeNull();

		(screen.getByText('Dismiss A', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
		expect(onHide).toHaveBeenCalledWith('manual');

		// C leaves. A was dismissed, so it must not come back to hold the slot
		// as an empty row: B is the only toast left.
		const toastC = getToastWrapperByText('Toast C');
		(toastC.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		completeExit(toastC.dataset.toastId ?? '');
		await tick();
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
		expect(screen.locator.getByText('Toast B', { exact: true }).query()).not.toBeNull();

		// Once B leaves too, nothing is left: no row, no empty landmark.
		const toastB = getToastWrapperByText('Toast B');
		(toastB.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		completeExit(toastB.dataset.toastId ?? '');
		await tick();
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(0);
		expect(notificationRegions()).toHaveLength(0);
		expect(onHide).toHaveBeenCalledTimes(1);
	});

	it('never shows a toast dismissed before it rendered, and reports it once', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'dismiss-before-render', onHide }
		});
		(screen.getByText('Show and dismiss', { exact: true }).element() as HTMLElement).click();
		await tick();

		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(0);
		expect(notificationRegions()).toHaveLength(0);
		expect(onHide).toHaveBeenCalledTimes(1);
		expect(onHide).toHaveBeenCalledWith('manual');
	});
});
describe('ToastViewport keyboard reach + focus', () => {
	it('F6 moves focus into the newest toast', async () => {
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Trigger A' }]);
		const trigger = screen.getByText('Trigger A', { exact: true }).element() as HTMLElement;
		trigger.focus();
		trigger.click();
		await tick();

		// Scoped to the render container: the toast text is also mirrored into the
		// singleton live region, which lives on <body>, outside it.
		await expect.element(screen.locator.getByText('Toast A', { exact: true })).toBeInTheDocument();
		expect(document.activeElement).toBe(trigger);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));
		await tick();

		// Focus lands on the dismiss button of the newest toast.
		const dismiss = screen
			.getByRole('button', { name: 'Dismiss notification', exact: true })
			.element() as HTMLElement;
		expect(document.activeElement).toBe(dismiss);
	});

	it('keeps focus in the replacement when a control inside a toast raises its repeat and dismisses it', async () => {
		const screen = await render(ToastFlows, {
			props: { flow: 'offline', maxVisible: 2 }
		});
		(screen.getByText('Show two', { exact: true }).element() as HTMLElement).click();
		await tick();
		(screen.getByText('Show offline', { exact: true }).element() as HTMLElement).click();
		await tick();
		// Alpha waits hidden; Bravo and Offline show.
		const retry = screen
			.getByRole('button', { name: 'Retry', exact: true })
			.element() as HTMLElement;
		retry.focus();
		retry.click();
		await tick();
		// Toast.spec.md FR8: the repeat updates the card in place, so the pressed
		// Retry stays focused in it; dismissing the replaced toast leaves the row
		// to the replacement, and focus does not jump to a neighbour.
		const replacement = getToastWrapperByText('Still offline');
		expect(document.activeElement).toBe(retry);
		expect(replacement.contains(retry)).toBe(true);
		expect(screen.locator.getByText('Offline', { exact: true }).query()).toBeNull();
	});

	it('moves focus into the replacement when a control inside the only toast raises its repeat and dismisses it', async () => {
		const screen = await render(ToastFlows, { props: { flow: 'offline-only' } });
		(screen.getByText('Show offline', { exact: true }).element() as HTMLElement).click();
		await tick();
		const retry = screen
			.getByRole('button', { name: 'Retry', exact: true })
			.element() as HTMLElement;
		retry.focus();
		retry.click();
		await tick();
		// FR10: the replacement is the remaining toast, so focus goes into it.
		expect(getToastWrapperByText('Still offline').contains(document.activeElement)).toBe(true);
	});

	it('moves focus to a toast that shows when a control inside a toast raises two toasts at the cap and dismisses its own', async () => {
		const screen = await render(ToastFlows, {
			props: { flow: 'upload', maxVisible: 1 }
		});
		(screen.getByText('Save', { exact: true }).element() as HTMLElement).click();
		await tick();
		const uploadButton = screen
			.getByRole('button', { name: 'Upload', exact: true })
			.element() as HTMLElement;
		uploadButton.focus();
		uploadButton.click();
		await tick();
		// FR10: with one visible place, "Uploaded" shows and "Uploading" waits
		// hidden, so focus goes to "Uploaded", not to the hidden toast or the
		// region.
		expect(getToastWrapperByText('Uploaded').contains(document.activeElement)).toBe(true);
	});

	it('dismissing a focused toast moves focus to a remaining toast, not body', async () => {
		const screen = await renderViewport([
			{ options: INFO_A, triggerLabel: 'Trigger A' },
			{ options: INFO_B, triggerLabel: 'Trigger B' }
		]);
		(screen.getByText('Trigger A', { exact: true }).element() as HTMLElement).click();
		await tick();
		(screen.getByText('Trigger B', { exact: true }).element() as HTMLElement).click();
		await tick();

		expect(dismissButtons()).toHaveLength(2);

		// Focus the first toast's dismiss button, then dismiss it.
		const firstToast = document.querySelectorAll('[data-toast-id]')[0];
		const firstToastId = firstToast.getAttribute('data-toast-id') as string;
		const firstDismiss = firstToast.querySelector<HTMLElement>(
			'button[aria-label="Dismiss notification"]'
		) as HTMLElement;
		firstDismiss.focus();
		expect(document.activeElement).toBe(firstDismiss);

		firstDismiss.click();
		await tick();
		completeExit(firstToastId);
		await tick();

		// Focus must NOT drop to <body>; it moves to the remaining toast.
		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Dismiss notification');
	});

	it('dismissing the last focused toast restores the previously-focused element', async () => {
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Trigger A' }]);
		const trigger = screen.getByText('Trigger A', { exact: true }).element() as HTMLElement;
		trigger.focus();
		trigger.click();
		await tick();

		// F6 into the toast, remembering the trigger as the prior focus.
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));
		await tick();
		const dismiss = screen
			.getByRole('button', { name: 'Dismiss notification', exact: true })
			.element() as HTMLElement;
		expect(document.activeElement).toBe(dismiss);

		const toastId = toastIds()[0];

		dismiss.click();
		await tick();
		completeExit(toastId);
		await tick();

		// No toasts left — focus returns to the element focused before F6.
		expect(document.activeElement).toBe(trigger);
	});

	it('restores focus after a toast reached with Tab rather than F6 is dismissed', async () => {
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Trigger A' }]);
		const trigger = screen.getByText('Trigger A', { exact: true }).element() as HTMLElement;
		trigger.focus();
		trigger.click();
		await tick();
		const dismiss = screen
			.getByRole('button', { name: 'Dismiss notification', exact: true })
			.element() as HTMLElement;
		// Tab (or a click) moves focus straight to the toast's control.
		dismiss.focus();
		const toastId = toastIds()[0];

		dismiss.click();
		await tick();
		completeExit(toastId);
		await tick();

		expect(document.activeElement).toBe(trigger);
	});

	// FR8: an overwrite updates the card in place under the same key, so focus
	// inside it stays on the same control.
	it('keeps focus on a control inside a toast that an overwrite updates', async () => {
		const screen = await render(ToastFlows, { props: { flow: 'overwrite' } });
		(screen.getByText('Start', { exact: true }).element() as HTMLElement).click();
		await tick();
		const cancel = screen
			.getByRole('button', { name: 'Cancel upload', exact: true })
			.element() as HTMLElement;
		cancel.focus();

		(screen.getByText('Progress', { exact: true }).element() as HTMLElement).click();
		await tick();

		const viewport = notificationRegions()[0];
		expect(viewport.textContent).toContain('Uploading 60%');
		expect(cancel.isConnected).toBe(true);
		expect(document.activeElement).toBe(cancel);
	});

	// FR2, FR8: an overwrite that turns the card into one that auto-hides keeps
	// the timer held while focus is inside it.
	it('keeps an overwritten toast held while focus is inside when it starts auto-hiding', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const screen = await render(ToastFlows, {
				props: { flow: 'overwrite-autohide', onHide }
			});
			(screen.getByText('Start', { exact: true }).element() as HTMLElement).click();
			await tick();
			const cancel = screen
				.getByRole('button', { name: 'Cancel upload', exact: true })
				.element() as HTMLElement;
			cancel.focus();

			(screen.getByText('Finish', { exact: true }).element() as HTMLElement).click();
			await tick();
			vi.advanceTimersByTime(5000);
			await tick();

			expect(onHide).not.toHaveBeenCalled();
			expect(document.activeElement).toBe(cancel);
		} finally {
			vi.useRealTimers();
		}
	});

	// FR2: an update that removes the focused control drops its focus hold, so
	// a control-free, auto-hiding replacement still hides on time.
	it('auto-hides a control-free replacement after the update removes the focused control', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const screen = await render(ToastFlows, {
				props: { flow: 'overwrite-autohide-quiet', onHide }
			});
			const start = screen.getByText('Start', { exact: true }).element() as HTMLElement;
			start.focus();
			start.click();
			await tick();
			(
				screen.getByRole('button', { name: 'Cancel upload', exact: true }).element() as HTMLElement
			).focus();

			// A control-free, auto-hiding replacement: the focus hold must go with
			// the control.
			(screen.getByText('Finish', { exact: true }).element() as HTMLElement).click();
			await tick();
			vi.advanceTimersByTime(2500);
			await tick();

			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	// FR2: a window hold taken while the toast auto-hid does not outlive the
	// listeners an update that turns auto-hide off removes.
	it('auto-hides again after an update turns auto-hide off and on across a window blur', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const screen = await render(ToastFlows, {
				props: { flow: 'network', onHide }
			});
			(screen.getByText('Sync', { exact: true }).element() as HTMLElement).click();
			await tick();
			window.dispatchEvent(new Event('blur'));
			(screen.getByText('Lose network', { exact: true }).element() as HTMLElement).click();
			await tick();
			window.dispatchEvent(new Event('focus'));
			(screen.getByText('Reconnect', { exact: true }).element() as HTMLElement).click();
			await tick();
			vi.advanceTimersByTime(2500);
			await tick();

			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	// FR9: the viewport is the one announcement owner, so a card updated in
	// place carries no live region of its own.
	it('announces an overwrite once, through the viewport only', async () => {
		const screen = await render(ToastFlows, { props: { flow: 'overwrite' } });
		(screen.getByText('Start', { exact: true }).element() as HTMLElement).click();
		await tick();
		(screen.getByText('Progress', { exact: true }).element() as HTMLElement).click();
		await tick();

		// The toast's text sits in no live region inside its row: only the
		// viewport's own announcer speaks it.
		const row = getToastWrapperByText('Uploading 60%');
		const body = [...row.querySelectorAll<HTMLElement>('*')].find(
			(element) => element.children.length === 0 && element.textContent?.trim() === 'Uploading 60%'
		) as HTMLElement;
		const liveAncestor = body.closest('[aria-live], [role="status"], [role="alert"]');
		expect(liveAncestor == null || !row.contains(liveAncestor)).toBe(true);
	});

	// FR8, FR10: when the overwrite removes the focused control, focus moves as
	// FR10 hands it off, never to the page body.
	it('hands focus off when an overwrite removes the focused control', async () => {
		const screen = await render(ToastFlows, { props: { flow: 'overwrite-remove' } });
		const start = screen.getByText('Start', { exact: true }).element() as HTMLElement;
		start.focus();
		start.click();
		await tick();
		(
			screen.getByRole('button', { name: 'Cancel upload', exact: true }).element() as HTMLElement
		).focus();

		(screen.getByText('Finish', { exact: true }).element() as HTMLElement).click();
		await tick();

		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement).toBe(start);
	});

	// FR10: dismissing a focused toast beside a control-free one never drops
	// focus to the page body; with no control to take it, the remembered
	// element does.
	it('restores the remembered element when only a control-free toast remains', async () => {
		const screen = await render(ToastFlows, { props: { flow: 'quiet-and-b' } });
		(screen.getByText('Trigger quiet', { exact: true }).element() as HTMLElement).click();
		await tick();
		const trigger = screen.getByText('Trigger B', { exact: true }).element() as HTMLElement;
		trigger.focus();
		trigger.click();
		await tick();
		const dismiss = screen
			.getByRole('button', { name: 'Dismiss notification', exact: true })
			.element() as HTMLElement;
		dismiss.focus();
		const toastId = dismiss.closest('[data-toast-id]')?.getAttribute('data-toast-id') as string;

		dismiss.click();
		await tick();
		completeExit(toastId);
		await tick();

		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement).toBe(trigger);
	});

	// UNPORTED: `keeps the return target while focus visits portaled toast
	// content`. Upstream renders `createPortal(<button>Portaled</button>,
	// document.body)` inside `renderContent`; React bubbles the portal's focus
	// events through the toast's own React tree, which is how the viewport knows
	// focus has come back from content that sits outside its DOM. Svelte has no
	// portal primitive that preserves that event path, and moving a node to
	// `document.body` with an action (the closest emulation) makes the focus
	// return look like a fresh entry from outside, so the case would assert a
	// different mechanism. It needs a portal equivalent, not a test.
});

describe('Toast blur timer pause', () => {
	// RESTATED. Upstream's middle assertion — "still present" after 5000ms of a
	// 3000ms timer — does not discriminate: a dismissed toast stays mounted for
	// its exit transition, so `getByText('Auto toast')` still finds it whether the
	// timer paused or fired. Deleting the `window.addEventListener('blur', …)`
	// registration from Toast leaves this case entirely green. Upstream's
	// assertion is kept verbatim and an `onHide` spy added beside it, which is the
	// observable that actually distinguishes "paused" from "fired and exiting".
	// `onHide` is an ordinary `ToastOptions` field already used by cases 6 and 7,
	// so nothing is invented; it is the same question the title asks.
	it('pauses the auto-hide timer while the window is blurred', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const screen = await renderViewport([
				{ options: { ...AUTO_TOAST, onHide }, triggerLabel: 'Trigger Auto' }
			]);
			(screen.getByText('Trigger Auto', { exact: true }).element() as HTMLElement).click();
			await tick();
			expect(screen.container.textContent).toContain('Auto toast');

			// Window loses focus — timer should pause.
			window.dispatchEvent(new Event('blur'));
			vi.advanceTimersByTime(5000);
			await tick();
			// Still present because the timer was paused while blurred.
			expect(screen.container.textContent).toContain('Auto toast');
			expect(onHide).not.toHaveBeenCalled();

			// Window regains focus — timer resumes and the toast dismisses.
			window.dispatchEvent(new Event('focus'));
			vi.advanceTimersByTime(5000);
			await tick();
			const toastId = toastIds()[0];
			if (toastId) {
				completeExit(toastId);
				await tick();
			}
			expect(screen.container.textContent).not.toContain('Auto toast');
			expect(onHide).toHaveBeenCalledExactlyOnceWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('Toast raised while the window is blurred', () => {
	// FR2: a toast raised while the document does not have focus starts held,
	// so it cannot expire before the user returns to the window.
	it('starts its auto-hide timer held until the window regains focus', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
		try {
			const screen = await renderViewport([{ options: AUTO_TOAST, triggerLabel: 'Trigger Auto' }]);
			(screen.getByText('Trigger Auto', { exact: true }).element() as HTMLElement).click();
			await tick();
			const viewport = notificationRegions()[0];
			const heldId = toastIds()[0];
			vi.advanceTimersByTime(30_000);
			await tick();
			// An exit that had started would finish here and remove the toast.
			if (heldId) {
				completeExit(heldId);
				await tick();
			}
			expect(viewport.textContent).toContain('Auto toast');

			hasFocus.mockReturnValue(true);
			window.dispatchEvent(new Event('focus'));
			vi.advanceTimersByTime(10_000);
			await tick();
			const toastId = toastIds()[0];
			if (toastId) {
				completeExit(toastId);
				await tick();
			}
			expect(viewport.textContent).not.toContain('Auto toast');
		} finally {
			hasFocus.mockRestore();
			vi.useRealTimers();
		}
	});
});

describe('ToastViewport region ARIA', () => {
	// Upstream 0.5.1 gated the landmark on there being something to announce, and
	// split this into two cases: an empty viewport exposes no region at all, and the
	// region that appears with a toast still must not declare aria-modal.
	it('does not expose an empty notifications landmark', async () => {
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Trigger A' }]);
		expect(screen.getByRole('region', { name: 'Notifications', exact: true }).query()).toBeNull();
	});

	it('exposes the notifications region without a prohibited aria-modal when a toast is visible', async () => {
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Trigger A' }]);
		const trigger = screen.getByText('Trigger A', { exact: true }).element() as HTMLElement;
		trigger.click();
		await tick();

		const region = screen.getByRole('region', { name: 'Notifications', exact: true });
		// aria-modal is only valid on role="dialog"/"alertdialog"; a region must
		// not declare it (axe: aria-allowed-attr).
		await expect.element(region).not.toHaveAttribute('aria-modal');
	});

	it('does not duplicate the landmark for nested viewports', async () => {
		const screen = await render(NestedViewports, { props: { options: INFO_A } });
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();

		expect(
			screen.getByRole('region', { name: 'Notifications', exact: true }).elements()
		).toHaveLength(1);
	});
});

describe('toast announcements via singleton live regions', () => {
	const ERROR_TOAST: ToastOptions = { body: 'Upload failed', type: 'error' };
	const SAVING_V1: ToastOptions = { uniqueID: 'save', body: 'Saving changes' };
	const SAVING_V2: ToastOptions = { uniqueID: 'save', body: 'Changes saved' };
	const IGNORE_KEPT: ToastOptions = {
		uniqueID: 'dup',
		collisionBehavior: 'ignore',
		body: 'Kept'
	};
	const IGNORE_DROPPED: ToastOptions = {
		uniqueID: 'dup',
		collisionBehavior: 'ignore',
		body: 'Dropped'
	};

	let recorder: { calls: AnnounceRecord[]; stop: () => void } | null = null;
	afterEach(() => {
		recorder?.stop();
		recorder = null;
	});

	it('announces an info toast politely with its text content', async () => {
		// RESTATED IN INPUT. Upstream's body is a React fragment
		// (`<strong>Update ready</strong><div>Restart to apply</div>`) flattened to
		// "Update ready Restart to apply" by its `getNodeText`. `ToastContent` is
		// `string | Snippet` here and a `Snippet` is opaque — there is no children
		// tree to walk — so the announced value is the string body. See
		// `toastText` in `toast-viewport.svelte` for why a snippet body falls back
		// to the toast's own (born-with-content) region instead.
		recorder = recordAnnouncements();
		const screen = await renderViewport([{ options: INFO_A, triggerLabel: 'Show' }]);
		(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();

		// Announced at dispatch, exactly once, into the polite region.
		expect(recorder.calls).toEqual([['Toast A', 'polite']]);
		expect(regionText('polite')).toBe('Toast A');
		// Status toasts never touch the assertive region.
		expect(regionText('assertive')).toBe('');
	});

	it('announces an error toast assertively', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([{ options: ERROR_TOAST, triggerLabel: 'Show' }]);
		(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();

		expect(recorder.calls).toEqual([['Upload failed', 'assertive']]);
		expect(regionText('assertive')).toBe('Upload failed');
		expect(regionText('polite')).toBe('');
	});

	it('announces exactly once at dispatch, even when dispatched from an effect', async () => {
		// RESTATED. Upstream renders under `React.StrictMode`, whose double render
		// and double-invoked state updater are what its announcement must survive;
		// Svelte has neither, so the case would assert nothing. The Svelte-shaped
		// version of the same hazard is the consumer pattern `addToast`'s own
		// comment documents: dispatching from a `$effect`. If the announcement (or
		// the read around it) subscribed that effect to the viewport's toast list,
		// the effect's own write would re-run it and announce again — which is
		// exactly what `untrack` inside `addToast` prevents. Same question, same
		// observable: one dispatch, one announcement.
		recorder = recordAnnouncements();
		await render(EffectDispatch, { props: { options: INFO_A } });
		await settleAnnouncements();

		expect(recorder.calls).toEqual([['Toast A', 'polite']]);
	});

	it('re-announces a uniqueID toast when its content is overwritten', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([
			{ options: SAVING_V1, triggerLabel: 'Show v1' },
			{ options: SAVING_V2, triggerLabel: 'Show v2' }
		]);
		(screen.getByText('Show v1', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([['Saving changes', 'polite']]);

		// Overwriting via uniqueID replaces the toast in place — the new content is
		// a fresh dispatch and must be announced again.
		(screen.getByText('Show v2', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([
			['Saving changes', 'polite'],
			['Changes saved', 'polite']
		]);
		expect(regionText('polite')).toBe('Changes saved');

		// Still a single toast on screen — overwritten in place, not stacked.
		expect(screen.container.querySelectorAll('[data-toast-id]')).toHaveLength(1);
	});

	it('does not re-announce an unchanged toast when an unrelated render occurs', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([
			{ options: INFO_A, triggerLabel: 'Show A' },
			{ options: ERROR_TOAST, triggerLabel: 'Show B' }
		]);
		(screen.getByText('Show A', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toHaveLength(1);

		// A second toast arriving re-renders the viewport with a new toast list.
		// Toast A is not re-dispatched, so it must not be announced again — only
		// the newly dispatched toast produces a call.
		(screen.getByText('Show B', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([
			['Toast A', 'polite'],
			['Upload failed', 'assertive']
		]);
	});

	it('does not announce a toast whose uniqueID collision is ignored', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([
			{ options: IGNORE_KEPT, triggerLabel: 'Show 1' },
			{ options: IGNORE_DROPPED, triggerLabel: 'Show 2' }
		]);
		(screen.getByText('Show 1', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([['Kept', 'polite']]);

		// The colliding toast is suppressed (collisionBehavior: 'ignore'), so it is
		// neither shown nor announced.
		(screen.getByText('Show 2', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([['Kept', 'polite']]);
		expect(screen.container.textContent).toContain('Kept');
		expect(screen.container.textContent).not.toContain('Dropped');
	});

	it('drops an ignored-collision toast while its namesake is still leaving', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([
			{
				options: {
					uniqueID: 'offline',
					collisionBehavior: 'ignore',
					isAutoHide: false,
					body: 'You are offline'
				},
				triggerLabel: 'Show 1'
			},
			{
				options: {
					uniqueID: 'offline',
					collisionBehavior: 'ignore',
					isAutoHide: false,
					body: 'Still offline'
				},
				triggerLabel: 'Show 2'
			}
		]);
		(screen.getByText('Show 1', { exact: true }).element() as HTMLElement).click();
		await tick();
		const first = getToastWrapperByText('You are offline');
		(first.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// FR8: a leaving toast still holds its uniqueID, so the ignored namesake
		// is neither shown nor announced.
		(screen.getByText('Show 2', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toHaveLength(1);
		expect(screen.locator.getByText('Still offline', { exact: true }).query()).toBeNull();
		completeExit(first.dataset.toastId ?? '');
		await tick();
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(0);
	});

	it('lets a leaving toast finish its exit when a new toast arrives with no cap', async () => {
		const screen = await render(Harness, {
			props: {
				triggers: [
					{ options: { isAutoHide: false, body: 'Saved' }, triggerLabel: 'Show 1' },
					{ options: { isAutoHide: false, body: 'Uploaded' }, triggerLabel: 'Show 2' }
				],
				maxVisible: 0
			}
		});
		(screen.getByText('Show 1', { exact: true }).element() as HTMLElement).click();
		await tick();
		const first = getToastWrapperByText('Saved');
		const firstId = first.dataset.toastId ?? '';
		(first.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// maxVisible={0} shows every toast (FR7), so the closing toast keeps its
		// row and collapses (FR5) while the new one arrives.
		(screen.getByText('Show 2', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(getToastWrapperByText('Saved').dataset.toastId).toBe(firstId);
		expect(screen.locator.getByText('Uploaded', { exact: true }).query()).not.toBeNull();
		completeExit(firstId);
		await tick();
		expect(screen.locator.getByText('Saved', { exact: true }).query()).toBeNull();
		expect(screen.locator.getByText('Uploaded', { exact: true }).query()).not.toBeNull();
	});

	it('drops a second ignore toast with the same uniqueID raised in the same handler', async () => {
		recorder = recordAnnouncements();
		const screen = await render(ToastFlows, { props: { flow: 'two-ignored' } });
		(screen.getByText('Show twice', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		// FR8 and ORD1: the ignored namesake is neither shown nor announced, even
		// before the first toast renders.
		expect(recorder.calls).toEqual([['You are offline', 'polite']]);
		const rows = [...document.querySelectorAll('[data-toast-id]')];
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('You are offline');
	});

	it('leaves no row behind when a new toast takes the last visible slot from a leaving one', async () => {
		const screen = await render(Harness, {
			props: {
				triggers: [
					{ options: { isAutoHide: false, body: 'Saved' }, triggerLabel: 'Show 1' },
					{ options: { isAutoHide: false, body: 'Uploaded' }, triggerLabel: 'Show 2' }
				],
				maxVisible: 1
			}
		});
		(screen.getByText('Show 1', { exact: true }).element() as HTMLElement).click();
		await tick();
		const first = getToastWrapperByText('Saved');
		(first.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// A new toast arrives at once; with one visible slot it takes the place of
		// the leaving toast, which can no longer finish its exit on screen.
		(screen.getByText('Show 2', { exact: true }).element() as HTMLElement).click();
		await tick();
		const second = getToastWrapperByText('Uploaded');
		(second.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		completeExit(second.dataset.toastId ?? '');
		await tick();
		// Nothing is left: no row comes back, and the landmark is gone.
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(0);
		expect(notificationRegions()).toHaveLength(0);
	});

	it('reports the namesake once when one handler shows a repeat and dismisses the namesake', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'repeat-and-dismiss', onHide }
		});
		(screen.getByText('Show first', { exact: true }).element() as HTMLElement).click();
		await tick();
		(screen.getByText('Repeat and dismiss', { exact: true }).element() as HTMLElement).click();
		await tick();
		// The repeat replaces its namesake in place, and the namesake's dismissal
		// reports it once.
		expect(onHide).toHaveBeenCalledTimes(1);
		const rows = [...document.querySelectorAll('[data-toast-id]')];
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('Still offline');
	});

	it('leaves no row behind when one handler raises a toast at the cap and dismisses the one it pushed out', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'undo', maxVisible: 1, onHide }
		});
		(screen.getByText('Delete', { exact: true }).element() as HTMLElement).click();
		await tick();
		(screen.getByText('Undo', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
		const restored = getToastWrapperByText('Restored');
		(restored.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		completeExit(restored.dataset.toastId ?? '');
		await tick();
		// Nothing is left: no row comes back, and the landmark is gone.
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(0);
		expect(notificationRegions()).toHaveLength(0);
	});

	it('reports a leaving toast once when it is dismissed again after a new toast pushed it out of view', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'push-dismiss', maxVisible: 1, onHide }
		});
		(screen.getByText('Show first', { exact: true }).element() as HTMLElement).click();
		await tick();
		// It starts leaving, and reports it.
		(screen.getByText('Dismiss first', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
		// A new toast takes the only visible slot: the leaving one leaves the list.
		(screen.getByText('Show second', { exact: true }).element() as HTMLElement).click();
		await tick();
		// Its dismissal again reports nothing more.
		(screen.getByText('Dismiss first', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
		const rows = [...document.querySelectorAll('[data-toast-id]')];
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('Uploaded');
	});

	it('reports nothing for a toast replaced before it rendered, however often one handler dismisses it', async () => {
		const onHide = vi.fn();
		const screen = await render(ToastFlows, {
			props: { flow: 'replace-dismiss', onHide }
		});
		(
			screen.getByText('Show, replace and dismiss', { exact: true }).element() as HTMLElement
		).click();
		await tick();
		// FR3: a toast replaced through uniqueID is not dismissed and reports no
		// onHide.
		expect(onHide).not.toHaveBeenCalled();
		const rows = [...document.querySelectorAll('[data-toast-id]')];
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('Still offline');
	});

	it('replaces a leaving namesake in place under overwrite and announces it again', async () => {
		recorder = recordAnnouncements();
		const screen = await renderViewport([
			{
				options: { uniqueID: 'upload', isAutoHide: false, body: 'Upload 30%' },
				triggerLabel: 'Show 1'
			},
			{
				options: { uniqueID: 'upload', isAutoHide: false, body: 'Upload 31%' },
				triggerLabel: 'Show 2'
			}
		]);
		(screen.getByText('Show 1', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls).toEqual([['Upload 30%', 'polite']]);
		const first = getToastWrapperByText('Upload 30%');
		(first.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// FR8: an overwrite replaces its namesake in place even while it is
		// leaving, and is announced again.
		(screen.getByText('Show 2', { exact: true }).element() as HTMLElement).click();
		await settleAnnouncements();
		expect(recorder.calls.at(-1)).toEqual(['Upload 31%', 'polite']);
		expect(screen.locator.getByText('Upload 30%', { exact: true }).query()).toBeNull();
		const rows = [...document.querySelectorAll('[data-toast-id]')];
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('Upload 31%');
	});
});

describe('toast timer lifecycle (#3589)', () => {
	it('fires onHide exactly once when dismissed twice during the exit window', async () => {
		const onHide = vi.fn();
		const screen = await renderViewport([
			{ options: { body: 'Once', onHide }, triggerLabel: 'Show' }
		]);
		(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
		await tick();
		const dismiss = screen
			.getByRole('button', { name: 'Dismiss notification', exact: true })
			.element() as HTMLElement;
		dismiss.click();
		// The toast stays mounted during its exit transition; a second click
		// lands on the same still-mounted button. Upstream wraps each click in its
		// own `act()`, so the exit state is applied between them — the `await tick()`
		// is what makes that true here rather than firing both into one batch,
		// where the second click would land before anything had re-rendered.
		await tick();
		dismiss.click();
		await tick();
		expect(onHide).toHaveBeenCalledTimes(1);
	});

	// spec:Toast FR2/AR3: each pause condition is held on its own, so one
	// ending never resumes the timer while another still holds.
	async function showPausableToast(onHide: () => void) {
		const screen = await render(ToastFlows, { props: { flow: 'pausable', onHide } });
		(screen.getByText('Show held', { exact: true }).element() as HTMLElement).click();
		await tick();
		// The row's wrapper holds the clip, which holds the card.
		const wrapper = getToastWrapperByText('Held');
		const card = wrapper.firstElementChild?.firstElementChild;
		if (!(card instanceof HTMLElement)) {
			throw new Error('toast card not found');
		}
		const action = screen
			.getByRole('button', { name: 'Undo', exact: true })
			.element() as HTMLElement;
		return { screen, card, action };
	}

	function enter(card: HTMLElement): void {
		card.dispatchEvent(new MouseEvent('mouseenter'));
	}

	function leave(card: HTMLElement): void {
		card.dispatchEvent(new MouseEvent('mouseleave'));
	}

	it('keeps the timer paused while focus is inside after the pointer leaves', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const { card, action } = await showPausableToast(onHide);
			enter(card);
			action.focus();
			leave(card);
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).not.toHaveBeenCalled();
			// Focus leaving the card releases the last hold.
			action.blur();
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps the timer paused while the pointer is over it after the window regains focus', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const { card } = await showPausableToast(onHide);
			window.dispatchEvent(new Event('blur'));
			enter(card);
			window.dispatchEvent(new Event('focus'));
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).not.toHaveBeenCalled();
			leave(card);
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	it('releases the focus hold when the focused control is removed', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const { card, action } = await showPausableToast(onHide);
			enter(card);
			action.focus();
			// A control that unmounts while focused fires no blur.
			action.remove();
			leave(card);
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps the timer paused while focus moves between controls inside the card', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const { screen, action } = await showPausableToast(onHide);
			const dismiss = screen
				.getByRole('button', { name: 'Dismiss notification', exact: true })
				.element() as HTMLElement;
			action.focus();
			vi.advanceTimersByTime(2_000);
			await tick();
			dismiss.focus();
			// Moving between the card's own controls neither restarts nor resumes
			// the timer.
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps a window-blur pause alive when another toast arrives', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onHide = vi.fn();
			const screen = await renderViewport([
				{ options: { body: 'Paused', autoHideDuration: 3000, onHide }, triggerLabel: 'Show A' },
				{ options: INFO_B, triggerLabel: 'Show B' }
			]);
			(screen.getByText('Show A', { exact: true }).element() as HTMLElement).click();
			await tick();
			window.dispatchEvent(new Event('blur'));
			// A second toast arriving re-renders the viewport; the paused timer
			// must not silently restart.
			(screen.getByText('Show B', { exact: true }).element() as HTMLElement).click();
			await tick();
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).not.toHaveBeenCalled();
			// Focus returns: the remaining time resumes and completes normally.
			window.dispatchEvent(new Event('focus'));
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(onHide).toHaveBeenCalledTimes(1);
			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	describe('renderContent', () => {
		it('replaces the default layout for that toast', async () => {
			const screen = await render(RenderContentHarness, { props: { variant: 'custom' } });
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			await expect.element(screen.getByTestId('custom-content')).toHaveTextContent('Toast A');
		});

		it('keeps the default translated and themeable dismiss Button unchanged', async () => {
			const onHide = vi.fn();
			const screen = await renderViewport([
				{ options: { body: 'Plain', isAutoHide: false, onHide }, triggerLabel: 'Show' }
			]);
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			const toast = getToastCardByText('Plain');
			const dismissButton = toast.querySelector<HTMLElement>(
				'button[aria-label="Dismiss notification"]'
			) as HTMLElement;
			expect(dismissButton).toHaveClass('astryx-button');

			dismissButton.click();
			expect(onHide).toHaveBeenCalledTimes(1);
			expect(onHide).toHaveBeenCalledWith('manual');
		});

		it('dismisses exactly once from a composed custom Button and reports manual', async () => {
			const onHide = vi.fn();
			const screen = await render(RenderContentHarness, {
				props: { variant: 'custom', onHide }
			});
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			const dismissButton = screen
				.getByTestId('custom-content')
				.getByRole('button', { name: 'Dismiss custom toast', exact: true })
				.element() as HTMLElement;
			expect(dismissButton).toHaveClass('astryx-button');

			dismissButton.click();
			expect(onHide).toHaveBeenCalledTimes(1);
			expect(onHide).toHaveBeenCalledWith('manual');
		});

		it('lets the dismiss callback travel through nested components', async () => {
			const onHide = vi.fn();
			const screen = await render(RenderContentHarness, {
				props: { variant: 'nested', onHide }
			});
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			(
				screen.getByRole('button', { name: 'Nested dismiss', exact: true }).element() as HTMLElement
			).click();

			expect(onHide).toHaveBeenCalledTimes(1);
			expect(onHide).toHaveBeenCalledWith('manual');
		});

		it('does not inject a dismiss control into custom content', async () => {
			const screen = await render(RenderContentHarness, { props: { variant: 'controlFree' } });
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			const content = screen.getByTestId('control-free-content').element() as HTMLElement;
			expect(content).toHaveTextContent('Control-free');
			const toast = content.closest('.astryx-toast');
			expect(toast).not.toBeNull();
			expect((toast as HTMLElement).querySelector('button')).toBeNull();
		});

		it('leaves a toast that did not ask for custom content alone', async () => {
			const screen = await render(RenderContentHarness, {
				props: { variant: 'custom', withPlainTrigger: true }
			});
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			(screen.getByText('Plain', { exact: true }).element() as HTMLElement).click();
			await tick();

			const plain = getToastCardByText('Toast B');
			expect(plain.querySelector('button[aria-label="Dismiss notification"]')).toBeInTheDocument();
			expect(plain.querySelector('[data-testid="custom-content"]')).toBeNull();
		});

		it('hands endContent to the layout rather than dropping it', async () => {
			const screen = await render(RenderContentHarness, {
				props: { variant: 'custom', withEndContent: true }
			});
			(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
			await tick();

			await expect
				.element(
					screen.getByTestId('custom-content').getByRole('button', { name: 'Undo', exact: true })
				)
				.toBeInTheDocument();
		});

		it('still auto-dismisses and exposes its resolved timing', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			try {
				const onHide = vi.fn();
				const screen = await render(RenderContentHarness, {
					props: { variant: 'timing', onHide }
				});
				(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
				await tick();

				// Upstream captures these in a closure array; the snippet puts them on
				// the element instead — see the fixture.
				const layout = document.querySelector('[data-auto-hide]') as HTMLElement;
				expect(layout.dataset.autoHide).toBe('true');
				expect(layout.dataset.duration).toBe('3000');

				vi.advanceTimersByTime(3000);
				expect(onHide).toHaveBeenCalledWith('auto');
			} finally {
				vi.useRealTimers();
			}
		});

		it('keeps announcing through the live region', async () => {
			const recorded = recordAnnouncements();
			try {
				const screen = await render(RenderContentHarness, { props: { variant: 'custom' } });
				(screen.getByText('Show', { exact: true }).element() as HTMLElement).click();
				await settleAnnouncements();

				expect(recorded.calls).toContainEqual(['Toast A', 'polite']);
			} finally {
				recorded.stop();
			}
		});
	});
});

describe('Toast native motion contract', () => {
	async function renderMotionToast(position: ToastPosition, body = `Motion ${position}`) {
		const screen = await render(Harness, {
			props: {
				triggers: [{ options: { body, isAutoHide: false }, triggerLabel: `Show ${position}` }],
				position,
				maxVisible: 3
			}
		});
		(screen.getByText(`Show ${position}`, { exact: true }).element() as HTMLElement).click();
		await tick();
		await settleEntry(getToastWrapperByText(body));
		return {
			screen,
			visualToast: getVisualToastByText(body),
			wrapper: getToastWrapperByText(body)
		};
	}

	it('uses tokenized transform and wrapper timing, with reduced motion kept eventful', async () => {
		const { visualToast, wrapper } = await renderMotionToast('bottomEnd');
		const toastStyle = getComputedStyle(visualToast);
		const wrapperStyle = getComputedStyle(wrapper);
		const collapsible = wrapper.firstElementChild as HTMLElement;

		// Upstream reads the declaration back as the literal
		// `translateY(var(--_toast-swipe-y, 0px)) scale(var(--_toast-swipe-scale, 1))`.
		// Chromium resolves a transform to a matrix, so the tokens are checked by
		// driving them: the card must answer to both custom properties, in those
		// two roles. That is what the declaration is for, and a matrix read proves
		// it where a string match only describes it. It has to run after the entry
		// transition, which is itself a translateY — see `settleEntry`.
		// At rest both variables are unset, so the declaration's own fallbacks
		// (`0px` and `1`) are what render — upstream pins them in its string match,
		// and driving the variables is the one path that never exercises them.
		const resting = new DOMMatrix(getComputedStyle(visualToast).transform);
		expect(resting.m42).toBe(0);
		expect(resting.a).toBe(1);

		visualToast.style.setProperty('--_toast-swipe-y', '10px');
		visualToast.style.setProperty('--_toast-swipe-scale', '0.5');
		// `transform` is itself in `transition-property`, so driving the variables
		// starts a transition and a synchronous read still returns the old matrix.
		await settleEntry(visualToast);
		const driven = new DOMMatrix(getComputedStyle(visualToast).transform);
		expect(driven.m42).toBe(10);
		expect(driven.a).toBe(0.5);
		expect(driven.m41).toBe(0);
		visualToast.style.removeProperty('--_toast-swipe-y');
		visualToast.style.removeProperty('--_toast-swipe-scale');

		expect(toastStyle.transitionProperty).toBe('opacity, transform');
		expect(toastStyle.transitionDuration).toBe(
			resolves(visualToast, 'transition-duration', 'var(--duration-fast)')
		);
		expect(toastStyle.transitionTimingFunction).toBe(
			resolves(visualToast, 'transition-timing-function', 'var(--ease-standard)')
		);

		expect(wrapperStyle.transitionProperty).toBe('grid-template-rows, padding');
		expect(wrapperStyle.transitionDuration).toBe(
			resolves(wrapper, 'transition-duration', 'var(--duration-fast)')
		);
		expect(wrapperStyle.transitionTimingFunction).toBe(
			resolves(wrapper, 'transition-timing-function', 'var(--ease-standard)')
		);
		// A percentage resolves against the containing block, so the probe has to
		// be the wrapper's sibling rather than its child.
		expect(wrapperStyle.width).toBe(
			resolves(wrapper.parentElement as HTMLElement, 'width', '100%')
		);
		expect(wrapperStyle.maxWidth).toBe('400px');
		expect(wrapperStyle.minWidth).toBe('0px');
		expect(getComputedStyle(collapsible).minHeight).toBe('0px');
		// Upstream reads `hidden` here because jsdom runs no transitions: the row
		// is still in its entry state. `renderMotionToast` awaits that entry, and
		// the row then releases the paint clip so the card's shadow shows — the
		// lifecycle itself is the case after this one.
		expect(getComputedStyle(collapsible).overflow).toBe('visible');
	});

	it('releases the shadow clip only while the toast is settled', async () => {
		const screen = await render(Harness, {
			props: {
				triggers: [{ options: { body: 'Shadow lifecycle', isAutoHide: false } }]
			}
		});
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();

		const wrapper = getToastWrapperByText('Shadow lifecycle');
		const inner = wrapper.firstElementChild as HTMLElement;

		// Entry starts with the row's clip boundary.
		expect(getComputedStyle(inner).overflow).toBe('hidden');

		wrapper.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(inner).overflow).toBe('visible');

		(wrapper.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// Dismissal restores the clip boundary synchronously. The wrapper keeps
		// its normal hit boundary, so a second click while the toast is still
		// visible is absorbed by the toast rather than falling through to an
		// obscured control underneath.
		expect(getComputedStyle(inner).overflow).toBe('hidden');
		expect(getComputedStyle(wrapper).pointerEvents).toBe('auto');
	});

	it('ignores a grid-template-rows transition bubbling from a descendant', async () => {
		// `grid-template-rows` is not private to the wrapper: any descendant may
		// animate its own grid, and transitionend bubbles. Reading a descendant's
		// event as the row's own releases the clip before the row has opened, and
		// during exit it unmounts the toast mid-collapse.
		const screen = await render(Harness, {
			props: {
				triggers: [{ options: { body: 'Bubbled transition', isAutoHide: false } }]
			}
		});
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();

		const wrapper = getToastWrapperByText('Bubbled transition');
		const inner = wrapper.firstElementChild as HTMLElement;
		expect(getComputedStyle(inner).overflow).toBe('hidden');

		inner.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(inner).overflow).toBe('hidden');

		// The wrapper's own transition still settles it.
		wrapper.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(inner).overflow).toBe('visible');

		// Same guard on the exit path: a descendant's event must not cut the
		// collapse short and unmount the toast early.
		(wrapper.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		inner.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(screen.getByText('Bubbled transition', { exact: true }).query()).not.toBeNull();
	});

	it('updates a settled toast in place when an overwrite replaces it through uniqueID', async () => {
		// FR8: an overwrite keeps the replaced toast's row, so the card updates in
		// place: the row stays settled (no second entry transition) and carries
		// the new toast's id.
		const screen = await renderViewport(
			[
				{ options: { uniqueID: 'save', body: 'Saving changes' }, triggerLabel: 'Show v1' },
				{ options: { uniqueID: 'save', body: 'Changes saved' }, triggerLabel: 'Show v2' }
			],
			'bottomEnd'
		);

		(screen.getByText('Show v1', { exact: true }).element() as HTMLElement).click();
		await tick();
		const first = getToastWrapperByText('Saving changes');
		const firstId = first.getAttribute('data-toast-id');
		first.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(first.firstElementChild as HTMLElement).overflow).toBe('visible');

		(screen.getByText('Show v2', { exact: true }).element() as HTMLElement).click();
		await tick();
		const second = getToastWrapperByText('Changes saved');
		expect(second).toBe(first);
		expect(second.getAttribute('data-toast-id')).not.toBe(firstId);
		expect(getComputedStyle(second.firstElementChild as HTMLElement).overflow).toBe('visible');
		expect(document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
	});

	it('drops settled state when a toast is evicted and later resurfaces', async () => {
		// A toast beyond `maxVisible` unmounts without ever being dismissed, so
		// neither removeToast nor handleExited runs for it. When the stack drains
		// and it resurfaces, it mounts a fresh row that has to run its own entry
		// transition — a settled id left over from its previous life would
		// release the clip immediately, painting the card's shadow (and taking
		// pointer input) outside the row that is still opening.
		const screen = await render(Harness, {
			props: {
				triggers: [
					{ options: { body: 'First', isAutoHide: false }, triggerLabel: 'Show first' },
					{ options: { body: 'Second', isAutoHide: false }, triggerLabel: 'Show second' }
				],
				maxVisible: 1
			}
		});
		(screen.getByText('Show first', { exact: true }).element() as HTMLElement).click();
		await tick();

		const first = getToastWrapperByText('First');
		first.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(first.firstElementChild as HTMLElement).overflow).toBe('visible');

		// Evicted: still in the list, no longer rendered.
		(screen.getByText('Show second', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(screen.getByText('First', { exact: true }).query()).toBeNull();

		// Drain the stack so it comes back.
		const second = getToastWrapperByText('Second');
		second.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		(second.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		second.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();

		const resurfaced = getToastWrapperByText('First');
		expect(getComputedStyle(resurfaced.firstElementChild as HTMLElement).overflow).toBe('hidden');

		// And it settles again on its own transition, rather than being stuck.
		resurfaced.dispatchEvent(
			new TransitionEvent('transitionend', {
				propertyName: 'grid-template-rows',
				bubbles: true
			})
		);
		await tick();
		expect(getComputedStyle(resurfaced.firstElementChild as HTMLElement).overflow).toBe('visible');
	});

	it('keeps reduced motion transitions eventful for exit cleanup', async () => {
		// Upstream reads `Toast.tsx` and `ToastViewport.tsx` and asserts each
		// contains `'@media (prefers-reduced-motion: reduce)': '0.01ms'`. A browser
		// test cannot read a file, and the compiled sheet is the better subject
		// anyway — it is what ships. The property is the same one: reduced motion
		// shortens the transition rather than removing it, because the exit is
		// driven by `transitionend` and a `0s` transition never fires one.
		const { visualToast, wrapper } = await renderMotionToast('bottomEnd');
		const parts = [visualToast, wrapper];

		// Both sides of upstream's pair: the card's own transition and the
		// wrapper's each shorten to 0.01ms under reduced motion rather than
		// dropping to 0s, which would never fire the `transitionend` the exit is
		// driven by.
		// `rulesMatching` flattens away the enclosing at-rule, so it would pass on a
		// `0.01ms` that had been moved into the *default* — which is the regression
		// this case is named after. The pairing is what upstream pins, so the media
		// block's own text is what is searched.
		expect(reducedMotionRules().some((rule) => rule.includes('0.01ms'))).toBe(true);
		for (const part of parts) {
			expect(rulesMatching(part).some((rule) => rule.includes('0.01ms'))).toBe(true);
		}
		expect(someRuleFor(parts, 'transition-duration: 0s')).toBe(false);
	});

	it('slides from the top or bottom edge without adding corner or scale motion', async () => {
		const bottom = await renderMotionToast('bottomEnd');
		// `--_toast-slide-y` is a custom property, whose computed value is a token
		// stream rather than a length — Chromium may hand back either the
		// substituted value or the `calc()` unevaluated. Both sides are resolved
		// through the same probe so the comparison is of lengths.
		expect(resolves(bottom.wrapper, 'margin-top', 'var(--_toast-slide-y)')).toBe(
			resolves(bottom.wrapper, 'margin-top', 'var(--spacing-2)')
		);
		bottom.screen.unmount();

		const top = await renderMotionToast('topStart');
		expect(resolves(top.wrapper, 'margin-top', 'var(--_toast-slide-y)')).toBe(
			resolves(top.wrapper, 'margin-top', 'calc(-1 * var(--spacing-2))')
		);
		top.screen.unmount();

		// Upstream's two `not.toContain` reads of `Toast.tsx`, against the rules
		// that actually apply to the toast rather than the whole sheet — another
		// component does use `scale(0.98)`, so an unscoped scan answers the wrong
		// question.
		// Upstream reads the whole of `Toast.tsx`, which covers every element the
		// toast renders — so the scan takes the card, the wrapper and every
		// descendant, not just the two roots. `toast.stylex.ts` styles four more.
		const settled = await renderMotionToast('bottomEnd', 'Motion scan');
		const parts = [settled.wrapper, ...settled.wrapper.querySelectorAll<HTMLElement>('*')];
		expect(someRuleFor(parts, 'scale(0.98)')).toBe(false);
		expect(someRuleFor(parts, 'transform-origin')).toBe(false);
		settled.screen.unmount();
	});

	it('uses an 8px inter-Toast gap without adding space at the viewport edge', async () => {
		const bottom = await renderViewport([
			{ options: INFO_A, triggerLabel: 'Show A' },
			{ options: INFO_B, triggerLabel: 'Show B' }
		]);
		(bottom.getByText('Show A', { exact: true }).element() as HTMLElement).click();
		(bottom.getByText('Show B', { exact: true }).element() as HTMLElement).click();
		await tick();

		const viewport = notificationRegions()[0];
		const wrappers = [...viewport.querySelectorAll<HTMLElement>('[data-toast-id]')];
		await Promise.all(wrappers.map(settleEntry));
		expect(getComputedStyle(wrappers[0]).paddingBottom).toBe(
			resolves(wrappers[0], 'padding-bottom', 'var(--spacing-2)')
		);
		expect(getComputedStyle(wrappers[1]).paddingBottom).toBe('0px');
		// Upstream's literal is `max(var(--spacing-4), env(safe-area-inset-right, 0px))`.
		// A headless Chromium reports no safe-area inset, so the `max()` resolves to
		// the spacing token — which the probe resolves the same way, keeping the
		// assertion about the declaration rather than about a pixel count.
		expect(getComputedStyle(viewport).paddingInlineEnd).toBe(
			resolves(
				viewport,
				'padding-inline-end',
				'max(var(--spacing-4), env(safe-area-inset-right, 0px))'
			)
		);
		bottom.unmount();

		const top = await renderViewport(
			[
				{ options: INFO_A, triggerLabel: 'Top A' },
				{ options: INFO_B, triggerLabel: 'Top B' }
			],
			'topEnd'
		);
		(top.getByText('Top A', { exact: true }).element() as HTMLElement).click();
		(top.getByText('Top B', { exact: true }).element() as HTMLElement).click();
		await tick();

		const topWrappers = [
			...notificationRegions()[0].querySelectorAll<HTMLElement>('[data-toast-id]')
		];
		await Promise.all(topWrappers.map(settleEntry));
		expect(getComputedStyle(topWrappers[0]).paddingBottom).toBe('0px');
		expect(getComputedStyle(topWrappers[1]).paddingBottom).toBe(
			resolves(topWrappers[1], 'padding-bottom', 'var(--spacing-2)')
		);
		top.unmount();
	});

	it('collapses a dismissed Toast before unmounting it', async () => {
		const { wrapper } = await renderMotionToast('bottomEnd');
		const id = wrapper.getAttribute('data-toast-id') as string;

		(wrapper.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();

		// Upstream reads back the two declarations `0fr` and `0px` and calls that
		// the collapse. Chromium runs the transition, so the same claim is made of
		// the thing itself: the wrapper is still mounted, it is *animating* its
		// grid track and its padding, and only once those finish is it gone. That
		// is what "collapses before unmounting" means, and it is stronger than the
		// pair of declarations — a wrapper removed on the same frame would satisfy
		// upstream's assertions and fail these. Only the grid track animates: this
		// toast is the stack's only child, so `:last-child` has already zeroed its
		// padding and there is nothing there to transition.
		expect(wrapper).toBeInTheDocument();
		const collapsing = wrapper
			.getAnimations()
			.map((animation) => (animation as CSSTransition).transitionProperty);
		expect(collapsing).toContain('grid-template-rows');
		// Upstream reads back `grid-template-rows: 0fr`, and that value is worth
		// keeping: a collapse to `0.5fr` animates just as well and the animation
		// check alone would pass. The exiting rule is where the declaration lives,
		// and it applies to this wrapper only while it is exiting — which is
		// exactly now.
		expect(someRuleFor([wrapper], 'grid-template-rows: 0fr')).toBe(true);

		// And upstream's `completeExit(id)` has no counterpart to fire: it exists
		// because jsdom runs no transitions, so the `transitionend` the viewport
		// unmounts on had to be synthesised. Here the real one arrives on its own —
		// which is why the collapsed values cannot be read after the fact either,
		// the wrapper being gone by then.
		await settleEntry(wrapper);
		await tick();
		expect(document.querySelector(`[data-toast-id="${id}"]`)).toBeNull();
	});
});
describe('Toast swipe dismissal', () => {
	beforeEach(() => {
		stubPointerCapture();
	});
	afterEach(() => {
		restorePointerCapture?.();
		restorePointerCapture = undefined;
	});

	async function renderSwipeToast(
		options: ToastOptions = SWIPE_TOAST,
		position?: ToastPosition,
		bodyText = 'Swipe toast',
		surfaceHeight = 80,
		dir?: 'ltr' | 'rtl'
	) {
		const onHide = vi.fn();
		const screen = await render(Harness, {
			props: { triggers: [{ options: { ...options, onHide } }], position, dir }
		});
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();
		const visualToast = getVisualToastByText(bodyText);
		vi.spyOn(visualToast, 'getBoundingClientRect').mockReturnValue({
			x: 0,
			y: 0,
			width: 400,
			height: surfaceHeight,
			top: 0,
			right: 400,
			bottom: surfaceHeight,
			left: 0,
			toJSON: () => ({})
		} as DOMRect);
		return { screen, visualToast, onHide };
	}

	/**
	 * A clock the gesture's input timestamps read from. Upstream's cases call
	 * this because jsdom stamps an event with `Date.now()`; Chromium stamps from
	 * the time origin, so the helpers shadow each event's `timeStamp` with this
	 * same clock. A 400ms `advance` is then 400ms of gesture time, exactly as on
	 * jsdom.
	 */
	function mockClock(start = 1_000) {
		let time = start;
		return {
			get now() {
				return time;
			},
			advance(ms: number) {
				time += ms;
			}
		};
	}

	it('dismisses on a pen swipe toward the configured block edge past the threshold', async () => {
		const { visualToast, onHide } = await renderSwipeToast();

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 60 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 0, clientY: 60 });

		expect(visualToast.setPointerCapture).toHaveBeenCalledWith(7);
		expect(visualToast.releasePointerCapture).toHaveBeenCalledWith(7);
		expect(onHide).toHaveBeenCalledWith('manual');
		expect(onHide).toHaveBeenCalledTimes(1);
		expect(visualToast.style.getPropertyValue('--_toast-swipe-exit-y')).toBe('120%');
		expect(horizontalDriftOf(visualToast)).toBe(0);
	});

	it('dismisses a fast flick below the distance threshold', async () => {
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'bottomEnd',
			'Swipe toast',
			400
		);
		// The card is 400px tall, so its threshold is 160px; 60px over 20ms is a
		// flick at 3px/ms.
		pen(visualToast, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0, timeStamp: 1_000 });
		pen(visualToast, 'pointermove', { pointerId: 8, clientX: 0, clientY: 60, timeStamp: 1_020 });
		pen(visualToast, 'pointerup', { pointerId: 8, clientX: 0, clientY: 60, timeStamp: 1_020 });

		expect(onHide).toHaveBeenCalledWith('manual');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-exit-y')).toBe('120%');
	});

	// A one-line toast is 56 px tall, and 40% of that is below the 48 px floor.
	// A short swipe dismisses it only as a flick.
	it('dismisses a quick pen flick on a one-line toast', async () => {
		const clock = mockClock();
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'bottomEnd',
			'Swipe toast',
			56
		);

		pen(visualToast, 'pointerdown', {
			pointerId: 9,
			clientX: 0,
			clientY: 0,
			timeStamp: clock.now
		});
		clock.advance(30);
		pen(visualToast, 'pointermove', {
			pointerId: 9,
			clientX: 0,
			clientY: 40,
			timeStamp: clock.now
		});
		pen(visualToast, 'pointerup', {
			pointerId: 9,
			clientX: 0,
			clientY: 40,
			timeStamp: clock.now
		});

		expect(onHide).toHaveBeenCalledWith('manual');
		expect(onHide).toHaveBeenCalledTimes(1);
	});

	it('dismisses a quick touch flick on a one-line toast at the top', async () => {
		const clock = mockClock();
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'topEnd',
			'Swipe toast',
			56
		);
		touch(visualToast, 'touchstart', {
			clientY: 100,
			identifier: 32,
			timeStamp: clock.now
		});
		clock.advance(15);
		const move = touch(visualToast, 'touchmove', {
			clientY: 80,
			identifier: 32,
			timeStamp: clock.now
		});
		clock.advance(15);
		touch(visualToast, 'touchmove', { clientY: 60, identifier: 32, timeStamp: clock.now });
		touch(visualToast, 'touchend', { clientY: 60, identifier: 32, timeStamp: clock.now });

		expect(move.defaultPrevented).toBe(true);
		expect(onHide).toHaveBeenCalledWith('manual');
		expect(onHide).toHaveBeenCalledTimes(1);
	});

	it('times a flick by its input events, not by when the handlers run', async () => {
		// Browsers can run move handlers well after the finger moved. Here the
		// 40 px flick takes 30 ms, and the page dispatches its moves and lift 60 ms
		// after touch-down.
		const clock = mockClock();
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'topEnd',
			'Swipe toast',
			56
		);
		touch(visualToast, 'touchstart', { clientY: 100, identifier: 33, timeStamp: clock.now });
		clock.advance(15);
		const firstMove = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
		Object.defineProperty(firstMove, 'touches', {
			value: [new Touch({ identifier: 33, target: visualToast, clientX: 10, clientY: 80 })]
		});
		Object.defineProperty(firstMove, 'changedTouches', {
			value: [new Touch({ identifier: 33, target: visualToast, clientX: 10, clientY: 80 })]
		});
		Object.defineProperty(firstMove, 'timeStamp', { value: clock.now });
		clock.advance(15);
		const secondMove = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
		Object.defineProperty(secondMove, 'touches', {
			value: [new Touch({ identifier: 33, target: visualToast, clientX: 10, clientY: 60 })]
		});
		Object.defineProperty(secondMove, 'changedTouches', {
			value: [new Touch({ identifier: 33, target: visualToast, clientX: 10, clientY: 60 })]
		});
		Object.defineProperty(secondMove, 'timeStamp', { value: clock.now });
		const lift = new TouchEvent('touchend', { bubbles: true, cancelable: true });
		Object.defineProperty(lift, 'touches', { value: [] });
		Object.defineProperty(lift, 'changedTouches', {
			value: [new Touch({ identifier: 33, target: visualToast, clientX: 10, clientY: 60 })]
		});
		Object.defineProperty(lift, 'timeStamp', { value: clock.now });
		clock.advance(30);
		visualToast.dispatchEvent(firstMove);
		visualToast.dispatchEvent(secondMove);
		visualToast.dispatchEvent(lift);

		expect(onHide).toHaveBeenCalledWith('manual');
	});

	it('snaps back after a slow short drag on a one-line toast', async () => {
		const clock = mockClock();
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'bottomEnd',
			'Swipe toast',
			56
		);

		pen(visualToast, 'pointerdown', {
			pointerId: 10,
			clientX: 0,
			clientY: 0,
			timeStamp: clock.now
		});
		clock.advance(400);
		pen(visualToast, 'pointermove', {
			pointerId: 10,
			clientX: 0,
			clientY: 40,
			timeStamp: clock.now
		});
		pen(visualToast, 'pointerup', {
			pointerId: 10,
			clientX: 0,
			clientY: 40,
			timeStamp: clock.now
		});

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
	});

	it('snaps back without dismissing after a short drag', async () => {
		// A slow drag: 24 px over 400 ms is far below flick speed.
		const clock = mockClock();
		const { visualToast, onHide } = await renderSwipeToast();

		pen(visualToast, 'pointerdown', {
			pointerId: 7,
			clientX: 0,
			clientY: 0,
			timeStamp: clock.now
		});
		clock.advance(400);
		pen(visualToast, 'pointermove', {
			pointerId: 7,
			clientX: 0,
			clientY: 24,
			timeStamp: clock.now
		});
		pen(visualToast, 'pointerup', {
			pointerId: 7,
			clientX: 0,
			clientY: 24,
			timeStamp: clock.now
		});

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('');
	});

	it('fades and subtly scales only after accepted vertical edge swipe intent', async () => {
		const { visualToast } = await renderSwipeToast();

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: -40 });
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('');
		pen(visualToast, 'pointercancel', { pointerId: 7, clientX: 0, clientY: -40 });

		pen(visualToast, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 8, clientX: 0, clientY: 40 });
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('40px');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('0.800');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('0.990');
	});

	it('does not fade for horizontal intent and resets swipe vars on pointercancel', async () => {
		const { visualToast, onHide } = await renderSwipeToast();

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 80, clientY: 20 });
		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('');

		pen(visualToast, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 8, clientX: 0, clientY: 40 });
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('0.800');

		pen(visualToast, 'pointercancel', { pointerId: 8, clientX: 0, clientY: 40 });
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('');
	});

	it('hands the opposite vertical direction back without moving the toast', async () => {
		const { visualToast, onHide } = await renderSwipeToast(SWIPE_TOAST, 'bottomEnd');

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 100 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 40 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 0, clientY: 40 });

		expect(onHide).not.toHaveBeenCalled();
	});

	it('keeps bottom placement dismissing downward under RTL', async () => {
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'bottomStart',
			'Swipe toast',
			80,
			'rtl'
		);

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 60 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 0, clientY: 60 });

		expect(onHide).toHaveBeenCalledWith('manual');
	});

	it('keeps top placement dismissing upward under RTL', async () => {
		const { visualToast, onHide } = await renderSwipeToast(
			SWIPE_TOAST,
			'topEnd',
			'Swipe toast',
			80,
			'rtl'
		);

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 100 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 40 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 0, clientY: 40 });

		expect(onHide).toHaveBeenCalledWith('manual');
	});

	it('sets swipe exit to a vertical throw with no horizontal drift', async () => {
		const { visualToast, onHide } = await renderSwipeToast(SWIPE_TOAST, 'topEnd', 'Swipe toast');

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 100 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 40 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 0, clientY: 40 });

		expect(onHide).toHaveBeenCalledWith('manual');
		// The exit animation owns the final translation: the live-drag fade and
		// scale are cleared rather than left on a standalone card.
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-scale')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-exit-y')).toBe('calc(-1 * 120%)');
		expect(horizontalDriftOf(visualToast)).toBe(0);
	});

	it('allows native page scrolling until touch intent matches the dismiss edge', async () => {
		const { visualToast, onHide } = await renderSwipeToast(SWIPE_TOAST, 'topEnd', 'Swipe toast');

		touch(visualToast, 'touchstart', { clientY: 100 });
		let move = touch(visualToast, 'touchmove', { clientY: 140 });
		expect(move.defaultPrevented).toBe(false);
		expect(onHide).not.toHaveBeenCalled();

		touch(visualToast, 'touchstart', { clientY: 100 });
		move = touch(visualToast, 'touchmove', { clientX: 80, clientY: 104 });
		expect(move.defaultPrevented).toBe(false);

		touch(visualToast, 'touchstart', { clientY: 100 });
		move = touch(visualToast, 'touchmove', { clientY: 40 });
		expect(move.defaultPrevented).toBe(true);
		touch(visualToast, 'touchend', { clientY: 40 });
		expect(onHide).toHaveBeenCalledWith('manual');
	});

	it("ends the swipe when the gesture host leaves the touch to the page, in Chromium's pointer-before-touch order", async () => {
		const { visualToast, onHide } = await renderSwipeToast();
		const finger = { pointerId: 9, pointerType: 'touch' };

		pen(visualToast, 'pointerdown', { ...finger, clientX: 10, clientY: 100 });
		touch(visualToast, 'touchstart', { clientY: 100, identifier: 34 });
		// Chromium sends the finger's pointermoves inside its touch slop and holds
		// back the touchmoves. The first sample goes 1 px away from the edge, so
		// the pan's one-way first move fails and the page keeps the touch.
		pen(visualToast, 'pointermove', { ...finger, clientX: 10, clientY: 99 });
		let move = touch(visualToast, 'touchmove', { clientY: 117, identifier: 34 });
		expect(move.defaultPrevented).toBe(false);
		pen(visualToast, 'pointermove', { ...finger, clientX: 10, clientY: 160 });
		touch(visualToast, 'touchmove', { clientY: 160, identifier: 34 });
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		touch(visualToast, 'touchend', { clientY: 160, identifier: 34 });
		expect(onHide).not.toHaveBeenCalled();
	});

	it('swipes normally on the next touch after a first touch the page took', async () => {
		const { visualToast, onHide } = await renderSwipeToast();

		// The first touch moves sideways first, so the page keeps it.
		touch(visualToast, 'touchstart', { clientX: 10, clientY: 100, identifier: 35 });
		let move = touch(visualToast, 'touchmove', { clientX: 13, clientY: 100, identifier: 35 });
		expect(move.defaultPrevented).toBe(false);
		touch(visualToast, 'touchmove', { clientX: 13, clientY: 160, identifier: 35 });
		touch(visualToast, 'touchend', { clientX: 13, clientY: 160, identifier: 35 });
		expect(onHide).not.toHaveBeenCalled();

		// The next touch moves toward the edge first, so the swipe owns it.
		touch(visualToast, 'touchstart', { clientX: 10, clientY: 100, identifier: 36 });
		move = touch(visualToast, 'touchmove', { clientX: 10, clientY: 101, identifier: 36 });
		expect(move.defaultPrevented).toBe(true);
		touch(visualToast, 'touchmove', { clientX: 10, clientY: 160, identifier: 36 });
		touch(visualToast, 'touchend', { clientX: 10, clientY: 160, identifier: 36 });
		expect(onHide).toHaveBeenCalledWith('manual');
	});

	it('resets an accepted touch gesture on native touchcancel', async () => {
		const { visualToast, onHide } = await renderSwipeToast();

		touch(visualToast, 'touchstart', { clientY: 0, identifier: 44 });
		const move = touch(visualToast, 'touchmove', { clientY: 40, identifier: 44 });
		expect(move.defaultPrevented).toBe(true);
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('40px');

		touch(visualToast, 'touchcancel', { clientY: 40, identifier: 44 });

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
	});

	it('abandons a one-finger swipe when a second touch starts', async () => {
		const { visualToast, onHide } = await renderSwipeToast();
		const first = { identifier: 51, clientX: 10, clientY: 0 };
		const second = { identifier: 52, clientX: 30, clientY: 40 };

		dispatchTouch(visualToast, 'touchstart', [first]);
		dispatchTouch(visualToast, 'touchmove', [{ ...first, clientY: 40 }]);
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('40px');

		dispatchTouch(visualToast, 'touchstart', [first, second], [second]);
		const multitouchMove = dispatchTouch(visualToast, 'touchmove', [first, second]);

		expect(multitouchMove.defaultPrevented).toBe(false);
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
		expect(onHide).not.toHaveBeenCalled();
	});

	it('does not dismiss when another touch remains outside the Toast', async () => {
		const { visualToast, onHide } = await renderSwipeToast();
		const first = { identifier: 61, clientX: 10, clientY: 0 };
		const second = { identifier: 62, clientX: 200, clientY: 200 };

		dispatchTouch(visualToast, 'touchstart', [first], [first]);
		dispatchTouch(
			visualToast,
			'touchmove',
			[{ ...first, clientY: 60 }],
			[{ ...first, clientY: 60 }]
		);
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('60px');

		// The second contact began outside the Toast, so its touchstart did not
		// reach the Toast listener. Ending the tracked finger must still cancel
		// while that other contact remains active.
		dispatchTouch(visualToast, 'touchend', [second], [{ ...first, clientY: 60 }]);

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		expect(visualToast.style.getPropertyValue('--_toast-swipe-opacity')).toBe('');
	});

	it('does not let a pen event with the same numeric ID control a touch gesture', async () => {
		const { visualToast, onHide } = await renderSwipeToast();
		const point = { identifier: 7, clientX: 10, clientY: 0 };

		dispatchTouch(visualToast, 'touchstart', [point]);
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 10, clientY: 60 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 10, clientY: 60 });

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');

		dispatchTouch(visualToast, 'touchcancel', []);
	});

	it('leaves no touch listener on the card once a Toast unmounts', async () => {
		const addListener = vi.spyOn(HTMLElement.prototype, 'addEventListener');
		const removeListener = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
		try {
			const { screen, visualToast } = await renderSwipeToast();
			screen.unmount();
			const touchListeners = (spy: typeof addListener) =>
				spy.mock.calls
					.filter(
						([type], call) => spy.mock.contexts[call] === visualToast && type.startsWith('touch')
					)
					.map(([type, listener]) => [type, listener]);
			const added = touchListeners(addListener);
			const removed = touchListeners(removeListener);
			// The gesture host's own listener shows that the spies see the card.
			expect(added.length).toBeGreaterThan(0);
			expect(removed).toHaveLength(added.length);
			expect(removed).toEqual(expect.arrayContaining(added));
		} finally {
			addListener.mockRestore();
			removeListener.mockRestore();
		}
	});

	it('resets safely on pointercancel and resumes the auto-hide timer', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const { visualToast, onHide } = await renderSwipeToast({
				body: 'Swipe toast',
				autoHideDuration: 3000
			});

			pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
			pen(visualToast, 'pointermove', { pointerId: 7, clientX: 0, clientY: 40 });
			vi.advanceTimersByTime(10_000);
			expect(onHide).not.toHaveBeenCalled();

			pen(visualToast, 'pointercancel', { pointerId: 7, clientX: 0, clientY: 40 });
			vi.advanceTimersByTime(3_000);

			expect(onHide).toHaveBeenCalledWith('auto');
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps horizontal pan intent and mouse drag from dismissing', async () => {
		const { visualToast, onHide } = await renderSwipeToast();

		pen(visualToast, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
		pen(visualToast, 'pointermove', { pointerId: 7, clientX: 80, clientY: 20 });
		pen(visualToast, 'pointerup', { pointerId: 7, clientX: 220, clientY: 80 });
		pen(visualToast, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0, pointerType: 'mouse' });
		pen(visualToast, 'pointermove', {
			pointerId: 8,
			clientX: 220,
			clientY: 0,
			pointerType: 'mouse'
		});
		pen(visualToast, 'pointerup', { pointerId: 8, clientX: 220, clientY: 0, pointerType: 'mouse' });

		expect(onHide).not.toHaveBeenCalled();
	});

	it('does not start a swipe from interactive descendants', async () => {
		const onAction = vi.fn();
		const onHide = vi.fn();
		const screen = await render(EndContentHarness, { props: { onAction, onHide } });
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();
		const visualToast = getVisualToastByText('Swipe toast');

		const targets = [
			screen.getByRole('button', { name: 'Undo', exact: true }).element() as HTMLElement,
			screen.getByRole('switch', { name: 'Mode', exact: true }).element() as HTMLElement
		];
		targets.forEach((target, index) => {
			const pointerId = 20 + index;
			pen(target, 'pointerdown', { pointerId, clientX: 0, clientY: 0 });
			pen(target, 'pointermove', { pointerId, clientX: 0, clientY: 80 });
			pen(target, 'pointerup', { pointerId, clientX: 0, clientY: 80 });
		});

		expect(onHide).not.toHaveBeenCalled();
		expect(visualToast.style.getPropertyValue('--_toast-swipe-y')).toBe('');
		targets[0].click();
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it('keeps the visible dismiss button as a non-gesture alternative', async () => {
		const { screen, onHide } = await renderSwipeToast();

		(
			screen
				.getByRole('button', { name: 'Dismiss notification', exact: true })
				.element() as HTMLElement
		).click();

		expect(onHide).toHaveBeenCalledWith('manual');
	});
});

describe('ToastViewport with no toasts', () => {
	// iOS Safari keeps a toolbar color that it took from the viewport while
	// the viewport has a box.
	it('has no box once its last toast has left, and a box for the next toast', async () => {
		const screen = await renderViewport([{ options: SWIPE_TOAST }]);
		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();
		const viewport = notificationRegions()[0];
		expect(getComputedStyle(viewport).display).toBe('flex');

		const wrapper = getToastWrapperByText('Swipe toast');
		(wrapper.querySelector('button[aria-label="Dismiss notification"]') as HTMLElement).click();
		await tick();
		// The leaving toast keeps the box until its exit ends.
		expect(getComputedStyle(viewport).display).toBe('flex');
		completeExit(wrapper.dataset.toastId ?? '');
		await tick();
		expect(getComputedStyle(viewport).display).toBe('none');

		(screen.getByText('Trigger', { exact: true }).element() as HTMLElement).click();
		await tick();
		expect(getComputedStyle(viewport).display).toBe('flex');
	});
});
