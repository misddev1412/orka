import OpenAI from "openai";
import dotenv from "dotenv";

import type { LanguageModel, LanguageModelRequest } from "../core/llm/languageModel.js";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set. Language model requests will fail until a key is provided.");
}

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const DEFAULT_TEMPERATURE = Number.parseFloat(process.env.OPENAI_TEMPERATURE ?? "0.2");
const DEFAULT_MAX_TOKENS = Number.parseInt(process.env.OPENAI_MAX_TOKENS ?? "4000", 10);

export class OpenAiLanguageModel implements LanguageModel {
    private readonly client: OpenAI;

    constructor(client?: OpenAI) {
        if (client) {
            this.client = client;
            return;
        }

        const apiKey = OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error("OPENAI_API_KEY not set. Language model requests require an API key.");
        }

        this.client = new OpenAI({ apiKey });
    }

    public async complete({
        prompt,
        system,
        model,
        temperature,
        maxTokens,
        responseFormat,
    }: LanguageModelRequest): Promise<string> {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        if (system) {
            messages.push({ role: "system", content: system });
        }

        messages.push({ role: "user", content: prompt });

        const response = await this.client.chat.completions.create({
            model: model ?? DEFAULT_MODEL,
            messages,
            temperature: temperature ?? DEFAULT_TEMPERATURE,
            max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
            response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
        });

        const content = response.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("OpenAI returned an empty response.");
        }

        return content;
    }
}
