/**
 * Ported from Astryx's `DateInput/wheelOptions.ts`.
 *
 * What both picker columns share: their row type, the row pitch, and the pure
 * rules behind a key step, a Home or End, and a programmatic spin.
 */

/**
 * The row height, px (`dateInputTouchSizes.wheelItemSize`): the pitch of both
 * columns' rows, and the unit of the touch wheel's offset.
 */
export const WHEEL_ROW_HEIGHT = 28;

export interface WheelOption {
	/** Stable numeric identity of the row (a month 1-12, or a year). */
	value: number;
	/** Row text. */
	label: string;
	/**
	 * Rows outside min/max stay visible but cannot be committed: a wheel that
	 * stops on one travels on to the nearest enabled row.
	 */
	isDisabled?: boolean;
	/**
	 * Where the row falls when a key steps the wheel; without it, rows step in
	 * list order. A 12-hour hour column sets the full hour, so 12 PM comes before
	 * 1 PM.
	 */
	order?: number;
}

/** What a Wheel's instance API exposes (`bind:this`). */
export interface WheelHandle {
	/**
	 * Turn the wheel onto `index` (an index into `options`) on the tap spin, then
	 * commit it as a rest would. Resolves true once that row is the committed
	 * one, false if a finger or another turn interrupted it or the wheel went
	 * away first. An index outside `options` or a disabled row resolves false at
	 * once, and nothing turns.
	 */
	spinTo(index: number): Promise<boolean>;
}

export interface WheelProps {
	/** Accessible name for the column, e.g. "Month". */
	label: string;
	/** Rows, top to bottom. */
	options: ReadonlyArray<WheelOption>;
	/** Committed value; must match one option's `value`. */
	value: number;
	/** Fired when the wheel comes to rest on a different, enabled row. */
	onChange: (value: number) => void;
	/**
	 * False while the wheel is hidden. The scrolling column then waits to listen
	 * and scroll, because a hidden scroller's offsets mean nothing. The touch
	 * wheel turns its gestures off, and shows a value set from outside without
	 * motion.
	 */
	isActive?: boolean;
}

/**
 * Whether `spinTo(index)` may turn onto `index`: an enabled row of `options`.
 * The touch wheel and the scrolling column answer a spin by the same rule.
 */
export function canSpinTo(options: ReadonlyArray<WheelOption>, index: number): boolean {
	const option = options[index];
	return option != null && !option.isDisabled;
}

/**
 * The enabled row nearest `index`: `index` itself when it is enabled,
 * otherwise the closest enabled row on either side. A tie goes to the side of
 * `towardIndex` (the committed row), and a wheel with no enabled row stays on
 * `towardIndex`.
 */
export function nearestEnabledIndex(
	options: ReadonlyArray<WheelOption>,
	index: number,
	towardIndex: number
): number {
	const isEnabled = (i: number) => i >= 0 && i < options.length && !options[i].isDisabled;
	if (isEnabled(index)) {
		return index;
	}
	for (let distance = 1; distance < options.length; distance++) {
		const below = index - distance;
		const above = index + distance;
		const isBelowEnabled = isEnabled(below);
		const isAboveEnabled = isEnabled(above);
		if (isBelowEnabled && isAboveEnabled) {
			return towardIndex < index ? below : above;
		}
		if (isBelowEnabled) {
			return below;
		}
		if (isAboveEnabled) {
			return above;
		}
	}
	return towardIndex;
}

/** The rows' indices in the order keys step them: by `order`, else list order. */
function inKeyOrder(options: ReadonlyArray<WheelOption>): number[] {
	const indices = options.map((_, index) => index);
	if (options.every((option) => option.order == null)) {
		return indices;
	}
	return indices.sort((a, b) => (options[a].order ?? a) - (options[b].order ?? b));
}

/**
 * The row a key moves a wheel to from `from` by `delta` rows, in key order. It
 * is the next enabled row from the target in the key's direction. Past the
 * last enabled row, it is the last enabled row before the target. Null when no
 * enabled row lies in that direction, so the key commits nothing.
 */
export function steppedIndex(
	options: ReadonlyArray<WheelOption>,
	from: number,
	delta: number
): number | null {
	const count = options.length;
	if (count === 0 || delta === 0) {
		return null;
	}
	const rows = inKeyOrder(options);
	const start = Math.max(0, rows.indexOf(from));
	const isEnabled = (position: number) => !options[rows[position]].isDisabled;
	const step = Math.sign(delta);
	const target = Math.min(count - 1, Math.max(0, start + delta));
	for (let position = target; position >= 0 && position < count; position += step) {
		if (isEnabled(position)) {
			return position === start ? null : rows[position];
		}
	}
	for (let position = target; position !== start; position -= step) {
		if (isEnabled(position)) {
			return rows[position];
		}
	}
	return null;
}

/** The first or the last enabled row in key order: where Home or End moves a wheel. */
export function endIndex(
	options: ReadonlyArray<WheelOption>,
	end: 'first' | 'last'
): number | null {
	const enabled = inKeyOrder(options).filter((index) => !options[index].isDisabled);
	return (end === 'first' ? enabled[0] : enabled[enabled.length - 1]) ?? null;
}
