/** PORTS: SegmentedControl/useSegmentedSelectionMotion.test.ts */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import SegmentedControlLiveProbe from './fixtures/segmented-control-live-probe.svelte';

/**
 * The moving selected face of this port's SegmentedControl. Astryx implements
 * it through `useSegmentedSelectionMotion`; this suite covers the observable
 * contract a browser can assert — one lens, the theme's transition, and a
 * pointer drag that carries and commits the selection. The remaining upstream
 * declarations (face hysteresis, reduced-motion cross-fade, per-frame spring
 * frames) target the jsdom animation stand-in and are recorded in
 * `port/debts.md`.
 */

const ITEMS = [
	{ value: 'one', label: 'One' },
	{ value: 'two', label: 'Two' },
	{ value: 'three', label: 'Three' }
];

function lens(container: HTMLElement): HTMLElement {
	const found = container.querySelector('[data-astryx-segmented-lens]');
	if (!(found instanceof HTMLElement)) throw new Error('expected the selected lens');
	return found;
}

function radio(container: HTMLElement, name: string): HTMLElement {
	const found = [...container.querySelectorAll('[role="radio"]')].find(
		(element) => element.textContent?.trim() === name
	);
	if (!(found instanceof HTMLElement)) throw new Error(`expected ${name}`);
	return found;
}

function pointer(
	type: string,
	target: EventTarget,
	x: number,
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
			clientY: 10,
			button: 0,
			buttons: options.buttons ?? (type === 'pointerup' ? 0 : 1)
		})
	);
}

describe('SegmentedControl selected lens', () => {
	it('renders one lens with the theme transition and places it on the selected segment', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		const element = lens(screen.container);
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		expect(element).not.toBeNull();
		const style = getComputedStyle(element);
		expect(style.transitionDuration).not.toBe('0s');
		expect(style.transitionProperty).toContain('transform');
		expect(element.style.transform).toContain('translate3d');
		expect(element.style.visibility).toBe('visible');
	});

	it('moves the lens when selection changes', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		const element = lens(screen.container);
		const before = element.style.transform;
		radio(screen.container, 'Three').click();
		await tick();
		expect(screen.component.getValue()).toBe('three');
		expect(element.style.transform).not.toBe(before);
		const three = radio(screen.container, 'Three');
		const group = screen.container.querySelector('[role="radiogroup"]') as HTMLElement;
		const groupRect = group.getBoundingClientRect();
		const threeRect = three.getBoundingClientRect();
		expect(Number.parseFloat(element.style.width)).toBeCloseTo(threeRect.width, 2);
		expect(Number.parseFloat(element.style.height)).toBeCloseTo(threeRect.height, 2);
		expect(element.style.transform).toContain(
			`translate3d(${Math.round(threeRect.left - groupRect.left)}`
		);
	});

	it('drags the selected face across segments and commits the segment under the finger', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		const group = screen.container.querySelector('[role="radiogroup"]') as HTMLElement;
		const one = radio(screen.container, 'One');
		const two = radio(screen.container, 'Two');
		const start = one.getBoundingClientRect();
		const target = two.getBoundingClientRect();
		const element = lens(screen.container);
		const before = element.style.transform;

		pointer('pointerdown', one, start.left + start.width / 2);
		pointer('pointermove', group, start.left + start.width / 2 + 20, { buttons: 1 });
		await tick();
		expect(element.style.transform).not.toBe(before);
		pointer('pointermove', group, target.left + target.width / 2, { buttons: 1 });
		await tick();
		expect(screen.component.getValue()).toBe('two');
		pointer('pointerup', group, target.left + target.width / 2);
		await tick();
		expect(screen.component.getValue()).toBe('two');
	});

	it('leaves a small press as a tap and keeps the selection', async () => {
		const screen = await render(SegmentedControlLiveProbe, { props: { items: ITEMS } });
		const group = screen.container.querySelector('[role="radiogroup"]') as HTMLElement;
		const one = radio(screen.container, 'One');
		const start = one.getBoundingClientRect();
		pointer('pointerdown', one, start.left + start.width / 2);
		pointer('pointermove', group, start.left + start.width / 2 + 2, { buttons: 1 });
		pointer('pointerup', group, start.left + start.width / 2 + 2);
		expect(screen.component.getValue()).toBe('one');
	});
});
