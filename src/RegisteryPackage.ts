export interface RegisteryPackage {
    _id: string;
    _rev: string;
    name: string;
    "dist-tags": DistTags;
    versions: Versions;
    time: Time;
    maintainers: Maintainer[];
    description: string;
    repository: PackageDescriptionRepository;
    contributors: Contributor[];
    license: string;
    readme: string;
    readmeFilename: string;
    homepage: string;
}

export interface Contributor {
    name: string;
    url: string;
    githubUsername: string;
}

export type DistTags = Record<string, string>;

export interface Maintainer {
    name: string;
    email: string;
}

export interface PackageDescriptionRepository {
    type: string;
    url: string;
    directory: string;
}

export type Time = Record<string, number>;

export type Versions = Record<string, Version>;

export interface Version {
    name: string;
    version: string;
    description: string;
    license: string;
    contributors: Contributor[];
    main: string;
    repository: Repository;
    scripts: Directories;
    dependencies: Dependencies;
    typesPublisherContentHash: string;
    typeScriptVersion: string;
    _id: string;
    dist: Dist;
    maintainers: Maintainer[];
    _npmUser: Maintainer;
    directories: Directories;
    _npmOperationalInternal: NpmOperationalInternal;
    _hasShrinkwrap: boolean;
}

export interface NpmOperationalInternal {
    host: string;
    tmp: string;
}

export interface Dependencies {
    "@types/node": string;
}

export interface Directories {
}

export interface Dist {
    integrity: string;
    shasum: string;
    tarball: string;
    fileCount: number;
    unpackedSize: number;
    "npm-signature"?: string;
}

export interface Repository {
    type: string;
    url: string;
}

export interface The700 {
    name: string;
    version: string;
    description: string;
    license: string;
    contributors: Contributor[];
    main: string;
    types: string;
    repository: PackageDescriptionRepository;
    scripts: Directories;
    dependencies: Dependencies;
    typesPublisherContentHash: string;
    typeScriptVersion: string;
    _id: string;
    dist: Dist;
    maintainers: Maintainer[];
    _npmUser: Maintainer;
    directories: Directories;
    _npmOperationalInternal: NpmOperationalInternal;
    _hasShrinkwrap: boolean;
    homepage?: string;
}
