import {TranslationFile, TranslationUnit} from './model/translationFileModels';
import {levenshtein} from '@angular-devkit/core/src/utils/strings';
import {Options} from './options';
import {doCollapseWhitespace} from './stringUtils';

const FUZZY_THRESHOLD = 0.2;

export class Merger {

    public readonly idMapping: { [id: string]: string } = {};

    constructor(private readonly options: Options,
                private readonly normalizedTranslationSourceFile: TranslationFile,
                private readonly initialTranslationState: string) {
    }

    public mergeWithMapping(destFileContent: TranslationFile, isSourceLang: boolean): [mergedDestFileContent: TranslationFile, idMappging: {
        [oldId: string]: string
    }] {

        const inUnitsById = new Map<string, TranslationUnit>(this.normalizedTranslationSourceFile.units.map(unit => [unit.id, unit]));
        const destUnitsById = new Map<string, TranslationUnit>(destFileContent.units.map(unit => [unit.id, unit]));
        const allInUnitsWithoutDestinationUnit = this.normalizedTranslationSourceFile.units.filter(u => !destUnitsById.has(u.id));
        const allInUnitsWithDestinationUnit = this.normalizedTranslationSourceFile.units.filter(u => destUnitsById.has(u.id));

        // collect (potentially) obsolete units (defer actual removal to allow for fuzzy matching..):
        const removeNodes = destFileContent.units.filter(destUnit => !inUnitsById.has(destUnit.id));

        const result = new TranslationFile([...destFileContent.units], destFileContent.sourceLang, destFileContent.targetLang, destFileContent.xmlHeader);

        for (const unit of allInUnitsWithDestinationUnit) {
            result.replaceUnit(unit, this.handle(unit, destUnitsById.get(unit.id), isSourceLang, removeNodes));
        }

        if (this.options.fuzzyMatch ?? true) {
            const bestMatchesIdToUnits = new Map<string, {
                elem: TranslationUnit,
                score: number
            }[]>(allInUnitsWithoutDestinationUnit.map((inUnit: TranslationUnit) => [inUnit.id, findCloseMatches(inUnit, removeNodes)]));
            while (bestMatchesIdToUnits.size) {
                const inUnitId: string = getMinScoreId(bestMatchesIdToUnits) ?? Array.from(bestMatchesIdToUnits.keys())[0];
                const bestMatch: TranslationUnit | undefined = bestMatchesIdToUnits.get(inUnitId)![0]?.elem;
                const updated = this.handle(inUnitsById.get(inUnitId)!, bestMatch, isSourceLang, removeNodes);
                if (bestMatch) {
                    result.replaceUnit(bestMatch, updated);
                } else {
                    result.addUnit(updated);
                }
                bestMatchesIdToUnits.delete(inUnitId);
                if (bestMatch) {
                    bestMatchesIdToUnits.forEach(x => {
                        const i = x.findIndex(y => y.elem === bestMatch);
                        if (i >= 0) {
                            x.splice(i, 1);
                        }
                    });
                }

            }
        } else {
            for (const unit of allInUnitsWithoutDestinationUnit) {
                result.addUnit(this.handle(unit, undefined, isSourceLang, removeNodes));
            }
        }

        console.debug(`removing ${removeNodes.length} ids: ${removeNodes.map(n => n.id).join(', ')}`);

        return [
            result.mapUnitsList(units => units.filter(unit => !removeNodes.includes(unit))),
            this.idMapping
        ];
    }

    /** Syncs `unit` to `destUnit` or adds `unit` as new, if `destUnit` is not given. */
    private handle(unit: TranslationUnit, destUnit: TranslationUnit | undefined, isSourceLang: boolean, removeNodes: TranslationUnit[]): TranslationUnit {
        if (destUnit) {
            let updatedDestUnit = destUnit;
            if (this.options.collapseWhitespace ?? true ? doCollapseWhitespace(destUnit.source) !== doCollapseWhitespace(unit.source) : destUnit.source !== unit.source) {
                console.debug(`update element with id "${unit.id}" with new source: ${unit.source} (was: ${destUnit.source})`);

                const syncTarget = isSourceLang || isUntranslated(destUnit, this.initialTranslationState);
                updatedDestUnit = {
                    ...destUnit,
                    state: isSourceLang ? 'final' : this.initialTranslationState,
                    source: unit.source,
                    target: syncTarget && !(destUnit.target === undefined && this.options.newTranslationTargetsBlank === 'omit') ? unit.source : destUnit.target
                }
            }
            if (destUnit.id !== unit.id) {
                console.debug(`matched unit with previous id "${destUnit.id}" to new id: "${unit.id}"`);
                this.idMapping[destUnit.id] = unit.id;
                removeNodes.splice(removeNodes.indexOf(destUnit), 1);
                updatedDestUnit = {
                    ...updatedDestUnit,
                    id: unit.id,
                    state: isSourceLang ? 'final' : this.initialTranslationState
                };
            }

            updatedDestUnit = {
                ...updatedDestUnit,
                locations: unit.locations,
                meaning: unit.meaning,
                description: unit.description
            };
            return updatedDestUnit;
        } else {
            console.debug(`adding element with id "${unit.id}"`);
            return {
                ...unit,
                target: this.options.newTranslationTargetsBlank === 'omit' ? undefined : ((this.options.newTranslationTargetsBlank ?? false) && !isSourceLang ? '' : unit.source),
                state: isSourceLang ? 'final' : this.initialTranslationState
            };
        }
    }


}


function isUntranslated(destUnit: TranslationUnit, initialState: string): boolean {
    return destUnit.state === initialState && (destUnit.target === undefined || destUnit.source === destUnit.target);
}

function findCloseMatches(originUnit: TranslationUnit, destUnits: TranslationUnit[]): {
    elem: TranslationUnit,
    score: number
}[] {
    const originText = originUnit.source;
    return destUnits
        .map(n => ({
            elem: n,
            score: levenshtein(originText, n.source) / originText.length
        }))
        .filter(x => x.score < FUZZY_THRESHOLD)
        .sort((a, b) => a.score - b.score);
}

function getMinScoreId(bestMatchesIdToUnits: Map<string, {
    elem: TranslationUnit;
    score: number
}[]>): string | undefined {
    let minScoreId: string | undefined;
    let minScore = Number.MAX_VALUE;
    bestMatchesIdToUnits.forEach((x, id) => {
        if (x.length) {
            const score = x[0].score;
            if (score < minScore) {
                minScore = score;
                minScoreId = id;
            }
        }
    });
    return minScoreId;
}
