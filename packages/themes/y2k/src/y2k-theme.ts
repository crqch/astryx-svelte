/**
 * Y2K Theme — ported from Astryx's `packages/themes/y2k/src/y2kTheme.ts`.
 *
 * Transcribed verbatim but for the two things every theme package here changes:
 * core's deep `dist/` imports in place of the `@astryxdesign/core/theme` barrel
 * (the barrel re-exports `theme.svelte`, and this file is on the theme build's
 * plain-Node import path), and the dropped `icons: y2kIconRegistry` — the
 * standing Phase 3 icon-registry debt, which contributes nothing to `theme.css`.
 *
 * A bubbly, playful pop theme inspired by early 2000s aesthetics.
 * Periwinkle body (#CCCFFA), charcoal accent, Poppins for body/headings, and
 * Crimson Text for display sizes.
 * Core neutral: H=75 C=8 (warm cream neutral derived from #FFF6ED)
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-sv/core/theme/define';

/** Y2k syntax palette — upstream 0.7.13's resolved values. */
const y2kSyntax = defineSyntaxTheme({
	name: 'astryx-y2k',
	tokens: {
		keyword: 'light-dark(#663ebd, #bbaaff)',
		string: 'light-dark(#546800, #95b041)',
		comment: 'light-dark(#675d52, #a6acd6)',
		number: 'light-dark(#904800, #ffb477)',
		function: 'light-dark(#00649b, #70c1ff)',
		type: 'light-dark(#663ebd, #bbaaff)',
		variable: 'light-dark(#675d52, #a6acd6)',
		operator: 'light-dark(#675d52, #a6acd6)',
		constant: 'light-dark(#904800, #ffb477)',
		tag: 'light-dark(#9d002a, #ff969a)',
		attribute: 'light-dark(#745b00, #d0a601)',
		property: 'light-dark(#007050, #5bc29a)',
		punctuation: 'light-dark(#675d52, #a6acd6)',
		background: 'light-dark(#fff6ed, #0e0f1a)',
		added: 'light-dark(#c5e17a40, #c5e17a33)',
		removed: 'light-dark(#ffc3c340, #ffc3c333)',
		'diff-header': 'transparent',
		'added-marker': 'light-dark(#3f4e00, #95b041)',
		'removed-marker': 'light-dark(#880023, #ff969a)'
	}
});

/**
 * Y2k theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const y2kTheme = defineTheme({
	name: 'y2k',

	typography: {
		scale: {
			base: 16,
			ratio: 1.25
		},
		body: {
			family: 'Poppins',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Poppins',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		code: {
			family: 'JetBrains Mono',
			fallbacks: '"SF Mono", Monaco, Consolas, monospace'
		}
	},

	motion: {
		fast: 100,
		medium: 250,
		slow: 600,
		ratio: 0.8
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
	syntax: y2kSyntax,
	tokens: {
		'--radius-none': '0px',
		'--radius-inner': '0px',
		'--radius-element': '0px',
		'--radius-container': '0px',
		'--radius-page': '0px',
		'--radius-chat': '0px',
		'--radius-full': '0px',
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
		'--size-element-sm': '32px',
		'--size-element-md': '40px',
		'--size-element-lg': '48px',
		'--color-accent': 'light-dark(#2d241b, #edeffc)',
		'--color-accent-muted': 'light-dark(#2d241b14, #edeffc20)',
		'--color-neutral': 'light-dark(#2d241b10, #edeffc1A)',
		'--color-background-surface': 'light-dark(#ffffff, #16182b)',
		'--color-background-body': 'light-dark(#cccffa, #0e0f1a)',
		'--color-overlay': 'light-dark(#2d241b80, #0e0f1aCC)',
		'--color-overlay-hover': 'light-dark(#2d241b0D, #edeffc0D)',
		'--color-overlay-pressed': 'light-dark(#2d241b1A, #edeffc1A)',
		'--color-background-muted': 'light-dark(#f1e6db, #1f2238)',
		'--color-text-primary': 'light-dark(#2d241b, #edeffc)',
		'--color-text-secondary': 'light-dark(#5a5146, #a6acd6)',
		'--color-text-disabled': 'light-dark(#d1c5b8, #4a4f6b)',
		'--color-text-accent': 'light-dark(#2d241b, #edeffc)',
		'--color-on-dark': '#ffffff',
		'--color-on-light': '#2d241b',
		'--color-on-accent': 'light-dark(#ffffff, #16182b)',
		'--color-on-success': 'light-dark(#3f4e00, #2a3600)',
		'--color-on-error': 'light-dark(#880023, #610016)',
		'--color-on-warning': 'light-dark(#584400, #3d2e00)',
		'--color-info': 'light-dark(#00649b, #70c1ff)',
		'--color-info-muted': 'var(--color-background-blue)',
		'--color-text-info': 'light-dark(#003454, #70c1ff)',
		'--color-text-success': 'light-dark(#3f4e00, #b5d263)',
		'--color-text-warning': 'light-dark(#584400, #f3d172)',
		'--color-text-error': 'light-dark(#880023, #ff969a)',
		'--color-on-info-muted': 'var(--color-text-blue)',
		'--color-on-success-muted': 'var(--color-text-green)',
		'--color-on-warning-muted': 'var(--color-text-yellow)',
		'--color-on-error-muted': 'var(--color-text-red)',
		'--color-icon-accent': 'light-dark(#2d241b, #edeffc)',
		'--color-icon-primary': 'light-dark(#2d241b, #edeffc)',
		'--color-icon-secondary': 'light-dark(#675d52, #a6acd6)',
		'--color-icon-disabled': 'light-dark(#d1c5b8, #4a4f6b)',
		'--color-background-card': 'light-dark(#ffffff, #16182b)',
		'--color-background-popover': 'light-dark(#ffffff, #1f2238)',
		'--color-background-inverted': 'light-dark(#2d241b, #edeffc)',
		'--color-success': 'light-dark(#c5e17a, #c5e17a)',
		'--color-success-muted': 'light-dark(#c5e17a, #c5e17a)',
		'--color-error': 'light-dark(#ffc3c3, #ffc3c3)',
		'--color-error-muted': 'light-dark(#ffc3c3, #ffc3c3)',
		'--color-warning': 'light-dark(#ffe08a, #fde08f)',
		'--color-warning-muted': 'light-dark(#ffe08a, #fde08f)',
		'--color-border': 'light-dark(#382e24, #edeffc1A)',
		'--color-border-emphasized': 'light-dark(#382e24, #636889)',
		'--color-skeleton': 'light-dark(#d1c5b8, #2c3048)',
		'--color-shadow': 'light-dark(#2d241b1A, #0000004D)',
		'--color-tint-hover': 'light-dark(#2d241b, #edeffc)',
		'--color-background-green': 'light-dark(#c5e17a, #c5e17a)',
		'--color-border-green': 'light-dark(#b5d360, #b5d263)',
		'--color-icon-green': 'light-dark(#3f4e00, #2a3600)',
		'--color-text-green': 'light-dark(#3f4e00, #2a3600)',
		'--color-background-red': 'light-dark(#ffc3c3, #ffc3c3)',
		'--color-border-red': 'light-dark(#ff969a, #ff969a)',
		'--color-icon-red': 'light-dark(#880023, #610016)',
		'--color-text-red': 'light-dark(#880023, #610016)',
		'--color-background-yellow': 'light-dark(#ffe08a, #fde08f)',
		'--color-border-yellow': 'light-dark(#f9d059, #f3d172)',
		'--color-icon-yellow': 'light-dark(#584400, #3d2e00)',
		'--color-text-yellow': 'light-dark(#584400, #3d2e00)',
		'--color-background-blue': 'light-dark(#addbff, #addbff)',
		'--color-border-blue': 'light-dark(#70c1ff, #70c1ff)',
		'--color-icon-blue': 'light-dark(#003454, #003454)',
		'--color-text-blue': 'light-dark(#003454, #003454)',
		'--color-background-pink': 'light-dark(#ffbfd9, #ffbfd9)',
		'--color-border-pink': 'light-dark(#ffa8cd, #ffa8cd)',
		'--color-icon-pink': 'light-dark(#82004f, #5d0037)',
		'--color-text-pink': 'light-dark(#82004f, #5d0037)',
		'--color-background-purple': 'light-dark(#d5cdff, #d5cdff)',
		'--color-border-purple': 'light-dark(#bbaaff, #bbaaff)',
		'--color-icon-purple': 'light-dark(#431a88, #2a1159)',
		'--color-text-purple': 'light-dark(#431a88, #2a1159)',
		'--color-background-cyan': 'light-dark(#b2f0ed, #baeeec)',
		'--color-border-cyan': 'light-dark(#73dbd7, #84d8d4)',
		'--color-icon-cyan': 'light-dark(#005250, #002d2c)',
		'--color-text-cyan': 'light-dark(#005250, #002d2c)',
		'--color-background-orange': 'light-dark(#ffc89d, #ffc89d)',
		'--color-border-orange': 'light-dark(#ffb477, #ffb477)',
		'--color-icon-orange': 'light-dark(#703400, #411800)',
		'--color-text-orange': 'light-dark(#703400, #411800)',
		'--color-background-teal': 'light-dark(#b6f2d7, #a6e5c9)',
		'--color-border-teal': 'light-dark(#81dcb6, #8ed9b9)',
		'--color-icon-teal': 'light-dark(#00553b, #002f1e)',
		'--color-text-teal': 'light-dark(#00553b, #002f1e)',
		'--color-background-gray': 'light-dark(#f1e6db, #dfe2f3)',
		'--color-border-gray': 'light-dark(#dfd5c9, #d0d4eb)',
		'--color-icon-gray': 'light-dark(#4f453b, #16182b)',
		'--color-text-gray': 'light-dark(#4f453b, #16182b)',
		'--shadow-low': '0 2px 4px #2d241b0D, 0 4px 8px #2d241b1A',
		'--shadow-med': '0 2px 4px #2d241b0D, 0 4px 12px #2d241b1A',
		'--shadow-high': '0 4px 6px #2d241b1A, 0 12px 24px #2d241b26',
		'--shadow-inset-hover': 'inset 0px 0px 0px 2px #2d241b30',
		'--shadow-inset-selected': 'inset 0px 0px 0px 2px #2d241b50',
		'--shadow-inset-success': 'inset 0px 0px 0px 2px #3f4e0050',
		'--shadow-inset-warning': 'inset 0px 0px 0px 2px #58440050',
		'--shadow-inset-error': 'inset 0px 0px 0px 2px #88002350',
		'--color-on-info': 'light-dark(#FFFFFF, #2D241B)',
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
				fontFamily: '"Crimson Text", Georgia, "Times New Roman", Times, serif',
				fontSize: 'var(--text-display-1-size)',
				lineHeight: 'var(--text-display-1-leading)'
			},
			'type:display-2': {
				fontFamily: '"Crimson Text", Georgia, "Times New Roman", Times, serif',
				fontSize: 'var(--text-display-2-size)',
				lineHeight: 'var(--text-display-2-leading)'
			},
			'type:display-3': {
				fontFamily: '"Crimson Text", Georgia, "Times New Roman", Times, serif',
				fontSize: 'var(--text-display-3-size)',
				lineHeight: 'var(--text-display-3-leading)'
			}
		},
		'top-nav-item': {
			selected: {
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
				borderRadius: '0px',
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-border)'
			},
			'variant:primary': {
				backgroundColor: 'var(--color-text-primary)',
				color: 'var(--color-background-body)',
				borderColor: 'transparent'
			},
			'variant:secondary': {
				backgroundColor: 'var(--color-background-green)',
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-text-green)',
				color: 'var(--color-text-green)',
				':hover': {
					backgroundColor: 'var(--color-border-green)'
				}
			},
			'variant:ghost': {
				borderColor: 'transparent'
			},
			'variant:destructive': {
				backgroundColor: 'var(--color-background-red)',
				color: 'var(--color-text-red)',
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-text-red)'
			}
		},
		selector: {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'var(--color-background-green)',
					borderWidth: '1px',
					borderStyle: 'solid',
					borderColor: 'var(--color-text-green)',
					color: 'var(--color-text-green)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'var(--color-border-green)'
				}
			}
		},
		'multi-selector': {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'var(--color-background-green)',
					borderWidth: '1px',
					borderStyle: 'solid',
					borderColor: 'var(--color-text-green)',
					color: 'var(--color-text-green)'
				},
				':hover:not([data-disabled], [data-readonly], .astryx-input-group *)': {
					backgroundColor: 'var(--color-border-green)'
				}
			}
		},
		'complex-selector': {
			'variant:secondary': {
				backgroundColor: 'var(--color-background-green)',
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--color-text-green)',
				color: 'var(--color-text-green)',
				':hover:not(:has(> :is(:disabled, [aria-disabled="true"])))': {
					backgroundColor: 'var(--color-border-green)'
				}
			}
		},
		badge: {
			base: {
				borderRadius: '9999px',
				borderWidth: '1.5px',
				borderStyle: 'solid',
				borderColor: 'color-mix(in srgb, currentColor 30%, transparent)'
			},
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
			base: {
				borderRadius: '0px'
			},
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
		field: {
			base: {
				borderRadius: '0px'
			}
		},
		card: {
			base: {
				borderRadius: '0px',
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
 * Raw tonal palettes — every color at every tone step (0-100 in 5s).
 */
export const y2kPalettes = {
	neutral: {
		hue: 75,
		chroma: 8,
		0: '#000000',
		5: '#190f00',
		10: '#221a10',
		15: '#2d241b',
		20: '#382f25',
		25: '#433a30',
		30: '#4f453b',
		35: '#5b5146',
		40: '#675d52',
		45: '#73695e',
		50: '#80756a',
		55: '#8d8276',
		60: '#9a8f83',
		65: '#a79c90',
		70: '#b5a99d',
		75: '#c3b7ab',
		80: '#d1c5b8',
		85: '#dfd2c6',
		90: '#ede0d4',
		95: '#fbefe2',
		100: '#ffffff'
	},
	green: {
		hue: 120,
		chroma: 60,
		0: '#000000',
		5: '#061800',
		10: '#132200',
		15: '#152d00',
		20: '#173900',
		25: '#1e4500',
		30: '#285100',
		35: '#355d00',
		40: '#426900',
		45: '#4f7600',
		50: '#5c830b',
		55: '#69901d',
		60: '#779d2c',
		65: '#84aa39',
		70: '#92b847',
		75: '#a0c654',
		80: '#aed461',
		85: '#bce26e',
		90: '#caf07b',
		95: '#d9fe89',
		100: '#ffffff'
	},
	red: {
		hue: 25,
		chroma: 55,
		0: '#000000',
		5: '#480000',
		10: '#540000',
		15: '#620002',
		20: '#700012',
		25: '#7f001b',
		30: '#8e1126',
		35: '#9c2330',
		40: '#ab313b',
		45: '#ba3f47',
		50: '#c94d52',
		55: '#d95b5e',
		60: '#e8686b',
		65: '#f87677',
		70: '#ff8787',
		75: '#ff9d9b',
		80: '#ffb2af',
		85: '#ffc6c3',
		90: '#ffd9d7',
		95: '#ffeceb',
		100: '#ffffff'
	},
	yellow: {
		hue: 85,
		chroma: 65,
		0: '#000000',
		5: '#270c00',
		10: '#301800',
		15: '#3b2200',
		20: '#472c00',
		25: '#533700',
		30: '#604200',
		35: '#6d4d00',
		40: '#7b5900',
		45: '#896500',
		50: '#977100',
		55: '#a67e00',
		60: '#b58b01',
		65: '#c39819',
		70: '#d2a52a',
		75: '#e2b239',
		80: '#f1c047',
		85: '#ffcd55',
		90: '#ffde9b',
		95: '#ffeecf',
		100: '#ffffff'
	},
	blue: {
		hue: 250,
		chroma: 40,
		0: '#000000',
		5: '#001939',
		10: '#002244',
		15: '#002c4d',
		20: '#003759',
		25: '#004266',
		30: '#004e74',
		35: '#005a83',
		40: '#006693',
		45: '#0073a3',
		50: '#0080b4',
		55: '#008ec4',
		60: '#0e9bd2',
		65: '#2fa8e0',
		70: '#45b6ef',
		75: '#57c3fd',
		80: '#7ed0ff',
		85: '#a3dbff',
		90: '#c4e7ff',
		95: '#e1f3ff',
		100: '#ffffff'
	},
	pink: {
		hue: 350,
		chroma: 45,
		0: '#000000',
		5: '#3d001d',
		10: '#490027',
		15: '#560032',
		20: '#64003d',
		25: '#711248',
		30: '#7f2154',
		35: '#8c2f60',
		40: '#9a3c6c',
		45: '#a84979',
		50: '#b75685',
		55: '#c56392',
		60: '#d371a0',
		65: '#e27ead',
		70: '#f18bbb',
		75: '#ff99c8',
		80: '#ffaed3',
		85: '#ffc3de',
		90: '#ffd7e9',
		95: '#ffebf4',
		100: '#ffffff'
	},
	purple: {
		hue: 300,
		chroma: 40,
		0: '#000000',
		5: '#020840',
		10: '#11144b',
		15: '#1f1e57',
		20: '#2c2864',
		25: '#393370',
		30: '#453e7d',
		35: '#524a8a',
		40: '#5f5697',
		45: '#6c62a4',
		50: '#796eb2',
		55: '#867bc0',
		60: '#9387ce',
		65: '#a194dc',
		70: '#afa2ea',
		75: '#bdaff8',
		80: '#cbbeff',
		85: '#d9ceff',
		90: '#e6deff',
		95: '#f3eeff',
		100: '#ffffff'
	},
	cyan: {
		hue: 185,
		chroma: 35,
		0: '#000000',
		5: '#001e14',
		10: '#00261f',
		15: '#003029',
		20: '#003b34',
		25: '#00473f',
		30: '#00534a',
		35: '#005f56',
		40: '#006c62',
		45: '#00796f',
		50: '#00867b',
		55: '#0f9488',
		60: '#29a195',
		65: '#3bafa2',
		70: '#4cbcb0',
		75: '#5bcabd',
		80: '#6ad8cb',
		85: '#79e7d9',
		90: '#87f5e7',
		95: '#a6fff5',
		100: '#ffffff'
	},
	orange: {
		hue: 60,
		chroma: 60,
		0: '#000000',
		5: '#340000',
		10: '#420500',
		15: '#520b00',
		20: '#601700',
		25: '#6d2400',
		30: '#7b3000',
		35: '#893c00',
		40: '#984800',
		45: '#a75409',
		50: '#b66019',
		55: '#c56d26',
		60: '#d47a33',
		65: '#e48740',
		70: '#f3944c',
		75: '#ffa25c',
		80: '#ffb682',
		85: '#ffc9a3',
		90: '#ffdbc3',
		95: '#ffede1',
		100: '#ffffff'
	},
	teal: {
		hue: 165,
		chroma: 30,
		0: '#000000',
		5: '#001d00',
		10: '#00240f',
		15: '#002f1a',
		20: '#003a24',
		25: '#00462f',
		30: '#00513a',
		35: '#115e45',
		40: '#226a51',
		45: '#30775d',
		50: '#3d8469',
		55: '#4a9175',
		60: '#589e82',
		65: '#65ab8f',
		70: '#72b99c',
		75: '#7fc7a9',
		80: '#8dd5b7',
		85: '#9be3c5',
		90: '#a9f2d3',
		95: '#b6ffe1',
		100: '#ffffff'
	}
} as const;
