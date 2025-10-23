#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";

import {
    stateManifestSchema,
    type StateManifest,
    type SessionStateEntry,
} from "../mcp/schemas/orchestration.js";
import { readJsonSafely, pathExists } from "../core/utils/fs.js";

const DEFAULT_STATE_DIR = ".orka";

const supportsColor = Boolean(process.stdout?.isTTY) && !("NO_COLOR" in process.env);
const colorize = (code: string, text: string): string =>
    supportsColor ? `\u001b[${code}m${text}\u001b[0m` : text;
const bold = (text: string): string => colorize("1", text);
const dim = (text: string): string => colorize("90", text);
const green = (text: string): string => colorize("32", text);
const yellow = (text: string): string => colorize("33", text);
const red = (text: string): string => colorize("31", text);
const cyan = (text: string): string => colorize("36", text);

const formatPercentPlain = (value: number): string => `${value.toFixed(1)}%`;
const colorPercent = (value: number): string => {
    const plain = formatPercentPlain(value);
    if (value >= 100) return green(plain);
    if (value >= 50) return yellow(plain);
    if (value > 0) return colorize("94", plain); // blue-ish for partial progress
    return dim(plain);
};

const formatPercent = (value: number): string =>
    supportsColor ? colorPercent(value) : formatPercentPlain(value);

const formatPercentWithPadding = (value: number, width = 7): string => {
    const plain = formatPercentPlain(value);
    if (!supportsColor) {
        return plain.padStart(width, " ");
    }

    const padding = " ".repeat(Math.max(0, width - plain.length));
    return `${padding}${colorPercent(value)}`;
};

const formatStatus = (status: string, width = 12): string => {
    const label = status.toUpperCase().padEnd(width, " ");
    if (!supportsColor) return label;

    switch (status) {
        case "done":
            return green(label);
        case "in_progress":
            return yellow(label);
        default:
            return dim(label);
    }
};

const formatDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const resolveStatePath = (directory: string): string =>
    path.isAbsolute(directory)
        ? path.join(directory, "state.json")
        : path.resolve(process.cwd(), directory, "state.json");

const loadState = async (statePath: string): Promise<StateManifest | null> => {
    if (!(await pathExists(statePath))) {
        return null;
    }

    const raw = await readJsonSafely<unknown>(statePath);
    if (!raw) {
        return { sessions: [] } satisfies StateManifest;
    }

    return stateManifestSchema.parse(raw);
};

const printSessionSummary = (session: SessionStateEntry): void => {
    const {
        sessionId,
        prompt,
        createdAt,
        totals: { total, pending, inProgress, done, percentComplete },
    } = session;

    console.log(`${bold("-" + " ")} ${bold(sessionId)}`);
    console.log(`  ${bold("Prompt").padEnd(16)}: ${prompt}`);
    console.log(`  ${bold("Created").padEnd(16)}: ${formatDate(createdAt)}`);
    console.log(
        `  ${bold("Progress").padEnd(16)}: ${formatPercent(percentComplete)} ${dim(
            `(${done}/${total} done, ${inProgress} in progress, ${pending} pending)`,
        )}`,
    );
};

const printTaskDetails = (session: SessionStateEntry): void => {
    console.log(`\n${bold(`Tasks for ${session.sessionId}:`)}`);
    session.tasks.forEach((task) => {
        const statusLabel = formatStatus(task.status);
        const progressLabel = formatPercentWithPadding(task.progressPercent);
        console.log(`  ${cyan(task.id.padEnd(10, " "))} [${statusLabel}] ${progressLabel}  ${task.title}`);
    });
    console.log(`  ${dim(`Files: ${session.files.directory}`)}`);
};

const program = new Command();
program.name("orka").description("orka CLI").version("0.0.1");

program
    .command("hello")
    .description("Simple connectivity check")
    .action(() => {
        console.log("hello from orka CLI");
    });

program
    .command("status")
    .description("Show aggregated task status from Orka MCP sessions")
    .option("-d, --directory <path>", "Directory containing Orka session artifacts", DEFAULT_STATE_DIR)
    .option("-s, --session <id>", "Filter by session id")
    .option("-a, --all", "Show tasks for all sessions", false)
    .option("-n, --limit <count>", "Number of recent sessions to display", (value) => Number.parseInt(value, 10))
    .action(async (options) => {
        const statePath = resolveStatePath(options.directory ?? DEFAULT_STATE_DIR);
        const manifest = await loadState(statePath);

        if (!manifest || manifest.sessions.length === 0) {
            console.log("No Orka sessions found. Run MCP orchestration to generate tasks first.");
            return;
        }

        const sessions = manifest.sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

        const selectedSession = options.session
            ? sessions.find((session) => session.sessionId === options.session)
            : undefined;

        if (options.session && !selectedSession) {
            console.error(`Session '${options.session}' not found in ${statePath}.`);
            process.exitCode = 1;
            return;
        }

        const overall = sessions.reduce(
            (acc, session) => {
                acc.total += session.totals.total;
                acc.pending += session.totals.pending;
                acc.inProgress += session.totals.inProgress;
                acc.done += session.totals.done;
                return acc;
            },
            { total: 0, pending: 0, inProgress: 0, done: 0 },
        );

        const overallPercent = overall.total === 0 ? 0 : (overall.done / overall.total) * 100;
        console.log(
            `${bold("Overall progress:")} ${formatPercent(overallPercent)} ${dim(
                `(${overall.done}/${overall.total} done, ${overall.inProgress} in progress, ${overall.pending} pending)`,
            )}`,
        );
        console.log(`${bold("State file").padEnd(16)}: ${statePath}`);

        const sessionsToShow: SessionStateEntry[] = (() => {
            if (selectedSession) {
                return [selectedSession];
            }
            if (options.all) {
                return sessions;
            }

            const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : sessions.length;
            return sessions.slice(0, limit);
        })();

        console.log(`\n${bold(`Sessions displayed: ${sessionsToShow.length}`)}`);
        sessionsToShow.forEach((session) => {
            printSessionSummary(session);
            printTaskDetails(session);
        });
    });

program.parseAsync().catch((error) => {
    console.error("orka CLI encountered an error:", error);
    process.exitCode = 1;
});
