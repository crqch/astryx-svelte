<script lang="ts" module>
	export interface AvatarTranslatedDotProps {
		/** The untranslated key the dot maps to a label. */
		label: string;
	}
</script>

<script lang="ts">
	import AvatarStatusDot from '$lib/components/avatar/avatar-status-dot.svelte';

	/**
	 * A consumer wrapper whose own `label` prop is not the string the dot
	 * renders with, so introspection and the dot's report disagree.
	 */
	const { label }: AvatarTranslatedDotProps = $props();
</script>

<AvatarStatusDot label={label === 'busy' ? 'Busy' : label} />
