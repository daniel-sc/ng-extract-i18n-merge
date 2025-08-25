import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder from './builder';
import {rmSafe} from './rmSafe';
import {Options} from './options';
import {Logger} from '@angular-devkit/core/src/logger/logger';
import Mock = jest.Mock;

const MESSAGES_XLF_PATH = 'builder-test/messages.xlf';
const MESSAGES_FR_XLF_PATH = 'builder-test/messages.fr.xlf';

describe('Builder', () => {
    let architect: Architect;
    let architectHost: TestingArchitectHost;
    let extractI18nBuilderMock: Mock;

    beforeEach(async () => {
        const registry = new schema.CoreSchemaRegistry();
        registry.addPostTransform(schema.transforms.addUndefinedDefaults);

        // TestingArchitectHost() takes workspace and current directories.
        // Since we don't use those, both are the same in this case.
        architectHost = new TestingArchitectHost(__dirname, __dirname);
        architect = new Architect(architectHost, registry);

        // This will either take a Node package name, or a path to the directory
        // for the package.json file.
        // await architectHost.addBuilderFromPackage('..');
        await architectHost.addBuilder('ng-extract-i18n-merge:ng-extract-i18n-merge', builder);
        await architectHost.addTarget({
            project: 'builder-test',
            target: 'extract-i18n-merge'
        }, 'ng-extract-i18n-merge:ng-extract-i18n-merge');
        extractI18nBuilderMock = jest.fn(() => ({success: true}));
        await architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(extractI18nBuilderMock)); // dummy builder
    });

    async function runTest(p: {
        sourceFilename?: string;
        messagesBefore?: string;
        messagesFrBefore?: string;
        options: Partial<Options>;
        messagesExpected?: string;
        messagesFrExpected?: string;
    }) {
        try {
            if (p.messagesBefore !== undefined) {
                await fs.writeFile(p.sourceFilename ?? MESSAGES_XLF_PATH, p.messagesBefore, 'utf8');
            } else {
                try {
                    await rmSafe(p.sourceFilename ?? MESSAGES_XLF_PATH);
                } catch (e) {
                    // ignore error - file might have not existed
                }
            }
            if (p.messagesFrBefore !== undefined) {
                await fs.writeFile(MESSAGES_FR_XLF_PATH, p.messagesFrBefore, 'utf8');
            }

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                ...p.options
            });

            // The "result" member (of type BuilderOutput) is the next output.
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            if (p.messagesExpected !== undefined) {
                const targetContent = await fs.readFile(p.sourceFilename ?? MESSAGES_XLF_PATH, 'utf8');
                expect(targetContent).toEqual(p.messagesExpected)
            }
            if (p.messagesFrExpected !== undefined) {
                const targetContent = await fs.readFile(MESSAGES_FR_XLF_PATH, 'utf8');
                expect(targetContent).toEqual(p.messagesFrExpected)
            }
        } finally {
            await rmSafe(p.sourceFilename ?? MESSAGES_XLF_PATH);
            await rmSafe(MESSAGES_FR_XLF_PATH);
        }
    }

    test('should fail if extract-i18n fails', async () => {
        architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(() => ({success: false}))); // dummy builder
        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
                    prettyNestedTags: true,
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test',
        });

        // The "result" member (of type BuilderOutput) is the next output.
        const result = await run.result;
        expect(result.success).toBeFalsy();

        // Stop the builder from running. This stops Architect from keeping
        // the builder-associated states in memory, since builders keep waiting
        // to be scheduled.
        await run.stop();
    });

    test('should use custom builder for i18n extraction when configured', async () => {
        const dummyContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n  <file id="ngi18n" original="ng.template">\n  </file>\n</xliff>';
        await fs.writeFile(MESSAGES_XLF_PATH, dummyContent, 'utf8');
        const builderFn = jest.fn(() => ({success: true}));
        architectHost.addBuilder('@my/custom:builder', createBuilder(builderFn)); // custom builder

        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
                    prettyNestedTags: true,
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test',
            builderI18n: '@my/custom:builder'
        });
        const result = await run.result;

        expect(result.success).toBeTruthy();
        expect(builderFn).toHaveBeenCalled();
        expect(extractI18nBuilderMock).not.toHaveBeenCalled();

        await run.stop();
    });

    test('should succeed without a source file', async () => {
        const dummyContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '  </file>\n' +
            '</xliff>';
        architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(async () => {
            await fs.writeFile(MESSAGES_XLF_PATH, dummyContent, 'utf8');
            return {success: true};
        })); // dummy builder that only writes the source file

        await fs.writeFile(MESSAGES_FR_XLF_PATH, dummyContent, 'utf8');

        try {
            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf2',
                    prettyNestedTags: true,
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
            });

            // The "result" member (of type BuilderOutput) is the next output.
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();
        } finally {
            await rmSafe(MESSAGES_XLF_PATH);
            await rmSafe(MESSAGES_FR_XLF_PATH);
        }
    });

    test('should auto create new target files for xlf 2.0', async () => {
        await runTest({
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                    prettyNestedTags: true,
            },
            messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="initial">\n' +
                '        <source>source val</source>\n' +
                '        <target>source val</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>'
        })
    });

    test('should handle empty target files for xlf 2.0', async () => {
        await runTest({
            messagesFrBefore: '',
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                    prettyNestedTags: true,
            },
            messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="initial">\n' +
                '        <source>source val</source>\n' +
                '        <target>source val</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });

    test('should keep changed target of source language file with xlf 1.2', async () => {
        await runTest({
            messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>changed source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="fr" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '        <target state="final">updated source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf',
                sourceLanguageTargetFile: 'messages.fr.xlf'
            },
            messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="fr" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>changed source val</source>\n' +
                '        <target state="final">updated source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });

    test('should handle missing target node for changed text', async () => {
        await runTest({
            messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="initial">\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment state="initial">\n' +
                '        <source>old source val2</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment>\n' +
                '        <source>source val2</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                    prettyNestedTags: true,
            },
            messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="initial">\n' +
                '        <source>source val</source>\n' +
                // only changed source texts trigger target creation
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment state="initial">\n' +
                '        <source>source val2</source>\n' +
                '        <target>source val2</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });

    test('should auto create new target files for xlf 1.2', async () => {
        await runTest({
            messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf',
            },
            messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '        <target state="new">source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });

    test('should handle empty target file for xlf 1.2', async () => {
        await runTest({
            messagesFrBefore: '',
            messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf',
            },
            messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '        <target state="new">source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });
    test('should handle missing target node for changed id', async () => {
        await runTest({
            messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID2" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>new source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf',
            },
            messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>new source val</source>\n' +
                '        <target state="new">new source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>'
        });
    });

    test('should not remove whitespace between nested html tags', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>prefix <some-tag>  <another-tag/></some-tag> </source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment state="translated">\n' +
                    '        <source>prefix <some-tag> <another-tag/></some-tag> </source>\n' +
                    '        <target>translated <some-tag>content</some-tag><another-tag>other</another-tag></target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf2',
                    prettyNestedTags: true,
                },
                messagesExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>prefix <some-tag> <another-tag/></some-tag> </source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment state="translated">\n' +
                    '        <source>prefix <some-tag> <another-tag/></some-tag> </source>\n' +
                    '        <target>translated <some-tag>content</some-tag><another-tag>other</another-tag></target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
            });

    });
    test('should pretty print nested html tags without surrounding text', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    // simulate angular generated source without whitespace between tags:
                    '        <source><some-tag>a</some-tag><another>b</another></source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment state="translated">\n' +
                    '        <source>\n' +
                    '          <some-tag>a</some-tag>\n' +
                    '          <another>b</another>\n' +
                    '        </source>\n' +
                    '        <target>\n' +
                    '          <some-tag>content</some-tag>\n' +
                    '          <another-tag>other</another-tag>\n' +
                    '        </target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf2',
                    prettyNestedTags: true,
                },
                messagesExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>\n' +
                    '          <some-tag>a</some-tag>\n' +
                    '          <another>b</another>\n' +
                    '        </source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment state="translated">\n' +
                    '        <source>\n' +
                    '          <some-tag>a</some-tag>\n' +
                    '          <another>b</another>\n' +
                    '        </source>\n' +
                    '        <target>\n' +
                    '          <some-tag>content</some-tag>\n' +
                    '          <another-tag>other</another-tag>\n' +
                    '        </target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
            });

    });

    test('extract-and-merge xlf 2.0', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="ID2">\n' +
                    '      <segment>\n' +
                    '        <source>source val2</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="removeMeID3">\n' +
                    '      <segment>\n' +
                    '        <source>source val2</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '        <target>target val</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf2',
                    prettyNestedTags: true,
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe']
                },
                messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '        <target>target val</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="ID2">\n' +
                    '      <segment state="initial">\n' +
                    '        <source>source val2</source>\n' +
                    '        <target>source val2</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge xlf 2.0 with includeIdsWithPrefix', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="ID2">\n' +
                    '      <segment>\n' +
                    '        <source>source val2</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="removeMeID3">\n' +
                    '      <segment>\n' +
                    '        <source>source val2</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '        <target>target val</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf2',
                    prettyNestedTags: true,
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    includeIdsWithPrefix: ['ID']
                },
                messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '        <target>target val</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '    <unit id="ID2">\n' +
                    '      <segment state="initial">\n' +
                    '        <source>source val2</source>\n' +
                    '        <target>source val2</target>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile', async () => {
        await fs.writeFile(MESSAGES_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment>\n' +
            '        <source>source val2</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile(MESSAGES_FR_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.en.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
                    prettyNestedTags: true,
            targetFiles: ['messages.fr.xlf', 'messages.en.xlf'],
            sourceLanguageTargetFile: 'messages.en.xlf',
            outputPath: 'builder-test',
        });

        // The "result" member (of type BuilderOutput) is the next output.
        await run.result;
        const result = await run.result;
        expect(result.success).toBeTruthy();

        // Stop the builder from running. This stops Architect from keeping
        // the builder-associated states in memory, since builders keep waiting
        // to be scheduled.
        await run.stop();

        // Expect that the copied file is the same as its source.
        const targetContent1 = await fs.readFile(MESSAGES_FR_XLF_PATH, 'utf8');
        expect(targetContent1).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment state="initial">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        const targetContent2 = await fs.readFile('builder-test/messages.en.xlf', 'utf8');
        expect(targetContent2).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment state="final">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        // cleanup:
        await rmSafe(MESSAGES_XLF_PATH);
        await rmSafe(MESSAGES_FR_XLF_PATH);
        await rmSafe('builder-test/messages.en.xlf');
    });
    test('extract-and-merge xlf 2.0 should keep translation state for updated source text that matches the before target text', async () => {
        await fs.writeFile(MESSAGES_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val - new</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile(MESSAGES_FR_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val - old</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.en.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val - old</source>\n' +
            '        <target>source val - new</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
                    prettyNestedTags: true,
            targetFiles: ['messages.fr.xlf', 'messages.en.xlf'],
            sourceLanguageTargetFile: 'messages.en.xlf',
            outputPath: 'builder-test',
        });

        // The "result" member (of type BuilderOutput) is the next output.
        const result = await run.result;
        expect(result.success).toBeTruthy();

        await run.stop();

        const targetContent1 = await fs.readFile(MESSAGES_FR_XLF_PATH, 'utf8');
        expect(targetContent1).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val - new</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        const targetContent2 = await fs.readFile('builder-test/messages.en.xlf', 'utf8');
        expect(targetContent2).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val - new</source>\n' +
            '        <target>source val - new</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        // cleanup:
        await rmSafe(MESSAGES_XLF_PATH);
        await rmSafe(MESSAGES_FR_XLF_PATH);
        await rmSafe('builder-test/messages.en.xlf');
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile should update target of sourceLanguageTargetFile', async () => {
        // TODO second lang
        await fs.writeFile(MESSAGES_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val changed</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment>\n' +
            '        <source>source val2</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile(MESSAGES_FR_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="fr">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.en.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val</source>\n' +
            '        <target>source val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
                    prettyNestedTags: true,
            targetFiles: ['messages.fr.xlf', 'messages.en.xlf'],
            sourceLanguageTargetFile: 'messages.en.xlf',
            outputPath: 'builder-test',
        });

        await run.result;
        const result = await run.result;
        expect(result.success).toBeTruthy();
        await run.stop();

        // Expect that the copied file is the same as its source.
        const targetContent1 = await fs.readFile(MESSAGES_FR_XLF_PATH, 'utf8');
        expect(targetContent1).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="fr">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="initial">\n' +
            '        <source>source val changed</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment state="initial">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        const targetContent2 = await fs.readFile('builder-test/messages.en.xlf', 'utf8');
        expect(targetContent2).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file id="ngi18n" original="ng.template">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val changed</source>\n' +
            '        <target>source val changed</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment state="final">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>');

        // cleanup:
        await rmSafe(MESSAGES_XLF_PATH);
        await rmSafe(MESSAGES_FR_XLF_PATH);
        await rmSafe('builder-test/messages.en.xlf');
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile should keep manually changed target of sourceLanguageTargetFile', async () => {
        const oldWarn = Logger.prototype.warn;
        Logger.prototype.warn = jest.fn();

        await runTest({
            messagesFrBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="fr" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="final">\n' +
                '        <source>source val</source>\n' +
                '        <target>manual target val</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment state="final">\n' +
                '        <source>source val2</source>\n' +
                '        <target>manual target val2</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>updated source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment>\n' +
                '        <source>source val2</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                    prettyNestedTags: true,
                sourceLanguageTargetFile: 'messages.fr.xlf'
            },
            messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="fr" trgLang="fr">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <segment state="final">\n' +
                '        <source>updated source val</source>\n' +
                '        <target>manual target val</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '    <unit id="ID2">\n' +
                '      <segment state="final">\n' +
                '        <source>source val2</source>\n' +
                '        <target>manual target val2</target>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
        });
        // expect that "not syncing manual changed target" is outputted:
        expect(Logger.prototype.warn).toHaveBeenCalledWith('Found manual changed target with id=ID1 in sourceLanguageTargetFile. Consider changing the source code occurrences from "updated source val" to "manual target val".');
        Logger.prototype.warn = oldWarn;
    });

    test('extract-and-merge xlf 1.2', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="removeMeID3" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe']
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '        <target state="new">source val2</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });

    test('keep meaning with includeContext=false', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <context-group purpose="location">\n' +
                    '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
                    '          <context context-type="linenumber">182,183</context>\n' +
                    '        </context-group>\n' +
                    '        <note priority="1" from="description">An introduction header for this sample</note>\n' +
                    '        <note priority="1" from="meaning">User welcome</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                },
                messagesExpected:'<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <note priority="1" from="description">An introduction header for this sample</note>\n' +
                    '        <note priority="1" from="meaning">User welcome</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target>source val</target>\n' +
                    '        <note priority="1" from="description">An introduction header for this sample</note>\n' +
                    '        <note priority="1" from="meaning">User welcome</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
            });
    });

    test('extract-and-merge xlf 1.2 with updated note', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <note priority="1" from="description">An introduction header for this sample</note>\n' +
                    '        <note priority="1" from="meaning">User welcome</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '        <note priority="1" from="description">old note</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    includeContext: true,
                    removeIdsWithPrefix: ['removeMe']
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '        <note priority="1" from="description">An introduction header for this sample</note>\n' +
                    '        <note priority="1" from="meaning">User welcome</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge xlf 1.2 with ampersand in meaning', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source &amp; val</source>\n' +
                    '        <note priority="1" from="description">description &amp; and</note>\n' +
                    '        <note priority="1" from="meaning">meaning &amp; and</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    includeContext: true,
                    removeIdsWithPrefix: ['removeMe']
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source &amp; val</source>\n' +
                    '        <target state="new">source &amp; val</target>\n' +
                    '        <note priority="1" from="description">description &amp; and</note>\n' +
                    '        <note priority="1" from="meaning">meaning &amp; and</note>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge xlf 1.2 with newTranslationTargetsBlank', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe'],
                    newTranslationTargetsBlank: true
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '        <target state="new"/>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge xlf 1.2 with newTranslationTargetsBlank and selfClosingEmptyTargets: false', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe'],
                    newTranslationTargetsBlank: true,
                    selfClosingEmptyTargets: false
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '        <target state="new"></target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });

    test('extract-and-merge xlf 1.2 with newTranslationTargetsBlank=omit', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    sourceLanguageTargetFile: "messages.fr.xlf",
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe'],
                    newTranslationTargetsBlank: 'omit'
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="translated">target val</target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>source val2</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });

    test('extract-and-merge xlf 1.2 with newTranslationTargetsBlank=omit and trim=true', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val </source>\n' + // note the space at the end
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    sourceLanguageTargetFile: "messages.de.xlf",
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe'],
                    newTranslationTargetsBlank: 'omit'
                },
                messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });

    test('extract-and-merge with xml definition without newline', async () => {
        await runTest(
            {
                messagesBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test'
                },
                messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="new">source val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            });
    });
    test('extract-and-merge with trailing newline', async () => {
        await runTest(
            {
                messagesBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>\n',
                messagesFrBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>\n',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test'
                },
                messagesFrExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="new">source val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>\n'
            });
    });
    test('handle non default source file name', async () => {
        await runTest({
                sourceFilename: 'builder-test/my-messages.xlf',
                messagesBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>', options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    sourceFile: 'my-messages.xlf',
                    outputPath: 'builder-test'
                },
                messagesFrExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val</source>\n' +
                    '        <target state="new">source val</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            }
        );

        expect(extractI18nBuilderMock.mock.calls.length).toEqual(1);
        expect(extractI18nBuilderMock.mock.calls[0][0]).toEqual({
            format: 'xlf',
            outFile: 'my-messages.xlf',
            outputPath: 'builder-test',
            progress: false,
        });
    });
    test('retain leading and trailing whitespaces', async () => {
        await runTest(
            {
                messagesBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source> source val </source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test'
                },
                messagesExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source> source val </source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source> source val </source>\n' +
                    '        <target state="new"> source val </target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            }
        );
    });
    test('retain target state when equal after normalization', async () => {
        await runTest(
            {
                messagesBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val&apos; <x equiv-text="{{c}}" id="INTERPOLATION"/></source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit datatype="html" id="ID1">\n' +
                    '        <source>source val\' <x id="INTERPOLATION" equiv-text="{{c}}"/>\n' +
                    '        </source>\n' +
                    '        <target state="signed-off">SOURCE VAL\' <x id="INTERPOLATION" equiv-text="{{c}}"/></target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    sortNestedTagAttributes: true,
                    collapseWhitespace: true,
                    trim: true,
                },
                messagesFrExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>source val&apos; <x equiv-text="{{c}}" id="INTERPOLATION"/></source>\n' +
                    '        <target state="signed-off">SOURCE VAL&apos; <x equiv-text="{{c}}" id="INTERPOLATION"/></target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            }
        );
    });
    describe('trim', () => {
        test('retain whitespaces when trim=false and collapseWhitespace=false', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        collapseWhitespace: false,
                        trim: false
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val </source>\n' +
                        '        <target state="new"> source   val </target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('remove newline in description of xlf2 when trim=false and collapseWhitespace=true', async () => {
            await runTest({
               messagesBefore:  '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                   '  <file id="ngi18n" original="ng.template">\n' +
                   '    <unit id="ID1">\n' +
                   '      <notes>\n' +
                   '        <note category="location">some-file.ts:281,286</note>\n' +
                   '        <note category="location">some-other-file.ts:281</note>\n' +
                   '        <note category="description">test description\n' +
                   '</note>\n' +
                   '      </notes>\n' +
                   '      <segment>\n' +
                   '        <source>source val</source>\n' +
                   '      </segment>\n' +
                   '    </unit>\n' +
                   '  </file>\n' +
                   '</xliff>',
                options: {
                    format: 'xlf2',
                    prettyNestedTags: true,
                    includeContext: true
                },
                messagesExpected:  '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file id="ngi18n" original="ng.template">\n' +
                    '    <unit id="ID1">\n' +
                    '      <notes>\n' +
                    '        <note category="location">some-file.ts:281,286</note>\n' +
                    '        <note category="location">some-other-file.ts:281</note>\n' +
                    '        <note category="description">test description </note>\n' +
                    '      </notes>\n' +
                    '      <segment>\n' +
                    '        <source>source val</source>\n' +
                    '      </segment>\n' +
                    '    </unit>\n' +
                    '  </file>\n' +
                    '</xliff>',
            });
        });
        test('retain whitespaces when trim=false and collapseWhitespace=true', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val   \u00a0   x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        // default: collapseWhitespace: true,
                        // default: trim: false
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val \u00a0 x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val \u00a0 x </source>\n' +
                        '        <target state="new"> source val \u00a0 x </target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('remove whitespaces when trim=true and collapseWhitespace=true', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val  \u00a0  x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        // default: collapseWhitespace: true
                        trim: true
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>source val \u00a0 x</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>source val \u00a0 x</source>\n' +
                        '        <target state="new">source val \u00a0 x</target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('remove whitespaces when trim=true and collapseWhitespace=false', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        collapseWhitespace: false,
                        trim: true
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>source   val</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>source   val</source>\n' +
                        '        <target state="new">source   val</target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
    });
    describe('collapseWhitespace', () => {
        test('retain whitespaces when collapseWhitespace=false', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val \u00a0 x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        collapseWhitespace: false
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val \u00a0 x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val \u00a0 x </source>\n' +
                        '        <target state="new"> source   val \u00a0 x </target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('remove whitespaces when collapseWhitespace=true', async () => {
            await runTest(
                {
                    messagesBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source   val   \u00a0   x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        outputPath: 'builder-test',
                        // default: collapseWhitespace: true
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val \u00a0 x </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val \u00a0 x </source>\n' +
                        '        <target state="new"> source val \u00a0 x </target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
    });
    describe('multiple context groups', () => {
        const multipleContextGroupsDefaultMessages = '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>Some text</source>\n' +
            '        <context-group purpose="location">\n' +
            '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
            '          <context context-type="linenumber">12</context>\n' +
            '        </context-group>\n' +
            '        <context-group purpose="location">\n' +
            '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
            '          <context context-type="linenumber">4</context>\n' +
            '        </context-group>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>';
        test('add new context groups', async () => {
            await runTest(
                {
                    messagesBefore: multipleContextGroupsDefaultMessages,
                    messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '          <context context-type="linenumber">12</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        includeContext: true,
                        outputPath: 'builder-test'
                    },
                    messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '          <context context-type="linenumber">12</context>\n' +
                        '        </context-group>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
                        '          <context context-type="linenumber">4</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('exclude line number context groups', async () => {
            await runTest(
                {
                    messagesBefore: multipleContextGroupsDefaultMessages,
                    messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '          <context context-type="linenumber">12</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        includeContext: true,
                        excludeContextLineNumber: true,
                        outputPath: 'builder-test'
                    },
                    messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '        </context-group>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('retain multiple context nodes', async () => {

            await runTest(
                {
                    messagesBefore: multipleContextGroupsDefaultMessages,
                    messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        includeContext: true,
                        outputPath: 'builder-test'
                    },
                    messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '          <context context-type="linenumber">12</context>\n' +
                        '        </context-group>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
                        '          <context context-type="linenumber">4</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                        '          <context context-type="linenumber">12</context>\n' +
                        '        </context-group>\n' +
                        '        <context-group purpose="location">\n' +
                        '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
                        '          <context context-type="linenumber">4</context>\n' +
                        '        </context-group>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
        test('remove multiple context nodes', async () => {
            await runTest(
                {
                    messagesBefore: multipleContextGroupsDefaultMessages,
                    messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    options: {
                        format: 'xlf',
                        targetFiles: ['messages.fr.xlf'],
                        includeContext: false,
                        outputPath: 'builder-test'
                    },
                    messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>',
                    messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>Some text</source>\n' +
                        '        <target state="new">Some text</target>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>'
                }
            );
        });
    });

    test('keep context in messages source file when includeContext=true and format=xlf2', async () => {
        await runTest({
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <notes>\n' +
                '        <note category="location">some-file.ts:281,286</note>\n' +
                '        <note category="location">some-other-file.ts:281</note>\n' +
                '        <note category="description">test description</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                includeContext: true,
                format: 'xlf2',
                prettyNestedTags: true,
            },
            messagesExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <notes>\n' +
                '        <note category="location">some-file.ts:281,286</note>\n' +
                '        <note category="location">some-other-file.ts:281</note>\n' +
                '        <note category="description">test description</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
        })

    });
    test('remove context in messages source file when includeContext=false and format=xlf2', async () => {
        await runTest({
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <notes>\n' +
                '        <note category="location">some-file.ts:281,286</note>\n' +
                '        <note category="location">some-other-file.ts:281</note>\n' +
                '        <note category="description">test description</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
                prettyNestedTags: true,
            },
            messagesExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file id="ngi18n" original="ng.template">\n' +
                '    <unit id="ID1">\n' +
                '      <notes>\n' +
                '        <note category="description">test description</note>\n' +
                '      </notes>\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
        })

    });
    test('keep context in messages source file when includeContext=true and format=xlf', async () => {
        await runTest({
            messagesBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>Some text</source>\n' +
                '        <context-group purpose="location">\n' +
                '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                '          <context context-type="linenumber">12</context>\n' +
                '        </context-group>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                includeContext: true,
                format: 'xlf'
            },
            messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>Some text</source>\n' +
                '        <context-group purpose="location">\n' +
                '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                '          <context context-type="linenumber">12</context>\n' +
                '        </context-group>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>'
        })
    });

    test('retain context in sourceFile only, when includeContext=sourceFileOnly', async () => {
        const messagesBefore = '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>Some text</source>\n' +
            '        <context-group purpose="location">\n' +
            '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
            '          <context context-type="linenumber">12</context>\n' +
            '        </context-group>\n' +
            '      </trans-unit>\n' +
            '      <trans-unit id="ID2" datatype="html">\n' +
            '        <source>Some text2</source>\n' +
            '        <context-group purpose="location">\n' +
            '          <context context-type="sourcefile">src/app/app.component.html</context>\n' +
            '          <context context-type="linenumber">4</context>\n' +
            '        </context-group>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>';
        await runTest(
            {
                messagesBefore: messagesBefore,
                messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>Some text</source>\n' +
                    '        <target state="new">Some text</target>\n' +
                    '        <context-group purpose="location">\n' +
                    '          <context context-type="sourcefile">src/app/app-routing.module.ts</context>\n' +
                    '          <context context-type="linenumber">12</context>\n' +
                    '        </context-group>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    includeContext: 'sourceFileOnly',
                    outputPath: 'builder-test'
                },
                messagesExpected: messagesBefore,
                messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>Some text</source>\n' +
                    '        <target state="new">Some text</target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>Some text2</source>\n' +
                    '        <target state="new">Some text2</target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            }
        );
    });

    test('retain whitespace between interpolations', async () => {
        await runTest(
            {
                messagesBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>no-space<ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test'
                },
                messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>no-space<ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>',
                messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '        <target state="new">Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></target>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>no-space<ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></source>\n' +
                    '        <target state="new">no-space<ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/> <ph id="1" equiv="INTERPOLATION_1" disp="{{ myNumber }}"/></target>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>'
            }
        );
    });

    test('should add new translation units with fuzzy=false', async () => {
        await runTest({
            messagesBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID2" datatype="html">\n' +
                '        <source>text2</source>\n' +
                '      </trans-unit>\n' +
                '      <trans-unit id="ID3" datatype="html">\n' +
                '        <source>text1</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID2" datatype="html">\n' +
                '        <source>text2</source>\n' +
                '        <target>text2</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf',
                fuzzyMatch: false,
            },
            messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID2" datatype="html">\n' +
                '        <source>text2</source>\n' +
                '        <target>text2</target>\n' +
                '      </trans-unit>\n' +
                '      <trans-unit id="ID3" datatype="html">\n' +
                '        <source>text1</source>\n' +
                '        <target state="new">text1</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>',
        });
    })

    describe('sort', () => {
        const sortDefaultMessages = '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID2" datatype="html">\n' +
            '        <source>text2</source>\n' +
            '      </trans-unit>\n' +
            '      <trans-unit id="old-id-1" datatype="html">\n' +
            '        <source>text1</source>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>';
        const sortDefaultMessagesFr = '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID2" datatype="html">\n' +
            '        <source>text2</source>\n' +
            '        <target state="new">translation2</target>\n' +
            '      </trans-unit>\n' +
            '      <trans-unit id="old-id-1" datatype="html">\n' +
            '        <source>text1</source>\n' +
            '        <target state="new">translation1</target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>';
        beforeEach(async () => {
            extractI18nBuilderMock = jest.fn(async () => {
                // update messages.xlf:
                await fs.writeFile(MESSAGES_XLF_PATH, '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source>text1</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID3" datatype="html">\n' +
                    '        <source>text3</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID2" datatype="html">\n' +
                    '        <source>text2</source>\n' +
                    '      </trans-unit>\n' +
                    '      <trans-unit id="ID4" datatype="html">\n' +
                    '        <source>text4</source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>', 'utf8');
                return ({success: true});
            });
            await architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(extractI18nBuilderMock));

        });
        describe('idAsc', () => {
            test('should sort by ID', async () => {
                await runTest(
                    {
                        messagesBefore: sortDefaultMessages,
                        messagesFrBefore: sortDefaultMessagesFr,
                        options: {
                            format: 'xlf',
                            targetFiles: ['messages.fr.xlf'],
                            outputPath: 'builder-test',
                            sort: 'idAsc'
                        },
                        messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="ID1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID2" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID3" datatype="html">\n' +
                            '        <source>text3</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID4" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="ID1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID2" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID3" datatype="html">\n' +
                            '        <source>text3</source>\n' +
                            '        <target state="new">text3</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID4" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '        <target state="new">text4</target>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>'
                    }
                );
            });
        });
        describe('stableAppendNew', () => {
            test('should keep existing order in source and target file and append new translations', async () => {
                await runTest(
                    {
                        messagesBefore: sortDefaultMessages,
                        messagesFrBefore: sortDefaultMessagesFr,
                        options: {
                            format: 'xlf',
                            targetFiles: ['messages.fr.xlf'],
                            outputPath: 'builder-test',
                            sort: 'stableAppendNew',
                        },
                        messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="ID2" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID3" datatype="html">\n' +
                            '        <source>text3</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID4" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="ID2" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID3" datatype="html">\n' +
                            '        <source>text3</source>\n' +
                            '        <target state="new">text3</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="ID4" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '        <target state="new">text4</target>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>'
                    }
                );
            });
        });

        describe('stableAlphabetNew', () => {
            test('should sort IDs alphabetically if original file was empty', async () => {
                extractI18nBuilderMock = jest.fn(async () => {
                    // update messages.xlf:
                    await fs.writeFile(MESSAGES_XLF_PATH, '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="IA" datatype="html">\n' +
                        '        <source>text1</source>\n' + // fuzzy matches old-id-1
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDb" datatype="html">\n' +
                        '        <source>text4</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDa" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDc0" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDc1" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDd" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDf" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDg" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', 'utf8');
                    return ({success: true});
                });
                await architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(extractI18nBuilderMock));
                await runTest(
                    {
                        messagesBefore: undefined,
                        messagesFrBefore: undefined,
                        options: {
                            format: 'xlf',
                            targetFiles: ['messages.fr.xlf'],
                            outputPath: 'builder-test',
                            sort: 'stableAlphabetNew'
                        },
                        messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IA" datatype="html">\n' +
                            '        <source>text1</source>\n' + // fuzzy matched old-id-1
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDb" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc0" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDd" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDf" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        messagesFrExpected: '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" target-language="fr" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IA" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '        <target state="new">text1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDb" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '        <target state="new">text4</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc0" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDd" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDf" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                    }
                );
            });
            test('should keep existing order in source and target file and add new translation to closes ID alphabetically', async () => {
                extractI18nBuilderMock = jest.fn(async () => {
                    // update messages.xlf:
                    await fs.writeFile(MESSAGES_XLF_PATH, '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="IA" datatype="html">\n' +
                        '        <source>text1</source>\n' + // fuzzy matches old-id-1
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDb" datatype="html">\n' +
                        '        <source>text4</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDa" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDc0" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDc1" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDd" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDf" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '      <trans-unit id="IDg" datatype="html">\n' +
                        '        <source>text2</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', 'utf8');
                    return ({success: true});
                });
                await architectHost.addBuilder('@angular/build:extract-i18n', createBuilder(extractI18nBuilderMock));
                await runTest(
                    {
                        messagesBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="old-id-1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        messagesFrBefore: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="old-id-1" datatype="html">\n' +
                            '        <source>text1</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        options: {
                            format: 'xlf',
                            targetFiles: ['messages.fr.xlf'],
                            outputPath: 'builder-test',
                            sort: 'stableAlphabetNew'
                        },
                        messagesExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IDc0" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDd" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDb" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDf" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IA" datatype="html">\n' +
                            '        <source>text1</source>\n' + // fuzzy matched old-id-1
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>',
                        messagesFrExpected: '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                            '    <body>\n' +
                            '      <trans-unit id="IDc0" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDc1" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDd" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDa" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDb" datatype="html">\n' +
                            '        <source>text4</source>\n' +
                            '        <target state="new">text4</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDf" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">text2</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IDg" datatype="html">\n' +
                            '        <source>text2</source>\n' +
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '      <trans-unit id="IA" datatype="html">\n' +
                            '        <source>text1</source>\n' + // fuzzy matched old-id-1
                            '        <target state="new">translation1</target>\n' +
                            '      </trans-unit>\n' +
                            '    </body>\n' +
                            '  </file>\n' +
                            '</xliff>'
                    }
                );
            });
        });
    });
});
