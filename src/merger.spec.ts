import {Merger} from './merger';
import {TranslationFile} from './model/translationFileModels';

describe('merger', () => {
    describe('mergeWithMapping', () => {
        it('should fuzzy match correctly', () => {
            const translationSourceFile = new TranslationFile([
                {id: 'a1', source: 'aaaaaaaaaaa1', locations: []},
                {id: 'a2', source: 'aaaaaaaaaaa2', locations: []},
                {id: 'b', source: 'bbbbbbb', locations: []},
                {id: 'c', source: 'ccccccc', locations: []},
            ], 'en');
            const translationTargetFile = new TranslationFile([
                {id: '1.1', source: 'aaaaaaaaaa11', target: 'aaa1', state: 'translated', locations: []},
                {id: '1.2', source: 'aaaaaaaaaa22', target: 'aaa2', state: 'translated', locations: []},
                {id: '2', source: 'bbbbbb1', target: 'bbb1', state: 'translated', locations: []},
                {id: '3', source: 'ccccccc', target: 'ccc1', state: 'translated', locations: []},
            ], 'en', 'de');
            const merger = new Merger({fuzzyMatch: true}, translationSourceFile, 'new');
            const mergedTarget = merger.mergeWithMapping(translationTargetFile, false);
            expect(mergedTarget.units).toEqual([
                {id: 'a1', source: 'aaaaaaaaaaa1', target: 'aaa1', state: 'new', locations: [], description: undefined, meaning: undefined},
                {id: 'a2', source: 'aaaaaaaaaaa2', target: 'aaa2', state: 'new', locations: [], description: undefined, meaning: undefined},
                {id: 'b', source: 'bbbbbbb', target: 'bbb1', state: 'new', locations: [], description: undefined, meaning: undefined},
                {id: 'c', source: 'ccccccc', target: 'ccc1', state: 'translated', locations: [], description: undefined, meaning: undefined},
            ]);
        });
    });
});
