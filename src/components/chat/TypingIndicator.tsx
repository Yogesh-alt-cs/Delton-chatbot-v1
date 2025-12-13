import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
        <Bot className="h-4 w-4 text-accent-foreground" />
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  );
}
