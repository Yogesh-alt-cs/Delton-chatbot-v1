import { Conversation, ConversationGroup } from '@/lib/types';
import { isToday, isYesterday, isThisWeek, isThisMonth, format } from 'date-fns';

export function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Older': [],
  };

  conversations.forEach((conv) => {
    const date = new Date(conv.updated_at);

    if (isToday(date)) {
      groups['Today'].push(conv);
    } else if (isYesterday(date)) {
      groups['Yesterday'].push(conv);
    } else if (isThisWeek(date)) {
      groups['This Week'].push(conv);
    } else if (isThisMonth(date)) {
      groups['This Month'].push(conv);
    } else {
      groups['Older'].push(conv);
    }
  });

  // Filter out empty groups and convert to array
  return Object.entries(groups)
    .filter(([, convs]) => convs.length > 0)
    .map(([label, conversations]) => ({ label, conversations }));
}

export function formatConversationDate(dateString: string): string {
  const date = new Date(dateString);

  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else if (isThisWeek(date)) {
    return format(date, 'EEEE');
  } else if (isThisMonth(date)) {
    return format(date, 'MMM d');
  } else {
    return format(date, 'MMM d, yyyy');
  }
}
