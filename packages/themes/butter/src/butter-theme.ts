/**
 * Butter Theme — ported from Astryx's `packages/themes/butter/src/butterTheme.ts`.
 *
 * Transcribed verbatim but for the two things every theme package here changes:
 * core's deep `dist/` imports in place of the `@astryxdesign/core/theme` barrel
 * (the barrel re-exports `theme.svelte`, and this file is on the theme build's
 * plain-Node import path), and the dropped `icons: butterIconRegistry` — the
 * standing Phase 3 icon-registry debt, which contributes nothing to `theme.css`.
 *
 * Warm, golden buttery theme with blue accents.
 * Sarina for display, Outfit for headings and body.
 *
 * Source palette (per design):
 *   Accent  #225BFF   Gray    #868B99   Red     #FF7553
 *   Orange  #FFA347   Yellow  #fdee8c   Green   #5DCE5F
 *   Cyan    #60CFD3   Teal    #6CD9A8   Blue    #5681FF
 *   Purple  #B780F6   Pink    #F680E8   Error   #FF5947
 *   Warning #F8C726   Success #91D143
 *
 * All tonal ramps derived in CIELab (matches the algorithm used by
 * ThemePalettePreview so card / badge / banner / strip render the
 * same values). Regen via scripts/butter-palette-gen.mjs if sources
 * change.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/** Butter syntax palette — upstream 0.7.13's resolved values. */
const butterSyntax = defineSyntaxTheme({
	name: 'astryx-butter',
	tokens: {
		keyword: 'light-dark(#52237b, #ddb9f6)',
		string: 'light-dark(#004a05, #a8d4a6)',
		comment: 'light-dark(#605f52, #adac9e)',
		number: 'light-dark(#622e00, #f2bd81)',
		function: 'light-dark(#203a6c, #bdc5eb)',
		type: 'light-dark(#52237b, #ddb9f6)',
		variable: 'light-dark(#605f52, #adac9e)',
		operator: 'light-dark(#605f52, #adac9e)',
		constant: 'light-dark(#622e00, #f2bd81)',
		tag: 'light-dark(#6f1400, #ffb09b)',
		attribute: 'light-dark(#443c00, #bcae4e)',
		property: 'light-dark(#00482d, #94d3bb)',
		punctuation: 'light-dark(#605f52, #adac9e)',
		background: 'light-dark(#fdfbe4, #131107)',
		added: 'color-mix(in srgb, var(--color-success-muted) 25%, transparent)',
		removed: 'color-mix(in srgb, var(--color-error-muted) 25%, transparent)',
		'diff-header': 'transparent',
		'added-marker': 'var(--color-syntax-punctuation)',
		'removed-marker': 'var(--color-syntax-punctuation)'
	}
});

/**
 * Butter theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const butterTheme = defineTheme({
	name: 'butter',

	typography: {
		scale: {
			base: 14,
			ratio: 1.25
		},
		body: {
			family: 'Outfit',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Outfit',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
							ratio: 1.2225
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
	syntax: butterSyntax,
	tokens: {
		'--color-accent': 'light-dark(#225bff, #fdee8c)',
		'--color-accent-muted': 'light-dark(#225bff33, #fdee8c40)',
		'--color-neutral': 'light-dark(#1d1c110f, #f3f2e21a)',
		'--color-background-surface': 'light-dark(#ffffff, #2e2117)',
		'--color-background-body': 'light-dark(#fdfbe4, #261a13)',
		'--color-overlay': 'light-dark(#1d1c1180, #261a13cc)',
		'--color-overlay-hover': 'light-dark(#1d1c110d, #f3f2e20d)',
		'--color-overlay-pressed': 'light-dark(#1d1c111a, #f3f2e21a)',
		'--color-background-muted': 'light-dark(#f3f2e2, #3a2a1f)',
		'--color-text-primary': 'light-dark(#1d1c11, #f3f2e2)',
		'--color-text-secondary': 'light-dark(#605f52, #adac9e)',
		'--color-text-disabled': 'light-dark(#adac9e, #605f52)',
		'--color-text-accent': 'light-dark(#225bff, #fdee8c)',
		'--color-on-dark': '#ffffff',
		'--color-on-light': '#1d1c11',
		'--color-on-accent': 'light-dark(#ffffff, #1d1c11)',
		'--color-on-success': 'light-dark(#b6e3b4, #013004)',
		'--color-on-error': 'light-dark(#ffece7, #4c0700)',
		'--color-on-warning': 'light-dark(#fff7c0, #2c2600)',
		'--color-info': 'light-dark(#225bff, #81a9ff)',
		'--color-info-muted': 'var(--color-background-blue)',
		'--color-text-info': 'light-dark(#225bff, #81a9ff)',
		'--color-text-success': 'light-dark(#004a05, #a8d4a6)',
		'--color-text-warning': 'light-dark(#443c00, #eedf75)',
		'--color-text-error': 'light-dark(#6f1400, #ffb09b)',
		'--color-on-info-muted': 'var(--color-text-blue)',
		'--color-on-success-muted': 'light-dark(#004a05, #a8d4a6)',
		'--color-on-warning-muted': 'light-dark(#443c00, #eedf75)',
		'--color-on-error-muted': 'light-dark(#6f1400, #ffd9cf)',
		'--color-icon-accent': 'light-dark(#225bff, #fdee8c)',
		'--color-icon-primary': 'light-dark(#1d1c11, #f3f2e2)',
		'--color-icon-secondary': 'light-dark(#605f52, #adac9e)',
		'--color-icon-disabled': 'light-dark(#adac9e, #605f52)',
		'--color-background-card': 'light-dark(#ffffff, #3a2a1f)',
		'--color-background-popover': 'light-dark(#ffffff, #3a2a1f)',
		'--color-background-inverted': 'light-dark(#1d1c11, #fdfbe4)',
		'--color-error': 'light-dark(#821b00, #ffc5b5)',
		'--color-error-muted': 'light-dark(#821b0033, #ffc5b540)',
		'--color-warning': 'light-dark(#514700, #cdbe59)',
		'--color-warning-muted': 'light-dark(#51470033, #cdbe5940)',
		'--color-success': 'light-dark(#004a05, #83bc82)',
		'--color-success-muted': 'light-dark(#004a0533, #83bc8240)',
		'--color-border': 'light-dark(#e5e3d4, #f3f2e21a)',
		'--color-border-emphasized': 'light-dark(#c7c4b2, #939184)',
		'--color-skeleton': 'light-dark(#e5e3d4, #49473b)',
		'--color-shadow': 'light-dark(#1d1c111a, #0000004d)',
		'--color-tint-hover': 'light-dark(#000000, #ffffff)',
		'--size-element-sm': '32px',
		'--size-element-md': '40px',
		'--size-element-lg': '48px',
		'--color-background-blue': 'light-dark(#dbe1ff, #dbe1ff)',
		'--color-border-blue': 'light-dark(#bdc5eb, #bdc5eb)',
		'--color-icon-blue': 'light-dark(#203a6c, #203a6c)',
		'--color-text-blue': 'light-dark(#203a6c, #203a6c)',
		'--color-background-cyan': 'light-dark(#a9eff0, #a9eff0)',
		'--color-border-cyan': 'light-dark(#8dd2d3, #8dd2d3)',
		'--color-icon-cyan': 'light-dark(#004649, #004649)',
		'--color-text-cyan': 'light-dark(#004649, #004649)',
		'--color-background-gray': 'light-dark(#f0edd4, #f0edd4)',
		'--color-border-gray': 'light-dark(#d6d3b8, #d6d3b8)',
		'--color-icon-gray': 'light-dark(#4a4732, #4a4732)',
		'--color-text-gray': 'light-dark(#4a4732, #4a4732)',
		'--color-background-green': 'light-dark(#caeec8, #cdedcc)',
		'--color-border-green': 'light-dark(#a2d7a0, #a8d4a6)',
		'--color-icon-green': 'light-dark(#004a05, #063c0a)',
		'--color-text-green': 'light-dark(#004a05, #063c0a)',
		'--color-background-orange': 'light-dark(#ffdcb6, #ffdcb6)',
		'--color-border-orange': 'light-dark(#f2bd81, #f2bd81)',
		'--color-icon-orange': 'light-dark(#622e00, #622e00)',
		'--color-text-orange': 'light-dark(#622e00, #622e00)',
		'--color-background-pink': 'light-dark(#ffd5fb, #ffd5fb)',
		'--color-border-pink': 'light-dark(#f0b3e8, #f0b3e8)',
		'--color-icon-pink': 'light-dark(#6c0a68, #6c0a68)',
		'--color-text-pink': 'light-dark(#6c0a68, #6c0a68)',
		'--color-background-purple': 'light-dark(#f2daff, #f2daff)',
		'--color-border-purple': 'light-dark(#ddb9f6, #ddb9f6)',
		'--color-icon-purple': 'light-dark(#52237b, #52237b)',
		'--color-text-purple': 'light-dark(#52237b, #52237b)',
		'--color-background-red': 'light-dark(#ffd9cf, #ffd9cf)',
		'--color-border-red': 'light-dark(#ffb09b, #ffb09b)',
		'--color-icon-red': 'light-dark(#6f1400, #6f1400)',
		'--color-text-red': 'light-dark(#6f1400, #6f1400)',
		'--color-background-teal': 'light-dark(#b0f0d7, #b0f0d7)',
		'--color-border-teal': 'light-dark(#94d3bb, #94d3bb)',
		'--color-icon-teal': 'light-dark(#00482d, #00482d)',
		'--color-text-teal': 'light-dark(#00482d, #00482d)',
		'--color-background-yellow': 'light-dark(#f0df72, #eedf75)',
		'--color-border-yellow': 'light-dark(#bfae35, #bcae4e)',
		'--color-icon-yellow': 'light-dark(#443c00, #443c00)',
		'--color-text-yellow': 'light-dark(#443c00, #443c00)',
		'--radius-none': '0px',
		'--radius-inner': '0.375rem',
		'--radius-element': '0.5rem',
		'--radius-container': '0.75rem',
		'--radius-page': '1.5rem',
		'--radius-full': '9999px',
		'--shadow-low': '0 2px 4px #1d1c110d, 0 4px 8px #1d1c111a',
		'--shadow-med': '0 2px 4px #1d1c110d, 0 4px 12px #1d1c111a',
		'--shadow-high': '0 4px 6px #1d1c111a, 0 12px 24px #1d1c1126',
		'--shadow-inset-hover': 'inset 0px 0px 0px 2px #79786a30',
		'--shadow-inset-selected': 'inset 0px 0px 0px 2px #79786a50',
		'--shadow-inset-success': 'inset 0px 0px 0px 2px #004a0530',
		'--shadow-inset-warning': 'inset 0px 0px 0px 2px #51470030',
		'--shadow-inset-error': 'inset 0px 0px 0px 2px #821b0030',
		'--color-on-info': 'light-dark(#FFFFFF, #1D1C11)',
		'--text-supporting-size': '0.75rem'
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
				fontFamily: 'Sarina, "Brush Script MT", "Snell Roundhand", cursive',
				fontSize: 'var(--text-display-1-size)',
				lineHeight: 'var(--text-display-1-leading)'
			},
			'type:display-2': {
				fontFamily: 'Sarina, "Brush Script MT", "Snell Roundhand", cursive',
				fontSize: 'var(--text-display-2-size)',
				lineHeight: 'var(--text-display-2-leading)'
			},
			'type:display-3': {
				fontFamily: 'Sarina, "Brush Script MT", "Snell Roundhand", cursive',
				fontSize: 'var(--text-display-3-size)',
				lineHeight: 'var(--text-display-3-leading)'
			}
		},
		'top-nav-heading': {
			base: {
				color: 'light-dark(#225bff, #fdee8c)',
				'--color-text-primary': 'light-dark(#225bff, #fdee8c)'
			}
		},
		'top-nav-item': {
			base: {
				color: 'light-dark(#225bff, #fdee8ccc)'
			},
			selected: {
				color: 'light-dark(#194ce8, #fdee8c)',
				backgroundColor: 'transparent',
				':hover': {
					backgroundColor: 'var(--color-overlay-hover)'
				},
				':active': {
					backgroundColor: 'var(--color-overlay-pressed)'
				}
			}
		},
		button: {
			base: {
				paddingInline: 'var(--spacing-4)'
			},
			'variant:secondary': {
				backgroundColor: 'transparent',
				borderWidth: '1.5px',
				borderStyle: 'solid',
				borderColor: 'light-dark(#225bff, #fdee8c)',
				color: 'light-dark(#225bff, #fdee8c)',
				':hover': {
					backgroundColor: 'light-dark(#225bff14, #fdee8c14)'
				}
			},
			'variant:ghost': {
				color: 'light-dark(#225bff, #fdee8c)'
			},
			'variant:destructive': {
				backgroundColor: 'light-dark(#ffd9cf, #ffb09b)',
				color: 'light-dark(#3b0200, #6f1400)'
			}
		},
		badge: {
			base: {
				height: '30px',
				paddingBlock: '0',
				paddingInline: 'var(--spacing-3)'
			},
			'variant:info': {
				backgroundColor: '#4d82ff',
				color: '#1d1c11'
			},
			'variant:neutral': {
				backgroundColor: '#fdee8c',
				color: '#194ce8'
			},
			'variant:success': {
				backgroundColor: '#7bbf7a',
				color: '#1d1c11'
			},
			'variant:warning': {
				backgroundColor: '#dfcf5b',
				color: '#1d1c11'
			},
			'variant:error': {
				backgroundColor: '#e56241',
				color: '#1d1c11'
			}
		},
		banner: {
			'status:info': {
				'--color-info-muted': '#4d82ff',
				'--color-on-info-muted': '#1d1c11'
			},
			'status:success': {
				'--color-success-muted': '#7bbf7a',
				'--color-on-success-muted': '#1d1c11'
			},
			'status:warning': {
				'--color-warning-muted': '#dfcf5b',
				'--color-on-warning-muted': '#1d1c11'
			},
			'status:error': {
				'--color-error-muted': '#e56241',
				'--color-on-error-muted': '#1d1c11'
			}
		},
		card: {
			base: {
				borderRadius: 'var(--radius-container)',
				padding: 'var(--spacing-4)'
			},
			'variant:info': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:success': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:warning': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:error': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:blue': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:cyan': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:gray': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:green': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:orange': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:pink': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:purple': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:red': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:teal': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:yellow': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			},
			'variant:muted': {
				'--color-text-primary': '#1d1c11',
				'--color-text-secondary': '#605f52'
			}
		},
		section: {
			base: {
				padding: 'var(--spacing-4)'
			}
		},
		'progress-bar-track': {
			base: {
				backgroundColor: 'light-dark(#e5e3d4, #725538)'
			}
		},
		'progress-bar-fill': {
			'variant:success': {
				backgroundColor: '#7bbf7a'
			},
			'variant:warning': {
				backgroundColor: '#dfcf5b'
			},
			'variant:error': {
				backgroundColor: '#e56241'
			}
		},
		'field-status': {
			'type:success': {
				backgroundColor: '#7bbf7a',
				color: '#1d1c11'
			},
			'type:warning': {
				backgroundColor: '#dfcf5b',
				color: '#1d1c11'
			},
			'type:error': {
				backgroundColor: '#e56241',
				color: '#1d1c11'
			}
		},
		'text-input': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		'text-area': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		'number-input': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		'date-input': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		'time-input': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		selector: {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			},
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'transparent',
					borderWidth: '1.5px',
					borderStyle: 'solid',
					borderColor: 'light-dark(#225bff, #fdee8c)',
					color: 'light-dark(#225bff, #fdee8c)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'light-dark(#225bff14, #fdee8c14)'
				}
			}
		},
		'multi-selector': {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			},
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'transparent',
					borderWidth: '1.5px',
					borderStyle: 'solid',
					borderColor: 'light-dark(#225bff, #fdee8c)',
					color: 'light-dark(#225bff, #fdee8c)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'light-dark(#225bff14, #fdee8c14)'
				}
			}
		},
		'complex-selector': {
			'variant:secondary': {
				backgroundColor: 'transparent',
				borderWidth: '1.5px',
				borderStyle: 'solid',
				borderColor: 'light-dark(#225bff, #fdee8c)',
				color: 'light-dark(#225bff, #fdee8c)',
				':hover:not(:has(> :is(:disabled, [aria-disabled="true"])))': {
					backgroundColor: 'light-dark(#225bff14, #fdee8c14)'
				}
			}
		},
		typeahead: {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		},
		tokenizer: {
			base: {
				paddingBlock: 'var(--spacing-2)',
				paddingInline: 'var(--spacing-3)',
				borderColor: 'var(--color-border)'
			},
			'status:success': {
				'--color-border-success': 'light-dark(#4a984a, #7bbf7a)',
				'--color-icon-success': 'light-dark(#4a984a, #7bbf7a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#958500, #dfcf5b)',
				'--color-icon-warning': 'light-dark(#958500, #dfcf5b)'
			},
			'status:error': {
				'--color-border-error': '#e56241',
				'--color-icon-error': '#e56241'
			}
		}
	}
});

/**
 * Raw tonal palettes — generated from design-spec source hexes via the
 * same CIELab algorithm `ThemePalettePreview` uses for the displayed
 * strip, so the rendered ramp and the consumed token values are 1:1.
 *
 * Source colors:
 *   accent  #225BFF   neutral #868B99
 *   red     #ffc3b8   orange  #ffc98d   yellow  #feee7b
 *   green   #bdebb4   cyan    #abf1f1   teal    #aeefd6
 *   blue    #cdd5fc   purple  #e6c2ff   pink    #fec0f5
 *   error   #fc473b   warning #ffc502   success #91D143
 *
 * Categorical sources are the pastel pill hexes from the design spec so
 * each ramp's T85 lands directly on the card / badge background color.
 * Semantic sources are vivid so the ramp anchors near the badge fill.
 *
 * Regenerate with: node packages/themes/butter/scripts/generate-palettes.mjs
 */
export const butterPalettes = {
	blue: {
		0: '#000000',
		5: '#001041',
		10: '#001b4c',
		15: '#002558',
		20: '#062f63',
		25: '#203a6c',
		30: '#324575',
		35: '#41517d',
		40: '#505d86',
		45: '#5f698f',
		50: '#6d7698',
		55: '#7a82a6',
		60: '#878fb3',
		65: '#949cc1',
		70: '#a2aacf',
		75: '#afb7dd',
		80: '#bdc5eb',
		85: '#cbd3f9',
		90: '#dbe1ff',
		95: '#edf0ff',
		100: '#ffffff'
	},
	cyan: {
		0: '#000000',
		5: '#001d1e',
		10: '#00262a',
		15: '#003034',
		20: '#003a3e',
		25: '#004649',
		30: '#005255',
		35: '#005e61',
		40: '#006a6d',
		45: '#1f7678',
		50: '#3c8183',
		55: '#4a8e90',
		60: '#579c9d',
		65: '#65a9aa',
		70: '#72b7b8',
		75: '#80c4c5',
		80: '#8dd2d3',
		85: '#9be0e1',
		90: '#a9eff0',
		95: '#b7fdfe',
		100: '#ffffff'
	},
	green: {
		0: '#000000',
		5: '#001f00',
		10: '#002800',
		15: '#003100',
		20: '#003c00',
		25: '#004800',
		30: '#01530d',
		35: '#1f5f1f',
		40: '#346a30',
		45: '#467640',
		50: '#578151',
		55: '#648e5d',
		60: '#709c6a',
		65: '#7da976',
		70: '#8ab783',
		75: '#98c490',
		80: '#a5d29d',
		85: '#b3e0ab',
		90: '#c1efb8',
		95: '#cffdc6',
		100: '#ffffff'
	},
	orange: {
		0: '#000000',
		5: '#2d0600',
		10: '#381200',
		15: '#461b00',
		20: '#542400',
		25: '#622e00',
		30: '#6d3a00',
		35: '#794700',
		40: '#845406',
		45: '#906121',
		50: '#9b6e36',
		55: '#a97b42',
		60: '#b7874e',
		65: '#c6945b',
		70: '#d4a267',
		75: '#e3af74',
		80: '#f2bd81',
		85: '#ffcb8e',
		90: '#ffdcb6',
		95: '#ffedda',
		100: '#ffffff'
	},
	pink: {
		0: '#000000',
		5: '#3c003d',
		10: '#490048',
		15: '#560054',
		20: '#62005f',
		25: '#6c0a68',
		30: '#762371',
		35: '#80357a',
		40: '#894583',
		45: '#93558c',
		50: '#9c6496',
		55: '#aa71a3',
		60: '#b77eb0',
		65: '#c58bbe',
		70: '#d398cc',
		75: '#e2a6da',
		80: '#f0b3e8',
		85: '#ffc1f6',
		90: '#ffd5fb',
		95: '#ffeafd',
		100: '#ffffff'
	},
	purple: {
		0: '#000000',
		5: '#1e004f',
		10: '#2b005c',
		15: '#390268',
		20: '#461373',
		25: '#52237b',
		30: '#5d3283',
		35: '#69408b',
		40: '#744e92',
		45: '#7f5c9a',
		50: '#8b6aa2',
		55: '#9877b0',
		60: '#a584bd',
		65: '#b391cb',
		70: '#c19ed9',
		75: '#cfabe8',
		80: '#ddb9f6',
		85: '#eac8ff',
		90: '#f2daff',
		95: '#f9ecff',
		100: '#ffffff'
	},
	red: {
		0: '#000000',
		5: '#3e0000',
		10: '#490000',
		15: '#550000',
		20: '#62100f',
		25: '#6d211c',
		30: '#773029',
		35: '#823f36',
		40: '#8c4d44',
		45: '#955b52',
		50: '#9f6961',
		55: '#ad766d',
		60: '#bb837a',
		65: '#c99087',
		70: '#d79d94',
		75: '#e6aba1',
		80: '#f4b8ae',
		85: '#ffc7bd',
		90: '#ffdad3',
		95: '#ffece8',
		100: '#ffffff'
	},
	teal: {
		0: '#000000',
		5: '#001f00',
		10: '#00280b',
		15: '#003216',
		20: '#003d22',
		25: '#00482d',
		30: '#005439',
		35: '#005f45',
		40: '#136b52',
		45: '#30775f',
		50: '#46826d',
		55: '#528f79',
		60: '#5f9d86',
		65: '#6caa93',
		70: '#7ab8a0',
		75: '#87c5ae',
		80: '#94d3bb',
		85: '#a2e1c9',
		90: '#b0f0d7',
		95: '#befee5',
		100: '#ffffff'
	},
	yellow: {
		0: '#000000',
		5: '#1e1200',
		10: '#271c00',
		15: '#2e2700',
		20: '#373200',
		25: '#413e00',
		30: '#4c4a00',
		35: '#575600',
		40: '#646200',
		45: '#726e00',
		50: '#817a00',
		55: '#8e860e',
		60: '#9c9320',
		65: '#aba02f',
		70: '#b9ae3d',
		75: '#c7bb4a',
		80: '#d6c957',
		85: '#e5d765',
		90: '#f4e572',
		95: '#fff294',
		100: '#ffffff'
	},
	neutral: {
		0: '#000000',
		5: '#051124',
		10: '#101c2f',
		15: '#1b263a',
		20: '#273045',
		25: '#333b4f',
		30: '#3f4759',
		35: '#4b5264',
		40: '#585e6f',
		45: '#656a79',
		50: '#727784',
		55: '#7f8491',
		60: '#8c909f',
		65: '#999eac',
		70: '#a6abba',
		75: '#b4b9c7',
		80: '#c1c6d5',
		85: '#cfd4e3',
		90: '#dde2f2',
		95: '#ebf0ff',
		100: '#ffffff'
	},
	accent: {
		0: '#000000',
		5: '#00085e',
		10: '#00136c',
		15: '#001c7e',
		20: '#002592',
		25: '#002fa7',
		30: '#0039be',
		35: '#0043d7',
		40: '#004df0',
		45: '#0759ff',
		50: '#4a67ff',
		55: '#6875ff',
		60: '#8083ff',
		65: '#9492ff',
		70: '#a6a1ff',
		75: '#b6b0ff',
		80: '#c6bfff',
		85: '#d5cfff',
		90: '#e3dfff',
		95: '#f1efff',
		100: '#ffffff'
	},
	error: {
		0: '#000000',
		5: '#470000',
		10: '#530000',
		15: '#600000',
		20: '#6d0000',
		25: '#771210',
		30: '#82261e',
		35: '#8c372c',
		40: '#96463b',
		45: '#a0564a',
		50: '#a96559',
		55: '#b77265',
		60: '#c57e72',
		65: '#d48b7e',
		70: '#e2998b',
		75: '#f1a698',
		80: '#ffb4a6',
		85: '#ffc7bc',
		90: '#ffdad2',
		95: '#ffece8',
		100: '#ffffff'
	},
	warning: {
		0: '#000000',
		5: '#270c00',
		10: '#301800',
		15: '#3b2200',
		20: '#472c00',
		25: '#543700',
		30: '#614200',
		35: '#6f4d00',
		40: '#7d5800',
		45: '#8b6400',
		50: '#9a7000',
		55: '#a97d00',
		60: '#b88900',
		65: '#c89600',
		70: '#d8a300',
		75: '#e7b100',
		80: '#f7be00',
		85: '#ffcd51',
		90: '#ffde9c',
		95: '#ffeed0',
		100: '#ffffff'
	},
	success: {
		0: '#000000',
		5: '#001a00',
		10: '#092300',
		15: '#0b2e00',
		20: '#043b00',
		25: '#004700',
		30: '#005400',
		35: '#036100',
		40: '#136e00',
		45: '#277b00',
		50: '#448700',
		55: '#529400',
		60: '#60a105',
		65: '#6eaf1d',
		70: '#7cbd2e',
		75: '#8bcb3c',
		80: '#99d94b',
		85: '#a7e758',
		90: '#b5f566',
		95: '#ccff88',
		100: '#ffffff'
	}
} as const;
