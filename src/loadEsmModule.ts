/**
 * This uses a dynamic import to load a module which may be ESM.
 * CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
 * will currently, unconditionally downlevel dynamic import into a require call.
 * require calls cannot load ESM code and will result in a runtime error. To workaround
 * this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
 * Once TypeScript provides support for keeping the dynamic import this workaround can
 * be dropped.
 * This is only intended to be used with Angular framework packages.
 *
 * Copied from https://github.com/angular/angular/blob/e0015d3c456d584242269b0765878d598a550888/packages/core/schematics/utils/load_esm.ts#L11-L35
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
export async function loadEsmModule<T>(modulePath: string|URL): Promise<T> {
    const namespaceObject =
        (await new Function('modulePath', `return import(modulePath);`)(modulePath));

    // If it is not ESM then the values needed will be stored in the `default` property.
    if (namespaceObject.default) {
        return namespaceObject.default;
    } else {
        return namespaceObject;
    }
}