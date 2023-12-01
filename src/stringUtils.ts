// Converts sequences of space, tabs and "section breaks" like linefeeds and
// carriage returns to a single space, but leaving other space characters like
// no-break-space (U+00A0) intact.
// Refer to https://developer.mozilla.org/en-US/docs/Web/CSS/white-space-collapse#collapsing_of_white_space
export function doCollapseWhitespace<T extends string | undefined>(destSourceText: T): T {
    return destSourceText?.replace(/[\n\r\t ]+/g, ' ') as T;
}
