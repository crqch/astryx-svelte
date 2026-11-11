/**
 * @file Checkout Wizard page template. Transcribed from upstream's
 * `assets/templates/pages/checkout-wizard/page.tsx`.
 */

/** @type {import('@astryx-svelte/cli/authoring').TemplateDoc} */
export const doc = {
	type: 'page',
	name: 'Checkout Wizard',
	displayName: 'Checkout Wizard',
	description:
		'Multi-step checkout, cart, order, and payment wizard with a running summary that recalculates as answers change. It adapts to its host width, renders the summary first on narrow surfaces, validates every forward path, and completes locally without sending payment.',
	isReady: true,
	category: 'Form - Checkout'
};
