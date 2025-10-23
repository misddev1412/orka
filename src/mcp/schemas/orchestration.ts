import { z } from "zod";

import { requirementAnalysisSchema } from "./analysis.js";
import { planSchema } from "./planning.js";
import { enhancedPlanSchema } from "./promptEnhancement.js";

const context7InsightSchema = z.object({
    projectPath: z.string(),
    projectTitle: z.string().optional(),
    topic: z.string(),
    content: z.string(),
    sourceUrl: z.string(),
    lastUpdate: z.string().optional(),
});

export const context7ResultSchema = z.object({
    insights: z.array(context7InsightSchema),
    warnings: z.array(z.string()),
});

export type Context7Result = z.infer<typeof context7ResultSchema>;

export const taskProgressSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["pending", "in_progress", "done"]),
    progressPercent: z.number().min(0).max(100).default(0),
});

export const progressSummarySchema = z.object({
    sessionId: z.string(),
    totals: z.object({
        total: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        done: z.number().int().nonnegative(),
        percentComplete: z.number().min(0).max(100),
    }),
    tasks: z.array(taskProgressSchema),
});

export type TaskProgress = z.infer<typeof taskProgressSchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

const fileReferenceSchema = z.object({
    directory: z.string(),
    markdown: z.string(),
    plan: z.string(),
    analysis: z.string(),
    progress: z.string(),
    manifest: z.string(),
    state: z.string().optional(),
    projectBase: z.string().optional(),
    context7: z.string().optional(),
});

export const sessionStateEntrySchema = z.object({
    sessionId: z.string(),
    prompt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    totals: progressSummarySchema.shape.totals,
    tasks: z.array(taskProgressSchema),
    files: fileReferenceSchema,
});

export const stateManifestSchema = z.object({
    sessions: z.array(sessionStateEntrySchema).default([]),
});

export type SessionStateEntry = z.infer<typeof sessionStateEntrySchema>;
export type StateManifest = z.infer<typeof stateManifestSchema>;

export const orchestrationInputSchema = z.object({
    prompt: z.string().describe("Developer request to transform into TODO tasks."),
    projectContext: z
        .string()
        .optional()
        .describe("Shared project context or architectural notes to inform all steps."),
    projectType: z
        .string()
        .optional()
        .describe("Project classification such as web app, backend service, design system."),
    maxTasks: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("Maximum number of tasks the plan should produce."),
    analysisModel: z
        .string()
        .optional()
        .describe("Model identifier for the analysis step."),
    planningModel: z
        .string()
        .optional()
        .describe("Model identifier for the planning step."),
    enhancementModel: z
        .string()
        .optional()
        .describe("Model identifier for the prompt enhancement step."),
    outputDirectory: z
        .string()
        .default(".orka")
        .describe("Directory (relative or absolute) where the artifacts for this prompt will be stored."),
    sessionName: z
        .string()
        .optional()
        .describe("Optional custom name for the session folder. Defaults to a slugged prompt plus timestamp."),
});

export type OrchestrationInput = z.infer<typeof orchestrationInputSchema>;

export const orchestrationResultSchema = z.object({
    sessionId: z.string(),
    createdAt: z.string(),
    analysis: requirementAnalysisSchema,
    plan: planSchema,
    enhancement: enhancedPlanSchema.extend({
        markdownPath: z.string().optional(),
        exportError: z.string().optional(),
    }),
    progress: progressSummarySchema,
    files: z.object({
        directory: z.string(),
        markdown: z.string(),
        plan: z.string(),
        analysis: z.string(),
        progress: z.string(),
        manifest: z.string(),
        state: z.string(),
        projectBase: z.string().optional(),
        context7: z.string().optional(),
    }),
    projectContext: z.string().optional(),
    context7: context7ResultSchema.optional(),
});

export type OrchestrationResult = z.infer<typeof orchestrationResultSchema>;
