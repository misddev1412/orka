import { OpenAiLanguageModel } from "../../config/openai.js";
import type { LanguageModel } from "./languageModel.js";

let cachedModel: LanguageModel | undefined;

const LLM_PROVIDER = process.env.LLM_PROVIDER?.toLowerCase() ?? "openai";

export const getLanguageModel = (): LanguageModel => {
    if (!cachedModel) {
        switch (LLM_PROVIDER) {
            case "openai":
                cachedModel = new OpenAiLanguageModel();
                break;
            default:
                throw new Error(`Unsupported language model provider: ${LLM_PROVIDER}`);
        }
    }

    return cachedModel;
};
