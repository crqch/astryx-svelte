/** PORTS: SegmentedControl/useSegmentedSelectionMotion.test.ts */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import SegmentedControlLiveProbe from './fixtures/segmented-control-live-probe.svelte';

/**
 * The moving selected face of this port's SegmentedControl. Astryx implements
 * it through `useSegmentedSelectionMotion`; this suite covers the observable
 * contract a browser can assert — the selected segment paints its own raised
 * surface at rest, the radiogroup's ::before carries that surface while a
 * change or a drag is in flight, and a pointer drag carries the lens and
 * commits the segment under the pointer. The remaining upstream declarations
 * (face hysteresis, reduced-motion cross-fade, per-frame spring frames) target
 * the jsdom animation stand-in and are covered by
 * `segmented-selection-motion.svelte.test.ts`; the gaps are recorded in
 * `port/debts.md`.
 */

const ITEMS = [
	{ value: 'one', label: 'One' },
	{ value: 'two', label: 'Two' },
	{ value: 'three', label: 'Three' }
];

/** The lens is the radiogroup's ::before: a pseudo-element, not an element. */
function lensOf(group: HTMLElement): CSSStyleDeclaration {
	return getComputedStyle(group, '::before');
}

function group(container: HTMLElement): HTMLElement {
	const found = container.querySelector('[role="radiogroup"]');
	if (!(found instanceof HTMLElement)) throw new Error('expected the radiogroup');
	return found;
}

function radio(container: HTMLElement, name: string): HTMLElement {
	const found = [...container.querySelectorAll('[role="radio"]')].find(
		(element) => element.textContent?.trim() === name
	);
	if (!(found instanceof HTMLElement)) throw new Error(`expected ${name}`);
	return found;
}

function surfaceOf(segment: HTMLElement): string {
	return getComputedStyle(segment).backgroundColor;
}

function pointer(
	type: string,
	target: EventTarget,
	x: number,
	y: number,
	options: { buttons?: number; id?: number } = {}
): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			pointerId: options.id ?? 1,
			pointerType: 'mouse',
			clientX: x,
			clientY: y,
			button: 0,
			buttons: options.buttons ?? (type === 'pointerup' ? 0 : 1)
		})
	);
}

function center(rect: DOMRect): { x: number; y: number } {
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Keeps the lens on screen long enough for the assertions to observe it. */
function slowTransitions(container: HTMLElement): void {
	for (const segment of container.querySelectorAll<HTMLElement>('[role="radio"]')) {
		segment.style.setProperty('transition-duration', '600ms');
	}
}

describe('SegmentedControl selected surface', () => {
	it('paints the selected segment’s raised surface at rest, with the lens hidden', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		await tick();
		const selected = radio(screen.container, 'One');
		const surface = getComputedStyle(selected);
		expect(surface.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(surface.boxShadow).not.toBe('none');
		// Only the selected segment is raised.
		expect(getComputedStyle(radio(screen.container, 'Two')).boxShadow).toBe('none');
		// At rest the surface belongs to the segment, not to a pseudo-element.
		expect(lensOf(group(screen.container)).visibility).toBe('hidden');
		expect(screen.container.querySelector('[data-astryx-segmented-lens]')).toBeNull();
	});

	it('moves the surface to the ::before lens during a change, then hands it back to the item', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		await tick();
		slowTransitions(screen.container);
		const track = group(screen.container);
		const one = radio(screen.container, 'One');
		const three = radio(screen.container, 'Three');
		const surface = surfaceOf(one);

		three.click();
		await tick();
		expect(screen.component.getValue()).toBe('three');

		// The lens carries the selected surface, over the destination's box.
		const lens = lensOf(track);
		expect(lens.visibility).toBe('visible');
		expect(lens.backgroundColor).toBe(surface);
		expect(lens.boxShadow).not.toBe('none');
		const trackRect = track.getBoundingClientRect();
		const threeRect = three.getBoundingClientRect();
		expect(Number.parseFloat(lens.left)).toBeCloseTo(
			threeRect.left - trackRect.left - track.clientLeft,
			1
		);
		expect(Number.parseFloat(lens.width)).toBeCloseTo(threeRect.width, 1);
		expect(Number.parseFloat(lens.height)).toBeCloseTo(threeRect.height, 1);
		// The destination hides its own paint while the lens carries it.
		expect(three.style.backgroundColor).toBe('transparent');

		// It lands, the lens goes away, and the selected segment paints again.
		await vi.waitFor(
			() => {
				expect(track.style.getPropertyValue('--_segmented-lens-visibility')).toBe('');
				expect(surfaceOf(three)).toBe(surface);
			},
			{ timeout: 3000 }
		);
		expect(lensOf(track).visibility).toBe('hidden');
		expect(three.style.backgroundColor).toBe('');
	});

	it('drags the lens and commits the segment under the pointer', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		await tick();
		slowTransitions(screen.container);
		const track = group(screen.container);
		const one = radio(screen.container, 'One');
		const two = radio(screen.container, 'Two');
		const surface = surfaceOf(one);
		const start = center(one.getBoundingClientRect());
		const target = center(two.getBoundingClientRect());
		const lensBefore = lensOf(track).visibility;
		expect(lensBefore).toBe('hidden');

		pointer('pointerdown', one, start.x, start.y);
		await tick();
		expect(screen.component.getValue()).toBe('one');

		// A move past the tap's slop hands the surface from the segment to
		// the lens, at its resting size.
		pointer('pointermove', track, start.x + 20, start.y, { buttons: 1 });
		await tick();
		expect(lensOf(track).visibility).toBe('visible');
		expect(track.style.getPropertyValue('--_segmented-lens-background-color')).toBe(surface);
		expect(one.style.backgroundColor).toBe('transparent');

		// The lift commits the segment under the pointer, not the one the
		// lens crossed on its way there.
		pointer('pointerup', track, target.x, target.y);
		await tick();
		expect(screen.component.getValue()).toBe('two');
		await vi.waitFor(
			() => {
				expect(track.style.getPropertyValue('--_segmented-lens-visibility')).toBe('');
				expect(surfaceOf(two)).toBe(surface);
			},
			{ timeout: 3000 }
		);
	});

	it('leaves a small press as a tap and keeps the selection’s own surface', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		await tick();
		const track = group(screen.container);
		const one = radio(screen.container, 'One');
		const surface = surfaceOf(one);
		const start = center(one.getBoundingClientRect());

		pointer('pointerdown', one, start.x, start.y);
		pointer('pointermove', track, start.x + 2, start.y, { buttons: 1 });
		pointer('pointerup', track, start.x + 2, start.y);
		await tick();
		expect(screen.component.getValue()).toBe('one');
		// Nothing was carried, so the segment never gave up its surface.
		expect(lensOf(track).visibility).toBe('hidden');
		expect(one.style.backgroundColor).toBe('');
		expect(surfaceOf(one)).toBe(surface);
	});
});
