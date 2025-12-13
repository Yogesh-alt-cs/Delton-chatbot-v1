import { Clock, Search, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/layout/AppLayout';

export default function History() {
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
            />
          </div>
        </header>

        {/* Empty State */}
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">No conversations yet</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your chat history will appear here once you start a conversation
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
