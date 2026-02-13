import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { formatConversationDate } from '@/lib/dateUtils';
import { Conversation } from '@/lib/types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
}

export function ChatSidebar({ isOpen, onClose, onNewChat }: ChatSidebarProps) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { conversations, isLoading, deletingIds, deleteConversation, searchConversations } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchConversations(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchConversations]);

  const displayConversations = searchResults ?? conversations;

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2 h-10 text-sm"
            onClick={() => { onNewChat(); onClose(); }}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 lg:hidden ml-2"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="h-9 pl-8 text-sm rounded-lg bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayConversations.map((conv) => {
                const isActive = conv.id === conversationId;
                const isDeleting = deletingIds.has(conv.id);

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    disabled={isDeleting}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      isDeleting && "opacity-50"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{conv.title}</p>
                      <p className="truncate text-xs text-muted-foreground/70">
                        {formatConversationDate(conv.updated_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
