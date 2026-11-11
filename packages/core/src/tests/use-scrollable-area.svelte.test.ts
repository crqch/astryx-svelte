/** PORTS: hooks/useScrollableArea.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	findNearestScrollOwner,
	getRegisteredScrollOwnerState
} from '$lib/hooks/scroll-owner-registry.js';
import ScrollableAreaProbe from './fixtures/scrollable-area-probe.svelte';

/**
 * The first slice of Astryx's `hooks/useScrollableArea.test.tsx` at the
 * **0.7.13** pin, moved from jsdom to real Chromium.
 *
 * The suite is 47 declarations. This file ports the measurement, ownership,
 * edge-state and composition cases that do not depend on jsdom-only stubs; the
 * remaining cases are listed below and are the next slice. Upstream's
 * `getComputedStyle` proxy (which reads StyleX's runtime `--x-overflow*` vars)
 * is unnecessary here: the browser resolves the compiled overflow classes.
 *
 * Still unported from the upstream suite:
 * - `reports a change below the content root as content only and an outer
 *   change as layout` — its mutation-observer classification needs a settled
 *   initial frame this harness does not reproduce reliably; the ownership and
 *   edge cases below cover the published state it asserts;
 * - the animation-frame/one-frame budget cases (upstream stubs rAF);
 * - the writing-mode matrix (`vertical-rl`, `sideways-lr`, `vertical-lr`);
 * - the focus-tab-stop lifecycle cases (lost focus, another document,
 *   focusout/return in one task);
 * - the ref-replacement and StrictMode-replay cases;
 * - the coalescing and last-valid-state cases.
 */

function setGeometry(
	element: HTMLElement,
	values: Partial<
		Pick<
			HTMLElement,
			'clientWidth' | 'clientHeight' | 'scrollWidth' | 'scrollHeight' | 'scrollLeft' | 'scrollTop'
		>
	>
): void {
	for (const [key, value] of Object.entries(values)) {
		Object.defineProperty(element, key, { configurable: true, value, writable: true });
	}
}

async function flushFrames(): Promise<void> {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe('useScrollableArea', () => {
	it('starts inactive and fitting without creating a tab stop', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;

		expect(viewport).not.toHaveAttribute('tabindex');
		expect(screen.getByTestId('state').element()).toHaveTextContent('"isScrollable":false');
	});

	it('owns fitting and explicit Sticky overflow styling for direct adopters', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 100,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'clip';
		viewport.style.overflowY = 'clip';
		viewport.dispatchEvent(new Event('scroll'));
		await flushFrames();
		expect(viewport).not.toHaveAttribute('tabindex');

		await screen.rerender({ stickyContainment: 'always' });
		await vi.waitFor(() => expect(viewport.getAttribute('style')).toMatch(/overflow/));
	});

	it('activates only the overflowing physical axis when both are requested', async () => {
		const screen = await render(ScrollableAreaProbe, { props: { axis: 'both' } });
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 180,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.style.overflowY = 'auto';
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);
		expect(screen.getByTestId('state').element()).toHaveTextContent(
			'"block":{"isScrollable":false'
		);
	});

	it('requires scroll-capable computed overflow and more than 1px excess geometry', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 101,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		// `clip` is not a scroll-capable overflow, so the 1px excess does not count.
		viewport.style.overflowX = 'clip';
		viewport.dispatchEvent(new Event('scroll'));
		await flushFrames();
		expect(screen.getByTestId('state').element()).toHaveTextContent(
			'"inline":{"isScrollable":false'
		);
	});

	it('publishes stable logical start, middle, and end edge state', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 300,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"isScrollable":true')
		);
		expect(screen.getByTestId('state').element()).toHaveTextContent('"atStart":true');

		viewport.scrollLeft = 100;
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atStart":false')
		);
		expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":false');

		viewport.scrollLeft = 200;
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":true')
		);
	});

	it('registers effective owners by axis and unregisters on unmount', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 300,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);
		expect(getRegisteredScrollOwnerState(viewport)).toBeDefined();

		const child = screen.getByTestId('descendant').element() as HTMLElement;
		expect(findNearestScrollOwner(child, 'inline')).toBe(viewport);

		screen.unmount();
		expect(getRegisteredScrollOwnerState(viewport)).toBeUndefined();
	});

	it('keeps behavior-owned accessibility over conflicting caller props', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		expect(viewport).toHaveAttribute('role', 'region');
		expect(viewport).toHaveAttribute('aria-label', 'Scrollable results');
	});
});
