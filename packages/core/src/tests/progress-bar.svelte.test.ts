/** PORTS: ProgressBar/ProgressBar.test.tsx */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createAttachmentKey } from 'svelte/attachments';
import { render } from 'vitest-browser-svelte';
import ProgressBar from '$lib/components/progress-bar/progress-bar.svelte';
import { TOUCH_MIN_FILL_PX } from '$lib/components/progress-bar/use-progress-bar-touch.svelte.js';
import { formatMotionRoleValue, motionRole, motionRoleOf } from '$lib/motion/roles.js';
import {
	REDUCED_MOTION_FADE_QUERY,
	REDUCED_MOTION_INSTANT_QUERY
} from '$lib/motion/reduced-motion.js';
import { progressBar, registerProgressBarTable } from '$lib/motion/uikit/progressBar.js';
import { timing } from '$lib/motion/uikit/timing.js';
import { TOUCH_QUERY } from '$lib/utils/touch-queries.js';
// Upstream reads its own source with `node:fs`; the browser project has neither
// `fs` nor `__dirname`, and Vite's `?raw` hands over the same bytes. The
// precedent is `mobile-nav-entry-animation.svelte.test.ts`.
import styleSource from '$lib/components/progress-bar/progress-bar.stylex.ts?raw';

/**
 * Ported from Astryx's `ProgressBar/ProgressBar.test.tsx` at the 0.7.13 pin.
 *
 * The suite is a case-for-case port. Upstream's file moves with the touch
 * presentation: marks leave the semantic progressbar for a shared
 * `trackContainer`, the determinate fill becomes a transform on a full-width
 * layer, and the reduced-motion indeterminate bar pulses instead of sliding.
 *
 * Translations, all following patterns earlier suites set:
 *
 * - **`forwards ref to outer container`** becomes an attachment travelling in
 *   the rest props, which `ProgressBar` spreads onto its root — Svelte has no
 *   `ref` (the `Button`/`AppShell` counterpart).
 * - **`rerender` maps straight across**; `vitest-browser-svelte`'s is async and
 *   merges props rather than replacing them.
 * - **Upstream's `beforeAll` preload of the lazy tooltip chunk is kept.** Our
 *   `{#await import(…)}` is the `lazy()` + `Suspense` counterpart, and the same
 *   reason applies: preloading makes the tooltip's `aria-describedby` attach on
 *   the next microtask instead of racing a cold module fetch.
 * - **The cases that compare two bars side by side unmount the first before
 *   rendering the second**, having captured its classes. Upstream keeps both
 *   `container`s live because Testing Library scopes each to its own; the
 *   `DropdownMenu` parity suite settled this shape here.
 * - **The touch case measures a real 200px track** rather than stubbing
 *   `ResizeObserver` and `getBoundingClientRect`: Chromium lays the bar out and
 *   the shared observer reads the same `contentRect` upstream's mock supplies.
 *   Only `matchMedia` is stubbed, because it is what selects the touch
 *   presentation. `vi.waitFor` covers the observer's asynchronous delivery.
 * - **The source-reading cases use Vite's `?raw`** on our `.stylex.ts` module.
 *   Upstream slices its `ProgressBar.tsx`; the declarations now live in the
 *   style module, and the slices are renamed for this repo's tab indentation.
 * - **`rulesOf` descends `@layer` blocks.** The compiled sheet this port ships
 *   nests its rules in layers; upstream's single-pass version would find
 *   nothing. `valueUnder` already descended them and is upstream's.
 * - **The pulse keyframe count de-duplicates by rule text.** The compiled sheet
 *   reaches a browser-test page twice (Vite's dev server and
 *   `setup-stylex.ts`), so upstream's `toHaveLength(1)` becomes "one distinct
 *   rule" rather than a looser `toBeGreaterThan(0)`.
 * - **`renders the canonical target classes` keeps the legacy-name half.** This
 *   port deliberately emits `astryx-progressbar*` beside `astryx-progress-bar*`
 *   through the deprecation window, so unlike upstream the old classes are still
 *   present. The canonical half is upstream's assertion unchanged.
 *
 * Two assertions are **scoped tighter than upstream's**, not loosened. Upstream
 * greps the whole injected stylesheet for `translate(-50%, -50%)` and for the
 * forced-colors outline; here `setup-stylex.ts` injects the *repo-wide* sheet,
 * so an unscoped grep would pass on any other component's rule. Those cases
 * therefore look for the declarations on rules targeting the element under
 * test. The forced-colors case keeps upstream's two declarations and scopes
 * them to the fill's own classes.
 */

// A labelled mark wraps the tick in a lazily-loaded tooltip. Preload that chunk
// once so the tooltip (and its aria-describedby) attaches on the microtask after
// first render, keeping these tests deterministic rather than racing the
// dynamic import.
beforeAll(async () => {
	await import('$lib/components/progress-bar/progress-bar-mark-tooltip.svelte');
});

const MARK = '.astryx-progress-bar-mark';

/** Playwright locators are substring/case-insensitive; Testing Library's are exact. */
const exact = { exact: true } as const;

/**
 * The StyleX atomic classes on an element, without the stable `astryx-*` theme
 * classes and the bare variant/placement tokens — so a comparison reflects the
 * resolved styles, not the reflected props. Upstream's helper.
 */
function styleClasses(el: HTMLElement): string {
	return Array.from(el.classList)
		.filter((c) => /^x[a-z0-9]+$/.test(c))
		.sort()
		.join(' ');
}

/** Every CSS rule the page has, however it was injected. Upstream's helper. */
function injectedCss(): string {
	let out = '';
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			for (const rule of Array.from(sheet.cssRules)) {
				out += rule.cssText + '\n';
			}
		} catch {
			// ignore cross-origin sheets
		}
	}
	out += Array.from(document.querySelectorAll('style'))
		.map((s) => s.textContent || '')
		.join('\n');
	return out;
}

/** Whether any rule targeting one of `element`'s classes makes `declaration`. */
function hasDeclarationFor(element: Element, declaration: RegExp): boolean {
	const css = injectedCss();
	return Array.from(element.classList).some((cls) =>
		new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*${declaration.source}`, 'i').test(css)
	);
}

const progressbarIn = (container: HTMLElement): HTMLElement =>
	container.querySelector('[role="progressbar"]') as HTMLElement;

/**
 * Makes `matchMedia('(pointer: coarse)')` match, the query that selects the
 * touch presentation. Upstream stubs the same object; returns the restore.
 */
function stubTouchMedia(): () => void {
	const original = window.matchMedia;
	window.matchMedia = ((query: string) => ({
		matches: /pointer:\s*coarse/.test(query),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	})) as typeof window.matchMedia;
	return () => {
		window.matchMedia = original;
	};
}

describe('ProgressBar', () => {
	it('renders visible label by default', async () => {
		const screen = await render(ProgressBar, { props: { value: 50, label: 'Storage used' } });
		await expect.element(screen.getByText('Storage used', exact)).toBeInTheDocument();
	});

	it('hides label visually when isLabelHidden is true', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 50, label: 'Hidden label', isLabelHidden: true }
		});
		expect(screen.container.textContent).toContain('Hidden label');
		await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-labelledby');
	});

	it('shows value label when hasValueLabel is true', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 75, label: 'Upload', hasValueLabel: true }
		});
		await expect.element(screen.getByText('75%', exact)).toBeInTheDocument();
	});

	it('uses custom formatValueLabel', async () => {
		const screen = await render(ProgressBar, {
			props: {
				value: 3,
				max: 5,
				label: 'Disk',
				hasValueLabel: true,
				formatValueLabel: (v: number, m: number) => `${v} GB / ${m} GB`
			}
		});
		await expect.element(screen.getByText('3 GB / 5 GB', exact)).toBeInTheDocument();
		await expect
			.element(screen.getByRole('progressbar'))
			.toHaveAttribute('aria-valuetext', '3 GB / 5 GB');
	});

	it('sets aria-valuetext from formatValueLabel', async () => {
		const screen = await render(ProgressBar, { props: { value: 50, label: 'Progress' } });
		await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '50%');
	});

	it('clamps value to [0, max]', async () => {
		const screen = await render(ProgressBar, { props: { value: 150, max: 100, label: 'Over' } });
		await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

		await screen.rerender({ value: -10, max: 100, label: 'Under' });
		await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
	});

	it('forwards ref to outer container', async () => {
		// Counterpart to upstream's `ref`: an attachment in the rest props, which
		// `ProgressBar` spreads onto its root element.
		let node: Element | undefined;
		const screen = await render(ProgressBar, {
			props: {
				value: 50,
				label: 'Test',
				[createAttachmentKey()]: (element: Element) => {
					node = element;
				}
			}
		});
		expect(node).toBeInstanceOf(HTMLDivElement);
		expect(node).toBe(screen.container.firstElementChild);
	});

	it('passes data-testid', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 50, label: 'Test', 'data-testid': 'my-progress' }
		});
		await expect.element(screen.getByTestId('my-progress')).toBeInTheDocument();
	});

	it('renders with all variant options', async () => {
		const variants = ['accent', 'success', 'warning', 'error', 'neutral'] as const;
		for (const variant of variants) {
			const screen = await render(ProgressBar, { props: { value: 50, label: variant, variant } });
			await expect.element(screen.getByRole('progressbar')).toBeInTheDocument();
			screen.unmount();
		}
	});

	it('renders at fixed 8px track height', async () => {
		const screen = await render(ProgressBar, { props: { value: 50, label: 'Progress' } });
		await expect.element(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('shows value label with hidden label', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 60, label: 'Hidden', isLabelHidden: true, hasValueLabel: true }
		});
		await expect.element(screen.getByText('60%', exact)).toBeInTheDocument();
		expect(screen.container.textContent).toContain('Hidden');
	});

	it('renders no visible value label when isLabelHidden without hasValueLabel', async () => {
		// Mirrors the intended "accessible label only" composition: the text label
		// is kept for assistive tech (visually hidden) while no extra visible value
		// label is surfaced.
		const screen = await render(ProgressBar, {
			props: { value: 42, label: 'Context usage', isLabelHidden: true }
		});
		expect(screen.container.textContent).not.toContain('42%');
		const label = screen.getByText('Context usage', exact).element();
		expect(label).toBeInTheDocument();
		await expect
			.element(screen.getByRole('progressbar'))
			.toHaveAttribute('aria-labelledby', label.id);
	});

	it('handles zero max gracefully', async () => {
		const screen = await render(ProgressBar, { props: { value: 0, max: 0, label: 'Empty' } });
		const progressbar = screen.getByRole('progressbar');
		await expect.element(progressbar).toHaveAttribute('aria-valuenow', '0');
		await expect.element(progressbar).toHaveAttribute('aria-valuemax', '0');
	});

	it('treats a NaN value as empty progress instead of leaking "NaN"', async () => {
		// e.g. an upstream `loaded / total * 100` where total is still 0.
		const screen = await render(ProgressBar, {
			props: { value: NaN, label: 'Upload', hasValueLabel: true }
		});
		const progressbar = progressbarIn(screen.container);
		expect(progressbar).toHaveAttribute('aria-valuenow', '0');
		expect(progressbar.getAttribute('aria-valuetext')).toBe('0%');
		expect(screen.container.textContent).not.toContain('NaN');
		// The filled share must be a real percentage, not "NaN%".
		const fill = progressbar.firstElementChild as HTMLElement;
		expect(fill.style.getPropertyValue('--_progress-bar-fill')).toBe('0%');
	});

	it('treats a NaN max as an empty range instead of leaking "NaN"', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 5, max: NaN, label: 'Steps', hasValueLabel: true }
		});
		const progressbar = progressbarIn(screen.container);
		expect(progressbar).toHaveAttribute('aria-valuenow', '0');
		expect(progressbar).toHaveAttribute('aria-valuemax', '0');
		expect(screen.container.textContent).not.toContain('NaN');
	});

	it('does not render NaN in the value label when max is zero', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 0, max: 0, label: 'Empty', hasValueLabel: true }
		});
		expect(screen.container.textContent).not.toMatch(/NaN|Infinity/);
		const progressbar = progressbarIn(screen.container);
		expect(progressbar.getAttribute('aria-valuetext') ?? '').not.toMatch(/NaN|Infinity/);
		await expect.element(screen.getByText('0%', exact)).toBeInTheDocument();
	});

	// Disabled state
	describe('disabled state', () => {
		it('renders with isDisabled', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Canceled', isDisabled: true, hasValueLabel: true }
			});
			await expect.element(screen.getByRole('progressbar')).toBeInTheDocument();
			await expect.element(screen.getByText('50%', exact)).toBeInTheDocument();
		});

		it('still renders label when disabled', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Canceled upload', isDisabled: true }
			});
			await expect.element(screen.getByText('Canceled upload', exact)).toBeInTheDocument();
		});
	});

	// Indeterminate mode
	describe('indeterminate mode', () => {
		it('omits authored value attributes while the value is indeterminate', async () => {
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Loading' }
			});
			const progressbar = progressbarIn(screen.container);
			expect(progressbar).not.toHaveAttribute('aria-valuenow');
			expect(progressbar).not.toHaveAttribute('aria-valuemin');
			expect(progressbar).not.toHaveAttribute('aria-valuemax');
			expect(progressbar).not.toHaveAttribute('aria-valuetext');
		});

		it('still renders label when indeterminate', async () => {
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Processing' }
			});
			await expect.element(screen.getByText('Processing', exact)).toBeInTheDocument();
		});

		it('hides value label when indeterminate even if hasValueLabel is true', async () => {
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Loading', value: 50, hasValueLabel: true }
			});
			expect(screen.container.textContent).not.toContain('50%');
		});

		it('is labelled via aria-labelledby when indeterminate', async () => {
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Loading data' }
			});
			await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-labelledby');
		});

		it('renders with all variants in indeterminate mode', async () => {
			const variants = ['accent', 'success', 'warning', 'error', 'neutral'] as const;
			for (const variant of variants) {
				const screen = await render(ProgressBar, {
					props: { isIndeterminate: true, label: variant, variant }
				});
				await expect.element(screen.getByRole('progressbar')).toBeInTheDocument();
				screen.unmount();
			}
		});

		it('drives a direction-aware indeterminate slide (mirrored keyframe under RTL)', async () => {
			// StyleX injects the keyframes + the atomic rule that swaps the
			// animation-name under `[dir="rtl"]`. Scan the injected CSS so the RTL
			// branch can be asserted without driving a real animation.
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Loading' }
			});
			await expect.element(screen.getByRole('progressbar')).toBeInTheDocument();
			const css = injectedCss();
			// LTR keyframe slides physically left → right (−100% → 250%).
			expect(css).toMatch(/translateX\(-100%\)/);
			expect(css).toMatch(/translateX\(250%\)/);
			// RTL keyframe mirrors it (100% → −250%) so the bar travels along the
			// reading flow (inline-start → inline-end, i.e. right → left).
			expect(css).toMatch(/translateX\(100%\)/);
			expect(css).toMatch(/translateX\(-250%\)/);
			// The animation-name is swapped specifically under `[dir="rtl"]`.
			expect(css).toMatch(/:is\(\[dir="rtl"\][^)]*\)[^{]*\{\s*animation-name:/);
		});
	});

	// Target marks
	describe('target marks', () => {
		it('renders no mark elements when marks is omitted', async () => {
			const screen = await render(ProgressBar, { props: { value: 50, label: 'Progress' } });
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(0);
		});

		it('renders no mark elements for an empty marks array', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [] }
			});
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(0);
		});

		it('renders a mark at the position matching its value', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 40, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks).toHaveLength(1);
			// value 80 of max 100 -> 80% along the track (RTL-safe logical property).
			expect(marks[0].style.insetInlineStart).toBe('80%');
		});

		it('positions marks relative to a custom max', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 1, max: 5, label: 'Steps', marks: [{ value: 4, label: 'M' }] }
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			// value 4 of max 5 -> 80%.
			expect(marks[0].style.insetInlineStart).toBe('80%');
		});

		it('keeps a mark past the current value visible', async () => {
			// A mark beyond the fill still renders — it layers above the fill.
			const screen = await render(ProgressBar, {
				props: { value: 20, label: 'Progress', marks: [{ value: 90, label: 'M' }] }
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks).toHaveLength(1);
			expect(marks[0].style.insetInlineStart).toBe('90%');
		});

		it('renders multiple marks', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 50,
					label: 'Progress',
					marks: [
						{ value: 25, label: 'M' },
						{ value: 50, label: 'M' },
						{ value: 80, label: 'M' }
					]
				}
			});
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(3);
		});

		it('clamps out-of-range mark positions to the track edges', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 50,
					label: 'Progress',
					marks: [
						{ value: -10, label: 'M' },
						{ value: 150, label: 'M' }
					]
				}
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks).toHaveLength(2);
			expect(marks[0].style.insetInlineStart).toBe('0%');
			expect(marks[1].style.insetInlineStart).toBe('100%');
		});

		it('drops non-finite mark values', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 50,
					label: 'Progress',
					marks: [
						{ value: NaN, label: 'M' },
						{ value: Infinity, label: 'M' },
						{ value: 60, label: 'M' }
					]
				}
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks).toHaveLength(1);
			expect(marks[0].style.insetInlineStart).toBe('60%');
		});

		it('does not render marks in indeterminate mode', async () => {
			const screen = await render(ProgressBar, {
				props: {
					isIndeterminate: true,
					label: 'Loading',
					marks: [{ value: 80, label: 'M' }]
				}
			});
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(0);
		});

		// Mark colour follows what the mark sits on: inside the filled area it takes
		// the fill variant's on-colour, out on the bare track it takes the primary
		// text colour. The choice is reflected as `data-placement` (plus
		// `data-variant`, mirroring the fill) so themes can target it and tests can
		// assert it without reading atomic class names.
		it('marks the ticks inside the filled area as placed on the fill', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 60,
					label: 'Progress',
					marks: [
						{ value: 25, label: 'Behind' },
						{ value: 90, label: 'Ahead' }
					]
				}
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks[0]).toHaveAttribute('data-placement', 'fill');
			expect(marks[1]).toHaveAttribute('data-placement', 'track');
			// Different placements resolve to different colour styles.
			expect(styleClasses(marks[0])).not.toBe(styleClasses(marks[1]));
		});

		it('treats a mark exactly at the current value as on the fill', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 70, label: 'Progress', marks: [{ value: 70, label: 'Goal' }] }
			});
			expect(screen.container.querySelector(MARK)).toHaveAttribute('data-placement', 'fill');
		});

		it('places every mark on the track at zero progress', async () => {
			// With no fill drawn, even a mark at 0 sits on the bare track.
			const screen = await render(ProgressBar, {
				props: {
					value: 0,
					label: 'Progress',
					marks: [
						{ value: 0, label: 'Start' },
						{ value: 50, label: 'Goal' }
					]
				}
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks[0]).toHaveAttribute('data-placement', 'track');
			expect(marks[1]).toHaveAttribute('data-placement', 'track');
			expect(styleClasses(marks[0])).toBe(styleClasses(marks[1]));
		});

		it('mirrors the fill variant on marks so the on-color matches the bar', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 80,
					variant: 'warning',
					label: 'Budget used',
					marks: [
						{ value: 50, label: 'Half' },
						{ value: 95, label: 'Cap' }
					]
				}
			});
			const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
			expect(marks[0]).toHaveAttribute('data-variant', 'warning');
			expect(marks[0]).toHaveAttribute('data-placement', 'fill');
			expect(marks[1]).toHaveAttribute('data-variant', 'warning');
			expect(marks[1]).toHaveAttribute('data-placement', 'track');
		});

		it('uses the disabled variant for marks when the bar is disabled', async () => {
			const screen = await render(ProgressBar, {
				props: {
					value: 80,
					variant: 'error',
					isDisabled: true,
					label: 'Canceled',
					marks: [{ value: 50, label: 'Half' }]
				}
			});
			expect(screen.container.querySelector(MARK)).toHaveAttribute('data-variant', 'disabled');
		});

		it('keeps one plain foreground on both sides for neutral and disabled bars', async () => {
			// The neutral/disabled fill is the muted grey — it carries no semantic
			// weight and has no on-token, so a mark on it takes the same plain
			// foreground it would have out on the track.
			for (const props of [{ variant: 'neutral' } as const, { isDisabled: true } as const]) {
				const screen = await render(ProgressBar, {
					props: {
						value: 60,
						label: 'Progress',
						...props,
						marks: [
							{ value: 20, label: 'On fill' },
							{ value: 90, label: 'On track' }
						]
					}
				});
				const marks = screen.container.querySelectorAll<HTMLElement>(MARK);
				expect(marks[0]).toHaveAttribute('data-placement', 'fill');
				expect(marks[1]).toHaveAttribute('data-placement', 'track');
				expect(styleClasses(marks[0])).toBe(styleClasses(marks[1]));
				screen.unmount();
			}
		});

		it("dims a disabled bar's marks below a live one's", async () => {
			// A disabled bar is deliberately low-emphasis (its label and value text
			// drop to muted colours), so its marks step down to the secondary
			// foreground on both sides rather than shouting over the greyed-out bar.
			// A live neutral bar — same muted grey fill — keeps the full-contrast
			// primary foreground.
			const MARKS = [
				{ value: 20, label: 'On fill' },
				{ value: 90, label: 'On track' }
			];
			const liveScreen = await render(ProgressBar, {
				props: { value: 60, variant: 'neutral', label: 'A', marks: MARKS }
			});
			const live = Array.from(liveScreen.container.querySelectorAll<HTMLElement>(MARK)).map(
				styleClasses
			);
			liveScreen.unmount();

			const offScreen = await render(ProgressBar, {
				props: { value: 60, isDisabled: true, label: 'B', marks: MARKS }
			});
			const off = Array.from(offScreen.container.querySelectorAll<HTMLElement>(MARK)).map(
				styleClasses
			);

			expect(off[0]).not.toBe(live[0]);
			expect(off[1]).not.toBe(live[1]);
		});

		it('recolors marks per variant when they sit on the fill', async () => {
			// Two bars at the same progress with different variants give their
			// on-fill marks different colours (different atomic classes), while their
			// on-track marks stay the same foreground colour.
			const MARKS = [
				{ value: 20, label: 'On fill' },
				{ value: 90, label: 'On track' }
			];
			const accentScreen = await render(ProgressBar, {
				props: { value: 60, variant: 'accent', label: 'A', marks: MARKS }
			});
			const accent = Array.from(accentScreen.container.querySelectorAll<HTMLElement>(MARK)).map(
				styleClasses
			);
			accentScreen.unmount();

			const errorScreen = await render(ProgressBar, {
				props: { value: 60, variant: 'error', label: 'B', marks: MARKS }
			});
			const error = Array.from(errorScreen.container.querySelectorAll<HTMLElement>(MARK)).map(
				styleClasses
			);

			expect(accent[0]).not.toBe(error[0]);
			expect(accent[1]).toBe(error[1]);
		});

		it('renders every mark as a named, focusable image before its tooltip opens', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'Goal' }] }
			});
			const mark = screen.container.querySelector<HTMLElement>(MARK) as HTMLElement;
			// A mark always stands for something meaningful, so it is never
			// aria-hidden, is a named image, and is always keyboard-focusable to
			// reveal its label.
			expect(mark).not.toHaveAttribute('aria-hidden');
			expect(mark).toHaveAttribute('tabindex', '0');
			expect(mark).toHaveAttribute('role', 'img');
			expect(mark).toHaveAttribute('aria-label', 'Goal');
		});

		it('reveals a labeled mark via a focusable Tooltip trigger', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'Goal' }] }
			});
			// Focusable so keyboard users can reveal the label; the tick owns its name
			// independently of the tooltip's description. The Tooltip loads lazily, so
			// re-query the live element and wait for it to attach aria-describedby.
			const mark0 = screen.container.querySelector<HTMLElement>(MARK) as HTMLElement;
			expect(mark0).toHaveAttribute('tabindex', '0');
			expect(mark0).not.toHaveAttribute('aria-hidden');
			await vi.waitFor(() => {
				expect(screen.container.querySelector(MARK)).toHaveAttribute('aria-describedby');
			});
			const mark = screen.container.querySelector<HTMLElement>(MARK) as HTMLElement;
			const tip = document.getElementById(mark.getAttribute('aria-describedby') as string);
			expect(tip).toHaveTextContent('Goal');
		});

		it('keeps the progressbar element free of role="img"/aria-label children', async () => {
			// Marks stay outside the progressbar's presentational subtree; their
			// Tooltip descriptions must not change the bar's own semantics.
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'Goal' }] }
			});
			const progressbar = progressbarIn(screen.container);
			expect(progressbar.querySelector('[role="img"]')).toBeNull();
			expect(progressbar.querySelector('[aria-label]')).toBeNull();
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(1);
		});

		it('does not add mark info to the progressbar aria-valuetext', async () => {
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'Goal' }] }
			});
			const progressbar = progressbarIn(screen.container);
			expect(progressbar.getAttribute('aria-valuetext')).toBe('50%');
		});

		it('keeps the fill as the progressbar child when marks are rendered', async () => {
			// Only the fill belongs to the semantic track. The focusable marks stay
			// outside its presentational subtree.
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
			});
			const progressbar = progressbarIn(screen.container);
			const fill = progressbar.firstElementChild as HTMLElement;
			expect(fill.style.getPropertyValue('--_progress-bar-fill')).toBe('50%');
			expect(fill.classList.contains('astryx-progress-bar-mark')).toBe(false);
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(1);
		});

		it('keeps marks outside the clipping track, so a themed tall mark can still overhang', async () => {
			// The track clips its fill to the rounded rail. Marks sit beside the
			// track in its unclipped container, never inside it, so a theme that
			// makes a mark taller than the bar still sees it overhang both edges.
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
			});
			const progressbar = progressbarIn(screen.container);
			const marks = Array.from(screen.container.querySelectorAll<HTMLElement>(MARK));
			expect(marks).toHaveLength(1);
			const css = injectedCss();
			const clips = (el: Element) =>
				Array.from(el.classList).some((cls) =>
					new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*overflow:\\s*hidden`, 'i').test(css)
				);
			for (const mark of marks) {
				expect(progressbar.contains(mark)).toBe(false);
				// No ancestor between the mark and the bar's root clips it.
				let node = mark.parentElement;
				while (node != null && node !== screen.container) {
					expect(clips(node)).toBe(false);
					node = node.parentElement;
				}
			}
		});

		it('clips the track in determinate mode (the fill slides in from the start)', async () => {
			// The determinate fill spans the whole track and is moved back by the
			// unfilled share; the track's clip keeps the moved-out part hidden.
			const screen = await render(ProgressBar, { props: { value: 30, label: 'Progress' } });
			const progressbar = progressbarIn(screen.container);
			expect(hasDeclarationFor(progressbar, /overflow:\s*hidden/)).toBe(true);
		});

		it('moves the determinate fill with a transform, not its width, except under forced colors', async () => {
			// A width transition lays out and repaints on the main thread every
			// frame, so it stalls while a script runs; a transform transition runs
			// on the compositor. The fill spans the track and its leading edge sits
			// at the filled share, mirrored in RTL.
			const screen = await render(ProgressBar, { props: { value: 30, label: 'Progress' } });
			const fill = progressbarIn(screen.container).firstElementChild as HTMLElement;
			// The stylesheet's rules, apart and under forced colors. Layers group
			// like conditions do, so the walk descends them without adding one.
			let css = '';
			let forcedCss = '';
			const collect = (rules: CSSRuleList, forced: boolean) => {
				for (const rule of Array.from(rules)) {
					if (rule instanceof CSSMediaRule) {
						collect(
							rule.cssRules,
							forced || /forced-colors:\s*active/.test(rule.conditionText ?? rule.media.mediaText)
						);
					} else if (rule instanceof CSSStyleRule) {
						if (forced) forcedCss += rule.cssText + '\n';
						else css += rule.cssText + '\n';
					} else if ('cssRules' in rule) {
						// A style rule has a (usually empty) `cssRules` for CSS
						// nesting, so this must follow the style-rule check.
						collect((rule as CSSGroupingRule).cssRules, forced);
					}
				}
			};
			for (const sheet of Array.from(document.styleSheets)) {
				collect(sheet.cssRules, false);
			}
			const declarationsIn = (text: string) =>
				Array.from(fill.classList)
					.flatMap((cls) =>
						Array.from(text.matchAll(new RegExp(`\\.${cls}\\b[^{]*\\{([^}]*)\\}`, 'g')), (m) =>
							m[1].trim()
						)
					)
					.join('\n');
			const joined = declarationsIn(css);
			expect(fill.style.width).toBe('');
			expect(fill.style.getPropertyValue('--_progress-bar-fill')).toBe('30%');
			expect(joined).toMatch(/width:\s*100%/);
			expect(joined).toMatch(/transition-property:\s*transform/);
			expect(joined).not.toMatch(/transition-property:\s*width/);
			expect(joined).toMatch(/will-change:\s*transform/);
			expect(joined).toMatch(
				/transform:\s*translateX\(calc\(var\(--_progress-bar-fill,\s*0%\) - 100%\)\)/
			);
			expect(css).toMatch(
				// The bar's own direction (`:dir(rtl)`), not any RTL ancestor.
				/:dir\(rtl\)[^{]*\{[^}]*transform:\s*translateX\(calc\(100% - var\(--_progress-bar-fill,\s*0%\)\)\)/
			);
			// Under forced colors the fill is sized to the value instead, so the
			// track's clip never cuts its CanvasText outline; the outline is checked
			// in the forced-colors case below.
			const forced = declarationsIn(forcedCss);
			expect(forced).toMatch(/width:\s*var\(--_progress-bar-fill,\s*0%\)/);
			expect(forced).toMatch(/transform:\s*none/);
			expect(forced).toMatch(/transition-property:\s*width/);
			expect(forced).toMatch(/will-change:\s*auto/);
		});

		it('clips the track in indeterminate mode (the sliding fill must not escape)', async () => {
			// Regression: the indeterminate fill slides from translateX -100% to
			// 250%, deliberately overshooting the track, and relies on the track
			// clipping it to the visible window.
			const screen = await render(ProgressBar, {
				props: { isIndeterminate: true, label: 'Loading' }
			});
			const progressbar = progressbarIn(screen.container);
			expect(hasDeclarationFor(progressbar, /overflow:\s*hidden/)).toBe(true);
		});

		it('sizes the mark through the derived vars, so a theme override cannot lose the cascade', async () => {
			// width/height are declared as `var(--_progressbar-mark-*)` and nothing
			// else declares those vars, so the value a theme sets on the
			// `progress-bar-mark` target lands even in a consumer whose StyleX is
			// unlayered and would otherwise outrank `@layer astryx-theme`.
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
			});
			const mark = screen.container.querySelector<HTMLElement>(MARK) as HTMLElement;
			expect(hasDeclarationFor(mark, /width:\s*var\(--_progressbar-mark-width,\s*2px\)/)).toBe(
				true
			);
			expect(hasDeclarationFor(mark, /height:\s*var\(--_progressbar-mark-height,\s*8px\)/)).toBe(
				true
			);
		});

		it('renders the mark on the stable progress-bar-mark target, centered for symmetric overhang', async () => {
			// The mark's width/height/color are directly overridable via the
			// `progress-bar-mark` theme target. It is centred on the track
			// (translate -50%,-50%) so a themed taller tick overhangs the bar
			// symmetrically above and below without being clipped.
			const screen = await render(ProgressBar, {
				props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
			});
			const mark = screen.container.querySelector<HTMLElement>(MARK) as HTMLElement;
			expect(mark.className).toContain('astryx-progress-bar-mark');
			// Scoped to the mark's own atomic classes: the injected sheet is
			// repo-wide, so upstream's unscoped grep would pass on any component's
			// centring rule.
			expect(hasDeclarationFor(mark, /transform:\s*translate\(-50%,\s*-50%\)/)).toBe(true);
			expect(screen.container.querySelectorAll(MARK)).toHaveLength(1);
		});
	});
});

describe('ProgressBar theme target names', () => {
	it('renders the canonical target classes', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 50, label: 'Progress', marks: [{ value: 80, label: 'M' }] }
		});
		expect(screen.container.querySelector('.astryx-progress-bar')).toHaveClass(
			'astryx-progress-bar'
		);
		expect(screen.container.querySelector('.astryx-progress-bar-track')).toHaveClass(
			'astryx-progress-bar-track'
		);
		expect(screen.container.querySelector('.astryx-progress-bar-fill')).toHaveClass(
			'astryx-progress-bar-fill'
		);
		expect(screen.container.querySelector('.astryx-progress-bar-mark')).toHaveClass(
			'astryx-progress-bar-mark'
		);
		// Deliberate divergence from upstream: the legacy names stay beside the
		// canonical ones through the deprecation window, so themes that style
		// `.astryx-progressbar*` keep working. Upstream dropped them in 0.7.13.
		expect(screen.container.querySelector('.astryx-progressbar')).toHaveClass('astryx-progressbar');
		expect(screen.container.querySelector('.astryx-progressbar-mark')).toHaveClass(
			'astryx-progressbar-mark'
		);
	});
});

/**
 * The value the browser would give `property` on `el` with this pointer and
 * reduced-motion preference. That is the last rule (in stylesheet order) for
 * one of its classes whose media conditions all hold. StyleX rewrites a key
 * into conditions that negate its later siblings, so this evaluates them
 * rather than matching their text. `@supports` blocks never hold (no engine
 * gate).
 */
function valueUnder(
	el: Element,
	property: string,
	env: { coarse: boolean; reduce: boolean }
): string | undefined {
	const holds = (condition: string): boolean => {
		const tokens = condition
			.replace(/\(pointer:\s*coarse\)/g, env.coarse ? ' T ' : ' F ')
			.replace(/\(prefers-reduced-motion:\s*reduce\)/g, env.reduce ? ' T ' : ' F ')
			// A mouse hovers; any other feature is taken as unmet.
			.replace(/\(hover:\s*hover\)/g, env.coarse ? ' F ' : ' T ')
			.replace(/\([a-z-]+:[^()]*\)/g, ' F ')
			// Every remaining feature is unmet. Keep a `( T )`/`( F )` group and its
			// negation intact: those are the replacements above, not features.
			.replace(/\((?!\s*(?:not\s+)?[TF]\s*\))[^()]*\)/g, ' F ')
			.replace(/\(/g, ' ( ')
			.replace(/\)/g, ' ) ')
			.trim()
			.split(/\s+/);
		let i = 0;
		const or = (): boolean => {
			let value = and();
			while (tokens[i] === 'or') {
				i += 1;
				value = and() || value;
			}
			return value;
		};
		const and = (): boolean => {
			let value = unary();
			while (tokens[i] === 'and') {
				i += 1;
				value = unary() && value;
			}
			return value;
		};
		// Any feature left over — a container width, say — is taken as unmet, as
		// the upstream helper does for hover. The repo-wide sheet carries every
		// component's media rules, so the evaluator must not throw on one.
		const unary = (): boolean => {
			const token = tokens[i++];
			if (token === 'not') {
				return !unary();
			}
			if (token === '(') {
				const value = or();
				i += 1; // ')'
				return value;
			}
			if (token === 'T' || token === 'F') {
				return token === 'T';
			}
			throw new Error(`unexpected ${token} in ${condition}`);
		};
		return or();
	};
	// StyleX raises a conditional rule's specificity by repeating its class,
	// so the winner is the most specific matching rule, then the last one.
	let best: { value: string; specificity: number } | undefined;
	const specificityOf = (selector: string) =>
		(selector.split(':not(')[0].match(/\./g) ?? []).length;
	const visit = (rules: CSSRuleList, ok: boolean) => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSMediaRule) {
				// The repo-wide sheet carries every component's media rules, including
				// kinds this evaluator does not model (a bare `print`, a container
				// query). Those do not govern this element, so treat them as unmet.
				let applies = false;
				try {
					applies = holds(rule.conditionText ?? rule.media.mediaText);
				} catch {
					applies = false;
				}
				visit(rule.cssRules, ok && applies);
			} else if (rule instanceof CSSSupportsRule) {
				visit(rule.cssRules, false);
			} else if (rule instanceof CSSStyleRule) {
				if (
					ok &&
					Array.from(el.classList).some((c) => rule.selectorText.includes(`.${c}`)) &&
					rule.style.getPropertyValue(property) !== ''
				) {
					const specificity = specificityOf(rule.selectorText);
					if (best == null || specificity >= best.specificity) {
						best = { value: rule.style.getPropertyValue(property), specificity };
					}
				}
			} else if ('cssRules' in rule) {
				// @layer and other grouping rules hold whatever they wrap.
				visit((rule as CSSGroupingRule).cssRules, ok);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		visit(sheet.cssRules, true);
	}
	return best?.value;
}

/**
 * The declarations the element's classes carry, as `prop: value`. It reads
 * rules at the top level (`media` null), inside `@media <media>`, or inside
 * exactly the nested conditions listed. Those are `@media` texts as they are
 * and `@supports` ones prefixed, in either nesting order. Layers group their
 * rules without adding a condition.
 */
function rulesOf(el: Element, media: string | null | ReadonlyArray<string>): string[] {
	const out: string[] = [];
	const key = (list: ReadonlyArray<string>) => list.slice().sort().join(' & ');
	const want = key(media == null ? [] : typeof media === 'string' ? [media] : media);
	const visit = (rules: CSSRuleList, conditions: ReadonlyArray<string>) => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSMediaRule) {
				visit(rule.cssRules, [...conditions, rule.conditionText ?? rule.media.mediaText]);
			} else if (rule instanceof CSSSupportsRule) {
				visit(rule.cssRules, [...conditions, `@supports ${rule.conditionText}`]);
			} else if (rule instanceof CSSStyleRule) {
				if (key(conditions) !== want) continue;
				if (Array.from(el.classList).some((c) => rule.selectorText.includes(`.${c}`))) {
					for (let i = 0; i < rule.style.length; i += 1) {
						const prop = rule.style[i];
						out.push(`${prop}: ${rule.style.getPropertyValue(prop)}`);
					}
				}
			} else if ('cssRules' in rule) {
				// @layer and other grouping rules hold whatever they wrap. A style
				// rule also has a (usually empty) `cssRules` for CSS nesting, so this
				// must follow the style-rule check.
				visit((rule as CSSGroupingRule).cssRules, conditions);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		visit(sheet.cssRules, []);
	}
	// The compiled sheet reaches a browser-test page twice (Vite's dev server and
	// `setup-stylex.ts`), so the same declaration can be collected twice. Compare
	// distinct declarations, as the keyframe case does.
	return [...new Set(out)];
}

const valueOf = (declarations: string[], prop: string) =>
	declarations.filter((d) => d.startsWith(`${prop}:`)).map((d) => d.slice(prop.length + 1).trim());

describe('ProgressBar under a finger: UIProgressView', () => {
	const view = progressBar.progressView;
	// The resolver's touch query, as TOUCH_QUERY spells it: every touch device.
	const TOUCH = TOUCH_QUERY;
	const fillOf = () =>
		document.querySelector('[role="progressbar"]')?.firstElementChild as HTMLElement;
	const moveOf = () => fillOf().style.getPropertyValue('--_progress-bar-move');
	const source = () => styleSource;

	it('styles a mark the minimum fill covers as on the fill', async () => {
		// A finger, as the touch presentation resolver reads it, and a real track
		// 200 px wide: the 16 px minimum covers its first 8%.
		const restore = stubTouchMedia();
		try {
			const screen = await render(ProgressBar, {
				props: {
					value: 2,
					label: 'Upload',
					style: 'width: 200px',
					marks: [
						{ value: 5, label: 'Covered' },
						{ value: 20, label: 'Ahead' }
					]
				}
			});
			await vi.waitFor(() => {
				const placements = Array.from(screen.container.querySelectorAll('[data-placement]')).map(
					(mark) => mark.getAttribute('data-placement')
				);
				// 5% sits inside the drawn 8%; 20% is out on the track.
				expect(placements).toEqual(['fill', 'track']);
			});
		} finally {
			restore();
		}
	});

	it('moves linearly for the progress.fillTrackMs role times the share of the track it moved, from the last value', async () => {
		const screen = await render(ProgressBar, { props: { value: 10, label: 'Upload' } });
		// Nothing to animate on the first render.
		expect(moveOf()).toBe('0ms');
		await screen.rerender({ value: 60, label: 'Upload' });
		expect(moveOf()).toBe(`${0.5 * progressBar.fillTrackMs}ms`);
		// A re-render with the same value keeps the running move's length.
		await screen.rerender({ value: 60, label: 'Upload' });
		expect(moveOf()).toBe(`${0.5 * progressBar.fillTrackMs}ms`);
		// The duration is the model change: 60 → 40 is 0.2 of the track.
		await screen.rerender({ value: 40, label: 'Upload' });
		expect(moveOf()).toBe(`${0.2 * progressBar.fillTrackMs}ms`);
		// On the progress.curves.fill role: linear.
		expect(fillOf().style.getPropertyValue('--_progress-bar-curve')).toBe(
			formatMotionRoleValue('curve', progressBar.curves.fill)
		);
		const touch = { coarse: true, reduce: false };
		// CSS scales the move by the theme's tempo.
		expect(valueUnder(fillOf(), 'transition-duration', touch)).toMatch(
			/^calc\(var\(--_progress-bar-move,\s*0m?s\)\s*\*\s*var\(--_astryx-motion-tempo,\s*1\)\)$/
		);
		expect(valueUnder(fillOf(), 'transition-timing-function', touch)).toMatch(
			/^var\(--_progress-bar-curve,\s*linear\)$/
		);
		// No engine gate: the touch query alone decides, on every touch device.
		// Scoped to the style module: the page-wide sheet carries other
		// components' iOS gates (the 16px input floor), so upstream's page-wide
		// grep would hit one and prove nothing about this component.
		expect(source()).not.toContain('-webkit-touch-callout');
		// With a mouse or trackpad the theme's tokens still time it.
		const fine = rulesOf(fillOf(), null);
		expect(valueOf(fine, 'transition-duration')[0]).toMatch(/^var\(--/);
		expect(valueOf(fine, 'transition-timing-function')[0]).toMatch(/^var\(--/);
	});

	it('never draws shorter than two track heights above zero, and paints nothing at zero', async () => {
		const screen = await render(ProgressBar, { props: { value: 0, label: 'Upload' } });
		const track = progressbarIn(screen.container);
		const trackHeight = Number.parseFloat(valueOf(rulesOf(track, null), 'height')[0]);
		const minimum = view.minimumFillHeights * trackHeight;
		expect(TOUCH_MIN_FILL_PX).toBe(minimum);
		expect(fillOf().style.getPropertyValue('--_progress-bar-min')).toBe(`${minimum}px`);
		// Read from the source. The touch transform sits under a negated StyleX
		// condition (the forced-colors key after it). The browser's compiled sheet
		// may not expose every negated condition through the CSSOM, so the source
		// is the complete statement of the rule.
		const compact = source().replace(/\s+/g, '');
		const fill = compact.slice(compact.indexOf('fill:{'));
		const transform = fill.slice(fill.indexOf('transform:{'), fill.indexOf('willChange:'));
		const coarse = transform.slice(transform.indexOf("'@media(pointer:coarse)':{"));
		const atLeast = 'max(var(--_progress-bar-fill,0%),var(--_progress-bar-min,0px))';
		expect(coarse).toContain(atLeast);
		// Mirrored in RTL: the fill stops at the same minimum from the right.
		expect(coarse).toContain('calc(100%-var(--_progress-bar-min,0px))');
		// Under forced colors with a finger the sized fill keeps that minimum,
		// and lands at once: sizing is layout, which touch motion never animates.
		const width = fill.slice(fill.indexOf('width:{'), fill.indexOf('height:'));
		expect(width).toContain(atLeast);
		const duration = fill.slice(
			fill.indexOf('transitionDuration:{'),
			fill.indexOf('transitionTimingFunction:')
		);
		expect(duration).toMatch(
			/'@media\(pointer:coarse\)':\{default:[^}]*'@media\(forced-colors:active\)':'0s'/
		);
		// At zero the fill paints nothing under a finger (UIKit's alpha 0)…
		expect(view.emptyFillAlpha).toBe(0);
		expect(valueOf(rulesOf(fillOf(), TOUCH), 'opacity')).toEqual(['0']);
		// …and is drawn as soon as there is any progress.
		await screen.rerender({ value: 1, label: 'Upload' });
		expect(valueOf(rulesOf(fillOf(), TOUCH), 'opacity')).toEqual([]);
	});

	it('plays the progress table roles, never a literal', () => {
		registerProgressBarTable();
		expect(motionRole('progress.fillTrackMs')?.value).toBe(progressBar.fillTrackMs);
		expect(motionRoleOf(progressBar.curves.fill)?.id).toBe('progress.curves.fill');
		const text = source();
		const fill = text.slice(text.indexOf('fill: {'), text.indexOf('fillEmpty: {'));
		expect(fill).not.toMatch(/\d+m?s\)'|'linear'|\b16px\b/);
	});

	it('declares 0 s under both shared reduced-motion queries, after the touch key', () => {
		// The fill's transition-duration declares 0 s under both shared
		// reduced-motion queries, after the touch key so they win there. Read from
		// the source: the browser's compiled sheet may not expose every negated
		// condition through the CSSOM.
		const text = source();
		const fill = text.slice(text.indexOf('fill: {'));
		const duration = fill.slice(
			fill.indexOf('transitionDuration: {'),
			fill.indexOf('transitionTimingFunction:')
		);
		const keys = [REDUCED_MOTION_INSTANT_QUERY, REDUCED_MOTION_FADE_QUERY].map((query) =>
			duration.indexOf(`'@media ${query}':`)
		);
		expect(keys.every((index) => index >= 0)).toBe(true);
		expect(duration.indexOf("'@media (pointer: coarse)':")).toBeLessThan(Math.min(...keys));
		for (const index of keys) {
			// The last key has no trailing comma under this repo's formatter, so the
			// segment ends in a newline and a closing brace rather than `,`.
			expect(duration.slice(index).split(',')[0]).toMatch(/'0s'/);
		}
	});
});

describe('ProgressBar under reduced motion: the indeterminate pulse', () => {
	const fillOf = () =>
		document.querySelector('[role="progressbar"]')?.firstElementChild as HTMLElement;
	const source = () => styleSource;

	for (const coarse of [false, true]) {
		it(`spans the track and only pulses its opacity, with ${coarse ? 'a finger' : 'a mouse'}`, async () => {
			await render(ProgressBar, { props: { isIndeterminate: true, label: 'Loading' } });
			const fill = fillOf();
			const reduce = { coarse, reduce: true };
			expect(valueUnder(fill, 'width', reduce)).toBe('100%');
			expect(valueUnder(fill, 'animation-duration', reduce)).toMatch(
				/^var\(--_progress-bar-pulse\)$/
			);
			expect(valueUnder(fill, 'animation-timing-function', reduce)).toMatch(
				/^var\(--_progress-bar-pulse-curve\)$/
			);
			expect(valueUnder(fill, 'animation-direction', reduce)).toBe('alternate');
			// Without reduced motion the 40% segment still slides.
			const motion = { coarse, reduce: false };
			expect(valueUnder(fill, 'width', motion)).toBe('40%');
			expect(valueUnder(fill, 'animation-duration', motion)).toBe('1.5s');
			expect(valueUnder(fill, 'animation-direction', motion)).toBeUndefined();
		});
	}

	it('pulses from full opacity down to the progress table floor and back', async () => {
		await render(ProgressBar, { props: { isIndeterminate: true, label: 'Loading' } });
		expect(fillOf().style.getPropertyValue('--_progress-bar-pulse-floor')).toBe(
			String(progressBar.reducedMotionPulseFloor)
		);
		expect(progressBar.reducedMotionPulseFloor).toBe(0.84);
		// The compiled sheet reaches a browser-test page twice; compare distinct
		// rule texts so upstream's "exactly one keyframe" holds here.
		const frames = [
			...new Set(
				Array.from(document.styleSheets)
					.flatMap((sheet) => Array.from(sheet.cssRules))
					.map((rule) => rule.cssText.replace(/\s+/g, ''))
					.filter((text) => text.startsWith('@keyframes'))
					.filter((text) => text.includes('--_progress-bar-pulse-floor'))
			)
		];
		expect(frames).toHaveLength(1);
		expect(frames[0]).toMatch(/opacity:1/);
		expect(frames[0]).toMatch(/opacity:var\(--_progress-bar-pulse-floor\)/);
		// The pulse never moves the fill.
		expect(frames[0]).not.toMatch(/transform/);
	});

	it('plays the progress.reducedMotionPulseMs role on the timing.curves.move curve, which tempo does not scale', async () => {
		await render(ProgressBar, { props: { isIndeterminate: true, label: 'Loading' } });
		const fill = fillOf();
		expect(fill.style.getPropertyValue('--_progress-bar-pulse')).toBe(
			`${progressBar.reducedMotionPulseMs}ms`
		);
		expect(progressBar.reducedMotionPulseMs).toBe(2000);
		expect(fill.style.getPropertyValue('--_progress-bar-pulse-curve')).toBe(
			formatMotionRoleValue('curve', timing.curves.move)
		);
		registerProgressBarTable();
		expect(motionRole('progress.reducedMotionPulseMs')?.value).toBe(
			progressBar.reducedMotionPulseMs
		);
		// A busy loop: nothing in the indeterminate fill reads the theme's tempo,
		// and its reduced-motion keys play no literal.
		const text = source();
		const block = text.slice(
			text.indexOf('indeterminateFill: {'),
			text.indexOf('// A mark is a vertical tick')
		);
		expect(block).not.toContain('--_astryx-motion-tempo');
		const reduceValues = [
			...block.matchAll(/'@media \(prefers-reduced-motion: reduce\)':\s*([^,\n]+)/g)
		].map((match) => match[1].trim());
		expect(reduceValues.length).toBeGreaterThan(0);
		for (const value of reduceValues) {
			expect(value).not.toMatch(/^'\d+(\.\d+)?m?s'$|cubic-bezier|ease/);
		}
	});
});

/**
 * The declarations a forced-colors rule targeting `el` carries. Upstream's
 * helper reads the page-wide forced-colors text; the complete sheet this port
 * injects makes that pass on some other component's outline, so this narrows
 * to the rules that actually apply to `el`.
 */
function forcedColorDeclarationsFor(el: Element): string {
	const out: string[] = [];
	const visit = (rules: CSSRuleList, forced: boolean) => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSMediaRule) {
				visit(
					rule.cssRules,
					forced || /forced-colors:\s*active/.test(rule.conditionText ?? rule.media.mediaText)
				);
			} else if (forced && rule instanceof CSSStyleRule) {
				if (Array.from(el.classList).some((c) => rule.selectorText.includes(`.${c}`))) {
					for (let i = 0; i < rule.style.length; i += 1) {
						const prop = rule.style[i];
						out.push(`${prop}: ${rule.style.getPropertyValue(prop)};`);
					}
				}
			} else if ('cssRules' in rule) {
				// A style rule has a (usually empty) `cssRules` for CSS nesting.
				visit((rule as CSSGroupingRule).cssRules, forced);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			visit(sheet.cssRules, false);
		} catch {
			// ignore cross-origin sheets
		}
	}
	return out.join('\n');
}

// jsdom cannot emulate forced colors, so this asserts the compiled rule the
// status fill relies on (architecture:theme-tokens INV11).
describe('ProgressBar forced colors', () => {
	it('keeps a visible boundary on the status fill', async () => {
		const screen = await render(ProgressBar, {
			props: { value: 40, variant: 'error', label: 'Upload' }
		});
		const fill = progressbarIn(screen.container).firstElementChild as HTMLElement;
		const css = forcedColorDeclarationsFor(fill);
		expect(css).toContain('outline-style: solid;');
		expect(css).toContain('outline-color: canvastext;');
	});
});
