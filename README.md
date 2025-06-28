[![npm](https://img.shields.io/npm/v/ng-extract-i18n-merge)](https://www.npmjs.com/package/ng-extract-i18n-merge)
[![Coverage Status](https://coveralls.io/repos/github/daniel-sc/ng-extract-i18n-merge/badge.svg?branch=master)](https://coveralls.io/github/daniel-sc/ng-extract-i18n-merge?branch=master)
[![CodeQL](https://github.com/daniel-sc/ng-extract-i18n-merge/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/daniel-sc/ng-extract-i18n-merge/actions/workflows/github-code-scanning/codeql)

# Angular extract i18n and merge

This extends Angular CLI to improve the i18n extraction and merge workflow. 
New/removed translations are added/removed from the target translation files and translation states are managed. 
Additionally, translation files are normalized (whitespace, stable sort) so that diffs are easy to read 
(and translations in PRs might actually get reviewed ;-) ).

> [!TIP]
> If you'd like to keep your translation process simple and rather validate translations, then waiting for actual translations, I'd like you to check out [doloc.io](https://doloc.io).
>
>  Created by the maintainer of `ng-extract-i18n-merge` ([@daniel-sc](https://github.com/daniel-sc)),
> it integrates seamlessly with this library (see [here](https://github.com/daniel-sc/ng-extract-i18n-merge/discussions/115)) and provides instant translations on extraction!
>
> Expect great translations!

## Install

_Prerequisites_: i18n setup with defined target locales in `angular.json` - as
documented [here](https://angular.dev/guide/i18n/merge).

```shell
ng add ng-extract-i18n-merge
```

### Upgrade from 1.x.x to 2.0.0

Run `ng update ng-extract-i18n-merge@2` to upgrade from v1 to v2. This migration
switches to Angular's built-in `extract-i18n` builder and changes some defaults
(see breaking changes below).

If you plan to upgrade from v1 straight to v3 you must first upgrade to v2 using
the command above and then run `ng update ng-extract-i18n-merge` again for the
v3 update.

Breaking changes:

* Now this plugin uses the default Angular `extract-i18n` target - so you can
  simply run `ng extract-i18n`.
* Default sort is now `stableAppendNew` (was `idAsc`).
* Leading/trailing whitespaces are normalized (collapsed to one space) but not
  completely trimmed.
* The provided npm run script was removed (you can create your own if needed).

### Upgrade from 2.x.x to 3.0.0

Run `ng update ng-extract-i18n-merge` to update to v3.0.0 using the Angular update mechanism.
This release drops support for Angular 19 and older.
The defaults for `prettyNestedTags` and `sort` changed to `false` and `"stableAlphabetNew"` respectively.
During `ng update` existing builder configurations are updated to keep the previous behaviour.

## Usage

```shell
ng extract-i18n # yes, same as before - this replaces the original builder
```

### Configuration

In your `angular.json` the target `extract-i18n` that can be configured with the following options:

| Name                           | Default                                                                                                                        | Description                                                                                                                                                                                                                                                                                                                                                         |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `buildTarget`                  | Inferred from current setup by `ng add`
  | A build builder target to extract i18n messages in the format of `project:target[:configuration]`. See https://angular.io/cli/extract-i18n#options
                                        |
| `format`                       | Inferred from current setup by `ng add`                                                                                        | Any of `xlf`, `xlif`, `xliff`, `xlf2`, `xliff2`                                                                                                                                                                                                                                                                                                                     |
| `outputPath`                   | Inferred from current setup by `ng add`                                                                                        | Path to folder containing all (source and target) translation files.                                                                                                                                                                                                                                                                                                |
| `targetFiles`                  | Inferred from current setup by `ng add`                                                                                        | Filenames (relative to `outputPath` of all target translation files (e.g. `["messages.fr.xlf", "messages.de.xlf"]`).                                                                                                                                                                                                                                                |
| `sourceLanguageTargetFile`     | `null`                                                                                                                         | If this is set (to one of the `targetFiles`), new translations in that target file will be set to `state="final"` (instead of default `state="new"`). This file can be used to manage changes to the source texts: when a translator updates the target, this tool will hint the developer to update the code occurrences.                                          |
| `sourceFile`                   | `messages.xlf`. `ng add` tries to infer non default setups.                                                                    | Filename (relative to `outputPath` of source translation file (e.g. `"translations-source.xlf"`).                                                                                                                                                                                                                                                                   |
| `removeIdsWithPrefix`          | `[]`                                                                                                                           | List of prefix strings. All translation units with matching `id` attribute are removed. Useful for excluding duplicate library translations. Cannot be used in combination with `includeIdsWithPrefix`.                                                                                                                                                             |
| `includeIdsWithPrefix`         | `[]`                                                                                                                           | List of prefix strings. When non-empty, only translations units with matching `id` are included. Useful for extracting translations of a single library in a multi-library project. Cannot be used in combination with `removeIdsWithPrefix`.                                                                                                                       |
| `fuzzyMatch`                   | `true`                                                                                                                         | Whether translation units without matching IDs are fuzzy matched by source text.                                                                                                                                                                                                                                                                                    |
| `resetTranslationState`        | `true`                                                                                                                         | Reset the translation state to new/initial for new/changed units.                                                                                                                                                                                                                                                                                                   |
| `prettyNestedTags`             | `false`                                                                                    | If source/target only contains xml nodes (interpolations, nested html), `true` formats these with line breaks and indentation. `false` keeps the original angular single line format. Note: while `true` was the historic implementation, it is _not_ recommended, as it adds whitespace between tags that had no whitespace in between and increases bundle sizes. |
| `selfClosingEmptyTargets`      | `true`                                                                                                                         | If `false` empty target nodes are non self-closing.                                                                                                                                                                                                                                                                                                                 |
| `sortNestedTagAttributes`      | `false`                                                                                                                        | Attributes of xml nodes (interpolations, nested html) in source/target/meaning/description can be sorted for normalization.                                                                                                                                                                                                                                         |
| `collapseWhitespace`           | `true`                                                                                                                         | Collapsing of multiple whitespaces/line breaks in translation sources and targets. This handles changed leading/trailing whitespaces intelligently - i.e. updates the target accordingly _without_ resetting the translation state when only leading/trailing whitespace was changed.                                                                               |
| `trim`                         | `false`                                                                                                                        | Trim translation sources and targets.                                                                                                                                                                                                                                                                                                                               |
| `includeContext`               | `false`                                                                                                                        | Whether to include the context information (like notes) in the translation files. This is useful for sending the target translation files to translation agencies/services. When `sourceFileOnly`, the context is retained only in the `sourceFile`.                                                                                                                |
| `includeMeaningAndDescription` | `true`                                                                                                                         | Whether to include the meaning and description information in the translation files.                                                                                                                                                                                                                                                                                |
| `newTranslationTargetsBlank`   | `false`                                                                                                                        | When `false` (default) the "target" of new translation units is set to the "source" value. When `true`, an empty string is used. When `'omit'`, no target element is created.                                                                                                                                                                                       |
| `sort`                         | `"stableAlphabetNew"`                                                           | Sorting of all translation units in source and target translation files. Supported: <br>`"idAsc"` (sort by translation IDs), <br>`"stableAppendNew"` (keep existing sorting, append new translations at the end), <br>`"stableAlphabetNew"` (keep existing sorting, sort new translations next to alphabetical close IDs).                                          |
| `builderI18n`                  | `"@angular-devkit/build-angular:extract-i18n"` or `"@angular/build:extract-i18n"` depending on "build" config in angular.json  | The builder to use for i18n extraction. Any custom builder should handle the same options as the default angular builder (buildTarget, outputPath, outFile, format, progress).                                                                                                                                                                                      |
| `verbose`                      | `false`                                                                                                                        | Extended/debug output - it is recommended to use this only for manual debugging.                                                                                                                                                                                                                                                                                    |

## Contribute

Feedback and PRs always welcome :-)

Before developing complex changes, I'd recommend opening an issue to discuss whether the indented goals match the scope of this package.
