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
import { fetchContext7Insights } from "../../core/context/context7.js";

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

        const techCandidates = [
            ...(projectBase.options?.manualTechStack ?? []),
            ...(projectBase.techStack ?? []),
            ...(projectBase.languages?.map((item) => item.language) ?? []),
        ];

        const context7Result = await fetchContext7Insights(techCandidates, args.prompt);

        const context7Summary = context7Result.insights
            .map((insight) => {
                const label = insight.projectTitle ?? insight.projectPath;
                const freshness = insight.lastUpdate ? ` (last updated ${insight.lastUpdate})` : "";
                return `Context7 • ${label}${freshness}:\n${insight.content}`;
            })
            .join("\n\n");

        if (context7Summary) {
            contextParts.push(context7Summary);
        }

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

        const context7Path = await writeJsonSafely(path.join(sessionDirectory, `${baseName}-context7.json`), {
            fetchedAt: new Date().toISOString(),
            prompt: args.prompt,
            techCandidates,
            insights: context7Result.insights,
            warnings: context7Result.warnings,
        });

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
                context7: context7Path,
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
            context7: {
                file: context7Path,
                insights: context7Result.insights,
                warnings: context7Result.warnings,
            },
            files: {
                directory: sessionDirectory,
                markdown: markdownPath,
                plan: planPath,
                analysis: analysisPath,
                progress: progressPath,
                state: statePath,
                projectBase: projectBasePath,
                context7: context7Path,
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
                context7: context7Path,
            },
            projectContext: combinedProjectContext,
            context7: context7Result,
        });

        return JSON.stringify(result, null, 2);
    },
});
