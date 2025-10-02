export interface LanguageModelRequest {
    prompt: string;
    system?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json" | "text";
}

export interface LanguageModel {
    complete(request: LanguageModelRequest): Promise<string>;
}
