/** PORTS: motion/animatedLayout.edge.test.ts
 *
 * PORT NOTE: 10 of 25 declarations. The rest compare per-frame clip values against a jsdom glide grid; recorded in port/debts.md.
 */


/**
 * @file animatedLayout.edge.test.ts
 * @input vitest (jsdom), the animated-layout module, a recording stand-in for
 *   Element.animate (its KeyframeEffect's `setKeyframes` and `updateTiming`
 *   included, and a current time read off a stubbed document timeline) and
 *   stubbed layout rectangles (jsdom lays nothing out)
 * @output Checks `spec:AST-105` FR9's edge reveal. The one-state reveal and
 *   conceal play from each edge, left to right and right to left. A reversal
 *   starts from what shows. The moving edge rides the glide of the content
 *   after it, through a reversal too. The two-state form holds the old state
 *   as one copy while the edge rides a gliding element. That element stays
 *   above the copy while it conceals, a reversal starts from the extent it
 *   shows, and Reduce Motion goes by pointer. A resized element's reveal (a
 *   resize controller's pane) uses no copy. While it conceals, it holds the
 *   extent it was laid out at, and its edge's margin frees the difference.
 *   Its padding, overflow and scroll offset stay as laid out. It is clipped
 *   to its new extent and rides the content beside it
 * @position Testing; the real geometry is proven in
 *   __tests__/animatedLayout.interaction.browser.spec.ts and, for the SideNav
 *   rail's two-state form, SideNav's rail-motion specs
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createAnimatedLayout,
	holdLayoutEdge,
	holdLayoutExit,
	playLayoutChange,
	playLayoutEdge,
	releaseLayoutExit,
	reportLayoutChange,
	reportLayoutEdge,
	type LayoutEdge
} from '$lib/motion/animated-layout.js';

interface Played {
	element: Element;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
	startTime: number | null;
	cancel: ReturnType<typeof vi.fn>;
	/** What `setKeyframes` replaced the frames with, if anything. */
	ridden: Keyframe[] | null;
	/** The duration `updateTiming` set, if any. */
	duration: number | null;
	finish?: () => void;
}

let played: Played[] = [];
let media: Record<string, boolean> = {};
const originalAnimate = Element.prototype.animate;
const originalMatchMedia = window.matchMedia;

function setTimeline(currentTime: number) {
	Object.defineProperty(document, 'timeline', {
		configurable: true,
		value: { currentTime }
	});
}

function timelineNow(): number {
	return Number(document.timeline?.currentTime ?? 0);
}

beforeEach(() => {
	played = [];
	media = {};
	setTimeline(1000);
	// The page's clock reads the timeline's frame time: no block since it.
	vi.spyOn(performance, 'now').mockImplementation(timelineNow);
	Element.prototype.animate = function (
		this: Element,
		keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
		options?: number | KeyframeAnimationOptions
	) {
		const entry: Played = {
			element: this,
			keyframes: keyframes as Keyframe[],
			options: options as KeyframeAnimationOptions,
			startTime: null,
			cancel: vi.fn(),
			ridden: null,
			duration: null
		};
		played.push(entry);
		return {
			cancel: entry.cancel,
			addEventListener(type: string, listener: () => void) {
				if (type === 'finish') {
					entry.finish = listener;
				}
			},
			get startTime() {
				return entry.startTime;
			},
			set startTime(value: number | null) {
				entry.startTime = value;
			},
			// As a browser reads it: the timeline's time since the start.
			get currentTime() {
				return entry.startTime == null ? 0 : timelineNow() - entry.startTime;
			},
			effect: {
				setKeyframes(frames: Keyframe[]) {
					entry.ridden = frames;
				},
				updateTiming(timing: OptionalEffectTiming) {
					entry.duration = Number(timing.duration);
				}
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
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

const flushMicrotasks = async () => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

function lastOn(element: Element): Played | undefined {
	return played.filter((entry) => entry.element === element).at(-1);
}

/** The keyframe a running animation shows `elapsed` ms in, and that time. */
function frameAt(entry: Played, index: number): { frame: Keyframe; at: number } {
	const frame = entry.keyframes[index];
	return { frame, at: Number(frame.offset) * Number(entry.options.duration) };
}

/**
 * A column area: a revealed element (`#content`, 80 px tall once open) and
 * `followers` rows after it, which the change pushes down by 80 px.
 */
function columnSetup({
	direction = 'ltr',
	followers = 0
}: { direction?: 'ltr' | 'rtl'; followers?: number } = {}) {
	const rows = Array.from({ length: followers }, (_, i) => `<div id="row${i}">Row ${i}</div>`).join(
		''
	);
	document.body.innerHTML = `
    <div id="area" dir="${direction}" style="direction: ${direction}">
      <div id="content" dir="${direction}" style="direction: ${direction}">Shipping details</div>${rows}
    </div>`;
	const area = document.getElementById('area') as HTMLElement;
	const content = document.getElementById('content') as HTMLElement;
	let isOpen = false;
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: HTMLElement
	) {
		if (this === area) {
			return DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 600 });
		}
		if (this === content) {
			return DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 80 });
		}
		const index = /^row(\d+)$/.exec(this.id)?.[1];
		if (index != null) {
			return DOMRect.fromRect({
				x: 0,
				y: (isOpen ? 80 : 0) + Number(index) * 40,
				width: 400,
				height: 40
			});
		}
		return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
	});
	const handle = createAnimatedLayout(() => area);
	return {
		area,
		content,
		handle,
		row: (i: number) => document.getElementById(`row${i}`) as HTMLElement,
		/** Opens or closes the content, as a commit would, around the report. */
		toggle(open: boolean) {
			const report = reportLayoutChange(handle, () => content);
			report.measureBefore();
			isOpen = open;
			report.animate();
		}
	};
}

describe('the one-state edge reveal (spec:AST-105 FR9)', () => {
	const firstLast = (entry: Played | undefined) => [
		String(entry?.keyframes[0].clipPath),
		String(entry?.keyframes.at(-1)?.clipPath)
	];

	it('reveals from the block-end edge by default', () => {
		const { content, handle, toggle } = columnSetup();
		toggle(true);
		playLayoutChange(handle, content);
		expect(firstLast(lastOn(content))).toEqual(['inset(0 0 100% 0)', 'inset(0 0 0% 0)']);
	});

	it.each<[LayoutEdge, 'ltr' | 'rtl', string]>([
		['block-start', 'ltr', 'inset(100% 0 0 0)'],
		['inline-end', 'ltr', 'inset(0 100% 0 0)'],
		['inline-start', 'ltr', 'inset(0 0 0 100%)'],
		['inline-end', 'rtl', 'inset(0 0 0 100%)'],
		['inline-start', 'rtl', 'inset(0 100% 0 0)']
	])('reveals from its %s edge (%s)', (edge, direction, hidden) => {
		const { content, handle, toggle } = columnSetup({ direction });
		toggle(true);
		playLayoutChange(handle, content, { edge });
		const [first, last] = firstLast(lastOn(content));
		expect(first).toBe(hidden);
		expect(last).toBe(hidden.replace('100%', '0%'));
	});

	it('conceals to the edge it is given, left to right and right to left', async () => {
		for (const [direction, hidden] of [
			['ltr', 'inset(0 100% 0 0)'],
			['rtl', 'inset(0 0 0 100%)']
		] as const) {
			setTimeline(1000);
			const { content, handle, toggle } = columnSetup({
				direction,
				followers: 1
			});
			toggle(true);
			playLayoutChange(handle, content);
			await flushMicrotasks();
			// Long after the reveal ended.
			setTimeline(61_000);
			toggle(false);
			expect(holdLayoutExit(handle, content, vi.fn(), { edge: 'inline-end' })).toBe(true);
			const exit = lastOn(content);
			expect(String(exit?.keyframes[0].clipPath)).toBe(hidden.replace('100%', '0%'));
			expect(String(exit?.keyframes.at(-1)?.clipPath)).toBe(hidden);
			releaseLayoutExit(content);
		}
	});

	it('a conceal that reverses a running reveal starts from what the reveal shows', async () => {
		const { content, handle, toggle } = columnSetup();
		toggle(true);
		playLayoutChange(handle, content);
		await flushMicrotasks();
		const reveal = lastOn(content) as Played;
		const { frame, at } = frameAt(reveal, 6);
		setTimeline(1000 + at);
		toggle(false);
		expect(holdLayoutExit(handle, content, vi.fn())).toBe(true);
		const conceal = lastOn(content) as Played;
		expect(conceal).not.toBe(reveal);
		// The running reveal stops where it shows, and the conceal starts there.
		expect(reveal.cancel).toHaveBeenCalled();
		expect(String(conceal.keyframes[0].clipPath)).toBe(String(frame.clipPath));
		expect(Number(conceal.keyframes[0].opacity)).toBeCloseTo(Number(frame.opacity), 3);
		expect(String(conceal.keyframes.at(-1)?.clipPath)).toBe('inset(0 0 100% 0)');
	});

	it('a reveal that reverses a running conceal starts from what the conceal shows', async () => {
		const { content, handle, toggle } = columnSetup();
		toggle(true);
		playLayoutChange(handle, content);
		await flushMicrotasks();
		setTimeline(61_000);
		toggle(false);
		holdLayoutExit(handle, content, vi.fn());
		await flushMicrotasks();
		const conceal = lastOn(content) as Played;
		const { frame, at } = frameAt(conceal, 6);
		setTimeline(61_000 + at);
		// Opened again mid-exit, as an adopter does it.
		toggle(true);
		releaseLayoutExit(content);
		playLayoutChange(handle, content);
		const reveal = lastOn(content) as Played;
		expect(reveal).not.toBe(conceal);
		expect(String(reveal.keyframes[0].clipPath)).toBe(String(frame.clipPath));
		expect(Number(reveal.keyframes[0].opacity)).toBeCloseTo(Number(frame.opacity), 3);
		expect(String(reveal.keyframes.at(-1)?.clipPath)).toBe('inset(0 0 0% 0)');
	});
});

/**
 * A row area: a panel 260 px wide that collapses to 48 beside a column, which
 * the change moves by the difference (the SideNav rail beside AppShell's
 * content).
 */
function rowSetup({ direction = 'ltr' }: { direction?: 'ltr' | 'rtl' } = {}) {
	document.body.innerHTML = `
    <div id="area" dir="${direction}" style="direction: ${direction}">
      <div id="row" style="display: flex">
        <div id="side"><nav id="panel" style="direction: ${direction}"><span>Projects</span></nav></div>
        <div id="column"><main id="content">The page</main></div>
      </div>
    </div>`;
	const area = document.getElementById('area') as HTMLElement;
	const host = document.getElementById('row') as HTMLElement;
	const side = document.getElementById('side') as HTMLElement;
	const panel = document.getElementById('panel') as HTMLElement;
	const column = document.getElementById('column') as HTMLElement;
	let width = 260;
	const rtl = direction === 'rtl';
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: HTMLElement
	) {
		if (this === area || this === host) {
			return DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 });
		}
		if (this === panel || this === side) {
			return DOMRect.fromRect({
				x: rtl ? 1000 - width : 0,
				y: 0,
				width,
				height: 600
			});
		}
		if (this === column) {
			return DOMRect.fromRect({
				x: rtl ? 0 : width,
				y: 0,
				width: 1000 - width,
				height: 600
			});
		}
		return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
	});
	const handle = createAnimatedLayout(() => area);
	return {
		handle,
		host,
		side,
		panel,
		column,
		/** Sets the panel's width as a commit would, the column's glide around it. */
		resize(next: number, shown: number | null = null) {
			const hold = holdLayoutEdge(handle, panel, { edge: 'inline-end', shown });
			const report = reportLayoutChange(handle, () => panel);
			report.measureBefore();
			width = next;
			report.animate();
			return hold;
		}
	};
}

describe('the two-state edge reveal (spec:AST-105 FR9)', () => {
	it('reports what it shows while it runs, and nothing once it has settled', async () => {
		const { handle, panel, resize } = rowSetup();
		const hold = resize(48);
		const motion = playLayoutEdge(hold!, panel, handle, { edge: 'inline-end' });
		expect(motion.shown()).toEqual({ extent: 260, progress: 0 });
		setTimeline(1000 + 120);
		const partway = motion.shown();
		expect(partway?.progress).toBeGreaterThan(0);
		expect(partway?.progress).toBeLessThan(1);
		expect(partway?.extent).toBeCloseTo(260 + (48 - 260) * Number(partway?.progress), 6);
		setTimeline(1000 + 60_000);
		expect(motion.shown()).toBeNull();
	});

	it('only cross-fades under Reduce Motion with a coarse pointer (design:reduced-motion DR2)', async () => {
		media = {
			'(prefers-reduced-motion: reduce)': true,
			'(pointer: coarse)': true
		};
		const { handle, panel, column, resize } = rowSetup();
		const hold = resize(48);
		playLayoutEdge(hold!, panel, handle, {
			edge: 'inline-end',
			rideWith: column
		});
		await flushMicrotasks();
		for (const entry of played) {
			for (const frame of entry.keyframes) {
				expect(Object.keys(frame).filter((key) => key !== 'offset')).toEqual(['opacity']);
			}
		}
	});

	it('changes at once under Reduce Motion with a fine pointer (design:reduced-motion DR3)', async () => {
		media = { '(prefers-reduced-motion: reduce)': true };
		const { handle, panel, column, resize } = rowSetup();
		const hold = resize(48);
		// Nothing to hold: the change lands at once.
		expect(hold?.swap).toBeNull();
		const motion = playLayoutEdge(hold!, panel, handle, {
			edge: 'inline-end',
			rideWith: column
		});
		await flushMicrotasks();
		expect(played).toEqual([]);
		expect(motion.shown()).toBeNull();
	});
});

/**
 * A row like a Layout with a resizable pane: the pane, a handle and the
 * content, which the change moves by the pane's difference. The pane sits at
 * the inline start (`side: 'start'`) or at the inline end.
 */
function paneSetup({
	direction = 'ltr',
	side = 'start'
}: { direction?: 'ltr' | 'rtl'; side?: 'start' | 'end' } = {}) {
	const pane = '<aside id="pane" style="direction: ' + direction + '">Files</aside>';
	const handleEl = '<div id="grip"></div>';
	const content = '<main id="content">The page</main>';
	document.body.innerHTML = `
    <div id="area" dir="${direction}" style="direction: ${direction}">
      <div id="row" style="display: flex">${
				side === 'start' ? pane + handleEl + content : content + handleEl + pane
			}</div>
    </div>`;
	const area = document.getElementById('area') as HTMLElement;
	const row = document.getElementById('row') as HTMLElement;
	const paneEl = document.getElementById('pane') as HTMLElement;
	const grip = document.getElementById('grip') as HTMLElement;
	const main = document.getElementById('content') as HTMLElement;
	let width = 260;
	// Physical x of each box: the pane at the row's start or end edge, as the
	// direction lays it out.
	const atLeft = (side === 'start') === (direction === 'ltr');
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: HTMLElement
	) {
		if (this === area || this === row) {
			return DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 });
		}
		if (this === paneEl) {
			return DOMRect.fromRect({
				x: atLeft ? 0 : 1000 - width,
				y: 0,
				width,
				height: 600
			});
		}
		if (this === grip) {
			return DOMRect.fromRect({
				x: atLeft ? width : 1000 - width - 8,
				y: 0,
				width: 8,
				height: 600
			});
		}
		if (this === main) {
			return DOMRect.fromRect({
				x: atLeft ? width + 8 : 0,
				y: 0,
				width: 1000 - width - 8,
				height: 600
			});
		}
		return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
	});
	const handle = createAnimatedLayout(() => area);
	return {
		handle,
		pane: paneEl,
		grip,
		/**
		 * Collapses or opens the pane, as the controller does, around the report.
		 * `commit` changes what else the new size changes in the same commit.
		 */
		resize(next: number, edge: LayoutEdge, commit?: () => void) {
			const report = reportLayoutEdge(handle, () => paneEl, { edge });
			report.measureBefore();
			width = next;
			commit?.();
			report.animate();
			return report;
		}
	};
}

describe('the edge reveal of a resized element, with no copy (spec:AST-105 FR9)', () => {
	const clipsOf = (element: Element) =>
		played.filter((entry) => entry.element === element && 'clipPath' in entry.keyframes[0]);

	it('keeps the padding and overflow it was laid out with while it conceals, and puts back its own once the motion ends', () => {
		const { pane, resize } = paneSetup();
		pane.style.setProperty('padding-inline-start', '16px');
		pane.style.setProperty('padding-inline-end', '16px');
		pane.style.setProperty('overflow-y', 'auto');
		resize(0, 'inline-end', () => {
			// A LayoutPanel at width 0 drops its padding and stops scrolling.
			pane.style.setProperty('padding-inline-start', '0px');
			pane.style.setProperty('padding-inline-end', '0px');
			pane.style.setProperty('overflow-y', 'clip');
		});
		expect(pane.style.getPropertyValue('padding-inline-start')).toBe('16px');
		expect(pane.style.getPropertyValue('padding-inline-end')).toBe('16px');
		expect(pane.style.getPropertyValue('overflow-y')).toBe('auto');
		clipsOf(pane)[0].finish?.();
		expect(pane.style.getPropertyValue('padding-inline-start')).toBe('0px');
		expect(pane.style.getPropertyValue('padding-inline-end')).toBe('0px');
		expect(pane.style.getPropertyValue('overflow-y')).toBe('clip');
	});

	it('keeps the scroll offset it was laid out at while it conceals, and a reveal that reverses it scrolls back there', () => {
		const { pane, resize } = paneSetup();
		let scrollTop = 120;
		Object.defineProperty(pane, 'scrollTop', {
			configurable: true,
			get: () => scrollTop,
			set: (value: number) => {
				scrollTop = value;
			}
		});
		// A pane that stops scrolling in the commit loses its offset.
		resize(48, 'inline-end', () => {
			scrollTop = 0;
		});
		expect(scrollTop).toBe(120);
		// Releasing the hold to reverse loses it again.
		resize(260, 'inline-end', () => {
			scrollTop = 0;
		});
		expect(scrollTop).toBe(120);
	});

	it('under Reduce Motion with a fine pointer every change lands at once (design:reduced-motion DR3)', () => {
		media = { '(prefers-reduced-motion: reduce)': true };
		const { pane, resize } = paneSetup();
		resize(48, 'inline-end');
		resize(260, 'inline-end');
		expect(played.filter((entry) => entry.element === pane)).toEqual([]);
		expect(pane.style.getPropertyValue('inline-size')).toBe('');
	});
});
