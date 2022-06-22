import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder, {Options} from './builder';
import Mock = jest.Mock;
import {rmSafe} from './rmSafe';

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
        await architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(extractI18nBuilderMock)); // dummy builder
    });

    async function runTest(p: {
        sourceFilename?: string;
        messagesBefore: string;
        messagesFrBefore?: string;
        options: Partial<Options>;
        messagesExpected?: string;
        messagesFrExpected?: string;
    }) {
        try {
            await fs.writeFile(p.sourceFilename ?? MESSAGES_XLF_PATH, p.messagesBefore, 'utf8');
            if (p.messagesFrBefore) {
                await fs.writeFile(MESSAGES_FR_XLF_PATH, p.messagesFrBefore, 'utf8');
            }

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                ...p.options
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            if (p.messagesExpected) {
                const targetContent = await fs.readFile(p.sourceFilename ?? MESSAGES_XLF_PATH, 'utf8');
                expect(targetContent).toEqual(p.messagesExpected)
            }
            if (p.messagesFrExpected) {
                const targetContent = await fs.readFile(MESSAGES_FR_XLF_PATH, 'utf8');
                expect(targetContent).toEqual(p.messagesFrExpected)
            }
        } finally {
            await rmSafe(p.sourceFilename ?? MESSAGES_XLF_PATH);
            await rmSafe(MESSAGES_FR_XLF_PATH);
        }
    }

    test('should fail if extract-i18n fails', async () => {
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(() => ({success: false}))); // dummy builder
        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf2',
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

    test('should succeed without a source file', async () => {
        const dummyContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '  </file>\n' +
            '</xliff>';
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(async () => {
            await fs.writeFile(MESSAGES_XLF_PATH, dummyContent, 'utf8');
            return {success: true};
        })); // dummy builder that only writes the source file

        await fs.writeFile(MESSAGES_FR_XLF_PATH, dummyContent, 'utf8');

        try {
            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf2',
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
            await fs.rm?.(MESSAGES_XLF_PATH, {force: true});
            await fs.rm?.(MESSAGES_FR_XLF_PATH, {force: true});
        }
    });

    test('should auto create new target files for xlf 2.0', async () => {
        await runTest({
            messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                '  <file original="ng.template" id="ngi18n">\n' +
                '    <unit id="ID1">\n' +
                '      <segment>\n' +
                '        <source>source val</source>\n' +
                '      </segment>\n' +
                '    </unit>\n' +
                '  </file>\n' +
                '</xliff>',
            options: {
                format: 'xlf2',
            },
            messagesFrExpected: '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">\n' +
                '  <file original="ng.template" id="ngi18n">\n' +
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
            messagesFrExpected: '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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

    test('extract-and-merge xlf 2.0', async () => {
        await runTest(
            {
                messagesBefore: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file original="ng.template" id="ngi18n">\n' +
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
                    '  <file original="ng.template" id="ngi18n">\n' +
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
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    removeIdsWithPrefix: ['removeMe']
                },
                messagesFrExpected: '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
                    '  <file original="ng.template" id="ngi18n">\n' +
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
        // todo second lang
        await fs.writeFile(MESSAGES_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
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
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.en.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
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
            '  <file original="ng.template" id="ngi18n">\n' +
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
            '  <file original="ng.template" id="ngi18n">\n' +
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
        await fs.rm?.(MESSAGES_XLF_PATH, {force: true});
        await fs.rm?.(MESSAGES_FR_XLF_PATH, {force: true});
        await fs.rm?.('builder-test/messages.en.xlf', {force: true});
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile should update target of sourceLanguageTargetFile', async () => {
        // TODO second lang
        await fs.writeFile(MESSAGES_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
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
        await fs.writeFile(MESSAGES_FR_XLF_PATH, '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="final">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.en.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
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
        expect(targetContent1).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
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
            '  <file original="ng.template" id="ngi18n">\n' +
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
        await fs.rm?.(MESSAGES_XLF_PATH, {force: true});
        await fs.rm?.(MESSAGES_FR_XLF_PATH, {force: true});
        await fs.rm?.('builder-test/messages.en.xlf', {force: true});
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
                    '</xliff>', messagesFrBefore: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>', options: {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test'
                }, messagesExpected: '<?xml version="1.0"?>\n' +
                    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                    '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                    '    <body>\n' +
                    '      <trans-unit id="ID1" datatype="html">\n' +
                    '        <source> source val </source>\n' +
                    '      </trans-unit>\n' +
                    '    </body>\n' +
                    '  </file>\n' +
                    '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
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
        test('retain whitespaces when trim=false and collapseWhitespace=true', async () => {
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
                        // default: collapseWhitespace: true,
                        // default: trim: false
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
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
        test('remove whitespaces when trim=true and collapseWhitespace=true', async () => {
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
                        // default: collapseWhitespace: true
                        trim: true
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source>source val</source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
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
                        collapseWhitespace: false
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
        test('remove whitespaces when collapseWhitespace=true', async () => {
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
                        // default: collapseWhitespace: true
                    }, messagesExpected: '<?xml version="1.0"?>\n' +
                        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                        '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                        '    <body>\n' +
                        '      <trans-unit id="ID1" datatype="html">\n' +
                        '        <source> source val </source>\n' +
                        '      </trans-unit>\n' +
                        '    </body>\n' +
                        '  </file>\n' +
                        '</xliff>', messagesFrExpected: '<?xml version="1.0"?>\n' +
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
            '</xliff>'
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
            await architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(extractI18nBuilderMock));

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
                            // default: sort: 'stableAppendNew'
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
    });
});
