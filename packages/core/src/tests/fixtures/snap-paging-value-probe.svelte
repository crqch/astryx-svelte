<script lang="ts">
	import { useSnapPaging } from '$lib/components/snap-paging/index.js';

	let { pages = 'view' as 'view' | 'item' } = $props();

	const value = useSnapPaging({
		get pages() {
			return pages;
		}
	});

	export const getValue = () => value;
</script>
