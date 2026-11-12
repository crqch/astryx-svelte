<!--
	Ported from upstream's `templates/blocks/components/CodeBlock/CodeBlockTerminal.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { CodeBlock, SyntaxTheme } from '@astryx-sv/core';
	import { githubDark } from '@astryx-sv/core/theme/syntax';

	const commands = `$ astryx init --features agents
✓ AI agent docs installed → .claude/CLAUDE.md
$ pnpm astryx component CodeBlock --dense`;
</script>

<SyntaxTheme theme={githubDark}>
	<CodeBlock code={commands} language="bash" hasCopyButton style="width: 100%; max-width: 480px" />
</SyntaxTheme>
