import type {Config} from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: false,
    testMatch: undefined,
    testRegex: '.*\.spec\.ts$',
    collectCoverageFrom: ['src/builder.ts', 'src/fileUtils.ts', 'src/lexUtils.ts', 'src/model/*.ts'] // exclude coverage from schematic as it only collects from js (instead of ts)..
};
export default config;
