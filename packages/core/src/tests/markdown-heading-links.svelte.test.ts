/** PORTS: Markdown/plugins/headingLinks.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import Markdown from '$lib/components/markdown/markdown.svelte';
import ContainerRevealProbe from './fixtures/container-reveal-probe.svelte';
import MarkdownCustomHeadingId from './fixtures/markdown-custom-heading-id.svelte';
import HeadingLinksI18n from './fixtures/markdown-heading-links-i18n.svelte';
import HeadingLinksLinkProvider from './fixtures/markdown-heading-links-link-provider.svelte';
import { createMarkdownHeadingLinks } from '$lib/components/markdown/plugins/heading-links.js';
import {
	createMarkdownPluginEntry,
	type MarkdownPluginEntry
} from '$lib/components/markdown/plugins/protocol.js';
import { parseOutlineFromMarkdown } from '$lib/components/outline/parse-outline-from-markdown.js';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';

/**
 * Astryx's `Markdown/plugins/headingLinks.test.tsx`, ported case for case in
 * upstream's order. Every case is here; none is dropped.
 *
 * Upstream's browser a11y spec for the same module
 * (`Markdown/plugins/headingLinks.a11y.chromium.spec.ts`) is **not ported**: it
 * drives a built Storybook through `@astryxdesign/a11y-spec/playwright`, which
 * this repo does not have, and most of its assertions are geometry evidence
 * rather than component behaviour.
 *
 * ## Translations (mechanism, not dropped cases)
 *
 * - **`createMarkdownPlugin` is not ported yet.** The generic plugin protocol is
 *   a transform/renderer pipeline that this parser does not have, so the two
 *   cases that need "some other valid entry" build the same frozen, branded
 *   envelope through the internal `createMarkdownPluginEntry()`. The fail-soft
 *   cases use upstream's own hand-built branded entries unchanged — they are
 *   testing the validator, not a factory.
 * - **`renderHook(useContainerReveal)` → `container-reveal-probe.svelte`.** The
 *   probe already exists for upstream's hook suite; its rendered container and
 *   content elements expose exactly the classes `result.current` would.
 * - **`act()` disappears.** A `$state` write flushes on its own, so
 *   `act(async () => { … })` is `await Promise.resolve()`, and
 *   `act(() => vi.advanceTimersByTime(n))` is the bare advance.
 * - **`fireEvent.click` → a dispatched cancelable `MouseEvent`**, because the
 *   asserted "not cancelled" return value is `dispatchEvent`'s. Modifier and
 *   non-primary-pointer cases pass the same `MouseEventInit` fields.
 * - **`waitFor` → `expect.element` / `vi.waitFor`**, both retrying.
 * - **`expectTypeOf(headingLinks).toMatchTypeOf<MarkdownPluginEntry<never>>()`**
 *   compiles to nothing and would fail `requireAssertions`, so the same claim is
 *   stated twice: the value is assigned to `MarkdownPluginEntry<never>` (the
 *   type half) and its runtime envelope is asserted (the rendered-output half).
 * - **The clipboard stub is respelled.** This project runs real Chromium, where
 *   `navigator.clipboard` is a prototype getter; `Object.defineProperty` installs
 *   the spy and `Reflect.deleteProperty` restores the real API afterwards — the
 *   `clipboard.svelte.test.ts` spelling. Upstream's `readText()` assertions
 *   become assertions on the `writeText` spy's last call, which is the same
 *   canonical-URL claim without a permission grant.
 * - **The `.astryx-icon` class does not exist on this port's `Icon`** (a
 *   pre-existing divergence), so the copied-state icon assertion reads the
 *   glyph's `<svg>`, which is present only after the copy flips to the check.
 * - **`components.heading` is a fixture**, `markdown-custom-heading-id.svelte`,
 *   because a Svelte component cannot be declared inline in a `.ts` test.
 */

const headingLinks = createMarkdownHeadingLinks();
const markdownPluginBrand = Symbol.for('@astryxdesign/core/MarkdownPluginEntry');
const headingLinksConfigBrand = Symbol.for('@astryxdesign/core/MarkdownHeadingLinksConfig');

function createBrandedSameNameEntry({
	pluginApiVersion = 1,
	config
}: {
	readonly pluginApiVersion?: number;
	readonly config?: unknown;
} = {}): MarkdownPluginEntry {
	const definition: Record<PropertyKey, unknown> = {
		name: 'heading-links',
		apiVersion: pluginApiVersion,
		transform: (root: { readonly type: string }) => root
	};
	if (config !== undefined) {
		Object.defineProperty(definition, headingLinksConfigBrand, {
			configurable: false,
			enumerable: false,
			value: Object.freeze(config),
			writable: false
		});
	}
	Object.freeze(definition);
	return Object.freeze({
		name: 'heading-links',
		apiVersion: pluginApiVersion,
		[markdownPluginBrand]: Object.freeze({
			kind: '@astryxdesign/core/MarkdownPluginEntry',
			apiVersion: pluginApiVersion,
			definition
		})
	}) as unknown as MarkdownPluginEntry;
}

function createConfig(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
		kind: '@astryxdesign/core/MarkdownHeadingLinksConfig',
		apiVersion: 1,
		headingIdPrefix: 'ignored',
		permalinkBaseUrl: '',
		...overrides
	};
}

const incompatibleHeadingLinksEntries: ReadonlyArray<readonly [string, MarkdownPluginEntry]> = [
	[
		'same-name plugin without module configuration',
		createMarkdownPluginEntry({ name: 'heading-links', apiVersion: 1 })
	],
	[
		'malformed generic envelope',
		Object.freeze({ name: 'heading-links', apiVersion: 1 }) as unknown as MarkdownPluginEntry
	],
	['older plugin protocol', createBrandedSameNameEntry({ pluginApiVersion: 0 })],
	['newer plugin protocol', createBrandedSameNameEntry({ pluginApiVersion: 2 })],
	[
		'older module configuration',
		createBrandedSameNameEntry({ config: createConfig({ apiVersion: 0 }) })
	],
	[
		'newer module configuration',
		createBrandedSameNameEntry({ config: createConfig({ apiVersion: 2 }) })
	],
	[
		'unparseable URL configuration',
		createBrandedSameNameEntry({ config: createConfig({ permalinkBaseUrl: 'https://%' }) })
	],
	[
		'wrong module configuration shape',
		createBrandedSameNameEntry({ config: createConfig({ headingIdPrefix: 42 }) })
	]
];

let writeText: ReturnType<typeof vi.fn>;

function politeRegion(): HTMLElement | null {
	return document.querySelector('[data-astryx-live-region="polite"]');
}

function fireClick(element: Element, init: MouseEventInit = { button: 0 }): boolean {
	return element.dispatchEvent(
		new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
	);
}

function useFakeTimeouts(): void {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

describe('createMarkdownHeadingLinks', () => {
	beforeEach(() => {
		writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
			writable: true
		});
	});

	afterEach(() => {
		__resetLiveRegionsForTest();
		Reflect.deleteProperty(navigator, 'clipboard');
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('returns an ordinary public plugin entry', () => {
		const entry: MarkdownPluginEntry<never> = headingLinks;
		expect(entry.name).toBe('heading-links');
		expect(entry.apiVersion).toBe(1);
	});

	it('carries namespace and URL options across a duplicate compatible Core copy', async () => {
		vi.resetModules();
		const duplicateCore = await import('$lib/components/markdown/plugins/heading-links.js');
		const portableEntry = duplicateCore.createMarkdownHeadingLinks({
			headingIdPrefix: 'portable',
			permalinkBaseUrl: '/reader?document=42#stale'
		});
		const source = '> # Nested\n\n# Root';

		const screen = await render(Markdown, {
			props: { plugins: [portableEntry], children: source }
		});

		await expect
			.element(screen.getByRole('heading', { name: 'Nested', exact: true }))
			.toHaveAttribute('id', 'portable--nested');
		const copyButton = screen.getByRole('button', {
			name: 'Copy link to Nested',
			exact: true
		});
		await expect.element(copyButton).not.toHaveAttribute('href');
		await userEvent.click(copyButton);
		await vi.waitFor(() => {
			expect(writeText).toHaveBeenCalledWith(
				new URL('/reader?document=42#portable--nested', window.location.href).href
			);
		});
		expect(parseOutlineFromMarkdown(source, { plugins: [portableEntry] })).toEqual([
			{ id: 'portable--root', label: 'Root', level: 1 }
		]);
	});

	it.each(incompatibleHeadingLinksEntries)(
		'fails soft for %s across Markdown and Outline',
		async (_label, incompatibleEntry) => {
			const source = '> # Nested\n\n# Root';
			const screen = await render(Markdown, {
				props: { plugins: [incompatibleEntry], children: source }
			});
			const [nested, root] = screen.getByRole('heading').elements();

			expect(nested).not.toHaveAttribute('id');
			expect(root).toHaveAttribute('id', 'root');
			expect(screen.container.querySelector('button, a[href*="#"]')).toBeNull();
			expect(parseOutlineFromMarkdown(source, { plugins: [incompatibleEntry] })).toEqual([
				{ id: 'root', label: 'Root', level: 1 }
			]);
		}
	);

	it('does not treat another valid plugin as heading-links configuration', async () => {
		const otherPlugin = createMarkdownPluginEntry({ name: 'other-plugin', apiVersion: 1 });
		const screen = await render(Markdown, {
			props: { plugins: [otherPlugin], children: '> # Nested\n\n# Root' }
		});
		const [nested, root] = screen.getByRole('heading').elements();

		expect(nested).not.toHaveAttribute('id');
		expect(root).toHaveAttribute('id', 'root');
		expect(screen.container.querySelector('button[aria-label*="Copy link"]')).toBeNull();
	});

	it('links every semantic heading level', async () => {
		const screen = await render(Markdown, {
			props: {
				plugins: [headingLinks],
				children: Array.from(
					{ length: 6 },
					(_, index) => `${'#'.repeat(index + 1)} Level ${index + 1}`
				).join('\n\n')
			}
		});

		for (let level = 1; level <= 6; level += 1) {
			const heading = screen.getByRole('heading', {
				level: level as 1 | 2 | 3 | 4 | 5 | 6,
				name: `Level ${level}`,
				exact: true
			});
			await expect.element(heading).toHaveAttribute('id', `level-${level}`);
			const copyButton = screen.getByRole('button', {
				name: `Copy link to Level ${level}`,
				exact: true
			});
			await expect.element(copyButton).not.toHaveAttribute('href');
			await expect.element(copyButton).toHaveTextContent('#');
		}
	});

	it('shares one depth-first allocator while Outline remains root-only', async () => {
		const source = '> # Quoted\n\n# Quoted';
		const screen = await render(Markdown, { props: { plugins: [headingLinks], children: source } });
		const [nested, topLevel] = screen.getByRole('heading').elements();

		expect(screen.container.querySelector('blockquote')).toContainElement(nested);
		expect(nested).toHaveAttribute('id', 'quoted');
		expect(topLevel).toHaveAttribute('id', 'quoted-1');
		expect(parseOutlineFromMarkdown(source, { plugins: [headingLinks] })).toEqual([
			{ id: 'quoted-1', label: 'Quoted', level: 1 }
		]);
	});

	it('reserves emitted ids across natural numeric-suffix collisions', async () => {
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Foo\n\n# Foo\n\n# Foo-1' }
		});
		expect(
			screen
				.getByRole('heading')
				.elements()
				.map((heading) => heading.id)
		).toEqual(['foo', 'foo-1', 'foo-1-1']);
		expect(
			parseOutlineFromMarkdown('# Foo-1\n\n# Foo\n\n# Foo', {
				plugins: [headingLinks]
			}).map((item) => item.id)
		).toEqual(['foo-1', 'foo', 'foo-2']);
	});

	it('normalizes Unicode letters and numbers while stripping emoji', async () => {
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Ｈｅｌｌｏ Привет 你好 😄 １２３' }
		});
		await expect
			.element(screen.getByRole('heading'))
			.toHaveAttribute('id', 'hello-привет-你好-123');
	});

	it('uses a caller-owned namespace across Markdown and Outline', async () => {
		const source = '# Overview\n\n## Details';
		const namespaced = createMarkdownHeadingLinks({ headingIdPrefix: 'article' });
		const screen = await render(Markdown, {
			props: { id: 'article', plugins: [namespaced], children: source }
		});

		expect(screen.container.firstElementChild).toHaveAttribute('id', 'article');
		expect(
			screen
				.getByRole('heading')
				.elements()
				.map((heading) => heading.id)
		).toEqual(['article--overview', 'article--details']);
		expect(parseOutlineFromMarkdown(source, { plugins: [namespaced] })).toEqual([
			{ id: 'article--overview', label: 'Overview', level: 1 },
			{ id: 'article--details', label: 'Details', level: 2 }
		]);
	});

	it('renders one honest sibling copy button for every owned heading', async () => {
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview\n\n> ## Nested details' }
		});
		const headings = screen.getByRole('heading').elements();
		const copyButtons = screen.getByRole('button', { name: /Copy link to/ }).elements();

		expect(headings.map((heading) => heading.id)).toEqual(['overview', 'nested-details']);
		expect(copyButtons).toHaveLength(headings.length);
		headings.forEach((heading, index) => {
			expect(heading).not.toContainElement(copyButtons[index]);
			expect(heading.parentElement).toContainElement(copyButtons[index]);
			expect(copyButtons[index]).toHaveAttribute('type', 'button');
			expect(copyButtons[index]).not.toHaveAttribute('href');
			// Svelte syncs the `dir` DOM property after setting the attribute, so
			// an absent direction would otherwise render `dir=""` on every row and
			// reset direction inheritance. React omits the attribute; so must this.
			expect(heading.parentElement).not.toHaveAttribute('dir');
		});
	});

	it('wires the heading row and button to canonical container reveal', async () => {
		const probe = await render(ContainerRevealProbe, {
			props: { contentOptions: () => ({ isLayoutPreserved: true }) }
		});
		const probeContainer = probe.container.querySelector('[data-reveal-container]')!;
		const probeContent = probe.container.querySelector('[data-reveal-content]')!;
		const containerClasses = probeContainer.className.split(/\s+/).filter(Boolean);
		const contentClasses = probeContent.className.split(/\s+/).filter(Boolean);

		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const heading = screen.getByRole('heading', { name: 'Overview', exact: true }).element();
		const copyButton = screen
			.getByRole('button', {
				name: 'Copy link to Overview',
				exact: true
			})
			.element();

		expect(containerClasses.length).toBeGreaterThan(0);
		expect(contentClasses.length).toBeGreaterThan(0);
		for (const className of containerClasses) {
			expect(heading.parentElement).toHaveClass(className);
		}
		for (const className of contentClasses) {
			expect(copyButton).toHaveClass(className);
		}
	});

	it('copies the canonical URL, shows fixed-space confirmation, announces, and restores', async () => {
		useFakeTimeouts();
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const permalink = screen.getByRole('button', {
			name: 'Copy link to Overview',
			exact: true
		});
		// A role+name locator re-queries by accessible name, so it stops matching
		// the moment the name flips to the copied confirmation. Hold the element.
		const button = permalink.element();
		const canonicalUrl = new URL('#overview', window.location.href).href;
		const locationBefore = window.location.href;
		const scrollBefore = { x: window.scrollX, y: window.scrollY };

		fireClick(button);
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.href).toBe(locationBefore);
		expect({ x: window.scrollX, y: window.scrollY }).toEqual(scrollBefore);
		expect(writeText).toHaveBeenCalledWith(canonicalUrl);
		expect(button).toHaveAccessibleName('Link copied');
		// The glyph is an icon rather than the resting `#`: the port's Icon has no
		// `.astryx-icon` target class, so the `<svg>` is the observable mark.
		expect(button.querySelector('svg')).not.toBeNull();

		vi.advanceTimersByTime(20);
		await expect.element(politeRegion()).toHaveTextContent('Link copied');

		vi.advanceTimersByTime(1480);
		await Promise.resolve();
		await Promise.resolve();
		expect(button).toHaveAccessibleName('Copy link to Overview');
		expect(button).toHaveTextContent('#');
	});

	it('fails softly without navigation when clipboard writing rejects', async () => {
		writeText.mockRejectedValueOnce(new Error('clipboard denied'));
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const permalink = screen.getByRole('button', {
			name: 'Copy link to Overview',
			exact: true
		});
		const locationBefore = window.location.href;

		fireClick(permalink.element());
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.href).toBe(locationBefore);
		await expect.element(permalink).toHaveAccessibleName('Copy link to Overview');
		await expect.element(permalink).toHaveTextContent('#');
		expect(politeRegion()).toBeNull();
	});

	it('fails softly when the Clipboard API is unavailable', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: undefined
		});
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const permalink = screen.getByRole('button', {
			name: 'Copy link to Overview',
			exact: true
		});
		const locationBefore = window.location.href;

		fireClick(permalink.element());
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.href).toBe(locationBefore);
		await expect.element(permalink).toHaveAccessibleName('Copy link to Overview');
		await expect.element(permalink).toHaveTextContent('#');
	});

	it('ignores modified and non-primary pointer activation', async () => {
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const permalink = screen
			.getByRole('button', {
				name: 'Copy link to Overview',
				exact: true
			})
			.element();

		expect(fireClick(permalink, { button: 0, ctrlKey: true })).toBe(true);
		expect(fireClick(permalink, { button: 0, metaKey: true })).toBe(true);
		expect(fireClick(permalink, { button: 0, shiftKey: true })).toBe(true);
		expect(fireClick(permalink, { button: 0, altKey: true })).toBe(true);
		expect(fireClick(permalink, { button: 1 })).toBe(true);
		expect(writeText).not.toHaveBeenCalled();
	});

	it('copies on keyboard Enter and Space without navigation semantics', async () => {
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Keyboard target' }
		});
		const button = screen
			.getByRole('button', {
				name: 'Copy link to Keyboard target',
				exact: true
			})
			.element();
		const canonicalUrl = new URL('#keyboard-target', window.location.href).href;
		button.focus();

		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => {
			expect(writeText).toHaveBeenLastCalledWith(canonicalUrl);
		});
		expect(document.activeElement).toBe(button);
		expect(button).toHaveAttribute('type', 'button');
		expect(button).not.toHaveAttribute('href');

		writeText.mockClear();
		await userEvent.keyboard(' ');
		await vi.waitFor(() => {
			expect(writeText).toHaveBeenLastCalledWith(canonicalUrl);
		});
		expect(document.activeElement).toBe(button);
	});

	it('keeps one feedback timer across re-click and clears it on unmount', async () => {
		useFakeTimeouts();
		const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
		const screen = await render(Markdown, {
			props: { plugins: [headingLinks], children: '# Overview' }
		});
		const button = screen
			.getByRole('button', {
				name: 'Copy link to Overview',
				exact: true
			})
			.element();

		fireClick(button);
		await Promise.resolve();
		await Promise.resolve();
		vi.advanceTimersByTime(1000);
		fireClick(button);
		await Promise.resolve();
		await Promise.resolve();
		expect(clearTimer).toHaveBeenCalled();

		vi.advanceTimersByTime(600);
		expect(button).toHaveAccessibleName('Link copied');
		const clearsBeforeUnmount = clearTimer.mock.calls.length;
		screen.unmount();
		expect(clearTimer.mock.calls.length).toBeGreaterThan(clearsBeforeUnmount);
	});

	it('keeps authored heading links valid instead of nesting anchors', async () => {
		const screen = await render(Markdown, {
			props: {
				plugins: [headingLinks],
				children: '# Read the [guide](https://example.com/guide)'
			}
		});
		const heading = screen.getByRole('heading', { name: 'Read the guide', exact: true }).element();

		expect(heading.querySelectorAll('a')).toHaveLength(1);
		expect(heading.parentElement?.querySelectorAll(':scope > span > button')).toHaveLength(1);
		expect(screen.container.querySelector('a a')).toBeNull();
	});

	it('uses honest button semantics outside product link routing', async () => {
		const onLinkClick = vi.fn();
		const screen = await render(HeadingLinksLinkProvider, {
			props: { plugins: [headingLinks], onLinkClick, source: '# Overview' }
		});
		const permalink = screen
			.getByRole('button', {
				name: 'Copy link to Overview',
				exact: true
			})
			.element();

		expect(permalink.tagName).toBe('BUTTON');
		expect(permalink).not.toHaveAttribute('href');
		expect(permalink).not.toHaveAttribute('data-provider-link');
		fireClick(permalink);
		await Promise.resolve();
		await Promise.resolve();
		expect(onLinkClick).not.toHaveBeenCalled();
	});

	it('localizes the copy action and copied names through module keys', async () => {
		const screen = await render(HeadingLinksI18n, {
			props: { plugins: [headingLinks], source: '# Aperçu' }
		});
		const permalink = screen.getByRole('button', {
			name: 'Copier le lien vers Aperçu',
			exact: true
		});
		await expect.element(permalink).not.toHaveAttribute('href');
		const button = permalink.element();

		fireClick(button);
		await Promise.resolve();
		await Promise.resolve();
		expect(button).toHaveAccessibleName('Lien copié');
	});

	it('uses a stable section fallback when the label has no slug text', async () => {
		const screen = await render(Markdown, {
			props: {
				plugins: [headingLinks],
				sources: { cite: { title: 'Citation' } },
				children: '# [cite]'
			}
		});
		await expect.element(screen.getByRole('heading')).toHaveAttribute('id', 'section');
		await expect
			.element(screen.getByRole('button', { name: 'Copy link to section', exact: true }))
			.toHaveTextContent('#');
	});

	it('keeps namespaces inside copied URLs and sanitizes optional bases', async () => {
		const namespace = ['java', 'script:alert(1)'].join('');
		const routed = createMarkdownHeadingLinks({
			headingIdPrefix: namespace,
			permalinkBaseUrl: '/reader?document=42#stale'
		});
		const screen = await render(Markdown, {
			props: { plugins: [routed], children: '# Overview' }
		});
		const copyButton = screen.getByRole('button', {
			name: 'Copy link to Overview',
			exact: true
		});

		fireClick(copyButton.element());
		await Promise.resolve();
		await Promise.resolve();
		expect(writeText).toHaveBeenCalledWith(
			new URL(`/reader?document=42#${namespace}--overview`, window.location.href).href
		);
		expect(() => createMarkdownHeadingLinks({ permalinkBaseUrl: 'javascript:alert(1)' })).toThrow(
			/safe, parseable navigation URL/
		);
		expect(() => createMarkdownHeadingLinks({ permalinkBaseUrl: 'https://%' })).toThrow(
			/safe, parseable navigation URL/
		);
	});

	it('leaves permalink output to a custom heading renderer at every depth', async () => {
		const screen = await render(Markdown, {
			props: {
				plugins: [headingLinks],
				components: { heading: MarkdownCustomHeadingId },
				children: '> # Nested\n\n# Root'
			}
		});
		const customHeadings = Array.from(screen.container.querySelectorAll('[data-custom]'));

		expect(customHeadings.map((heading) => heading.id)).toEqual(['nested', 'root']);
		expect(screen.container.querySelector('button[aria-label*="Copy link"]')).toBeNull();
	});
});
