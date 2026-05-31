'use client';

/**
 * EnginePulse — the ambient AI-activity orb.
 *
 * The visible heartbeat of Flux. Idles with a slow breathe; when the engine is
 * actively reasoning (generation, insight refresh, analysis) it switches to a
 * faster ripple-emit and surfaces the live task label. Lives at the bottom of
 * the Command Rail and (compact) in the Topbar — proof the machine is alive.
 */
import { useEngineActivity } from '@/lib/use-engine-activity';
import { cn } from '@/lib/utils';

export function EnginePulse({
  expanded = false,
  className,
}: {
  /** When the rail is expanded, show the label beside the orb. */
  expanded?: boolean;
  className?: string;
}) {
  const { isThinking, currentLabel } = useEngineActivity();

  return (
    <div
      className={cn('flex items-center gap-3', className)}
      title={isThinking ? currentLabel ?? 'Flux is working…' : 'Engine idle · observing'}
    >
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {/* ripple rings — only while thinking */}
        {isThinking && (
          <>
            <span className="absolute inset-0 rounded-full bg-flux-violet/40 animate-engine-ripple" />
            <span
              className="absolute inset-0 rounded-full bg-flux-cyan/30 animate-engine-ripple"
              style={{ animationDelay: '0.45s' }}
            />
          </>
        )}
        {/* core orb */}
        <span
          className={cn(
            'relative h-2.5 w-2.5 rounded-full transition-all duration-300',
            isThinking
              ? 'bg-flux-violet shadow-[0_0_14px_3px_rgba(139,92,246,0.7)]'
              : 'bg-flux-cyan/80 shadow-[0_0_10px_2px_rgba(34,211,238,0.45)] animate-breathe',
          )}
        />
      </div>

      {expanded && (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-dim">
            {isThinking ? 'Thinking' : 'Engine'}
          </div>
          <div
            className={cn(
              'truncate text-[11px]',
              isThinking ? 'text-flux-violet-bright' : 'text-fg-muted',
            )}
          >
            {isThinking ? currentLabel ?? 'Working…' : 'Observing your workspace'}
          </div>
        </div>
      )}
    </div>
  );
}
