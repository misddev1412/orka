import { z } from "zod";

import { planTaskSchema } from "./planning.js";

export const promptEnhancementInputSchema = z.object({
    tasks: z
        .array(
            planTaskSchema.extend({
                enhancedPrompt: z.string().optional(),
            })
        )
        .min(1)
        .describe("List of tasks that need prompt enhancement."),
    projectContext: z
        .string()
        .optional()
        .describe("Shared context to weave into each prompt."),
    model: z.string().optional().describe("Specific model to use when refining prompts."),
    format: z
        .enum(["markdown", "json"])
        .default("markdown")
        .describe("Desired output format."),
    outputPath: z
        .string()
        .optional()
        .describe(
            "Optional file path for exporting the Markdown checklist. Relative paths resolve from process.cwd().",
        ),
});

export type PromptEnhancementInput = z.infer<typeof promptEnhancementInputSchema>;

export const enhancedPlanTaskSchema = planTaskSchema.extend({
    enhancedPrompt: z.string().describe("Prompt optimized for the coding agent."),
    progressPercent: z.number().min(0).max(100).default(0),
});

export type EnhancedPlanTask = z.infer<typeof enhancedPlanTaskSchema>;

export const enhancedPlanSchema = z.object({
    tasks: z.array(enhancedPlanTaskSchema),
    markdown: z.string().optional(),
});

export type EnhancedPlan = z.infer<typeof enhancedPlanSchema>;
