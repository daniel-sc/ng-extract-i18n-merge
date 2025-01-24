import {promises as fs} from 'fs';
import {readFileIfExists} from './fileUtils';
import {rmSafe} from './rmSafe';

describe('fileUtils', () => {
    it('should return file contents if file is present', async () => {
        try {
            await fs.writeFile('test.txt', 'test file content\nsecond line', 'utf8');
            const result = await readFileIfExists('test.txt');
            expect(result).toEqual('test file content\nsecond line');
        } finally {
            await rmSafe('test.txt');
        }
    });
    it('should return null if file does not exists', async () => {
        const result = await readFileIfExists('a-file-that-does-not-exist.txt');
        expect(result).toBeNull();
    });
    it('should throw any other error', async () => {
        await expect(readFileIfExists('.')).rejects.toMatchObject({code: 'EISDIR'});
    });
});
