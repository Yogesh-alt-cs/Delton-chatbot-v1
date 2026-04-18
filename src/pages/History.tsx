import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Trash2, ChevronRight, Share2, Archive, ArchiveRestore, Timer, FileType, MessageCircle, RefreshCw, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useConversations } from '@/hooks/useConversations';
import { useShareConversation } from '@/hooks/useShareConversation';
import { useExportData } from '@/hooks/useExportData';
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
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
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
    toast({ title: 'HISTORY_REFRESHED' });
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    const success = await deleteConversation(deleteId);
    if (success) {
      toast({ title: 'CONVERSATION_DELETED' });
      if (searchResults) {
        setSearchResults(prev => prev?.filter(c => c.id !== deleteId) ?? null);
      }
    } else {
      toast({ title: 'ERROR', description: 'Failed to delete conversation.', variant: 'destructive' });
    }
    setIsDeleting(false);
    setDeleteId(null);
  };

  const handleArchive = async (id: string) => {
    const success = await archiveConversation(id);
    if (success) toast({ title: 'CONVERSATION_ARCHIVED' });
    else toast({ title: 'ERROR', description: 'Failed to archive', variant: 'destructive' });
  };

  const handleUnarchive = async (id: string) => {
    const success = await unarchiveConversation(id);
    if (success) toast({ title: 'CONVERSATION_RESTORED' });
    else toast({ title: 'ERROR', description: 'Failed to restore', variant: 'destructive' });
  };

  const handleSetExpiry = async (id: string, hours: number | null) => {
    const expiresAt = hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
    const success = await setConversationExpiry(id, expiresAt);
    if (success) {
      toast({ title: hours ? `EXPIRES_IN_${hours}H` : 'EXPIRY_DISABLED' });
    } else {
      toast({ title: 'ERROR', description: 'Failed to set expiry', variant: 'destructive' });
    }
  };

  const renderConversationItem = (conv: Conversation, isArchived: boolean) => {
    const isBeingDeleted = deletingIds.has(conv.id);
    return (
      <div
        key={conv.id}
        className={`flex items-center gap-2 px-4 py-3 brutal-border-b hover:bg-foreground hover:text-background transition-none group/item ${
          isBeingDeleted ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <button
          className="flex flex-1 items-center gap-3 text-left min-w-0"
          onClick={() => navigate(`/chat/${conv.id}`)}
          disabled={isBeingDeleted}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center brutal-border">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-mono text-sm uppercase tracking-wider">
              {conv.title.replace(/\s+/g, '_').toUpperCase()}
            </p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase group-hover/item:text-background/70">
                {formatConversationDate(conv.updated_at).toUpperCase()}
              </p>
              {conv.expires_at && (
                <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase">
                  <Timer className="h-3 w-3" />
                  EXPIRES
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                onClick={() => navigate(`/chat/${conv.id}`)}
                disabled={isBeingDeleted}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">
              CONTINUE
            </TooltipContent>
          </Tooltip>

          {!isArchived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                  disabled={isBeingDeleted}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="brutal-border bg-background font-mono text-xs uppercase tracking-wider z-50">
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 1)}>EXPIRE_1H</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 24)}>EXPIRE_24H</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, 168)}>EXPIRE_7D</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetExpiry(conv.id, null)}>NEVER</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                onClick={() => exportSingleConversation(conv.id, 'pdf')}
                disabled={isBeingDeleted}
              >
                <FileType className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">EXPORT_PDF</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                onClick={() => shareConversation(conv.id, conv.title)}
                disabled={isBeingDeleted}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">SHARE</TooltipContent>
          </Tooltip>

          {isArchived ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                  onClick={() => handleUnarchive(conv.id)}
                  disabled={isBeingDeleted}
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">RESTORE</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 hover:bg-background hover:text-foreground"
                  onClick={() => handleArchive(conv.id)}
                  disabled={isBeingDeleted}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">ARCHIVE</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setDeleteId(conv.id)}
                disabled={isBeingDeleted}
              >
                {isBeingDeleted ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="brutal-border bg-background font-mono text-[10px] tracking-widest uppercase">DELETE</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="brutal-border-b p-4 safe-top">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                &gt; SYSTEM_LOG
              </span>
              <h1 className="font-display text-2xl mt-1">HISTORY</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="h-9 w-9 brutal-border hover:bg-foreground hover:text-background"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4 brutal-border">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              placeholder="QUERY..."
              className="h-11 w-full bg-background pl-10 pr-10 font-mono text-xs tracking-widest uppercase outline-none placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {/* Tabs — brutal */}
          <div className="grid grid-cols-2 brutal-border">
            <button
              onClick={() => setActiveTab('active')}
              className={`p-3 font-mono text-xs tracking-widest uppercase brutal-border-r ${
                activeTab === 'active' ? 'bg-foreground text-background' : 'hover:bg-foreground/10'
              }`}
            >
              ACTIVE [{conversations.length}]
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`p-3 font-mono text-xs tracking-widest uppercase ${
                activeTab === 'archived' ? 'bg-foreground text-background' : 'hover:bg-foreground/10'
              }`}
            >
              ARCHIVED [{archivedConversations.length}]
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 brutal-border border-destructive font-mono text-xs tracking-wider text-destructive uppercase flex items-center justify-between">
            <span>! {error}</span>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="font-mono text-xs uppercase">
              RETRY
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase animate-pulse">
                &gt; LOADING_LOGS...
              </span>
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center brutal-border">
                {activeTab === 'archived' ? <Archive className="h-7 w-7" /> : <MessageSquare className="h-7 w-7" />}
              </div>
              <h2 className="mb-2 font-display text-xl uppercase">
                {searchQuery ? 'NO_RESULTS' : activeTab === 'archived' ? 'EMPTY_ARCHIVE' : 'NO_HISTORY'}
              </h2>
              <p className="max-w-xs font-mono text-xs tracking-wider text-muted-foreground uppercase">
                {searchQuery ? '> Try a different query' : '> Start a conversation to populate logs'}
              </p>
              {!searchQuery && activeTab === 'active' && (
                <Button
                  className="btn-brutal mt-6 tracking-widest text-xs"
                  onClick={() => navigate('/chat')}
                >
                  [ NEW_CHAT ]
                </Button>
              )}
            </div>
          ) : (
            <div className="pb-4">
              {groupedConversations.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-background brutal-border-b px-4 py-2">
                    <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                      &gt; {group.label}
                    </h3>
                  </div>
                  <div>
                    {group.conversations.map((conv) => renderConversationItem(conv, activeTab === 'archived'))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => !isDeleting && setDeleteId(null)}>
          <AlertDialogContent className="brutal-border bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-2xl uppercase">DELETE_CONVERSATION?</AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs tracking-wider uppercase text-muted-foreground">
                &gt; This action is irreversible. All messages will be permanently destroyed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} className="font-mono text-xs uppercase tracking-widest brutal-border">
                CANCEL
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-xs uppercase tracking-widest brutal-border"
              >
                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />DELETING</> : 'CONFIRM_DELETE'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
