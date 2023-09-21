import {BuilderContext, BuilderOutput, createBuilder} from '@angular-devkit/architect';
import {basename, dirname, join, normalize} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import {readFileIfExists} from './fileUtils';
import {findLexClosestIndex} from './lexUtils';
import {fromXlf1, fromXlf2, toXlf1, toXlf2} from './model/translationFileSerialization';
import {TranslationFile, TranslationUnit} from './model/translationFileModels';
import {Merger} from './merger';
import {Options} from './options';
import {doCollapseWhitespace} from './stringUtils';


const STATE_INITIAL_XLF_2_0 = 'initial';
const STATE_INITIAL_XLF_1_2 = 'new';

const builder: ReturnType<typeof createBuilder> = createBuilder(extractI18nMergeBuilder);
export default builder;

/**
 * Sorts translation units of `updatedTranslationSourceFile` by the order of their appearance in `originalTranslationSourceFile` (returned as children of `translationUnitsParent`).
 * If an id is not found in `originalTranslationSourceFile`, it is returned in `newUnits`.
 */
function resetSortOrderStable(originalTranslationSourceFile: TranslationUnit[] | null, updatedTranslationSourceFile: TranslationUnit[], idMapping: {
    [oldId: string]: string
}): {
    updatedTranslationSourceDoc: TranslationUnit[],
    newUnits: TranslationUnit[]
} {
    const originalIdsOrder = originalTranslationSourceFile?.map(unit => idMapping[unit.id] ?? unit.id) ?? [];
    const originalIds = new Set(originalIdsOrder);

    const result = updatedTranslationSourceFile
        .filter(n => originalIds.has(n.id))
        .sort((a, b) => {
            const indexA = originalIdsOrder.indexOf(a.id);
            const indexB = originalIdsOrder.indexOf(b.id);
            return indexA - indexB;
        });
    return {
        updatedTranslationSourceDoc: result,
        newUnits: updatedTranslationSourceFile.filter(n => !originalIds.has(n.id))
    };
}

function resetSortOrderStableAppendNew(originalTranslationSourceFile: TranslationUnit[] | null, updatedTranslationSourceFile: TranslationUnit[], idMapping: {
    [oldId: string]: string
}): TranslationUnit[] {
    const resetStable = resetSortOrderStable(originalTranslationSourceFile, updatedTranslationSourceFile, idMapping);

    const newUnitsSorted = resetStable.newUnits.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
    resetStable.updatedTranslationSourceDoc.push(...newUnitsSorted);

    return resetStable.updatedTranslationSourceDoc;
}


function resetSortOrderStableAlphabetNew(originalTranslationSourceFile: TranslationUnit[] | null, updatedTranslationSourceFile: TranslationUnit[], idMapping: {
    [oldId: string]: string
}): TranslationUnit[] {
    const resetStable = resetSortOrderStable(originalTranslationSourceFile, updatedTranslationSourceFile, idMapping);
    resetStable.newUnits
        .sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()))
        .forEach(newUnit => {
            const [index, before] = findLexClosestIndex(newUnit.id.toLowerCase(), resetStable.updatedTranslationSourceDoc, unit => unit.id.toLowerCase());
            resetStable.updatedTranslationSourceDoc.splice(index + (before ? 0 : 1), 0, newUnit);
        });


    return resetStable.updatedTranslationSourceDoc;
}

async function extractI18nMergeBuilder(options: Options, context: BuilderContext): Promise<BuilderOutput> {
    context.logger.info(`Running ng-extract-i18n-merge for project ${context.target?.project}`);

    if (!options.verbose) {
        console.debug = () => null; // prevent debug output from xml_normalize and xliff-simple-merge
    }
    context.logger.debug(`options: ${JSON.stringify(options)}`);
    const outputPath = options.outputPath as string || '.';
    const format = options.format as string || 'xlf';
    const isXliffV2 = format.includes('2');
    const initialTranslationState = isXliffV2 ? STATE_INITIAL_XLF_2_0 : STATE_INITIAL_XLF_1_2;

    function fromXlf(input: string): TranslationFile;
    function fromXlf(input: string | undefined | null): TranslationFile | undefined;
    function fromXlf(input: string | undefined | null): TranslationFile | undefined {
        return (input !== undefined && input !== null) ? (isXliffV2 ? fromXlf2(input) : fromXlf1(input)) : undefined;
    }

    function toXlf(output: TranslationFile): string {
        return isXliffV2 ? toXlf2(output) : toXlf1(output);
    }

    context.logger.info('running "extract-i18n" ...');
    const sourcePath = join(normalize(outputPath), options.sourceFile ?? 'messages.xlf');
    const translationSourceFileOriginal = fromXlf(await readFileIfExists(sourcePath));

    const extractI18nRun = await context.scheduleBuilder(options.builderI18n ?? '@angular-devkit/build-angular:extract-i18n', {
        browserTarget: options.browserTarget,
        outputPath: dirname(sourcePath),
        outFile: basename(sourcePath),
        format,
        progress: false
    }, {target: context.target, logger: context.logger.createChild('extract-i18n')});
    const extractI18nResult = await extractI18nRun.result;
    if (!extractI18nResult.success) {
        return {success: false, error: `"extract-i18n" failed: ${extractI18nResult.error}`};
    }
    context.logger.info(`extracted translations successfully`);

    context.logger.info(`normalize ${sourcePath} ...`);
    const translationSourceFile = fromXlf(await fs.readFile(sourcePath, 'utf8'));

    const sort: Options['sort'] = options.sort ?? 'stableAppendNew';
    const identityMapper = (x: string) => x;
    const mapper = pipe(
        (options.collapseWhitespace ?? true) ? doCollapseWhitespace : identityMapper,
        (options.trim ?? false) ? ((text: string) => text.trim()) : identityMapper
    );
    const removeContextSource = options.includeContext !== true && options.includeContext !== 'sourceFileOnly';
    const normalizedTranslationSourceFile = translationSourceFile.mapUnitsList(units => {
        const updatedUnits: TranslationUnit[] = units
            .filter(unit => !options.removeIdsWithPrefix?.some(removePrefix => unit.id.startsWith(removePrefix)))
            .map(unit => ({
                ...unit,
                source: mapper(unit.source),
                target: unit.target !== undefined ? mapper(unit.target) : undefined,
                locations: removeContextSource ? [] : unit.locations
            }));
        if (sort === 'idAsc') {
            return updatedUnits.sort((a, b) => a.id.localeCompare(b.id));
        }
        return updatedUnits;
    });

    const merger = new Merger(options, normalizedTranslationSourceFile, initialTranslationState);

    for (const targetFile of options.targetFiles) {
        const targetPath = join(normalize(outputPath), targetFile);
        context.logger.info(`merge and normalize ${targetPath} ...`);
        const translationTargetFileContent = await readFileIfExists(targetPath);
        const translationTargetFile = translationTargetFileContent ? fromXlf(translationTargetFileContent) : new TranslationFile([], translationSourceFile.sourceLang, targetPath?.match(/\.([a-zA-Z-]+)\.xlf$/)?.[1] ?? 'en');
        const [mergedTarget, mapping] = merger.mergeWithMapping(translationTargetFile, targetFile === options.sourceLanguageTargetFile);
        const normalizedTarget = mergedTarget.mapUnitsList(units => {
            const updatedUnits = units.filter(unit => !options.removeIdsWithPrefix?.some(removePrefix => unit.id.startsWith(removePrefix)))
                .map(unit => ({
                    ...unit,
                    source: mapper(unit.source),
                    target: unit.target !== undefined ? mapper(unit.target) : undefined,
                    locations: options.includeContext === true ? unit.locations : []
                }));
            if (sort === 'idAsc') {
                updatedUnits.sort((a, b) => a.id.localeCompare(b.id));
            } else if (sort === 'stableAlphabetNew') {
                return resetSortOrderStableAlphabetNew(translationTargetFile?.units || null, updatedUnits, mapping)
            }
            return updatedUnits;
        });

        await fs.writeFile(targetPath, toXlf(normalizedTarget));
    }

    const sortedTranslationSource = normalizedTranslationSourceFile.mapUnitsList(units => {
        if (sort === 'stableAppendNew') {
            return resetSortOrderStableAppendNew(translationSourceFileOriginal?.units ?? null, units, merger.idMapping);
        } else if (sort === 'stableAlphabetNew') {
            return resetSortOrderStableAlphabetNew(translationSourceFileOriginal?.units ?? null, units, merger.idMapping);
        } else {
            return units;
        }
    });

    await fs.writeFile(sourcePath, toXlf(sortedTranslationSource));

    context.logger.info('finished i18n merging and normalizing');
    return {success: true};
}

const pipe = <T>(...fns: ((a: T) => T)[]) =>
    fns.reduce((prevFn, nextFn) => value => nextFn(prevFn(value)), x => x);
