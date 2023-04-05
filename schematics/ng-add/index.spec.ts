import {SchematicTestRunner, UnitTestTree} from '@angular-devkit/schematics/testing';
import * as path from 'path';

import {Schema as WorkspaceOptions} from '@schematics/angular/workspace/schema';
import {Schema as ApplicationOptions, Style} from '@schematics/angular/application/schema';
import {Tree} from '@angular-devkit/schematics';

const collectionPath = path.join(__dirname, '../collection.json');

const workspaceOptions: WorkspaceOptions = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '6.0.0',
};

const appOptions: ApplicationOptions = {
    name: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    style: Style.Css,
    skipTests: false,
    skipPackageJson: false,
};

function norm(s: string) {
    return s.replace(/\s+/g, '');
}

const xliffFileV1_2 = '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
    '    <body>\n' +
    '    </body>\n' +
    '  </file>\n' +
    '</xliff>';

describe('ngAdd', () => {

    const runner = new SchematicTestRunner('schematics', collectionPath);

    let appTree: UnitTestTree;

    beforeEach(async () => {
        appTree = await runExternalSchematic(runner, '@schematics/angular', 'workspace', workspaceOptions);
        appTree = await runExternalSchematic(runner, '@schematics/angular', 'application', appOptions, appTree);
    });

    it('works', async () => {
        const tree = await runSchematic(runner, 'ng-add', {}, appTree);
        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf2",\n' +
            '            "outputPath": "src/locales",\n' +
            '            "targetFiles": []\n' +
            '          }\n' +
            '        }'));
        //expect(tree.files).toEqual([]);
    });
    it('should infer format for config with options', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', xliffFileV1_2);
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': {
                    translation: ['node_modules/some-author/some-lib/i18n/xlf2/messages.de-CH.xlf', 'src/other-path/messages.fr.xlf'],
                    baseHref: 'fr/'
                }
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
    });
    it('should infer non default outFile', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', xliffFileV1_2);
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': {
                    translation: ['src/other-path/messages.fr.xlf'],
                    baseHref: 'fr/'
                }
            }
        };
        angularJson.projects.bar.architect["extract-i18n"] = {
            "builder": "@angular-devkit/build-angular:extract-i18n",
            "options": {
                "outFile": "my-messages.xlf",
                "outputPath": "src/some-path"
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));
        appTree.create('/src/some-path/my-messages.xlf', '<>');

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf",\n' +
            '            "outputPath": "src/some-path",\n' +
            '            "targetFiles": [ "../other-path/messages.fr.xlf" ],\n' +
            '            "sourceFile": "my-messages.xlf"\n' +
            '          }\n' +
            '        }'));
    });
    it('should infer format for config with non array translations', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', xliffFileV1_2);
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': {
                    translation: 'src/other-path/messages.fr.xlf',
                    baseHref: 'fr/'
                }
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
    });
    it('should infer format for simple config', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', xliffFileV1_2);
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': 'src/other-path/messages.fr.xlf'
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
    });
    it('should overwrite existing config', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', xliffFileV1_2);
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': 'src/other-path/messages.fr.xlf'
            }
        };
        angularJson.projects.bar.architect['extract-i18n'] = {
            builder: 'ng-extract-i18n-merge:ng-extract-i18n-merge', options: {
                format: 'xlf',
                someUnrecognizedOption: 'some_random_path'
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
        expect(tree.readContent('/angular.json')).not.toContain('some_random_path');
    });

    it('should handle unexpected xliff version gracefully', async () => {
        appTree.create('/src/other-path/messages.fr.xlf', '<xliff version="WTF" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>');
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr-FR': 'src/other-path/messages.fr.xlf'
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "format": "xlf2",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
    });
});

function runSchematic<SchematicSchemaT extends object>(runner: SchematicTestRunner, schematicName: string, opts?: SchematicSchemaT, tree?: Tree): Promise<UnitTestTree> {
    if ('runSchematic' in runner) {
        return (runner as any).runSchematic(schematicName, opts, tree);
    } else if ('runSchematicAsync' in runner) { // legacy version (pre v16)
        return (runner as any).runSchematicAsync(schematicName, opts, tree).toPromise();
    } else {
        throw new Error('Unsupported version of SchematicTestRunner');
    }
}

function runExternalSchematic<SchematicSchemaT extends object>(runner: SchematicTestRunner, collectionName: string, schematicName: string, opts?: SchematicSchemaT, tree?: Tree): Promise<UnitTestTree> {
    if ('runExternalSchematic' in runner) {
        return (runner as any).runExternalSchematic(collectionName, schematicName, opts, tree);
    } else if ('runExternalSchematicAsync' in runner) { // legacy version (pre v16)
        return (runner as any).runExternalSchematicAsync(collectionName, schematicName, opts, tree).toPromise();
    } else {
        throw new Error('Unsupported version of SchematicTestRunner');
    }
}
