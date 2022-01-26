import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder from './builder';

describe('Builder', () => {
    let architect: Architect;
    let architectHost: TestingArchitectHost;

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
        await architectHost.addTarget({project: 'builder-test', target: 'extract-i18n-merge'}, 'ng-extract-i18n-merge:ng-extract-i18n-merge');
        await architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(() => ({success: true}))); // dummy builder
        await architectHost.addTarget({project: 'builder-test', target: 'extract-i18n'}, '@angular-devkit/build-angular:extract-i18n');
    });

    test('extract-and-merge', async () => {
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
});
