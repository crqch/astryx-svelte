/** PORTS: TabList/TabList.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { PRESS_FADE_MS } from '$lib/utils/press-gesture.js';
import { durationDefaults } from '$lib/styles/tokens.stylex.js';
import TabListFixture from './fixtures/tab-list-fixture.svelte';
import ControlledTabList from './fixtures/tab-list-controlled-fixture.svelte';
import CustomLink from './fixtures/custom-link.svelte';
import { cssIn } from './forced-colors.js';

/**
 * Astryx's `TabList/TabList.test.tsx`, ported case for case at the **0.7.13**
 * pin, the version this port targets.
 *
 * One case is not here, named rather than silently dropped:
 * `picks the option a press slid across the menu lifts on, once
 * (family:action-groups FR1, FR2, FR5)`. Its subject is the `useMenuPress`
 * slide-to-select press model, which this port has not ported — `TabMenu` here
 * selects on click only. `hooks/useMenuPress.test.tsx` is unported for the same
 * reason. Client (real Chromium) project.
 *
 * Standing translations:
 *
 * - Tabs are a data spec through `tab-list-fixture` (`icon`/`selectedIcon`/
 *   `endContent` are `Snippet`s here, and a snippet can only be authored in a
 *   template). `TabList` itself takes compositional `children` on both sides —
 *   it never sliced them — so nothing about the strip's shape changes.
 * - Upstream's `beforeAll` stubbing `showPopover`/`hidePopover`/`:popover-open`
 *   is gone: Chromium is native. The cases that assert on the *call*
 *   `vi.spyOn` the native method, which calls through — the same move
 *   `dropdown-menu`/`more-menu` make. The popover-navigation case opens the
 *   popover for real, because a closed one is `display: none` here.
 * - `getByRole(…, {hidden: true})` becomes a container `querySelector`: a closed
 *   popover is `display: none` in a real browser, so an accessibility-tree query
 *   cannot see it.
 * - `fireEvent.keyDown(el, …)` becomes `dispatchEvent(new KeyboardEvent(…))`.
 * - `rerender` maps straight across; `vitest-browser-svelte`'s is async.
 * - `userEvent.click` refuses an `aria-disabled="true"` element, because
 *   Playwright's actionability check reads it as disabled; jsdom's user-event
 *   dispatched the click regardless. The disabled-tab case dispatches the DOM
 *   click directly, which is the event the component's own guard receives.
 * - The overflow suite describes jsdom's missing layout by hand. Those fakes
 *   carry over unchanged (`Object.defineProperty` for the scroll box,
 *   `getBoundingClientRect` on the instance), and a dispatched `scroll` event
 *   replaces `fireEvent.scroll`. Upstream's expected pixel deltas assume
 *   `parseFloat('calc(…)')` is `NaN` in jsdom; Chromium resolves the strip's
 *   `scroll-padding` to 32px, so the cases that assert an exact delta set it to
 *   zero first, and the statements about intent (which edge, which direction)
 *   are unchanged.
 * - Computed values Chromium resolves where jsdom kept declarations literal
 *   are restated against the resolved value, never loosened past the claim; the
 *   cases say where.
 * - The pressed-state helpers (`hasPressedArm`, `hasReleaseFade`,
 *   `readsPressStrength`) are local ports of upstream's `__tests__/pressState`:
 *   they scope the stylesheet scan to the element's own compiled classes rather
 *   than reading jsdom's per-test injected sheets globally.
 *
 * Two restated cases, both noted at the case and with their assertions intact:
 * `moves focus between items with ArrowDown and ArrowUp` and `moves the roving
 * tab stop with arrow navigation`. The APG focus-on-open `requestAnimationFrame`
 * has *settled* by the time a Playwright click resolves, where jsdom's timing
 * leaves it pending — so the menu opens with its first item already focused and
 * upstream's key sequence is shifted by one step. What is asserted (ArrowDown
 * advances, ArrowUp retreats, the tab stop follows focus) is unchanged.
 */

const menuOptions = [
	{ value: 'analytics', label: 'Analytics' },
	{ value: 'reports', label: 'Reports' }
];

const homeAndSettings = [
	{ props: { value: 'home', label: 'Home' } },
	{ props: { value: 'settings', label: 'Settings' } }
];

function navIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('nav');
	if (!el) throw new Error('expected a <nav>');
	return el;
}

function navClassSet(container: HTMLElement): Set<string> {
	return new Set(navIn(container).className.split(/\s+/).filter(Boolean));
}

function menuIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[role="menu"]');
	if (!(el instanceof HTMLElement)) throw new Error('expected a role="menu" element');
	return el;
}

/**
 * The overflow menu is single-select, so its options are `menuitemradio` rows
 * (APG menu-button), not plain `menuitem`s — upstream's own queries moved to
 * that role at 0.3.0.
 */
function menuItem(container: HTMLElement, name: string): HTMLElement {
	const el = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(
		(item) => item.textContent?.trim() === name
	);
	if (!el) throw new Error(`no menuitemradio named "${name}"`);
	return el;
}

function pressKey(el: HTMLElement, key: string): void {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

// --- Overflow helpers -------------------------------------------------------
// Upstream's jsdom fakes, kept as instance-level overrides: a real browser
// honours a shadowing own property and an own getBoundingClientRect just as
// jsdom does.

const TAB_STRIP = '.astryx-tab-strip';
const TAB_SCROLL_BUTTON = '.astryx-tab-scroll-button';

const overflowTabs = [
	{ props: { value: 'a', label: 'Alpha' } },
	{ props: { value: 'b', label: 'Beta' } },
	{ props: { value: 'c', label: 'Gamma' } }
];

function stripIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector(TAB_STRIP);
	if (!(el instanceof HTMLElement)) throw new Error('no tab strip');
	return el;
}

function fakeScrollBox(
	strip: HTMLElement,
	{
		scrollWidth,
		clientWidth,
		scrollLeft = 0
	}: { scrollWidth: number; clientWidth: number; scrollLeft?: number }
): void {
	Object.defineProperty(strip, 'scrollWidth', { value: scrollWidth, configurable: true });
	Object.defineProperty(strip, 'clientWidth', { value: clientWidth, configurable: true });
	Object.defineProperty(strip, 'scrollLeft', {
		value: scrollLeft,
		writable: true,
		configurable: true
	});
}

/** Places the strip at 0..width and a tab at the given offsets. */
function fakeGeometry(
	strip: HTMLElement,
	tabValue: string,
	{
		stripWidth,
		tabLeft,
		tabRight
	}: { stripWidth: number; tabLeft: number; tabRight: number }
): void {
	strip.getBoundingClientRect = () =>
		({ left: 0, right: stripWidth, width: stripWidth }) as DOMRect;
	const tab = strip.querySelector<HTMLElement>(`[data-tab-value="${tabValue}"]`);
	if (tab) {
		tab.getBoundingClientRect = () =>
			({ left: tabLeft, right: tabRight, width: tabRight - tabLeft }) as DOMRect;
	}
}

function fireScroll(el: HTMLElement): void {
	el.dispatchEvent(new Event('scroll'));
}

function stubScrollBy(strip: HTMLElement): ReturnType<typeof vi.fn> {
	const scrollBy = vi.fn();
	strip.scrollBy = scrollBy;
	return scrollBy;
}

/**
 * Zero the strip's scroll inset. Upstream's exact deltas are arithmetic over
 * `parseFloat(getComputedStyle(strip).scrollPaddingLeft)`, which jsdom cannot
 * parse out of `calc(...)` and so reads as 0. Chromium resolves it to the
 * tokens' 32px; zeroing it restores the numbers upstream asserts without
 * changing the claim being made.
 */
function zeroScrollInset(strip: HTMLElement): void {
	strip.style.scrollPaddingLeft = '0px';
	strip.style.scrollPaddingRight = '0px';
}

async function renderStrip(
	tabList: Record<string, unknown> = {}
): Promise<Awaited<ReturnType<typeof render>> & { strip: HTMLElement }> {
	const screen = await render(TabListFixture, {
		props: {
			tabList: { value: 'a', onChange: () => {}, ...tabList },
			tabs: overflowTabs
		}
	});
	return { ...screen, strip: stripIn(screen.container) };
}

/** Let a CSS transition (the strip's mask fade) finish. */
async function animationsSettled(el: HTMLElement): Promise<void> {
	await Promise.all(el.getAnimations({ subtree: false }).map((animation) => animation.finished));
}

// --- Pressed-state helpers --------------------------------------------------
// Ports of upstream's `__tests__/pressState`, scoped to the element's own
// compiled classes: this harness injects the whole package sheet on every page,
// so a document-wide substring search would pass on another component's rule.

/** Every rule (nested at-rules included) whose selector names one of `el`'s classes. */
function rulesOn(el: Element): string[] {
	const classes = Array.from(el.classList).map((name) => `.${name}`);
	// The harness puts the compiled sheet on the page twice (Vite's dev injection
	// plus `setup-stylex.ts`'s copy), so de-duplicate by rule text. Never loosen
	// the assertion instead: two copies of a rule still say one thing.
	const seen = new Set<string>();
	const out: string[] = [];
	function visit(rules: CSSRuleList): void {
		for (const rule of Array.from(rules)) {
			const { selectorText } = rule as CSSStyleRule;
			const nested = (rule as CSSGroupingRule).cssRules;
			if (typeof selectorText === 'string') {
				if (classes.some((cls) => selectorText.startsWith(cls)) && !seen.has(rule.cssText)) {
					seen.add(rule.cssText);
					out.push(rule.cssText);
				}
				continue;
			}
			if (nested != null) visit(nested);
		}
	}
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			visit(sheet.cssRules);
		} catch {
			// Cross-origin sheet — not ours.
		}
	}
	return out;
}

function selectorOf(rule: string): string {
	return rule.slice(0, rule.indexOf('{'));
}

/** Does one of the element's own rules paint the pressed overlay on `pseudo`? */
function hasPressedArm(el: Element, pseudo = ':active'): boolean {
	return rulesOn(el).some(
		(rule) => selectorOf(rule).includes(pseudo) && rule.includes('--color-overlay-pressed')
	);
}

/** Does the element paint the touch press at its strength on `arm`? */
function readsPressStrength(el: Element, arm = '[data-astryx-press="fading"]'): boolean {
	return rulesOn(el).some(
		(rule) =>
			selectorOf(rule).includes(arm) &&
			(rule.includes('var(--_press-paint') ||
				(rule.includes('--color-overlay-pressed') && rule.includes('--astryx-press-alpha')))
	);
}

/** `a, f(b, c)` → `['a', 'f(b, c)']`: the commas outside parentheses split. */
function topLevelArguments(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < list.length; index++) {
		const char = list[index];
		if (char === '(') depth++;
		else if (char === ')') depth--;
		else if (char === ',' && depth === 0) {
			parts.push(list.slice(start, index));
			start = index + 1;
		}
	}
	parts.push(list.slice(start));
	return parts;
}

/** A token or literal CSS duration in ms. */
function durationToMs(value: string): number {
	const css = value.trim();
	const smaller = /^min\((.*)\)$/u.exec(css);
	if (smaller != null) {
		return Math.min(...topLevelArguments(smaller[1]).map(durationToMs));
	}
	const token = /^var\((--[\w-]+)\)$/u.exec(css);
	if (token != null) {
		const fallback = (durationDefaults as Record<string, string>)[token[1]];
		return fallback == null ? Number.NaN : durationToMs(fallback);
	}
	const match = /^([\d.]+)(ms|s)$/u.exec(css);
	return match == null ? Number.NaN : Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

/** Does the element run the release on the fading arm for exactly the press clock? */
function hasReleaseFade(el: Element): boolean {
	const fading = rulesOn(el).filter(
		(rule) =>
			selectorOf(rule).includes('[data-astryx-press="fading"]') && !selectorOf(rule).includes('::')
	);
	const durations = fading.flatMap((rule) => {
		const match = rule.match(/animation-duration:\s*([^;}]+)/);
		return match == null ? [] : [durationToMs(match[1])];
	});
	const named = fading.some((rule) => /animation-name:\s*(?!none)/.test(rule));
	const onArmAnimates = rulesOn(el).some(
		(rule) => selectorOf(rule).includes('[data-astryx-press="on"]') && rule.includes('animation')
	);
	return (
		named &&
		durations.length >= 1 &&
		durations.length <= 2 &&
		durations.every((duration) => duration === PRESS_FADE_MS) &&
		!onArmAnimates
	);
}


afterEach(() => {
	vi.restoreAllMocks();
});

describe('TabList', () => {
	it('renders a nav element with tab buttons', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		await expect.element(screen.getByRole('navigation')).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Settings', exact: true }))
			.toBeInTheDocument();
	});

	it('does not set aria-orientation on the nav (invalid for role navigation)', async () => {
		// Regression: aria-orientation is not an allowed attribute on the
		// navigation role and produces an axe aria-allowed-attr violation.
		// TabList deliberately never sets this attribute.
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		expect(navIn(screen.container)).not.toHaveAttribute('aria-orientation');
	});

	it('ignores a consumer-supplied aria-orientation on the nav', async () => {
		// A caller passing aria-orientation should not reintroduce the invalid
		// attribute onto the nav.
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {}, 'aria-orientation': 'vertical' },
				tabs: homeAndSettings
			}
		});

		expect(navIn(screen.container)).not.toHaveAttribute('aria-orientation');
	});

	it('marks selected tab with a generic aria-current, not "page"', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toHaveAttribute('aria-current', 'true');
		await expect
			.element(screen.getByRole('button', { name: 'Settings', exact: true }))
			.not.toHaveAttribute('aria-current');
	});

	it('marks a selected link tab with the same generic aria-current', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home', href: '/home' } },
					{ props: { value: 'settings', label: 'Settings', href: '/settings' } }
				]
			}
		});

		await expect
			.element(screen.getByRole('link', { name: 'Home', exact: true }))
			.toHaveAttribute('aria-current', 'true');
		await expect
			.element(screen.getByRole('link', { name: 'Settings', exact: true }))
			.not.toHaveAttribute('aria-current');
	});

	it('calls onChange when a tab is clicked', async () => {
		const handleChange = vi.fn();
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: handleChange }, tabs: homeAndSettings }
		});

		await userEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
		expect(handleChange).toHaveBeenCalledWith('settings');
	});

	it('updates aria-current when value changes', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toHaveAttribute('aria-current', 'true');

		await screen.rerender({
			tabList: { value: 'settings', onChange: () => {} },
			tabs: homeAndSettings
		});

		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.not.toHaveAttribute('aria-current');
		await expect
			.element(screen.getByRole('button', { name: 'Settings', exact: true }))
			.toHaveAttribute('aria-current', 'true');
	});

	it('renders with different sizes', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {}, size: 'sm' },
				tabs: [{ props: { value: 'home', label: 'Home' } }]
			}
		});
		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toBeInTheDocument();

		await screen.rerender({
			tabList: { value: 'home', onChange: () => {}, size: 'lg' },
			tabs: [{ props: { value: 'home', label: 'Home' } }]
		});
		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toBeInTheDocument();
	});

	it('renders tab with icon', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home' }, icon: { testid: 'icon', glyph: '🏠' } }]
			}
		});

		await expect.element(screen.getByTestId('icon')).toBeInTheDocument();
	});

	it('renders icon-only tab with aria-label from label prop', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'preview', onChange: () => {} },
				tabs: [
					{
						props: { value: 'preview', label: 'Preview', isLabelHidden: true },
						icon: { testid: 'icon', glyph: '▣' }
					}
				]
			}
		});

		const tab = screen.getByRole('button', { name: 'Preview', exact: true });
		await expect.element(tab).toHaveAttribute('aria-label', 'Preview');
		await expect.element(screen.getByTestId('icon')).toBeInTheDocument();
		// The visible label is omitted entirely, so "Preview" appears only as the
		// accessible name.
		expect(screen.container.textContent).not.toContain('Preview');
	});

	it('omits empty label nodes so aria-labeled icon tabs align to the icon', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'preview', onChange: () => {} },
				tabs: [
					{
						props: { value: 'preview', label: '', 'aria-label': 'Preview' },
						icon: { testid: 'icon', glyph: '▣' }
					}
				]
			}
		});

		const tab = screen.getByRole('button', { name: 'Preview', exact: true });
		await expect.element(tab).toBeInTheDocument();
		await expect.element(screen.getByTestId('icon')).toBeInTheDocument();
		expect((tab.element() as HTMLElement).querySelectorAll(':scope > span').length).toBe(3);
	});

	it('renders selectedIcon when tab is selected', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{
						props: { value: 'home', label: 'Home' },
						icon: { testid: 'icon', glyph: '○' },
						selectedIcon: { testid: 'selected-icon', glyph: '●' }
					}
				]
			}
		});

		await expect.element(screen.getByTestId('selected-icon')).toBeInTheDocument();
		expect(screen.container.querySelector('[data-testid="icon"]')).not.toBeInTheDocument();
	});

	it('renders regular icon when tab is not selected', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'other', onChange: () => {} },
				tabs: [
					{
						props: { value: 'home', label: 'Home' },
						icon: { testid: 'icon', glyph: '○' },
						selectedIcon: { testid: 'selected-icon', glyph: '●' }
					}
				]
			}
		});

		await expect.element(screen.getByTestId('icon')).toBeInTheDocument();
		expect(screen.container.querySelector('[data-testid="selected-icon"]')).not.toBeInTheDocument();
	});

	it('renders endContent after the label', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home' }, end: { testid: 'badge', text: '5' } }]
			}
		});

		await expect.element(screen.getByTestId('badge')).toBeInTheDocument();
		expect(screen.getByTestId('badge').element().textContent).toBe('5');
	});

	it('does not render endContent wrapper when endContent is not provided', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home' } }]
			}
		});

		// Button children: hoverBg, labelContainer, indicator (no endContent wrapper)
		const button = screen
			.getByRole('button', { name: 'Home', exact: true })
			.element() as HTMLElement;
		expect(button.querySelectorAll(':scope > span').length).toBe(3);
	});

	it('renders endContent in link tabs', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{
						props: { value: 'home', label: 'Home', href: '/home' },
						end: { testid: 'dot', text: '●' }
					}
				]
			}
		});

		await expect.element(screen.getByTestId('dot')).toBeInTheDocument();
	});
});

describe('TabList divider gap', () => {
	// The divider adds the reserved gap + indicator offset via a single class
	// (StyleX applies deterministic classes in the test env). Capture that
	// class set once so the assertions describe intent, not opaque hashes.
	//
	// Upstream renders/unmounts once per variant; here the two variants are two
	// renders of the same tree via `rerender`, which is the same measurement
	// without needing an imperative unmount.
	const oneTab = [{ props: { value: 'home', label: 'Home' } }];

	it('adds divider-only styling classes when hasDivider is set', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {}, hasDivider: false }, tabs: oneTab }
		});
		const withoutDivider = navClassSet(screen.container);

		await screen.rerender({
			tabList: { value: 'home', onChange: () => {}, hasDivider: true },
			tabs: oneTab
		});
		const withDivider = navClassSet(screen.container);

		// Every class the plain nav has must still be present when divided: the
		// divider only adds styling (border + reserved gap + indicator offset),
		// it never removes the base nav styles.
		for (const cls of withoutDivider) {
			expect(withDivider.has(cls)).toBe(true);
		}

		// And it must add at least one class the undivided nav does not have.
		const added = [...withDivider].filter((c) => !withoutDivider.has(c));
		expect(added.length).toBeGreaterThan(0);
	});

	it('does not add divider styling to an undivided tab list (default)', async () => {
		// Default (no hasDivider) and explicit hasDivider={false} are identical:
		// the non-divided path is untouched by the divider gap change.
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {}, hasDivider: false }, tabs: oneTab }
		});
		const explicitlyFalse = navClassSet(screen.container);

		await screen.rerender({ tabList: { value: 'home', onChange: () => {} }, tabs: oneTab });
		expect(navClassSet(screen.container)).toEqual(explicitlyFalse);
	});

	it('keeps the selected indicator rendered under a divider', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {}, hasDivider: true },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{ props: { value: 'away', label: 'Away' } }
				]
			}
		});
		const selected = screen
			.getByRole('button', { name: 'Home', exact: true })
			.element() as HTMLElement;
		// The indicator span carries the selected marker; the divider must not
		// drop it (it is repositioned onto the rail, not removed).
		expect(selected.querySelector('[data-selected="selected"]')).toBeInTheDocument();
	});
});

describe('TabList keyboard navigation (roving tabindex)', () => {
	const three = [
		{ props: { value: 'home', label: 'Home' } },
		{ props: { value: 'settings', label: 'Settings' } },
		{ props: { value: 'profile', label: 'Profile' } }
	];

	it('exposes the tab strip as a single Tab stop (only selected tab is tabbable)', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'settings', onChange: () => {} }, tabs: three }
		});

		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toHaveAttribute('tabindex', '-1');
		await expect
			.element(screen.getByRole('button', { name: 'Settings', exact: true }))
			.toHaveAttribute('tabindex', '0');
		await expect
			.element(screen.getByRole('button', { name: 'Profile', exact: true }))
			.toHaveAttribute('tabindex', '-1');
	});

	it('makes the first tab tabbable when the selected value matches no tab', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: '__none__', onChange: () => {} }, tabs: homeAndSettings }
		});

		await expect
			.element(screen.getByRole('button', { name: 'Home', exact: true }))
			.toHaveAttribute('tabindex', '0');
		await expect
			.element(screen.getByRole('button', { name: 'Settings', exact: true }))
			.toHaveAttribute('tabindex', '-1');
	});

	it('moves focus with ArrowRight and ArrowLeft', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: three }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const settings = screen
			.getByRole('button', { name: 'Settings', exact: true })
			.element() as HTMLElement;
		const profile = screen
			.getByRole('button', { name: 'Profile', exact: true })
			.element() as HTMLElement;

		home.focus();
		expect(document.activeElement).toBe(home);

		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(settings);

		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(profile);

		await userEvent.keyboard('{ArrowLeft}');
		expect(document.activeElement).toBe(settings);
	});

	it('supports ArrowDown and ArrowUp as forward/backward as well', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const settings = screen
			.getByRole('button', { name: 'Settings', exact: true })
			.element() as HTMLElement;

		home.focus();
		await userEvent.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(settings);

		await userEvent.keyboard('{ArrowUp}');
		expect(document.activeElement).toBe(home);
	});

	it('jumps to first and last tab with Home and End', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'settings', onChange: () => {} }, tabs: three }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const settings = screen
			.getByRole('button', { name: 'Settings', exact: true })
			.element() as HTMLElement;
		const profile = screen
			.getByRole('button', { name: 'Profile', exact: true })
			.element() as HTMLElement;

		settings.focus();

		await userEvent.keyboard('{End}');
		expect(document.activeElement).toBe(profile);

		await userEvent.keyboard('{Home}');
		expect(document.activeElement).toBe(home);
	});

	it('wraps around at the ends', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: three }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const profile = screen
			.getByRole('button', { name: 'Profile', exact: true })
			.element() as HTMLElement;

		home.focus();
		await userEvent.keyboard('{ArrowLeft}');
		expect(document.activeElement).toBe(profile);

		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(home);
	});

	it('skips disabled tabs during arrow navigation', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{ props: { value: 'settings', label: 'Settings', 'aria-disabled': 'true' } },
					{ props: { value: 'profile', label: 'Profile' } }
				]
			}
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const profile = screen
			.getByRole('button', { name: 'Profile', exact: true })
			.element() as HTMLElement;

		home.focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(profile);
	});

	it('does not intercept unrelated keys', async () => {
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {} }, tabs: homeAndSettings }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		home.focus();
		await userEvent.keyboard('a');
		expect(document.activeElement).toBe(home);
	});

	it('composes consumer onKeyDown with internal arrow navigation', async () => {
		const onkeydown = vi.fn();
		const screen = await render(TabListFixture, {
			props: { tabList: { value: 'home', onChange: () => {}, onkeydown }, tabs: homeAndSettings }
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		const settings = screen
			.getByRole('button', { name: 'Settings', exact: true })
			.element() as HTMLElement;

		home.focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(onkeydown).toHaveBeenCalled();
		expect(document.activeElement).toBe(settings);
	});

	it('respects preventDefault from consumer onKeyDown', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: {
					value: 'home',
					onChange: () => {},
					onkeydown: (e: KeyboardEvent) => e.preventDefault()
				},
				tabs: homeAndSettings
			}
		});

		const home = screen.getByRole('button', { name: 'Home', exact: true }).element() as HTMLElement;
		home.focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(document.activeElement).toBe(home);
	});
});

describe('Tab polymorphic link', () => {
	it('renders custom component when href and as are provided', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home', href: '/home', as: CustomLink } }]
			}
		});
		const link = screen.getByRole('link', { name: 'Home', exact: true });
		await expect.element(link).toHaveAttribute('data-custom-link');
		await expect.element(link).toHaveAttribute('href', '/home');
	});

	it('still renders button without href even with as prop', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home', as: CustomLink } }]
			}
		});
		const button = screen.getByRole('button', { name: 'Home', exact: true });
		await expect.element(button).toBeInTheDocument();
		await expect.element(button).not.toHaveAttribute('data-custom-link');
	});

	it('renders custom component from LinkProvider when href is provided', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [{ props: { value: 'home', label: 'Home', href: '/home' } }],
				provider: CustomLink
			}
		});
		await expect
			.element(screen.getByRole('link', { name: 'Home', exact: true }))
			.toHaveAttribute('data-custom-link');
	});
});

describe('TabMenu', () => {
	const withMenu = {
		tabList: { value: 'home', onChange: () => {} },
		tabs: [{ props: { value: 'home', label: 'Home' } }],
		menu: { label: 'More', options: menuOptions }
	};

	it('renders a trigger button with aria-haspopup and aria-controls', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		const trigger = screen.getByRole('button', { name: 'More', exact: true });
		await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

		// aria-controls points to the menu element
		const menuId = (trigger.element() as HTMLElement).getAttribute('aria-controls');
		expect(menuId).toBeTruthy();
		const menu = document.getElementById(menuId!);
		expect(menu).toBeInTheDocument();
		expect(menu).toHaveAttribute('role', 'menu');
	});

	it('shows label prop as trigger text when no option is selected', async () => {
		const screen = await render(TabListFixture, { props: withMenu });
		await expect
			.element(screen.getByRole('button', { name: 'More', exact: true }))
			.toBeInTheDocument();
	});

	it('shows selected option label as trigger text when an option is active', async () => {
		const screen = await render(TabListFixture, {
			props: { ...withMenu, tabList: { value: 'analytics', onChange: () => {} } }
		});
		await expect
			.element(screen.getByRole('button', { name: 'Analytics', exact: true }))
			.toBeInTheDocument();
	});

	it('opens dropdown on click and shows menu items', async () => {
		const showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover');
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));

		expect(showPopover).toHaveBeenCalled();

		expect(menuItem(screen.container, 'Analytics')).toBeInTheDocument();
		expect(menuItem(screen.container, 'Reports')).toBeInTheDocument();
	});

	it('renders heading with menu label in dropdown', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		// The dropdown has role="menu" with aria-label
		const menu = menuIn(screen.container);
		expect(menu).toHaveAttribute('aria-label', 'More');

		// The heading is a presentation span with the menu label
		const heading = screen.container.querySelector('[role="presentation"]');
		expect(heading).toHaveTextContent('More');
	});

	it('selects a menu item and calls onChange', async () => {
		const handleChange = vi.fn();
		const screen = await render(TabListFixture, {
			props: { ...withMenu, tabList: { value: 'home', onChange: handleChange } }
		});

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		await userEvent.click(menuItem(screen.container, 'Analytics'));
		expect(handleChange).toHaveBeenCalledWith('analytics');
	});

	it('exposes options as menuitemradio and marks the selected tab aria-checked', async () => {
		const screen = await render(TabListFixture, {
			props: { ...withMenu, tabList: { value: 'analytics', onChange: () => {} } }
		});

		// Single-select menu options carry radio semantics (APG menu-button):
		// role="menuitemradio" + aria-checked, not menuitem + aria-current.
		const analyticsItem = menuItem(screen.container, 'Analytics');
		expect(analyticsItem).toHaveAttribute('aria-checked', 'true');
		expect(analyticsItem).not.toHaveAttribute('aria-current');

		expect(menuItem(screen.container, 'Reports')).toHaveAttribute('aria-checked', 'false');
	});

	// NOT PORTED, named rather than dropped: `picks the option a press slid
	// across the menu lifts on, once (family:action-groups FR1, FR2, FR5)`.
	// It asserts the `useMenuPress` slide-to-select press model, which this port
	// has no counterpart for (the hook's own suite is unported too); `TabMenu`
	// here selects on click only, so there is no behaviour to drive.
});

describe('TabMenu host attributes', () => {
	const hostMenu = {
		tabList: { value: 'home', onChange: () => {} },
		tabs: [{ props: { value: 'home', label: 'Home' } }]
	};

	it('forwards host attributes to the trigger, not the popup', async () => {
		const screen = await render(TabListFixture, {
			props: {
				...hostMenu,
				menu: {
					label: 'More',
					options: menuOptions,
					props: { id: 'more-tabs', 'aria-label': 'More views', 'data-view': 'overflow' }
				}
			}
		});

		const trigger = screen.getByRole('button', { name: 'More views', exact: true });
		await expect.element(trigger).toHaveAttribute('id', 'more-tabs');
		await expect.element(trigger).toHaveAttribute('data-view', 'overflow');
		const menu = menuIn(screen.container);
		expect((trigger.element() as HTMLElement).getAttribute('aria-controls')).toBe(menu.id);
	});

	it('runs drag-and-drop handlers on the trigger', async () => {
		const onDragOver = vi.fn();
		const onDrop = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				...hostMenu,
				menu: {
					label: 'More',
					options: menuOptions,
					props: { ondragover: onDragOver, ondrop: onDrop }
				}
			}
		});

		const trigger = screen.getByRole('button', { name: 'More', exact: true }).element() as HTMLElement;
		trigger.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
		trigger.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
		expect(onDragOver).toHaveBeenCalledTimes(1);
		expect(onDrop).toHaveBeenCalledTimes(1);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('onClick preserves the toggle', async () => {
		const onClick = vi.fn((event: MouseEvent) => {
			event.preventDefault();
		});
		const screen = await render(TabListFixture, {
			props: {
				...hostMenu,
				menu: { label: 'More', options: menuOptions, props: { onclick: onClick } }
			}
		});

		const trigger = screen.getByRole('button', { name: 'More', exact: true });
		await userEvent.click(trigger);
		expect(onClick).toHaveBeenCalledTimes(1);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});
});

describe('TabMenu keyboard navigation (roving tabindex)', () => {
	const withMenu = {
		tabList: { value: 'home', onChange: () => {} },
		tabs: [{ props: { value: 'home', label: 'Home' } }],
		menu: { label: 'More', options: menuOptions }
	};

	it('exposes the overflow menu as a single Tab stop (one item tabbable, rest -1)', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));

		const analytics = menuItem(screen.container, 'Analytics');
		const reports = menuItem(screen.container, 'Reports');

		// Exactly one menu item is in the Tab sequence; arrow keys reach the rest.
		expect(analytics).toHaveAttribute('tabindex', '0');
		expect(reports).toHaveAttribute('tabindex', '-1');

		const tabbable = [analytics, reports].filter((el) => el.getAttribute('tabindex') === '0');
		expect(tabbable).toHaveLength(1);
	});

	it('moves focus between items with ArrowDown and ArrowUp', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const menu = menuIn(screen.container);
		const analytics = menuItem(screen.container, 'Analytics');
		const reports = menuItem(screen.container, 'Reports');

		// Restated (see file header): the APG focus-on-open has settled, so the menu
		// opens with the first item focused rather than with focus unset.
		expect(document.activeElement).toBe(analytics);

		pressKey(menu, 'ArrowDown');
		expect(document.activeElement).toBe(reports);

		pressKey(menu, 'ArrowUp');
		expect(document.activeElement).toBe(analytics);
	});

	it('still navigates when the tablist is inside a popover', async () => {
		// Restated (see file header): a closed popover is `display: none` in a
		// real browser, so it has to be opened before its tabs can take focus —
		// jsdom never hides it, which is why upstream focuses the hidden tabs.
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {}, role: 'tablist' },
				tabs: [
					{ props: { value: 'home', label: 'Home', panelId: 'home-panel' } },
					{ props: { value: 'settings', label: 'Settings', panelId: 'settings-panel' } }
				],
				wrapInPopover: true
			}
		});

		const popover = screen.container.querySelector<HTMLElement>('[popover]');
		if (!popover) throw new Error('no popover wrapper');
		popover.showPopover();
		const tabs = Array.from(screen.container.querySelectorAll<HTMLElement>('[role="tab"]'));
		tabs[0].focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement).toBe(tabs[1]);
	});

	it('leaves horizontal arrows to the open menu', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		const trigger = screen.getByRole('button', { name: 'More', exact: true });
		await userEvent.click(trigger);
		const item = menuItem(screen.container, 'Reports');
		item.focus();

		pressKey(item, 'ArrowRight');
		expect(document.activeElement).toBe(item);

		pressKey(item, 'ArrowLeft');
		expect(document.activeElement).toBe(item);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('moves the roving tab stop with arrow navigation', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const menu = menuIn(screen.container);
		const analytics = menuItem(screen.container, 'Analytics');
		const reports = menuItem(screen.container, 'Reports');

		// Restated (see file header): one ArrowDown reaches "Reports" here, because
		// focus-on-open has already landed on "Analytics".
		pressKey(menu, 'ArrowDown');

		// The tab stop follows focus, so it is still a single stop after moving.
		expect(reports).toHaveAttribute('tabindex', '0');
		expect(analytics).toHaveAttribute('tabindex', '-1');
	});

	it('jumps to first and last item with Home and End', async () => {
		const options = [
			{ value: 'analytics', label: 'Analytics' },
			{ value: 'reports', label: 'Reports' },
			{ value: 'exports', label: 'Exports' }
		];
		const screen = await render(TabListFixture, {
			props: { ...withMenu, menu: { label: 'More', options } }
		});

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const menu = menuIn(screen.container);
		const analytics = menuItem(screen.container, 'Analytics');
		const exportsItem = menuItem(screen.container, 'Exports');

		pressKey(menu, 'End');
		expect(document.activeElement).toBe(exportsItem);

		pressKey(menu, 'Home');
		expect(document.activeElement).toBe(analytics);
	});

	it('selects an item with Enter and calls onChange', async () => {
		const handleChange = vi.fn();
		const screen = await render(TabListFixture, {
			props: { ...withMenu, tabList: { value: 'home', onChange: handleChange } }
		});

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const analytics = menuItem(screen.container, 'Analytics');
		analytics.focus();
		pressKey(analytics, 'Enter');

		expect(handleChange).toHaveBeenCalledWith('analytics');
	});

	it('closes the menu when Tab is pressed inside it (APG menu-button)', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const menu = menuIn(screen.container);

		const hidePopover = vi.spyOn(HTMLElement.prototype, 'hidePopover');
		pressKey(menu, 'Tab');
		expect(hidePopover).toHaveBeenCalled();
	});

	it('closes the menu when Escape is pressed', async () => {
		const screen = await render(TabListFixture, { props: withMenu });

		await userEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
		const menu = menuIn(screen.container);

		const hidePopover = vi.spyOn(HTMLElement.prototype, 'hidePopover');
		pressKey(menu, 'Escape');
		expect(hidePopover).toHaveBeenCalled();
	});
});

describe('TabList overflow (scroll)', () => {
	it('renders the tabs inside a scroll strip by default', async () => {
		const { strip } = await renderStrip();
		expect(strip.querySelectorAll('[data-tab-value]')).toHaveLength(3);
	});

	it('offers an end arrow while there are tabs past the end, and pressing it scrolls', async () => {
		const { container, strip } = await renderStrip();
		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300 });
		const scrollBy = stubScrollBy(strip);
		fireScroll(strip);
		await tick();

		const arrows = container.querySelectorAll<HTMLElement>(TAB_SCROLL_BUTTON);
		expect(arrows).toHaveLength(1);

		arrows[0].click();
		expect(scrollBy).toHaveBeenCalledWith({ left: 240 });
	});

	it('offers both arrows once the strip is scrolled away from the start', async () => {
		const { container, strip } = await renderStrip();
		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 150 });
		stubScrollBy(strip);
		fireScroll(strip);
		await tick();

		expect(container.querySelectorAll(TAB_SCROLL_BUTTON)).toHaveLength(2);
	});

	it('keeps the arrows out of the tab order and out of the accessibility tree', async () => {
		const { container, strip } = await renderStrip();
		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300 });
		stubScrollBy(strip);
		fireScroll(strip);
		await tick();

		const arrow = container.querySelector<HTMLElement>(TAB_SCROLL_BUTTON);
		expect(arrow?.getAttribute('aria-hidden')).toBe('true');
		expect(arrow?.tabIndex).toBe(-1);
	});

	it('scrolls a selected tab that starts out of view back into view on mount', async () => {
		const scrollBy = vi.fn();
		// The strip mounts before the effect runs, so the geometry has to be in
		// place on the prototype rather than on an element we can reach first.
		const originalScrollBy = Element.prototype.scrollBy;
		const originalRect = Element.prototype.getBoundingClientRect;
		Element.prototype.scrollBy = scrollBy as typeof Element.prototype.scrollBy;
		Element.prototype.getBoundingClientRect = function (this: Element) {
			return (
				this.classList.contains('astryx-tab-strip')
					? { left: 0, right: 300, width: 300 }
					: { left: 420, right: 500, width: 80 }
			) as DOMRect;
		};

		try {
			await render(TabListFixture, {
				props: {
					tabList: { value: 'c', onChange: () => {} },
					tabs: overflowTabs
				}
			});

			expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
			expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
		} finally {
			Element.prototype.scrollBy = originalScrollBy;
			Element.prototype.getBoundingClientRect = originalRect;
		}
	});

	it('keeps the selected tab in view when the host changes value without focus', async () => {
		const { strip, rerender } = await renderStrip({ value: 'a' });
		const scrollBy = stubScrollBy(strip);
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: 420, tabRight: 500 });

		await rerender({
			tabList: { value: 'c', onChange: () => {} },
			tabs: overflowTabs
		});

		expect(scrollBy).toHaveBeenCalledTimes(1);
		expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
	});

	it('leaves a tab that is already in view alone', async () => {
		const { strip, rerender } = await renderStrip({ value: 'a' });
		const scrollBy = stubScrollBy(strip);
		fakeGeometry(strip, 'b', { stripWidth: 300, tabLeft: 80, tabRight: 140 });

		await rerender({
			tabList: { value: 'b', onChange: () => {} },
			tabs: overflowTabs
		});

		expect(scrollBy).not.toHaveBeenCalled();
	});

	it('measures a pressed tab after the press, in the next frame, and still shows it whole', async () => {
		const screen = await render(ControlledTabList, {
			props: {
				initialValue: 'a',
				tabs: [
					{ value: 'a', label: 'Alpha' },
					{ value: 'b', label: 'Beta' },
					{ value: 'c', label: 'Gamma' }
				]
			}
		});
		const strip = stripIn(screen.container);
		const tab = strip.querySelector<HTMLElement>('[data-tab-value="c"]');
		if (!tab) throw new Error('no tab strip');
		zeroScrollInset(strip);
		const scrollBy = stubScrollBy(strip);
		const stripRect = vi.fn(() => ({ left: 0, right: 300, width: 300 }) as DOMRect);
		strip.getBoundingClientRect = stripRect;
		tab.getBoundingClientRect = () => ({ left: 240, right: 320, width: 80 }) as DOMRect;

		// Pressing a tab focuses it first, and focusing it reveals it.
		tab.focus();
		await tick();
		expect(scrollBy).toHaveBeenCalledTimes(1);
		expect(scrollBy.mock.calls[0][0].left).toBe(20);
		const readsBeforePress = stripRect.mock.calls.length;

		// The selection itself reads no geometry inside the press...
		tab.click();
		await tick();
		expect(tab).toHaveAttribute('aria-current', 'true');
		expect(stripRect.mock.calls.length).toBe(readsBeforePress);
		expect(scrollBy).toHaveBeenCalledTimes(1);

		// ...and the next frame measures the selected tab, now wider, so it still
		// ends fully inside the strip.
		tab.getBoundingClientRect = () => ({ left: 220, right: 306, width: 86 }) as DOMRect;
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		await tick();
		expect(scrollBy).toHaveBeenCalledTimes(2);
		expect(scrollBy.mock.calls[1][0].left).toBe(6);
	});

	it('reveals on a selection change, not on an unrelated overflow change', async () => {
		const { strip, rerender } = await renderStrip({ value: 'c', overflow: 'visible' });
		const scrollBy = stubScrollBy(strip);
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: 420, tabRight: 500 });

		// Turning scrolling on re-measures the strip, and that one reveal is the
		// resize path's. The selection has not moved, so nothing may add a second.
		await rerender({
			tabList: { value: 'c', onChange: () => {}, overflow: 'scroll' },
			tabs: overflowTabs
		});
		await tick();
		expect(scrollBy).toHaveBeenCalledTimes(1);

		fakeGeometry(strip, 'a', { stripWidth: 300, tabLeft: -200, tabRight: -120 });
		await rerender({
			tabList: { value: 'a', onChange: () => {}, overflow: 'scroll' },
			tabs: overflowTabs
		});

		expect(scrollBy).toHaveBeenCalledTimes(2);
		expect(scrollBy.mock.calls[1][0].left).toBeLessThan(0);
	});

	it('finishes the job on focus: a tab only half in view is scrolled clear', async () => {
		const { strip } = await renderStrip({ value: 'a' });
		zeroScrollInset(strip);
		const scrollBy = stubScrollBy(strip);
		// The browser scrolls a focused tab into view only when it is entirely
		// outside the box, so this one — straddling the end edge — stays cut off.
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: 260, tabRight: 340 });

		const tab = strip.querySelector<HTMLElement>('[data-tab-value="c"]');
		if (!tab) throw new Error('no tab');
		tab.focus();
		await tick();

		expect(scrollBy).toHaveBeenCalledTimes(1);
		expect(scrollBy.mock.calls[0][0].left).toBeCloseTo(40);
	});

	it('reveals a half-visible overflow menu trigger too, not just tabs', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'a', onChange: () => {} },
				tabs: [
					{ props: { value: 'a', label: 'Alpha' } },
					{ props: { value: 'b', label: 'Beta' } }
				],
				menu: { label: 'More', options: [{ value: 'c', label: 'Gamma' }] }
			}
		});
		const strip = stripIn(screen.container);
		zeroScrollInset(strip);
		const scrollBy = stubScrollBy(strip);
		strip.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300 }) as DOMRect;
		const trigger = strip.querySelector<HTMLElement>('[data-tab-menu]');
		if (!trigger) throw new Error('no menu trigger');
		trigger.getBoundingClientRect = () => ({ left: 260, right: 340, width: 80 }) as DOMRect;

		trigger.focus();
		await tick();

		expect(scrollBy).toHaveBeenCalledTimes(1);
		expect(scrollBy.mock.calls[0][0].left).toBeCloseTo(40);
	});

	it('fades out at the strip’s own edge, not at the bleed edge', async () => {
		// The scroll box is a ring-bleed wider than the TabList on each side while
		// it holds focus, so a fade that ran to the box edge would paint tabs
		// outside the component and past the arrow that caps that edge.
		//
		// Restated against the applied declaration: jsdom returns the raw
		// `mask-image` text, while Chromium resolves the `var()`s and serializes
		// the colors. The class set still says which fade is applied, so scan the
		// rules for the strip's own classes — the same subject, a resolved form.
		const bleed = 'var(--_tab-strip-bleed)';
		const { strip } = await renderStrip();
		stubScrollBy(strip);

		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300 });
		fireScroll(strip);
		await tick();
		expect(cssIn(strip)).toContain(`transparent ${bleed}`);
		expect(cssIn(strip)).not.toContain(`transparent calc(100% - ${bleed})`);

		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 150 });
		fireScroll(strip);
		await tick();
		expect(cssIn(strip)).toContain(`transparent calc(100% - ${bleed})`);
	});

	it('is no wider than the TabList until the strip holds focus', async () => {
		// The bleed is real geometry: while the strip carries it, its border box
		// sticks out of the TabList's and every ancestor that scrolls counts it.
		// jsdom has no layout, so the box is read off the declarations: padding
		// and its cancelling margin are both the bleed, and the bleed is zero
		// until a ring needs keeping whole. `:has(:focus-visible)` flips it --
		// covered in a browser, since jsdom does not recompute style on a focus
		// change.
		const { strip } = await renderStrip();
		const cs = getComputedStyle(strip);

		expect(cs.getPropertyValue('--_tab-strip-bleed')).toBe('0px');
		const css = cssIn(strip);
		expect(css).toMatch(/padding-inline:\s*var\(--_tab-strip-bleed\)/);
		expect(css).toMatch(/margin-inline:\s*calc\(-1 \* \(var\(--_tab-strip-bleed\)\)\)/);
		// A zero bleed adds nothing to either box.
		expect(cs.paddingLeft).toBe('0px');
		expect(cs.paddingRight).toBe('0px');
		expect(cs.marginLeft).toBe('0px');
		expect(cs.marginRight).toBe('0px');
	});

	it('does not hand focus to an arrow, which is hidden from assistive tech', async () => {
		const { container, strip } = await renderStrip();
		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300 });
		stubScrollBy(strip);
		fireScroll(strip);
		await tick();

		const arrow = container.querySelector<HTMLElement>(TAB_SCROLL_BUTTON);
		if (!arrow) throw new Error('no arrow');
		const notPrevented = arrow.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, cancelable: true })
		);
		expect(notPrevented).toBe(false);
	});

	it('overflow="visible" scrolls nothing and offers no arrows', async () => {
		const { container, strip, rerender } = await renderStrip({
			value: 'a',
			overflow: 'visible'
		});
		const scrollBy = stubScrollBy(strip);
		fakeScrollBox(strip, { scrollWidth: 600, clientWidth: 300 });
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: 420, tabRight: 500 });
		fireScroll(strip);
		await tick();

		await rerender({
			tabList: { value: 'c', onChange: () => {}, overflow: 'visible' },
			tabs: overflowTabs
		});
		await tick();

		expect(container.querySelectorAll(TAB_SCROLL_BUTTON)).toHaveLength(0);
		expect(scrollBy).not.toHaveBeenCalled();
	});

	it('shows the reading start of a stop too wide to fit', async () => {
		const { strip } = await renderStrip({ value: 'a' });
		zeroScrollInset(strip);
		const scrollBy = stubScrollBy(strip);
		// Wider than the strip, so one end stays hidden either way. Aligning the
		// end would land a long label on its last words.
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: 420, tabRight: 800 });

		const tab = strip.querySelector<HTMLElement>('[data-tab-value="c"]');
		if (!tab) throw new Error('no tab');
		tab.focus();
		await tick();

		expect(scrollBy.mock.calls[0][0].left).toBeCloseTo(420);
	});

	it('shows the reading start of an over-wide stop in RTL too', async () => {
		const { strip } = await renderStrip({ value: 'a' });
		strip.style.direction = 'rtl';
		zeroScrollInset(strip);
		const scrollBy = stubScrollBy(strip);
		fakeGeometry(strip, 'c', { stripWidth: 300, tabLeft: -500, tabRight: -120 });

		const tab = strip.querySelector<HTMLElement>('[data-tab-value="c"]');
		if (!tab) throw new Error('no tab');
		tab.focus();
		await tick();

		// RTL reads from the right edge, so that is the end to bring flush.
		expect(scrollBy.mock.calls[0][0].left).toBeCloseTo(-420);
	});
});

describe('TabList ARIA pattern — role="tablist"', () => {
	function warnSpy() {
		return vi.spyOn(console, 'warn').mockImplementation(() => {});
	}

	function renderTabList(
		tabList: { value: string } & Record<string, unknown>,
		tabs: Array<{ props: Record<string, unknown> }>,
		extra: Record<string, unknown> = {}
	) {
		return render(TabListFixture, {
			props: { tabList: { onChange: () => {}, ...tabList }, tabs, ...extra }
		});
	}

	it('does not mix navigation semantics into explicit Tabs', async () => {
		const screen = await renderTabList({ value: 'b', role: 'tablist', 'aria-label': 'Views' }, [
			{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } },
			{ props: { value: 'b', label: 'Beta', panelId: 'panel-b' } }
		]);

		expect(screen.container.querySelector('nav')).toBeNull();
		for (const tab of screen.getByRole('tab').elements()) {
			expect(tab).not.toHaveAttribute('aria-current');
		}
	});

	it('lets the consumer name the tablist from another element', async () => {
		const screen = await renderTabList(
			{ value: 'a', role: 'tablist', 'aria-labelledby': 'views-heading' },
			[{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } }],
			{ heading: 'Project views' }
		);

		await expect
			.element(screen.getByRole('tablist', { name: 'Project views', exact: true }))
			.toBeInTheDocument();
	});

	it('renders no navigation landmark around the tabs', async () => {
		const screen = await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } }
		]);

		expect(screen.container.querySelector('nav')).toBeNull();
		expect(screen.getByRole('navigation').elements()).toHaveLength(0);
	});

	it('omits aria-controls when a tab has no panel, and says so', async () => {
		const warn = warnSpy();
		const screen = await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha' } }
		]);

		expect(screen.getByRole('tab').element()).not.toHaveAttribute('aria-controls');
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('Tab: a tab in a role="tablist" TabList controls nothing')
			);
		});
		warn.mockRestore();
	});

	it('leaves a hand-wired aria-controls alone, and does not ask for a panelId it already has', async () => {
		const warn = warnSpy();
		const screen = await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha', 'aria-controls': 'panel-written-by-hand' } }
		]);

		expect(screen.getByRole('tab').element()).toHaveAttribute(
			'aria-controls',
			'panel-written-by-hand'
		);
		// Effects have flushed by the awaited render; give a late microtask a turn
		// and then assert silence rather than waiting for a warning that must not
		// come.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('ignores href: the tab is a button, and the caller is told', async () => {
		const warn = warnSpy();
		const screen = await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a', href: '/alpha' } }
		]);

		const tab = screen.getByRole('tab').element() as HTMLElement;
		expect(tab.tagName).toBe('BUTTON');
		expect(tab).not.toHaveAttribute('href');
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('Tab: href is ignored in a role="tablist"')
			);
		});
		warn.mockRestore();
	});

	it('warns about anything in the strip that is not a tab, however it got there', async () => {
		const warn = warnSpy();
		await renderTabList(
			{ value: 'a', role: 'tablist' },
			[{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } }],
			{
				menu: {
					label: 'More',
					options: [{ value: 'b', label: 'Beta' }],
					wrapper: true
				}
			}
		);

		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('TabList: role="tablist" owns only tabs')
			);
		});
		warn.mockRestore();
	});

	it('says nothing when the strip holds only tabs with panels', async () => {
		const warn = warnSpy();
		await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } },
			{ props: { value: 'b', label: 'Beta', panelId: 'panel-b' } }
		]);

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('leaves ArrowDown and ArrowUp to the page', async () => {
		// A tablist reports itself as horizontal, so the vertical arrows are the
		// page's to scroll with.
		const screen = await renderTabList({ value: 'a', role: 'tablist' }, [
			{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } },
			{ props: { value: 'b', label: 'Beta', panelId: 'panel-b' } }
		]);

		const alpha = screen.getByRole('tab', { name: 'Alpha', exact: true }).element() as HTMLElement;
		alpha.focus();
		await userEvent.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(alpha);
	});
});

describe('TabList ARIA pattern — no role', () => {
	it('is the navigation landmark it has always been', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'a', onChange: () => {}, 'aria-label': 'Views' },
				tabs: [
					{ props: { value: 'a', label: 'Alpha' } },
					{ props: { value: 'b', label: 'Beta' } }
				]
			}
		});

		await expect
			.element(screen.getByRole('navigation', { name: 'Views', exact: true }))
			.toBeInTheDocument();
		expect(screen.container.querySelector('[role="tablist"]')).toBeNull();
		await expect
			.element(screen.getByRole('button', { name: 'Alpha', exact: true }))
			.toHaveAttribute('aria-current', 'true');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('drops a panelId and says so: there is no panel relationship to state', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'a', onChange: () => {} },
				tabs: [{ props: { value: 'a', label: 'Alpha', panelId: 'panel-a' } }]
			}
		});

		expect(screen.getByRole('button', { name: 'Alpha', exact: true }).element()).not.toHaveAttribute(
			'aria-controls'
		);
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('Tab: panelId does nothing outside a role="tablist" TabList')
			);
		});
		warn.mockRestore();
	});
});

describe('TabList ARIA pattern — any other role', () => {
	it('passes the role through and leaves the tabs on the navigation pattern', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'a', onChange: () => {}, role: 'toolbar' },
				tabs: [{ props: { value: 'a', label: 'Alpha' } }]
			}
		});

		expect(screen.container.querySelector('nav')).toHaveAttribute('role', 'toolbar');
		expect(screen.container.querySelector('[role="tablist"]')).toBeNull();
		await expect
			.element(screen.getByRole('button', { name: 'Alpha', exact: true }))
			.toHaveAttribute('aria-current', 'true');
	});
});

describe('pressed state', () => {
	it('paints the pressed overlay on the tab surface while the tab is pressed', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{ props: { value: 'settings', label: 'Settings' } }
				]
			}
		});
		const tab = screen.getByRole('button', { name: 'Settings', exact: true }).element() as HTMLElement;
		// The hover surface is a child layer read off the tab; the press paints
		// the same layer, so the assertion is on that layer.
		const surface = tab.querySelector('span[aria-hidden="true"]');
		if (surface == null) {
			throw new Error('the tab has no hover surface to press');
		}
		expect(hasPressedArm(surface)).toBe(true);
	});

	it('does not activate a disabled button tab or call its handler', async () => {
		const onChange = vi.fn();
		const onClick = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{
						props: {
							value: 'settings',
							label: 'Settings',
							'aria-disabled': 'true',
							onclick: onClick
						}
					}
				]
			}
		});

		const tab = screen.getByRole('button', { name: 'Settings', exact: true }).element() as HTMLElement;
		// Restated (see file header): Playwright's actionability check treats
		// `aria-disabled="true"` as disabled and refuses to click, where jsdom's
		// `user.click` dispatches regardless. The DOM click is what upstream's
		// press reaches, and the component's own guard is the subject.
		tab.click();
		expect(onClick).not.toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('does not run a disabled tab’s caller handlers other than focus and blur', async () => {
		const onKeyDown = vi.fn();
		const onPointerDown = vi.fn();
		const onMouseDown = vi.fn();
		const onFocus = vi.fn();
		const onBlur = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{
						props: {
							value: 'settings',
							label: 'Settings',
							'aria-disabled': 'true',
							onkeydown: onKeyDown,
							onpointerdown: onPointerDown,
							onmousedown: onMouseDown,
							onfocus: onFocus,
							onblur: onBlur
						}
					}
				]
			}
		});

		const tab = screen.getByRole('button', { name: 'Settings', exact: true }).element() as HTMLElement;
		tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		pressKey(tab, 'x');
		expect(onPointerDown).not.toHaveBeenCalled();
		expect(onMouseDown).not.toHaveBeenCalled();
		expect(onKeyDown).not.toHaveBeenCalled();
		tab.focus();
		tab.blur();
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it('does not run a disabled link tab’s caller handlers', async () => {
		const onKeyDown = vi.fn();
		const onPointerDown = vi.fn();
		const onMouseDown = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{
						props: {
							value: 'settings',
							label: 'Settings',
							href: '/settings',
							'aria-disabled': 'true',
							onkeydown: onKeyDown,
							onpointerdown: onPointerDown,
							onmousedown: onMouseDown
						}
					}
				]
			}
		});

		const tab = screen.container.querySelector('a[aria-disabled="true"]');
		if (tab == null) {
			throw new Error('the disabled link tab did not render an anchor');
		}
		tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		pressKey(tab as HTMLElement, 'x');
		expect(onPointerDown).not.toHaveBeenCalled();
		expect(onMouseDown).not.toHaveBeenCalled();
		expect(onKeyDown).not.toHaveBeenCalled();
	});

	it('still runs an enabled tab’s caller handlers', async () => {
		const onKeyDown = vi.fn();
		const onPointerDown = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{
						props: {
							value: 'settings',
							label: 'Settings',
							onkeydown: onKeyDown,
							onpointerdown: onPointerDown
						}
					}
				]
			}
		});

		const tab = screen.getByRole('button', { name: 'Settings', exact: true }).element() as HTMLElement;
		tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		pressKey(tab, 'x');
		expect(onPointerDown).toHaveBeenCalledTimes(1);
		expect(onKeyDown).toHaveBeenCalledTimes(1);
	});

	it('removes navigation from a disabled link tab', async () => {
		const onChange = vi.fn();
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{
						props: {
							value: 'settings',
							label: 'Settings',
							href: '/settings',
							'aria-disabled': 'true'
						}
					}
				],
				provider: CustomLink
			}
		});

		const tab = screen.container.querySelector('a');
		if (tab == null) {
			throw new Error('the disabled link tab did not render an anchor');
		}
		expect(tab).not.toHaveAttribute('data-custom-link');
		expect(tab).not.toHaveAttribute('href');
		tab.click();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('fades the touch press out from the tab, with the surface reading its strength', async () => {
		const screen = await render(TabListFixture, {
			props: {
				tabList: { value: 'home', onChange: () => {} },
				tabs: [
					{ props: { value: 'home', label: 'Home' } },
					{ props: { value: 'settings', label: 'Settings' } }
				]
			}
		});
		const tab = screen.getByRole('button', { name: 'Settings', exact: true }).element() as HTMLElement;
		const surface = tab.querySelector('span[aria-hidden="true"]');
		if (surface == null) {
			throw new Error('the tab has no hover surface to press');
		}
		// The controller writes the tab; the tab owns the strength and its
		// release, and the surface paints the pressed token at that strength on
		// both touch arms.
		expect(hasReleaseFade(tab)).toBe(true);
		expect(readsPressStrength(surface, '[data-astryx-press="on"]')).toBe(true);
		expect(readsPressStrength(surface)).toBe(true);
	});
});
