import {findLexClosestIndex, LexDist} from './lexUtils';

describe('lexUtils', () => {
    describe('LexDist', () => {
        describe('smallerThan', () => {
            it('should use natural order', () => {
                expect(new LexDist([1]).smallerThan(new LexDist([2]))).toEqual(true);
                expect(new LexDist([1, 2, 3]).smallerThan(new LexDist([1, 2, 4]))).toEqual(true);
                expect(new LexDist([1, 2, 3]).smallerThan(new LexDist([1, 3, 4]))).toEqual(true);
                expect(new LexDist([1, 2, 3]).smallerThan(new LexDist([2, 3, 1]))).toEqual(true);
            });
            it('should handle shorter strings correctly', () => {
                expect(new LexDist([1]).smallerThan(new LexDist([1, 1]))).toEqual(true);
                expect(new LexDist([1, 1]).smallerThan(new LexDist([1]))).toEqual(false);
            });
            it('should handle neg correctly', () => {
                expect(new LexDist([1, -1]).smallerThan(new LexDist([1, 2]))).toEqual(true);
                expect(new LexDist([1, -2]).smallerThan(new LexDist([1, 1]))).toEqual(true);
                expect(new LexDist([-1, -1]).smallerThan(new LexDist([1, 2]))).toEqual(true);
                expect(new LexDist([-1, 2]).smallerThan(new LexDist([1, 2]))).toEqual(true);
                expect(new LexDist([-1, -2]).smallerThan(new LexDist([1, 1]))).toEqual(false);
            });
        });
        const zero = new LexDist([]);
        it('should be positive for a < b', () => {
            expect(LexDist.fromDifference('a', 'b')).toEqual(new LexDist([1]));
            expect(LexDist.fromDifference('a', 'b').isNegative()).toEqual(false);
        });
        it('should be positive for 0 < 1', () => {
            expect(LexDist.fromDifference('0', '1').isNegative()).toEqual(false);
        });
        it('should be negative for a > b', () => {
            expect(LexDist.fromDifference('b', 'a').isNegative()).toEqual(true);
        });
        it('should be positive for a substr b', () => {
            expect(LexDist.fromDifference('a', 'ab').isNegative()).toEqual(false);
        });
        it('should be negative for b substr a', () => {
            expect(LexDist.fromDifference('ab', 'a').isNegative()).toEqual(true);
        });
        it('should be 0 for a = b', () => {
            expect(LexDist.fromDifference('a', 'a').normalize()).toEqual(zero);
        });
        it('should return larger value for substring', () => {
            expect(LexDist.fromDifference('IDa1', 'IDb').smallerThan(LexDist.fromDifference('IDa', 'IDb'))).toEqual(true);
        });
        it('should return smaller value for substring reversed', () => {
            expect(LexDist.fromDifference('IDb', 'IDa').smallerThan(LexDist.fromDifference('IDb', 'IDa1'))).toEqual(false);
        });
        it('should return smaller value for substring reversed other example', () => {
            expect(LexDist.fromDifference('IDd', 'IDc0').smallerThan(LexDist.fromDifference('IDd', 'IDc1'))).toEqual(false);
        });
        it('should return larger value for postfix 0 compared to postfix 1', () => {
            expect(LexDist.fromDifference('IDcb', 'IDd').smallerThan(LexDist.fromDifference('IDca', 'IDd'))).toEqual(true);
        });
        it('should return larger value for long substring', () => {
            expect(LexDist.fromDifference('LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-a1', 'LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-b')
                .smallerThan(LexDist.fromDifference('LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-a', 'LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-b'))
            ).toEqual(true);
        });
        it('should return larger value for long substring with different prefix', () => {
            expect(LexDist.fromDifference('LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-a1', 'xLONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-b')
                .smallerThan(LexDist.fromDifference('LONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-a', 'xLONG_ID_THAT_IS_VERY_VERY_LONG_EVEN_LONGER_THAN_NORMAL-b'))
            ).toEqual(true);
        });
        it('should be smaller if difference is later', () => {
            expect(LexDist.fromDifference('aaa', 'aab').smallerThan(LexDist.fromDifference('aa', 'ab'))).toEqual(true);
        });
        it('should work with another example', () => {
            expect(LexDist.fromDifference('IDd', 'IDf').smallerThan(LexDist.fromDifference('IDc1', 'IDf'))).toEqual(true);
        });
    });
    describe('findLexClosestIndex', () => {
        it('should work with basic example - after', () => {
            const units = ['IDc0', 'IDc1', 'IDa', 'IDg'];
            const [index, before] = findLexClosestIndex('IDd', units, (unit) => unit);
            expect(index).toEqual(1);
            expect(before).toEqual(false);
        });
        it('should work with basic example - before', () => {
            const units = ['IDc0', 'IDc1', 'IDa', 'IDg'];
            const [index, before] = findLexClosestIndex('IDe5', units, (unit) => unit);
            expect(index).toEqual(3);
            expect(before).toEqual(true);
        });
        it('should return correct value for empty list', () => {
            const [index, before] = findLexClosestIndex('IDd', [], (unit) => unit);
            expect(index).toEqual(0);
            expect(before).toEqual(true);
        });
    });
});
