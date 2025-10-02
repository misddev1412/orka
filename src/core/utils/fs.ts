import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Write text content to disk, creating parent directories when necessary.
 * Returns the resolved absolute path to the written file.
 */
export const writeFileSafely = async (targetPath: string, contents: string): Promise<string> => {
    const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
    const parentDir = path.dirname(resolvedPath);

    await fs.mkdir(parentDir, { recursive: true });
    const normalized = contents.endsWith("\n") ? contents : `${contents}\n`;
    await fs.writeFile(resolvedPath, normalized, "utf8");

    return resolvedPath;
};

export const writeJsonSafely = async (targetPath: string, data: unknown, space = 2): Promise<string> => {
    const serialized = JSON.stringify(data, null, space);
    return writeFileSafely(targetPath, serialized);
};

export const pathExists = async (targetPath: string): Promise<boolean> => {
    const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);

    try {
        await fs.access(resolvedPath);
        return true;
    } catch {
        return false;
    }
};

export const readJsonSafely = async <T>(targetPath: string): Promise<T | undefined> => {
    const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);

    if (!(await pathExists(resolvedPath))) {
        return undefined;
    }

    const raw = await fs.readFile(resolvedPath, "utf8");

    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON file at ${resolvedPath}: ${(error as Error).message}`);
    }
};
