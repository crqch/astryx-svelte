import * as stylex from '@stylexjs/stylex';
import type { SizeValue } from '../../internal/types.js';
import { colorVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `ScrollableArea/ScrollableArea.tsx`.
 *
 * The viewport is the root and owns the scroll box; its single child is a real
 * content box with a 100% minimum size, so children participate in that box
 * rather than directly in viewport layout.
 */
const styles = stylex.create({
	viewport: {
		boxSizing: 'border-box',
		maxInlineSize: '100%',
		maxBlockSize: '100%',
		scrollbarColor: {
			default: `${colorVars['--color-neutral']} transparent`,
			// Touch screens keep the platform's own scroll indicator.
			'@media (pointer: coarse)': 'auto',
			'@media (forced-colors: active)': 'auto'
		},
		containerType: {
			default: null,
			'@supports (container-type: scroll-state)': 'scroll-state'
		}
	},
	fullBleed: {
		marginInlineStart: 'calc(-1 * var(--container-padding-inline-start, 0px))',
		marginInlineEnd: 'calc(-1 * var(--container-padding-inline-end, 0px))',
		maxInlineSize:
			'calc(100% + var(--container-padding-inline-start, 0px) + var(--container-padding-inline-end, 0px))',
		marginBlockStart: {
			default: null,
			':first-child': 'calc(-1 * var(--container-padding-block-start, 0px))'
		},
		marginBlockEnd: {
			default: null,
			':last-child': 'calc(-1 * var(--container-padding-block-end, 0px))'
		}
	},
	content: {
		boxSizing: 'border-box',
		minInlineSize: '100%',
		minBlockSize: '100%'
	},
	contentWithInlineOverflow: {
		inlineSize: 'max-content'
	}
});

const dynamicStyles = stylex.create({
	sizing: (
		width: SizeValue | null,
		height: SizeValue | null,
		maxWidth: SizeValue | null,
		minHeight: SizeValue | null
	) => ({ width, height, maxWidth, minHeight })
});

export const scrollableAreaViewportStyle = styles.viewport;
export const scrollableAreaFullBleedStyle = styles.fullBleed;
export const scrollableAreaContentStyle = styles.content;
export const scrollableAreaContentWithInlineOverflowStyle = styles.contentWithInlineOverflow;

export function scrollableAreaSizingStyle(
	width: SizeValue | null,
	height: SizeValue | null,
	maxWidth: SizeValue | null,
	minHeight: SizeValue | null
) {
	return dynamicStyles.sizing(width, height, maxWidth, minHeight);
}
