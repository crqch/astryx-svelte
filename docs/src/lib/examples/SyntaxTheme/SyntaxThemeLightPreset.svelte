<!--
	Ported from upstream's `templates/blocks/components/SyntaxTheme/SyntaxThemeLightPreset.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { CodeBlock, SyntaxTheme } from '@astryx-sv/core';
	import { githubLight } from '@astryx-sv/core/theme/syntax';

	const code = `const status = response.ok ? 'success' : 'error';
console.log({status});`;
</script>

<SyntaxTheme theme={githubLight}>
	<CodeBlock {code} language="tsx" title="GitHub Light preset" />
</SyntaxTheme>
