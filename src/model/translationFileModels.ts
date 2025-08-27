export interface FileLocation {
    file: string;
    lineStart?: number;
    lineEnd?: number;
}

export interface TranslationUnit {
    id: string;
    source: string;
    target?: string;
    state?: string;
    meaning?: string;
    description?: string;
    locations: FileLocation[];
    additionalAttributes?: { name: string, value: string, path: string }[];
}


export class TranslationFile {

    constructor(public readonly units: TranslationUnit[], public readonly sourceLang: string, public readonly targetLang?: string, public readonly xmlHeader?: string, public readonly trailingWhitespace?: string) {
    }

    mapUnitsList(unitsMapper: (units: TranslationUnit[]) => TranslationUnit[]): TranslationFile {
        return new TranslationFile(unitsMapper(this.units), this.sourceLang, this.targetLang, this.xmlHeader, this.trailingWhitespace);
    }

    replaceUnit(unit: TranslationUnit, updated: TranslationUnit) {
        const index = this.units.findIndex(u => u.id === unit.id); // TODO performance?
        if (index === -1) {
            throw new Error(`Unit ${unit.id} not found`);
        }
        this.units[index] = updated;
    }

    addUnit(updated: TranslationUnit) {
        this.units.push(updated);
    }
}
