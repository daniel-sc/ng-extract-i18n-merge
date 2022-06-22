import {promises as fs} from 'fs';
import {readFileIfExists} from './fileUtils';

describe('fileUtils', () => {
    it('should return file contents if file is present', async () => {
        try {
            await fs.writeFile('test.txt', 'test file content\nsecond line', 'utf8');
            const result = await readFileIfExists('test.txt');
            expect(result).toEqual('test file content\nsecond line');
        } finally {
            await fs.rm?.('test.txt');
        }
    });
    it('should return null if file does not exists', async () => {
        const result = await readFileIfExists('a-file-that-does-not-exist.txt');
        expect(result).toBeNull();
    });
    it('should throw any other error', async () => {
        jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('some random fs error'));
        await expect(readFileIfExists('some-file.txt')).rejects.toEqual(new Error('some random fs error'));
    });
});
