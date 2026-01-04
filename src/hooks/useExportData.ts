import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format as formatDate } from 'date-fns';
import jsPDF from 'jspdf';

export function useExportData() {
  const { user } = useAuth();

  const fetchConversationsWithMessages = async () => {
    if (!user) return null;

    // Fetch all conversations with messages
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (convError) throw convError;

    if (!conversations || conversations.length === 0) {
      return null;
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

    return { conversations, messagesByConv };
  };

  const exportConversations = async (exportFormat: 'txt' | 'json' | 'pdf' = 'txt') => {
    if (!user) return;

    try {
      const data = await fetchConversationsWithMessages();
      
      if (!data) {
        toast.error('No conversations to export');
        return;
      }

      const { conversations, messagesByConv } = data;

      if (exportFormat === 'pdf') {
        await exportToPdf(conversations, messagesByConv);
        return;
      }

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

  const exportToPdf = async (
    conversations: any[], 
    messagesByConv: Record<string, any[]>
  ) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = margin;

    const addNewPageIfNeeded = (requiredHeight: number = 20) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    const addText = (text: string, fontSize: number, isBold: boolean = false) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize * 0.5;
      
      lines.forEach((line: string) => {
        addNewPageIfNeeded(lineHeight);
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
    };

    // Title
    pdf.setTextColor(37, 99, 235); // Primary blue
    addText('DELTON CHATBOT', 24, true);
    pdf.setTextColor(0, 0, 0);
    addText('Conversation Export', 14, false);
    yPosition += 5;
    addText(`Exported on: ${formatDate(new Date(), 'PPpp')}`, 10);
    yPosition += 10;

    // Conversations
    conversations.forEach((conv, index) => {
      if (index > 0) {
        addNewPageIfNeeded(40);
        yPosition += 10;
      }

      // Conversation title
      pdf.setTextColor(37, 99, 235);
      addText(conv.title, 14, true);
      pdf.setTextColor(100, 100, 100);
      addText(`Date: ${formatDate(new Date(conv.created_at), 'PPpp')}`, 9);
      pdf.setTextColor(0, 0, 0);
      yPosition += 5;

      // Messages
      const messages = messagesByConv[conv.id] || [];
      messages.forEach((msg) => {
        addNewPageIfNeeded(20);
        
        const role = msg.role === 'user' ? 'You' : 'Delton';
        const roleColor = msg.role === 'user' ? [100, 100, 100] : [37, 99, 235];
        
        pdf.setTextColor(roleColor[0], roleColor[1], roleColor[2]);
        addText(`[${role}]:`, 10, true);
        pdf.setTextColor(0, 0, 0);
        
        // Handle long message content
        const contentLines = msg.content.split('\n');
        contentLines.forEach((line: string) => {
          if (line.trim()) {
            addText(line, 10);
          } else {
            yPosition += 3;
          }
        });
        yPosition += 5;
      });

      // Separator line
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;
    });

    // Footer on last page
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      'Generated by Delton 2.0 - Created by Yogesh GR',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Save the PDF
    const filename = `delton-export-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(filename);
    toast.success('PDF exported successfully');
  };

  return { exportConversations };
}
