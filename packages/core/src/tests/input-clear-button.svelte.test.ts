/** PORTS: Field/InputClearButton.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import InputClearButton from '$lib/components/field/input-clear-button.svelte';
import Icon from '$lib/components/icon/icon.svelte';
import { defineTheme } from '$lib/theme/define-theme.js';
import { generateThemeCss } from '$lib/theme/generate-theme-rules.js';
// Upstream reads the source with `fs` + `__dirname`; the browser project has
// neither, and Vite's `?raw` hands over the same bytes. The precedent is
// `aspect-ratio.svelte.test.ts`.
import clearButtonSource from '$lib/components/field/input-clear-button.stylex.ts?raw';

/**
 * Astryx's `Field/InputClearButton.test.tsx`, rebaselined against 0.7.13 when
 * the clear glyph moved onto Button's shared touch band.
 *
 * The suite grew the two coarse-pointer hit-target cases at 0.5.0, when the
 * port owned a local `::after` overlay. Upstream 0.7.13 deleted that overlay
 * and handed the target to `ButtonHitAreaContext`; that shared band is not
 * ported yet, so the two cases are replaced here by the source half of the
 * upstream case and a note naming what waits on the band.
 *
 * The suite is new at 0.4.x, and so is the reason for it: #4876 converged the
 * whole clearable-input family (`TextInput`, `NumberInput`, `TimeInput`, the
 * three date inputs, the selectors, `Tokenizer`, `FileInput`) on this one
 * primitive, which had each been drawing its own `<button>` and its own focus
 * ring. These cases pin the two things that convergence bought: one canonical
 * `astryx-input-clear-icon` theme target on the glyph, and an `iconClassName`
 * seam for the component-specific targets that shipped before it.
 *
 * One translation, already precedented in `calendar` / `selector` /
 * `multi-selector`: upstream's `generateThemeTestCSS` helper becomes this
 * port's `generateThemeCss`, which is the same job and shape — a flat
 * stylesheet string.
 *
 * `onClick` is `onclick` here, the lowercase spelling this port uses for a
 * handler forwarded to an element (the rule `Thumbnail` established); the
 * component's props type documents why.
 */
describe('InputClearButton', () => {
	function getGlyph(container: HTMLElement): HTMLElement {
		const icon = container.querySelector('.astryx-icon');
		if (icon == null) {
			throw new Error('clear glyph not found');
		}
		return icon as HTMLElement;
	}

	it('renders a real button with the given accessible label', async () => {
		const screen = await render(InputClearButton, {
			props: { label: 'Clear', onclick: () => {} }
		});
		const button = screen.getByRole('button', { name: 'Clear', exact: true });
		await expect.element(button).toBeInTheDocument();
		expect(button.element().tagName).toBe('BUTTON');
	});

	it('fires onclick with the native event when pressed', async () => {
		const onclick = vi.fn();
		const screen = await render(InputClearButton, { props: { label: 'Clear', onclick } });
		await screen.getByRole('button', { name: 'Clear', exact: true }).click();
		expect(onclick).toHaveBeenCalledTimes(1);
		expect(onclick.mock.calls[0][0]).toBeInstanceOf(Object);
	});

	it('renders the astryx-input-clear-icon target on the glyph', async () => {
		// One canonical target on the icon element itself — so a theme restyles
		// the clear glyph across the whole input family from a single place.
		const screen = await render(InputClearButton, {
			props: { label: 'Clear', onclick: () => {} }
		});
		const glyph = getGlyph(screen.container);
		expect(glyph).toHaveClass('astryx-input-clear-icon');
		expect(glyph).toHaveClass('astryx-icon');
	});

	it('matches a standalone secondary/sm close icon aside from the target class', async () => {
		// The glyph is a secondary/sm close icon (matching the other field
		// affordances — chevrons, calendar toggles, status icons); aside from the
		// target class it is exactly that standalone Icon, so the default look is
		// defined once here rather than per input.
		const clear = await render(InputClearButton, {
			props: { label: 'Clear', onclick: () => {} }
		});
		const glyph = getGlyph(clear.container);

		const reference = await render(Icon, {
			props: { icon: 'close', size: 'sm', color: 'secondary' }
		});
		const refIcon = getGlyph(reference.container);

		const styleClasses = (el: HTMLElement) =>
			el.className
				.split(' ')
				.filter((c) => c !== 'astryx-input-clear-icon')
				.sort();

		expect(styleClasses(glyph)).toEqual(styleClasses(refIcon));
	});

	it('merges an extra iconClassName beside the canonical target', async () => {
		// Consumers that shipped a component-specific target before the family
		// converged pass it through here to keep emitting it for a deprecation
		// window.
		const screen = await render(InputClearButton, {
			props: {
				label: 'Clear',
				onclick: () => {},
				iconClassName: 'astryx-date-input-clear-icon'
			}
		});
		const glyph = getGlyph(screen.container);
		expect(glyph).toHaveClass('astryx-input-clear-icon');
		expect(glyph).toHaveClass('astryx-date-input-clear-icon');
	});

	it('exposes input-clear-icon so a theme reaches the glyph color, size, and hover', () => {
		const theme = defineTheme({
			name: 'input-clear-icon-test',
			components: {
				'input-clear-icon': {
					base: {
						width: '12px',
						height: '12px',
						fontSize: '12px',
						color: 'var(--color-icon-secondary)',
						':hover': { color: 'var(--color-icon-primary)' }
					}
				}
			}
		});
		const css = generateThemeCss(theme);
		expect(css).toContain('.astryx-input-clear-icon {');
		expect(css).toContain('width: 12px');
		expect(css).toContain('.astryx-input-clear-icon:hover');
		expect(css).toContain('color: var(--color-icon-primary)');
	});

	it('renders the astryx-input-clear-button target on the button wrapper', async () => {
		const screen = await render(InputClearButton, {
			props: { label: 'Clear', onclick: () => {} }
		});
		const button = screen.container.querySelector('button')!;
		expect(button).toHaveClass('astryx-input-clear-button');
	});

	it("takes Button's shared touch band rather than a fixed 24px overlay of its own", async () => {
		// Upstream 0.7.13 moved the clear button's coarse-pointer target onto
		// Button's shared touch band (AST-094 FR42), so the local `::after`
		// overlay and its two `--_input-clear-hit-*` vars are gone. The band
		// itself is not ported yet (`internal/touchHitArea.stylex.ts` has no
		// counterpart here), so the case asserts the half of upstream's that can
		// be checked: this module no longer owns a hit overlay.
		//
		// Retires when the shared touch band lands, at which point the upstream
		// case's band-element assertion can be restored verbatim.
		const screen = await render(InputClearButton, {
			props: { label: 'Clear', onclick: () => {} }
		});
		expect(screen.container.querySelector('button')).not.toBeNull();
		expect(clearButtonSource).not.toContain('--_input-clear-hit-inset');
		expect(clearButtonSource).not.toContain("'::after'");
	});

	it('exposes input-clear-button so a theme controls the button size and hover', () => {
		const theme = defineTheme({
			name: 'input-clear-button-test',
			components: {
				'input-clear-button': {
					base: {
						height: '28px',
						':hover': { backgroundImage: 'none' }
					}
				}
			}
		});
		const css = generateThemeCss(theme);
		expect(css).toContain('.astryx-input-clear-button {');
		expect(css).toContain('height: 28px');
		expect(css).toContain('.astryx-input-clear-button:hover');
		expect(css).toContain('background-image: none');
	});
});
