export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  archived_at?: string | null;
  expires_at?: string | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  message_id: string;
  user_id: string;
  type: 'like' | 'dislike';
  created_at: string;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}
