[![npm](https://img.shields.io/npm/v/ng-extract-i18n-merge)](https://www.npmjs.com/package/ng-extract-i18n-merge)
[![Coverage Status](https://coveralls.io/repos/github/daniel-sc/ng-extract-i18n-merge/badge.svg?branch=main)](https://coveralls.io/github/daniel-sc/ng-extract-i18n-merge?branch=main)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/daniel-sc/ng-extract-i18n-merge.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/daniel-sc/ng-extract-i18n-merge/context:javascript)

# Angular extract i18n and merge

This extends Angular CLI to improve the i18n extraction and merge workflow. New/removed translations are added/removed
from the target translation files. Additionally, translation files are normalized (pretty print, sorted by id) so that
diffs are easy to read (and translations in PRs might actually get reviewd ;-) ).

## Install

```shell
ng add ng-extract-i18n-merge
```

## Usage

```shell
ng run [PROJECT_ID]:extract-i18n-merge
# or
npm run extract-i18n-merge 
```

## Contribute
PRs always welcome :-)
