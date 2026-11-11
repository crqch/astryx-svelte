/**
 * Neutral Theme — ported from Astryx's `packages/themes/neutral/src/neutralTheme.ts`.
 *
 * A pure grayscale spine with a from-scratch OKLCH-derived categorical palette.
 * Hues sit at evenly-spaced positions on the OKLCH wheel, chosen to stay
 * recognisable at every tone (no red drift for orange, no blue drift for purple)
 * and well separated from their neighbours.
 *
 * Core neutral palette: #fafafa, #f5f5f5, #e5e5e5, #737373, #262626, #0a0a0a
 *
 * Categorical hues (OKLCH; chroma = max-in-gamut at the saturated stop):
 *   Red H=25    Orange H=65    Yellow H=90    Green H=145
 *   Teal H=180  Cyan H=215     Blue H=250     Purple H=320  Pink H=355
 *
 * Token tonal stops:
 *   bg = T90 (light) / T20 (dark)   border = T80 / T30
 *   icon = T30 / T80                text   = T30 / T80
 *
 * All nine saturated badge values pass WCAG AA against their own label (>= 4.5:1).
 *
 * Only tokens that differ from the defaults are overridden.
 *
 * ## Where `icons` went
 *
 * Upstream's `neutralTheme.ts` ends with `icons: neutralIconRegistry`. This file
 * cannot: the registry's values are snippets, snippets only exist in markup, and
 * this module is imported by `scripts/build-theme.mjs` under plain Node, which
 * cannot parse a `.svelte` import. The registry lives in `src/icons.svelte` and
 * the build attaches it to the theme object it emits, so the *published* shape
 * matches upstream — `neutralTheme.icons` is the registry, and the package
 * exports `neutralIconRegistry` alongside it. See `buildThemePackage`'s `icons`
 * parameter for the full reasoning.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/**
 * Neutral syntax palette — ported from upstream 0.7.13's resolved values, whose
 * source draws each slot from the categorical ramp stops. The five diff row
 * slots are included: upstream's `defineSyntaxTheme` fills unset ones from the
 * theme's own punctuation, and those defaults are what the oracle compares.
 */
const neutralSyntax = defineSyntaxTheme({
	name: 'astryx-neutral',
	tokens: {
		keyword: 'light-dark(#6b187c, #efa8ff)',
		string: 'light-dark(#0b5615, #a4d6a3)',
		comment: 'light-dark(#525252, #b9b9b9)',
		number: 'light-dark(#733100, #ffb37e)',
		function: 'light-dark(#00458c, #a1caff)',
		type: 'light-dark(#6b187c, #efa8ff)',
		variable: 'light-dark(#111111, #e2e2e2)',
		operator: 'light-dark(#525252, #b9b9b9)',
		constant: 'light-dark(#733100, #ffb37e)',
		tag: 'light-dark(#8a0011, #ffaea7)',
		attribute: 'light-dark(#584400, #eec448)',
		property: 'light-dark(#005348, #90d7c8)',
		punctuation: 'light-dark(#525252, #b9b9b9)',
		background: 'light-dark(#ffffff, #111111)',
		added: 'color-mix(in srgb, var(--color-success-muted) 25%, transparent)',
		removed: 'color-mix(in srgb, var(--color-error-muted) 25%, transparent)',
		'diff-header': 'transparent',
		'added-marker': 'var(--color-syntax-punctuation)',
		'removed-marker': 'var(--color-syntax-punctuation)'
	}
});

export const neutralTheme = defineTheme({
	name: 'neutral',

	// Figtree across body, heading and display; monospace stays the platform
	// default for code. Scale base=14, ratio=1.2, with bold h3/h4.
	typography: {
		scale: { base: 14, ratio: 1.2 },
		body: {
			family: 'Figtree',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Figtree',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
			weights: { 3: 'bold', 4: 'bold' }
		},
		code: {
			family: 'ui-monospace',
			fallbacks: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
		}
	},

	// Touch + narrow: floor the base at 16px and re-derive the ratio so Display 1
	// keeps its desktop size (ratio' = 1.2 * (14/16)^(1/6)).
	adaptations: {
		widthBreakpoints: {
			sm: 640,
			md: 768,
			lg: 1024,
			xl: 1280,
			'2xl': 1536
		},
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

	// Snappier than default, matching shadcn/Tailwind conventions.
	motion: { fast: 125, medium: 300, slow: 700, ratio: 0.75 },

	syntax: neutralSyntax,

	localTokens: {
		'--astryx-theme-neutral-color-status-fill-accent': 'light-dark(#0074e2, #6d9cfe)'
	},

	tokens: {
		'--color-background-surface': ['#ffffff', '#262626'],
		'--color-background-body': ['#f1f1f1', '#1b1b1b'],
		'--color-background-card': ['#ffffff', '#1b1b1b'],
		'--color-background-popover': ['#ffffff', '#1b1b1b'],
		'--color-background-muted': ['#f1f1f1', '#1b1b1b'],
		'--color-accent': ['#1b1b1b', '#f1f1f1'],
		'--color-accent-muted': ['#d4d4d4', '#474747'],
		'--color-neutral': ['#0000000F', '#ffffff1A'],
		'--color-overlay': ['#00000080', '#000000CC'],
		'--color-overlay-hover': ['#0000000D', '#ffffff0D'],
		'--color-overlay-pressed': ['#0000001A', '#ffffff1A'],
		'--color-text-primary': ['#000000', '#ffffff'],
		'--color-text-secondary': ['#474747', '#9e9e9e'],
		'--color-text-disabled': ['#919191', '#525252'],
		'--color-text-accent': ['#1b1b1b', '#f1f1f1'],
		'--color-on-dark': '#ffffff',
		'--color-on-light': '#111111',
		'--color-on-accent': ['#ffffff', '#111111'],
		'--color-on-success': ['#ffffff', '#111111'],
		'--color-on-error': ['#ffffff', '#111111'],
		'--color-on-warning': '#111111',
		'--color-info': ['#0074e2', '#6d9cfe'],
		'--color-info-muted': ['#b9d7ff', '#88bcff3D'],
		'--color-on-info': ['#ffffff', '#111111'],
		'--color-text-info': ['#0067ce', '#a1caff'],
		'--color-text-success': ['#2f7d33', '#90ca90'],
		'--color-text-warning': ['#836700', '#eec448'],
		'--color-text-error': ['#c0262c', '#ffaea7'],
		'--color-on-info-muted': ['#003978', '#a1caff'],
		'--color-on-success-muted': ['#00490b', '#90ca90'],
		'--color-on-warning-muted': ['#4b3900', '#eec448'],
		'--color-on-error-muted': ['#76000c', '#ffaea7'],
		'--color-icon-accent': ['#1b1b1b', '#f1f1f1'],
		'--color-icon-primary': ['#000000', '#ffffff'],
		'--color-icon-secondary': ['#6a6a6a', '#9e9e9e'],
		'--color-icon-disabled': ['#919191', '#525252'],
		'--color-success': ['#198100', '#64af4c'],
		'--color-warning': '#ffce2f',
		'--color-error': ['#c9303a', '#ff705d'],
		'--color-success-muted': ['#bce0bb', '#90ca903D'],
		'--color-error-muted': ['#ffc4be', '#ff98903D'],
		'--color-warning-muted': ['#fae19e', '#e2b6233D'],
		'--color-border': ['#00000014', '#ffffff1A'],
		'--color-border-emphasized': ['#d4d4d4', '#525252'],
		'--color-skeleton': ['#f1f1f1', '#525252'],
		'--color-shadow': ['#0000001A', '#0000004D'],
		'--color-tint-hover': ['#000000', '#ffffff'],
		'--color-background-red': ['#ffc4be', '#5b2b28'],
		'--color-border-red': ['#ffaea7', '#fa6762'],
		'--color-icon-red': ['#76000c', '#ff9890'],
		'--color-text-red': ['#76000c', '#ffaea7'],
		'--color-background-orange': ['#ffc7a1', '#503424'],
		'--color-border-orange': ['#ffc7a1', '#df843f'],
		'--color-icon-orange': ['#622700', '#ff9e55'],
		'--color-text-orange': ['#622700', '#ffb37e'],
		'--color-background-yellow': ['#fae19e', '#453a1c'],
		'--color-border-yellow': ['#e3c36c', '#c29900'],
		'--color-icon-yellow': ['#4b3900', '#e2b623'],
		'--color-text-yellow': ['#4b3900', '#eec448'],
		'--color-background-green': ['#bce0bb', '#2b422b'],
		'--color-border-green': ['#aad4a9', '#6ab26b'],
		'--color-icon-green': ['#00490b', '#90ca90'],
		'--color-text-green': ['#00490b', '#90ca90'],
		'--color-background-teal': ['#a9e2d6', '#28413c'],
		'--color-border-teal': ['#90d7c8', '#4fb1a0'],
		'--color-icon-teal': ['#00463d', '#81c9bb'],
		'--color-text-teal': ['#00463d', '#90d7c8'],
		'--color-background-cyan': ['#9ae2f4', '#274046'],
		'--color-border-cyan': ['#85d5e9', '#49adc4'],
		'--color-icon-cyan': ['#004351', '#71c7dd'],
		'--color-text-cyan': ['#004351', '#85d5e9'],
		'--color-background-blue': ['#b9d7ff', '#253c5a'],
		'--color-border-blue': ['#a1caff', '#5aa0f8'],
		'--color-icon-blue': ['#003978', '#88bcff'],
		'--color-text-blue': ['#003978', '#a1caff'],
		'--color-background-purple': ['#f7d5ff', '#4a2f51'],
		'--color-border-purple': ['#f3bfff', '#d885eb'],
		'--color-icon-purple': ['#5c0e6c', '#e496f6'],
		'--color-text-purple': ['#5c0e6c', '#eaacf8'],
		'--color-background-pink': ['#ffc0d7', '#572b3d'],
		'--color-border-pink': ['#ffc0d7', '#fc78b1'],
		'--color-icon-pink': ['#70003f', '#fd92bd'],
		'--color-text-pink': ['#70003f', '#ffa9ca'],
		'--color-background-gray': ['#e2e2e2', '#303030'],
		'--color-border-gray': ['#d4d4d4', '#262626'],
		'--color-icon-gray': ['#474747', '#9e9e9e'],
		'--color-text-gray': ['#1b1b1b', '#d4d4d4'],
		'--radius-none': '0px',
		'--radius-inner': '0.375rem',
		'--radius-element': '0.625rem',
		'--radius-container': '0.75rem',
		'--radius-page': '1.75rem',
		'--radius-full': '9999px',
		'--shadow-low':
			'0 2px 4px light-dark(oklch(0 0 0 / 5%), oklch(0 0 0 / 25%)), 0 4px 8px light-dark(oklch(0 0 0 / 10%), oklch(0 0 0 / 40%)), inset 0 0 0 1px light-dark(transparent, oklch(1 0 0 / 8%))',
		'--shadow-med':
			'0 2px 4px light-dark(oklch(0 0 0 / 5%), oklch(0 0 0 / 35%)), 0 4px 12px light-dark(oklch(0 0 0 / 10%), oklch(0 0 0 / 50%)), inset 0 0 0 1px light-dark(transparent, oklch(1 0 0 / 12%))',
		'--shadow-high':
			'0 4px 6px light-dark(oklch(0 0 0 / 10%), oklch(0 0 0 / 50%)), 0 12px 24px light-dark(oklch(0 0 0 / 15%), oklch(0 0 0 / 70%)), inset 0 0 0 1px light-dark(transparent, oklch(1 0 0 / 15%))',
		'--shadow-inset-hover': 'inset 0px 0px 0px 2px #0074e24D',
		'--shadow-inset-selected': 'inset 0px 0px 0px 2px #0074e280',
		'--shadow-inset-success': 'inset 0px 0px 0px 2px #2f7d334D',
		'--shadow-inset-warning': 'inset 0px 0px 0px 2px #f8d36a4D',
		'--shadow-inset-error': 'inset 0px 0px 0px 2px #de47454D'
	},

	components: {
		item: {
			selected: {
				'--color-text-secondary': 'light-dark(#474747, #c6c6c6)'
			}
		},
		'tree-list-item': {
			selected: {
				'--color-text-secondary': 'light-dark(#474747, #c6c6c6)'
			}
		},
		'file-input': {
			'mode:dropzone': {
				'--color-text-secondary': 'light-dark(#474747, #c6c6c6)'
			}
		},
		citation: {
			'variant:number': {
				'--color-text-secondary': 'light-dark(#474747, #c6c6c6)'
			}
		},
		button: {
			'variant:destructive': {
				backgroundColor: 'var(--color-error-muted)',
				color: 'var(--color-on-error-muted)'
			}
		},
		badge: {
			'variant:neutral': {
				backgroundColor: 'var(--color-background-gray)',
				color: 'var(--color-text-gray)'
			},
			'variant:red': {
				backgroundColor: 'var(--color-background-red)',
				color: 'var(--color-text-red)'
			},
			'variant:orange': {
				backgroundColor: 'var(--color-background-orange)',
				color: 'var(--color-text-orange)'
			},
			'variant:yellow': {
				backgroundColor: 'var(--color-background-yellow)',
				color: 'var(--color-text-yellow)'
			},
			'variant:green': {
				backgroundColor: 'var(--color-background-green)',
				color: 'var(--color-text-green)'
			},
			'variant:teal': {
				backgroundColor: 'var(--color-background-teal)',
				color: 'var(--color-text-teal)'
			},
			'variant:cyan': {
				backgroundColor: 'var(--color-background-cyan)',
				color: 'var(--color-text-cyan)'
			},
			'variant:blue': {
				backgroundColor: 'var(--color-background-blue)',
				color: 'var(--color-text-blue)'
			},
			'variant:purple': {
				backgroundColor: 'var(--color-background-purple)',
				color: 'var(--color-text-purple)'
			},
			'variant:pink': {
				backgroundColor: 'var(--color-background-pink)',
				color: 'var(--color-text-pink)'
			},
			'variant:gray': {
				backgroundColor: 'var(--color-background-gray)',
				color: 'var(--color-text-gray)'
			}
		},
		'segmented-control': {
			base: {
				padding: 'var(--spacing-1)'
			}
		},
		'segmented-control-item': {
			base: {
				'--color-text-secondary': 'light-dark(#474747, #c6c6c6)'
			},
			'size:sm': {
				height: 'calc(var(--size-element-sm) - 8px)'
			},
			'size:md': {
				height: 'calc(var(--size-element-md) - 8px)'
			},
			'size:lg': {
				height: 'calc(var(--size-element-lg) - 8px)'
			},
			selected: {
				boxShadow: 'none'
			}
		},
		switch: {
			base: {
				'--color-background-gray': 'var(--color-border-emphasized)'
			}
		},
		'progress-bar': {
			base: {
				'--color-background-muted': 'var(--color-border-emphasized)'
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
