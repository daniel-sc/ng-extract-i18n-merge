import {promises as fs} from 'fs';

export async function rmSafe(path: string) {
    if (fs.rm) {
        await fs.rm(path, {maxRetries: 5, force: true});
    } else {
        // gracefully fall back for node v12:
        await fs.unlink(path);
    }
}
