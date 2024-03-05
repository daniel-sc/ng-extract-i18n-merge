import * as extractI18nSchema from '@angular-devkit/build-angular/src/builders/extract-i18n/schema.json';

export const buildTargetAttribute = (extractI18nSchema.properties as any).buildTarget ? 'buildTarget' : 'browserTarget'
