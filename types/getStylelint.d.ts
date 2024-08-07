export = getStylelint;
/**
 * @param {string|undefined} key
 * @param {Options} options
 * @returns {Linter}
 */
declare function getStylelint(
  key: string | undefined,
  { threads, ...options }: Options,
): Linter;
declare namespace getStylelint {
  export {
    Stylelint,
    LintResult,
    LinterOptions,
    LinterResult,
    Formatter,
    FormatterType,
    Options,
    AsyncTask,
    LintTask,
    Linter,
    Worker,
  };
}
type Stylelint = {
  lint: (options: LinterOptions) => Promise<LinterResult>;
  formatters: {
    [k: string]: Formatter;
  };
};
type LintResult = import('stylelint').LintResult;
type LinterOptions = import('stylelint').LinterOptions;
type LinterResult = import('stylelint').LinterResult;
type Formatter = import('stylelint').Formatter;
type FormatterType = import('stylelint').FormatterType;
type Options = import('./options').Options;
type AsyncTask = () => Promise<void>;
type LintTask = (files: string | string[]) => Promise<LintResult[]>;
type Linter = {
  stylelint: Stylelint;
  lintFiles: LintTask;
  cleanup: AsyncTask;
  threads: number;
};
type Worker = JestWorker & {
  lintFiles: LintTask;
};
import { Worker as JestWorker } from 'jest-worker';
