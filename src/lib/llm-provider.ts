import crypto from 'crypto';

export interface LLMRequest {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    provider: 'openrouter' | 'groq';
    responseFormat?: 'json_object';
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
    modelInfo: string;
}

export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
    const { systemPrompt, userPrompt, model, provider, responseFormat } = request;

    if (provider === 'groq') {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY is not configured in .env.local');

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(`Groq API Error: ${data.error?.message || JSON.stringify(data)}`);

        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0
            },
            modelInfo: `groq/${data.model}`
        };
    } else {
        // OpenRouter
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured in .env.local');

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'anthropic/claude-3.5-sonnet',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(`OpenRouter API Error: ${data.error?.message || JSON.stringify(data)}`);

        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0
            },
            modelInfo: `openrouter/${data.model}`
        };
    }
}

export function hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}
