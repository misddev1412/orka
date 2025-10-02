import { z } from "zod";

/**
 * Schema definition for the component prompt tool arguments.
 */
export const componentPromptSchema = z.object({
    componentName: z.string().describe("Component name, for example: TaskList."),
    framework: z.string().describe("Framework, for example: React."),
    language: z.string().default("TypeScript"),
    functionality: z
        .array(z.string())
        .describe("List of primary behaviors or features."),
    uiRequirements: z
        .array(z.string())
        .describe("UI requirements (responsiveness, styling, accessibility, etc.)."),
    technical: z
        .array(z.string())
        .describe("Technical requirements (types, performance, testing)."),
    productionReady: z
        .string()
        .optional()
        .describe("Additional production-readiness notes, if any."),
});

export type ComponentPromptArgs = z.infer<typeof componentPromptSchema>;
