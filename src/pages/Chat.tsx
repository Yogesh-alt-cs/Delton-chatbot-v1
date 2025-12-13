import { useState } from 'react';
import { Send, Plus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

export default function Chat() {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    // TODO: Implement chat functionality in Phase 2
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 safe-top">
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">New Chat</h1>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Plus className="h-5 w-5" />
          </Button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Empty State */}
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <span className="text-3xl">👋</span>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Welcome to Delton</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              Start a conversation by typing a message below. I'm here to help with anything you need!
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-background p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-32 resize-none rounded-xl"
              rows={1}
            />
            <Button
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 rounded-xl transition-all",
                !message.trim() && "opacity-50"
              )}
              disabled={!message.trim()}
              onClick={handleSend}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
