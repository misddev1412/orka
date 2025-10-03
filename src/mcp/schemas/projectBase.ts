import { z } from "zod";

const languageSummarySchema = z.object({
    language: z.string(),
    count: z.number(),
});

const directorySummarySchema = z.object({
    name: z.string(),
    path: z.string(),
    truncated: z.boolean().optional(),
});

const scriptSummarySchema = z.object({
    name: z.string(),
    command: z.string(),
});

const structureNodeSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        name: z.string(),
        path: z.string(),
        type: z.enum(["directory", "file", "symlink"]),
        extension: z.string().optional(),
        truncated: z.boolean().optional(),
        children: z.array(structureNodeSchema).optional(),
    }),
);

export const projectBaseSchema = z.object({
    generatedAt: z.string().optional(),
    rootDirectory: z.string(),
    projectName: z.string().optional(),
    description: z.string().optional(),
    packageManager: z.string().optional(),
    languages: z.array(languageSummarySchema).optional(),
    techStack: z.array(z.string()).optional(),
    primaryDirectories: z.array(directorySummarySchema).optional(),
    componentDirectories: z.array(z.string()).optional(),
    entityDirectories: z.array(z.string()).optional(),
    notableFiles: z.array(z.string()).optional(),
    scripts: z.array(scriptSummarySchema).optional(),
    options: z
        .object({
            maxDepth: z.number().optional(),
            maxEntriesPerDirectory: z.number().optional(),
            includeHidden: z.boolean().optional(),
            ignore: z.array(z.string()).optional(),
            manualTechStack: z.array(z.string()).optional(),
            manualLanguages: z.array(z.string()).optional(),
            projectDescription: z.string().optional(),
        })
        .optional(),
    tree: structureNodeSchema.optional(),
    warnings: z.array(z.string()).optional(),
});

export type ProjectBase = z.infer<typeof projectBaseSchema>;
export type ProjectBaseLanguage = z.infer<typeof languageSummarySchema>;
export type ProjectBaseDirectory = z.infer<typeof directorySummarySchema>;
export type ProjectBaseScript = z.infer<typeof scriptSummarySchema>;
