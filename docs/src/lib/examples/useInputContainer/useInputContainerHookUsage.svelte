<!--
	Ported from upstream's `templates/blocks/components/Hooks/useInputContainerHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's `Icon icon={MagnifyingGlassIcon}` is the registry's built-in
	`search` glyph. Its StyleX `field`/`input` styles become a scoped `<style>`
	block — a `.svelte` file may not import StyleX — with the same declarations
	and the same token variables.
-->
<script lang="ts">
	import { Icon, InputClearButton, useInputContainer } from '@astryx-svelte/core';

	let container = $state<HTMLElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let query = $state('');

	const inputContainer = useInputContainer(() => ({ container, input }));
</script>

<div bind:this={container} {...inputContainer} class="field">
	<Icon icon="search" color="secondary" />
	<input
		bind:this={input}
		type="text"
		aria-label="Search"
		placeholder="Search"
		value={query}
		oninput={(event) => (query = event.currentTarget.value)}
		class="input"
	/>
	{#if query !== ''}
		<InputClearButton
			label="Clear search"
			onclick={() => {
				query = '';
				input?.focus();
			}}
		/>
	{/if}
</div>

<style>
	.field {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		width: 320px;
		min-height: 40px;
		padding-inline: var(--spacing-3);
		border: 1px solid var(--color-border-emphasized);
		border-radius: var(--radius-element);
		cursor: text;
		outline: none;
	}

	.field:has(> input:focus-visible) {
		outline-width: var(--focus-outline-width);
		outline-style: var(--focus-outline-style);
		outline-color: var(--focus-outline-color);
		outline-offset: var(--focus-outline-offset);
	}

	.input {
		flex-grow: 1;
		min-width: 0;
		border: none;
		outline: none;
		background-color: transparent;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
	}
</style>
