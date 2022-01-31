import {Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {updateWorkspace} from '@schematics/angular/utility/workspace';
import {Schema} from './schema';
import {JsonArray, JsonObject, Path, relative} from '@angular-devkit/core';

function selectTargetFile(translation: string[] | undefined): string | undefined {
    if (!translation || translation.length === 1) {
        return translation?.[0];
    }
    // simple heuristic: shortest path (translations from third parties are probably from node_modules..)
    const sorted = [...translation].sort((a, b) => a.length === b.length ? 0 : (a.length > b.length ? 1 : -1));
    return sorted[0];
}

function getFormatFromTargetFile(targetFilePath: string | undefined, tree: Tree, context: SchematicContext): 'xlf' | 'xlf2' | undefined {
    if (targetFilePath) {
        const content = tree.read(targetFilePath)?.toString();
        const m = content?.match(/<xlff[^>]*"version"="([^"])"/i)
        if (m) {
            switch (m[1]) {
                case '1.2':
                    return 'xlf';
                case '2.0':
                    return 'xlf2';
                default:
                    context.logger.warn(`unexpected xliff version in ${targetFilePath}: ${m[1]}`);
                    return undefined;
            }
        }
    }
    return undefined
}

// noinspection JSUnusedGlobalSymbols
export function ngAdd(_options: Schema): Rule {
    return (tree: Tree, context: SchematicContext) => {
        return updateWorkspace((workspace) => {
            const projectName = _options.project || Array.from(workspace.projects.keys())[0];
            const projectWorkspace = workspace.projects.get(projectName)!;
            if (!projectWorkspace) {
                throw new SchematicsException(`Project ${projectName} not found!`);
            }

            // infer target files:
            const i18nExtension: JsonObject | undefined = projectWorkspace.extensions.i18n as JsonObject | undefined;
            // alternative: search tree for *.xlf? --> not performant, contains node_modules
            const files: string[] | undefined = i18nExtension?.locales ? (Object.values(i18nExtension?.locales) as JsonArray | undefined)?.map(l => selectTargetFile((l as JsonObject | undefined)?.translation as string[] | undefined)).filter(f => f !== undefined) as string[] | undefined : undefined;
            if (!files?.length) {
                context.logger.warn('Could not infer translation target files, please setup angular i18n and re-run `ng add ng-extract-i18n-merge`: https://angular.io/guide/i18n-common-merge#define-locales-in-the-build-configuration');
            } else {
                context.logger.info('Found target translation files: ' + JSON.stringify(files));
            }

            // infer outputPath
            const outputPathFromExtractI18nOptions = projectWorkspace.targets.get('extract-i18n')?.options?.outputPath as string | undefined;
            const outputPathFromTargetFiles: string | undefined = files?.[0]?.substring(0, files?.[0]?.lastIndexOf('/') ?? files?.[0]?.length);
            const outputPath: string = outputPathFromExtractI18nOptions ?? outputPathFromTargetFiles ?? 'src/locales';
            context.logger.info(`inferred output path: ${outputPath}`);
            // check if inferred matches "extract-i18n" target config

            // infer format:
            const formatFromExtractI18nOptions = projectWorkspace.targets.get('extract-i18n')?.options?.format as string | undefined;
            const formatFromTargetFiles = getFormatFromTargetFile(files?.[0], tree, context);
            const format: string = formatFromExtractI18nOptions ?? formatFromTargetFiles ?? 'xlf2';
            context.logger.info(`inferred format: ${format}`);

            // remove path from files
            const filesWithoutOutputPath = files?.map(f => relative(`/${outputPath}` as Path, `/${f}` as Path));

            const target = projectWorkspace.targets.get('extract-i18n-merge');
            const builderOptions = {format, outputPath, targetFiles: filesWithoutOutputPath ?? []};
            if (target) {
                context.logger.info(`Overwriting previous extract-i18n-merge entry in project ${projectName}.`);
                target.options = builderOptions;
            } else {
                projectWorkspace.targets.add({
                    name: 'extract-i18n-merge',
                    builder: 'ng-extract-i18n-merge:ng-extract-i18n-merge',
                    options: builderOptions,
                });
            }

            if (_options.packageScript) {
                const packageJson = JSON.parse(tree.read('package.json')!.toString('utf8'));
                packageJson.scripts = {
                    ...packageJson.scripts,
                    'extract-i18n-merge': `ng run ${projectName}:extract-i18n-merge`
                };
                tree.overwrite('package.json', JSON.stringify(packageJson, null, 2));
            }
        });
    };
}
