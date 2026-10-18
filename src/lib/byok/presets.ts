/** Reasoning providers a person can bring their own key for. All speak the OpenAI chat-completions dialect. */
export type ProviderId = 'default' | 'groq' | 'mistral' | 'openai' | 'custom';

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  model: string;
  keyUrl: string;
}

export const PRESETS: Record<'groq' | 'mistral' | 'openai', ProviderPreset> = {
  groq: { label: 'GPT-OSS on Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', keyUrl: 'https://console.groq.com/keys' },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
};
