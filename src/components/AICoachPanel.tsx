import { Sparkles, X, AlertTriangle, AlertCircle, Info, Loader2, ChevronLeft, ChevronRight, SkipBack, SkipForward, Lightbulb, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ReplayBoard } from "./ReplayBoard";
import { cn } from "@/lib/utils";
import { type BoardThemeColors } from "@/lib/boardThemes";

export type Moment = {
  moveNumber: number;
  ply: number;
  side: "w" | "b";
  moveNotation: string;
  severity: "blunder" | "mistake" | "inaccuracy" | "brilliant";
  chessInsight: string;
  businessAnalogy: string;
  betterMove: string;
};

export type Analysis = {
  summary: string;
  // New shape
  moments?: Moment[];
  // Backward compat with prior shape
  mistakes?: Array<{
    moveNumber: number;
    moveNotation: string;
    severity: "blunder" | "mistake" | "inaccuracy";
    explanation: string;
    betterMove: string;
  }>;
};

const severityMeta: Record<Moment["severity"], { label: string; cls: string; dot: string; Icon: typeof AlertTriangle }> = {
  blunder:    { label: "Blunder",    cls: "text-destructive border-destructive/40 bg-destructive/10", dot: "bg-destructive",     Icon: AlertTriangle },
  mistake:    { label: "Mistake",    cls: "text-amber-500 border-amber-500/40 bg-amber-500/10",       dot: "bg-amber-500",       Icon: AlertCircle },
  inaccuracy: { label: "Inaccuracy", cls: "text-accent border-accent/40 bg-accent/10",                 dot: "bg-accent",          Icon: Info },
  brilliant:  { label: "Brilliant",  cls: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",  dot: "bg-emerald-400",     Icon: Star },
};

interface AICoachPanelProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  analysis: Analysis | null;
  pgn: string;
  onClose: () => void;
  onRetry: () => void;
  themeColors?: BoardThemeColors;
}

type Step = {
  ply: number;            // 1..N (0 = starting position handled separately)
  san: string;
  fen: string;            // FEN AFTER the move
  from: Square;
  to: Square;
  side: "w" | "b";
  moveNumber: number;     // 1, 1, 2, 2, ...
};

function buildSteps(pgn: string): { steps: Step[]; startFen: string } {
  const startFen = new Chess().fen();
  if (!pgn) return { steps: [], startFen };

  const c = new Chess();
  try {
    c.loadPgn(pgn);
  } catch {
    return { steps: [], startFen };
  }
  const verbose = c.history({ verbose: true });

  const replay = new Chess();
  const steps: Step[] = [];
  verbose.forEach((mv, idx) => {
    const m = replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (!m) return;
    steps.push({
      ply: idx + 1,
      san: m.san,
      fen: replay.fen(),
      from: m.from as Square,
      to: m.to as Square,
      side: m.color as "w" | "b",
      moveNumber: Math.floor(idx / 2) + 1,
    });
  });
  return { steps, startFen };
}

// Normalize old "mistakes" shape into "moments" if needed
function normalizeMoments(a: Analysis | null, steps: Step[]): Moment[] {
  if (!a) return [];
  if (a.moments?.length) return a.moments;
  if (!a.mistakes?.length) return [];
  // Best-effort: find ply by matching SAN + moveNumber
  return a.mistakes.map((m) => {
    const match = steps.find((s) => s.moveNumber === m.moveNumber && s.san === m.moveNotation)
      ?? steps.find((s) => s.san === m.moveNotation);
    return {
      moveNumber: m.moveNumber,
      ply: match?.ply ?? m.moveNumber * 2 - 1,
      side: match?.side ?? "w",
      moveNotation: m.moveNotation,
      severity: m.severity,
      chessInsight: m.explanation,
      businessAnalogy: "",
      betterMove: m.betterMove,
    };
  });
}

export function AICoachPanel({ open, loading, error, analysis, pgn, onClose, onRetry, themeColors }: AICoachPanelProps) {
  const { steps, startFen } = useMemo(() => buildSteps(pgn), [pgn]);
  const moments = useMemo(() => normalizeMoments(analysis, steps), [analysis, steps]);

  // currentPly: 0 = starting position, 1..steps.length = after that ply
  const [currentPly, setCurrentPly] = useState(0);
  const [activeMomentIdx, setActiveMomentIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentPly(steps.length); // start at final position
      setActiveMomentIdx(null);
    }
  }, [open, steps.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  setCurrentPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setCurrentPly((p) => Math.min(steps.length, p + 1));
      if (e.key === "Home")       setCurrentPly(0);
      if (e.key === "End")        setCurrentPly(steps.length);
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length, onClose]);

  // Auto-scroll move list to current ply
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moveListRef.current?.querySelector<HTMLElement>(`[data-ply="${currentPly}"]`);
    if (el && moveListRef.current) {
      const container = moveListRef.current;
      const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [currentPly]);

  if (!open) return null;

  const currentStep = currentPly > 0 ? steps[currentPly - 1] : null;
  const fen = currentStep ? currentStep.fen : startFen;
  const lastMove = currentStep ? { from: currentStep.from, to: currentStep.to } : null;

  // Group moves into pairs for SAN display
  const pairs: { num: number; white?: Step; black?: Step }[] = [];
  for (let i = 0; i < steps.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: steps[i], black: steps[i + 1] });
  }

  const jumpToMoment = (idx: number) => {
    const m = moments[idx];
    if (!m) return;
    setCurrentPly(Math.min(steps.length, Math.max(0, m.ply)));
    setActiveMomentIdx(idx);
  };

  // Map ply -> moment idx for highlighting in move list
  const plyToMoment = new Map<number, number>();
  moments.forEach((m, i) => plyToMoment.set(m.ply, i));

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md animate-fade-in flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="font-display text-base sm:text-lg font-semibold tracking-tight truncate">AI Coach · Game Review</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground tracking-wide uppercase">Chess × Startup analysis</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close coach">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading / error states full-screen */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <Loader2 className="h-7 w-7 text-accent animate-spin" />
          <p className="font-display text-base sm:text-lg">Analyzing your game…</p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-[340px]">
            The coach is reviewing every move and translating each turning point into startup insights.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 space-y-3 max-w-md w-full">
            <p className="text-sm text-destructive font-medium">Couldn't analyze the game</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] gap-4 p-4 sm:p-6 overflow-hidden">
          {/* LEFT: move list */}
          <aside className="rounded-2xl border border-border bg-card/60 flex flex-col min-h-0 order-2 lg:order-1">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
              <p className="text-[11px] tracking-widest uppercase text-muted-foreground">Moves</p>
              <span className="text-[11px] text-muted-foreground tabular-nums">{steps.length} ply</span>
            </div>
            <div ref={moveListRef} className="flex-1 min-h-0 overflow-y-auto p-2 font-mono text-sm">
              <button
                data-ply={0}
                onClick={() => setCurrentPly(0)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md mb-1 transition-colors",
                  currentPly === 0 ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-secondary/60",
                )}
              >
                · Start position
              </button>
              {pairs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-2 py-3">No moves played.</p>
              ) : (
                <ol className="space-y-0.5">
                  {pairs.map((p) => (
                    <li
                      key={p.num}
                      className="grid grid-cols-[2rem_1fr_1fr] gap-1 items-center"
                    >
                      <span className="text-muted-foreground tabular-nums text-xs px-2">{p.num}.</span>
                      {p.white ? (
                        <MoveButton step={p.white} active={currentPly === p.white.ply} momentIdx={plyToMoment.get(p.white.ply)} onClick={setCurrentPly} />
                      ) : <span />}
                      {p.black ? (
                        <MoveButton step={p.black} active={currentPly === p.black.ply} momentIdx={plyToMoment.get(p.black.ply)} onClick={setCurrentPly} />
                      ) : <span />}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>

          {/* CENTER: replay board + controls */}
          <section className="flex flex-col gap-3 min-h-0 order-1 lg:order-2 items-center">
            <div
              className="w-full mx-auto"
              style={{ maxWidth: "min(100%, calc(100vh - 240px))" }}
            >
              <ReplayBoard fen={fen} lastMove={lastMove} themeColors={themeColors} />
            </div>

            <div className="flex items-center justify-center gap-1.5 w-full">
              <Button variant="outline" size="icon" onClick={() => setCurrentPly(0)} disabled={currentPly === 0} aria-label="First move">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentPly((p) => Math.max(0, p - 1))} disabled={currentPly === 0} aria-label="Previous move">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1.5 rounded-md border border-border bg-card text-xs tabular-nums min-w-[110px] text-center">
                {currentStep
                  ? <>Move <span className="text-accent font-semibold">{currentStep.moveNumber}{currentStep.side === "w" ? "." : "…"}</span> {currentStep.san}</>
                  : <span className="text-muted-foreground">Start</span>}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentPly((p) => Math.min(steps.length, p + 1))} disabled={currentPly === steps.length} aria-label="Next move">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentPly(steps.length)} disabled={currentPly === steps.length} aria-label="Last move">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </section>

          {/* RIGHT: insight cards */}
          <aside className="rounded-2xl border border-border bg-card/60 flex flex-col min-h-0 order-3">
            <div className="px-4 py-3 border-b border-border/60 shrink-0">
              <p className="text-[11px] tracking-widest uppercase text-muted-foreground">Insights</p>
              {analysis?.summary && (
                <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{analysis.summary}</p>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2.5">
                {moments.length === 0 && (
                  <p className="text-xs text-muted-foreground italic p-3">No key moments returned.</p>
                )}
                {moments.map((m, i) => {
                  const meta = severityMeta[m.severity] ?? severityMeta.mistake;
                  const { Icon } = meta;
                  const active = activeMomentIdx === i || currentPly === m.ply;
                  return (
                    <button
                      key={i}
                      onClick={() => jumpToMoment(i)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3.5 space-y-2 transition-all",
                        active
                          ? "border-accent/60 bg-accent/[0.06] shadow-soft"
                          : "border-border bg-background/40 hover:border-border/80 hover:bg-background/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold tracking-tight">
                          Move {m.moveNumber}{m.side === "w" ? "." : "…"} <span className="text-accent">{m.moveNotation}</span>
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-md border",
                          meta.cls,
                        )}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <span className="text-[10px] tracking-widest uppercase text-muted-foreground shrink-0 mt-0.5 w-12">Chess</span>
                          <p className="text-xs leading-relaxed text-foreground/90">{m.chessInsight}</p>
                        </div>
                        {m.businessAnalogy && (
                          <div className="flex gap-2 pt-1.5 border-t border-border/40">
                            <span className="text-[10px] tracking-widest uppercase text-amber-400/80 shrink-0 mt-0.5 w-12 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Biz
                            </span>
                            <p className="text-xs leading-relaxed text-foreground/90 italic">{m.businessAnalogy}</p>
                          </div>
                        )}
                      </div>

                      {m.betterMove && m.betterMove !== "—" && (
                        <div className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                          <span className="text-[10px] tracking-widest uppercase mr-2">Better</span>
                          <span className="text-foreground/90 font-medium font-mono">{m.betterMove}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>
        </div>
      )}
    </div>
  );
}

function MoveButton({
  step,
  active,
  momentIdx,
  onClick,
}: {
  step: Step;
  active: boolean;
  momentIdx: number | undefined;
  onClick: (ply: number) => void;
}) {
  const hasMoment = momentIdx !== undefined;
  return (
    <button
      data-ply={step.ply}
      onClick={() => onClick(step.ply)}
      className={cn(
        "px-2 py-1 rounded-md text-left transition-colors flex items-center gap-1.5",
        active
          ? "bg-accent/20 text-accent font-semibold"
          : "hover:bg-secondary/60 text-foreground/90",
      )}
    >
      <span className="font-mono text-xs">{step.san}</span>
      {hasMoment && <Lightbulb className="h-3 w-3 text-amber-400 shrink-0" />}
    </button>
  );
}
