/** PORTS: ScrollableArea/ScrollableArea.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import * as stylex from '@stylexjs/stylex';
import ScrollableArea from '$lib/components/scrollable-area/scrollable-area.svelte';
import ScrollableAreaRefProbe from './fixtures/scrollable-area-ref-probe.svelte';
import { cssIn } from './forced-colors.js';
import hookSourceText from '$lib/hooks/use-scrollable-area.svelte.ts?raw';
import stylesSourceText from '$lib/components/scrollable-area/scrollable-area.stylex.ts?raw';
import componentSourceText from '$lib/components/scrollable-area/scrollable-area.svelte?raw';
import {
	containerPaddingBlockEndVarStyles,
	containerPaddingBlockStartVarStyles,
	containerPaddingInlineEndVarStyles,
	containerPaddingInlineStartVarStyles,
	paddingBlockEndStyles,
	paddingBlockStartStyles,
	paddingInlineEndStyles,
	paddingInlineStartStyles
} from '$lib/internal/padding.stylex.js';

/**
 * Ported from Astryx's `ScrollableArea/ScrollableArea.test.tsx` at the
 * **0.7.13** pin, all 13 declarations.
 *
 * ## What the real browser changes
 *
 * Upstream runs in jsdom and has to stub `ResizeObserver`, rasterise StyleX's
 * runtime injection, and set `clientHeight`/`scrollHeight` by hand. Chromium
 * lays the component out for real, so the keyboard case uses a real viewport
 * height and a real overflowing content box, and the compiled sheet is read
 * from `document.styleSheets` through `cssIn` — the same helper the forced-colors
 * suites use.
 *
 * Two cases are **restatements**, not drops:
 *
 * - `keeps logical overflow and content sizing for writing-mode changes` is
 *   mostly a source assertion upstream. It now reads this port's
 *   `use-scrollable-area.svelte.ts` and `scrollable-area.stylex.ts` instead of
 *   React paths, and the runtime half asserts the `data-axis` value and the
 *   content class change.
 * - `uses clip while fitting and makes fitting Sticky containment explicit`
 *   asserts StyleX's runtime `--x-overflowX` variables in jsdom. This build
 *   compiles those atoms ahead of time, so it reads the winning class names and
 *   the compiled declarations instead.
 */

function classTokens(style: object): string[] {
	return (stylex.props(style as never).className ?? '')
		.split(' ')
		.filter((token) => token && !token.includes('__'));
}

const PADDING_EDGES = [
	[paddingInlineStartStyles, containerPaddingInlineStartVarStyles],
	[paddingInlineEndStyles, containerPaddingInlineEndVarStyles],
	[paddingBlockStartStyles, containerPaddingBlockStartVarStyles],
	[paddingBlockEndStyles, containerPaddingBlockEndVarStyles]
] as const;

function hookSource(): string {
	return hookSourceText;
}

function stylesSource(): string {
	return stylesSourceText;
}

describe('ScrollableArea', () => {
	it('renders one native viewport and one real content box', async () => {
		const screen = await render(ScrollableArea, {
			props: {
				label: 'Messages',
				'data-testid': 'viewport',
				children: undefined
			}
		});
		const viewport = screen.getByTestId('viewport').element();

		expect(viewport.getAttribute('aria-label')).toBe('Messages');
		expect(viewport).toHaveAttribute('role', 'group');
		expect(viewport).toHaveAttribute('data-scroll-axis', 'block');
		expect(viewport).not.toHaveAttribute('tabindex');
		expect(viewport.children).toHaveLength(1);
		expect(viewport.firstElementChild).toHaveAttribute('data-scroll-content');
	});

	it('becomes keyboard reachable only when the requested axis is effective', async () => {
		const screen = await render(ScrollableArea, {
			props: {
				axis: 'block',
				label: 'Messages',
				'data-testid': 'viewport',
				style: 'height: 100px',
				children: undefined
			}
		});
		const viewport = screen.getByTestId('viewport').element();
		const content = viewport.firstElementChild as HTMLElement;
		content.style.blockSize = '200px';

		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
		expect(viewport).toHaveAttribute('data-scrollable-block', 'true');

		content.style.blockSize = '100px';
		viewport.focus();
		viewport.dispatchEvent(new Event('scroll'));
		await vi.waitFor(() => expect(viewport).toHaveAttribute('tabindex', '-1'));
		expect(document.activeElement).toBe(viewport);
	});

	it('keeps viewport props, styles, class names, events, and refs', async () => {
		const screen = await render(ScrollableAreaRefProbe);
		const viewport = screen.getByTestId('viewport').element();

		await userEvent.click(viewport);
		expect(screen.component.getViewport()).toBe(viewport);
		expect(viewport).toHaveClass('astryx-scrollable-area');
	});

	it('reflects logical axis and chaining intent without containing a fitting area', async () => {
		const screen = await render(ScrollableArea, {
			props: {
				axis: 'both',
				label: 'Canvas',
				overscroll: 'contain',
				'data-testid': 'viewport',
				children: undefined
			}
		});
		const viewport = screen.getByTestId('viewport').element();

		expect(viewport).toHaveAttribute('data-axis', 'both');
		expect(viewport).toHaveAttribute('data-scroll-axis', 'both');
		expect(viewport.style.overscrollBehaviorX).toBe('auto');
		expect(viewport.style.overscrollBehaviorY).toBe('auto');
	});

	it('keeps logical overflow and content sizing for writing-mode changes', async () => {
		const screen = await render(ScrollableArea, {
			props: {
				axis: 'inline',
				label: 'Timeline',
				'data-testid': 'viewport',
				children: undefined
			}
		});
		const viewport = screen.getByTestId('viewport').element();
		const content = viewport.firstElementChild as HTMLElement;
		expect(viewport).toHaveAttribute('data-axis', 'inline');
		const inlineContentClass = content.className;

		await screen.rerender({ axis: 'block', label: 'Timeline', 'data-testid': 'viewport' });
		expect(viewport).toHaveAttribute('data-axis', 'block');
		expect(content.className).not.toBe(inlineContentClass);

		const source = stylesSource();
		expect(source).not.toContain('dynamicStyles.overflow(');
		expect(hookSource()).toContain('scrollableAreaOverflowStyles(');
		expect(source).toContain("minInlineSize: '100%'");
		expect(source).toContain("inlineSize: 'max-content'");
	});

	it('uses clip while fitting and makes fitting Sticky containment explicit', async () => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', children: undefined }
		});
		const viewport = screen.getByTestId('viewport').element();
		expect(viewport).not.toHaveAttribute('tabindex');
		expect(hookSource()).toContain("'clip'");

		await screen.rerender({
			label: 'Messages',
			stickyContainment: 'always',
			'data-testid': 'viewport'
		});
		await vi.waitFor(() => expect(viewport.getAttribute('style')).toMatch(/hidden/));
		expect(viewport.getAttribute('style')).toMatch(/auto/);
	});

	it('accepts standard container sizing props on the viewport', async () => {
		const screen = await render(ScrollableArea, {
			props: {
				label: 'Messages',
				width: 320,
				height: '50vh',
				maxWidth: '100%',
				minHeight: 120,
				'data-testid': 'viewport',
				children: undefined
			}
		});

		expect(screen.getByTestId('viewport').element()).toBeInTheDocument();
		expect(stylesSource()).toContain('dynamicStyles.sizing(');
	});

	it('publishes content padding without changing the viewport default', async () => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', children: undefined }
		});
		const viewport = screen.getByTestId('viewport').element();
		const content = viewport.firstElementChild as HTMLElement;
		const defaultViewportClass = viewport.className;
		const defaultContentClass = content.className;

		await screen.rerender({
			label: 'Messages',
			padding: 4,
			paddingInlineEnd: 2,
			'data-testid': 'viewport'
		});

		expect(viewport.className).toBe(defaultViewportClass);
		expect(content.className).not.toBe(defaultContentClass);
		expect(componentSourceText).toContain('containerPaddingInlineVarStyles[padding]');
		expect(componentSourceText).toContain('containerPaddingInlineEndVarStyles[paddingInlineEnd]');
	});

	it.each([
		{ name: 'zero on every edge by default', props: {}, edges: [0, 0, 0, 0] },
		{ name: 'uniform padding on every edge', props: { padding: 4 }, edges: [4, 4, 4, 4] },
		{
			name: 'zero axis values over uniform',
			props: { padding: 4, paddingInline: 0, paddingBlock: 0 },
			edges: [0, 0, 0, 0]
		},
		{
			name: 'start edges over axis over uniform',
			props: {
				padding: 4,
				paddingInline: 3,
				paddingBlock: 2,
				paddingInlineStart: 0,
				paddingBlockStart: 0
			},
			edges: [0, 3, 0, 2]
		},
		{
			name: 'end edges over axis over uniform',
			props: {
				padding: 4,
				paddingInline: 3,
				paddingBlock: 2,
				paddingInlineEnd: 0,
				paddingBlockEnd: 0
			},
			edges: [3, 0, 2, 0]
		}
	] as const)('applies and publishes $name', async ({ props, edges }) => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', ...props, children: undefined }
		});
		const content = screen.getByTestId('viewport').element().firstElementChild as HTMLElement;
		const contentClasses = new Set(content.className.split(' '));

		PADDING_EDGES.forEach(([atoms, inset], index) => {
			for (const style of [atoms[edges[index]], inset[edges[index]]]) {
				const tokens = classTokens(style);
				expect(tokens.length).toBeGreaterThan(0);
				for (const token of tokens) expect(contentClasses).toContain(token);
			}
		});
	});

	it('keeps inherited container bleed opt-in on the viewport', async () => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', children: undefined }
		});
		const viewport = screen.getByTestId('viewport').element();
		const containedClass = viewport.className;

		await screen.rerender({
			label: 'Messages',
			isFullBleed: true,
			'data-testid': 'viewport'
		});
		expect(viewport.className).not.toBe(containedClass);
		const source = stylesSource();
		expect(source).toContain('var(--container-padding-inline-start, 0px)');
		expect(source).toContain('fullBleed');
	});

	it('uses the neutral token for native scrollbar color with a transparent track', async () => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', children: undefined }
		});
		const viewport = screen.getByTestId('viewport').element();
		expect(cssIn(viewport)).toContain('scrollbar-color: var(--color-neutral) transparent');
	});

	it("keeps the platform's own scroll indicator on touch screens", () => {
		expect(stylesSource()).toContain("'@media (pointer: coarse)': 'auto'");
	});

	it('guards scroll-state query containment as a progressive enhancement', async () => {
		const screen = await render(ScrollableArea, {
			props: { label: 'Messages', 'data-testid': 'viewport', children: undefined }
		});
		const viewport = screen.getByTestId('viewport').element();
		expect(viewport).toBeInTheDocument();
		expect(stylesSource()).toContain('@supports (container-type: scroll-state)');
		expect(stylesSource()).toContain("'scroll-state'");
	});
});
