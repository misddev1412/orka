import path from "node:path";

import { orchestrationInputSchema, orchestrationResultSchema } from "../schemas/orchestration.js";
import { analyzeRequirements } from "./analyzeRequirements.js";
import { generatePlanForInput } from "./generatePlan.js";
import { enhanceTaskPrompts } from "./enhancePrompts.js";
import type { McpToolDefinition } from "../types.js";
import { writeFileSafely, writeJsonSafely } from "../../core/utils/fs.js";
import { slugify } from "../../core/utils/string.js";
import {
    sanitizeTasksStatus,
    buildTaskStates,
    computeTotals,
    resolveStatePath,
    updateStateManifest,
} from "../utils/sessionState.js";
import { loadProjectBase, buildProjectBaseContext } from "../utils/projectBase.js";

const toSessionIdentifiers = (
    prompt: string,
    timestamp: Date,
    override?: string,
): { slug: string; stamp: string; sessionId: string; baseName: string } => {
    const slug = slugify(override ?? prompt);
    const stamp = timestamp.toISOString().replace(/[:.]/g, "-");
    const baseName = `${stamp}-${slug}`;
    return {
        slug,
        stamp,
        baseName,
        sessionId: baseName,
    };
};

export const createOrchestrationTool = (): McpToolDefinition => ({
    name: "createTodoPlan",
    description:
        "Run analysis, planning, and prompt enhancement to produce an agent-ready Markdown task list in one call.",
    parameters: orchestrationInputSchema,
    execute: async (rawArgs) => {
        const args = orchestrationInputSchema.parse(rawArgs);
        const timestamp = new Date();
        const createdAt = timestamp.toISOString();
        const { slug, stamp, baseName, sessionId } = toSessionIdentifiers(
            args.prompt,
            timestamp,
            args.sessionName,
        );
        const baseDirectory = path.isAbsolute(args.outputDirectory)
            ? args.outputDirectory
            : path.resolve(process.cwd(), args.outputDirectory);
        const sessionDirectory = path.join(baseDirectory, sessionId);

        const { base: projectBase, path: projectBasePath } = await loadProjectBase(baseDirectory);
        const baseContext = buildProjectBaseContext(projectBase);
        const contextParts = [baseContext.trim(), args.projectContext?.trim()]
            .filter((value): value is string => Boolean(value && value.length > 0));
        const combinedProjectContext = contextParts.length > 0 ? contextParts.join("\n\n") : undefined;

        const analysis = await analyzeRequirements({
            prompt: args.prompt,
            projectContext: combinedProjectContext,
            projectType: args.projectType,
            model: args.analysisModel,
        });

        const plan = await generatePlanForInput({
            prompt: args.prompt,
            analysis,
            model: args.planningModel,
            maxTasks: args.maxTasks,
        });

        const normalisedPlan = {
            ...plan,
            tasks: sanitizeTasksStatus(plan.tasks),
        };

        const enhancement = await enhanceTaskPrompts({
            tasks: normalisedPlan.tasks,
            projectContext: combinedProjectContext,
            model: args.enhancementModel,
            format: "markdown",
        });

        const enhancedPlan = {
            ...enhancement.plan,
            tasks: sanitizeTasksStatus(enhancement.plan.tasks),
        };

        const taskStates = buildTaskStates(
            enhancedPlan.tasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                progressPercent: task.progressPercent,
            })),
        );
        const totals = computeTotals(taskStates);

        const progressSummary = {
            sessionId,
            totals,
            tasks: taskStates,
        };

        const markdownContent =
            enhancedPlan.markdown ?? `# TODO Plan\n\nNo markdown content returned by the enhancement step.`;
        const markdownPath = await writeFileSafely(
            path.join(sessionDirectory, `${baseName}-tasks.md`),
            markdownContent,
        );

        const planPath = await writeJsonSafely(path.join(sessionDirectory, `${baseName}-plan.json`), enhancedPlan);
        const analysisPath = await writeJsonSafely(
            path.join(sessionDirectory, `${baseName}-analysis.json`),
            analysis,
        );

        const progressPath = await writeJsonSafely(
            path.join(sessionDirectory, `${baseName}-progress.json`),
            {
                sessionId,
                createdAt,
                prompt: args.prompt,
                summary: normalisedPlan.summary,
                sequencingPrinciple: normalisedPlan.sequencingPrinciple,
                totals,
                tasks: taskStates,
            },
        );

        const manifestPath = path.join(sessionDirectory, `${baseName}-manifest.json`);
        const statePath = resolveStatePath(baseDirectory);

        await updateStateManifest(statePath, {
            sessionId,
            prompt: args.prompt,
            createdAt,
            updatedAt: createdAt,
            totals,
            tasks: taskStates,
            files: {
                directory: sessionDirectory,
                markdown: markdownPath,
                plan: planPath,
                analysis: analysisPath,
                progress: progressPath,
                manifest: manifestPath,
                state: statePath,
                projectBase: projectBasePath,
            },
        });

        await writeJsonSafely(manifestPath, {
            sessionId,
            createdAt,
            prompt: args.prompt,
            projectContext: combinedProjectContext,
            projectType: args.projectType,
            summary: normalisedPlan.summary,
            sequencingPrinciple: normalisedPlan.sequencingPrinciple,
            totals,
            projectBase: {
                path: projectBasePath,
                context: baseContext,
            },
            files: {
                directory: sessionDirectory,
                markdown: markdownPath,
                plan: planPath,
                analysis: analysisPath,
                progress: progressPath,
                state: statePath,
                projectBase: projectBasePath,
            },
        });

        const result = orchestrationResultSchema.parse({
            sessionId,
            createdAt,
            analysis,
            plan: normalisedPlan,
            enhancement: {
                ...enhancedPlan,
                markdownPath,
            },
            progress: progressSummary,
            files: {
                directory: sessionDirectory,
                markdown: markdownPath,
                plan: planPath,
                analysis: analysisPath,
                progress: progressPath,
                manifest: manifestPath,
                state: statePath,
                projectBase: projectBasePath,
            },
            projectContext: combinedProjectContext,
        });

        return JSON.stringify(result, null, 2);
    },
});
