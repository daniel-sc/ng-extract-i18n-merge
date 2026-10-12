import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {cp, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import serialization from '../../dist/src/model/translationFileSerialization.js';

const versions = {
    20: {angular: '20.3.9', nx: '22.5.0', typescript: '5.9.3'},
    21: {angular: '21.0.0', nx: '22.5.0', typescript: '5.9.3'},
    22: {angular: '22.0.0', nx: '23.3.0', typescript: '6.0.3'}
}[process.argv[2] ?? '21'];
assert.ok(versions, 'Usage: npm run test-nx -- <20|21|22>');

const repository = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), 'ng-extract-i18n-merge-nx-'));
const env = {...process.env, NX_DAEMON: 'false', NX_INTERACTIVE: 'false', NX_TUI: 'false'};

function npm(args, cwd, stdio = 'inherit') {
    return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
        cwd, env, stdio, encoding: 'utf8'
    });
}

async function read(relativePath) {
    return readFile(join(workspace, relativePath), 'utf8');
}

try {
    await cp(new URL('./workspace/', import.meta.url), workspace, {recursive: true});
    const manifest = JSON.parse(await read('package.json'));
    for (const name of Object.keys(manifest.devDependencies)) {
        if (name.startsWith('@angular/') || name.startsWith('@angular-devkit/') || name === '@schematics/angular') {
            manifest.devDependencies[name] = versions.angular;
        }
    }
    Object.assign(manifest.devDependencies, {
        '@nx/angular': versions.nx,
        nx: versions.nx,
        typescript: versions.typescript
    });
    await writeFile(join(workspace, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Testing Angular ${versions.angular} with Nx ${versions.nx}.`);
    const [{filename}] = JSON.parse(npm(['pack', '--json', '--pack-destination', workspace], repository, 'pipe'));
    npm(['install', '--save-dev', join(workspace, filename), '--no-audit', '--no-fund'], workspace);

    const nxPackage = JSON.parse(await read('node_modules/nx/package.json'));
    const nxCli = join(workspace, 'node_modules/nx', nxPackage.bin.nx);
    function nx(...args) {
        return execFileSync(process.execPath, [nxCli, ...args], {
            cwd: workspace, env, stdio: 'inherit'
        });
    }

    const shopPath = 'apps/shop/project.json';
    const otherPath = 'apps/other/project.json';
    const originalShop = await read(shopPath);
    const originalOther = await read(otherPath);
    const setup = 'ng-extract-i18n-merge:ng-add';

    // A missing project must fail without silently selecting another application.
    const missingProject = spawnSync(process.execPath, [
        nxCli, 'generate', setup, '--interactive=false'
    ], {cwd: workspace, env, encoding: 'utf8'});
    assert.equal(missingProject.status, 1);
    assert.match(missingProject.stdout + missingProject.stderr, /--project/);
    assert.equal(await read(shopPath), originalShop);
    assert.equal(await read(otherPath), originalOther);

    nx('generate', setup, '--project=shop', '--interactive=false');
    const shop = JSON.parse(await read(shopPath));
    assert.equal(shop.targets['extract-i18n'].executor, 'ng-extract-i18n-merge:ng-extract-i18n-merge');
    assert.deepEqual(shop.targets['extract-i18n'].options, {
        buildTarget: 'shop:build',
        format: 'xlf2',
        outputPath: 'apps/shop/src/locale',
        targetFiles: ['messages.fr.xlf']
    });
    assert.deepEqual(shop.targets.build, JSON.parse(originalShop).targets.build);
    assert.equal(await read(otherPath), originalOther);

    nx('run', 'shop:extract-i18n', '--skip-nx-cache');
    const sourcePath = 'apps/shop/src/locale/messages.xlf';
    const targetPath = 'apps/shop/src/locale/messages.fr.xlf';
    const source = serialization.fromXlf2(await read(sourcePath));
    const target = serialization.fromXlf2(await read(targetPath));
    assert.deepEqual(source.units.map(unit => unit.id).sort(), ['greeting', 'new']);
    assert.deepEqual(target.units.map(unit => unit.id).sort(), ['greeting', 'new']);
    assert.equal(target.units.find(unit => unit.id === 'greeting').target, 'Bonjour');
    assert.equal(target.units.find(unit => unit.id === 'greeting').state, 'final');
    assert.equal(target.units.find(unit => unit.id === 'new').source, 'New message');
    assert.equal(target.units.find(unit => unit.id === 'new').state, 'initial');

    const firstSource = await read(sourcePath);
    const firstTarget = await read(targetPath);
    nx('run', 'shop:extract-i18n', '--skip-nx-cache');
    assert.equal(await read(sourcePath), firstSource);
    assert.equal(await read(targetPath), firstTarget);
    assert.equal(await read(otherPath), originalOther);
    console.log('Nx setup, extraction, and merge integration passed.');
} finally {
    await rm(workspace, {recursive: true, force: true, maxRetries: 5});
}
