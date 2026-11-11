import * as stylex from '@stylexjs/stylex';

/**
 * The custom styles upstream's `TableHeaderCell.test.tsx` declares inline for
 * its `xstyle` cases. StyleX may only be imported from a `.ts` module, so they
 * live here (the `table-xstyle.stylex.ts` precedent).
 */
export const trailing = stylex.create({
	trailing: { textAlign: 'end' }
});

export const arrayStyles = stylex.create({
	caps: { textTransform: 'uppercase' },
	spaced: { letterSpacing: '2px' }
});
