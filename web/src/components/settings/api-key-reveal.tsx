'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ApiKeyReveal({ apiKey }: { apiKey: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = apiKey ? `${apiKey.slice(0, 8)}${'•'.repeat(20)}${apiKey.slice(-4)}` : '—';

  const copy = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard refused — ignore */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-black/30 px-4 py-3">
        <code className="flex-1 truncate font-mono text-sm tracking-wide text-foreground">
          {revealed ? apiKey || '—' : masked}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide API key' : 'Reveal API key'}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy API key">
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Send as <code className="rounded bg-black/30 px-1.5 py-0.5">x-org-api-key</code>{' '}
        header. Treat like a password — anyone with this key can read and write to your workspace.
      </p>
    </div>
  );
}
