

export function doCollapseWhitespace(destSourceText: string): string {
    return destSourceText.replace(/\s+/g, ' ');
}
