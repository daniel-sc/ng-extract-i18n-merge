import {XmlDocument, XmlElement, XmlNode, XmlTextNode} from 'xmldoc';
import {TranslationFile, TranslationUnit} from './translationFileModels';
import {Options} from '../options';


const XML_DECLARATION_MATCHER = /^<\?xml [^>]*>\s*/i;

const REGULAR_ATTRIBUTES_XLF1: {[nodeName: string]: string[]} = {
    'trans-unit': ['id', 'datatype'],
    'source': [],
    'target': ['state'],
    'note': ['priority', 'from'],
    'context': ['context-type'],
    'context-group': ['purpose']
}

const REGULAR_ATTRIBUTES_XLF2: {[nodeName: string]: string[]} = {
    'unit': ['id'],
    'notes': [],
    'note': ['category'],
    'segment': ['state'],
    'source': [],
    'target': []
}

export function fromXlf2(xlf2: string,
    options: Pick<Options, 'sortNestedTagAttributes'> = { sortNestedTagAttributes: false }): TranslationFile {

    const xmlDeclaration = xlf2.match(XML_DECLARATION_MATCHER)?.[0];
    const doc = new XmlDocument(xlf2);
    const file = doc.childNamed('file')!;
    const units = file.children
        .filter((n): n is XmlElement => n.type === 'element')
        .map(unit => {
            const segment = unit.childNamed('segment')!;
            const notes = unit.childNamed('notes');
            const result: TranslationUnit = {
                id: unit.attr.id,
                source: toString(options, ...segment.childNamed('source')!.children),
                target: toStringOrUndefined(options, segment.childNamed('target')?.children),
                state: segment.attr.state,
                meaning: toStringOrUndefined(options, notes?.childWithAttribute('category', 'meaning')?.children),
                description:
                    toStringOrUndefined(options, notes?.childWithAttribute('category', 'description')?.children),
                locations: notes?.children
                    .filter((n): n is XmlElement => n.type === 'element' && n.attr.category === 'location')
                    .map(note => {
                        const [file, lines] = note.val.split(':', 2);
                        const [lineStart, lineEnd] = lines.split(',', 2);
                        return {
                            file,
                            lineStart: parseInt(lineStart, 10),
                            lineEnd: lineEnd !== undefined ? parseInt(lineEnd, 10) : undefined
                        };
                    }) ?? []
            };
            const additionalAttributes = getAdditionalAttributes(unit, REGULAR_ATTRIBUTES_XLF2);
            if (additionalAttributes.length) {
                result.additionalAttributes = additionalAttributes;
            }
            return result;
        });
    return new TranslationFile(units, doc.attr.srcLang, doc.attr.trgLang, xmlDeclaration);
}

export function fromXlf1(xlf1: string,
    options: Pick<Options, 'sortNestedTagAttributes'> = { sortNestedTagAttributes: false }): TranslationFile {

    const xmlDeclaration = xlf1.match(XML_DECLARATION_MATCHER)?.[0];
    const doc = new XmlDocument(xlf1);
    const file = doc.childNamed('file')!;
    const units = file.childNamed('body')!.children
        .filter((n): n is XmlElement => n.type === 'element')
        .map(unit => {
            const notes = unit.childrenNamed('note');
            const target = unit.childNamed('target');
            const result: TranslationUnit  = {
                id: unit.attr.id,
                source: toString(options, ...unit.childNamed('source')!.children),
                target: toStringOrUndefined(options, target?.children),
                state: target?.attr.state,
                meaning: toStringOrUndefined(options, notes?.find(note => note.attr.from === 'meaning')?.children),
                description:
                    toStringOrUndefined(options, notes?.find(note => note.attr.from === 'description')?.children),
                locations: unit.childrenNamed('context-group')
                    .map(contextGroup => ({
                        file: contextGroup.childWithAttribute('context-type', 'sourcefile')!.val,
                        lineStart: parseInt(contextGroup.childWithAttribute('context-type', 'linenumber')!.val, 10)
                    })) ?? []
            };
            const additionalAttributes = getAdditionalAttributes(unit, REGULAR_ATTRIBUTES_XLF1);
            if (additionalAttributes.length) {
                result.additionalAttributes = additionalAttributes;
            }
            return result;
        });
    return new TranslationFile(units, file.attr['source-language'], file.attr['target-language'], xmlDeclaration);
}

function toString(options: Pick<Options, 'sortNestedTagAttributes'>, ...nodes: XmlNode[]): string {
    return nodes.map(n => {
        if (options.sortNestedTagAttributes && n instanceof XmlElement) {
            const attr = Object.entries(n.attr).sort((a, b) => a[0].localeCompare(b[0]));
            n.attr = Object.fromEntries(attr);
        }
        return n.toString({ preserveWhitespace: true, compressed: true });
    }).join('');
}

function toStringOrUndefined(options: Pick<Options, 'sortNestedTagAttributes'>, nodes: XmlNode[] | undefined):
    string | undefined {

    return nodes ? toString(options, ...nodes) : undefined;
}

export function toXlf2(translationFile: TranslationFile, options: Pick<Options, 'prettyNestedTags'>): string {
    const doc = new XmlDocument(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="${translationFile.sourceLang}">
    <file id="ngi18n" original="ng.template">
    </file>
</xliff>`);
    if (translationFile.targetLang) {
        doc.attr.trgLang = translationFile.targetLang;
    }
    const file = doc.childNamed('file')!;
    file.children = translationFile.units.map(unit => {
        const u = new XmlDocument(`<unit id=""><segment><source>${unit.source}</source></segment></unit>`);
        u.attr.id = unit.id;
        const segment = u.childNamed('segment')!;
        if (unit.target !== undefined) {
            segment.children.push(new XmlDocument(`<target>${unit.target}</target>`));
        }
        if (unit.state) {
            segment.attr.state = unit.state;
        }
        if (unit.meaning !== undefined || unit.description !== undefined || unit.locations.length) {
            const notes = new XmlDocument('<notes></notes>');
            u.children.splice(0, 0, notes);
            notes.children.push(...unit.locations.map(location => new XmlDocument(`<note category="location">${location.file}:${location.lineStart}${location.lineEnd ? ',' + location.lineEnd : ''}</note>`)));
            if (unit.description !== undefined) {
                notes.children.push(new XmlDocument(`<note category="description">${unit.description}</note>`));
            }
            if (unit.meaning !== undefined) {
                notes.children.push(new XmlDocument(`<note category="meaning">${unit.meaning}</note>`));
            }
        }

        updateFirstAndLastChild(u);
        unit.additionalAttributes?.forEach(attr => {
            (attr.path === '.' ? u : u.descendantWithPath(attr.path)!).attr[attr.name] = attr.value;
        });
        return u;
    });
    updateFirstAndLastChild(doc);
    return (translationFile.xmlHeader ?? '') + pretty(doc, options);
}

export function toXlf1(translationFile: TranslationFile, options: Pick<Options, 'prettyNestedTags'>): string {
    const doc = new XmlDocument(`<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file source-language="${translationFile.sourceLang}"  datatype="plaintext" original="ng2.template">
    <body></body>
    </file>
</xliff>`);
    const file = doc.childNamed('file')!;
    if (translationFile.targetLang !== undefined) {
        // assure "correct" order:
        file.attr = {
            'source-language': translationFile.sourceLang,
            'target-language': translationFile.targetLang,
            datatype: 'plaintext',
            original: 'ng2.template'
        };
    }
    const body = file.childNamed('body')!;
    body.children = translationFile.units.map(unit => {
        const transUnit = new XmlDocument(`<trans-unit id="" datatype="html">
        <source>${unit.source}</source>
</trans-unit>`);
        transUnit.attr.id = unit.id;
        if (unit.target !== undefined) {
            const target = new XmlDocument(`<target>${unit.target}</target>`);
            if (unit.state !== undefined) {
                target.attr.state = unit.state;
            }
            transUnit.children.push(target);
        }
        if (unit.description !== undefined) {
            transUnit.children.push(new XmlDocument(`<note priority="1" from="description">${unit.description}</note>`));
        }
        if (unit.meaning !== undefined) {
            transUnit.children.push(new XmlDocument(`<note priority="1" from="meaning">${unit.meaning}</note>`));
        }
        if (unit.locations.length) {
            transUnit.children.push(...unit.locations.map(location => new XmlDocument(`<context-group purpose="location">
            <context context-type="sourcefile">${location.file}</context>
            <context context-type="linenumber">${location.lineStart}</context>
        </context-group>`)));
        }
        updateFirstAndLastChild(body);
        unit.additionalAttributes?.forEach(attr => {
           (attr.path === '.' ? transUnit : transUnit.descendantWithPath(attr.path)!).attr[attr.name] = attr.value;
        });
        return transUnit;
    });
    return (translationFile.xmlHeader ?? '') + pretty(doc, options);
}

function updateFirstAndLastChild(u: XmlElement) {
    u.firstChild = u.children[0];
    u.lastChild = u.children[u.children.length - 1];
}

function isWhiteSpace(node: XmlNode): node is XmlTextNode {
    return node.type === 'text' && !!node.text.match(/^\s*$/);
}

function isSourceOrTarget<T extends XmlDocument | XmlElement>(node: T) {
    return node.name === 'source' || node.name === 'target';
}

/// removes all whitespace text nodes that are not mixed with other nodes. For source/target nodes whitespace is unchanged.
function removeWhitespace<T extends XmlDocument | XmlElement>(node: T): void {
    if (node.type === 'element' && isSourceOrTarget(node)) {
        return;
    }
    if (node.type === 'element' && node.children.every(n => n.type !== 'text' || isWhiteSpace(n))) {
        node.children = node.children.filter(c => !isWhiteSpace(c));
        updateFirstAndLastChild(node);
    }
    node.children.filter((n): n is XmlElement => n.type === 'element').forEach(e => removeWhitespace(e));
}

/// format with 2 spaces indentation, except for source/target nodes: there nested nodes are assured to keep (non-)whitespaces (potentially collapsed/expanded)
function pretty(doc: XmlDocument, options: Pick<Options, 'prettyNestedTags'>) {
    removeWhitespace(doc);
    addPrettyWhitespace(doc, 0, options);
    return doc.toString({preserveWhitespace: true, compressed: true});
}

function indentChildren(doc: XmlElement, indent: number) {
    for (let i = doc.children.length - 1; i >= 0; i--) {
        doc.children.splice(i, 0, new XmlTextNode('\n' + '  '.repeat(indent + 1)))
    }
    doc.children.push(new XmlTextNode('\n' + '  '.repeat(indent)));
    updateFirstAndLastChild(doc);
}

function addPrettyWhitespace(doc: XmlElement, indent: number, options: Pick<Options, 'prettyNestedTags'>, sourceOrTarget = false) {
    if (isSourceOrTarget(doc) || sourceOrTarget) {
        if (options.prettyNestedTags && doc.children.length && doc.children.every(c => isWhiteSpace(c) || c.type === 'element')) {
            doc.children = doc.children.filter(c => !isWhiteSpace(c));
            updateFirstAndLastChild(doc)
            indentChildren(doc, indent);
            doc.children.forEach(c => c.type === 'element' ? addPrettyWhitespace(c, indent + 1, options, true) : null);
        }
        return;
    }

    if (doc.children.length && doc.children.some(e => e.type === 'element')) {
        indentChildren(doc, indent);
        doc.children.forEach(c => c.type === 'element' ? addPrettyWhitespace(c, indent + 1, options) : null);
    }
}

function allChildrenWithPath(unit: XmlElement, currentPath = '.'): { element: XmlElement, path: string }[] {
    return unit.children.flatMap(child => {
        if (child.type === 'element') {
            const path = currentPath === '.' ? child.name : (currentPath + '.' + child.name);
            return [{element: child, path}, ...allChildrenWithPath(child, path)];
        }
        return [];
    });
}

function getAdditionalAttributes(unit: XmlElement, knownAttributes: {[nodeName: string]: string[]}) {
    return [{element: unit, path: '.'}, ...allChildrenWithPath(unit)]
        .flatMap(({element, path}) => Object.entries(element.attr)
            .map(([attrName, attrValue]) => ({element, attrName, attrValue, path}))
        )
        .filter(({element, attrName}) => knownAttributes[element.name] ? !knownAttributes[element.name]?.includes(attrName) : false)
        .map(({attrName, attrValue, path}) => ({name: attrName, value: attrValue, path}));
}
