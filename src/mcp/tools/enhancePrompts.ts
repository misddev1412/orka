import {
    promptEnhancementInputSchema,
    enhancedPlanSchema,
    type PromptEnhancementInput,
    type EnhancedPlan,
    type EnhancedPlanTask,
} from "../schemas/promptEnhancement.js";
import type { McpToolDefinition } from "../types.js";
import { getLanguageModel } from "../../core/llm/modelRegistry.js";
import { parseJson } from "../../core/utils/json.js";
import { writeFileSafely } from "../../core/utils/fs.js";

const SYSTEM_PROMPT = `You are a prompt engineer who prepares highly detailed, context-rich instructions for autonomous coding agents. Respond only with JSON.`;

const renderTasks = (tasks: PromptEnhancementInput["tasks"]): string =>
    tasks
        .map((task) => {
            const details = [
                `Title: ${task.title}`,
                `Description: ${task.description}`,
                `Rationale: ${task.rationale}`,
                `Dependencies: ${task.dependencies.join(", ") || "none"}`,
                `Acceptance criteria: ${task.acceptanceCriteria.join(" | ") || "none"}`,
                `Deliverables: ${task.deliverables.join(" | ") || "none"}`,
                `Current basePrompt: ${task.basePrompt}`,
            ];

            return `Task ${task.id}:\n${details.join("\n")}`;
        })
        .join("\n\n");

const buildPrompt = (input: PromptEnhancementInput): string => {
    const contextSection = input.projectContext
        ? `Project context:\n${input.projectContext}\n\n`
        : "Project context: none provided.\n\n";

    return `${contextSection}Tasks to enhance:\n\n${renderTasks(input.tasks)}\n\nReturn JSON with structure:\n{\n  "tasks": [\n    {\n      "id": string,\n      "title": string,\n      "description": string,\n      "rationale": string,\n      "dependencies": string[],\n      "acceptanceCriteria": string[],\n      "deliverables": string[],\n      "basePrompt": string,\n      "enhancedPrompt": string (final instruction ready for coding agent)\n    }\n  ]\n}\n\nRules:\n- Preserve all original fields but improve enhancedPrompt only.\n- Enhanced prompt must be actionable, specify framework, language, file targets, architectural pattern, and acceptance criteria summary.\n- Keep instructions concise but complete.\n- Include non-functional expectations (testing, accessibility, performance) when relevant.`;
};

export const buildMarkdown = (tasks: EnhancedPlanTask[], context?: string): string => {
    const header = ["# TODO Plan", context ? `> Context: ${context}` : undefined]
        .filter(Boolean)
        .join("\n\n");

    const body = tasks
        .map((task) => {
            const status = task.status ?? "pending";
            const progress = task.progressPercent ?? 0;
            const sections = [
                `## ${task.id} - ${task.title}`,
                `- Status: ${status}`,
                `- Progress: ${progress.toFixed(1)}%`,
                task.description,
                `**Rationale:** ${task.rationale}`,
                task.dependencies.length > 0 ? `**Dependencies:** ${task.dependencies.join(", ")}` : undefined,
                task.acceptanceCriteria.length > 0
                    ? `**Acceptance Criteria:**\n${task.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`
                    : undefined,
                task.deliverables.length > 0
                    ? `**Deliverables:**\n${task.deliverables.map((item) => `- ${item}`).join("\n")}`
                    : undefined,
                "**Agent Prompt:**",
                "```",
                task.enhancedPrompt,
                "```",
            ].filter(Boolean);

            return sections.join("\n\n");
        })
        .join("\n\n");

    return `${header}\n\n${body}`;
};

export interface PromptEnhancementResult {
    plan: EnhancedPlan;
    markdownPath?: string;
    exportError?: string;
}

export const enhanceTaskPrompts = async (
    args: PromptEnhancementInput,
): Promise<PromptEnhancementResult> => {
    const model = getLanguageModel();

    const response = await model.complete({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(args),
        model: args.model,
        temperature: 0.25,
        maxTokens: 2200,
        responseFormat: "json",
    });

    const parsed = parseJson<EnhancedPlan>(response);
    const enhancedPlan = enhancedPlanSchema.parse(parsed);

    if (args.format === "markdown") {
        const markdown = buildMarkdown(enhancedPlan.tasks, args.projectContext);
        const result: PromptEnhancementResult = {
            plan: {
                ...enhancedPlan,
                markdown,
            },
        };

        if (args.outputPath) {
            try {
                const markdownPath = await writeFileSafely(args.outputPath, markdown);
                result.markdownPath = markdownPath;
            } catch (error) {
                result.exportError = error instanceof Error ? error.message : "Failed to write markdown file";
            }
        }

        return result;
    }

    return { plan: enhancedPlan };
};

export const createPromptEnhancementTool = (): McpToolDefinition => ({
    name: "enhanceTaskPrompts",
    description:
        "Refine each task prompt so coding agents can execute immediately, optionally returning a Markdown checklist.",
    parameters: promptEnhancementInputSchema,
    execute: async (rawArgs) => {
        const args = promptEnhancementInputSchema.parse(rawArgs);
        const result = await enhanceTaskPrompts(args);
        return JSON.stringify(result, null, 2);
    },
});
