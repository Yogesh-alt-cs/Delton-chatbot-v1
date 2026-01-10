// AI Provider configuration - Simplified to Google Gemini only

export type AIProvider = 'gemini';

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
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Multimodal AI with vision, reasoning, and long context',
    capabilities: ['text', 'vision', 'reasoning', 'document', 'search'],
    icon: '✨',
  },
];

// Model selection for different task types
export const TASK_MODELS: Record<TaskType, string> = {
  vision: 'gemini-2.0-flash',
  reasoning: 'gemini-2.5-pro-preview-06-05',
  document: 'gemini-2.5-pro-preview-06-05',
  search: 'gemini-2.0-flash',
  text: 'gemini-2.0-flash',
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

export function getModelForTask(task: TaskType): string {
  return TASK_MODELS[task];
}

export function getProviderForTask(_task: TaskType): AIProvider {
  return 'gemini'; // Always use Gemini
}
