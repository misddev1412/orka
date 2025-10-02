import {
    componentPromptSchema,
    type ComponentPromptArgs,
} from "../schemas/componentPrompt.js";
import type { McpToolDefinition } from "../types.js";

/**
 * Creates the component prompt tool definition used by the MCP server.
 */
const toBulletedList = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

export const createComponentPromptTool = (): McpToolDefinition => ({
    name: "componentPrompt",
    description:
        "Generate a structured 'Component Prompt Formula' (Technique #1) for UI components.",
    parameters: componentPromptSchema,
    execute: async (rawArgs) => {
        const {
            componentName,
            framework,
            language,
            functionality,
            uiRequirements,
            technical,
            productionReady,
        }: ComponentPromptArgs = componentPromptSchema.parse(rawArgs);

        const prompt = `
Create a ${componentName} component in ${framework} with ${language}

Functionality:
${toBulletedList(functionality)}

UI Requirements:
${toBulletedList(uiRequirements)}

Technical:
${toBulletedList(technical)}

Make it production-ready${productionReady ? ` with ${productionReady}` : ""}.
`.trim();

        return prompt;
    },
});
