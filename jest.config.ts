import {JestConfigWithTsJest} from 'ts-jest';

// Sync object
const config: JestConfigWithTsJest = {
    preset: 'ts-jest/presets/js-with-ts-esm',
    testEnvironment: 'node',
    verbose: false,
    testMatch: undefined,
    testRegex: '.*\.spec\.ts$',
    collectCoverageFrom: ['src/**/*.ts'], // exclude coverage from schematic as it only collects from js (instead of ts)..
    coveragePathIgnorePatterns: ['src/rmSafe.ts'],
    transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};
export default config;
