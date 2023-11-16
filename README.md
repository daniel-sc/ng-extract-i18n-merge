[![npm](https://img.shields.io/npm/v/ng-extract-i18n-merge)](https://www.npmjs.com/package/ng-extract-i18n-merge)
[![Coverage Status](https://coveralls.io/repos/github/daniel-sc/ng-extract-i18n-merge/badge.svg?branch=master)](https://coveralls.io/github/daniel-sc/ng-extract-i18n-merge?branch=master)
[![CodeQL](https://github.com/daniel-sc/ng-extract-i18n-merge/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/daniel-sc/ng-extract-i18n-merge/actions/workflows/github-code-scanning/codeql)

# Angular extract i18n and merge

This extends Angular CLI to improve the i18n extraction and merge workflow. New/removed translations are added/removed
from the target translation files. Additionally, translation files are normalized (pretty print, sorted by id) so that
diffs are easy to read (and translations in PRs might actually get reviewed ;-) ).

## Install

_Prerequisites_: i18n setup with defined target locales in `angular.json` - as
documented [here](https://angular.io/guide/i18n-common-merge).

```shell
ng add ng-extract-i18n-merge
```

### Upgrade from 1.x.x to 2.0.0

To upgrade use `ng update ng-extract-i18n-merge` - this will perform all necessary migrations.

Breaking changes:

* Now this plugin uses the default angular "extract-i18n" target - so you can (must) simply run `ng extract-i18n`! (#30)
* Default sort is now "stableAppendNew" (was: "idAsc") (#26).
* Leading/trailing whitespaces are normalized (i.e. collapsed to one space) but not completely trimmed (#28).
* Npm run script is removed (you can create a manual npm run script of course).

## Usage

```shell
ng extract-i18n # yes, same as before - this replaces the original builder
```

### Configuration

In your `angular.json` the target `extract-i18n` that can be configured with the following options:

| Name                         | Default                                                     | Description                                                                                                                                                                                                                                                                                                                                                         |
|------------------------------|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `browserTarget`              | Inferred from current setup by `ng add`                     | A browser builder target to extract i18n messages in the format of `project:target[:configuration]`. See https://angular.io/cli/extract-i18n#options                                                                                                                                                                                                                |
| `format`                     | Inferred from current setup by `ng add`                     | Any of `xlf`, `xlif`, `xliff`, `xlf2`, `xliff2`                                                                                                                                                                                                                                                                                                                     |
| `outputPath`                 | Inferred from current setup by `ng add`                     | Path to folder containing all (source and target) translation files.                                                                                                                                                                                                                                                                                                |
| `targetFiles`                | Inferred from current setup by `ng add`                     | Filenames (relative to `outputPath` of all target translation files (e.g. `["messages.fr.xlf", "messages.de.xlf"]`).                                                                                                                                                                                                                                                |
| `sourceLanguageTargetFile`   | Unused                                                      | If this is set (to one of the `targetFiles`), new translations in that target file will be set to `state="final"` (instead of default `state="new"`). This file can be used to manage changes to the source texts: when a translator updates the target, this tool will hint the developer to update the code occurrences.                                          |
| `sourceFile`                 | `messages.xlf`. `ng add` tries to infer non default setups. | Filename (relative to `outputPath` of source translation file (e.g. `"translations-source.xlf"`).                                                                                                                                                                                                                                                                   |
| `removeIdsWithPrefix`        | `[]`                                                        | List of prefix strings. All translation units with matching `id` attribute are removed. Useful for excluding duplicate library translations.                                                                                                                                                                                                                        |
| `includeOnlyPrefix`          | `null`                                                      | Include only translations starting with given prefix. Useful for extracting translations of a single library in a multi-library project.                                                                                                                                                                                                                            |
| `fuzzyMatch`                 | `true`                                                      | Whether translation units without matching IDs are fuzzy matched by source text.                                                                                                                                                                                                                                                                                    |
| `resetTranslationState`      | `true`                                                      | Reset the translation state to new/initial for new/changed units.                                                                                                                                                                                                                                                                                                   |
| `prettyNestedTags`           | `true` (will change to `false` with v3.0.0)                 | If source/target only contains xml nodes (interpolations, nested html), `true` formats these with line breaks and indentation. `false` keeps the original angular single line format. Note: while `true` was the historic implementation, it is _not_ recommended, as it adds whitespace between tags that had no whitespace in between and increases bundle sizes. |
| `collapseWhitespace`         | `true`                                                      | Collapsing of multiple whitespaces/line breaks in translation sources and targets.                                                                                                                                                                                                                                                                                  |
| `trim`                       | `false`                                                     | Trim translation sources and targets.                                                                                                                                                                                                                                                                                                                               |
| `includeContext`             | `false`                                                     | Whether to include the context information (like notes) in the translation files. This is useful for sending the target translation files to translation agencies/services. When `sourceFileOnly`, the context is retained only in the `sourceFile`.                                                                                                                |
| `newTranslationTargetsBlank` | `false`                                                     | When `false` (default) the "target" of new translation units is set to the "source" value. When `true`, an empty string is used. When `'omit'`, no target element is created.                                                                                                                                                                                       |
| `sort`                       | `"stableAppendNew"`                                         | Sorting of all translation units in source and target translation files. Supported: <br>`"idAsc"` (sort by translation IDs), <br>`"stableAppendNew"` (keep existing sorting, append new translations at the end), <br>`"stableAlphabetNew"` (keep existing sorting, sort new translations next to alphabetical close IDs)                                           |
| `builderI18n`                | `"@angular-devkit/build-angular:extract-i18n"`              | The builder to use for i18n extraction. Any custom builder should handle the same options as the default angular builder (browserTarget, outputPath, outFile, format, progress).                                                                                                                                                                                    |
| `verbose`                    | `false`                                                     | Extended/debug output - it is recommended to use this only for manual debugging.                                                                                                                                                                                                                                                                                    |

## Contribute

Feedback and PRs always welcome :-)

Before developing complex changes, I'd recommend opening an issue to discuss whether the indented goals match the scope of this package.
