/**
 * Gothic Theme — dark only. Ported from Astryx's
 * `packages/themes/gothic/src/gothicTheme.ts`.
 *
 * Transcribed verbatim but for the two things every theme package here changes:
 * core's deep `dist/` imports in place of the `@astryxdesign/core/theme` barrel
 * (the barrel re-exports `theme.svelte`, and this file is on the theme build's
 * plain-Node import path), and the dropped `icons: gothicIconRegistry` — the
 * standing Phase 3 icon-registry debt, which contributes nothing to `theme.css`.
 *
 * A dark-only theme with deep blue-gray tones and a distressed display
 * heading. Inspired by ink, manuscript, and noir typography.
 *
 * Core palette: #E8F1F6, #96A0AB, #495056, #24292D, #101314
 * Categorical colors follow a pastel-on-dark pattern (light backgrounds
 * with dark text) — same in any system color preference.
 *
 * Uses Manufacturing Consent for headings and Fustat for body text.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/** Gothic syntax palette — upstream 0.7.13's resolved values. */
const gothicSyntax = defineSyntaxTheme({
	name: 'astryx-gothic',
	tokens: {
		keyword: '#c39adb',
		string: '#a3c987',
		comment: '#7e8791',
		number: '#dec074',
		function: '#8aa1d8',
		type: '#c39adb',
		variable: '#e8f1f6',
		operator: '#96a0ab',
		constant: '#e6b85e',
		tag: '#d97580',
		attribute: '#dec074',
		property: '#7cc5b3',
		punctuation: '#7e8791',
		background: '#101314',
		added: '#071607',
		removed: '#220806',
		'diff-header': 'transparent',
		'added-marker': '#a3c987',
		'removed-marker': '#d97580'
	}
});

/**
 * Gothic theme — ported from upstream 0.7.13. Colour and component
 * values are literals so this package needs none of upstream's palette helpers;
 * typography and motion stay as configs so the shared generator derives the
 * same sizes, leadings and durations.
 */
export const gothicTheme = defineTheme({
	name: 'gothic',

	typography: {
		scale: {
			base: 16,
			ratio: 1.25
		},
		body: {
			family: 'Fustat',
			fallbacks:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		heading: {
			family: 'Fustat',
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
		fast: 150,
		medium: 350,
		slow: 800,
		ratio: 0.75
	},
	onDark: {
		tokens: {
			'color-scheme': 'dark',
			'--color-text-primary': 'var(--color-on-dark)',
			'--color-icon-primary': 'var(--color-on-dark)',
			'--color-accent': 'var(--color-on-dark)',
			'--color-text-accent': 'var(--color-accent)',
			'--color-icon-accent': 'var(--color-accent)'
		}
	},
	onLight: {
		tokens: {
			'color-scheme': 'light',
			'--color-text-primary': 'var(--color-on-light)',
			'--color-icon-primary': 'var(--color-on-light)',
			'--color-accent': 'var(--color-on-light)',
			'--color-text-accent': 'var(--color-accent)',
			'--color-icon-accent': 'var(--color-accent)'
		}
	},
	syntax: gothicSyntax,
	tokens: {
		'--color-accent': '#e8f1f6',
		'--color-accent-muted': '#e8f1f620',
		'--color-neutral': '#e8f1f61a',
		'--color-background-surface': '#101314',
		'--color-background-body': '#101314',
		'--color-overlay': '#101314cc',
		'--color-overlay-hover': '#e8f1f60d',
		'--color-overlay-pressed': '#e8f1f61a',
		'--color-background-muted': '#24292d',
		'--color-text-primary': '#e8f1f6',
		'--color-text-secondary': '#96a0ab',
		'--color-text-disabled': '#495056',
		'--color-text-accent': '#e8f1f6',
		'--color-on-dark': '#e8f1f6',
		'--color-on-light': '#101314',
		'--color-on-accent': '#101314',
		'--color-on-success': '#101314',
		'--color-on-error': '#101314',
		'--color-on-warning': '#101314',
		'--color-info': '#8aa1d8',
		'--color-info-muted': '#a3b5d6',
		'--color-on-info': '#101314',
		'--color-text-info': '#a3b5d6',
		'--color-text-success': '#b3c79a',
		'--color-text-warning': '#d3c490',
		'--color-text-error': '#c6a6a2',
		'--color-on-info-muted': '#1f2c54',
		'--color-on-success-muted': '#244023',
		'--color-on-warning-muted': '#573f0b',
		'--color-on-error-muted': '#4a2520',
		'--color-icon-accent': '#e8f1f6',
		'--color-icon-primary': '#e8f1f6',
		'--color-icon-secondary': '#96a0ab',
		'--color-icon-disabled': '#495056',
		'--color-background-card': '#191d20',
		'--color-background-popover': '#24292d',
		'--color-background-inverted': '#e8f1f6',
		'--color-success': '#b3c79a',
		'--color-success-muted': '#b3c79a',
		'--color-error': '#c6a6a2',
		'--color-error-muted': '#c6a6a2',
		'--color-warning': '#d3c490',
		'--color-warning-muted': '#d3c490',
		'--color-border': '#e8f1f61a',
		'--color-border-emphasized': '#495056',
		'--color-skeleton': '#495056',
		'--color-shadow': '#0000004d',
		'--color-tint-hover': '#ffffff',
		'--color-background-blue': '#a3b5d6',
		'--color-border-blue': '#8696b8',
		'--color-icon-blue': '#2a3b6e',
		'--color-text-blue': '#1f2c54',
		'--color-background-cyan': '#a3c2cf',
		'--color-border-cyan': '#86a4b1',
		'--color-icon-cyan': '#2a5e75',
		'--color-text-cyan': '#204858',
		'--color-background-gray': '#3e454b',
		'--color-border-gray': '#5e676e',
		'--color-icon-gray': '#e8f1f6',
		'--color-text-gray': '#e8f1f6',
		'--color-background-green': '#b3c79a',
		'--color-border-green': '#96a880',
		'--color-icon-green': '#3a5e2c',
		'--color-text-green': '#244023',
		'--color-background-orange': '#d3b89a',
		'--color-border-orange': '#b6987d',
		'--color-icon-orange': '#8a4818',
		'--color-text-orange': '#6e3812',
		'--color-background-pink': '#c89aab',
		'--color-border-pink': '#aa7d8e',
		'--color-icon-pink': '#8d2d4c',
		'--color-text-pink': '#5c182f',
		'--color-background-purple': '#b29bc4',
		'--color-border-purple': '#947da6',
		'--color-icon-purple': '#5a2370',
		'--color-text-purple': '#481b58',
		'--color-background-red': '#c6a6a2',
		'--color-border-red': '#a48581',
		'--color-icon-red': '#5e3a35',
		'--color-text-red': '#4a2520',
		'--color-background-teal': '#a3c2b6',
		'--color-border-teal': '#86a499',
		'--color-icon-teal': '#1f5e52',
		'--color-text-teal': '#174a40',
		'--color-background-yellow': '#d3c490',
		'--color-border-yellow': '#b6a775',
		'--color-icon-yellow': '#876515',
		'--color-text-yellow': '#573f0b',
		'--radius-none': '0px',
		'--radius-inner': '0.25rem',
		'--radius-element': '0.5rem',
		'--radius-container': '0.75rem',
		'--radius-page': '1.5rem',
		'--radius-full': '9999px',
		'--shadow-low': '0 2px 4px #00000033, 0 4px 8px #00000040',
		'--shadow-med': '0 2px 4px #00000033, 0 4px 12px #00000040',
		'--shadow-high': '0 4px 6px #00000040, 0 12px 24px #0000004d',
		'--shadow-inset-hover': 'inset 0 0 0 1px #96a0ab30',
		'--shadow-inset-selected': 'inset 0 0 0 2px #96a0ab50',
		'--shadow-inset-success': 'inset 0 0 0 1px #869b7250',
		'--shadow-inset-warning': 'inset 0 0 0 1px #d3c49050',
		'--shadow-inset-error': 'inset 0 0 0 1px #c6a6a250'
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
				fontFamily: '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
				fontSize: 'var(--text-display-1-size)',
				lineHeight: 'var(--text-display-1-leading)'
			},
			'type:display-2': {
				fontFamily: '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
				fontSize: 'var(--text-display-2-size)',
				lineHeight: 'var(--text-display-2-leading)'
			},
			'type:display-3': {
				fontFamily: '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
				fontSize: 'var(--text-display-3-size)',
				lineHeight: 'var(--text-display-3-leading)'
			}
		},
		button: {
			'variant:secondary': {
				backgroundColor: 'var(--color-background-gray)',
				color: 'var(--color-text-gray)',
				borderColor: 'transparent',
				borderWidth: '0'
			},
			'variant:ghost': {
				':hover': {
					backgroundColor: 'var(--color-overlay-hover)'
				}
			},
			'variant:destructive': {
				backgroundColor: 'var(--color-error)',
				color: 'var(--color-text-red)'
			}
		},
		selector: {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'var(--color-background-gray)',
					color: 'var(--color-text-gray)',
					borderColor: 'transparent',
					borderWidth: '0'
				}
			}
		},
		'multi-selector': {
			'variant:secondary': {
				':not(.astryx-input-group *)': {
					backgroundColor: 'var(--color-background-gray)',
					color: 'var(--color-text-gray)',
					borderColor: 'transparent',
					borderWidth: '0'
				}
			}
		},
		'complex-selector': {
			'variant:secondary': {
				backgroundColor: 'var(--color-background-gray)',
				color: 'var(--color-text-gray)',
				borderColor: 'transparent',
				borderWidth: '0'
			}
		},
		badge: {
			base: {
				borderRadius: 'var(--radius-element)',
				fontWeight: 'var(--font-weight-medium)'
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
				borderRadius: 'var(--radius-element)'
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
		card: {
			base: {
				padding: 'var(--spacing-3)',
				borderRadius: 'var(--radius-container)'
			},
			'variant:blue': {
				'--color-text-primary': 'var(--color-text-blue)',
				'--color-text-secondary': 'var(--color-text-blue)'
			},
			'variant:cyan': {
				'--color-text-primary': 'var(--color-text-cyan)',
				'--color-text-secondary': 'var(--color-text-cyan)'
			},
			'variant:gray': {
				'--color-text-primary': 'var(--color-text-gray)',
				'--color-text-secondary': 'var(--color-text-gray)'
			},
			'variant:green': {
				'--color-text-primary': 'var(--color-text-green)',
				'--color-text-secondary': 'var(--color-text-green)'
			},
			'variant:orange': {
				'--color-text-primary': 'var(--color-text-orange)',
				'--color-text-secondary': 'var(--color-text-orange)'
			},
			'variant:pink': {
				'--color-text-primary': 'var(--color-text-pink)',
				'--color-text-secondary': 'var(--color-text-pink)'
			},
			'variant:purple': {
				'--color-text-primary': 'var(--color-text-purple)',
				'--color-text-secondary': 'var(--color-text-purple)'
			},
			'variant:red': {
				'--color-text-primary': 'var(--color-text-red)',
				'--color-text-secondary': 'var(--color-text-red)'
			},
			'variant:teal': {
				'--color-text-primary': 'var(--color-text-teal)',
				'--color-text-secondary': 'var(--color-text-teal)'
			},
			'variant:yellow': {
				'--color-text-primary': 'var(--color-text-yellow)',
				'--color-text-secondary': 'var(--color-text-yellow)'
			}
		},
		section: {
			base: {
				padding: 'var(--spacing-3)'
			}
		},
		field: {
			base: {
				borderRadius: 'var(--radius-element)'
			}
		}
	}
});

/**
 * Raw tonal palettes — every color at every tone step (0–100 in 5s).
 * Use these for custom components or data visualization.
 *
 * Categorical hues (blue, green, etc.) follow gothic gem-tone hues.
 * Neutral mirrors the original gothic blue-gray palette (H≈210).
 */
export const gothicPalettes = {
	// Neutral — H=210 C=4 (cool blue-gray, original gothic)
	neutral: {
		hue: 210,
		chroma: 4,
		0: '#000000',
		5: '#0a0d0f',
		10: '#101314',
		15: '#181c1f',
		20: '#24292D',
		25: '#2c3236',
		30: '#363c40',
		35: '#40464b',
		40: '#495056',
		45: '#535a61',
		50: '#5d646b',
		55: '#676f76',
		60: '#727a82',
		65: '#7e8690',
		70: '#8a929c',
		75: '#96A0AB',
		80: '#a8b1bb',
		85: '#bbc3cb',
		90: '#cdd5db',
		95: '#E8F1F6',
		100: '#ffffff'
	},
	// Blue — H=255 C=20 (midnight indigo)
	blue: {
		hue: 255,
		chroma: 20,
		0: '#000000',
		5: '#050930',
		10: '#0c143f',
		15: '#161e4d',
		20: '#1f2c54',
		25: '#2a3565',
		30: '#2a3b6e',
		35: '#3a4783',
		40: '#475497',
		45: '#5462ab',
		50: '#6170bf',
		55: '#6a85cf',
		60: '#7793d6',
		65: '#8aa1d8',
		70: '#a3b5e0',
		75: '#b6c5e7',
		80: '#c4d1ec',
		85: '#d2dcef',
		90: '#dde2f1',
		95: '#e8ecf6',
		100: '#ffffff'
	},
	// Cyan — H=200 C=25 (cathedral mist)
	cyan: {
		hue: 200,
		chroma: 25,
		0: '#000000',
		5: '#001724',
		10: '#062436',
		15: '#0d3046',
		20: '#204858',
		25: '#1c4a66',
		30: '#2a5e75',
		35: '#3a6e85',
		40: '#487d94',
		45: '#598ea3',
		50: '#6a9eb1',
		55: '#7ab0c0',
		60: '#8cc3d8',
		65: '#a0cce0',
		70: '#b1d3e5',
		75: '#bcdaeb',
		80: '#c5dfee',
		85: '#cbe4f0',
		90: '#d6e6ee',
		95: '#e3eef3',
		100: '#ffffff'
	},
	// Green — H=140 C=18 (forest moss)
	green: {
		hue: 140,
		chroma: 18,
		0: '#000000',
		5: '#0c1a08',
		10: '#152511',
		15: '#1c321a',
		20: '#2c4a20',
		25: '#2c4d2a',
		30: '#3a5e2c',
		35: '#446a39',
		40: '#557c44',
		45: '#658d50',
		50: '#779e5d',
		55: '#87b06a',
		60: '#96bd76',
		65: '#a3c987',
		70: '#b5d397',
		75: '#bdd99e',
		80: '#c8e0ad',
		85: '#d4e6bd',
		90: '#dde6d4',
		95: '#eaf3df',
		100: '#ffffff'
	},
	// Orange — H=40 C=35 (rust copper)
	orange: {
		hue: 40,
		chroma: 35,
		0: '#000000',
		5: '#1f0d00',
		10: '#2c1606',
		15: '#3a200d',
		20: '#6e3812',
		25: '#5a371a',
		30: '#8a4818',
		35: '#9a5824',
		40: '#a05728',
		45: '#b66839',
		50: '#c87a4a',
		55: '#d6905a',
		60: '#dca275',
		65: '#e1b288',
		70: '#e8b894',
		75: '#ebbf9d',
		80: '#eecfb5',
		85: '#efddcd',
		90: '#f3e5d8',
		95: '#f9eee5',
		100: '#ffffff'
	},
	// Pink — H=345 C=22 (rose madder)
	pink: {
		hue: 345,
		chroma: 22,
		0: '#000000',
		5: '#22060e',
		10: '#2e0c16',
		15: '#3a131e',
		20: '#71223c',
		25: '#572235',
		30: '#8d2d4c',
		35: '#9b3358',
		40: '#a04563',
		45: '#a04a6e',
		50: '#b15876',
		55: '#c26988',
		60: '#cf7593',
		65: '#d56891',
		70: '#dc82a4',
		75: '#e094b1',
		80: '#e7a5be',
		85: '#ebb6ca',
		90: '#eed6df',
		95: '#f5e3eb',
		100: '#ffffff'
	},
	// Purple — H=290 C=30 (cathedral plum)
	purple: {
		hue: 290,
		chroma: 30,
		0: '#000000',
		5: '#1e0c25',
		10: '#2a1334',
		15: '#371b43',
		20: '#481b58',
		25: '#502163',
		30: '#5a2370',
		35: '#6e3088',
		40: '#82409c',
		45: '#9352ad',
		50: '#a363bd',
		55: '#b06ec9',
		60: '#bb7cd1',
		65: '#c084d6',
		70: '#c692db',
		75: '#cd9be0',
		80: '#d2a3df',
		85: '#dab3e6',
		90: '#e6daee',
		95: '#f0e6f4',
		100: '#ffffff'
	},
	// Red — H=15 C=12 (dusty rose) — gothic uses a desaturated rose
	// family rather than vibrant crimson; #c6a6a2 sits near T80.
	red: {
		hue: 15,
		chroma: 12,
		0: '#000000',
		5: '#1c0d09',
		10: '#26140f',
		15: '#301b16',
		20: '#3a231d',
		25: '#452c25',
		30: '#50352d',
		35: '#5b3e36',
		40: '#66483e',
		45: '#725347',
		50: '#7d5e51',
		55: '#896a5b',
		60: '#957565',
		65: '#a18170',
		70: '#ad8d7b',
		75: '#b99a87',
		80: '#c6a6a2',
		85: '#d2b4af',
		90: '#dec2bc',
		95: '#ebd0ca',
		100: '#ffffff'
	},
	// Teal — H=170 C=20 (verdigris)
	teal: {
		hue: 170,
		chroma: 20,
		0: '#000000',
		5: '#001b14',
		10: '#062821',
		15: '#0d3530',
		20: '#174a40',
		25: '#194e44',
		30: '#1f5e52',
		35: '#2c6c5f',
		40: '#3a7b6c',
		45: '#498a7a',
		50: '#5aa091',
		55: '#5db5a3',
		60: '#6cbeab',
		65: '#7cc5b3',
		70: '#90d0c0',
		75: '#9fd4c5',
		80: '#b1ddcf',
		85: '#c0e1d6',
		90: '#d4e7e2',
		95: '#e1efe9',
		100: '#ffffff'
	},
	// Yellow — H=80 C=40 (aged gold)
	yellow: {
		hue: 80,
		chroma: 40,
		0: '#000000',
		5: '#2c1d00',
		10: '#3a2900',
		15: '#4a3500',
		20: '#6c5010',
		25: '#6c5010',
		30: '#876515',
		35: '#9c7b1f',
		40: '#b18e2f',
		45: '#c39e3e',
		50: '#cca74c',
		55: '#d6b56a',
		60: '#dec074',
		65: '#e2c884',
		70: '#e6d091',
		75: '#e9d29a',
		80: '#ebd9a7',
		85: '#ebe1c4',
		90: '#f0e8d6',
		95: '#f7f1e3',
		100: '#ffffff'
	}
} as const;
