import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format as formatDate } from 'date-fns';

export function useExportData() {
  const { user } = useAuth();

  const exportConversations = async (exportFormat: 'txt' | 'json' = 'txt') => {
    if (!user) return;

    try {
      // Fetch all conversations with messages
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        toast.error('No conversations to export');
        return;
      }

      // Fetch messages for all conversations
      const conversationIds = conversations.map(c => c.id);
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      // Group messages by conversation
      const messagesByConv = (messages || []).reduce((acc, msg) => {
        if (!acc[msg.conversation_id]) acc[msg.conversation_id] = [];
        acc[msg.conversation_id].push(msg);
        return acc;
      }, {} as Record<string, typeof messages>);

      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'json') {
        const exportData = conversations.map(conv => ({
          title: conv.title,
          created_at: conv.created_at,
          messages: (messagesByConv[conv.id] || []).map(msg => ({
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at
          }))
        }));
        content = JSON.stringify(exportData, null, 2);
        filename = `delton-export-${formatDate(new Date(), 'yyyy-MM-dd')}.json`;
        mimeType = 'application/json';
      } else {
        const lines: string[] = [];
        lines.push('DELTON CHATBOT - CONVERSATION EXPORT');
        lines.push(`Exported on: ${formatDate(new Date(), 'PPpp')}`);
        lines.push('='.repeat(50));
        lines.push('');

        conversations.forEach(conv => {
          lines.push(`CONVERSATION: ${conv.title}`);
          lines.push(`Date: ${formatDate(new Date(conv.created_at), 'PPpp')}`);
          lines.push('-'.repeat(40));
          
          (messagesByConv[conv.id] || []).forEach(msg => {
            const role = msg.role === 'user' ? 'You' : 'Delton';
            lines.push(`[${role}]:`);
            lines.push(msg.content);
            lines.push('');
          });
          
          lines.push('='.repeat(50));
          lines.push('');
        });

        content = lines.join('\n');
        filename = `delton-export-${formatDate(new Date(), 'yyyy-MM-dd')}.txt`;
        mimeType = 'text/plain';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  return { exportConversations };
}
