/** @typedef {import('./getStylelint').Stylelint} Stylelint */
/** @typedef {import('./getStylelint').LinterOptions} StylelintOptions */
/** @typedef {import('./options').Options} Options */

Object.assign(module.exports, {
  lintFiles,
  setup,
});

/** @type {Stylelint} */
let stylelint;

/** @type {Partial<StylelintOptions>} */
let linterOptions;

/**
 * @param {Options} options
 * @param {Partial<StylelintOptions>} stylelintOptions
 */
function setup(options, stylelintOptions) {
  stylelint = require(options.stylelintPath || 'stylelint');
  linterOptions = stylelintOptions;

  return stylelint;
}

/**
 * @param {string | string[]} files
 */
async function lintFiles(files) {
  const { results } = await stylelint.lint({
    ...linterOptions,
    files,
    quietDeprecationWarnings: true,
  });

  // Reset result to work with worker
  return results.map((result) => {
    return {
      source: result.source,
      errored: result.errored,
      ignored: result.ignored,
      warnings: result.warnings,
      deprecations: result.deprecations,
      invalidOptionWarnings: result.invalidOptionWarnings,
    };
  });
}
