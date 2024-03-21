import {TranslationFile} from './translationFileModels';
import {fromXlf1, fromXlf2, toXlf1, toXlf2} from './translationFileSerialization';

describe('translationFileSerialization', () => {
    describe('fromXlf2', () => {
        it('should parse xlf2', () => {
            const xlf2 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <notes>
        <note category="location">app/app.component.ts:11</note>
        <note category="location">app/another.component.ts:13</note>
        <note category="meaning">greeting</note>
        <note category="description">Greeting message that includes the user&apos;s name.</note>
      </notes>
      <segment state="initial">
        <source>source val</source>
        <target>target val</target>
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
                description: 'Greeting message that includes the user&apos;s name.',
                locations: [
                    {
                        file: 'app/app.component.ts',
                        lineStart: 11
                    },
                    {
                        file: 'app/another.component.ts',
                        lineStart: 13
                    }
                ]
            }], 'de', 'fr', '<?xml version="1.0" encoding="UTF-8"?>\n'));
        });

        it('should parse additionalAttributes', () => {
            const xlf2 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment state="initial" customAttr="customVal">
        <source>source val</source>
        <target customState="custom">target val</target>
      </segment>
    </unit>
  </file>
</xliff>`;
            const translationFile = fromXlf2(xlf2);
            expect(translationFile.units[0].additionalAttributes).toEqual([
                {name: 'customAttr', value: 'customVal', path: 'segment'},
                {name: 'customState', value: 'custom', path: 'segment.target'}
            ]);
        });
    });
    describe('toXlf2', () => {
        it('should keep trailing whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: ' source val ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source> source val </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should keep whitespace between nested tags', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source <b> <nested/></b>',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source>source <b> <nested/></b></source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should wrap nested tags with leading whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: ' <nested1>a</nested1> <nested2>b</nested2> ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source>
          <nested1>a</nested1>
          <nested2>b</nested2>
        </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should wrap nested tags without leading whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: '<nested1>a</nested1><nested2>b</nested2>',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source>
          <nested1>a</nested1>
          <nested2>b</nested2>
        </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should not wrap nested tags when prettyNestedTags=false', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: ' <nested1>a</nested1> <nested2>b</nested2> ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: false})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source> <nested1>a</nested1> <nested2>b</nested2> </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should not wrap nested tags prefix text has no leading whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'prefix <nested1>a</nested1> <nested2>b</nested2> ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source>prefix <nested1>a</nested1> <nested2>b</nested2> </source>
      </segment>
    </unit>
  </file>
</xliff>`);
        });
        it('should not wrap nested tags prefix text has leading whitespace', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: ' prefix <nested1>a</nested1> <nested2>b</nested2> ',
                locations: []
            }], 'de', undefined);
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <segment>
        <source> prefix <nested1>a</nested1> <nested2>b</nested2> </source>
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
                description: 'Greeting message that includes the user&apos;s name.',
                locations: [
                    {
                        file: 'app/app.component.ts',
                        lineStart: 11
                    },
                    {
                        file: 'app/another.component.ts',
                        lineStart: 13
                    }
                ]
            }], 'de', 'fr', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1">
      <notes>
        <note category="location">app/app.component.ts:11</note>
        <note category="location">app/another.component.ts:13</note>
        <note category="description">Greeting message that includes the user&apos;s name.</note>
        <note category="meaning">greeting</note>
      </notes>
      <segment state="initial">
        <source>source val</source>
        <target>target val</target>
      </segment>
    </unit>
  </file>
</xliff>`);
        });

        it('should format additionalAttributes', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'initial',
                locations: [],
                additionalAttributes: [
                    {name: 'approved', value: 'yes', path: '.'},
                    {name: 'other', value: 'value', path: 'segment.target'}
                ]
            }], 'de', 'fr', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf2(input, {prettyNestedTags: true})).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr">
  <file id="ngi18n" original="ng.template">
    <unit id="ID1" approved="yes">
      <segment state="initial">
        <source>source val</source>
        <target other="value">target val</target>
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
            expect(toXlf1(input, {prettyNestedTags: true})).toEqual(`<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
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
                    lineStart: 11
                }]
            }], 'de', 'fr-ch', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf1(input, {prettyNestedTags: true})).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
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
        it('should output additinalAttribute', () => {
            const input = new TranslationFile([{
                id: 'ID1',
                source: 'source val',
                target: 'target val',
                state: 'translated',
                locations: [],
                additionalAttributes: [
                    {name: 'approved', value: 'yes', path: '.'},
                    {name: 'other', value: 'value', path: 'target'}
                ]
            }], 'de', 'fr-ch', '<?xml version="1.0" encoding="UTF-8"?>\n');
            expect(toXlf1(input, {prettyNestedTags: true})).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html" approved="yes">
        <source>source val</source>
        <target state="translated" other="value">target val</target>
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

        it('should parse xml with placeholder and sorting', () => {
            const xlf1 = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html">
        <source>Some text <ph id="0" equiv="INTERPOLATION" disp="{{ myLabel }}"/></source>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            const translationFile = fromXlf1(xlf1, { sortNestedTagAttributes: true });
            expect(translationFile).toEqual(new TranslationFile([{
                id: 'ID1',
                source: 'Some text <ph disp="{{ myLabel }}" equiv="INTERPOLATION" id="0"/>',
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
                    lineStart: 11
                }]
            }], 'de', 'fr-ch', '<?xml version="1.0" encoding="UTF-8"?>\n'));
        });

        it('should parse additionalAttributes', () => {
            const xlf1 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" target-language="fr-ch" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="ID1" datatype="html" approved="yes">
        <source>source val</source>
        <target state="translated" other="value">target val</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            const translationFile = fromXlf1(xlf1);
            expect(translationFile.units[0].additionalAttributes).toEqual([
                {name: 'approved', value: 'yes', path: '.'},
                {name: 'other', value: 'value', path: 'target'}
            ]);
        });
    });
})
