// Angular 22's schematics test utilities load `ora`, which is ESM-only.
// This project runs Jest through ts-jest in CommonJS mode, so Jest cannot
// parse the real `ora` package and fails before schematic tests execute.
// The Jest config maps `ora` to this minimal spinner stub for tests only.
// Runtime/published code still uses Angular DevKit's real dependencies.
module.exports = function ora() {
    return {
        start() {
            return this;
        },
        succeed() {
            return this;
        },
        fail() {
            return this;
        },
        stop() {
            return this;
        },
    };
};
module.exports.default = module.exports;
