import { z } from "zod";

import { requirementAnalysisSchema } from "./analysis.js";

export const planTaskSchema = z.object({
    id: z
        .string()
        .describe("Unique task identifier, for example TASK-1."),
    title: z.string().describe("Concise title for the task."),
    description: z
        .string()
        .describe("Detailed description of the work required."),
    rationale: z
        .string()
        .describe("Why the task exists or the value it delivers."),
    dependencies: z
        .array(z.string())
        .default([])
        .describe("IDs of tasks that must be completed beforehand."),
    acceptanceCriteria: z
        .array(z.string())
        .default([])
        .describe("Acceptance criteria for the task."),
    deliverables: z
        .array(z.string())
        .default([])
        .describe("Expected deliverables (files, endpoints, documentation, etc.)."),
    basePrompt: z
        .string()
        .describe("Base prompt describing the task for a coding agent."),
    status: z
        .enum(["pending", "in_progress", "done"])
        .default("pending")
        .describe("Current execution status of the task."),
    progressPercent: z
        .number()
        .min(0)
        .max(100)
        .default(0)
        .describe("Percent completion for the task."),
});

export const planSchema = z.object({
    summary: z.string().describe("High-level summary of the overall plan."),
    sequencingPrinciple: z
        .string()
        .describe("Explanation of how tasks are ordered or prioritized."),
    tasks: z.array(planTaskSchema).describe("Detailed task list."),
    notes: z.array(z.string()).default([]).describe("Additional notes."),
});

export type PlanTask = z.infer<typeof planTaskSchema>;
export type Plan = z.infer<typeof planSchema>;

export const planInputSchema = z.object({
    prompt: z.string().describe("Original natural-language prompt from the developer."),
    analysis: requirementAnalysisSchema.optional().describe("Structured analysis result, when already available."),
    model: z.string().optional().describe("Specific model to use for planning."),
    maxTasks: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("Maximum number of tasks to produce."),
});

export type PlanInput = z.infer<typeof planInputSchema>;
