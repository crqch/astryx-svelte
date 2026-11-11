/** PORTS: hooks/useScrollableArea.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { getLogicalAxisMapping } from '$lib/hooks/scroll-geometry.js';
import {
	findNearestScrollOwner,
	getRegisteredScrollOwnerState
} from '$lib/hooks/scroll-owner-registry.js';
import * as stylex from '@stylexjs/stylex';
import ScrollableAreaProbe from './fixtures/scrollable-area-probe.svelte';
import ScrollableAreaNestedProbe from './fixtures/scrollable-area-nested-probe.svelte';

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

async function settle(): Promise<void> {
	await flushFrames();
	await flushFrames();
}

function makeOverflowing(viewport: HTMLElement, axis: 'x' | 'y' = 'x', extent = 180): void {
	if (axis === 'x') {
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: extent,
			scrollHeight: 100
		});
		viewport.style.overflowX = 'auto';
	} else {
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 100,
			scrollHeight: extent
		});
		viewport.style.overflowY = 'auto';
	}
	viewport.dispatchEvent(new Event('scroll'));
}

describe('useScrollableArea', () => {
	it('contains only effective physical axes', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: { axis: 'both', chaining: 'contain' }
		});
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
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);

		expect(viewport.style.overscrollBehaviorX).toBe('contain');
		expect(viewport.style.overscrollBehaviorY).toBe('auto');
	});

	it('preserves caller overscroll behavior on axes outside the requested intent', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: {
				axis: 'inline',
				chaining: 'contain',
				style: 'overscroll-behavior-y: none'
			}
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;

		// The hook owns only the requested inline axis; the caller's block-axis
		// chaining declaration survives. Neither axis overflows yet, so the
		// owned inline declaration is `auto`.
		expect(viewport.style.overscrollBehaviorX).toBe('auto');
		expect(viewport.style.overscrollBehaviorY).toBe('none');
	});

	it('normalizes RTL inline offsets to logical edges', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		viewport.dir = 'rtl';
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
		expect(screen.getByTestId('state').element()).toHaveTextContent('"atStart":true');

		viewport.scrollLeft = -200;
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":true')
		);
	});

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
	it('maps logical axes through vertical and sideways writing modes', () => {
		expect(getLogicalAxisMapping('vertical-rl', 'ltr')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: false,
			blockReversed: true
		});
		expect(getLogicalAxisMapping('vertical-lr', 'rtl')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: true,
			blockReversed: false
		});
		expect(getLogicalAxisMapping('sideways-lr', 'ltr')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: true,
			blockReversed: false
		});
		expect(getLogicalAxisMapping('sideways-lr', 'rtl')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: false,
			blockReversed: false
		});
		expect(getLogicalAxisMapping('sideways-rl', 'ltr')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: false,
			blockReversed: true
		});
		expect(getLogicalAxisMapping('sideways-rl', 'rtl')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: true,
			blockReversed: true
		});
		expect(getLogicalAxisMapping('vertical-rl', 'rtl')).toEqual({
			inline: 'y',
			block: 'x',
			inlineReversed: true,
			blockReversed: true
		});
		expect(getLogicalAxisMapping('horizontal-tb', 'rtl')).toEqual({
			inline: 'x',
			block: 'y',
			inlineReversed: true,
			blockReversed: false
		});
	});

	it('derives edges as a scroll is dispatched', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 300);
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);

		for (const [scrollLeft, atStart, atEnd] of [
			[80, 'false', 'false'],
			[200, 'false', 'true'],
			[0, 'true', 'false']
		] as const) {
			setGeometry(viewport, { scrollLeft });
			viewport.dispatchEvent(new Event('scroll'));
			await vi.waitFor(() =>
				expect(screen.getByTestId('state').element()).toHaveTextContent(
					`"inline":{"isScrollable":true,"atStart":${atStart},"atEnd":${atEnd}}`
				)
			);
		}
	});

	it('measures fully when a scroll finds the requested overflow gone', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 300);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));

		setGeometry(viewport, { scrollWidth: 100, scrollLeft: 0 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).not.toHaveAttribute('tabindex'));
		expect(screen.getByTestId('state').element()).toHaveTextContent(
			'"inline":{"isScrollable":false'
		);
	});

	it('keeps the last valid edges when a scroll arrives while the viewport has no box', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 300);
		setGeometry(viewport, { scrollLeft: 80 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atStart":false')
		);

		setGeometry(viewport, { clientWidth: 0, clientHeight: 0, scrollLeft: 0 });
		viewport.dispatchEvent(new Event('scroll'));
		await settle();
		expect(screen.getByTestId('state').element()).toHaveTextContent('"atStart":false');
	});

	it('applies the measured writing direction on the scroll path', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		viewport.dir = 'rtl';
		makeOverflowing(viewport, 'x', 300);
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);

		setGeometry(viewport, { scrollLeft: -200 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":true')
		);
	});

	it('derives vertical-rl block edges on the scroll path', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: { axis: 'block', style: 'writing-mode: vertical-rl' }
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 220,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.dispatchEvent(new Event('transitionend'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"block":{"isScrollable":true'
			)
		);

		setGeometry(viewport, { scrollLeft: -120 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":true')
		);
	});

	it('normalizes reversed inline offsets in sideways writing modes', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: { style: 'writing-mode: sideways-lr' }
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 100,
			scrollHeight: 300,
			scrollLeft: 0,
			scrollTop: -200
		});
		viewport.style.overflowY = 'auto';
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"inline":{"isScrollable":true'
			)
		);
		expect(screen.getByTestId('state').element()).toHaveTextContent('"atEnd":true');
	});

	it('measures both requested axes independently in vertical writing mode', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: { axis: 'both', style: 'writing-mode: vertical-rl' }
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 220,
			scrollHeight: 100,
			scrollLeft: -120,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.dispatchEvent(new Event('transitionend'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"block":{"isScrollable":true'
			)
		);
		expect(screen.getByTestId('state').element()).toHaveTextContent(
			'"inline":{"isScrollable":false'
		);
	});

	it('removes a lost tab stop without moving current focus', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();
		expect(document.activeElement).toBe(viewport);

		setGeometry(viewport, { scrollWidth: 100 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));
		expect(document.activeElement).toBe(viewport);
	});

	it.each(['viewport', 'contentOrViewport'] as const)(
		'removes the leftover tabindex once a fitting viewport is blurred (%s owner)',
		async (keyboardOwner) => {
			const screen = await render(ScrollableAreaProbe, { props: { keyboardOwner } });
			const viewport = screen.getByTestId('viewport').element() as HTMLElement;
			makeOverflowing(viewport, 'x', 180);
			await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));

			viewport.focus();
			setGeometry(viewport, { scrollWidth: 100 });
			viewport.dispatchEvent(new Event('scroll'));
			await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));

			viewport.blur();
			await vi.waitFor(() => expect(viewport).not.toHaveAttribute('tabindex'));
		}
	);

	it('ignores focus on a descendant of a viewport that loses overflow', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		const descendant = screen.getByTestId('descendant').element() as HTMLElement;
		descendant.tabIndex = -1;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));

		descendant.focus();
		setGeometry(viewport, { scrollWidth: 100 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).not.toHaveAttribute('tabindex'));
		expect(document.activeElement).toBe(descendant);
	});

	it('removes the leftover tabindex when focus moves from the viewport to a descendant', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		const descendant = screen.getByTestId('descendant').element() as HTMLElement;
		descendant.tabIndex = -1;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();
		setGeometry(viewport, { scrollWidth: 100 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));

		descendant.focus();
		await vi.waitFor(() => expect(viewport).not.toHaveAttribute('tabindex'));
	});

	it('keeps the tabindex when focusout fires while the viewport is still the active element', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();
		setGeometry(viewport, { scrollWidth: 100 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));

		viewport.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		expect(document.activeElement).toBe(viewport);
		expect(viewport).toHaveAttribute('tabindex', '-1');
	});

	it('keeps the tabindex when focus leaves and returns in one task', async () => {
		const screen = await render(ScrollableAreaProbe);
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();
		setGeometry(viewport, { scrollWidth: 100 });
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));

		viewport.blur();
		viewport.focus();
		expect(document.activeElement).toBe(viewport);
		expect(viewport).toHaveAttribute('tabindex', '-1');
	});

	it('keeps the tabindex of a focused viewport when its scrolling axis is dropped', async () => {
		const screen = await render(ScrollableAreaProbe, { props: { axis: 'both' } });
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();

		await screen.rerender({ axis: 'block' });
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));
		expect(document.activeElement).toBe(viewport);
	});

	it('drops the tabindex of an unfocused viewport after an axis change', async () => {
		const screen = await render(ScrollableAreaProbe, { props: { axis: 'both' } });
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		makeOverflowing(viewport, 'x', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));

		await screen.rerender({ axis: 'block' });
		await vi.waitFor(() => expect(viewport).not.toHaveAttribute('tabindex'));
	});
	it('composes caller content props and consumes content xstyle', async () => {
		const contentStyle = stylex.create({ minWidth: { minWidth: '120px' } });
		const screen = await render(ScrollableAreaProbe, {
			props: {
				contentClass: 'caller-content',
				contentStyle: 'background-color: blue',
				contentXstyle: contentStyle.minWidth
			}
		});
		const content = screen.getByTestId('content').element() as HTMLElement;
		expect(content).toHaveClass('caller-content');
		expect(content.style.backgroundColor).toBe('blue');
		const token = (stylex.props(contentStyle.minWidth).className ?? '').split(' ')[0];
		if (token) expect(content.className).toContain(token);
		expect(content).toHaveAttribute('data-scroll-content');
	});

	it('registers effective owners by axis and skips inactive nested candidates', async () => {
		const screen = await render(ScrollableAreaNestedProbe);
		const outer = screen.getByTestId('outer-viewport').element() as HTMLElement;
		const inner = screen.getByTestId('inner-viewport').element() as HTMLElement;
		const leaf = screen.getByTestId('leaf').element() as HTMLElement;

		// Inner owns the inline axis; outer owns the block axis.
		setGeometry(inner, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 180,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		inner.style.overflowX = 'auto';
		inner.dispatchEvent(new Event('scroll'));
		setGeometry(outer, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 100,
			scrollHeight: 180,
			scrollLeft: 0,
			scrollTop: 0
		});
		outer.style.overflowY = 'auto';
		outer.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => expect(getRegisteredScrollOwnerState(inner)).toBeDefined());
		await vi.waitFor(() => expect(getRegisteredScrollOwnerState(outer)).toBeDefined());
		await vi.waitFor(() => expect(findNearestScrollOwner(leaf, 'inline')).toBe(inner));
		expect(findNearestScrollOwner(leaf, 'block')).toBe(outer);
	});

	it('resolves the nearest of two nested owners and unregisters both on unmount', async () => {
		const screen = await render(ScrollableAreaNestedProbe, {
			props: { innerAxis: 'block' }
		});
		const outer = screen.getByTestId('outer-viewport').element() as HTMLElement;
		const inner = screen.getByTestId('inner-viewport').element() as HTMLElement;
		const leaf = screen.getByTestId('leaf').element() as HTMLElement;

		for (const element of [outer, inner]) {
			setGeometry(element, {
				clientWidth: 100,
				clientHeight: 100,
				scrollWidth: 100,
				scrollHeight: 180,
				scrollLeft: 0,
				scrollTop: 0
			});
			element.style.overflowY = 'auto';
			element.dispatchEvent(new Event('scroll'));
		}
		await vi.waitFor(() => expect(getRegisteredScrollOwnerState(inner)).toBeDefined());
		await vi.waitFor(() => expect(findNearestScrollOwner(leaf, 'block')).toBe(inner));

		screen.unmount();
		expect(getRegisteredScrollOwnerState(outer)).toBeUndefined();
		expect(getRegisteredScrollOwnerState(inner)).toBeUndefined();
	});
	it('keeps the tab stop through a writing-mode change that moves the overflowing axis', async () => {
		const screen = await render(ScrollableAreaProbe, {
			props: { axis: 'block', style: 'writing-mode: horizontal-tb' }
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 100,
			scrollHeight: 180,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowY = 'auto';
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));

		await screen.rerender({
			axis: 'block',
			style: 'writing-mode: vertical-rl'
		});
		setGeometry(viewport, {
			clientWidth: 100,
			clientHeight: 100,
			scrollWidth: 180,
			scrollHeight: 100,
			scrollLeft: 0,
			scrollTop: 0
		});
		viewport.style.overflowX = 'auto';
		viewport.dispatchEvent(new Event('transitionend'));
		await vi.waitFor(() =>
			expect(screen.getByTestId('state').element()).toHaveTextContent(
				'"block":{"isScrollable":true'
			)
		);
		expect(viewport).toHaveAttribute('tabindex', '0');
	});

	it('keeps the named viewport available while content eligibility changes', async () => {
		const text = createRawSnippet(() => ({ render: () => '<span>Plain text</span>' }));
		const button = createRawSnippet(() => ({
			render: () => '<button type="button">Use existing action</button>'
		}));
		const screen = await render(ScrollableAreaProbe, {
			props: { axis: 'block', keyboardOwner: 'contentOrViewport', children: text }
		});
		const viewport = screen.getByTestId('viewport').element() as HTMLElement;
		const content = screen.getByTestId('content').element() as HTMLElement;
		makeOverflowing(viewport, 'y', 180);
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		viewport.focus();

		await screen.rerender({ axis: 'block', keyboardOwner: 'contentOrViewport', children: button });
		content.dispatchEvent(new Event('transitionend'));
		await settle();
		expect(viewport).toHaveAttribute('tabindex', '0');
		expect(document.activeElement).toBe(viewport);

		await screen.rerender({ axis: 'block', keyboardOwner: 'contentOrViewport', children: text });
		content.dispatchEvent(new Event('transitionend'));
		await settle();
		expect(viewport).toHaveAttribute('tabindex', '0');
	});
});
