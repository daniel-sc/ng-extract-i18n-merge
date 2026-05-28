import {JestConfigWithTsJest} from 'ts-jest';

// Sync object
const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: false,
    testMatch: undefined,
    testRegex: '.*\.spec\.ts$',
    moduleNameMapper: {
        '^ora$': '<rootDir>/jest.ora.stub.js',
    },
    collectCoverageFrom: ['src/**/*.ts'], // exclude coverage from schematic as it only collects from js (instead of ts)..
};
export default config;
