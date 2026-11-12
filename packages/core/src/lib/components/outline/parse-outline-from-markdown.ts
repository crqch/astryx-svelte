import { projectMarkdownHeadings } from '../markdown/heading-projection.js';
import { parseMarkdown } from '../markdown/parser.js';
import type { MarkdownPluginEntry } from '../markdown/plugins/protocol.js';
import { prepareMarkdownPlugins } from '../markdown/plugins/protocol.js';
import type { OutlineItem } from './types.js';

/**
 * Extract heading items from a Markdown string, ported from Astryx's
 * `Outline/parseOutlineFromMarkdown.ts`.
 *
 * Deferred with `Outline` in batch 9 — it needs the markdown parser, which
 * landed with `Markdown` in batch 11. Pure, so this is a transcription.
 *
 * Both Markdown and this helper run `projectMarkdownHeadings`, so the ids an
 * outline lists are the ids the document renders. Without plugins that means
 * root headings; passing the same `createMarkdownHeadingLinks()` entry widens
 * the allocator to every depth on both sides.
 */

/**
 * Parse options for {@link parseOutlineFromMarkdown}.
 *
 * Upstream also accepts `isFinal`, which only affects plugin transforms while a
 * stream is incomplete. This port has no transform pipeline, so there is no
 * unfinished-transform state to settle and the option has nothing to change.
 */
export interface ParseOutlineFromMarkdownOptions {
	/** Entries created by `createMarkdownHeadingLinks()` (or another factory). */
	readonly plugins?: ReadonlyArray<MarkdownPluginEntry>;
}

/**
 * Extract heading items from a Markdown string.
 *
 * Uses Markdown's parser so fenced code blocks, tables, lists, and inline
 * formatting are interpreted consistently with rendered Markdown output.
 */
export function parseOutlineFromMarkdown(
	markdown: string,
	options?: ParseOutlineFromMarkdownOptions
): OutlineItem[] {
	const plugins = options?.plugins;
	let prepared: ReturnType<typeof prepareMarkdownPlugins>;
	try {
		prepared = plugins == null ? undefined : prepareMarkdownPlugins(plugins);
	} catch {
		// A malformed entry must not take the caller's outline down with it.
		// Markdown renders the same source with its ordinary ids, so the outline
		// keeps matching it by falling back the same way.
		prepared = undefined;
	}
	return [...projectMarkdownHeadings(parseMarkdown(markdown), prepared).outline];
}
