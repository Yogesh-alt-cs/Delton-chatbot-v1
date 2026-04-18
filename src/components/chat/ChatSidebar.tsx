import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, X, Search, Loader2, Settings, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useExportData } from '@/hooks/useExportData';
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
  const { exportSingleConversation } = useExportData();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      const results = await searchConversations(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchConversations]);

  const displayConversations = searchResults ?? conversations;
  const handleSelectConversation = (id: string) => { navigate(`/chat/${id}`); onClose(); };
  const handleDelete = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); await deleteConversation(id); };
  const handleDownloadPdf = (e: React.MouseEvent, id: string) => { e.stopPropagation(); exportSingleConversation(id, 'pdf'); };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background brutal-border-r transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between p-4 brutal-border-b">
          <div className="flex flex-col">
            <span className="font-display text-2xl leading-none">DELTON</span>
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground mt-1">CORE_SYSTEM</span>
          </div>
          <button
            className="lg:hidden p-2 hover:bg-foreground hover:text-background transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3 brutal-border-b">
          <button
            className="w-full btn-brutal text-xs"
            onClick={() => { onNewChat(); onClose(); }}
          >
            <Plus className="h-4 w-4" />
            NEW_CHAT
          </button>
        </div>

        {/* Search */}
        <div className="p-3 brutal-border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="SEARCH..."
              className="h-9 pl-8 text-xs font-mono bg-background brutal-border tracking-wider placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* History header */}
        <div className="px-3 py-2 brutal-border-b">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            HISTORY_LOG
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            </div>
          ) : displayConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                {searchQuery ? 'NO_RESULTS' : 'NO_CONVERSATIONS'}
              </p>
            </div>
          ) : (
            <div>
              {displayConversations.map((conv) => {
                const isActive = conv.id === conversationId;
                const isDeleting = deletingIds.has(conv.id);
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    disabled={isDeleting}
                    className={cn(
                      "group flex w-full items-center gap-2 px-3 py-3 text-left text-xs brutal-border-b transition-colors",
                      isActive
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground hover:bg-foreground hover:text-background",
                      isDeleting && "opacity-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-mono font-bold uppercase tracking-wider">{conv.title.replace(/\s+/g, '_').slice(0, 32)}</p>
                      <p className="truncate font-mono text-[9px] tracking-widest opacity-60 mt-0.5">
                        {formatConversationDate(conv.updated_at).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                      <span
                        onClick={(e) => handleDownloadPdf(e, conv.id)}
                        className="p-1 hover:bg-background hover:text-foreground"
                        title="Download PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </span>
                      <span
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-1 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 brutal-border-t bg-background">
          <button
            className="w-full flex items-center justify-start gap-2 px-4 py-3 text-xs font-mono uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
            onClick={() => { navigate('/settings'); onClose(); }}
          >
            <Settings className="h-4 w-4" /> SETTINGS
          </button>
        </div>
      </aside>
    </>
  );
}
