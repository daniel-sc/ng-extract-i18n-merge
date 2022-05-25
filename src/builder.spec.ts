import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder from './builder';
import Mock = jest.Mock;

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

    test('should fail if extract-i18n fails', async () => {
        await architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(() => ({success: false}))); // dummy builder
        // write dummy file, so that reading before extraction will not fail:
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
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

    test('extract-and-merge xlf 2.0', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
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
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
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
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test',
            removeIdsWithPrefix: ['removeMe']
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
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
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
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
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
        await fs.writeFile('builder-test/messages.fr.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
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
        const targetContent1 = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
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
    });
    test('extract-and-merge xlf 2.0 with specified sourceLanguageTargetFile should update target of sourceLanguageTargetFile', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
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
        await fs.writeFile('builder-test/messages.fr.xlf', '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">\n' +
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
        const targetContent1 = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
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
    });

    test('extract-and-merge xlf 1.2', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '        <target state="translated">target val</target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test',
            removeIdsWithPrefix: ['removeMe']
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
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>');
    });
    test('extract-and-merge xlf 1.2 with newTranslationTargetsBlank', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '        <target state="translated">target val</target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test',
            removeIdsWithPrefix: ['removeMe'],
            newTranslationTargetsBlank: true
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
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>');
    });

    test('extract-and-merge with xml definition without newline', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test'
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
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '        <target state="new">source val</target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>');
    });
    test('handle non default source file name', async () => {
        await fs.writeFile('builder-test/my-messages.xlf', '<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            sourceFile: 'my-messages.xlf',
            outputPath: 'builder-test'
        });

        // The "result" member (of type BuilderOutput) is the next output.
        await run.result;
        const result = await run.result;
        expect(result.success).toBeTruthy();

        // Stop the builder from running. This stops Architect from keeping
        // the builder-associated states in memory, since builders keep waiting
        // to be scheduled.
        await run.stop();

        expect(extractI18nBuilderMock.mock.calls.length).toEqual(1);
        expect(extractI18nBuilderMock.mock.calls[0][0]).toEqual({
            format: 'xlf',
            outFile: 'my-messages.xlf',
            outputPath: 'builder-test',
            progress: false,
        });

        // Expect that the copied file is the same as its source.
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source>source val</source>\n' +
            '        <target state="new">source val</target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>');
    });
    test('retain leading and trailing whitespaces', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source> source val </source>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test'
        });

        // The "result" member (of type BuilderOutput) is the next output.
        await run.result;
        const result = await run.result;
        expect(result.success).toBeTruthy();

        // Stop the builder from running. This stops Architect from keeping
        // the builder-associated states in memory, since builders keep waiting
        // to be scheduled.
        await run.stop();

        const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
        expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source> source val </source>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>');
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
            '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '      <trans-unit id="ID1" datatype="html">\n' +
            '        <source> source val </source>\n' +
            '        <target state="new"> source val </target>\n' +
            '      </trans-unit>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>');
    });
    describe('trim', () => {
        test('retain whitespaces when trim=false and collapseWhitespace=false', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                collapseWhitespace: false,
                trim: false
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '        <target state="new"> source   val </target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
        test('retain whitespaces when trim=false and collapseWhitespace=true', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                // default: collapseWhitespace: true,
                // default: trim: false
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source val </source>\n' +
                '        <target state="new"> source val </target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
        test('remove whitespaces when trim=true and collapseWhitespace=true', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                // default: collapseWhitespace: true
                trim: true
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source val</source>\n' +
                '        <target state="new">source val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
        test('remove whitespaces when trim=true and collapseWhitespace=false', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                collapseWhitespace: false,
                trim: true
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source   val</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>source   val</source>\n' +
                '        <target state="new">source   val</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
    });
    describe('collapseWhitespace', () => {
        test('retain whitespaces when collapseWhitespace=false', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                collapseWhitespace: false
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '        <target state="new"> source   val </target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
        test('remove whitespaces when collapseWhitespace=true', async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source   val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                outputPath: 'builder-test',
                // default: collapseWhitespace: true
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source val </source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?>\n' +
                '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source> source val </source>\n' +
                '        <target state="new"> source val </target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
    });
    describe('multiple context groups', () => {
        beforeEach(async () => {
            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>', 'utf8');
        })
        test('add new context groups', async () => {
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>', 'utf8');


            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                includeContext: true,
                outputPath: 'builder-test'
            });
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();
            await run.stop();

            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>');
        });
        test('retain multiple context nodes', async () => {

            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                includeContext: true,
                outputPath: 'builder-test'
            });
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>');
        });
        test('remove multiple context nodes', async () => {
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>', 'utf8');

            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                format: 'xlf',
                targetFiles: ['messages.fr.xlf'],
                includeContext: false,
                outputPath: 'builder-test'
            });
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();
            await run.stop();

            const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
            expect(sourceContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>Some text</source>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
            const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
            expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
                '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
                '    <body>\n' +
                '      <trans-unit id="ID1" datatype="html">\n' +
                '        <source>Some text</source>\n' +
                '        <target state="new">Some text</target>\n' +
                '      </trans-unit>\n' +
                '    </body>\n' +
                '  </file>\n' +
                '</xliff>');
        });
    });

    test('retain whitespace between interpolations', async () => {
        await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>', 'utf8');
        await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
            '  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">\n' +
            '    <body>\n' +
            '    </body>\n' +
            '  </file>\n' +
            '</xliff>', 'utf8');

        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
            format: 'xlf',
            targetFiles: ['messages.fr.xlf'],
            outputPath: 'builder-test'
        });
        await run.result;
        const result = await run.result;
        expect(result.success).toBeTruthy();
        await run.stop();

        const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
        expect(sourceContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>');
        const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
        expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
            '</xliff>');
    });

    describe('sort', () => {
        beforeEach(async () => {
            extractI18nBuilderMock = jest.fn(async () => {
                // update messages.xlf:
                await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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


            await fs.writeFile('builder-test/messages.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>', 'utf8');
            await fs.writeFile('builder-test/messages.fr.xlf', '<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                '</xliff>', 'utf8');

        });
        describe('idAsc', () => {
            test('should sort by ID', async () => {
                const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    sort: 'idAsc'
                });
                await run.result;
                const result = await run.result;
                expect(result.success).toBeTruthy();
                await run.stop();

                const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
                expect(sourceContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                    '</xliff>');
                const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
                expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                    '</xliff>');
            });
        });
        describe('stableAppendNew', () => {
            test('should keep existing order in source and target file and append new translations', async () => {
                const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge'}, {
                    format: 'xlf',
                    targetFiles: ['messages.fr.xlf'],
                    outputPath: 'builder-test',
                    // default: sort: 'stableAppendNew'
                });
                await run.result;
                const result = await run.result;
                expect(result.success).toBeTruthy();
                await run.stop();

                const sourceContent = await fs.readFile('builder-test/messages.xlf', 'utf8');
                expect(sourceContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                    '</xliff>');
                const targetContent = await fs.readFile('builder-test/messages.fr.xlf', 'utf8');
                expect(targetContent).toEqual('<?xml version="1.0"?><xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n' +
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
                    '</xliff>');
            });
        });
    });
});
