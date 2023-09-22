import {TranslationFile} from './translationFileModels';
import {fromXlf1, fromXlf2, toXlf1, toXlf2} from './translationFileSerialization';

describe('translationFileSerialization', () => {
    describe('fromXlf2', () => {
        it('should parse xlf2', () => {
            const xlf2 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file original="ng.template" id="ngi18n">
    <unit id="ID1">
      <segment state="initial">
        <source>source val</source>
        <target>target val</target>
        <notes>
            <note category="meaning">greeting</note>
            <note category="description">Greeting message that includes the user&apos;s name.</note>
            <note category="location">app/app.component.ts:11</note>
            <note category="location">app/another.component.ts:13</note>
        </notes>
      </segment>
    </unit>
  </file>
</xliff>`;
            const translationFile = fromXlf2(xlf2);
            expect(translationFile).toEqual(new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'initial',
                meaning: 'greeting',
                description: 'Greeting message that includes the user\'s name.',
                locations: [
                    {
                        file: 'app/app.component.ts',
                        line: 11
                    },
                    {
                        file: 'app/another.component.ts',
                        line: 13
                    }
                ]
            }], 'de', 'fr', '<?xml version="1.0" encoding="UTF-8"?>\n'));
        });
    });
    describe('toXlf2', () => {
        it('should keep trailing whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: ' source val ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input)).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file original="ng.template" id="ngi18n">
    <unit id="ID1">
      <segment>
        <source> source val </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should format correctly', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'initial',
                meaning: 'greeting',
                description: 'Greeting message that includes the user\'s name.',
                locations: [
                    {
                        file: 'app/app.component.ts',
                        line: 11
                    },
                    {
                        file: 'app/another.component.ts',
                        line: 13
                    }
                ]
            }], 'de', 'fr', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf2(input)).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file original="ng.template" id="ngi18n">
    <unit id="ID1">
      <segment state="initial">
        <source>source val</source>
        <target>target val</target>
        <notes>
          <note category="meaning">greeting</note>
          <note category="description">Greeting message that includes the user&apos;s name.</note>
          <note category="location">app/app.component.ts:11</note>
          <note category="location">app/another.component.ts:13</note>
        </notes>
      </segment>
    </unit>
  </file>
</xliff>`);
        });

    });
    describe('toXlf1', () => {
        it('should not include state attribute if it is undefined', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                locations: []
            }], 'de', undefined);
            expect(toXlf1(input)).toEqual(`<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html">
        <source>source val</source>
        <target>target val</target>
      </trans-unit>
    </body>
  </file>
</xliff>`);
        });
        it('should format correctly', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'translated',
                meaning: 'User welcome',
                description: 'An introduction header for this sample',
                locations: [{
                    file: 'app/app.component.ts',
                    line: 11
                }]
            }], 'de', 'fr-ch', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf1(input)).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html">
        <source>source val</source>
        <target state="translated">target val</target>
        <note priority="1" from="description">An introduction header for this sample</note>
        <note priority="1" from="meaning">User welcome</note>
        <context-group purpose="location">
          <context context-type="sourcefile">app/app.component.ts</context>
          <context context-type="linenumber">11</context>
        </context-group>
      </trans-unit>
    </body>
  </file>
</xliff>`);
        });

    });
    describe('fromXlf1', () => {
        it('should parse xml with placeholder', () => {
            const xlf1 = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html">
        <source>Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/></source>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            const translationFile = fromXlf1(xlf1);
            expect(translationFile).toEqual(new TranslationFile([{
                id: 'ID1',
                source: 'Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/>',
                locations: []
            }], 'de', undefined, undefined));
        });

        it('should parse xlf1', () => {
            const xlf1 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html">
        <source>source val</source>
        <target state="translated">target val</target>
        <note priority="1" from="description">An introduction header for this sample</note>
        <note priority="1" from="meaning">User welcome</note>
        <context-group purpose="location">
          <context context-type="sourcefile">app/app.component.ts</context>
          <context context-type="linenumber">11</context>
        </context-group>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            const translationFile = fromXlf1(xlf1);
            expect(translationFile).toEqual(new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'translated',
                meaning: 'User welcome',
                description: 'An introduction header for this sample',
                locations: [{
                    file: 'app/app.component.ts',
                    line: 11
                }]
            }], 'de', 'fr-ch', '<?xml version="1.0" encoding="UTF-8"?>\n'));
        });
    });
})
