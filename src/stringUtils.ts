export function doCollapseWhitespace<T extends string | undefined>(destSourceText: T): T {
    return destSourceText?.replace(/\s+/g, ' ') as T;
}
