import { z } from "zod";

export const DEFAULT_STRUCTURE_FILE_NAME = "project-structure.json";

export const projectOverviewInputSchema = z.object({
    rootDirectory: z
        .string()
        .default(".")
        .describe("Root directory of the project to analyze."),
    outputDirectory: z
        .string()
        .default(".orka")
        .describe("Directory where the generated project structure file will be written."),
    structureFileName: z
        .string()
        .default(DEFAULT_STRUCTURE_FILE_NAME)
        .describe("Filename (without directory) for the project structure artifact."),
    maxDepth: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3)
        .describe("Maximum directory depth to include in the structure tree."),
    maxEntriesPerDirectory: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(60)
        .describe("Maximum number of entries to record per directory (helps avoid huge trees)."),
    includeHidden: z
        .boolean()
        .default(false)
        .describe("Whether to include dotfiles and dot-directories (e.g. .git, .vscode)."),
    ignore: z
        .array(z.string())
        .optional()
        .describe("Additional directory or file names to exclude from the structure."),
    projectDescription: z
        .string()
        .optional()
        .describe("Optional description for the project base when package metadata is absent."),
    manualTechStack: z
        .array(z.string())
        .optional()
        .describe("Manual tech stack entries to include when auto-detection finds nothing."),
    manualLanguages: z
        .array(z.string())
        .optional()
        .describe("Manual language hints (e.g. TypeScript, React) when files don't yet exist."),
});

export type ProjectOverviewInput = z.infer<typeof projectOverviewInputSchema>;
