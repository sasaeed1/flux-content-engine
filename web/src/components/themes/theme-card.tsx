import { Badge } from '@/components/ui/badge';
import type { ThemePreset } from '@/lib/types';

export function ThemeCard({ theme }: { theme: ThemePreset }) {
  const c = theme.colors;
  const swatch = [c.primary, c.accent, c.foreground, c.background].filter(
    Boolean,
  ) as string[];

  return (
    <article className="group overflow-hidden rounded-2xl glass glass-hover">
      <div
        className="relative h-40 w-full"
        style={{
          background: `linear-gradient(135deg, ${c.primary ?? '#22D3EE'} 0%, ${
            c.accent ?? '#A78BFA'
          } 60%, ${c.background ?? '#08090C'} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4 text-xl font-semibold tracking-tight text-white">
          {theme.name}
        </div>
        {theme.visual_tone && (
          <Badge
            variant="info"
            className="absolute right-3 top-3 backdrop-blur-md"
          >
            {theme.visual_tone}
          </Badge>
        )}
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {theme.description ?? 'No description.'}
        </p>
        <div className="flex items-center gap-1.5">
          {swatch.map((hex, i) => (
            <span
              key={i}
              className="h-6 w-6 rounded-md border border-border/80"
              style={{ background: hex }}
              title={hex}
            />
          ))}
          <code className="ml-auto text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {theme.key}
          </code>
        </div>
      </div>
    </article>
  );
}
