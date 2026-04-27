import { Sparkles, X, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type Mistake = {
  moveNumber: number;
  moveNotation: string;
  severity: "blunder" | "mistake" | "inaccuracy";
  explanation: string;
  betterMove: string;
};

export type Analysis = {
  summary: string;
  mistakes: Mistake[];
};

const severityMeta: Record<Mistake["severity"], { label: string; cls: string; Icon: typeof AlertTriangle }> = {
  blunder:    { label: "Blunder",    cls: "text-destructive border-destructive/40 bg-destructive/10", Icon: AlertTriangle },
  mistake:    { label: "Mistake",    cls: "text-amber-500 border-amber-500/40 bg-amber-500/10",       Icon: AlertCircle },
  inaccuracy: { label: "Inaccuracy", cls: "text-accent border-accent/40 bg-accent/10",                 Icon: Info },
};

export function AICoachPanel({
  open,
  loading,
  error,
  analysis,
  onClose,
  onRetry,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  analysis: Analysis | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      <aside
        className="
          fixed right-0 top-0 h-full w-full sm:w-[420px] z-50
          lg:sticky lg:top-6 lg:h-auto lg:w-auto lg:z-auto
          border-l lg:border lg:rounded-2xl border-border
          bg-card shadow-2xl lg:shadow-soft
          flex flex-col animate-fade-in
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-semibold tracking-tight">AI Coach</p>
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">Game review</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close coach">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Loader2 className="h-6 w-6 text-accent animate-spin" />
                <p className="font-display text-base">Analyzing your game…</p>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  The coach is reviewing every move to find your most impactful mistakes.
                </p>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
                <p className="text-sm text-destructive font-medium">Couldn't analyze the game</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
              </div>
            )}

            {analysis && !loading && (
              <>
                <section>
                  <p className="text-[11px] tracking-widest uppercase text-muted-foreground mb-2">Summary</p>
                  <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                </section>

                <div className="h-px bg-border/60" />

                <section className="space-y-3">
                  <p className="text-[11px] tracking-widest uppercase text-muted-foreground">
                    Key moments ({analysis.mistakes.length})
                  </p>
                  {analysis.mistakes.map((m, i) => {
                    const meta = severityMeta[m.severity] ?? severityMeta.mistake;
                    const { Icon } = meta;
                    return (
                      <article
                        key={i}
                        className="rounded-xl border border-border bg-background/40 p-4 space-y-2.5"
                      >
                        <header className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-semibold tracking-tight">
                              Move {m.moveNumber}: <span className="text-accent">{m.moveNotation}</span>
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] tracking-widest uppercase px-2 py-1 rounded-md border ${meta.cls}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </header>
                        <p className="text-sm leading-relaxed text-foreground/90">{m.explanation}</p>
                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                          <span className="text-[10px] tracking-widest uppercase mr-2">Better</span>
                          <span className="text-foreground/90 font-medium">{m.betterMove}</span>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
