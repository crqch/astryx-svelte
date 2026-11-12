/**
 * Stone Theme — ported from Astryx's `packages/themes/stone/src/stoneTheme.ts`.
 *
 * Transcribed verbatim but for the two things every theme package here changes:
 * core's deep `dist/` imports in place of the `@astryxdesign/core/theme` barrel
 * (the barrel re-exports `theme.svelte`, and this file is on the theme build's
 * plain-Node import path), and the dropped `icons: stoneIconRegistry` — the
 * standing Phase 3 icon-registry debt, which contributes nothing to `theme.css`.
 *
 * A warm, earthy neutral theme inspired by natural stone and sandstone.
 * Core palette: #28282A, #84848B, #D8D8DB, #f3f3f5, #FFFFFF
 * Montserrat for headings, Figtree for body, JetBrains Mono for code.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-sv/core/theme/define';

/** Stone syntax palette — upstream 0.7.13's resolved values. */
const stoneSyntax = defineSyntaxTheme({
	name: 'astryx-stone',
	tokens: {
		keyword: 'light-dark(#635a70, #b0a5c0)',
		string: 'light-dark(#40675c, #90ba8a)',
		comment: 'light-dark(#5f5f64, #ababb3)',
		number: 'light-dark(#745752, #c9a382)',
		function: 'light-dark(#516074, #9aadc7)',
		type: 'light-dark(#635a70, #b0a5c0)',
		variable: 'light-dark(#5f5f64, #ababb3)',
		operator: 'light-dark(#5f5f64, #ababb3)',
		constant: 'light-dark(#745752, #c9a382)',
		tag: 'light-dark(#745752, #c6a29c)',
		attribute: 'light-dark(#736419, #c2af6e)',
		property: 'light-dark(#40675c, #94b3a9)',
		punctuation: 'light-dark(#5f5f64, #ababb3)',
		background: 'light-dark(#f0f0f7, #101018)',
		added: 'light-dark(#d2eccf40, #b3d0af33)',
		removed: 'light-dark(#fbdad440, #e0bdb833)',
		'diff-header': 'transparent',
		'added-marker': 'light-dark(#354f31, #d5e9d2)',
		'removed-marker': 'light-dark(#603c37, #f7dbd7)'
	}
});

/**
 * Stone theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const stoneTheme = defineTheme({
	name: 'stone',

	typography: {
		scale: {
			base: 14,
			ratio: 1.25
		},
		body: {
			family: 'Figtree',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Montserrat',
			fallbacks:
				'"Figtree", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
	syntax: stoneSyntax,
	tokens: {
		'--color-accent': 'light-dark(#25252a, #f0f0f9)',
		'--color-accent-muted': 'light-dark(#25252a14, #f0f0f920)',
		'--color-neutral': 'light-dark(#25252a0f, #f0f0f91a)',
		'--color-background-surface': 'light-dark(#ffffff, #1b1b21)',
		'--color-background-body': 'light-dark(#f0f0f7, #101018)',
		'--color-overlay': 'light-dark(#25252a80, #25252acc)',
		'--color-overlay-hover': 'light-dark(#25252a0d, #f0f0f90d)',
		'--color-overlay-pressed': 'light-dark(#25252a1a, #f0f0f91a)',
		'--color-background-muted': 'light-dark(#e2e2e8, #3a3a42)',
		'--color-text-primary': 'light-dark(#25252a, #f0f0f9)',
		'--color-text-secondary': 'light-dark(#5f5f64, #ababb3)',
		'--color-text-disabled': 'light-dark(#d4d3dd, #5e5e64)',
		'--color-text-accent': 'light-dark(#25252a, #f0f0f9)',
		'--color-on-dark': '#ffffff',
		'--color-on-light': 'light-dark(#25252a, #25252a)',
		'--color-on-accent': 'light-dark(#ffffff, #25252a)',
		'--color-on-success': 'light-dark(#ffffff, #1b1b21)',
		'--color-on-error': 'light-dark(#ffffff, #1b1b21)',
		'--color-on-warning': 'light-dark(#ffffff, #1b1b21)',
		'--color-info': 'light-dark(#516074, #9aadc7)',
		'--color-info-muted': 'light-dark(#d3e4fc, #2c3c52)',
		'--color-on-info': 'light-dark(#ffffff, #25252a)',
		'--color-text-info': 'light-dark(#344861, #d5e4f8)',
		'--color-text-success': 'light-dark(#354f31, #d5e9d2)',
		'--color-text-warning': 'light-dark(#524818, #f1e1b9)',
		'--color-text-error': 'light-dark(#603c37, #f7dbd7)',
		'--color-on-info-muted': 'light-dark(#344861, #d5e4f8)',
		'--color-on-success-muted': 'light-dark(#354f31, #2f412c)',
		'--color-on-warning-muted': 'light-dark(#524818, #433b1b)',
		'--color-on-error-muted': 'light-dark(#603c37, #50332e)',
		'--color-icon-accent': 'light-dark(#25252a, #f0f0f9)',
		'--color-icon-primary': 'light-dark(#25252a, #f0f0f9)',
		'--color-icon-secondary': 'light-dark(#848489, #9d9ea5)',
		'--color-icon-disabled': 'light-dark(#d4d3dd, #5e5e64)',
		'--color-background-card': 'light-dark(#ffffff, #25252a)',
		'--color-background-popover': 'light-dark(#ffffff, #302f36)',
		'--color-background-inverted': 'light-dark(#25252a, #f0f0f9)',
		'--color-success': 'light-dark(#354f31, #b3d0af)',
		'--color-success-muted': 'light-dark(#d2eccf, #b3d0af)',
		'--color-error': 'light-dark(#603c37, #e0bdb8)',
		'--color-error-muted': 'light-dark(#fbdad4, #e0bdb8)',
		'--color-warning': 'light-dark(#524818, #d9c794)',
		'--color-warning-muted': 'light-dark(#f4e1b7, #d9c794)',
		'--color-border': 'light-dark(#e2e2e8, #f0f0f91a)',
		'--color-border-emphasized': 'light-dark(#848489, #5e5e64)',
		'--color-skeleton': 'light-dark(#d4d3dd, #5e5e64)',
		'--color-shadow': 'light-dark(#25252a1a, #0000004d)',
		'--color-tint-hover': 'light-dark(#000000, #ffffff)',
		'--color-background-blue': 'light-dark(#d3e4fc, #445469)',
		'--color-border-blue': 'light-dark(#c2d6f1, #2c3c52)',
		'--color-icon-blue': 'light-dark(#344861, #d5e4f8)',
		'--color-text-blue': 'light-dark(#344861, #d5e4f8)',
		'--color-background-cyan': 'light-dark(#cbe9f0, #345761)',
		'--color-border-cyan': 'light-dark(#badbe4, #234048)',
		'--color-icon-cyan': 'light-dark(#264d57, #cfe8ee)',
		'--color-text-cyan': 'light-dark(#264d57, #cfe8ee)',
		'--color-background-gray': 'light-dark(#e2e2e8, #525159)',
		'--color-border-gray': 'light-dark(#d4d3dd, #3a3a42)',
		'--color-icon-gray': 'light-dark(#46464e, #e2e2e8)',
		'--color-text-gray': 'light-dark(#46464e, #e2e2e8)',
		'--color-background-green': 'light-dark(#d2eccf, #3e5d38)',
		'--color-border-green': 'light-dark(#bfdfbb, #2f412c)',
		'--color-icon-green': 'light-dark(#354f31, #d5e9d2)',
		'--color-text-green': 'light-dark(#354f31, #d5e9d2)',
		'--color-background-orange': 'light-dark(#ffdcbb, #684c34)',
		'--color-border-orange': 'light-dark(#f2cdaa, #4e3522)',
		'--color-icon-orange': 'light-dark(#5e3f27, #ffdcbb)',
		'--color-text-orange': 'light-dark(#5e3f27, #ffdcbb)',
		'--color-background-pink': 'light-dark(#f5d9ea, #624a59)',
		'--color-border-pink': 'light-dark(#e9cadc, #4b3242)',
		'--color-icon-pink': 'light-dark(#5a3c4f, #f2dbe8)',
		'--color-text-pink': 'light-dark(#5a3c4f, #f2dbe8)',
		'--color-background-purple': 'light-dark(#e7def5, #574e64)',
		'--color-border-purple': 'light-dark(#d9cfea, #3f374c)',
		'--color-icon-purple': 'light-dark(#4c405b, #e6def3)',
		'--color-text-purple': 'light-dark(#4c405b, #e6def3)',
		'--color-background-red': 'light-dark(#fbdad4, #684a45)',
		'--color-border-red': 'light-dark(#f0cac4, #50332e)',
		'--color-icon-red': 'light-dark(#603c37, #f7dbd7)',
		'--color-text-red': 'light-dark(#603c37, #f7dbd7)',
		'--color-background-teal': 'light-dark(#d4e8e1, #3a5b50)',
		'--color-border-teal': 'light-dark(#c3dbd2, #274239)',
		'--color-icon-teal': 'light-dark(#2c4f44, #d6e7e1)',
		'--color-text-teal': 'light-dark(#2c4f44, #d6e7e1)',
		'--color-background-yellow': 'light-dark(#f4e1b7, #615620)',
		'--color-border-yellow': 'light-dark(#e7d3a4, #433b1b)',
		'--color-icon-yellow': 'light-dark(#524818, #f1e1b9)',
		'--color-text-yellow': 'light-dark(#524818, #f1e1b9)',
		'--radius-none': '0px',
		'--radius-inner': '0.25rem',
		'--radius-element': '0.5rem',
		'--radius-container': '0.75rem',
		'--radius-page': '1.5rem',
		'--radius-full': '9999px',
		'--shadow-low': '0 2px 4px #25252a0d, 0 4px 8px #25252a1a',
		'--shadow-med': '0 2px 4px #25252a0d, 0 4px 12px #25252a1a',
		'--shadow-high': '0 4px 6px #25252a1a, 0 12px 24px #25252a26',
		'--shadow-inset-hover': 'inset 0 0 0 2px #25252a30',
		'--shadow-inset-selected': 'inset 0 0 0 2px #25252a50',
		'--shadow-inset-success': 'inset 0 0 0 2px #84848930',
		'--shadow-inset-warning': 'inset 0 0 0 2px #84848930',
		'--shadow-inset-error': 'inset 0 0 0 2px #84848930',
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
				backgroundColor: 'transparent',
				borderWidth: '1.5px',
				borderStyle: 'solid',
				borderColor: 'var(--color-border-emphasized)',
				':hover': {
					backgroundColor: 'var(--color-neutral)'
				}
			},
			'variant:destructive': {
				backgroundColor: 'var(--color-background-red)',
				color: 'var(--color-text-red)'
			}
		},
		badge: {
			'variant:info': {
				backgroundColor: 'var(--color-background-blue)',
				color: 'var(--color-text-blue)'
			},
			'variant:neutral': {
				backgroundColor: 'var(--color-background-gray)',
				color: 'var(--color-text-gray)'
			},
			'variant:success': {
				backgroundColor: 'var(--color-background-green)',
				color: 'var(--color-text-green)'
			},
			'variant:warning': {
				backgroundColor: 'var(--color-background-yellow)',
				color: 'var(--color-text-yellow)'
			},
			'variant:error': {
				backgroundColor: 'var(--color-background-red)',
				color: 'var(--color-text-red)'
			}
		},
		banner: {
			'status:info': {
				'--color-info-muted': 'var(--color-background-blue)',
				'--color-on-info-muted': 'var(--color-text-blue)'
			},
			'status:success': {
				'--color-success-muted': 'var(--color-background-green)',
				'--color-on-success-muted': 'var(--color-text-green)'
			},
			'status:warning': {
				'--color-warning-muted': 'var(--color-background-yellow)',
				'--color-on-warning-muted': 'var(--color-text-yellow)'
			},
			'status:error': {
				'--color-error-muted': 'var(--color-background-red)',
				'--color-on-error-muted': 'var(--color-text-red)'
			}
		},
		'progress-bar-fill': {
			'variant:accent': {
				backgroundColor: 'light-dark(#d3e4fc, #9aadc7)'
			},
			'variant:success': {
				backgroundColor: 'light-dark(#d2eccf, #90ba8a)'
			},
			'variant:warning': {
				backgroundColor: 'light-dark(#f4e1b7, #c2af6e)'
			},
			'variant:error': {
				backgroundColor: 'light-dark(#fbdad4, #c6a29c)'
			}
		},
		'progress-bar-mark': {
			'placement:fill+variant:accent': {
				backgroundColor: 'var(--color-on-light)'
			},
			'placement:fill+variant:success': {
				backgroundColor: 'var(--color-on-light)'
			},
			'placement:fill+variant:warning': {
				backgroundColor: 'var(--color-on-light)'
			},
			'placement:fill+variant:error': {
				backgroundColor: 'var(--color-on-light)'
			}
		},
		'progress-bar-track': {
			base: {
				backgroundColor: 'var(--color-skeleton)'
			}
		},
		switch: {
			base: {
				'--color-background-gray': 'var(--color-skeleton)'
			}
		},
		'field-status': {
			'type:success': {
				backgroundColor: 'var(--color-background-green)',
				color: 'var(--color-text-green)'
			},
			'type:warning': {
				backgroundColor: 'var(--color-background-yellow)',
				color: 'var(--color-text-yellow)'
			},
			'type:error': {
				backgroundColor: 'var(--color-background-red)',
				color: 'var(--color-text-red)'
			}
		},
		'text-input': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		'text-area': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		'number-input': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		'date-input': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		'time-input': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		selector: {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			},
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'transparent',
					borderWidth: '1.5px',
					borderStyle: 'solid',
					borderColor: 'var(--color-border-emphasized)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'var(--color-neutral)'
				}
			}
		},
		'multi-selector': {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			},
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'transparent',
					borderWidth: '1.5px',
					borderStyle: 'solid',
					borderColor: 'var(--color-border-emphasized)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'var(--color-neutral)'
				}
			}
		},
		'complex-selector': {
			'variant:secondary': {
				backgroundColor: 'transparent',
				borderWidth: '1.5px',
				borderStyle: 'solid',
				borderColor: 'var(--color-border-emphasized)',
				':hover:not(:has(> :is(:disabled, [aria-disabled="true"])))': {
					backgroundColor: 'var(--color-neutral)'
				}
			}
		},
		typeahead: {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
			}
		},
		tokenizer: {
			'status:success': {
				'--color-border-success': 'light-dark(#609757, #90ba8a)',
				'--color-icon-success': 'light-dark(#609757, #90ba8a)'
			},
			'status:warning': {
				'--color-border-warning': 'light-dark(#a08c36, #c2af6e)',
				'--color-icon-warning': 'light-dark(#a08c36, #c2af6e)'
			},
			'status:error': {
				'--color-border-error': 'light-dark(#a98984, #c6a29c)',
				'--color-icon-error': 'light-dark(#a98984, #c6a29c)'
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

/**
 * Raw tonal palettes — every color at every tone step (0–100 in 5s).
 * Same hue and chroma used to derive all theme tokens.
 * Use these for custom components or data visualization.
 */
export const stonePalettes = {
	neutral: {
		hue: 291,
		chroma: 3,
		0: '#000000',
		5: '#111015',
		10: '#1b1b1f',
		15: '#25252a',
		20: '#303034',
		25: '#3b3b3f',
		30: '#46464b',
		35: '#525257',
		40: '#5e5e63',
		45: '#6a6a6f',
		50: '#77777c',
		55: '#838388',
		60: '#909095',
		65: '#9d9da3',
		70: '#ababb0',
		75: '#b8b8be',
		80: '#c6c6cc',
		85: '#d4d4da',
		90: '#e2e2e8',
		95: '#f0f0f6',
		100: '#ffffff'
	},
	blue: {
		hue: 265,
		chroma: 10,
		0: '#000000',
		5: '#04121e',
		10: '#111c29',
		15: '#1b2734',
		20: '#26313f',
		25: '#313c4a',
		30: '#3c4856',
		35: '#485362',
		40: '#545f6e',
		45: '#606c7b',
		50: '#6c7888',
		55: '#798595',
		60: '#8692a2',
		65: '#939faf',
		70: '#a0acbd',
		75: '#adbacb',
		80: '#bbc8d9',
		85: '#c9d6e7',
		90: '#d7e4f5',
		95: '#e7f2ff',
		100: '#ffffff'
	},
	cyan: {
		hue: 190,
		chroma: 10,
		0: '#000000',
		5: '#001613',
		10: '#071f1e',
		15: '#122a28',
		20: '#1d3433',
		25: '#28403e',
		30: '#334b49',
		35: '#3e5755',
		40: '#4a6361',
		45: '#566f6d',
		50: '#627c7a',
		55: '#6f8986',
		60: '#7b9693',
		65: '#88a3a0',
		70: '#95b1ae',
		75: '#a3bebb',
		80: '#b0ccc9',
		85: '#bedad7',
		90: '#cce8e5',
		95: '#daf7f4',
		100: '#ffffff'
	},
	green: {
		hue: 142,
		chroma: 17,
		0: '#000000',
		5: '#001700',
		10: '#0c200a',
		15: '#162a16',
		20: '#213521',
		25: '#2b402b',
		30: '#374c36',
		35: '#425841',
		40: '#4e644d',
		45: '#5a7059',
		50: '#667d65',
		55: '#728a71',
		60: '#7f977e',
		65: '#8ca48b',
		70: '#99b298',
		75: '#a7bfa5',
		80: '#b4cdb2',
		85: '#c2dbc0',
		90: '#d0e9ce',
		95: '#def8dc',
		100: '#ffffff'
	},
	teal: {
		hue: 158,
		chroma: 9,
		0: '#000000',
		5: '#00150a',
		10: '#101e17',
		15: '#1a2921',
		20: '#25342b',
		25: '#303f36',
		30: '#3b4a41',
		35: '#46564d',
		40: '#526259',
		45: '#5e6e65',
		50: '#6a7b71',
		55: '#77887e',
		60: '#83958a',
		65: '#90a297',
		70: '#9dafa5',
		75: '#abbdb2',
		80: '#b8cbc0',
		85: '#c6d9ce',
		90: '#d4e7dc',
		95: '#e2f5ea',
		100: '#ffffff'
	},
	yellow: {
		hue: 90,
		chroma: 23,
		0: '#000000',
		5: '#1f0f00',
		10: '#261a00',
		15: '#2f2500',
		20: '#3a2f0d',
		25: '#463a18',
		30: '#524622',
		35: '#5e512d',
		40: '#6b5d39',
		45: '#786944',
		50: '#857650',
		55: '#92825c',
		60: '#9f8f68',
		65: '#ad9c75',
		70: '#bbaa81',
		75: '#c9b78e',
		80: '#d7c59c',
		85: '#e5d3a9',
		90: '#f4e1b7',
		95: '#ffefc7',
		100: '#ffffff'
	},
	orange: {
		hue: 70,
		chroma: 22,
		0: '#000000',
		5: '#250a00',
		10: '#2d1700',
		15: '#372104',
		20: '#432c12',
		25: '#4f361c',
		30: '#5b4227',
		35: '#684d32',
		40: '#75593d',
		45: '#826548',
		50: '#8f7154',
		55: '#9d7e60',
		60: '#aa8b6d',
		65: '#b89879',
		70: '#c6a586',
		75: '#d4b393',
		80: '#e3c0a0',
		85: '#f1ceae',
		90: '#ffdcbb',
		95: '#ffeddc',
		100: '#ffffff'
	},
	red: {
		hue: 33,
		chroma: 11,
		0: '#000000',
		5: '#210a04',
		10: '#2a1714',
		15: '#35211e',
		20: '#402b28',
		25: '#4c3633',
		30: '#58413e',
		35: '#644d49',
		40: '#715955',
		45: '#7e6561',
		50: '#8a716d',
		55: '#987e7a',
		60: '#a58b86',
		65: '#b39893',
		70: '#c0a5a1',
		75: '#ceb3ae',
		80: '#dcc0bc',
		85: '#ebcec9',
		90: '#f9dcd7',
		95: '#ffece9',
		100: '#ffffff'
	},
	pink: {
		hue: 340,
		chroma: 9,
		0: '#000000',
		5: '#1b0c16',
		10: '#251720',
		15: '#30222a',
		20: '#3b2c35',
		25: '#463740',
		30: '#52424c',
		35: '#5e4e57',
		40: '#6a5a63',
		45: '#776670',
		50: '#83727c',
		55: '#907f89',
		60: '#9d8c96',
		65: '#ab99a3',
		70: '#b8a6b1',
		75: '#c6b4be',
		80: '#d4c1cc',
		85: '#e2cfda',
		90: '#f0dde8',
		95: '#ffebf7',
		100: '#ffffff'
	},
	purple: {
		hue: 307,
		chroma: 11,
		0: '#000000',
		5: '#150e1d',
		10: '#1f1927',
		15: '#292332',
		20: '#342e3d',
		25: '#3f3949',
		30: '#4b4454',
		35: '#564f60',
		40: '#635b6d',
		45: '#6f6779',
		50: '#7b7486',
		55: '#888193',
		60: '#958da0',
		65: '#a39aad',
		70: '#b0a8bb',
		75: '#beb5c9',
		80: '#cbc3d7',
		85: '#d9d1e5',
		90: '#e8dff3',
		95: '#f6edff',
		100: '#ffffff'
	}
} as const;
