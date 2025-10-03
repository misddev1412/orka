import path from "node:path";

import { readJsonSafely, pathExists } from "../../core/utils/fs.js";
import { DEFAULT_STRUCTURE_FILE_NAME } from "../schemas/projectOverview.js";
import { projectBaseSchema, type ProjectBase } from "../schemas/projectBase.js";

export const resolveProjectBasePath = (
    baseDirectory: string,
    fileName: string = DEFAULT_STRUCTURE_FILE_NAME,
): string =>
    path.isAbsolute(fileName)
        ? fileName
        : path.join(baseDirectory, fileName);

export const loadProjectBase = async (
    baseDirectory: string,
    fileName: string = DEFAULT_STRUCTURE_FILE_NAME,
): Promise<{ base: ProjectBase; path: string }> => {
    const structurePath = resolveProjectBasePath(baseDirectory, fileName);

    if (!(await pathExists(structurePath))) {
        throw new Error(
            `Project base not found at ${structurePath}. Run the projectOverview tool to generate the project baseline first.`,
        );
    }

    const raw = await readJsonSafely<unknown>(structurePath);
    if (!raw) {
        throw new Error(`Project base file ${structurePath} is empty or unreadable.`);
    }

    const base = projectBaseSchema.parse(raw);
    return { base, path: structurePath };
};

const joinWithComma = (values: string[]): string => values.join(", ");

const stringifyLanguages = (languages: ProjectBase["languages"] | undefined): string | undefined => {
    if (!languages || languages.length === 0) {
        return undefined;
    }
    const entries = languages.map((item) =>
        Number.isFinite(item.count) && item.count > 0
            ? `${item.language} (${item.count} files)`
            : `${item.language}`,
    );
    return joinWithComma(entries);
};

const stringifyTechStack = (techStack: ProjectBase["techStack"] | undefined): string | undefined => {
    if (!techStack || techStack.length === 0) {
        return undefined;
    }
    return joinWithComma(techStack);
};

const stringifyDirectories = (
    label: string,
    directories: Array<{ name: string; path: string; truncated?: boolean }> | undefined,
): string | undefined => {
    if (!directories || directories.length === 0) {
        return undefined;
    }

    const lines = directories.map((directory) => {
        const suffix = directory.truncated ? " (truncated view)" : "";
        return `- ${directory.path}${suffix}`;
    });

    return `${label}:\n${lines.join("\n")}`;
};

const stringifyStringList = (label: string, values: string[] | undefined): string | undefined => {
    if (!values || values.length === 0) {
        return undefined;
    }

    const lines = values.map((value) => `- ${value}`);
    return `${label}:\n${lines.join("\n")}`;
};

const stringifyScripts = (
    scripts: Array<{ name: string; command: string }> | undefined,
): string | undefined => {
    if (!scripts || scripts.length === 0) {
        return undefined;
    }

    const lines = scripts.map((script) => `- ${script.name}: ${script.command}`);
    return `Key scripts:\n${lines.join("\n")}`;
};

export const buildProjectBaseContext = (base: ProjectBase): string => {
    const sections: string[] = [];

    const headerParts: string[] = [];
    if (base.projectName) {
        headerParts.push(base.projectName);
    }
    if (base.description) {
        headerParts.push(base.description);
    }
    if (headerParts.length > 0) {
        sections.push(`Project base summary: ${headerParts.join(" — ")}`);
    }

    const techStack = stringifyTechStack(base.techStack);
    if (techStack) {
        sections.push(`Tech stack: ${techStack}`);
    }

    const languages = stringifyLanguages(base.languages);
    if (languages) {
        sections.push(`Languages: ${languages}`);
    }

    const primaryDirectories = stringifyDirectories("Primary directories", base.primaryDirectories);
    if (primaryDirectories) {
        sections.push(primaryDirectories);
    }

    const componentDirectories = stringifyStringList("Component directories", base.componentDirectories);
    if (componentDirectories) {
        sections.push(componentDirectories);
    }

    const entityDirectories = stringifyStringList("Entity directories", base.entityDirectories);
    if (entityDirectories) {
        sections.push(entityDirectories);
    }

    const notableFiles = stringifyStringList("Notable files", base.notableFiles);
    if (notableFiles) {
        sections.push(notableFiles);
    }

    const scripts = stringifyScripts(base.scripts);
    if (scripts) {
        sections.push(scripts);
    }

    if (base.packageManager) {
        sections.push(`Package manager: ${base.packageManager}`);
    }

    if (base.warnings && base.warnings.length > 0) {
        sections.push(`Structure warnings:\n${base.warnings.map((warning) => `- ${warning}`).join("\n")}`);
    }

    return sections.join("\n\n");
};
