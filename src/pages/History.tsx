import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Trash2, ChevronRight, Share2, Archive, ArchiveRestore, Clock, Timer, FileType, MessageCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useConversations } from '@/hooks/useConversations';
import { useShareConversation } from '@/hooks/useShareConversation';
import { useExportData } from '@/hooks/useExportData';
import { useToast } from '@/hooks/use-toast';
import { groupConversationsByDate, formatConversationDate } from '@/lib/dateUtils';
import { Conversation } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function History() {
  const navigate = useNavigate();
  const { 
    conversations, 
    archivedConversations, 
    isLoading,
    deletingIds,
    error,
    loadConversations,
    searchConversations, 
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    setConversationExpiry,
  } = useConversations();
  const { shareConversation } = useShareConversation();
  const { exportSingleConversation } = useExportData();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const displayConversations = activeTab === 'active' 
    ? (searchResults ?? conversations)
    : archivedConversations;
    
  const groupedConversations = useMemo(
    () => groupConversationsByDate(displayConversations),
    [displayConversations]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadConversations();
    setIsRefreshing(false);
    toast({ title: 'History refreshed' });
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    
    setIsDeleting(true);
    const success = await deleteConversation(deleteId);
    
    if (success) {
      toast({ title: 'Conversation deleted' });
      if (searchResults) {
        setSearchResults(prev => prev?.filter(c => c.id !== deleteId) ?? null);
      }
    } else {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete conversation. Please try again.',
        variant: 'destructive' 
      });
    }
    
    setIsDeleting(false);
    setDeleteId(null);
  };

  const handleChatAgain = (conv: Conversation) => {
    // Navigate to the existing conversation to continue chatting
    navigate(`/chat/${conv.id}`);
  };

  const handleArchive = async (id: string) => {
    const success = await archiveConversation(id);
    if (success) {
      toast({ title: 'Conversation archived' });
      if (searchResults) {
        setSearchResults(prev => prev?.filter(c => c.id !== id) ?? null);
      }
    } else {
      toast({ 
        title: 'Error', 
        description: 'Failed to archive conversation',
        variant: 'destructive' 
      });
    }
  };

  const handleUnarchive = async (id: string) => {
    const success = await unarchiveConversation(id);
    if (success) {
      toast({ title: 'Conversation restored' });
    } else {
      toast({ 
        title: 'Error', 
        description: 'Failed to restore conversation',
        variant: 'destructive' 
      });
    }
  };

  const handleSetExpiry = async (id: string, hours: number | null) => {
    const expiresAt = hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
    const success = await setConversationExpiry(id, expiresAt);
    if (success) {
      toast({ 
        title: hours ? `Messages will disappear in ${hours}h` : 'Disappearing messages disabled' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: 'Failed to set message expiry',
        variant: 'destructive' 
      });
    }
  };

  const renderConversationItem = (conv: Conversation, isArchived: boolean) => {
    const isBeingDeleted = deletingIds.has(conv.id);
    
    return (
      <div
        key={conv.id}
        className={`flex items-center gap-2 px-4 py-3 transition-all hover:bg-muted/50 ${
          isBeingDeleted ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <button
          className="flex flex-1 items-center gap-3 text-left min-w-0"
          onClick={() => navigate(`/chat/${conv.id}`)}
          disabled={isBeingDeleted}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{conv.title}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {formatConversationDate(conv.updated_at)}
              </p>
              {conv.expires_at && (
                <span className="flex items-center gap-1 text-xs text-orange-500">
                  <Timer className="h-3 w-3" />
                  Expires
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
        
        <TooltipProvider delayDuration={300}>
          {/* Chat Again Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                onClick={() => handleChatAgain(conv)}
                disabled={isBeingDeleted}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Continue this chat</TooltipContent>
          </Tooltip>
          
          {!isArchived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                  disabled={isBeingDeleted}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 1)}>
                  Disappear in 1 hour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 24)}>
                  Disappear in 24 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 168)}>
                  Disappear in 7 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, null)}>
                  Don't disappear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                onClick={() => exportSingleConversation(conv.id, 'pdf')}
                disabled={isBeingDeleted}
              >
                <FileType className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export as PDF</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                onClick={() => shareConversation(conv.id, conv.title)}
                disabled={isBeingDeleted}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
          
          {isArchived ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => handleUnarchive(conv.id)}
                  disabled={isBeingDeleted}
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restore</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => handleArchive(conv.id)}
                  disabled={isBeingDeleted}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteId(conv.id)}
                disabled={isBeingDeleted}
              >
                {isBeingDeleted ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="border-b border-border p-4 safe-top">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">History</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="relative mb-4">
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
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active ({conversations.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedConversations.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                {activeTab === 'archived' ? (
                  <Archive className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h2 className="mb-2 text-lg font-semibold">
                {searchQuery ? 'No results found' : activeTab === 'archived' ? 'No archived conversations' : 'No conversations yet'}
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                {searchQuery 
                  ? 'Try a different search term'
                  : activeTab === 'archived' 
                    ? 'Archived conversations will appear here'
                    : 'Your chat history will appear here once you start a conversation'
                }
              </p>
              {!searchQuery && activeTab === 'active' && (
                <Button 
                  className="mt-4" 
                  onClick={() => navigate('/chat')}
                >
                  Start a conversation
                </Button>
              )}
            </div>
          ) : (
            <div className="pb-4">


              {groupedConversations.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-background/95 px-4 py-2 backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {group.conversations.map((conv) => renderConversationItem(conv, activeTab === 'archived'))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => !isDeleting && setDeleteId(null)}>
          <AlertDialogContent className="bg-background border border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                conversation and all its messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
