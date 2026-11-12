import { sanitizeUrl } from '../markdown-render-plan.js';
import type { BlockNode, InlineNode } from '../parser.js';
import {
	createMarkdownPluginEntry,
	getMarkdownPluginDefinition,
	type MarkdownPluginEntry,
	type PreparedMarkdownPlugins
} from './protocol.js';

/**
 * Ported from Astryx's `Markdown/plugins/headingLinks.ts`.
 *
 * The plugin is opt-in: Markdown's default output is unchanged, and installing
 * the entry gives every built-in h1–h6 a stable identity plus an inline
 * trailing copy button. `MarkdownHeadingLinksProjection` is the module-owned
 * identity map, shared by Markdown and the Outline helpers so a fragment in an
 * outline resolves to the heading the document renders.
 */

const PLUGIN_NAME = 'heading-links';
const PORTABLE_CONFIG_KIND = '@astryxdesign/core/MarkdownHeadingLinksConfig';
const portableConfigKey = Symbol.for(PORTABLE_CONFIG_KIND);

type Heading = Extract<BlockNode, { type: 'heading' }>;

export interface MarkdownHeadingLinksOptions {
	/**
	 * Stable caller-owned namespace for generated heading ids. Use the same
	 * value for the Markdown root `id` when each document needs its own fragment
	 * namespace. Omit it to keep unprefixed fragments for a single document.
	 */
	readonly headingIdPrefix?: string;
	/**
	 * Optional caller-owned URL before the generated `#fragment`. Omit it to copy
	 * an absolute URL for the current document. Any existing fragment is replaced.
	 */
	readonly permalinkBaseUrl?: string;
}

interface PortableMarkdownHeadingLinksConfig {
	readonly kind: typeof PORTABLE_CONFIG_KIND;
	readonly apiVersion: 1;
	readonly headingIdPrefix?: string;
	readonly permalinkBaseUrl: string;
}

/** @internal Module-owned projection consumed by Markdown and Outline. */
export interface MarkdownHeadingLinksProjection {
	readonly ids: ReadonlyMap<Heading, string>;
	readonly labels: ReadonlyMap<Heading, string>;
	readonly permalinkUrls: ReadonlyMap<Heading, string>;
}

function fail(message: string): never {
	throw new TypeError(`Markdown heading links: ${message}`);
}

// Built at runtime, not written as a literal: for targets without property
// escapes, or when no browserslist is set, Babel's
// transform-unicode-property-regex rewrites a `\p{…}` literal, and a copy of
// Babel bundled by a framework may lack the Unicode data it needs, so a source
// build fails with "Unknown property". A literal is safe once that data ships.
const NON_SLUG_CHARACTERS = new RegExp('[^\\p{Letter}\\p{Number}]+', 'gu');

/**
 * @internal Heading-links slug. Unlike the parser's ASCII `slugify`, this keeps
 * every Unicode letter and number, because a permalink is a stable public
 * fragment rather than a legacy outline id.
 */
export function headingSlug(value: string): string {
	return value
		.normalize('NFKC')
		.trim()
		.toLowerCase()
		.replace(/['"]/gu, '')
		.replace(NON_SLUG_CHARACTERS, '-')
		.replace(/^-+|-+$/gu, '');
}

/**
 * Disambiguate repeated slugs, reserving the candidate ids a later heading may
 * collide with. `Foo`, `Foo`, `Foo-1` therefore become `foo`, `foo-1`,
 * `foo-1-1` rather than reusing `foo-1`.
 * @internal
 */
export function uniqueHeadingSlug(baseSlug: string, counts: Map<string, number>): string {
	const fallbackSlug = baseSlug || 'section';
	let count = counts.get(fallbackSlug) ?? 0;
	let candidate = count === 0 ? fallbackSlug : `${fallbackSlug}-${count}`;
	while (counts.has(candidate)) {
		count++;
		candidate = `${fallbackSlug}-${count}`;
	}
	counts.set(fallbackSlug, count + 1);
	counts.set(candidate, 0);
	return candidate;
}

function createPortableConfig(
	headingIdPrefix: string | undefined,
	permalinkBaseUrl: string
): PortableMarkdownHeadingLinksConfig {
	return Object.freeze({
		kind: PORTABLE_CONFIG_KIND,
		apiVersion: 1 as const,
		headingIdPrefix,
		permalinkBaseUrl
	});
}

const PERMALINK_VALIDATION_BASE = 'https://astryx.invalid/';

function isParsablePermalinkBaseUrl(url: string): boolean {
	try {
		new URL(url, PERMALINK_VALIDATION_BASE);
		return true;
	} catch {
		return false;
	}
}

const DATA_SCHEME_PATTERN = /^data:/i;

/**
 * A navigation URL that does not come from parsed source, checked with the
 * port's Markdown URL rule plus the parser's blanket `data:` rejection. The
 * port's render-time `sanitizeUrl` keeps `data:` image URLs, so the extra test
 * is needed here rather than inherited.
 */
function sanitizeMarkdownLinkUrl(url: string): string | null {
	const normalized = sanitizeUrl(url);
	return normalized === null || normalized === '' || DATA_SCHEME_PATTERN.test(normalized)
		? null
		: normalized;
}

function readPortableConfig(
	entry: MarkdownPluginEntry
): PortableMarkdownHeadingLinksConfig | undefined {
	const definition = getMarkdownPluginDefinition(entry);
	if (definition.name !== PLUGIN_NAME) {
		return undefined;
	}

	const config = (definition as unknown as Record<PropertyKey, unknown>)[portableConfigKey] as
		| Partial<PortableMarkdownHeadingLinksConfig>
		| undefined;
	if (
		config == null ||
		typeof config !== 'object' ||
		Object.getPrototypeOf(config) !== Object.prototype ||
		Reflect.ownKeys(config).length !== 4 ||
		!Object.isFrozen(config) ||
		config.kind !== PORTABLE_CONFIG_KIND ||
		config.apiVersion !== 1 ||
		(config.headingIdPrefix !== undefined && typeof config.headingIdPrefix !== 'string') ||
		typeof config.permalinkBaseUrl !== 'string' ||
		config.permalinkBaseUrl.includes('#') ||
		!isParsablePermalinkBaseUrl(config.permalinkBaseUrl) ||
		(config.permalinkBaseUrl !== '' &&
			sanitizeMarkdownLinkUrl(config.permalinkBaseUrl) !== config.permalinkBaseUrl)
	) {
		return undefined;
	}
	return config as PortableMarkdownHeadingLinksConfig;
}

/**
 * Create the opt-in plugin that gives every rendered h1–h6 a stable identity
 * and an inline sibling copy button for each built-in heading. The entry is safe
 * to share between Markdown and Markdown-derived Outline, including compatible
 * copies of this package.
 */
export function createMarkdownHeadingLinks(
	options: MarkdownHeadingLinksOptions = {}
): MarkdownPluginEntry<never> {
	if (options.headingIdPrefix !== undefined && typeof options.headingIdPrefix !== 'string') {
		fail('headingIdPrefix must be a string');
	}
	if (options.permalinkBaseUrl !== undefined && typeof options.permalinkBaseUrl !== 'string') {
		fail('permalinkBaseUrl must be a string');
	}

	const rawBaseUrl = options.permalinkBaseUrl ?? '';
	const sanitizedBaseUrl = rawBaseUrl === '' ? '' : sanitizeMarkdownLinkUrl(rawBaseUrl);
	if (sanitizedBaseUrl == null || !isParsablePermalinkBaseUrl(sanitizedBaseUrl)) {
		fail('permalinkBaseUrl must be a safe, parseable navigation URL');
	}
	const permalinkBaseUrl = sanitizedBaseUrl.replace(/#.*$/u, '');

	const definition = {
		name: PLUGIN_NAME,
		apiVersion: 1 as const
	};
	Object.defineProperty(definition, portableConfigKey, {
		configurable: false,
		enumerable: false,
		value: createPortableConfig(options.headingIdPrefix, permalinkBaseUrl),
		writable: false
	});
	return createMarkdownPluginEntry(definition);
}

function getHeadingLinksConfig(
	plugins: PreparedMarkdownPlugins | undefined
): PortableMarkdownHeadingLinksConfig | undefined {
	if (plugins == null) {
		return undefined;
	}
	for (const entry of plugins.entries) {
		const config = readPortableConfig(entry);
		if (config != null) {
			return config;
		}
	}
	return undefined;
}

/**
 * @internal Text content of an inline node list, matching upstream's
 * `markdownAstText`: formatting unwraps, images contribute their alt text, and
 * citations and hard breaks contribute nothing.
 */
export function markdownInlineText(nodes: ReadonlyArray<InlineNode>): string {
	let text = '';
	for (const node of nodes) {
		switch (node.type) {
			case 'text':
			case 'code':
				text += node.content;
				break;
			case 'bold':
			case 'italic':
			case 'strikethrough':
			case 'link':
				text += markdownInlineText(node.children);
				break;
			case 'image':
				text += node.alt;
				break;
			case 'citation':
			case 'break':
				break;
		}
	}
	return text;
}

/** Depth-first heading order: blockquotes and list items can nest headings. */
function visitHeadings(nodes: ReadonlyArray<BlockNode>, visit: (heading: Heading) => void): void {
	for (const node of nodes) {
		switch (node.type) {
			case 'heading':
				visit(node);
				break;
			case 'blockquote':
				visitHeadings(node.children, visit);
				break;
			case 'list':
				for (const item of node.items) {
					visitHeadings(item.children, visit);
				}
				break;
			default:
				break;
		}
	}
}

/** @internal Project the module's all-depth identity after transforms run. */
export function projectMarkdownHeadingLinks(
	root: ReadonlyArray<BlockNode>,
	preparedPlugins?: PreparedMarkdownPlugins
): MarkdownHeadingLinksProjection | undefined {
	const config = getHeadingLinksConfig(preparedPlugins);
	if (config == null) {
		return undefined;
	}

	const ids = new Map<Heading, string>();
	const labels = new Map<Heading, string>();
	const permalinkUrls = new Map<Heading, string>();
	const counts = new Map<string, number>();

	visitHeadings(root, (heading) => {
		const label = markdownInlineText(heading.children).trim();
		const slug = uniqueHeadingSlug(headingSlug(label), counts);
		const id =
			config.headingIdPrefix != null && config.headingIdPrefix !== ''
				? `${config.headingIdPrefix}--${slug}`
				: slug;
		ids.set(heading, id);
		labels.set(heading, label);
		permalinkUrls.set(heading, `${config.permalinkBaseUrl}#${id}`);
	});

	return { ids, labels, permalinkUrls };
}
