import {promises as fs, readdirSync, statSync} from 'fs';
import path from "path";

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

export function getAllFileInDir(directory: string) {
    const _files: string[]  = [];
    function throughDirectory(directory: string): void {
        readdirSync(directory).forEach((file: string) => {
            const absolutePath = path.join(directory, file);
            if (statSync(absolutePath).isDirectory()) return throughDirectory(absolutePath);
            else return _files.push(absolutePath);
        });
    }
    throughDirectory(directory);
    return _files;
}
