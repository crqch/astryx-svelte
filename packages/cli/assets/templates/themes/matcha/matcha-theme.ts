/**
 * Matcha Theme — ported from Astryx's `packages/themes/matcha/src/matchaTheme.ts`.
 *
 * An earthy green theme inspired by matcha tea and natural botanicals.
 * Core palette: #3E481D, #707E46, #C0CBA9, #F0F0E0, #FFFFFF
 * Uses Playwrite US Trad for headings and DM Sans for body text.
 *
 * Transcribed verbatim but for two things, both of which every theme package
 * here shares:
 *
 *   - the `@astryxdesign/core/theme` barrel import becomes core's deep `dist/`
 *     imports, because the barrel re-exports `theme.svelte` and this file is on
 *     the theme build's plain-Node import path;
 *   - upstream's `icons: matchaIconRegistry` is dropped. The registry is 28
 *     `lucide-react` elements and the Svelte counterpart needs `@lucide/svelte`,
 *     which is the standing Phase 3 icon-registry debt. It contributes nothing
 *     to `theme.css`, so the parity oracle is unaffected.
 *
 *     `theme-neutral` no longer drops its own — see `neutral/src/icons.svelte`
 *     for the shape, which this package can copy verbatim: all seven upstream
 *     registries are identical but for the export name.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/** Matcha syntax palette — upstream 0.7.13's resolved values. */
const matchaSyntax = defineSyntaxTheme({
	name: 'astryx-matcha',
	tokens: {
		keyword: 'light-dark(#5a6b2a, #a8bf6a)',
		string: 'light-dark(#2e6b5a, #6ccaaa)',
		comment: 'light-dark(#707e46, #707e46)',
		number: 'light-dark(#836700, #e0b318)',
		function: 'light-dark(#3a5e8c, #7ba8d4)',
		type: 'light-dark(#6b4a8c, #b08ed4)',
		variable: 'light-dark(#3e481d, #c0cba9)',
		operator: 'light-dark(#707e46, #94a468)',
		constant: 'light-dark(#836700, #e0b318)',
		tag: 'light-dark(#8c3a3a, #d47a7a)',
		attribute: 'light-dark(#7c5e3a, #d1a500)',
		property: 'light-dark(#3a7c6b, #6ccaaa)',
		punctuation: 'light-dark(#5a6b2a, #92af6a)',
		background: 'light-dark(#f0f0e0, #1a1c14)',
		added: 'color-mix(in srgb, var(--color-success-muted) 25%, transparent)',
		removed: 'color-mix(in srgb, var(--color-error-muted) 25%, transparent)',
		'diff-header': 'transparent',
		'added-marker': 'var(--color-syntax-punctuation)',
		'removed-marker': 'var(--color-syntax-punctuation)'
	}
});

/**
 * Matcha theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const matchaTheme = defineTheme({
	name: 'matcha',

	typography: {
		scale: {
			base: 16,
			ratio: 1.25
		},
		body: {
			family: 'DM Sans',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Playwrite US Trad',
			fallbacks: 'Georgia, "Times New Roman", Times, serif'
		},
		code: {
			family: 'JetBrains Mono',
			fallbacks: '"SF Mono", Monaco, Consolas, monospace'
		}
	},

	motion: {
		fast: 125,
		medium: 300,
		slow: 700,
		ratio: 0.75
	},
	onDark: {
		tokens: {
			'color-scheme': 'dark',
			'--color-text-primary': 'var(--color-on-dark)',
			'--color-icon-primary': 'var(--color-on-dark)',
			'--color-accent': 'var(--color-on-dark)'
		}
	},
	onLight: {
		tokens: {
			'color-scheme': 'light',
			'--color-text-primary': 'var(--color-on-light)',
			'--color-icon-primary': 'var(--color-on-light)',
			'--color-accent': 'var(--color-on-light)'
		}
	},
	syntax: matchaSyntax,
	tokens: {
		'--color-accent': 'light-dark(#3e481d, #c0cba9)',
		'--color-accent-muted': 'light-dark(#3e481d14, #c0cba920)',
		'--color-neutral': 'light-dark(#3e481d0f, #c0cba91a)',
		'--color-background-surface': 'light-dark(#ffffff, #1a1c14)',
		'--color-background-body': 'light-dark(#f0f0e0, #12140e)',
		'--color-overlay': 'light-dark(#3e481d80, #3e481dcc)',
		'--color-overlay-hover': 'light-dark(#3e481d0d, #c0cba90d)',
		'--color-overlay-pressed': 'light-dark(#3e481d1a, #c0cba91a)',
		'--color-background-muted': 'light-dark(#f0f0e0, #3e481d)',
		'--color-text-primary': 'light-dark(#3e481d, #c0cba9)',
		'--color-text-secondary': 'light-dark(#5a6b2a, #94a468)',
		'--color-text-disabled': 'light-dark(#c0cba9, #5a6440)',
		'--color-text-accent': 'light-dark(#3e481d, #c0cba9)',
		'--color-on-dark': '#ffffff',
		'--color-on-light': '#3e481d',
		'--color-on-accent': 'light-dark(#ffffff, #3e481d)',
		'--color-on-success': '#12140e',
		'--color-on-error': '#12140e',
		'--color-on-warning': 'light-dark(#3e481d, #3e481d)',
		'--color-info': 'light-dark(#3a5e8c, #a7c9e3)',
		'--color-info-muted': 'var(--color-background-blue)',
		'--color-text-info': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-text-success': 'light-dark(#3d7a00, #80d43a)',
		'--color-text-warning': 'light-dark(#836700, #ffe08b)',
		'--color-text-error': 'light-dark(#cc0000, #ff7a7a)',
		'--color-on-info-muted': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-on-success-muted': 'light-dark(#3d7a00, #80d43a)',
		'--color-on-warning-muted': 'light-dark(#836700, #ffe08b)',
		'--color-on-error-muted': 'light-dark(#cc0000, #ff7a7a)',
		'--color-icon-accent': 'light-dark(#3e481d, #c0cba9)',
		'--color-icon-primary': 'light-dark(#3e481d, #c0cba9)',
		'--color-icon-secondary': 'light-dark(#707e46, #94a468)',
		'--color-icon-disabled': 'light-dark(#c0cba9, #5a6440)',
		'--color-background-card': 'light-dark(#ffffff, #1e2016)',
		'--color-background-popover': 'light-dark(#ffffff, #3e481d)',
		'--color-background-inverted': 'light-dark(#3e481d, #c0cba9)',
		'--color-success': 'light-dark(#4d9900, #6dbf2a)',
		'--color-success-muted': 'light-dark(#4d990020, #6dbf2a20)',
		'--color-error': 'light-dark(#fd0000, #ff5c5c)',
		'--color-error-muted': 'light-dark(#fd000020, #ff5c5c20)',
		'--color-warning': 'light-dark(#f2c000, #f6d066)',
		'--color-warning-muted': 'light-dark(#f2c00020, #f6d06620)',
		'--color-border': 'light-dark(#dce3ce, #c0cba91a)',
		'--color-border-emphasized': 'light-dark(#b7c29e, #5a6440)',
		'--color-skeleton': 'light-dark(#c0cba9, #5a6440)',
		'--color-shadow': 'light-dark(#3e481d1a, #0000004d)',
		'--color-tint-hover': 'light-dark(#000000, #ffffff)',
		'--color-background-blue': 'light-dark(#3a5e8c33, #3a5e8c33)',
		'--color-border-blue': 'light-dark(#3a5e8c, #7ba8d4)',
		'--color-icon-blue': 'light-dark(#3a5e8c, #7ba8d4)',
		'--color-text-blue': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-background-cyan': 'light-dark(#3a7c7c33, #3a7c7c33)',
		'--color-border-cyan': 'light-dark(#3a7c7c, #70c4c4)',
		'--color-icon-cyan': 'light-dark(#3a7c7c, #70c4c4)',
		'--color-text-cyan': 'light-dark(#2e6060, #82d4d4)',
		'--color-background-gray': 'light-dark(#707e4633, #5a644033)',
		'--color-border-gray': 'light-dark(#707e46, #707e46)',
		'--color-icon-gray': 'light-dark(#707e46, #94a468)',
		'--color-text-gray': 'light-dark(#3e481d, #c0cba9)',
		'--color-background-green': 'light-dark(#4d990033, #6dbf2a33)',
		'--color-border-green': 'light-dark(#4d9900, #6dbf2a)',
		'--color-icon-green': 'light-dark(#4d9900, #6dbf2a)',
		'--color-text-green': 'light-dark(#3d7a00, #80d43a)',
		'--color-background-orange': 'light-dark(#c4762033, #d4903a33)',
		'--color-border-orange': 'light-dark(#c47620, #d4903a)',
		'--color-icon-orange': 'light-dark(#c47620, #d4903a)',
		'--color-text-orange': 'light-dark(#a06018, #e0a04a)',
		'--color-background-pink': 'light-dark(#c44a7033, #e07a9a33)',
		'--color-border-pink': 'light-dark(#c44a70, #e07a9a)',
		'--color-icon-pink': 'light-dark(#c44a70, #e07a9a)',
		'--color-text-pink': 'light-dark(#a03a5a, #f08aaa)',
		'--color-background-purple': 'light-dark(#6b4a8c33, #b08ed433)',
		'--color-border-purple': 'light-dark(#6b4a8c, #b08ed4)',
		'--color-icon-purple': 'light-dark(#6b4a8c, #b08ed4)',
		'--color-text-purple': 'light-dark(#553a70, #c0a0e0)',
		'--color-background-red': 'light-dark(#fd000033, #ff5c5c33)',
		'--color-border-red': 'light-dark(#fd0000, #ff5c5c)',
		'--color-icon-red': 'light-dark(#fd0000, #ff5c5c)',
		'--color-text-red': 'light-dark(#cc0000, #ff7a7a)',
		'--color-background-teal': 'light-dark(#2e6b5a33, #5ab89833)',
		'--color-border-teal': 'light-dark(#2e6b5a, #5ab898)',
		'--color-icon-teal': 'light-dark(#2e6b5a, #5ab898)',
		'--color-text-teal': 'light-dark(#245546, #6ccaaa)',
		'--color-background-yellow': 'light-dark(#f2c00033, #f6d06633)',
		'--color-border-yellow': 'light-dark(#f2c000, #f6d066)',
		'--color-icon-yellow': 'light-dark(#f2c000, #f6d066)',
		'--color-text-yellow': 'light-dark(#c19800, #ffe08b)',
		'--spacing-0-5': '0.1875rem',
		'--spacing-1': '0.375rem',
		'--spacing-1-5': '0.5625rem',
		'--spacing-2': '0.75rem',
		'--spacing-3': '1.125rem',
		'--spacing-4': '1.5rem',
		'--spacing-5': '1.875rem',
		'--spacing-6': '2.25rem',
		'--spacing-7': '2.625rem',
		'--spacing-8': '3rem',
		'--spacing-9': '3.375rem',
		'--spacing-10': '3.75rem',
		'--spacing-11': '4.125rem',
		'--spacing-12': '4.5rem',
		'--radius-inner': '6px',
		'--radius-element': '12px',
		'--radius-container': '18px',
		'--radius-page': '42px',
		'--size-element-sm': '36px',
		'--size-element-md': '40px',
		'--size-element-lg': '44px',
		'--shadow-low': '0 2px 4px #3e481d0d, 0 4px 8px #3e481d1a',
		'--shadow-med': '0 2px 4px #3e481d0d, 0 4px 12px #3e481d1a',
		'--shadow-high': '0 4px 6px #3e481d1a, 0 12px 24px #3e481d26',
		'--shadow-inset-hover': 'inset 0px 0px 0px 2px #3e481d30',
		'--shadow-inset-selected': 'inset 0px 0px 0px 2px #3e481d50',
		'--shadow-inset-success': 'inset 0px 0px 0px 2px #4d990050',
		'--shadow-inset-warning': 'inset 0px 0px 0px 2px #f2c00050',
		'--shadow-inset-error': 'inset 0px 0px 0px 2px #fd000050',
		'--color-on-info': 'light-dark(#FFFFFF, #3E481D)'
	},
	components: {
		heading: {
			'level:1': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-1-size)',
				fontWeight: 'var(--text-heading-1-weight)',
				lineHeight: 'var(--text-heading-1-leading)'
			},
			'level:2': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-2-size)',
				fontWeight: 'var(--text-heading-2-weight)',
				lineHeight: 'var(--text-heading-2-leading)'
			},
			'level:3': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-3-size)',
				fontWeight: 'var(--text-heading-3-weight)',
				lineHeight: 'var(--text-heading-3-leading)'
			},
			'level:4': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-4-size)',
				fontWeight: 'var(--text-heading-4-weight)',
				lineHeight: 'var(--text-heading-4-leading)'
			},
			'level:5': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-5-size)',
				fontWeight: 'var(--text-heading-5-weight)',
				lineHeight: 'var(--text-heading-5-leading)'
			},
			'level:6': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-heading-6-size)',
				fontWeight: 'var(--text-heading-6-weight)',
				lineHeight: 'var(--text-heading-6-leading)'
			},
			'type:display-1': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-1-size)',
				lineHeight: 'var(--text-display-1-leading)'
			},
			'type:display-2': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-2-size)',
				lineHeight: 'var(--text-display-2-leading)'
			},
			'type:display-3': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-3-size)',
				lineHeight: 'var(--text-display-3-leading)'
			}
		},
		text: {
			'type:body': {
				fontFamily: 'var(--font-family-body)',
				fontSize: 'var(--text-body-size)',
				lineHeight: 'var(--text-body-leading)'
			},
			'type:large': {
				fontFamily: 'var(--font-family-body)',
				fontSize: 'var(--text-large-size)',
				lineHeight: 'var(--text-large-leading)'
			},
			'type:label': {
				fontFamily: 'var(--font-family-body)',
				fontSize: 'var(--text-label-size)',
				lineHeight: 'var(--text-label-leading)'
			},
			'type:code': {
				fontFamily: 'var(--font-family-code)',
				fontSize: 'var(--text-code-size)',
				lineHeight: 'var(--text-code-leading)'
			},
			'type:supporting': {
				fontFamily: 'var(--font-family-body)',
				fontSize: 'var(--text-supporting-size)',
				lineHeight: 'var(--text-supporting-leading)'
			},
			'type:display-1': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-1-size)',
				lineHeight: 'var(--text-display-1-leading)'
			},
			'type:display-2': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-2-size)',
				lineHeight: 'var(--text-display-2-leading)'
			},
			'type:display-3': {
				fontFamily: 'var(--font-family-heading)',
				fontSize: 'var(--text-display-3-size)',
				lineHeight: 'var(--text-display-3-leading)'
			}
		},
		button: {
			base: {
				borderRadius: 'var(--radius-full)'
			}
		},
		card: {
			base: {
				borderRadius: 'var(--radius-page)',
				padding: 'var(--spacing-3)'
			}
		},
		section: {
			base: {
				padding: 'var(--spacing-3)'
			}
		}
	}
});
