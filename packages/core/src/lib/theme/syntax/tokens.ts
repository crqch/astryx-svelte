/**
 * Ported from Astryx's `theme/syntax/tokens.ts`.
 *
 * Code syntax highlighting tokens, used by `CodeBlock` and any consumer that
 * renders highlighted source.
 *
 * Default values reference the theme's named palette via `var()`, so syntax
 * colours adapt to any theme's colour system automatically. A theme can also set
 * an explicit syntax theme via `defineTheme({ syntax: dracula })`.
 *
 * The 14-token architecture was validated upstream against 11 community code
 * themes; all of them map cleanly onto these 14 slots.
 */
export const syntaxTokenDefaults = {
	// keyword -> accent text (control flow: if, return, const)
	'--color-syntax-keyword': 'var(--color-text-accent)',
	// string -> green text (string literals)
	'--color-syntax-string': 'var(--color-text-green)',
	// comment -> secondary text (passive annotations)
	'--color-syntax-comment': 'var(--color-text-secondary)',
	// number -> orange text (numeric literals)
	'--color-syntax-number': 'var(--color-text-orange)',
	// function -> blue text (function/method names)
	'--color-syntax-function': 'var(--color-text-blue)',
	// type -> purple text (types, interfaces, classes)
	'--color-syntax-type': 'var(--color-text-purple)',
	// variable -> primary text (neutral identifiers)
	'--color-syntax-variable': 'var(--color-text-primary)',
	// operator -> cyan text (=, +, =>, &&)
	'--color-syntax-operator': 'var(--color-text-cyan)',
	// constant -> orange text (true, false, null)
	'--color-syntax-constant': 'var(--color-text-orange)',
	// tag -> red text (HTML/JSX tags)
	'--color-syntax-tag': 'var(--color-text-red)',
	// attribute -> teal text (HTML/JSX attributes)
	'--color-syntax-attribute': 'var(--color-text-teal)',
	// property -> cyan text (object properties)
	'--color-syntax-property': 'var(--color-text-cyan)',
	// punctuation -> secondary text (brackets, semicolons). Not disabled text:
	// disabled grey is calibrated to fail AA on purpose, and punctuation in a
	// code sample is normal, always-active text.
	'--color-syntax-punctuation': 'var(--color-text-secondary)',
	// background -> muted surface
	'--color-syntax-background': 'var(--color-background-muted)',
	// Diff rows: whole-row tints behind unchanged syntax colours, derived from
	// the semantic success/error muted tokens at 25% strength.
	'--color-syntax-added': 'color-mix(in srgb, var(--color-success-muted) 25%, transparent)',
	'--color-syntax-removed': 'color-mix(in srgb, var(--color-error-muted) 25%, transparent)',
	'--color-syntax-diff-header': 'var(--color-background-muted)',
	'--color-syntax-added-marker': 'var(--color-text-green)',
	'--color-syntax-removed-marker': 'var(--color-text-red)'
} as const;

export type SyntaxTokenName = keyof typeof syntaxTokenDefaults;

/** The five diff row slots: optional in a syntax theme, defaulted when unset. */
export const DIFF_SYNTAX_TOKEN_NAMES = [
	'--color-syntax-added',
	'--color-syntax-removed',
	'--color-syntax-diff-header',
	'--color-syntax-added-marker',
	'--color-syntax-removed-marker'
] as const satisfies ReadonlyArray<SyntaxTokenName>;
