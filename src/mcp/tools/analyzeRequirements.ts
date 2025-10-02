import { analysisInputSchema, requirementAnalysisSchema } from "../schemas/analysis.js";
import type { AnalysisInput } from "../schemas/analysis.js";
import { getLanguageModel } from "../../core/llm/modelRegistry.js";
import { parseJson } from "../../core/utils/json.js";
import type { RequirementAnalysis } from "../schemas/analysis.js";
import type { McpToolDefinition } from "../types.js";

const SYSTEM_PROMPT = `You are a senior product/engineering analyst who transforms natural language feature requests into structured requirements for agentic execution. Respond only with JSON.`;

const buildPrompt = ({ prompt, projectContext, projectType }: AnalysisInput): string => {
    const contextLines: string[] = [];

    if (projectType) {
        contextLines.push(`Project type: ${projectType}`);
    }

    if (projectContext) {
        contextLines.push(`Project context: ${projectContext}`);
    }

    const contextBlock = contextLines.length > 0 ? `Additional context:\n${contextLines.join("\n")}\n\n` : "";

    return `Developer request:\n"""${prompt}"""\n\n${contextBlock}Return JSON with the following shape:\n{\n  "overallGoal": string,\n  "userSegments": string[],\n  "projectPattern": string,\n  "recommendedStack": string[],\n  "keyModules": [{ "name": string, "description": string }],\n  "dataContracts": [{ "name": string, "fields": string[] }],\n  "constraints": string[],\n  "acceptanceCriteria": string[],\n  "risks": string[],\n  "openQuestions": string[]\n}\n\nRules:\n- Provide concise but specific items.\n- Do not invent technologies that contradict the context.\n- Include at least one acceptance criteria.\n- If information is missing, add a clarifying question in openQuestions.`;
};

export const analyzeRequirements = async (
    args: AnalysisInput,
): Promise<RequirementAnalysis> => {
    const model = getLanguageModel();
    const response = await model.complete({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(args),
        model: args.model,
        temperature: 0.2,
        maxTokens: 1200,
        responseFormat: "json",
    });

    const parsed = parseJson<RequirementAnalysis>(response);
    return requirementAnalysisSchema.parse(parsed);
};

export const createRequirementAnalysisTool = (): McpToolDefinition => ({
    name: "analyzeRequirements",
    description:
        "Analyze a natural-language developer prompt and return structured requirements (goal, pattern, modules, constraints).",
    parameters: analysisInputSchema,
    execute: async (rawArgs) => {
        const args = analysisInputSchema.parse(rawArgs);
        const result = await analyzeRequirements(args);
        return JSON.stringify(result, null, 2);
    },
});
