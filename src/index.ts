import {
    sep,
    join,
    posix,
    dirname,
    relative,
    basename,
    normalize,
} from 'path';
import {
    lstat,
} from 'fs/promises'

import fetch from 'node-fetch';
import appRoot from 'app-root-path';
import download from 'download';
import { glob } from 'glob';
import { spawn } from 'cross-spawn';
import { extract } from 'tar';
import { PromiseValue } from 'type-fest';
import {
    copy,
    removeSync,
    readJsonSync,
    writeFileSync,
    ensureDirSync,
} from 'fs-extra';

import type { JSONSchemaForNPMPackageJsonFiles } from '@schemastore/package';

import type { RegisteryPackage } from './RegisteryPackage';

const normalizeEntryPointPath = async (
    x: string,
    packageRootPath: string
) => {
    const absoluteEntryPointPath = join(packageRootPath, x);

    if (!(await lstat(absoluteEntryPointPath)).isFile()) {
        return './' + normalize(join(x, 'index.js')).split(sep).join(posix.sep)
    } else {
        return './' + normalize(x).split(sep).join(posix.sep);
    }
}

const getPackageRootPath = (packageName: string) => {
    return join(appRoot.toString(), 'packages', packageName, 'package');
}

class PackageNameNotExistsError extends Error {
    name = '`name` field not exists in `package.json`';
}

export const getPackageMetadata = async (packageName: string) => {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const body = await response.json() as RegisteryPackage | { error: string };

    if ('error' in body) {
        return { packageName, version: null }
    }

    const latestVersion = body['dist-tags'].latest as string;
    const latestVersionMetadata = body.versions[latestVersion].dist;

    return {
        packageName, version: latestVersion, ...latestVersionMetadata,
    }
}

class PackageNotFoundError extends Error {
    name = 'Target package is not found from registery';
}

type PackageMetadata = PromiseValue<ReturnType<typeof getPackageMetadata>>;

const downloadPackage = async (packageMetadata: PackageMetadata) => {
    if (!('tarball' in packageMetadata)) {
        throw new PackageNotFoundError();
    }

    const packageTarballDirPath = join(appRoot.toString(), 'packages');

    await download(packageMetadata.tarball, packageTarballDirPath);

    const packageTarballFilePath = join(
        packageTarballDirPath,
        basename(packageMetadata.tarball)
    );

    const extractCwd = join(
        packageTarballDirPath,
        packageMetadata.packageName,
    )
    removeSync(extractCwd)
    ensureDirSync(extractCwd)
    await extract({
        file: packageTarballFilePath,
        cwd: extractCwd,
    });
}

const preparePackage = async (packageName: string) => {
    const packageMetadata = await getPackageMetadata(packageName);
    await (downloadPackage(packageMetadata));
}

export const getConvertedPackageName = (packageName: string) => {
    const splittedPackageName = packageName.split('/');
    const truePackageName = splittedPackageName.length === 1
        ? packageName
        : splittedPackageName.join('__').replace('@', '');

    return '@fuuck/' + truePackageName;
}

export const convertPackageJson = async (packageName: string) => {
    const packageRootPath = getPackageRootPath(packageName);
    const packageJsonPath = join(packageRootPath, 'package.json');

    const packageJson = readJsonSync(packageJsonPath) as JSONSchemaForNPMPackageJsonFiles;
    delete packageJson.type;

    if (!packageJson.name) {
        throw new PackageNameNotExistsError();
    }
    const nextPackageName = getConvertedPackageName(packageName);

    packageJson.name = nextPackageName;

    // Rewrite Entry Point
    const esmPath = packageJson.main || (
        typeof packageJson.exports === 'string'
            ? packageJson.exports
            : packageJson.exports?.import || ''
    );

    const cjsPath = join('./cjs', esmPath);

    const nextExports = {
        require: await normalizeEntryPointPath(cjsPath, packageRootPath),
        import: await normalizeEntryPointPath(esmPath, packageRootPath),
    };

    packageJson.exports = nextExports;

    packageJson.repository = {
        "type": "git",
        "url": "git+https://github.com/Losses/fuuck.git"
    }


    // Rewrite files field
    const files = packageJson.files || [];
    files.push('cjs');
    packageJson.files = files;

    // Disable prepare script for NPM publishing
    if (packageJson.scripts?.prepare) {
        delete packageJson.scripts?.prepare;
    }

    // Rewrite dependencies
    const fuuckedPackages = getFuuckPackageList();
    fuuckedPackages.forEach((fuuckedPackage) => {
        if (!packageJson.dependencies?.[fuuckedPackage]) {
            return
        }

        packageJson.dependencies[fuuckedPackage] = `npm:${getConvertedPackageName(fuuckedPackage)}`
    })

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

export const convertJsFiles = async (packageName: string) => {
    const packageRootPath = getPackageRootPath(packageName);
    const outRootPath = join(packageRootPath, 'cjs');
    const jsGlobPattern = join(packageRootPath, '**', '*.js');
    const jsFiles = glob.sync(jsGlobPattern);

    await Promise.all(jsFiles.map((jsFile) => {
        const fileDir = relative(packageRootPath, dirname(jsFile))
        const outputDir = join(outRootPath, fileDir)
        ensureDirSync(outputDir)

        return new Promise((resolve) => {
            const process = spawn(
                'yarn',
                [
                    'run',
                    'tsc', jsFile,
                    '--declaration', '--allowJs',
                    '--module', 'commonjs',
                    '--target', 'esnext',
                    '--esModuleInterop',
                    '--outdir', outputDir
                ],
                { stdio: 'inherit' }
            )

            process.on('exit', resolve)
        });
    }));

    // Fix for fetch-blob, which will require a cjs file.
    const cjsGlobPattern = join(packageRootPath, '**', '*.cjs');
    const cjsFiles = glob.sync(cjsGlobPattern);

    await Promise.all(
        cjsFiles.map(async (x) => {
            const relativePath = relative(packageRootPath, x);
            const destPath = join(outRootPath, relativePath);

            ensureDirSync(dirname(destPath));

            return copy(x, destPath);
        })
    )
}

const checkIfIsLatest = async (packageName: string) => {
    const [
        originalVersion,
        convertedVersion
    ] = await Promise.all([
        getPackageMetadata(packageName),
        getPackageMetadata(getConvertedPackageName(packageName)),
    ]);

    return originalVersion.version === convertedVersion.version;
}

const convertPackage = async (packageName: string) => {
    await convertJsFiles(packageName);
    await convertPackageJson(packageName);
}

const downloadAndConvertPackage = async (packageName: string) => {
    await preparePackage(packageName);
    await convertPackage(packageName);
}

const getFuuckPackageList = (): Set<string> => {
    const fuuckPath = join(appRoot.toString(), 'fuuck.json');
    return new Set(readJsonSync(fuuckPath).packages);
}

export const downloadAndConvertFuuckedPackage = async () => {
    const fuuckPackages = getFuuckPackageList();

    for (const fuuckPackage of fuuckPackages) {
        await downloadAndConvertPackage(fuuckPackage);
    }
}

downloadAndConvertFuuckedPackage();