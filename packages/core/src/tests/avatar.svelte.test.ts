/** PORTS: Avatar/Avatar.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import Avatar from '$lib/components/avatar/avatar.svelte';
import AvatarStatusFixture from './fixtures/avatar-status-fixture.svelte';
import AvatarGroupFixture from './fixtures/avatar-group-fixture.svelte';
import AvatarWrappedStatusFixture from './fixtures/avatar-wrapped-status-fixture.svelte';
import SlotProbe from './fixtures/slot-probe.svelte';
import { atomicClasses, probe } from './fixtures/avatar-initials-probe.stylex.js';

/**
 * Astryx's `Avatar/Avatar.test.tsx`, ported case for case at the **0.7.13**
 * pin. The file has no `displayName` case, no snapshot and no no-JSX
 * construction form, so `ref` is the only React-only surface and it gets a
 * counterpart.
 *
 * **Two cases sit under a different parent here than upstream, and neither is a
 * dropped case.** Upstream declares `puts the avatar box on the element that
 * carries the theme target` and `keeps the box on the root for an interactive
 * avatar too` directly under `describe('Avatar')`; they are in the
 * interactivity block here, because the second needs the interactive root the
 * block already sets up. Upstream's `a whitespace-only name carries no
 * identity` block is likewise nested under `Avatar` upstream and under
 * interactivity here. All six cases are present with upstream's titles and
 * assertions.
 *
 * ## The two that are not here
 *
 * Named so neither can be mistaken for accounted-for work. Both are in the
 * `status label through a consumer wrapper (P14)` block, and both assert a
 * React commit-count property that has no Svelte counterpart:
 *
 * - `costs no extra render and does not loop` wraps the avatar in React's
 *   `Profiler` and asserts a single commit. Svelte has no profiler, and this
 *   port's label arrives through a `$state` write, so it deliberately *does*
 *   flush a second time; an assertion that the name lands once would pin a
 *   mechanism this port does not use.
 * - `names a directly-passed dot on the first render, before any report` rests
 *   on upstream's render-time `status.props.label` introspection. A `Snippet`
 *   has no props to inspect, so the dot's report is the only path here and the
 *   name necessarily lands one flush after mount. The observable composition is
 *   already covered by `composes the status label into the accessible name for
 *   initials avatars`; restating it here would not test what the case exists
 *   for.
 *
 * What translated, each commented where it appears:
 *
 * - **The initials are generated content, not text.** Upstream's `initials`
 *   dynamic style writes a quoted CSS string into two private custom properties
 *   and draws it on `::before`, the second under `@supports (content: "a" / "")`
 *   so the initials carry empty alternative text where the engine understands
 *   it. Upstream's `quotedInitials`/`initialsIn`/`initialsElement` helpers are
 *   ported verbatim, so a case asks which string the avatar *draws* rather than
 *   what text it contains. The two sheet-scanning cases read the compiled sheet
 *   through a recursive walk — this package compiles inside `@layer` blocks and
 *   the rule sits under `@supports` — rather than upstream's single top-level
 *   pass, and one adds the computed pseudo-element assertion Chromium makes
 *   possible.
 *
 * - **`status={<AvatarStatusDot …/>}` goes through `avatar-status-fixture.svelte`,
 *   a consumer wrapper through `avatar-wrapped-status-fixture.svelte`, and
 *   `status={<span />}` through the shared `slot-probe`.** `status` is a
 *   `Snippet` here and a snippet can only be authored in a template.
 *
 * - **The status label reaches the avatar from below, not above.** Upstream reads
 *   `status.props.label` off the React node (`getStatusLabel`); a `Snippet` is an
 *   opaque render function with no props to inspect, so `AvatarStatusDot`
 *   registers its label upward through a context sink. The observable contract is
 *   unchanged and is what every case here asserts — the composed accessible name,
 *   never the mechanism. Registration happens in the dot's `$effect`, so the
 *   composed name appears one flush after mount; the cases that expect a
 *   composition use retrying assertions, and the cases that expect *no*
 *   composition `await tick()` first so they cannot pass merely by being early.
 *
 * - **The two StyleX probes live in `avatar-initials-probe.stylex.ts`.** StyleX
 *   may only be imported from a `.ts`/`.stylex.ts` module — the bundler plugin
 *   Babel-parses anything importing `@stylexjs/stylex` and would read a Svelte
 *   template as JSX — so the `stylex.create` calls move one file over, as
 *   upstream's `AvatarStatusDot` suite already does here.
 *
 * - **`AvatarGroup` children go through `avatar-group-fixture.svelte`**, for the
 *   same snippet reason.
 *
 * - **`forwards the consumer ref to the root` is a counterpart.** Svelte has no
 *   `ref`; a consumer reaches the root through an attachment travelling in the
 *   rest props, which `Avatar` spreads onto its root `<div>`. It checks more than
 *   upstream's does — it receives the element rather than only proving a ref
 *   landed — and it still asks upstream's question, since the root also carries
 *   the tooltip's own attachment. `keeps its merged ref attached across
 *   unrelated rerenders` is its second half: the attachment runs once, and a
 *   size change neither reattaches it nor replaces the element.
 *
 * - **`onClick` is `onclick`**, Svelte's spelling of the same prop.
 *
 * Upstream's `name tooltip` block shims `HTMLElement.prototype.showPopover` /
 * `hidePopover` because jsdom implements neither, and queries with
 * `{hidden: true}` because a jsdom popover is not visible to the accessibility
 * tree. The browser project needs no shim — Chromium has the real Popover API —
 * and `{hidden: true}` survives as `getByRole('tooltip', {includeHidden: true})`,
 * since a *closed* popover really is `display:none` here. Same arrangement as
 * `date-time-input.svelte.test.ts`.
 */

/**
 * Chromium really fetches `src`, which jsdom never does: `https://example.com/…`
 * fires a *trusted* `error` and would retire the image behind the test's back,
 * mid-assertion. Swallowing it in the window's capture phase — before it reaches
 * the element's own listener — restores the "no network" premise upstream's
 * suite is written against.
 *
 * Two conditions keep the guard from covering anything else. `isTrusted`
 * separates the browser's own error from the ones the two retry cases dispatch
 * (`dispatchEvent` produces `isTrusted === false`, and that is the only way to
 * tell them apart). The `HTMLImageElement` check keeps uncaught *script* errors
 * — which arrive on this same listener with `target === window` — visible to
 * vitest's unhandled-error reporting.
 */
function blockRealImageErrors(): () => void {
	const swallow = (event: Event) => {
		if (event.isTrusted && event.target instanceof HTMLImageElement) {
			event.stopImmediatePropagation();
		}
	};
	window.addEventListener('error', swallow, true);
	return () => window.removeEventListener('error', swallow, true);
}

/**
 * The initials an avatar draws: the plain CSS string in the fallback's private
 * inline custom property (the one not followed by empty alternative text).
 *
 * Upstream's helper, unchanged. The value is a CSS string literal because the
 * component emits `cssString(initials)` into the custom property that
 * `::before`'s `content` reads.
 */
function quotedInitials(fallback: Element | null): string {
	const style = fallback?.getAttribute('style') ?? '';
	const match = /--[\w-]+:\s*("(?:[^"\\]|\\.)*")\s*(?:;|$)/.exec(style);
	return match ? (JSON.parse(match[1]) as string) : '';
}

function initialsIn(el: Element): string {
	return quotedInitials(el.querySelector('.astryx-avatar-fallback'));
}

/** The element that draws the given initials. */
function initialsElement(initials: string): HTMLElement {
	const el = Array.from(document.querySelectorAll<HTMLElement>('.astryx-avatar-fallback')).find(
		(fallback) => quotedInitials(fallback) === initials
	);
	if (el == null) {
		throw new Error(`No avatar draws the initials ${initials}`);
	}
	return el;
}

interface PseudoContentRule {
	selector: string;
	content: string;
	/** The rule sits under an `@supports` arm. */
	supports: boolean;
}

/**
 * The `::before` content rules that select one of `el`'s classes.
 *
 * Upstream reads `document.styleSheets` one level deep. That is not enough
 * here: this package compiles `useCSSLayers`, so every rule sits inside a
 * `CSSLayerBlockRule`, and the alternative-text arm is inside an
 * `@supports`. Both are grouping rules, so the walk descends through anything
 * that carries `cssRules`. The same sheet is on the page twice (Vite injects
 * it for the module graph and `setup-stylex.ts` appends it), which does not
 * matter to these `some` assertions.
 */
function pseudoContentRulesFor(el: Element): PseudoContentRule[] {
	const classes = el.className
		.split(/\s+/)
		.filter(Boolean)
		.map((name) => `.${name}`);
	const found: PseudoContentRule[] = [];

	const walk = (rules: CSSRuleList, supports: boolean): void => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSStyleRule) {
				if (
					rule.selectorText.includes('::before') &&
					classes.some((cls) => rule.selectorText.includes(cls))
				) {
					found.push({
						selector: rule.selectorText,
						content: rule.style.getPropertyValue('content'),
						supports
					});
				}
			}
			if ('cssRules' in rule) {
				walk((rule as CSSGroupingRule).cssRules, supports || rule instanceof CSSSupportsRule);
			}
		}
	};

	for (const sheet of Array.from(document.styleSheets)) {
		try {
			walk(sheet.cssRules, false);
		} catch {
			// A cross-origin sheet is unreadable; none is on this page, so there
			// is nothing to include.
		}
	}
	return found;
}

let releaseErrorBlock: (() => void) | undefined;

beforeEach(() => {
	releaseErrorBlock = blockRealImageErrors();
});

afterEach(() => {
	releaseErrorBlock?.();
	releaseErrorBlock = undefined;
});

describe('Avatar', () => {
	it('exposes role="img" with the name as accessible name', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada Lovelace', 'data-testid': 'a' } });
		await expect
			.element(screen.getByRole('img', { name: 'Ada Lovelace', exact: true }))
			.toBeInTheDocument();
	});

	it('uses alt over name for the accessible name', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', alt: 'Ada Lovelace, profile photo' }
		});
		await expect
			.element(screen.getByRole('img', { name: 'Ada Lovelace, profile photo', exact: true }))
			.toBeInTheDocument();
	});

	it('is decorative (presentation + aria-hidden) when it has no name or alt (obs-9)', async () => {
		const screen = await render(Avatar, { props: { 'data-testid': 'a' } });
		const el = screen.getByTestId('a').element();
		// No meaningful name → not announced as a generic "Avatar".
		expect(el).toHaveAttribute('aria-hidden', 'true');
		expect(el).not.toHaveAttribute('aria-label');
		expect(screen.getByRole('img').query()).toBeNull();
	});

	it('does not double-announce: the inner img is decorative when the wrapper is named', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', src: 'https://example.com/ada.jpg' }
		});
		const wrapper = screen.getByRole('img', { name: 'Ada', exact: true }).element();
		const innerImg = wrapper.querySelector('img');
		expect(innerImg).not.toBeNull();
		// The inner <img> carries an empty alt so it isn't announced separately.
		expect(innerImg).toHaveAttribute('alt', '');
	});

	it('renders fallback initials at the proportional size via a StyleX class, not an inline property', async () => {
		await render(Avatar, {
			props: { name: 'Ada Lovelace', size: 'sm', 'data-testid': 'a' }
		});
		const initials = initialsElement('AL');
		// The default proportional size (sm = 24 × 0.4 = 9.6px) is fed to StyleX as
		// a dynamic value: StyleX applies `font-size` through a class and sets only
		// the computed value inline (as a custom property). Because the property
		// lands via a class, a theme's `.astryx-avatar-fallback.<size>` rule in the
		// theme layer overrides it per size tier — no internal var seam needed.
		const style = initials.getAttribute('style') ?? '';
		expect(style).toMatch(/9\.6\d*px/);
		// Regression guard: the seam must NOT reintroduce the removed internal var.
		expect(style).not.toContain('--_avatar-fallback-font-size');
	});

	it('marks the fallback surface with the stable theming class (initials and icon)', async () => {
		// The background is themed directly on `.astryx-avatar-fallback`, so both
		// the initials and the default-icon fallback must carry the class.
		const screen = await render(Avatar, { props: { name: 'Ada Lovelace' } });
		expect(initialsElement('AL').className).toContain('astryx-avatar-fallback');

		await screen.rerender({ name: undefined });
		const icon = screen.container.querySelector('.astryx-avatar-fallback');
		expect(icon).not.toBeNull();
		expect(icon?.querySelector('svg')).not.toBeNull();
	});

	it('paints initials in primary text on the neutral tint, a pair that holds 4.5:1 in dark mode', async () => {
		// Secondary text on the neutral tint falls below 4.5:1 in dark mode.
		await render(Avatar, { props: { name: 'Ada Lovelace' } });
		const initials = initialsElement('AL');
		for (const cls of [...atomicClasses(probe.tint), ...atomicClasses(probe.ink)]) {
			expect(initials.className).toContain(cls);
		}
	});

	it('paints grouped initials in primary text too', async () => {
		// A grouped face skips the lone-avatar colour rule, so the fallback's own
		// colour is the one it shows.
		await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }] }
		});
		const initials = initialsElement('AL');
		const classes = atomicClasses(probe.groupedInk);
		expect(classes.length).toBeGreaterThan(0);
		for (const cls of classes) {
			expect(initials.className).toContain(cls);
		}
	});

	// -- Generated initials: letters, digits and emoji, never split code points --

	it('does not split an emoji surrogate pair when generating initials', async () => {
		const screen = await render(Avatar, { props: { name: '😀 Ada', 'data-testid': 'avatar' } });
		expect(initialsIn(screen.getByTestId('avatar').element())).toBe('😀A');
	});

	it('preserves a complete character when generating initials', async () => {
		const screen = await render(Avatar, { props: { name: '🇬🇧 Ada', 'data-testid': 'avatar' } });
		expect(initialsIn(screen.getByTestId('avatar').element())).toBe('🇬🇧A');
	});

	it('keeps a ZWJ family emoji intact when generating initials', async () => {
		const screen = await render(Avatar, {
			props: { name: '👨‍👩‍👧‍👦 Ada', 'data-testid': 'avatar' }
		});
		expect(initialsIn(screen.getByTestId('avatar').element())).toBe('👨‍👩‍👧‍👦A');
	});

	describe('initials come from letters, digits and emoji, not punctuation', () => {
		it.each([
			['Northwind Workbench (automation)', 'NA'],
			['Ada "The Countess" Lovelace', 'AL'],
			['“Ada” Lovelace', 'AL'],
			['Ada - Lovelace', 'AL'],
			['Ada Lovelace —', 'AL'],
			['Mary-Jane Watson', 'MW'],
			['(Ada)', 'A'],
			['Alice', 'A'],
			['R2 D2', 'RD'],
			['3M', '3'],
			['émile zola', 'ÉZ'],
			['😀 Ada', '😀A'],
			['Ada (😀)', 'A😀']
		])('%s renders %s', async (name, expected) => {
			const screen = await render(Avatar, { props: { name, 'data-testid': 'avatar' } });
			expect(initialsIn(screen.getByTestId('avatar').element())).toBe(expected);
		});

		it('falls through to the default icon when no word yields an initial', async () => {
			const screen = await render(Avatar, { props: { name: '- ()', 'data-testid': 'a' } });
			const el = screen.getByTestId('a').element();
			expect(el.querySelector('svg')).not.toBeNull();
			expect(initialsIn(el)).toBe('');
			// The name still names the avatar.
			await expect
				.element(screen.getByRole('img', { name: '- ()', exact: true }))
				.toBeInTheDocument();
		});
	});

	describe('initials are part of the picture, not text of the control', () => {
		// An interactive avatar is named by the person's name. Initials as text
		// would be a visible label that the name does not contain (WCAG 2.5.3
		// Label in Name), so they are drawn as generated content instead.
		it.each([
			['static', {}, 'img'],
			['link', { href: '/ada' }, 'link'],
			['button', { onclick: () => {} }, 'button']
		] as const)(
			'a %s avatar has no text content and is named by the person',
			async (_root, rootProps, role) => {
				const screen = await render(Avatar, {
					props: { name: 'Ada Lovelace', 'data-testid': 'a', ...rootProps }
				});
				const root = screen.getByTestId('a').element();
				// Svelte keeps the template's whitespace between the content div and
				// the status block as one text node where JSX strips it. The property
				// upstream's case exists to pin is that there is no *visible* text, so
				// the trimmed value is the honest observable here.
				expect(root.textContent?.trim()).toBe('');
				expect(screen.getByRole(role, { name: 'Ada Lovelace', exact: true }).element()).toBe(root);
				expect(initialsIn(root)).toBe('AL');
			}
		);

		it('draws the initials with empty alternative text from a private property', async () => {
			await render(Avatar, {
				props: { name: 'Ada Lovelace', onclick: () => {}, 'data-testid': 'a' }
			});
			const fallback = initialsElement('AL');
			const rules = pseudoContentRulesFor(fallback);
			expect(rules.some((rule) => /^var\(--[\w-]+\)$/.test(rule.content))).toBe(true);
			expect(fallback.getAttribute('style') ?? '').toMatch(/--[\w-]+:\s*"AL"\s*\/\s*""/);
			// Stronger than upstream's sheet-only assertion: Chromium understands
			// alternative text, so the winning branch's content actually applies.
			expect(getComputedStyle(fallback, '::before').content).toContain('AL');
		});

		it('draws the plain string where alternative text is unsupported, and the empty alternative where it is', async () => {
			await render(Avatar, { props: { name: 'Ada Lovelace', onclick: () => {} } });
			const fallback = initialsElement('AL');
			const isVarContent = (rule: PseudoContentRule) => /^var\(--[\w-]+\)$/.test(rule.content);
			// Older engines (no alternative text for generated content) use the
			// plain string; the control's aria-label still names it.
			expect(
				pseudoContentRulesFor(fallback).some((rule) => !rule.supports && isVarContent(rule))
			).toBe(true);
			expect(
				pseudoContentRulesFor(fallback).some((rule) => rule.supports && isVarContent(rule))
			).toBe(true);
			expect(fallback.getAttribute('style') ?? '').toMatch(/--[\w-]+:\s*"AL";/);
		});

		it('renders no public attribute for the initials', async () => {
			const screen = await render(Avatar, {
				props: { name: 'Ada Lovelace', onclick: () => {}, 'data-testid': 'a' }
			});
			const root = screen.getByTestId('a').element();
			expect(root.querySelector('[data-initials]')).toBeNull();
			expect(initialsIn(root)).toBe('AL');
		});

		it('keeps the photo path free of initials', async () => {
			const screen = await render(Avatar, {
				props: {
					name: 'Ada Lovelace',
					src: 'https://example.com/ada.jpg',
					onclick: () => {},
					'data-testid': 'a'
				}
			});
			const root = screen.getByTestId('a').element();
			expect(root.querySelector('img')).toHaveAttribute('alt', '');
			expect(initialsIn(root)).toBe('');
			await expect
				.element(screen.getByRole('button', { name: 'Ada Lovelace', exact: true }))
				.toBeInTheDocument();
		});
	});

	it('retries a new src after a previous src failed to load', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', src: 'https://example.com/broken.jpg' }
		});
		const wrapper = screen.getByRole('img', { name: 'Ada', exact: true }).element();
		// Upstream's `fireEvent.error`. `act()` has no counterpart — the `$state`
		// write flushes on its own, which `tick()` waits for.
		wrapper.querySelector('img')!.dispatchEvent(new Event('error'));
		await tick();
		// Broken image falls back to initials.
		expect(wrapper.querySelector('img')).toBeNull();
		expect(initialsIn(wrapper)).toBe('A');

		// A different src must get a fresh load attempt, not the stale error.
		await screen.rerender({ name: 'Ada', src: 'https://example.com/ada.jpg' });
		const img = wrapper.querySelector('img');
		expect(img).not.toBeNull();
		expect(img).toHaveAttribute('src', 'https://example.com/ada.jpg');
	});

	describe('status in the accessible name (WCAG 4.1.2)', () => {
		// The avatar root is role="img", which prunes descendant semantics —
		// a label inside the status subtree is never announced on its own.
		// Avatar composes the status element's `label` into its own name.
		it('composes the status label into the accessible name for image avatars', async () => {
			const screen = await render(AvatarStatusFixture, {
				props: {
					avatar: { name: 'Ada Lovelace', src: 'https://example.com/ada.jpg' },
					dot: { variant: 'success', label: 'Online' }
				}
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Online', exact: true }))
				.toBeInTheDocument();
		});

		it('composes the status label into the accessible name for initials avatars', async () => {
			const screen = await render(AvatarStatusFixture, {
				props: {
					avatar: { name: 'Ada Lovelace' },
					dot: { variant: 'error', label: 'Busy' }
				}
			});
			const avatar = screen.getByRole('img', { name: 'Ada Lovelace, Busy', exact: true });
			await expect.element(avatar).toBeInTheDocument();
			expect(initialsIn(avatar.element())).toBe('AL');
		});

		it('composes the status label with alt when alt overrides name', async () => {
			const screen = await render(AvatarStatusFixture, {
				props: {
					avatar: { name: 'Ada', alt: 'Ada Lovelace, profile photo' },
					dot: { label: 'Online' }
				}
			});
			await expect
				.element(
					screen.getByRole('img', { name: 'Ada Lovelace, profile photo, Online', exact: true })
				)
				.toBeInTheDocument();
		});

		it('keeps the plain name when there is no status', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace', 'data-testid': 'a' } });
			await tick();
			expect(screen.getByTestId('a').element()).toHaveAttribute('aria-label', 'Ada Lovelace');
		});

		it('keeps the plain name when the status dot has no label', async () => {
			const screen = await render(AvatarStatusFixture, {
				props: {
					avatar: { name: 'Ada Lovelace', 'data-testid': 'a' },
					dot: { variant: 'success' }
				}
			});
			// `tick()` so the dot's registration effect has run: the case must fail
			// if an unlabelled dot ever registers something, not merely observe the
			// avatar before it could.
			await tick();
			expect(screen.getByTestId('a').element()).toHaveAttribute('aria-label', 'Ada Lovelace');
		});

		it('keeps the plain name for custom status nodes without a label prop', async () => {
			// Upstream's `status={<span />}`. A status subtree with no
			// `AvatarStatusDot` in it registers nothing, so the name stays plain.
			const screen = await render(SlotProbe, {
				props: {
					component: Avatar,
					slot: 'status',
					text: '',
					rest: { name: 'Ada Lovelace', 'data-testid': 'a' }
				}
			});
			await tick();
			expect(screen.getByTestId('a').element()).toHaveAttribute('aria-label', 'Ada Lovelace');
		});

		it('announces a labelled status even on an otherwise decorative avatar', async () => {
			// A labelled status is meaningful information on its own — the avatar
			// must not stay aria-hidden and swallow it.
			const screen = await render(AvatarStatusFixture, {
				props: { avatar: { 'data-testid': 'a' }, dot: { label: 'Online' } }
			});
			const el = screen.getByTestId('a');
			await expect.element(el).toHaveAttribute('role', 'img');
			await expect.element(el).toHaveAttribute('aria-label', 'Online');
			expect(el.element()).not.toHaveAttribute('aria-hidden');
		});

		it('stays decorative with an unlabelled status and no name', async () => {
			const screen = await render(AvatarStatusFixture, {
				props: { avatar: { 'data-testid': 'a' }, dot: {} }
			});
			await tick();
			const el = screen.getByTestId('a').element();
			expect(el).toHaveAttribute('aria-hidden', 'true');
			expect(el).not.toHaveAttribute('aria-label');
		});
	});

	describe('status label through a consumer wrapper (P14)', () => {
		// A consumer's own component around AvatarStatusDot. Its prop is
		// deliberately not called `label`, so upstream's `status.props.label`
		// introspection has nothing to read; the dot's own report through context
		// reaches it. Two upstream cases in this block assert a React
		// commit-count and are named as unported in the header.

		it('composes a label reported from inside a wrapper component', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { name: 'Ada Lovelace' } }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Online', exact: true }))
				.toBeInTheDocument();
		});

		it('composes a label reported at any nesting depth', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { name: 'Ada Lovelace' }, wrapper: 'nested', presence: 'Away' }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Away', exact: true }))
				.toBeInTheDocument();
		});

		it('follows a label that changes after mount', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { name: 'Ada Lovelace' } }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Online', exact: true }))
				.toBeInTheDocument();

			await screen.rerender({ presence: 'Busy' });
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Busy', exact: true }))
				.toBeInTheDocument();
		});

		it('drops the label when the status element unmounts', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { name: 'Ada Lovelace', 'data-testid': 'a' } }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Online', exact: true }))
				.toBeInTheDocument();

			await screen.rerender({ showStatus: false });
			await tick();
			expect(screen.getByTestId('a').element()).toHaveAttribute('aria-label', 'Ada Lovelace');
		});

		it('announces a wrapped status on an otherwise decorative avatar', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { 'data-testid': 'a' } }
			});
			const el = screen.getByTestId('a');
			await expect.element(el).toHaveAttribute('role', 'img');
			await expect.element(el).toHaveAttribute('aria-label', 'Online');
			expect(el.element()).not.toHaveAttribute('aria-hidden');
		});

		it('lets a reported label win over introspection', async () => {
			// The wrapper's own `label` prop is not the string the dot renders with,
			// so introspection and the dot's report disagree here.
			const screen = await render(AvatarWrappedStatusFixture, {
				props: {
					avatar: { name: 'Ada Lovelace' },
					wrapper: 'translated',
					label: 'busy'
				}
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Busy', exact: true }))
				.toBeInTheDocument();
		});

		// Upstream: `follows a label that changes without re-rendering the avatar`.
		// The title states what this port can assert: the dot's state changes
		// inside the consumer's wrapper, with no prop change on the Avatar. A
		// Svelte state write updates the sink, so the avatar re-composes rather
		// than being patched imperatively in a ref callback — the observable name
		// is the same, and the React-specific "no re-render" claim is not.
		it('follows a label that changes from inside the status subtree', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: { avatar: { name: 'Ada Lovelace' }, wrapper: 'self-updating' }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Online', exact: true }))
				.toBeInTheDocument();

			screen.component.setPresence('Busy');
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace, Busy', exact: true }))
				.toBeInTheDocument();
		});

		it('leaves a consumer aria-label alone when a wrapped status reports', async () => {
			const screen = await render(AvatarWrappedStatusFixture, {
				props: {
					avatar: {
						name: 'Ada Lovelace',
						'aria-label': 'Ada Lovelace, first programmer',
						'data-testid': 'a'
					}
				}
			});
			await tick();
			expect(screen.getByTestId('a').element()).toHaveAttribute(
				'aria-label',
				'Ada Lovelace, first programmer'
			);
		});
	});

	it('retries a new fallbackSrc after a previous fallbackSrc failed to load', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', fallbackSrc: 'https://example.com/broken.jpg' }
		});
		const wrapper = screen.getByRole('img', { name: 'Ada', exact: true }).element();
		wrapper.querySelector('img')!.dispatchEvent(new Event('error'));
		await tick();
		expect(wrapper.querySelector('img')).toBeNull();

		await screen.rerender({ name: 'Ada', fallbackSrc: 'https://example.com/ada.jpg' });
		const img = wrapper.querySelector('img');
		expect(img).not.toBeNull();
		expect(img).toHaveAttribute('src', 'https://example.com/ada.jpg');
	});

	it('renders without error for all shape variants', async () => {
		const shapes = ['circle', 'rounded', 'square'] as const;
		for (const shape of shapes) {
			const screen = await render(Avatar, {
				props: { name: 'Ana Thomas', shape, 'data-testid': `avatar-${shape}` }
			});
			await expect.element(screen.getByTestId(`avatar-${shape}`)).toBeInTheDocument();
			screen.unmount();
		}
	});

	it('defaults to circle shape (no shape prop)', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Lee', 'data-testid': 'avatar-default' }
		});
		// Should still render with role="img" using the name as the accessible label.
		await expect.element(screen.getByRole('img', { name: 'Lee', exact: true })).toBeInTheDocument();
	});

	it('renders status dot for all shape variants', async () => {
		const shapes = ['circle', 'rounded', 'square'] as const;
		for (const shape of shapes) {
			const screen = await render(SlotProbe, {
				props: {
					component: Avatar,
					slot: 'status',
					text: '',
					testid: 'status-dot',
					rest: { name: 'Ana', shape, 'data-testid': `avatar-${shape}-status` }
				}
			});
			await expect.element(screen.getByTestId('status-dot')).toBeInTheDocument();
			screen.unmount();
		}
	});

	it('applies shapeStyles to wrapper when rendered inside AvatarGroup', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice', shape: 'rounded', 'data-testid': 'group-avatar' }] }
		});
		await expect.element(screen.getByTestId('group-avatar')).toBeInTheDocument();
	});

	it("an AvatarGroup's shape overrides an individual Avatar's own shape prop, matching how size already works", async () => {
		const screen = await render(AvatarGroupFixture, {
			props: {
				group: { shape: 'square' },
				avatars: [{ name: 'Alice', shape: 'rounded', 'data-testid': 'group-avatar' }]
			}
		});
		await expect
			.element(screen.getByTestId('group-avatar'))
			.toHaveAttribute('data-shape', 'square');
	});

	it("an Avatar's own shape prop applies outside any AvatarGroup", async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ana', shape: 'rounded', 'data-testid': 'solo-avatar' }
		});
		await expect
			.element(screen.getByTestId('solo-avatar'))
			.toHaveAttribute('data-shape', 'rounded');
	});

	it('defaults to circle shape inside an AvatarGroup with no explicit shape', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice', shape: 'square', 'data-testid': 'group-avatar' }] }
		});
		await expect
			.element(screen.getByTestId('group-avatar'))
			.toHaveAttribute('data-shape', 'circle');
	});

	// --- Name tooltip (tooltip?: string | boolean) ---
	describe('name tooltip', () => {
		// Upstream's `beforeEach`/`afterEach` here stub
		// `HTMLElement.prototype.showPopover`/`hidePopover`, which jsdom does not
		// implement. Chromium does, so there is nothing to stand in for.

		it('shows the name in a tooltip by default', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace' } });
			const tooltip = screen.getByRole('tooltip', { includeHidden: true });
			await expect.element(tooltip).toHaveTextContent('Ada Lovelace');
		});

		it('shows a custom string tooltip instead of the name', async () => {
			const screen = await render(Avatar, {
				props: { name: 'alovelace', tooltip: 'Ada Lovelace, Mathematician' }
			});
			const tooltip = screen.getByRole('tooltip', { includeHidden: true }).element();
			expect(tooltip).toHaveTextContent('Ada Lovelace, Mathematician');
			expect(tooltip).not.toHaveTextContent('alovelace');
		});

		it('renders no tooltip when tooltip={false}', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace', tooltip: false } });
			expect(screen.getByRole('tooltip', { includeHidden: true }).query()).toBeNull();
		});

		it('renders no tooltip for a decorative avatar (no name/alt)', async () => {
			const screen = await render(Avatar, { props: { src: 'https://example.com/x.jpg' } });
			expect(screen.getByRole('tooltip', { includeHidden: true }).query()).toBeNull();
		});

		it('renders no tooltip when tooltip is true/default but name is empty', async () => {
			const screen = await render(Avatar, {
				props: { name: '   ', alt: 'Profile photo', 'data-testid': 'a' }
			});
			// A whitespace-only name yields nothing to show, and the default tooltip
			// uses `name` (not `alt`), so there is no tooltip.
			expect(screen.getByRole('tooltip', { includeHidden: true }).query()).toBeNull();
			// The accessible name still comes from alt, unaffected.
			await expect
				.element(screen.getByRole('img', { name: 'Profile photo', exact: true }))
				.toBeInTheDocument();
		});

		it('still shows a custom string tooltip when there is no name', async () => {
			const screen = await render(Avatar, {
				props: { tooltip: 'Anonymous user', 'data-testid': 'a' }
			});
			const tooltip = screen.getByRole('tooltip', { includeHidden: true });
			await expect.element(tooltip).toHaveTextContent('Anonymous user');
		});

		it('makes the root focusable while a tooltip is attached', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace', 'data-testid': 'a' } });
			expect(screen.getByTestId('a').element()).toHaveAttribute('tabindex', '0');
		});

		it('does not add a tab stop when the tooltip is disabled', async () => {
			const screen = await render(Avatar, {
				props: { name: 'Ada Lovelace', tooltip: false, 'data-testid': 'a' }
			});
			expect(screen.getByTestId('a').element()).not.toHaveAttribute('tabindex');
		});

		it('keeps the accessible name on the root regardless of the tooltip', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace' } });
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace', exact: true }))
				.toBeInTheDocument();

			await screen.rerender({ name: 'Ada Lovelace', tooltip: false });
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace', exact: true }))
				.toBeInTheDocument();

			await screen.rerender({ name: 'alovelace', tooltip: 'Ada Lovelace, Eng' });
			// alt||name still drives the accessible name — not the custom tooltip.
			await expect
				.element(screen.getByRole('img', { name: 'alovelace', exact: true }))
				.toBeInTheDocument();

			// `rerender` merges props rather than replacing them, so `tooltip` is
			// reset to its default here to reproduce upstream's fourth prop set.
			await screen.rerender({
				name: 'alovelace',
				alt: "Ada's profile photo",
				tooltip: true
			});
			await expect
				.element(screen.getByRole('img', { name: "Ada's profile photo", exact: true }))
				.toBeInTheDocument();
		});

		it('does not describe the root with the default name tooltip (no double-announce)', async () => {
			const screen = await render(Avatar, { props: { name: 'Ada Lovelace', 'data-testid': 'a' } });
			// The default name tooltip is visual-only: its text duplicates the root
			// aria-label, so we deliberately do NOT wire aria-describedby (OQ-4).
			expect(screen.getByTestId('a').element()).not.toHaveAttribute('aria-describedby');
		});

		it('describes the root with a custom string tooltip (matches Button)', async () => {
			const screen = await render(Avatar, {
				props: {
					name: 'alovelace',
					tooltip: 'Ada Lovelace, Mathematician',
					'data-testid': 'a'
				}
			});
			const root = screen.getByTestId('a').element();
			const describedBy = root.getAttribute('aria-describedby');
			expect(describedBy).toBeTruthy();
			// aria-describedby points at the rendered tooltip layer.
			const tooltip = screen.getByRole('tooltip', { includeHidden: true }).element();
			expect(tooltip.id).toBeTruthy();
			expect(describedBy).toContain(tooltip.id);
		});

		it('composes a consumer aria-describedby with the custom tooltip description', async () => {
			// Upstream renders a sibling `<span id="extra-desc">` alongside the
			// avatar; it is scenery for the id reference, so it is created directly
			// rather than through another fixture.
			const extra = document.createElement('span');
			extra.id = 'extra-desc';
			extra.textContent = 'extra description';
			document.body.append(extra);
			try {
				const screen = await render(Avatar, {
					props: {
						name: 'alovelace',
						tooltip: 'Ada Lovelace, Eng',
						'aria-describedby': 'extra-desc',
						'data-testid': 'a'
					}
				});
				const describedBy = screen.getByTestId('a').element().getAttribute('aria-describedby');
				expect(describedBy).toContain('extra-desc');
			} finally {
				extra.remove();
			}
		});

		it('preserves a consumer aria-describedby with the default name tooltip', async () => {
			const extra = document.createElement('span');
			extra.id = 'extra-desc';
			extra.textContent = 'extra description';
			document.body.append(extra);
			try {
				const screen = await render(Avatar, {
					props: {
						name: 'Ada Lovelace',
						'aria-describedby': 'extra-desc',
						'data-testid': 'a'
					}
				});
				// Default name tooltip does not touch aria-describedby, so the consumer
				// value passes through untouched.
				expect(screen.getByTestId('a').element()).toHaveAttribute('aria-describedby', 'extra-desc');
			} finally {
				extra.remove();
			}
		});

		// COUNTERPART for upstream's `forwards the consumer ref to the root while a
		// tooltip is attached`. Svelte has no `ref`; the consumer's handle on the
		// root is an attachment travelling in the rest props, which `Avatar` spreads
		// onto the root `<div>` alongside the tooltip's own attachment — the
		// coexistence the upstream case is really about. It receives the element,
		// so it asserts identity exactly as `ref.current` does.
		it('forwards the consumer ref to the root while a tooltip is attached', async () => {
			const attached = vi.fn();
			const screen = await render(Avatar, {
				props: {
					name: 'Ada Lovelace',
					'data-testid': 'a',
					[createAttachmentKey()]: (node: Element) => attached(node)
				}
			});
			expect(attached).toHaveBeenCalledWith(screen.getByTestId('a').element());
			expect(screen.getByTestId('a').element()).toBeInstanceOf(HTMLDivElement);
		});

		// COUNTERPART for upstream's `keeps its merged ref attached across
		// unrelated rerenders`. A Svelte attachment is the consumer's handle, and
		// an unrelated prop change neither re-runs it nor replaces the element —
		// the two claims upstream's `ref.mockClear()` plus element-identity
		// assertion makes.
		it('keeps its merged ref attached across unrelated rerenders', async () => {
			const attached = vi.fn();
			const screen = await render(Avatar, {
				props: {
					name: 'Ada Lovelace',
					size: 'sm',
					tooltip: false,
					[createAttachmentKey()]: attached
				}
			});
			const avatar = screen.getByRole('img', { name: 'Ada Lovelace', exact: true }).element();
			expect(attached).toHaveBeenLastCalledWith(avatar);
			attached.mockClear();

			await screen.rerender({ size: 'lg' });
			await tick();

			expect(attached).not.toHaveBeenCalled();
			expect(screen.getByRole('img', { name: 'Ada Lovelace', exact: true }).element()).toBe(avatar);
		});
	});
});

describe('Avatar — interactivity (Button trichotomy)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders a link when `href` is set (default LinkComponent is <a>)', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada Lovelace', href: '/users/ada' } });
		const link = screen.getByRole('link', { name: 'Ada Lovelace', exact: true }).element();
		expect(link.tagName).toBe('A');
		expect(link).toHaveAttribute('href', '/users/ada');
		// The static img semantics are gone — it's a control now.
		expect(screen.getByRole('img').query()).toBeNull();
	});

	it('forwards target/rel on the link', async () => {
		const screen = await render(Avatar, {
			props: {
				name: 'Ada',
				href: 'https://example.com',
				target: '_blank',
				rel: 'noopener noreferrer'
			}
		});
		const link = screen.getByRole('link', { name: 'Ada', exact: true }).element();
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('renders a <button type="button"> when `onClick` is set (no href)', async () => {
		const handleClick = vi.fn();
		const screen = await render(Avatar, { props: { name: 'Ada', onclick: handleClick } });
		const button = screen.getByRole('button', { name: 'Ada', exact: true });
		expect(button.element().tagName).toBe('BUTTON');
		expect(button.element()).toHaveAttribute('type', 'button');
		await userEvent.click(button);
		expect(handleClick).toHaveBeenCalledOnce();
	});

	it('href wins over onClick (link, not button)', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', href: '/ada', onclick: () => {} }
		});
		await expect
			.element(screen.getByRole('link', { name: 'Ada', exact: true }))
			.toBeInTheDocument();
		expect(screen.getByRole('button').query()).toBeNull();
	});

	it('stays a static element (no href, no onClick) — non-breaking default', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada' } });
		await expect.element(screen.getByRole('img', { name: 'Ada', exact: true })).toBeInTheDocument();
		expect(screen.getByRole('link').query()).toBeNull();
		expect(screen.getByRole('button').query()).toBeNull();
	});

	it('stamps the data-avatar-item marker on the interactive link', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada', href: '/ada' } });
		expect(screen.getByRole('link', { name: 'Ada', exact: true }).element()).toHaveAttribute(
			'data-avatar-item'
		);
	});

	it('stamps the data-avatar-item marker on the interactive button', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada', onclick: () => {} } });
		expect(screen.getByRole('button', { name: 'Ada', exact: true }).element()).toHaveAttribute(
			'data-avatar-item'
		);
	});

	it('does not stamp data-avatar-item on a static avatar', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada', 'data-testid': 'a' } });
		expect(screen.getByTestId('a').element()).not.toHaveAttribute('data-avatar-item');
	});

	it('carries a focus-visible ring class on the interactive element', async () => {
		// The interactive element applies the shared focus-visible accent ring via
		// its StyleX class. We assert the element is focusable and receives focus.
		const screen = await render(Avatar, { props: { name: 'Ada', onclick: () => {} } });
		const button = screen
			.getByRole('button', { name: 'Ada', exact: true })
			.element() as HTMLElement;
		button.focus();
		expect(button).toHaveFocus();
		// className carries the avatar theming target so themes can style it.
		expect(button.className).toContain('astryx-avatar');
	});

	it('warns in dev when interactive without an accessible name (href)', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { href: '/somewhere' } });
		await tick();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('interactive avatar'));
	});

	it('warns in dev when interactive without an accessible name (onClick)', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { onclick: () => {} } });
		await tick();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('interactive avatar'));
	});

	it('does not warn when interactive with a name', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { name: 'Ada', href: '/ada' } });
		await tick();
		expect(warn).not.toHaveBeenCalled();
	});

	it('does not warn for a static avatar without a name (decorative is fine)', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { 'data-testid': 'a' } });
		await tick();
		expect(warn).not.toHaveBeenCalled();
	});

	it('warns when the only accessible name is a status label', async () => {
		// A status is not an identity: "Online" alone is a worse control name than
		// none, because it reads as a legitimate one.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(AvatarStatusFixture, {
			props: {
				avatar: { href: '/somewhere', src: 'https://example.com/ada.jpg' },
				dot: { label: 'Online' }
			}
		});
		await tick();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('interactive avatar'));
	});

	it('warns when interactive with an empty-string name and alt', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { href: '/ada', name: '', alt: '' } });
		await tick();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('interactive avatar'));
	});

	it('does not warn when the consumer names the control with aria-label', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await render(Avatar, { props: { href: '/ada', 'aria-label': 'Ada Lovelace' } });
		await tick();
		expect(warn).not.toHaveBeenCalled();
	});

	// -- 0.4.2: the box moves to the theme target, and a blank name is no name --

	it('puts the avatar box on the element that carries the theme target', async () => {
		// T7: `.astryx-avatar` documents a `size` visual prop, so the width and
		// height that prop selects on must live on the targeted element — a theme
		// rule that resizes the target has to resize the whole avatar, not leave a
		// fixed-size circle inside a grown box.
		const screen = await render(Avatar, {
			props: { name: 'Ada Lovelace', size: 'lg', 'data-testid': 'a' }
		});
		const root = screen.container.querySelector('[data-testid="a"]') as HTMLElement;
		expect(root.className).toContain('astryx-avatar');
		expect(root.getAttribute('style') ?? '').toContain('48px');

		const content = root.firstElementChild as HTMLElement;
		expect(content.getAttribute('style') ?? '').not.toContain('48px');
	});

	it('keeps the box on the root for an interactive avatar too', async () => {
		const screen = await render(Avatar, { props: { name: 'Ada', size: 'lg', href: '/ada' } });
		const link = screen.getByRole('link', { name: 'Ada', exact: true }).element();
		expect(link.getAttribute('style') ?? '').toContain('48px');
	});

	describe('a whitespace-only name carries no identity', () => {
		it('falls through to the default icon instead of an empty plate', async () => {
			const screen = await render(Avatar, { props: { name: '   ', 'data-testid': 'a' } });
			const el = screen.container.querySelector('[data-testid="a"]') as HTMLElement;
			expect(el.querySelector('svg')).not.toBeNull();
			expect(initialsIn(el)).toBe('');
		});

		it('is decorative rather than a role="img" with a blank name', async () => {
			const screen = await render(Avatar, { props: { name: '   ', 'data-testid': 'a' } });
			const el = screen.container.querySelector('[data-testid="a"]') as HTMLElement;
			expect(el).toHaveAttribute('aria-hidden', 'true');
			expect(el).not.toHaveAttribute('aria-label');
		});

		it('keeps a meaningful alt as the accessible name and still shows the icon', async () => {
			const screen = await render(Avatar, {
				props: { name: '   ', alt: 'Profile photo', 'data-testid': 'a' }
			});
			const el = screen.getByRole('img', { name: 'Profile photo', exact: true }).element();
			expect(el).toBe(screen.container.querySelector('[data-testid="a"]'));
			expect(el.querySelector('svg')).not.toBeNull();
		});

		it('treats a whitespace-only alt the same way', async () => {
			const screen = await render(Avatar, {
				props: { alt: '  ', name: 'Ada Lovelace', 'data-testid': 'a' }
			});
			await expect
				.element(screen.getByRole('img', { name: 'Ada Lovelace', exact: true }))
				.toBeInTheDocument();
		});
	});
});

describe('Avatar — consumer ARIA overrides win (Icon labelling pattern)', () => {
	it('lets a consumer aria-label override the derived name on the static root', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', 'aria-label': 'Ada Lovelace, on leave' }
		});
		await expect
			.element(screen.getByRole('img', { name: 'Ada Lovelace, on leave', exact: true }))
			.toBeInTheDocument();
	});

	it('lets a consumer role override the derived role', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', role: 'presentation', 'data-testid': 'a' }
		});
		await expect.element(screen.getByTestId('a')).toHaveAttribute('role', 'presentation');
	});

	it('lets a consumer hide a named avatar with aria-hidden', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', 'aria-hidden': 'true', 'data-testid': 'a' }
		});
		await expect.element(screen.getByTestId('a')).toHaveAttribute('aria-hidden', 'true');
	});

	it('lets a consumer aria-label override the derived name on an interactive root', async () => {
		const screen = await render(Avatar, {
			props: { name: 'Ada', href: '/ada', 'aria-label': 'Ada Lovelace profile' }
		});
		await expect
			.element(screen.getByRole('link', { name: 'Ada Lovelace profile', exact: true }))
			.toBeInTheDocument();
	});
});
