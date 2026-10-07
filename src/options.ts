import type {ExtractI18nBuilderOptions} from '@angular/build';
import {JsonObject} from '@angular-devkit/core';

type AdditionalAngularExtractionOptions = Omit<ExtractI18nBuilderOptions,
    'buildTarget' | 'outputPath' | 'outFile' | 'format' | 'progress'>;

// Accept JSON string literals for Angular's enums and additional options for custom builders.
export type BuilderI18nOptions = JsonObject & {
    [K in keyof AdditionalAngularExtractionOptions]: AdditionalAngularExtractionOptions[K] extends string | undefined
        ? `${Exclude<AdditionalAngularExtractionOptions[K], undefined>}`
        : AdditionalAngularExtractionOptions[K];
};

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
    includeContextLineNumber: boolean,
    includeMeaningAndDescription: boolean,
    newTranslationTargetsBlank: boolean | 'omit',
    sort: 'idAsc' | 'stableAppendNew' | 'stableAlphabetNew',
    buildTarget: string | null,
    builderI18n: string | null,
    builderI18nOptions: BuilderI18nOptions,
    verbose: boolean
}
