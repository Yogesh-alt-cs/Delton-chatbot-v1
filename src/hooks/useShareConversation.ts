import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message } from '@/lib/types';

export function useShareConversation() {
  const shareConversation = useCallback(async (
    conversationId: string,
    title: string
  ) => {
    try {
      // Fetch messages for the conversation
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Format the conversation as text
      const formattedText = formatConversation(title, messages as Message[]);

      // Check if Web Share API is supported
      if (navigator.share) {
        await navigator.share({
          title: `Delton Chat: ${title}`,
          text: formattedText,
        });
        toast.success('Conversation shared!');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(formattedText);
        toast.success('Conversation copied to clipboard!');
      }
      
      return true;
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing conversation:', error);
        toast.error('Failed to share conversation');
      }
      return false;
    }
  }, []);

  const shareMessage = useCallback(async (content: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Delton Chat Response',
          text: content,
        });
        toast.success('Message shared!');
      } else {
        await navigator.clipboard.writeText(content);
        toast.success('Message copied to clipboard!');
      }
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing message:', error);
        toast.error('Failed to share message');
      }
      return false;
    }
  }, []);

  return {
    shareConversation,
    shareMessage,
  };
}

function formatConversation(title: string, messages: Message[]): string {
  const header = `📱 Delton Chat: ${title}\n${'─'.repeat(40)}\n\n`;
  
  const formattedMessages = messages.map((msg) => {
    const role = msg.role === 'user' ? '👤 You' : '🤖 Delton';
    return `${role}:\n${msg.content}\n`;
  }).join('\n');

  const footer = `\n${'─'.repeat(40)}\nShared from Delton Chatbot`;

  return header + formattedMessages + footer;
}
