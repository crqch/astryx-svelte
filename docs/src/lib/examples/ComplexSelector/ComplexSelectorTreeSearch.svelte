<!--
	Ported from upstream's `templates/blocks/components/ComplexSelector/ComplexSelectorTreeSearch.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { ComplexSelector } from '@astryx-sv/core';
	import DestinationSearch from './DestinationSearch.svelte';

	interface DestinationNode {
		id: string;
		label: string;
		path: string;
		children?: DestinationNode[];
	}

	interface Destination {
		id: string;
		label: string;
		path: string;
	}

	const destinationTree: DestinationNode[] = [
		{
			id: 'workspace',
			label: 'Workspace',
			path: '/Workspace',
			children: [
				{
					id: 'research',
					label: 'Research',
					path: '/Workspace/Research',
					children: [
						{
							id: 'field-notes',
							label: 'Field notes',
							path: '/Workspace/Research/Field notes'
						},
						{
							id: 'interviews',
							label: 'Interviews',
							path: '/Workspace/Research/Interviews'
						}
					]
				},
				{
					id: 'roadmap',
					label: 'Roadmap',
					path: '/Workspace/Roadmap'
				}
			]
		},
		{
			id: 'teams',
			label: 'Teams',
			path: '/Teams',
			children: [
				{
					id: 'design-systems',
					label: 'Design systems',
					path: '/Teams/Design systems',
					children: [
						{
							id: 'accessibility',
							label: 'Accessibility',
							path: '/Teams/Design systems/Accessibility'
						}
					]
				}
			]
		}
	];

	let value = $state<Destination>({
		id: 'accessibility',
		label: 'Accessibility',
		path: '/Teams/Design systems/Accessibility'
	});
</script>

{#snippet selectorContent(
	selectedValue: Destination,
	onChange: (next: Destination) => void,
	close: () => void
)}
	<DestinationSearch tree={destinationTree} value={selectedValue} {onChange} {close} />
{/snippet}

<ComplexSelector
	label="Destination"
	description="Search and browse nested folders."
	{value}
	onChange={(next) => (value = next)}
	triggerLabel={value.path}
	width={360}
	children={selectorContent}
/>
