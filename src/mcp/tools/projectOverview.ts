import { promises as fs, Dirent } from "node:fs";
import path from "node:path";

import {
    projectOverviewInputSchema,
    type ProjectOverviewInput,
} from "../schemas/projectOverview.js";
import type { McpToolDefinition } from "../types.js";
import { pathExists, writeJsonSafely } from "../../core/utils/fs.js";

const DEFAULT_IGNORE = new Set([
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    ".turbo",
    ".next",
    ".nuxt",
    ".yarn",
    ".pnpm-store",
    ".idea",
    ".vscode",
    ".DS_Store",
    "dist",
    "build",
    "out",
    "coverage",
    "tmp",
    "temp",
    ".orka",
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".env": "Configuration",
    ".toml": "TOML",
    ".cfg": "Configuration",
    ".ini": "Configuration",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SCSS",
    ".less": "LESS",
    ".py": "Python",
    ".rs": "Rust",
    ".go": "Go",
    ".rb": "Ruby",
};

const KNOWN_TECH_LABELS: Record<string, string> = {
    react: "React",
    "react-dom": "React DOM",
    next: "Next.js",
    vue: "Vue",
    svelte: "Svelte",
    angular: "Angular",
    express: "Express",
    koa: "Koa",
    fastify: "Fastify",
    nestjs: "NestJS",
    hapi: "hapi",
    vite: "Vite",
    webpack: "Webpack",
    jest: "Jest",
    vitest: "Vitest",
    playwright: "Playwright",
    cypress: "Cypress",
    typescript: "TypeScript",
    "@modelcontextprotocol/sdk": "Model Context Protocol SDK",
    fastmcp: "FastMCP",
    openai: "OpenAI SDK",
    commander: "Commander.js",
    pino: "Pino",
    zod: "Zod",
    dotenv: "dotenv",
};

const NOTABLE_FILES = [
    "README.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "tsconfig.json",
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "bun.lockb",
];

type StructureNode = {
    name: string;
    path: string;
    type: "directory" | "file" | "symlink";
    extension?: string;
    truncated?: boolean;
    children?: StructureNode[];
};

type ScanStats = {
    totalFiles: number;
    totalDirectories: number;
    extensions: Record<string, number>;
};

type ScanOptions = {
    maxDepth: number;
    maxEntriesPerDirectory: number;
    includeHidden: boolean;
    ignore: Set<string>;
};

type ScanAccumulator = {
    warnings: string[];
    componentDirectories: Set<string>;
    entityDirectories: Set<string>;
};

const COMPONENT_KEYWORDS = ["component", "components"];
const ENTITY_KEYWORDS = ["entity", "entities"];

const matchesKeyword = (value: string, keywords: string[]): boolean => {
    const normalised = value.toLowerCase();
    return keywords.some((keyword) => normalised.includes(keyword));
};

const normaliseRelativePath = (value: string): string => value.replaceAll(path.sep, "/");

const shouldIgnoreEntry = (
    name: string,
    relativePath: string,
    options: ScanOptions,
): boolean => {
    if (!options.includeHidden && name.startsWith(".")) {
        return true;
    }

    if (DEFAULT_IGNORE.has(name) || options.ignore.has(name)) {
        return true;
    }

    if (options.ignore.has(relativePath)) {
        return true;
    }

    return false;
};

const scanDirectory = async (
    absolutePath: string,
    relativePath: string,
    depth: number,
    stats: ScanStats,
    options: ScanOptions,
    acc: ScanAccumulator,
): Promise<StructureNode> => {
    stats.totalDirectories += 1;
    const label = relativePath || ".";

let dirEntries: Dirent[] = [];
    try {
        dirEntries = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
        acc.warnings.push(`Failed to read directory '${absolutePath}': ${(error as Error).message}`);
        return {
            name: path.basename(absolutePath),
            path: label,
            type: "directory",
            truncated: true,
        };
    }

    const sorted = dirEntries.sort((a, b) => a.name.localeCompare(b.name));

    const filtered = sorted.filter((entry) => {
        const relativeChildPath = normaliseRelativePath(
            relativePath ? `${relativePath}/${entry.name}` : entry.name,
        );
        return !shouldIgnoreEntry(entry.name, relativeChildPath, options);
    });

    const truncatedByLimit = filtered.length > options.maxEntriesPerDirectory;
    const limited = truncatedByLimit ? filtered.slice(0, options.maxEntriesPerDirectory) : filtered;

    const children: StructureNode[] = [];

    for (const entry of limited) {
        const relativeChildPath = normaliseRelativePath(
            relativePath ? `${relativePath}/${entry.name}` : entry.name,
        );
        const absoluteChildPath = path.join(absolutePath, entry.name);

        if (entry.isDirectory()) {
            if (depth + 1 < options.maxDepth) {
                const childNode = await scanDirectory(
                    absoluteChildPath,
                    relativeChildPath,
                    depth + 1,
                    stats,
                    options,
                    acc,
                );
                children.push(childNode);
            } else {
                stats.totalDirectories += 1;
                children.push({
                    name: entry.name,
                    path: relativeChildPath,
                    type: "directory",
                    truncated: true,
                });
            }
            if (matchesKeyword(entry.name, COMPONENT_KEYWORDS)) {
                acc.componentDirectories.add(relativeChildPath);
            }
            if (matchesKeyword(entry.name, ENTITY_KEYWORDS)) {
                acc.entityDirectories.add(relativeChildPath);
            }
            continue;
        }

        if (entry.isSymbolicLink()) {
            stats.totalFiles += 1;
            children.push({
                name: entry.name,
                path: relativeChildPath,
                type: "symlink",
            });
            continue;
        }

        stats.totalFiles += 1;
        let extensionWithDot = path.extname(entry.name).toLowerCase();
        if (!extensionWithDot && entry.name.startsWith(".env")) {
            extensionWithDot = ".env";
        }
        const extension = extensionWithDot.startsWith(".") ? extensionWithDot : undefined;
        const key = extension ?? "<none>";
        stats.extensions[key] = (stats.extensions[key] ?? 0) + 1;

        children.push({
            name: entry.name,
            path: relativeChildPath,
            type: "file",
            extension: extension ? extension.slice(1) : undefined,
        });
    }

    const truncatedByDepth = limited.some((entry) => entry.isDirectory()) && depth + 1 >= options.maxDepth;

    return {
        name: path.basename(absolutePath),
        path: label,
        type: "directory",
        children,
        truncated: truncatedByLimit || truncatedByDepth,
    };
};

const deriveLanguages = (
    extensionCounts: Record<string, number>,
): Array<{ language: string; count: number }> => {
    const languageCounts = new Map<string, number>();

    for (const [extension, count] of Object.entries(extensionCounts)) {
        if (extension === "<none>") {
            continue;
        }

        const language = EXTENSION_LANGUAGE_MAP[extension];
        if (!language) {
            continue;
        }

        languageCounts.set(language, (languageCounts.get(language) ?? 0) + count);
    }

    return Array.from(languageCounts.entries())
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count);
};

const extractDependencies = (
    record: Record<string, string> | undefined,
): Array<{ name: string; version: string }> => {
    if (!record) {
        return [];
    }

    return Object.entries(record)
        .map(([name, version]) => ({ name, version }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const extractScripts = (record: Record<string, string> | undefined): Array<{ name: string; command: string }> => {
    if (!record) {
        return [];
    }

    return Object.entries(record)
        .map(([name, command]) => ({ name, command }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const selectTop = <T>(items: T[], limit: number): T[] =>
    items.length > limit ? items.slice(0, limit) : items;

const deriveTechStack = (params: {
    dependencies: Array<{ name: string; version: string }>;
    devDependencies: Array<{ name: string; version: string }>;
    languages: Array<{ language: string; count: number }>;
}): string[] => {
    const stack = new Set<string>();

    const languageNames = params.languages.map((item) => item.language);
    languageNames.forEach((language) => stack.add(language));

    const depNames = new Set(
        [...params.dependencies, ...params.devDependencies].map((item) => item.name),
    );

    if (depNames.size > 0) {
        stack.add("Node.js");
    }

    for (const dependency of depNames) {
        const key = dependency.toLowerCase();
        const label = KNOWN_TECH_LABELS[key];
        if (label) {
            stack.add(label);
        }
    }

    return Array.from(stack);
};

const detectPackageManager = async (rootDirectory: string, pkg: any): Promise<string | undefined> => {
    if (typeof pkg?.packageManager === "string" && pkg.packageManager.length > 0) {
        return pkg.packageManager;
    }

    const candidates: Array<{ file: string; label: string }> = [
        { file: "pnpm-lock.yaml", label: "pnpm" },
        { file: "yarn.lock", label: "yarn" },
        { file: "package-lock.json", label: "npm" },
        { file: "bun.lockb", label: "bun" },
    ];

    for (const candidate of candidates) {
        const target = path.join(rootDirectory, candidate.file);
        if (await pathExists(target)) {
            return candidate.label;
        }
    }

    return undefined;
};

const collectNotableFiles = async (rootDirectory: string): Promise<string[]> => {
    const results: string[] = [];

    for (const fileName of NOTABLE_FILES) {
        const target = path.join(rootDirectory, fileName);
        if (await pathExists(target)) {
            results.push(fileName);
        }
    }

    return results;
};

const resolveAbsolutePath = (base: string): string =>
    path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);

const analyseProject = async (
    args: ProjectOverviewInput,
): Promise<{
    overview: Record<string, unknown>;
    structureFilePath: string;
    structureFileRelativeToRoot: string;
    structureFileRelativeToCwd: string;
    warnings: string[];
}> => {
    const rootDirectory = resolveAbsolutePath(args.rootDirectory);
    const outputDirectory = resolveAbsolutePath(args.outputDirectory);
    const structureFilePath = path.join(outputDirectory, args.structureFileName);

    let stat;
    try {
        stat = await fs.stat(rootDirectory);
    } catch (error) {
        throw new Error(`Root directory '${rootDirectory}' not accessible: ${(error as Error).message}`);
    }

    if (!stat.isDirectory()) {
        throw new Error(`Root path '${rootDirectory}' is not a directory.`);
    }

    const stats: ScanStats = { totalFiles: 0, totalDirectories: 0, extensions: {} };

    const options: ScanOptions = {
        maxDepth: args.maxDepth,
        maxEntriesPerDirectory: args.maxEntriesPerDirectory,
        includeHidden: args.includeHidden,
        ignore: new Set((args.ignore ?? []).map((item) => normaliseRelativePath(item))),
    };

    const acc: ScanAccumulator = {
        warnings: [],
        componentDirectories: new Set<string>(),
        entityDirectories: new Set<string>(),
    };

    const tree = await scanDirectory(rootDirectory, "", 0, stats, options, acc);

    let packageJson: Record<string, unknown> | undefined;
    const packageJsonPath = path.join(rootDirectory, "package.json");
    if (await pathExists(packageJsonPath)) {
        try {
            const raw = await fs.readFile(packageJsonPath, "utf8");
            packageJson = JSON.parse(raw) as Record<string, unknown>;
        } catch (error) {
            acc.warnings.push(`Failed to parse package.json: ${(error as Error).message}`);
        }
    }

    const dependencies = extractDependencies(
        (packageJson?.dependencies as Record<string, string> | undefined) ?? undefined,
    );
    const devDependencies = extractDependencies(
        (packageJson?.devDependencies as Record<string, string> | undefined) ?? undefined,
    );

    const languages = deriveLanguages(stats.extensions);
    const languageMap = new Map<string, { language: string; count: number }>();
    languages.forEach((item) => {
        languageMap.set(item.language, item);
    });
    for (const manualLanguage of args.manualLanguages ?? []) {
        const trimmed = manualLanguage.trim();
        if (!trimmed) continue;
        if (!languageMap.has(trimmed)) {
            languageMap.set(trimmed, { language: trimmed, count: 0 });
        }
    }
    const mergedLanguages = Array.from(languageMap.values()).sort((a, b) => b.count - a.count);

    const autoTechStack = deriveTechStack({ dependencies, devDependencies, languages: mergedLanguages });
    const techStack = Array.from(
        new Set([
            ...autoTechStack,
            ...((args.manualTechStack ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
        ]),
    );
    const packageManager = await detectPackageManager(rootDirectory, packageJson);
    const notableFiles = await collectNotableFiles(rootDirectory);

    const primaryDirectories = (tree.children ?? [])
        .filter((child) => child.type === "directory")
        .map((child) => ({
            name: child.name,
            path: child.path,
            truncated: child.truncated ?? false,
        }));

    const scripts = selectTop(extractScripts(packageJson?.scripts as Record<string, string> | undefined), 12);

    const componentDirectories = selectTop(Array.from(acc.componentDirectories).sort(), 20);
    const entityDirectories = selectTop(Array.from(acc.entityDirectories).sort(), 20);

    const description = args.projectDescription ?? (packageJson?.description as string | undefined);

    const overview = {
        generatedAt: new Date().toISOString(),
        rootDirectory,
        projectName: (packageJson?.name as string | undefined) ?? path.basename(rootDirectory),
        description,
        version: packageJson?.version ?? undefined,
        packageManager,
        languages: mergedLanguages,
        techStack,
        primaryDirectories,
        notableFiles,
        scripts,
        dependencies: selectTop(dependencies, 16),
        devDependencies: selectTop(devDependencies, 16),
        componentDirectories,
        entityDirectories,
    } satisfies Record<string, unknown>;

    const persistedOptions = {
        maxDepth: options.maxDepth,
        maxEntriesPerDirectory: options.maxEntriesPerDirectory,
        includeHidden: options.includeHidden,
        ignore: Array.from(options.ignore).sort(),
        manualTechStack: args.manualTechStack ?? undefined,
        manualLanguages: args.manualLanguages ?? undefined,
        projectDescription: args.projectDescription ?? undefined,
    };

    await writeJsonSafely(structureFilePath, {
        generatedAt: new Date().toISOString(),
        rootDirectory,
        options: persistedOptions,
        projectName: overview.projectName,
        description: overview.description,
        packageManager,
        languages: mergedLanguages,
        techStack,
        primaryDirectories,
        componentDirectories,
        entityDirectories,
        notableFiles,
        scripts,
        tree,
        warnings: acc.warnings,
    });

    const structureFileRelativeToRoot = normaliseRelativePath(path.relative(rootDirectory, structureFilePath) || ".");
    const structureFileRelativeToCwd = normaliseRelativePath(path.relative(process.cwd(), structureFilePath) || ".");

    return {
        overview: {
            ...overview,
            structureFile: structureFileRelativeToCwd,
        },
        structureFilePath,
        structureFileRelativeToRoot,
        structureFileRelativeToCwd,
        warnings: acc.warnings,
    };
};

export const createProjectOverviewTool = (): McpToolDefinition => ({
    name: "projectOverview",
    description:
        "Inspect the current project to produce an overview (tech stack, directories, dependencies) and write a structure file.",
    parameters: projectOverviewInputSchema,
    execute: async (rawArgs) => {
        const args = projectOverviewInputSchema.parse(rawArgs);
        const result = await analyseProject(args);

        return JSON.stringify(
            {
                overview: result.overview,
                structureFile: {
                    absolutePath: result.structureFilePath,
                    relativeToRoot: result.structureFileRelativeToRoot,
                    relativeToCwd: result.structureFileRelativeToCwd,
                },
                warnings: result.warnings,
            },
            null,
            2,
        );
    },
});
