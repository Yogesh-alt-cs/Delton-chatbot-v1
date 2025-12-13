import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Trash2, ChevronRight, Share2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useConversations } from '@/hooks/useConversations';
import { useShareConversation } from '@/hooks/useShareConversation';
import { useToast } from '@/hooks/use-toast';
import { groupConversationsByDate, formatConversationDate } from '@/lib/dateUtils';
import { Conversation } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function History() {
  const navigate = useNavigate();
  const { conversations, isLoading, searchConversations, deleteConversation } = useConversations();
  const { shareConversation } = useShareConversation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchConversations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchConversations]);

  const displayConversations = searchResults ?? conversations;
  const groupedConversations = useMemo(
    () => groupConversationsByDate(displayConversations),
    [displayConversations]
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    
    const success = await deleteConversation(deleteId);
    if (success) {
      toast({ title: 'Conversation deleted' });
      // Clear from search results too
      if (searchResults) {
        setSearchResults(prev => prev?.filter(c => c.id !== deleteId) ?? null);
      }
    } else {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete conversation',
        variant: 'destructive' 
      });
    }
    setDeleteId(null);
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="border-b border-border p-4 safe-top">
          <h1 className="mb-4 text-xl font-bold">History</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="h-10 rounded-xl pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Your chat history will appear here once you start a conversation'
                }
              </p>
            </div>
          ) : (
            <div className="pb-4">
              {groupedConversations.map((group) => (
                <div key={group.label}>
                  {/* Date Group Header */}
                  <div className="sticky top-0 z-10 bg-background/95 px-4 py-2 backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h3>
                  </div>

                  {/* Conversations in Group */}
                  <div className="divide-y divide-border">
                    {group.conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <button
                          className="flex flex-1 items-center gap-3 text-left"
                          onClick={() => navigate(`/chat/${conv.id}`)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{conv.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatConversationDate(conv.updated_at)}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary"
                          onClick={() => shareConversation(conv.id, conv.title)}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(conv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                conversation and all its messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
