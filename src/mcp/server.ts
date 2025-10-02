#!/usr/bin/env node
import { FastMCP } from "fastmcp";

import { createComponentPromptTool } from "./tools/componentPrompt.js";
import { createRequirementAnalysisTool } from "./tools/analyzeRequirements.js";
import { createPlanGenerationTool } from "./tools/generatePlan.js";
import { createPromptEnhancementTool } from "./tools/enhancePrompts.js";
import { createOrchestrationTool } from "./tools/orchestratePlan.js";
import { createTaskProgressUpdateTool } from "./tools/updateTaskProgress.js";

const server = new FastMCP({
    name: "orka",
    version: "0.1.0",
});

const tools = [
    createOrchestrationTool(),
    createRequirementAnalysisTool(),
    createPlanGenerationTool(),
    createPromptEnhancementTool(),
    createComponentPromptTool(),
    createTaskProgressUpdateTool(),
];

tools.forEach((tool) => server.addTool(tool));

server.start({ transportType: "stdio" });
