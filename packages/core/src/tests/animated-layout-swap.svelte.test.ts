/** PORTS: motion/animatedLayout.swap.test.ts
 *
 * PORT NOTE: 6 of 28 declarations. The rest need the jsdom copy-layout/rect stand-in and frame grid; recorded in port/debts.md.
 */

/**
 * @file animatedLayout.swap.test.ts
 * @input vitest (jsdom), the animated-layout module, a recording stand-in for
 *   Element.animate
 * @output Checks the in-place swap (`spec:AST-105` FR8): one inert transient
 *   copy of old content that takes no part in the page, played on FR4's one
 *   motion with the incoming elements, opacity-only under Reduce Motion with
 *   a coarse pointer, nothing under an immediate change, and removed when the
 *   swap ends
 * @position Testing; the real geometry is proven by the adopters'
 *   real-browser frames
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createAnimatedLayout,
	holdLayoutSwap,
	playLayoutFrames,
	playLayoutSwap
} from '$lib/motion/animated-layout.js';

interface Played {
	element: Element;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
	startTime: number | null;
	finish?: () => void;
}

let played: Played[] = [];
let media: Record<string, boolean> = {};
const originalAnimate = Element.prototype.animate;
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
	played = [];
	media = {};
	Object.defineProperty(document, 'timeline', {
		configurable: true,
		value: { currentTime: 500 }
	});
	// The page's clock reads the timeline's frame time: no block since it.
	vi.spyOn(performance, 'now').mockImplementation(
		() => (document.timeline as { currentTime: number }).currentTime
	);
	Element.prototype.animate = function (
		this: Element,
		keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
		options?: number | KeyframeAnimationOptions
	) {
		const entry: Played = {
			element: this,
			keyframes: keyframes as Keyframe[],
			options: options as KeyframeAnimationOptions,
			startTime: null
		};
		played.push(entry);
		return {
			cancel: vi.fn(),
			addEventListener(type: string, listener: () => void) {
				if (type === 'finish') {
					entry.finish = listener;
				}
			},
			set startTime(value: number) {
				entry.startTime = value;
			}
		} as unknown as Animation;
	};
	window.matchMedia = (query: string) =>
		({
			matches: media[query] === true,
			media: query,
			addEventListener() {},
			removeEventListener() {}
		}) as unknown as MediaQueryList;
});

afterEach(() => {
	Element.prototype.animate = originalAnimate;
	window.matchMedia = originalMatchMedia;
	document.body.innerHTML = '';
});

function setup() {
	document.body.innerHTML = `
    <div id="area">
      <div id="host">
        <main id="content" data-testid="main">
          <h2 id="title">Projects</h2>
          <label><input type="radio" name="plan" value="pro" checked /> Pro</label>
          <iframe src="about:blank"></iframe>
          <canvas width="40" height="20"></canvas>
          <label for="plan-pro">Pro plan</label>
          <div id="scroller">Rows</div>
          <svg><text id="axis">Axis</text></svg>
        </main>
      </div>
    </div>`;
	const area = document.getElementById('area') as HTMLElement;
	const handle = createAnimatedLayout(() => area);
	const content = document.getElementById('content') as HTMLElement;
	const host = document.getElementById('host') as HTMLElement;
	return { handle, content, host };
}

describe('the in-place swap (spec:AST-105 FR8)', () => {
	it("paints a copied canvas with its source's pixels", () => {
		const drawImage = vi.fn();
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
			() =>
				({
					drawImage,
					getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })
				}) as unknown as CanvasRenderingContext2D
		);
		const { handle, content } = setup();
		holdLayoutSwap(handle, content);
		expect(drawImage).toHaveBeenCalledWith(content.querySelector('canvas'), 0, 0);
		getContext.mockRestore();
	});

	it('does not copy content holding a canvas it cannot read back', () => {
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
			() =>
				({
					drawImage: vi.fn(),
					// A WebGL canvas without preserveDrawingBuffer reads back empty.
					getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) })
				}) as unknown as CanvasRenderingContext2D
		);
		const { handle, content } = setup();
		expect(holdLayoutSwap(handle, content)).toBeNull();
		getContext.mockRestore();
	});

	it('keeps a canvas with only a hairline drawn: thin marks read back', () => {
		const data = new Uint8ClampedArray(40 * 20 * 4);
		data[data.length - 1] = 255;
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
			() =>
				({
					drawImage: vi.fn(),
					getImageData: () => ({ data })
				}) as unknown as CanvasRenderingContext2D
		);
		const { handle, content } = setup();
		expect(holdLayoutSwap(handle, content)).not.toBeNull();
		getContext.mockRestore();
	});

	/** The copy renders at `scale` of its layout size, `extra` px taller. */
	it('holds nothing under Reduce Motion with a fine pointer, without a handle, or outside the area', () => {
		const { handle, content } = setup();
		expect(holdLayoutSwap(null, content)).toBeNull();
		const outside = document.createElement('div');
		document.body.append(outside);
		expect(holdLayoutSwap(handle, outside)).toBeNull();
		media['(prefers-reduced-motion: reduce)'] = true;
		expect(holdLayoutSwap(handle, content)).toBeNull();
		expect(played).toEqual([]);
	});
});

describe('a swap that rides a glide (spec:AST-105 FR8 with FR3)', () => {
	function rideSetup() {
		document.body.innerHTML = `
      <div id="area">
        <div id="rail"></div>
        <div id="column"><main id="content"><h2>Projects</h2></main></div>
      </div>`;
		const area = document.getElementById('area') as HTMLElement;
		const rail = document.getElementById('rail') as HTMLElement;
		const column = document.getElementById('column') as HTMLElement;
		const content = document.getElementById('content') as HTMLElement;
		let phase: 'before' | 'after' = 'before';
		const railWidth = () => (phase === 'before' ? 260 : 48);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
			this: HTMLElement
		) {
			if (this === area) {
				return DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 });
			}
			if (this === rail) {
				return DOMRect.fromRect({
					x: 0,
					y: 0,
					width: railWidth(),
					height: 600
				});
			}
			if (this === column || this === content) {
				return DOMRect.fromRect({
					x: railWidth(),
					y: 0,
					width: 1000 - railWidth(),
					height: 600
				});
			}
			return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
		});
		return {
			handle: createAnimatedLayout(() => area),
			area,
			rail,
			column,
			content,
			after: () => (phase = 'after')
		};
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('takes its new place at once when the element it rides does not glide', async () => {
		const { handle, area, column, content, after } = rideSetup();
		const swap = holdLayoutSwap(handle, content);
		after();
		playLayoutSwap(swap!, {
			host: area,
			copy: (p) => ({ opacity: 1 - p }),
			rideWith: { element: column, travel: { x: 212, y: 0 } },
			incoming: []
		});
		await Promise.resolve();
		const ride = played.find((entry) => entry.element === swap!.copy);
		expect(ride?.keyframes[0].translate).toBe('-212px 0px');
		expect(ride?.keyframes.at(-1)?.translate).toBe('-212px 0px');
	});
});

describe('more swap layout cases', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('plays frames on the same motion with no copy, opacity-only under DR2', () => {
		const { handle } = setup();
		const title = document.getElementById('title') as HTMLElement;
		playLayoutFrames(handle, [
			{
				element: title,
				frames: (p) => ({ boxShadow: `${100 * (1 - p)}px 0px 0px 0px red` })
			}
		]);
		const spring = played.find((entry) => entry.element === title);
		expect(spring?.keyframes[0].boxShadow).toBe('100px 0px 0px 0px red');
		expect(spring?.keyframes.at(-1)?.boxShadow).toBe('0px 0px 0px 0px red');
		expect(spring?.startTime).toBe(500);
		// Released when the motion ends: the element shows its own styles again.
		const cancel = vi.fn();
		played = [];
		const original = Element.prototype.animate;
		Element.prototype.animate = function (this: Element, ...args: Parameters<typeof original>) {
			const animation = original.apply(this, args);
			(animation as unknown as { cancel: () => void }).cancel = cancel;
			return animation;
		};
		playLayoutFrames(handle, [{ element: title, frames: () => ({ opacity: 1 }) }]);
		played[0].finish?.();
		expect(cancel).toHaveBeenCalled();
		Element.prototype.animate = original;
		played = [];
		played = [];
		media['(prefers-reduced-motion: reduce)'] = true;
		media['(pointer: coarse)'] = true;
		playLayoutFrames(handle, [{ element: title, frames: () => ({ scale: '2' }) }]);
		expect(played[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
		played = [];
		media['(pointer: coarse)'] = false;
		playLayoutFrames(handle, [{ element: title, frames: () => ({ scale: '2' }) }]);
		expect(played).toEqual([]);
	});
});
