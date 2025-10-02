import {
    planInputSchema,
    planSchema,
    type PlanInput,
    type Plan,
} from "../schemas/planning.js";
import type { McpToolDefinition } from "../types.js";
import { getLanguageModel } from "../../core/llm/modelRegistry.js";
import { parseJson } from "../../core/utils/json.js";

const SYSTEM_PROMPT = `You are a staff-level tech lead who decomposes feature requests into sequenced engineering tasks for agentic execution. Respond only with JSON.`;

const renderAnalysis = (input: PlanInput): string => {
    if (!input.analysis) {
        return "No prior analysis provided. Infer reasonable assumptions and list questions where needed.";
    }

    const {
        overallGoal,
        projectPattern,
        recommendedStack,
        keyModules,
        constraints,
        acceptanceCriteria,
        risks,
        openQuestions,
    } = input.analysis;

    const lines: string[] = [
        `Overall goal: ${overallGoal}`,
        `Suggested pattern: ${projectPattern}`,
        `Recommended stack: ${recommendedStack.join(", ") || "(none)"}`,
        keyModules.length > 0
            ? `Key modules:\n${keyModules
                  .map((module, index) => `${index + 1}. ${module.name} - ${module.description}`)
                  .join("\n")}`
            : "Key modules: (none)",
        constraints.length > 0
            ? `Constraints:\n${constraints.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
            : "Constraints: (none)",
        acceptanceCriteria.length > 0
            ? `Acceptance criteria:\n${acceptanceCriteria
                  .map((item, index) => `${index + 1}. ${item}`)
                  .join("\n")}`
            : "Acceptance criteria: (none)",
        risks.length > 0 ? `Risks:\n${risks.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "Risks: (none)",
        openQuestions.length > 0
            ? `Open questions:\n${openQuestions
                  .map((item, index) => `${index + 1}. ${item}`)
                  .join("\n")}`
            : "Open questions: (none)",
    ];

    return lines.join("\n");
};

const buildPrompt = (input: PlanInput): string => {
    const taskLimit = input.maxTasks ?? 8;

    return `Developer prompt:\n"""${input.prompt}"""\n\n${renderAnalysis(input)}\n\nProduce a delivery plan as JSON with this exact structure:\n{\n  "summary": string,\n  "sequencingPrinciple": string,\n  "tasks": [\n    {\n      "id": string (format TASK-<number>),\n      "title": string,\n      "description": string,\n      "rationale": string,\n      "dependencies": string[],\n      "acceptanceCriteria": string[],\n      "deliverables": string[],\n      "basePrompt": string (precise instruction for a coding agent, include tech stack, file hints),\n      "status": "pending" | "in_progress" | "done",\n      "progressPercent": number\n    }\n  ],\n  "notes": string[]\n}\n\nConstraints:\n- Maximum ${taskLimit} tasks. If more are needed, group logically.\n- Tasks must be ordered so dependencies reference previous ids only.\n- Ensure each basePrompt is actionable and self-contained for an autonomous coding agent.\n- Include at least one acceptance criteria per task.\n- Set the status field to "pending" for every task.\n- Set progressPercent to 0 for every task.`;
};

export const generatePlanForInput = async (args: PlanInput): Promise<Plan> => {
    const model = getLanguageModel();

    const response = await model.complete({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(args),
        model: args.model,
        temperature: 0.3,
        maxTokens: 1800,
        responseFormat: "json",
    });

    const draft = parseJson<Plan>(response);
    return planSchema.parse(draft);
};

export const createPlanGenerationTool = (): McpToolDefinition => ({
    name: "generatePlan",
    description:
        "Transform the developer prompt plus analysis into an ordered plan of tasks with actionable agent prompts.",
    parameters: planInputSchema,
    execute: async (rawArgs) => {
        const args = planInputSchema.parse(rawArgs);
        const plan = await generatePlanForInput(args);
        return JSON.stringify(plan, null, 2);
    },
});
