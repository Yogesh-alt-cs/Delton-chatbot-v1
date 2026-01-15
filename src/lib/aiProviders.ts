// AI Provider configuration - Llama 4 Scout via GitHub AI Models only

export type AIProvider = 'llama';

export type TaskType = 'text' | 'vision' | 'reasoning' | 'document' | 'search';

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  capabilities: TaskType[];
  icon: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'llama',
    name: 'Llama 4 Scout',
    description: 'Meta Llama 4 Scout 17B 16E Instruct - multimodal AI with vision, reasoning, and long context',
    capabilities: ['text', 'vision', 'reasoning', 'document', 'search'],
    icon: '🦙',
  },
];

// Model configuration - single model for all tasks
export const LLAMA_MODEL = 'meta/llama-4-scout-17b-16e-instruct';

// Model selection for different task types (all use Llama 4 Scout)
export const TASK_MODELS: Record<TaskType, string> = {
  vision: LLAMA_MODEL,
  reasoning: LLAMA_MODEL,
  document: LLAMA_MODEL,
  search: LLAMA_MODEL,
  text: LLAMA_MODEL,
};

// Detect task type from message content
export function detectTaskType(content: string, hasImages: boolean): TaskType {
  if (hasImages) return 'vision';
  
  const lowerContent = content.toLowerCase();
  
  // Reasoning patterns
  const reasoningPatterns = [
    'solve', 'calculate', 'prove', 'derive', 'explain step',
    'math', 'physics', 'code', 'algorithm', 'debug',
    'why does', 'how does', 'analyze', 'evaluate',
  ];
  if (reasoningPatterns.some(p => lowerContent.includes(p))) return 'reasoning';
  
  // Document context
  if (lowerContent.includes('[document content]')) return 'document';
  
  // Search context
  if (lowerContent.includes('[live search results]')) return 'search';
  
  return 'text';
}

export function getModelForTask(_task: TaskType): string {
  return LLAMA_MODEL;
}

export function getProviderForTask(_task: TaskType): AIProvider {
  return 'llama'; // Always use Llama 4 Scout
}
