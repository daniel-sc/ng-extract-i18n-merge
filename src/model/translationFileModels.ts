interface Location {
    file: string;
    line: number;
}

export interface TranslationUnit {
    id: string;
    source: string;
    target?: string;
    state?: string;
    meaning?: string;
    description?: string;
    locations: Location[];
}


export class TranslationFile {


    constructor(public readonly units: TranslationUnit[], public sourceLang: string, public targetLang?: string, public xmlHeader?: string) {
    }

    mapUnitsList(unitsMapper: (units: TranslationUnit[]) => TranslationUnit[]): TranslationFile {
        return new TranslationFile(unitsMapper(this.units), this.sourceLang, this.targetLang, this.xmlHeader);
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
