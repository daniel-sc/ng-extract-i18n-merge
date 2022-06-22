import {promises as fs} from 'fs';

export async function readFileIfExists(path: string): Promise<string | null> {
    try {
        return await fs.readFile(path, 'utf8');
    } catch (e) {
        // a missing file is OK
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw e;
        }
    }
    return null;
}
