export = linter;
/**
 * @param {string | undefined} key a cache key
 * @param {Options} options options
 * @param {Compilation} compilation compilation
 * @returns {{ lint: Linter, report: Reporter, threads: number }} the linter with additional functions
 */
declare function linter(
  key: string | undefined,
  options: Options,
  compilation: Compilation,
): {
  lint: Linter;
  report: Reporter;
  threads: number;
};
declare namespace linter {
  export {
    Compiler,
    Compilation,
    Stylelint,
    LintResult,
    LinterResult,
    Formatter,
    FormatterType,
    RuleMeta,
    Options,
    GenerateReport,
    Report,
    Reporter,
    Linter,
    LintResultMap,
  };
}
type Compiler = import("webpack").Compiler;
type Compilation = import("webpack").Compilation;
type Stylelint = import("./getStylelint").Stylelint;
type LintResult = import("./getStylelint").LintResult;
type LinterResult = import("./getStylelint").LinterResult;
type Formatter = import("./getStylelint").Formatter;
type FormatterType = import("./getStylelint").FormatterType;
type RuleMeta = import("./getStylelint").RuleMeta;
type Options = import("./options").Options;
type GenerateReport = (compilation: Compilation) => Promise<void>;
type Report = {
  errors?: StylelintError;
  warnings?: StylelintError;
  generateReportAsset?: GenerateReport;
};
type Reporter = () => Promise<Report>;
type Linter = (files: string | string[]) => void;
type LintResultMap = {
  [files: string]: LintResult;
};
import StylelintError = require("./StylelintError");
