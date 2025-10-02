import path from "node:path";

import {
    stateManifestSchema,
    sessionStateEntrySchema,
    type SessionStateEntry,
    type StateManifest,
    type TaskProgress,
} from "../schemas/orchestration.js";
import { readJsonSafely, writeJsonSafely } from "../../core/utils/fs.js";

export const TASK_STATUSES = ["pending", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const VALID_STATUSES = new Set<string>(TASK_STATUSES);

type WithStatus<T extends { status?: unknown }> = Omit<T, "status"> & { status: TaskStatus };

export const sanitizeTaskStatus = (status?: string): TaskStatus => {
    const candidate = status ?? "pending";
    return VALID_STATUSES.has(candidate) ? (candidate as TaskStatus) : "pending";
};

export const sanitizeTasksStatus = <T extends { status?: string }>(tasks: T[]): Array<WithStatus<T>> =>
    tasks.map((task) => ({
        ...task,
        status: sanitizeTaskStatus(task.status),
    }));

export const buildTaskStates = (
    tasks: Array<{ id: string; title: string; status: TaskStatus; progressPercent?: number }>,
): TaskProgress[] =>
    tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        progressPercent: Number.isFinite(task.progressPercent) ? clampPercent(task.progressPercent ?? 0) : 0,
    }));

const clampPercent = (value: number): number => {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return Math.round(value * 10) / 10;
};

export const computeTotals = (taskStates: TaskProgress[]) => {
    const totals = taskStates.reduce(
        (acc, task) => {
            acc.total += 1;
            if (task.status === "done") acc.done += 1;
            else if (task.status === "in_progress") acc.inProgress += 1;
            else acc.pending += 1;
            return acc;
        },
        { total: 0, pending: 0, inProgress: 0, done: 0 },
    );

    const percentComplete = totals.total === 0 ? 0 : clampPercent((totals.done / totals.total) * 100);

    return { ...totals, percentComplete };
};

export const loadStateManifest = async (statePath: string): Promise<StateManifest> => {
    const raw = await readJsonSafely<unknown>(statePath);
    if (!raw) {
        return { sessions: [] } satisfies StateManifest;
    }

    return stateManifestSchema.parse(raw);
};

export const updateStateManifest = async (statePath: string, record: SessionStateEntry): Promise<StateManifest> => {
    const manifest = await loadStateManifest(statePath);
    const sessions = manifest.sessions.filter((session) => session.sessionId !== record.sessionId);
    sessions.push(record);

    const updated = stateManifestSchema.parse({
        sessions: sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    });

    await writeJsonSafely(statePath, updated);

    return updated;
};

export const resolveSessionDirectory = (stateEntry: SessionStateEntry): string => stateEntry.files.directory;

export const resolveSessionFile = (stateEntry: SessionStateEntry, key: keyof SessionStateEntry["files"]): string => {
    const target = stateEntry.files[key];
    if (!target) {
        throw new Error(`Session ${stateEntry.sessionId} does not have a file path for ${String(key)}.`);
    }

    return target;
};

export const ensureManifestEntry = (manifest: StateManifest, sessionId: string): SessionStateEntry => {
    const entry = manifest.sessions.find((session) => session.sessionId === sessionId);
    if (!entry) {
        throw new Error(`Session ${sessionId} not found in state manifest.`);
    }

    return sessionStateEntrySchema.parse(entry);
};

export const resolveStatePath = (baseDirectory: string): string =>
    path.isAbsolute(baseDirectory)
        ? path.join(baseDirectory, "state.json")
        : path.resolve(process.cwd(), baseDirectory, "state.json");
