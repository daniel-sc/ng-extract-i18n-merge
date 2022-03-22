import {SchematicTestRunner, UnitTestTree} from '@angular-devkit/schematics/testing';
import * as path from 'path';

import {Schema as WorkspaceOptions} from '@schematics/angular/workspace/schema';
import {Schema as ApplicationOptions, Style} from '@schematics/angular/application/schema';

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
        appTree = await runner.runExternalSchematicAsync('@schematics/angular', 'workspace', workspaceOptions).toPromise();
        appTree = await runner.runExternalSchematicAsync('@schematics/angular', 'application', appOptions, appTree).toPromise();
    });

    it('works', async () => {
        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();
        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf2",\n' +
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

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf",\n' +
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

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf",\n' +
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

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf",\n' +
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

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf",\n' +
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
        angularJson.projects.bar.architect['extract-i18n-merge'] = {
            builder: 'ng-extract-i18n-merge:ng-extract-i18n-merge', options: {
                format: 'xlf2',
                outputPath: 'some_random_path'
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf",\n' +
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

        const tree = await runner.runSchematicAsync('ng-add', {}, appTree).toPromise();

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n-merge": {\n' +
            '          "builder": "ng-extract-i18n-merge:ng-extract-i18n-merge",\n' +
            '          "options": {\n' +
            '          "format": "xlf2",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": [ "messages.fr.xlf" ]\n' +
            '          }\n' +
            '        }'));
    });
})
;
