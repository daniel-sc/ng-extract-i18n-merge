import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { updateWorkspace } from '@schematics/angular/utility/workspace';

export default function (): Rule {
    return (_tree: Tree, context: SchematicContext) => {
        return updateWorkspace(workspace => {
            workspace.projects.forEach((project, projectName) => {
                const target = project.targets.get('extract-i18n');
                if (!target) {
                    context.logger.warn(`extract-i18n target not found in project ${projectName}`);
                    return;
                }
                const opts = { ...(target.options as any) };
                if (opts.browserTarget) {
                    opts.buildTarget = opts.browserTarget;
                    delete (opts as any).browserTarget;
                }
                if (opts.prettyNestedTags === undefined) {
                    opts.prettyNestedTags = true;
                }
                if (opts.sort === undefined) {
                    opts.sort = 'stableAppendNew';
                }
                target.options = opts;
                project.targets.set('extract-i18n', target);
            });
        });
    };
}
