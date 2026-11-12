import noPhysicalProperties from './no-physical-properties.js';

/**
 * The local rules this port relies on, packaged in the shape Oxlint's JS-plugin
 * loader expects.
 *
 * Oxlint's JS plugins are ESLint-compatible, so the rule bodies are unchanged
 * from the ESLint config that preceded Oxlint. Only the wrapper is new:
 * Oxlint requires a plugin-level `meta.name`, and the rule id is then
 * `<name>/<rule>`.
 */
export default {
	meta: { name: 'astryx' },
	rules: {
		'no-physical-properties': noPhysicalProperties
	}
};
