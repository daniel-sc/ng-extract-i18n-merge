import {JestConfigWithTsJest} from 'ts-jest';

// Sync object
const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: false,
    testMatch: undefined,
    testRegex: '.*\.spec\.ts$',
    collectCoverageFrom: ['src/**/*.ts'], // exclude coverage from schematic as it only collects from js (instead of ts)..
    coveragePathIgnorePatterns: ['src/rmSafe.ts'],
};
export default config;
