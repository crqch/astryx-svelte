import { warnOnce } from '../../../utils/dev-warning.js';

/**
 * The slice of Astryx's `Markdown/plugins/protocol.ts` that the first-party
 * heading-links module needs.
 *
 * Upstream's registry is the public, generic plugin protocol — syntax
 * contributions, AST transforms, and typed extension renderers. None of that
 * machinery exists in this port's parser, and inventing a transform pipeline
 * just to run an identity transform would be a fake capability rather than a
 * port. What the heading-links feature *does* rely on is the opaque entry
 * envelope: a frozen, branded definition, validated before use, with
 * `Symbol.for()` keys so one entry survives a duplicate copy of the package
 * (the Markdown/Outline split SSR test's whole point).
 *
 * So this module ports the envelope, not the capabilities: `plugins` accepts
 * only entries this module can validate, and the one first-party factory that
 * mints them is `createMarkdownHeadingLinks()`. A later batch porting
 * `createMarkdownPlugin()` extends this file rather than replacing it.
 */

const MARKDOWN_PLUGIN_BRAND = '@astryxdesign/core/MarkdownPluginEntry';
const markdownPluginDefinition = Symbol.for(MARKDOWN_PLUGIN_BRAND);

/**
 * Opaque, covariant entry safe to store in heterogeneous plugin lists.
 *
 * The phantom member is type-only, exactly as upstream's: it is never present
 * at runtime, and its shared key lets an entry type from a swizzled copy match
 * this package's.
 */
export interface MarkdownPluginEntry<Node = never> {
	readonly name: string;
	readonly apiVersion: 1;
	/** A type-only member that carries the node type; it is never present. */
	readonly '@astryxdesign/core/markdown-plugin-node/v1': Node;
}

/** What a plugin declares, without the definition itself. */
export interface MarkdownPluginDefinition {
	readonly name: string;
	readonly apiVersion: 1;
}

interface MarkdownPluginBrand {
	readonly kind: typeof MARKDOWN_PLUGIN_BRAND;
	readonly apiVersion: 1;
	readonly definition: MarkdownPluginDefinition;
}

interface InternalMarkdownPluginEntry extends MarkdownPluginEntry {
	readonly [markdownPluginDefinition]: MarkdownPluginBrand;
}

/**
 * The prepared registry Markdown and Outline thread through their projections.
 * Upstream carries parser/renderer tables here too; this port's only consumer
 * walks `entries` for module-owned configuration.
 */
export interface PreparedMarkdownPlugins {
	readonly entries: ReadonlyArray<MarkdownPluginEntry>;
}

function fail(message: string): never {
	throw new Error(`Markdown plugin: ${message}`);
}

function deepFreezeConfig<T>(value: T, seen: Set<object> = new Set()): T {
	if (value != null && typeof value === 'object' && !seen.has(value)) {
		seen.add(value);
		for (const nested of Object.values(value)) {
			deepFreezeConfig(nested, seen);
		}
		Object.freeze(value);
	}
	return value;
}

/**
 * @internal Validates an opaque entry and returns its frozen definition for
 * first-party modules that carry their own `Symbol.for`-branded portable data.
 */
export function getMarkdownPluginDefinition(
	publicEntry: MarkdownPluginEntry
): MarkdownPluginDefinition {
	if (
		publicEntry == null ||
		typeof publicEntry !== 'object' ||
		Object.getPrototypeOf(publicEntry) !== Object.prototype
	) {
		fail('entries must come from a compatible plugin factory');
	}
	const entry = publicEntry as Partial<InternalMarkdownPluginEntry>;
	const brand = entry[markdownPluginDefinition];
	const definition = brand?.definition;
	if (
		Reflect.ownKeys(entry).length !== 3 ||
		typeof entry.name !== 'string' ||
		entry.apiVersion !== 1 ||
		!Object.isFrozen(entry) ||
		brand == null ||
		typeof brand !== 'object' ||
		Object.getPrototypeOf(brand) !== Object.prototype ||
		Reflect.ownKeys(brand).length !== 3 ||
		!Object.isFrozen(brand) ||
		brand.kind !== MARKDOWN_PLUGIN_BRAND ||
		brand.apiVersion !== 1 ||
		definition == null ||
		typeof definition !== 'object' ||
		!Object.isFrozen(definition) ||
		definition.name !== entry.name ||
		definition.apiVersion !== entry.apiVersion
	) {
		fail('entries must come from a compatible plugin factory');
	}
	return definition;
}

/**
 * @internal Mints the frozen envelope around a definition. The definition is
 * deep-frozen, so a module that adds its own portable config must attach it
 * with `Object.defineProperty` before calling this — the heading-links factory
 * does exactly that.
 */
export function createMarkdownPluginEntry(
	definition: MarkdownPluginDefinition
): MarkdownPluginEntry {
	if (definition.name.trim() === '') {
		fail('name must be a non-empty string');
	}
	if (definition.apiVersion !== 1) {
		fail(`"${definition.name}" uses unsupported apiVersion`);
	}

	const frozenDefinition = deepFreezeConfig(definition);
	const brand: MarkdownPluginBrand = Object.freeze({
		kind: MARKDOWN_PLUGIN_BRAND,
		apiVersion: 1 as const,
		definition: frozenDefinition
	});
	return Object.freeze({
		name: frozenDefinition.name,
		apiVersion: 1 as const,
		[markdownPluginDefinition]: brand
	}) as unknown as MarkdownPluginEntry;
}

/** Validate every entry once, before Markdown or Outline projects headings. */
export function prepareMarkdownPlugins(
	plugins: ReadonlyArray<MarkdownPluginEntry>
): PreparedMarkdownPlugins | undefined {
	if (plugins.length === 0) {
		return undefined;
	}

	const names = new Set<string>();
	for (const publicEntry of plugins) {
		const definition = getMarkdownPluginDefinition(publicEntry);
		if (names.has(definition.name)) {
			fail(`duplicate name "${definition.name}"`);
		}
		names.add(definition.name);
	}

	return { entries: plugins };
}

/**
 * Report a configuration failure without surfacing it to the reader. Matches
 * upstream's message and once-per-key deduplication.
 */
export function reportMarkdownPluginFailure(
	pluginName: string,
	phase: 'syntax' | 'transform' | 'render',
	error: unknown
): void {
	warnOnce(
		`markdown-plugin:${pluginName}:${phase}`,
		'Markdown',
		`plugin "${pluginName}" failed in ${phase}; rendered readable fallback.`,
		error
	);
}
