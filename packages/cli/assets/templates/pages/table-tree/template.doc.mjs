/**
 * @file Tree Table page template. Transcribed from upstream's
 * `assets/templates/pages/table-tree/page.tsx`.
 */

/** @type {import('@astryx-svelte/cli/authoring').TemplateDoc} */
export const doc = {
	type: 'page',
	name: 'Tree Table',
	displayName: 'Tree Table',
	description:
		'Hierarchical table where every parent row rolls up from its children — a code repository whose folders show the newest commit beneath them, beside a detail sidebar and a rendered README. Columns resize, siblings sort within their own level, arrow keys walk the rows, and search prunes the tree to matching branches.',
	isReady: true,
	category: 'Table - Tree/Hierarchical List'
};
