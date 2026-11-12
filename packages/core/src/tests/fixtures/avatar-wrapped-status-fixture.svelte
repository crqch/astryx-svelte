<script lang="ts" module>
	import type { AvatarProps } from '$lib/components/avatar/avatar.svelte';

	export interface AvatarWrappedStatusFixtureProps {
		/** The Avatar's own props. `status` is supplied by this fixture. */
		avatar?: Omit<AvatarProps, 'status'>;
		/** How the dot is wrapped, mirroring the P14 cases. */
		wrapper?: 'direct' | 'nested' | 'translated' | 'self-updating';
		/** The presence passed to a `direct`/`nested` wrapper. */
		presence?: string;
		/** The untranslated key passed to the `translated` wrapper. */
		label?: string;
		/** `false` unmounts the status subtree, as upstream's rerender does. */
		showStatus?: boolean;
	}
</script>

<script lang="ts">
	import Avatar from '$lib/components/avatar/avatar.svelte';
	import AvatarPresenceDot from './avatar-presence-dot.svelte';
	import AvatarTranslatedDot from './avatar-translated-dot.svelte';
	import AvatarSelfUpdatingDot from './avatar-self-updating-dot.svelte';

	/**
	 * `<Avatar status={<ConsumerWrapper />} />` for the P14 cases.
	 *
	 * Upstream writes the consumer's wrapper inline. A Svelte `status` snippet
	 * can only be authored in a template, so each wrapper shape — direct, one
	 * element deep, translated, or holding its own state — is selected here
	 * rather than constructed by the test.
	 */
	const {
		avatar = {},
		wrapper = 'direct',
		presence = 'Online',
		label = 'busy',
		showStatus = true
	}: AvatarWrappedStatusFixtureProps = $props();

	let selfUpdating = $state<{ setPresence(next: string): void } | undefined>(undefined);

	/** The probe handle for the `self-updating` wrapper. */
	export function setPresence(next: string): void {
		selfUpdating?.setPresence(next);
	}
</script>

{#snippet statusContent()}
	{#if wrapper === 'nested'}
		<span>
			<AvatarPresenceDot {presence} />
		</span>
	{:else if wrapper === 'translated'}
		<AvatarTranslatedDot {label} />
	{:else if wrapper === 'self-updating'}
		<AvatarSelfUpdatingDot bind:this={selfUpdating} />
	{:else}
		<AvatarPresenceDot {presence} />
	{/if}
{/snippet}

<Avatar {...avatar} status={showStatus ? statusContent : undefined} />
