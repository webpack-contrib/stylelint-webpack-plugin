const { isAbsolute, join } = require('path');

const arrify = require('arrify');
const globby = require('globby');
const { isMatch } = require('micromatch');

const { getOptions } = require('./options');
const linter = require('./linter');
const { parseFiles, parseFoldersToGlobs } = require('./utils');

/** @typedef {import('webpack').Compiler} Compiler */
/** @typedef {import('webpack').Module} Module */
/** @typedef {import('./options').Options} Options */
/** @typedef {Partial<{timestamp:number} | number>} FileSystemInfoEntry */

const STYLELINT_PLUGIN = 'StylelintWebpackPlugin';
let counter = 0;

class StylelintWebpackPlugin {
  /**
   * @param {Options} options
   */
  constructor(options = {}) {
    this.key = STYLELINT_PLUGIN;
    this.options = getOptions(options);
    this.run = this.run.bind(this);
    this.startTime = Date.now();

    /** @type {ReadonlyMap<string, null | FileSystemInfoEntry | "ignore" | undefined>} */
    this.prevTimestamps = new Map();
  }

  /**
   * @param {Compiler} compiler
   * @returns {void}
   */
  apply(compiler) {
    // Generate key for each compilation,
    // this differentiates one from the other when being cached.
    this.key = compiler.name || `${this.key}_${(counter += 1)}`;

    const context = this.getContext(compiler);
    const excludeDefault = [
      '**/node_modules/**',
      String(compiler.options.output.path),
    ];

    const options = {
      ...this.options,
      context,
      exclude: parseFiles(this.options.exclude || excludeDefault, context),
      extensions: arrify(this.options.extensions),
      files: parseFiles(this.options.files || '', context),
    };

    const wanted = parseFoldersToGlobs(options.files, options.extensions);
    const exclude = parseFoldersToGlobs(options.exclude);

    // If `lintDirtyModulesOnly` is disabled,
    // execute the linter on the build
    if (!this.options.lintDirtyModulesOnly) {
      compiler.hooks.run.tapPromise(this.key, (c) =>
        this.run(c, options, wanted, exclude)
      );
    }

    let isFirstRun = this.options.lintDirtyModulesOnly;
    compiler.hooks.watchRun.tapPromise(this.key, (c) => {
      if (isFirstRun) {
        isFirstRun = false;

        return Promise.resolve();
      }

      return this.run(c, options, wanted, exclude);
    });
  }

  /**
   * @param {Compiler} compiler
   * @param {Options} options
   * @param {string[]} wanted
   * @param {string[]} exclude
   */
  async run(compiler, options, wanted, exclude) {
    // Do not re-hook
    /* istanbul ignore if */
    if (
      // @ts-ignore
      compiler.hooks.thisCompilation.taps.find(({ name }) => name === this.key)
    ) {
      return;
    }

    compiler.hooks.thisCompilation.tap(this.key, (compilation) => {
      /** @type {import('./linter').Linter} */
      let lint;

      /** @type {import('stylelint').InternalApi} */
      let api;

      /** @type {import('./linter').Reporter} */
      let report;

      /** @type number */
      let threads;

      try {
        ({ lint, api, report, threads } = linter(
          this.key,
          options,
          compilation
        ));
      } catch (e) {
        compilation.errors.push(e);
        return;
      }

      compilation.hooks.finishModules.tapPromise(this.key, async () => {
        /** @type {string[]} */
        // @ts-ignore
        const files = (
          await Promise.all(
            this.getFiles(compiler, wanted, exclude).map(
              async (/** @type {string | undefined} */ file) => {
                try {
                  return (await api.isPathIgnored(file)) ? false : file;
                } catch (e) {
                  return file;
                }
              }
            )
          )
        ).filter((file) => file !== false);

        if (threads > 1) {
          for (const file of files) {
            lint(parseFiles(file, options.context || ''));
          }
        } else if (files.length > 0) {
          lint(parseFiles(files, options.context || ''));
        }
      });

      // await and interpret results
      compilation.hooks.additionalAssets.tapPromise(this.key, processResults);

      async function processResults() {
        const { errors, warnings, generateReportAsset } = await report();

        if (warnings && !options.failOnWarning) {
          // @ts-ignore
          compilation.warnings.push(warnings);
        } else if (warnings && options.failOnWarning) {
          // @ts-ignore
          compilation.errors.push(warnings);
        }

        if (errors && options.failOnError) {
          // @ts-ignore
          compilation.errors.push(errors);
        } else if (errors && !options.failOnError) {
          // @ts-ignore
          compilation.warnings.push(errors);
        }

        if (generateReportAsset) {
          await generateReportAsset(compilation);
        }
      }
    });
  }

  /**
   *
   * @param {Compiler} compiler
   * @returns {string}
   */
  getContext(compiler) {
    if (!this.options.context) {
      return String(compiler.options.context);
    }

    if (!isAbsolute(this.options.context)) {
      return join(String(compiler.options.context), this.options.context);
    }

    return this.options.context;
  }

  /**
   * @param {Compiler} compiler
   * @param {string[]} wanted
   * @param {string[]} exclude
   * @returns {string[]}
   */
  // eslint-disable-next-line no-unused-vars
  getFiles(compiler, wanted, exclude) {
    // webpack 5
    if (compiler.modifiedFiles) {
      return Array.from(compiler.modifiedFiles).filter(
        (file) =>
          isMatch(file, wanted, { dot: true }) &&
          !isMatch(file, exclude, { dot: true })
      );
    }

    // webpack 4
    /* istanbul ignore next */
    if (compiler.fileTimestamps && compiler.fileTimestamps.size > 0) {
      return this.getChangedFiles(compiler.fileTimestamps).filter(
        (file) =>
          isMatch(file, wanted, { dot: true }) &&
          !isMatch(file, exclude, { dot: true })
      );
    }

    return globby.sync(wanted, { dot: true, ignore: exclude });
  }

  /**
   * @param {ReadonlyMap<string, null | FileSystemInfoEntry | "ignore" | undefined>} fileTimestamps
   * @returns {string[]}
   */
  /* istanbul ignore next */
  getChangedFiles(fileTimestamps) {
    /**
     * @param {null | FileSystemInfoEntry | "ignore" | undefined} fileSystemInfoEntry
     * @returns {Partial<number>}
     */
    const getTimestamps = (fileSystemInfoEntry) => {
      // @ts-ignore
      if (fileSystemInfoEntry && fileSystemInfoEntry.timestamp) {
        // @ts-ignore
        return fileSystemInfoEntry.timestamp;
      }

      // @ts-ignore
      return fileSystemInfoEntry;
    };

    /**
     * @param {string} filename
     * @param {null | FileSystemInfoEntry | "ignore" | undefined} fileSystemInfoEntry
     * @returns {boolean}
     */
    const hasFileChanged = (filename, fileSystemInfoEntry) => {
      const prevTimestamp = getTimestamps(this.prevTimestamps.get(filename));
      const timestamp = getTimestamps(fileSystemInfoEntry);

      return (prevTimestamp || this.startTime) < (timestamp || Infinity);
    };

    const changedFiles = [];

    for (const [filename, timestamp] of fileTimestamps.entries()) {
      if (hasFileChanged(filename, timestamp)) {
        changedFiles.push(filename);
      }
    }

    this.prevTimestamps = fileTimestamps;

    return changedFiles;
  }
}

module.exports = StylelintWebpackPlugin;
