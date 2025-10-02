import { z } from "zod";

export const analysisInputSchema = z.object({
    prompt: z
        .string()
        .describe("Natural-language prompt describing the developer's need, e.g. 'create a React login page'."),
    projectContext: z
        .string()
        .optional()
        .describe("Additional details about current architecture, conventions, or related modules."),
    projectType: z
        .string()
        .optional()
        .describe("Project type (web app, backend service, design system, etc.)."),
    model: z.string().optional().describe("Specific model identifier to use for the analysis."),
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export const requirementAnalysisSchema = z.object({
    overallGoal: z
        .string()
        .describe("Summary of the primary objective."),
    userSegments: z
        .array(z.string())
        .default([])
        .describe("Key user or actor segments impacted."),
    projectPattern: z
        .string()
        .describe("Recommended architectural pattern based on the requirement and context."),
    recommendedStack: z
        .array(z.string())
        .default([])
        .describe("Core technologies that should be used."),
    keyModules: z
        .array(
            z.object({
                name: z.string(),
                description: z.string(),
            })
        )
        .default([])
        .describe("Primary modules or capabilities that must be built."),
    dataContracts: z
        .array(
            z.object({
                name: z.string(),
                fields: z.array(z.string()).default([]),
            })
        )
        .default([])
        .describe("Key entities or API payloads with notable fields."),
    constraints: z
        .array(z.string())
        .default([])
        .describe("Technical or business constraints to respect."),
    acceptanceCriteria: z
        .array(z.string())
        .default([])
        .describe("Acceptance criteria that confirm completion."),
    risks: z
        .array(z.string())
        .default([])
        .describe("Risks or items that require attention."),
    openQuestions: z
        .array(z.string())
        .default([])
        .describe("Unanswered questions or clarifications needed."),
});

export type RequirementAnalysis = z.infer<typeof requirementAnalysisSchema>;
