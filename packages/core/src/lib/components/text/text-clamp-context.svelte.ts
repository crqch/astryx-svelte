import { Context } from '../../internal/context.js';

/**
 * True inside a `Text` that clamps its lines, ported from Astryx's
 * `Text/textClampContext.ts`.
 *
 * A layer boundary resets it to false, because content in a layer is not
 * inside the clamped text box. That reset lives in `LayerContentBoundary`,
 * beside the other surface-scoped contexts.
 *
 * A marker's class is not involved: this is a plain context, and the value is
 * a getter so a `maxLines` change reaches descendants that read it reactively.
 */
export const TextClampContext = new Context<() => boolean>('TextClampContext');
