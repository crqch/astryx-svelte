/**
 * Chocolate Theme — ported from Astryx's
 * `packages/themes/chocolate/src/chocolateTheme.ts`.
 *
 * Transcribed verbatim but for the two things every theme package here changes:
 * core's deep `dist/` imports in place of the `@astryxdesign/core/theme` barrel
 * (the barrel re-exports `theme.svelte`, and this file is on the theme build's
 * plain-Node import path), and the dropped `icons: chocolateIconRegistry` — the
 * standing Phase 3 icon-registry debt, which contributes nothing to `theme.css`.
 *
 * Unlike butter / gothic / stone / y2k, upstream's chocolate publishes **no**
 * `chocolatePalettes` ramp export — its `source.ts` exports only the theme and
 * the icon registry — so this package has none either.
 *
 * A warm, cozy theme inspired by rich chocolate and caramel tones.
 * Core palette: #8C5927, #B88859, #C4AC95, #EDE4D4, #FFFCF7
 * Uses Fraunces for headings and Albert Sans for body text.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/** Chocolate syntax palette — upstream 0.7.13's resolved values. */
const chocolateSyntax = defineSyntaxTheme({
	name: 'astryx-chocolate',
	tokens: {
		keyword: 'light-dark(#8C5927, #d4a06a)',
		string: 'light-dark(#2e6b4a, #7bc49e)',
		comment: 'light-dark(#B88859, #B88859)',
		number: 'light-dark(#a06018, #d4b870)',
		function: 'light-dark(#3a5e8c, #7ba8d4)',
		type: 'light-dark(#6b4a8c, #b08ed4)',
		variable: 'light-dark(#4a3520, #EDE4D4)',
		operator: 'light-dark(#B88859, #c4a882)',
		constant: 'light-dark(#a06018, #d4b870)',
		tag: 'light-dark(#8c3a3a, #d47a7a)',
		attribute: 'light-dark(#8C5927, #d4a06a)',
		property: 'light-dark(#3a7c6b, #70c4b0)',
		punctuation: 'light-dark(#9e622e, #cb884d)',
		background: 'light-dark(#FFFCF7, #1c1610)',
		added: 'color-mix(in srgb, var(--color-success-muted) 25%, transparent)',
		removed: 'color-mix(in srgb, var(--color-error-muted) 25%, transparent)',
		'diff-header': 'transparent',
		'added-marker': 'var(--color-syntax-punctuation)',
		'removed-marker': 'var(--color-syntax-punctuation)'
	}
});

/**
 * Chocolate theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const chocolateTheme = defineTheme({
	name: 'chocolate',

	typography: {
		scale: {
			base: 14,
			ratio: 1.2
		},
		body: {
			family: 'Albert Sans',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Fraunces',
			fallbacks: 'Georgia, "Times New Roman", Times, serif',
			weights: {
				'3': 'bold',
				'4': 'bold'
			}
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
	adaptations: {
		rules: [
			{
				when: {
					pointer: 'coarse',
					width: {
						below: 'lg'
					}
				},
				value: {
					typography: {
						scale: {
							base: 16,
							ratio: 1.1736
						}
					}
				}
			}
		]
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
	syntax: chocolateSyntax,
	tokens: {
		'--color-accent': 'light-dark(#8C5927, #d4a06a)',
		'--color-accent-muted': 'light-dark(#8C592714, #d4a06a20)',
		'--color-neutral': 'light-dark(#8C59270F, #EDE4D41A)',
		'--color-background-surface': 'light-dark(#FFFCF7, #1c1610)',
		'--color-background-body': 'light-dark(#FFFCF7, #141010)',
		'--color-overlay': 'light-dark(#4a352080, #140e0aCC)',
		'--color-overlay-hover': 'light-dark(#4a35200D, #EDE4D40D)',
		'--color-overlay-pressed': 'light-dark(#4a35201A, #EDE4D41A)',
		'--color-background-muted': 'light-dark(#EDE4D4, #2a2018)',
		'--color-text-primary': 'light-dark(#4a3520, #EDE4D4)',
		'--color-text-secondary': 'light-dark(#B88859, #c4a882)',
		'--color-text-disabled': 'light-dark(#C4AC95, #6b5540)',
		'--color-text-accent': 'light-dark(#8C5927, #d4a06a)',
		'--color-on-dark': '#FFFCF7',
		'--color-on-light': '#4a3520',
		'--color-on-accent': 'light-dark(#FFFFFF, #4a3520)',
		'--color-on-success': '#141010',
		'--color-on-error': '#141010',
		'--color-on-warning': 'light-dark(#4a3520, #4a3520)',
		'--color-info': 'light-dark(#3a5e8c, #7ba8d4)',
		'--color-info-muted': 'var(--color-background-blue)',
		'--color-text-info': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-text-success': 'light-dark(#526f00, #a8d43a)',
		'--color-text-warning': 'light-dark(#7a5500, #ffd960)',
		'--color-text-error': 'light-dark(#cc0000, #ff7a7a)',
		'--color-on-info-muted': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-on-success-muted': 'light-dark(#4d6800, #a8d43a)',
		'--color-on-warning-muted': 'light-dark(#7a5500, #ffd960)',
		'--color-on-error-muted': 'light-dark(#b40000, #ff7a7a)',
		'--color-icon-accent': 'light-dark(#8C5927, #d4a06a)',
		'--color-icon-primary': 'light-dark(#4a3520, #EDE4D4)',
		'--color-icon-secondary': 'light-dark(#B88859, #c4a882)',
		'--color-icon-disabled': 'light-dark(#C4AC95, #6b5540)',
		'--color-background-card': 'light-dark(#EDE4D4, #2a2018)',
		'--color-background-popover': 'light-dark(#FFFCF7, #2a2018)',
		'--color-background-inverted': 'light-dark(#4a3520, #EDE4D4)',
		'--color-success': 'light-dark(#709900, #96bf2a)',
		'--color-success-muted': 'light-dark(#70990020, #96bf2a20)',
		'--color-error': 'light-dark(#FD0000, #ff5c5c)',
		'--color-error-muted': 'light-dark(#FD000020, #ff5c5c20)',
		'--color-warning': 'light-dark(#FFB600, #ffc940)',
		'--color-warning-muted': 'light-dark(#FFB60020, #ffc94020)',
		'--color-border': 'light-dark(#C4AC95, #EDE4D41A)',
		'--color-border-emphasized': 'light-dark(#B88859, #6b5540)',
		'--color-skeleton': 'light-dark(#C4AC95, #6b5540)',
		'--color-shadow': 'light-dark(#4a35201A, #0000004D)',
		'--color-tint-hover': 'light-dark(black, white)',
		'--color-background-blue': 'light-dark(#3a5e8c33, #3a5e8c33)',
		'--color-border-blue': 'light-dark(#3a5e8c, #7ba8d4)',
		'--color-icon-blue': 'light-dark(#3a5e8c, #7ba8d4)',
		'--color-text-blue': 'light-dark(#2e4a6e, #8dbce0)',
		'--color-background-cyan': 'light-dark(#3a7c7c33, #3a7c7c33)',
		'--color-border-cyan': 'light-dark(#3a7c7c, #70c4c4)',
		'--color-icon-cyan': 'light-dark(#3a7c7c, #70c4c4)',
		'--color-text-cyan': 'light-dark(#2e6060, #82d4d4)',
		'--color-background-gray': 'light-dark(#B8885933, #6b554033)',
		'--color-border-gray': 'light-dark(#B88859, #B88859)',
		'--color-icon-gray': 'light-dark(#B88859, #c4a882)',
		'--color-text-gray': 'light-dark(#4a3520, #EDE4D4)',
		'--color-background-green': 'light-dark(#70990033, #96bf2a33)',
		'--color-border-green': 'light-dark(#709900, #96bf2a)',
		'--color-icon-green': 'light-dark(#709900, #96bf2a)',
		'--color-text-green': 'light-dark(#5a7a00, #a8d43a)',
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
		'--color-background-red': 'light-dark(#FD000033, #ff5c5c33)',
		'--color-border-red': 'light-dark(#FD0000, #ff5c5c)',
		'--color-icon-red': 'light-dark(#FD0000, #ff5c5c)',
		'--color-text-red': 'light-dark(#cc0000, #ff7a7a)',
		'--color-background-teal': 'light-dark(#2e6b5a33, #5ab89833)',
		'--color-border-teal': 'light-dark(#2e6b5a, #5ab898)',
		'--color-icon-teal': 'light-dark(#2e6b5a, #5ab898)',
		'--color-text-teal': 'light-dark(#245546, #6ccaaa)',
		'--color-background-yellow': 'light-dark(#FFB60033, #ffc94033)',
		'--color-border-yellow': 'light-dark(#FFB600, #ffc940)',
		'--color-icon-yellow': 'light-dark(#FFB600, #ffc940)',
		'--color-text-yellow': 'light-dark(#cc9200, #ffd960)',
		'--radius-none': '0px',
		'--radius-inner': '0.375rem',
		'--radius-element': '0.625rem',
		'--radius-container': '0.75rem',
		'--radius-page': '1.5rem',
		'--radius-full': '9999px',
		'--shadow-low': '0 2px 4px #4a35200D, 0 4px 8px #4a35201A',
		'--shadow-med': '0 2px 4px #4a35200D, 0 4px 12px #4a35201A',
		'--shadow-high': '0 4px 6px #4a35201A, 0 12px 24px #4a352026',
		'--shadow-inset-hover': 'inset 0px 0px 0px 2px #8C592730',
		'--shadow-inset-selected': 'inset 0px 0px 0px 2px #8C592750',
		'--shadow-inset-success': 'inset 0px 0px 0px 2px #70990050',
		'--shadow-inset-warning': 'inset 0px 0px 0px 2px #FFB60050',
		'--shadow-inset-error': 'inset 0px 0px 0px 2px #FD000050',
		'--color-on-info': 'light-dark(#FFFCF7, #4A3520)'
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
			},
			'variant:secondary': {
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-border-emphasized)'
			}
		},
		selector: {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					borderWidth: '1px',
					borderStyle: 'solid',
					borderColor: 'var(--color-border-emphasized)'
				}
			}
		},
		'multi-selector': {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					borderWidth: '1px',
					borderStyle: 'solid',
					borderColor: 'var(--color-border-emphasized)'
				}
			}
		},
		'complex-selector': {
			'variant:secondary': {
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-border-emphasized)'
			}
		},
		card: {
			base: {
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
