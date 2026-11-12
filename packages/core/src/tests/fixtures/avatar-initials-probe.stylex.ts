import * as stylex from '@stylexjs/stylex';
// Relative, not `$lib/…`: StyleX's Babel plugin resolves this specifier itself
// (`unstable_moduleResolution`) to derive the token variable names, and it knows
// nothing of SvelteKit's alias.
import { colorVars } from '../../lib/styles/tokens.stylex.js';

/**
 * The local StyleX probes upstream's `Avatar.test.tsx` declares inline.
 *
 * StyleX may only be imported from a `.ts`/`.stylex.ts` module — the bundler
 * plugin Babel-parses anything importing `@stylexjs/stylex` — so the probe lives
 * beside the suite rather than inside it (the `avatar-status-dot-probe.stylex.ts`
 * precedent).
 *
 * - `tint` — the neutral plate the fallback paints.
 * - `ink` — the primary text plus the forced-colors `currentColor` override a
 *   lone fallback carries.
 * - `groupedInk` — the primary text alone: a grouped face skips the lone
 *   fallback's forced-colors arm, so the fallback's own colour is what shows.
 */
export const probe = stylex.create({
	tint: { backgroundColor: colorVars['--color-neutral'] },
	ink: {
		color: {
			default: colorVars['--color-text-primary'],
			'@media (forced-colors: active)': 'currentColor'
		}
	},
	groupedInk: { color: colorVars['--color-text-primary'] }
});

/**
 * The atomic classes a probe style resolves to.
 *
 * Dev mode prepends a per-file `File__style.key` debug class that legitimately
 * differs between the probe and the component, so it is filtered out — exactly
 * as upstream's `.filter(cls => !cls.includes('__'))` does.
 */
export function atomicClasses(style: unknown): string[] {
	return (stylex.props(style as never).className ?? '')
		.split(' ')
		.filter((cls) => cls !== '' && !cls.includes('__'));
}
