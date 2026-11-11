/**
 * @file Inbox Table page template. Transcribed from upstream's
 * `assets/templates/pages/table-inbox/page.tsx`.
 */

/** @type {import('@astryx-svelte/cli/authoring').TemplateDoc} */
export const doc = {
	type: 'page',
	name: 'Inbox Table',
	displayName: 'Inbox Table',
	description:
		'Two-pane message queue: the table indexes a reading pane rather than being the destination, with a divider you drag to resize. Rows stack when the table narrows, not the window; threads read as collapsible messages; replying opens a composer that leaves the list live.',
	isReady: true,
	category: 'Table - Split Pane'
};
