import {TranslationFile} from './translationFileModels';

describe('translationFileModels', () => {
    describe('replaceUnit', () => {
        it('should throw error if unit not found', () => {
            const translationFile = new TranslationFile([], 'de');
            expect(() => translationFile.replaceUnit({id: 'ID1', source: 'source val', locations: []}, {
                id: 'ID2',
                source: 'source val',
                locations: []
            })).toThrowError('Unit ID1 not found');
        });
    });
});
