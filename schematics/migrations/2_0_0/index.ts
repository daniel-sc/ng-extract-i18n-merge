import {Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {updateWorkspace} from '@schematics/angular/utility/workspace';
import {buildTargetAttribute} from '../../../src/buildTargetAttribute';

function updateNpmScript(tree: Tree, logger: SchematicContext['logger']) {
    const pkgPath = '/package.json';
    const buffer = tree.read(pkgPath);
    if (buffer === null) {
        throw new SchematicsException('Could not read package.json');
    }
    const pkg = JSON.parse(buffer.toString());

    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
        throw new SchematicsException('Error reading package.json');
    }

    if (pkg.scripts?.['extract-i18n-merge']) {
        logger.info('updating npm script "extract-i18n-merge" (you can delete it if you like!)..');
        pkg.scripts['extract-i18n-merge'] = 'ng extract-i18n';
    }
    tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2));
}

export default function (): Rule {
    return (tree: Tree, context: SchematicContext) => {
        updateNpmScript(tree, context.logger);
        return updateWorkspace(async (workspace) => {
            workspace.projects.forEach((project, projectName) => {
                const i18nMergeTarget = project.targets.get('extract-i18n-merge');
                if (i18nMergeTarget) {
                    context.logger.info(`updating extract-i18n(-merge) targets for project ${projectName}..`)
                    const i18nTarget = {...(project.targets.get('extract-i18n') ?? {builder: 'ng-extract-i18n-merge:ng-extract-i18n-merge'})};
                    i18nTarget.builder = 'ng-extract-i18n-merge:ng-extract-i18n-merge';
                    i18nTarget.options = {
                        ...i18nMergeTarget.options,
                        [buildTargetAttribute]: i18nTarget.options?.browserTarget ?? i18nTarget.options?.buildTarget ?? `${projectName}:build`
                    }
                    project.targets.delete('extract-i18n'); // 'project.targets.set' not working!?
                    project.targets.add({name: 'extract-i18n', ...i18nTarget});
                    project.targets.delete('extract-i18n-merge');
                } else {
                    context.logger.warn('target "extract-i18n-merge" not found in workspace - please migrate manually!');
                }
            });
        });
    };
}
