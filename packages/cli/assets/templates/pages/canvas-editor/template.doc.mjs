/**
 * @file Canvas Editor page template. Transcribed from upstream's
 * `assets/templates/pages/canvas-editor/page.tsx`.
 */

/** @type {import('@astryx-sv/cli/authoring').TemplateDoc} */
export const doc = {
	type: 'page',
	name: 'Canvas Editor',
	displayName: 'Canvas Editor',
	description:
		'Layered artboard workspace: document tabs over a layer rail, a fixed-size frame you zoom on a muted backdrop, and an inspector of position, type, and filter fields that retargets to the selected layer. Objects hold a coordinate rather than reflowing, so moving one never moves another.',
	isReady: true,
	category: 'Tools - Canvas Editor'
};
