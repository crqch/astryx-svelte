import type { OutlineItem } from '../outline/types.js';
import { slugify, uniqueSlug, type BlockNode } from './parser.js';
import { markdownInlineText, projectMarkdownHeadingLinks } from './plugins/heading-links.js';
import type { PreparedMarkdownPlugins } from './plugins/protocol.js';

/**
 * Ported from Astryx's `Markdown/headingProjection.ts`.
 *
 * The released (no-plugin) output gives ids to **root** headings only, because
 * `parseOutlineFromMarkdown` lists root headings only and an outline item's id
 * promises to resolve to the heading it names. Installing
 * `createMarkdownHeadingLinks()` deliberately widens the allocator to every
 * depth, so nested headings join the same depth-first numbering sequence; that
 * is the feature, not an implementation detail.
 */

type Heading = Extract<BlockNode, { type: 'heading' }>;

export interface MarkdownHeadingProjection {
	/** Headings with generated ids. */
	readonly ids: ReadonlyMap<Heading, string>;
	/** Plain-text labels for generated headings. */
	readonly labels: ReadonlyMap<Heading, string>;
	/** Canonical permalink URL copied by the first-party module, absent by default. */
	readonly permalinkUrls: ReadonlyMap<Heading, string>;
	/** Root headings only, preserving the released Outline scope. */
	readonly outline: ReadonlyArray<OutlineItem>;
}

/** Project ids once after every Markdown transform has run. */
export function projectMarkdownHeadings(
	blocks: ReadonlyArray<BlockNode>,
	preparedPlugins?: PreparedMarkdownPlugins
): MarkdownHeadingProjection {
	const rootHeadings = blocks.filter((node): node is Heading => node.type === 'heading');
	const headingLinks = projectMarkdownHeadingLinks(blocks, preparedPlugins);

	if (headingLinks != null) {
		return {
			...headingLinks,
			outline: rootHeadings.map((heading) => {
				const id = headingLinks.ids.get(heading);
				const label = headingLinks.labels.get(heading);
				if (id == null || label == null) {
					throw new Error('Heading-links projection omitted a root heading');
				}
				return { id, label, level: heading.level };
			})
		};
	}

	const ids = new Map<Heading, string>();
	const labels = new Map<Heading, string>();
	const counts = new Map<string, number>();
	const outline = rootHeadings.map((heading) => {
		const label = markdownInlineText(heading.children).trim();
		const id = uniqueSlug(slugify(label), counts);
		ids.set(heading, id);
		labels.set(heading, label);
		return { id, label, level: heading.level };
	});

	return { ids, labels, permalinkUrls: new Map(), outline };
}
