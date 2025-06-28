import {promises as fs} from 'fs';

export async function rmSafe(path: string) {
    await fs.rm(path, {maxRetries: 5, force: true});
}
