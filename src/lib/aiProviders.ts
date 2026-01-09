// AI Provider configuration and types

export type AIProvider = 'lovable' | 'openai' | 'gemini' | 'deepseek';

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
    id: 'lovable',
    name: 'Lovable AI',
    description: 'Default AI with Gemini 3 Pro',
    capabilities: ['text', 'vision', 'reasoning', 'document', 'search'],
    icon: '✨',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    description: 'Advanced reasoning and vision',
    capabilities: ['text', 'vision', 'reasoning', 'document'],
    icon: '🤖',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Multimodal AI with long context',
    capabilities: ['text', 'vision', 'reasoning', 'document', 'search'],
    icon: '🌟',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Specialized reasoning model',
    capabilities: ['text', 'reasoning'],
    icon: '🔍',
  },
];

// Model selection priorities for auto-select mode
export const TASK_PRIORITIES: Record<TaskType, AIProvider[]> = {
  vision: ['gemini', 'openai', 'lovable', 'deepseek'],
  reasoning: ['deepseek', 'gemini', 'lovable', 'openai'],
  document: ['gemini', 'lovable', 'openai', 'deepseek'],
  search: ['lovable', 'gemini', 'openai', 'deepseek'],
  text: ['lovable', 'gemini', 'deepseek', 'openai'],
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

export function getProviderForTask(task: TaskType): AIProvider {
  return TASK_PRIORITIES[task][0];
}
