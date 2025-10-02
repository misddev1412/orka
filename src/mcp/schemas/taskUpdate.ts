import { z } from "zod";

export const taskStatusEnum = z.enum(["pending", "in_progress", "done"]);

export const taskUpdateInputSchema = z.object({
    sessionId: z.string().min(1, "sessionId is required"),
    taskId: z.string().min(1, "taskId is required"),
    status: taskStatusEnum.optional().describe("Updated status for the task."),
    progressPercent: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Updated completion percentage (0-100)."),
    note: z.string().optional().describe("Optional note to append to task description or manifest logs."),
    outputDirectory: z
        .string()
        .default(".orka")
        .describe("Directory containing Orka session artifacts (default .orka)."),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;

export const taskUpdateResultSchema = z.object({
    sessionId: z.string(),
    taskId: z.string(),
    status: taskStatusEnum,
    progressPercent: z.number().min(0).max(100),
    totals: z.object({
        total: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        done: z.number().int().nonnegative(),
        percentComplete: z.number().min(0).max(100),
    }),
    files: z.object({
        plan: z.string(),
        progress: z.string(),
        markdown: z.string(),
        manifest: z.string(),
        state: z.string(),
    }),
});

export type TaskUpdateResult = z.infer<typeof taskUpdateResultSchema>;
