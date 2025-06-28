import {JsonObject} from '@angular-devkit/core';

export interface Options extends JsonObject {
    format: 'xlf' | 'xlif' | 'xliff' | 'xlf2' | 'xliff2' | null
    outputPath: string | null,
    sourceFile: string | null,
    targetFiles: string[],
    sourceLanguageTargetFile: string | null,
    removeIdsWithPrefix: string[] | null,
    includeIdsWithPrefix: string[] | null,
    fuzzyMatch: boolean,
    resetTranslationState: boolean,
    prettyNestedTags: boolean,
    selfClosingEmptyTargets: boolean,
    sortNestedTagAttributes: boolean,
    collapseWhitespace: boolean,
    trim: boolean,
    includeContext: boolean | 'sourceFileOnly',
    includeMeaningAndDescription: boolean,
    newTranslationTargetsBlank: boolean | 'omit',
    sort: 'idAsc' | 'stableAppendNew' | 'stableAlphabetNew',
    buildTarget: string | null,
    builderI18n: string | null,
    verbose: boolean
}
