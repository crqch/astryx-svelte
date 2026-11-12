/** PORTS: Layout/__tests__/contentWidth.test.tsx */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayoutShell from './fixtures/layout-shell.svelte';

/**
 * Astryx's `Layout/__tests__/contentWidth.test.tsx`, ported case for case — the
 * panel-free case, the no-contentWidth case, and the four header/footer wrapper
 * cases, in upstream's order and under upstream's titles.
 *
 * The contract: `contentWidth` caps the middle row, and the header and footer
 * always render an inner wrapper to take that cap so the *outer* element — the
 * one carrying the divider — stays full bleed. Without side panels the content
 * region spans the full width and aligns its own children internally, which is
 * what replaced the old middle-row cap at 0.7.13.
 *
 * A **client** project file: every case walks real DOM up from the slot's child.
 *
 * ## Translations, none of them a dropped case
 *
 * **Slots are snippets.** Upstream passes `<LayoutHeader>`/`<LayoutFooter>`/
 * `<LayoutContent>` as JSX props; here they are snippets, so `layout-shell`
 * holds the markup and each case selects the slots it needs by prop. The
 * `data-testid` spans inside it are upstream's, and the parent walks are
 * upstream's walks unchanged.
 *
 * **A rerender is `screen.rerender`.** Upstream's first case compares the
 * classes a `contentWidth` render produces against one without it; the
 * rerender call is the same subject in this harness.
 *
 * ## UNPORTED, all added by the 0.7.13 internal-alignment rework
 *
 * Upstream's `lets $name-only content span to the opposite open edge` (the
 * start/end `it.each`), `keeps the complete middle composition constrained with
 * both panels`, `keeps zero padding full-bleed with arithmetic contentWidth`,
 * `keeps %s on the constrained composition path` (the intrinsic-width
 * `it.each`), `resets inherited contentWidth for a nested Layout without one`
 * and `keeps arbitrary panel-free content constrained` assert values
 * `getComputedStyle` resolves differently in Chromium than in upstream's jsdom
 * (`100cqi` and `var(--spacing-*)` survive there and are computed to lengths
 * here), and several need fixture compositions this shell does not author
 * (arbitrary content, a nested Layout, a panel pair). They are named here so
 * the shortfall is declared rather than inferred; porting them belongs with the
 * test-parity pass that owns this suite.
 */

describe('Layout contentWidth', () => {
	describe('Layout', () => {
		it('keeps panel-free LayoutContent full width and constrains its content internally', async () => {
			const screen = await render(LayoutShell, { props: { contentWidth: 640, content: 'Body' } });

			const contentRegion = screen.getByTestId('body').element().parentElement!;
			const contentLane = contentRegion.parentElement!;
			const middleRow = contentLane.parentElement!;
			const constrainedLaneClassName = contentLane.className;
			const constrainedContentClassName = contentRegion.className;

			expect(getComputedStyle(contentRegion).overflow).toBe('auto');
			expect(screen.getByTestId('body').element().parentElement).toBe(contentRegion);
			expect(middleRow.getAttribute('style') ?? '').not.toContain('640px');

			await screen.rerender({ contentWidth: undefined, content: 'Body' });

			const rerenderedRegion = screen.getByTestId('body').element().parentElement!;
			expect(rerenderedRegion.parentElement!.className).not.toBe(constrainedLaneClassName);
			expect(rerenderedRegion.className).toBe(constrainedContentClassName);
		});

		it('does not crash when contentWidth is not set', async () => {
			const screen = await render(LayoutShell, { props: { content: 'Body' } });
			await expect.element(screen.getByTestId('body')).toBeInTheDocument();
		});
	});

	describe('LayoutHeader', () => {
		it('always renders contentWidth inner wrapper', async () => {
			const screen = await render(LayoutShell, { props: { header: 'Header', content: 'Body' } });
			const headerChild = screen.getByTestId('header-child').element();
			const innerWrapper = headerChild.parentElement!;
			const headerDiv = innerWrapper.parentElement!;
			expect(headerDiv.className).toContain('astryx-layout-header');
			expect(innerWrapper).not.toBe(headerDiv);
		});

		it('keeps divider on outer element', async () => {
			const screen = await render(LayoutShell, {
				props: { contentWidth: 640, defaultHasDividers: true, header: 'Header', content: 'Body' }
			});
			const headerChild = screen.getByTestId('header-child').element();
			const innerWrapper = headerChild.parentElement!;
			const headerDiv = innerWrapper.parentElement!;
			expect(headerDiv).toHaveAttribute('data-divider');
			expect(innerWrapper).not.toHaveAttribute('data-divider');
		});
	});

	describe('LayoutFooter', () => {
		it('always renders contentWidth inner wrapper', async () => {
			const screen = await render(LayoutShell, { props: { content: 'Body', footer: 'Footer' } });
			const footerChild = screen.getByTestId('footer-child').element();
			const innerWrapper = footerChild.parentElement!;
			const footerDiv = innerWrapper.parentElement!;
			expect(footerDiv.className).toContain('astryx-layout-footer');
			expect(innerWrapper).not.toBe(footerDiv);
		});

		it('keeps divider on outer element', async () => {
			const screen = await render(LayoutShell, {
				props: { contentWidth: 640, defaultHasDividers: true, content: 'Body', footer: 'Footer' }
			});
			const footerChild = screen.getByTestId('footer-child').element();
			const innerWrapper = footerChild.parentElement!;
			const footerDiv = innerWrapper.parentElement!;
			expect(footerDiv).toHaveAttribute('data-divider');
			expect(innerWrapper).not.toHaveAttribute('data-divider');
		});
	});
});
