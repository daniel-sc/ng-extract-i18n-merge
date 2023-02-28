import {join, normalize} from '@angular-devkit/core';
import {Options} from './builder';
import {getAllFileInDir, readFileIfExists} from "./fileUtils";
import {BuilderContext, BuilderOutput, createBuilder} from '@angular-devkit/architect';
import {promises as fs } from 'fs';
import {xmlNormalize} from 'xml_normalize/dist/src/xmlNormalize';
import {XmlDocument, XmlNode} from 'xmldoc';
import {Evaluator} from 'xml_normalize/dist/src/xpath/simpleXPath';

const builder: ReturnType<typeof createBuilder> = createBuilder(extractI18nAssembleBuilder);
export default builder;

/**
 * Assemble the modules files and combine them to message.locale.xlf file
 * @param moduleFilePaths the @id/module.en.xlf file
 * @param targetFilePath  the message.en.xlf file
 * @param idPath the path to get message id, it depends on xliff v1 or v2
 * @param options builder option - follow schema.json
 * @param context builder context
 */
async function mirgateModuleFileToTargetFile(moduleFilePaths: string[], targetFilePath: string, idPath: string, options: Options, context: BuilderContext): Promise<string> {
    const targetFileContent = await readFileIfExists(targetFilePath);
    if (!options.manageModules) throw new Error("Not enable manage by modules yet, please enable in project configuration");
    if (!targetFileContent) throw new Error("The targetFilePath is not exist");
    const targetFileDoc = new XmlDocument(targetFileContent);

    const unitsPath = idPath.replace(new RegExp('/[^/]*/@id$'), '');
    const targetFileItems = new Evaluator(targetFileDoc).evalNodeSet(unitsPath)[0];

    const gather: XmlNode[] = [];
    // Read all modules file
    for (let moduleFilePath of moduleFilePaths) {
       const fileContent = await readFileIfExists(moduleFilePath);
        if (fileContent) {
           const fromFileDoc = new XmlDocument(fileContent);
           const moduleFileItems = new Evaluator(fromFileDoc).evalNodeSet(unitsPath)[0];
           gather.push(...moduleFileItems.children);
       }
    }

    targetFileItems.children = gather;
    targetFileItems.firstChild = targetFileItems.children[0];
    targetFileItems.lastChild = targetFileItems.children[targetFileItems.children.length - 1];

    // retain xml declaration:
    const xmlDecMatch = targetFileContent.match(/^<\?xml [^>]*>\s*/i);
    const xmlDeclaration = xmlDecMatch ? xmlDecMatch[0] : '';

    // we need to reformat the xml (whitespaces are messed up):
    return xmlNormalize({
        in: xmlDeclaration + targetFileDoc.toString({preserveWhitespace: true, compressed: true}),
        trim: options.trim ?? false,
        normalizeWhitespace: options.collapseWhitespace ?? true
    });
}

/**
 * This Builder allowed us to assemble all modules file and combine them to target file (message.en.xlf)
 * @param options builder option - follow schema.json
 * @param context builder context
 */
async function extractI18nAssembleBuilder(options: Options, context: BuilderContext): Promise<BuilderOutput> {
    context.logger.info(`Running ng-extract-i18n-assemble for project ${context.target?.project}`);

    if (!options.verbose) {
        console.debug = () => null; // prevent debug output from xml_normalize and xliff-simple-merge
    }
    context.logger.debug(`options: ${JSON.stringify(options)}`);
    const outputPath = options.outputPath as string || '.';
    const format = options.format as string || 'xlf';
    const isXliffV2 = format.includes('2');
    const idPath = isXliffV2 ? '/xliff/file/unit/@id' : '/xliff/file/body/trans-unit/@id';

    context.logger.info('running "assemble-i18n" ...');

    // 1. Get list of all files in output folder
    let files = getAllFileInDir(outputPath);
    // 2. Remove files from list which are the same as sourceFile (message.xlf, message.en.xlf), Only keep the file in child's folder
    files = files.filter(file => /\\/.test(file.substring(outputPath.length + 1)));
    /* 2.Base on languages in targetFile, merge all children to the targetFile
    Example: part_1.en.xlf => will merge to message.en.xlf
             part_2.da.xlf => will merge to message.da.xlf */
    for (let targetFile of options.targetFiles) {
        targetFile = join(normalize(outputPath), targetFile);
        const targetLocales = targetFile.match(/\S+\.([a-zA-Z]{2})\.xlf$/);
        if (targetLocales && targetLocales[1]) {
            const locale = targetLocales[1];
            const moduleFiles = files.filter(file => file.endsWith(`.${locale}.xlf`));
            const content = await mirgateModuleFileToTargetFile(moduleFiles, targetFile, idPath, options, context);
            await fs.writeFile(targetFile, content);
        }
    }
    context.logger.info('finished i18n assemble and normalizing');
    return {success: true};
}
