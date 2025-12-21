/**
 * LLM Provider Abstraction
 * Supports OpenAI (default), with easy extension for Anthropic/Gemini
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMProvider {
    name: string;
    chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

// OpenAI Provider
export class OpenAIProvider implements LLMProvider {
    name = 'openai';
    private apiKey: string;
    private baseUrl = 'https://api.openai.com/v1';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is required');
        }
    }

    async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
        const model = options.model || 'gpt-4o-mini';
        const temperature = options.temperature ?? 0.7;
        const maxTokens = options.maxTokens || 2048;

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json();

        return {
            content: data.choices[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }
}

// Factory function to get provider
export function getProvider(providerName?: string): LLMProvider {
    const name = providerName || process.env.LLM_PROVIDER || 'openai';

    switch (name.toLowerCase()) {
        case 'openai':
            return new OpenAIProvider();
        // Future: Add Anthropic, Gemini here
        // case 'anthropic':
        //   return new AnthropicProvider();
        // case 'gemini':
        //   return new GeminiProvider();
        default:
            throw new Error(`Unknown LLM provider: ${name}`);
    }
}

// Helper to parse JSON from LLM response (handles markdown code blocks)
export function parseJsonResponse<T>(content: string): T {
    // Remove markdown code blocks if present
    let cleanContent = content.trim();

    // Handle ```json ... ``` blocks
    const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
        cleanContent = jsonBlockMatch[1].trim();
    }

    try {
        return JSON.parse(cleanContent) as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}\nContent: ${cleanContent.substring(0, 500)}`);
    }
}
