'use client';

/**
 * Client-side affordance for the Cmd-K palette. Topbar is a server
 * component (async) so its JSX can't carry onClick — we extract this
 * button as its own client module.
 */
import { Search } from 'lucide-react';

export function CmdKSearchButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Synthesise the global hotkey so the palette opens.
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }),
        );
      }}
      className="relative hidden w-full max-w-md items-center gap-2 rounded-lg border border-border/70 bg-input/40 px-3 py-1.5 text-left text-sm text-muted-foreground/70 transition hover:border-primary/40 hover:bg-input/60 md:flex"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">Ask Flux or search…</span>
      <kbd className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
