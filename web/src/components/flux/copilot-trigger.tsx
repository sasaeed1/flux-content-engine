'use client';

/**
 * CopilotTrigger — summons the contextual Copilot drawer (built in step 7).
 * Dispatches a global custom event the CopilotPanel listens for, so the
 * trigger can live in the server-rendered Topbar without a shared provider.
 */
import { Bot } from 'lucide-react';

export const COPILOT_EVENT = 'flux:copilot:toggle';

export function CopilotTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(COPILOT_EVENT))}
      aria-label="Open Copilot"
      className="press inline-flex h-9 w-9 items-center justify-center rounded-sm border border-edge-strong bg-surface-1 text-flux-violet-bright transition hover:border-flux-violet/50 hover:bg-surface-2"
    >
      <Bot className="h-4 w-4" />
    </button>
  );
}
