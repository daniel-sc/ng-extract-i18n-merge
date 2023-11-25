// Refer to https://developer.mozilla.org/en-US/docs/Web/CSS/white-space-collapse#collapsing_of_white_space
export function doCollapseWhitespace<T extends string | undefined>(destSourceText: T): T {
    let result = destSourceText
        ?.replace(/\t+/g, ' ')              // Convert tabs to spaces
        ?.replace(/(\r\n|\n|\r)+/g, ' ')    // Collapse "sequences of segment breaks" to a single space (no need to preserve line-breaks)
        ?.replace(/ *([^\S ]+) */g, '$1')   // Remove space before or after a "space-like" character that is not a space (e.g. no-break space).
        ?.replace(/ {2,}/g, ' ');           // Collapse sequences of spaces to a single space

    return result as T;
}
