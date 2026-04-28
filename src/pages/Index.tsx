import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { MoveHistory } from "@/components/MoveHistory";
import { PromotionDialog } from "@/components/PromotionDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/hooks/useTheme";
import { useStockfish } from "@/hooks/useStockfish";
import { Moon, Sun, RotateCcw, Undo2, FlipVertical2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AICoachPanel, type Analysis } from "@/components/AICoachPanel";
import { supabase } from "@/integrations/supabase/client";

type Side = "w" | "b";

const DIFFICULTY_LEVELS = [
  { label: "Easy",   depth: 1 },
  { label: "Medium", depth: 5 },
  { label: "Hard",   depth: 15 },
];

const Index = () => {
  const { theme, toggle } = useTheme();
  const [game, setGame] = useState(() => new Chess());
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [playerSide, setPlayerSide] = useState<Side>("w");
  const [orientation, setOrientation] = useState<Side>("w");
  const [difficulty, setDifficulty] = useState(1); // index into DIFFICULTY_LEVELS (Medium default)
  const [pendingDifficulty, setPendingDifficulty] = useState(1);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const stockfish = useStockfish();
  const gameRef = useRef(game);
  gameRef.current = game;

  const history = game.history();
  const lastMove = useMemo(() => {
    const verbose = game.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    return last ? { from: last.from as Square, to: last.to as Square } : null;
  }, [game, history.length]);

  const status = useMemo(() => {
    if (game.isCheckmate()) return { kind: "end" as const, text: `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins` };
    if (game.isStalemate()) return { kind: "end" as const, text: "Stalemate — draw" };
    if (game.isInsufficientMaterial()) return { kind: "end" as const, text: "Draw — insufficient material" };
    if (game.isThreefoldRepetition()) return { kind: "end" as const, text: "Draw — threefold repetition" };
    if (game.isDraw()) return { kind: "end" as const, text: "Draw" };
    if (game.inCheck()) return { kind: "check" as const, text: `${game.turn() === "w" ? "White" : "Black"} in check` };
    return { kind: "turn" as const, text: `${game.turn() === "w" ? "White" : "Black"} to move` };
  }, [game, history.length]);

  const isPlayerTurn = game.turn() === playerSide && !game.isGameOver();

  const applyMove = useCallback((m: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }) => {
    const next = new Chess(gameRef.current.fen());
    // Replay full history so move history stays intact
    const verbose = gameRef.current.history({ verbose: true });
    const fresh = new Chess();
    verbose.forEach((mv) => fresh.move({ from: mv.from, to: mv.to, promotion: mv.promotion }));
    try {
      const moved = fresh.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
      if (!moved) return false;
      setGame(fresh);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Trigger AI move when it's the engine's turn
  useEffect(() => {
    if (game.isGameOver()) return;
    if (game.turn() === playerSide) return;
    if (!stockfish.ready) return;

    setThinking(true);
    const cfg = DIFFICULTY_LEVELS[difficulty];
    const fen = game.fen();

    const handle = setTimeout(() => {
      stockfish.requestMove(fen, cfg.depth, (mv) => {
        if (!mv.from || !mv.to) {
          // Fallback: random legal
          const legal = gameRef.current.moves({ verbose: true });
          if (legal.length) {
            const pick = legal[Math.floor(Math.random() * legal.length)];
            applyMove({ from: pick.from as Square, to: pick.to as Square, promotion: pick.promotion as any });
          }
        } else {
          applyMove({ from: mv.from as Square, to: mv.to as Square, promotion: mv.promotion as any });
        }
        setThinking(false);
        refresh();
      });
    }, 250);

    return () => clearTimeout(handle);
  }, [game, playerSide, stockfish.ready, difficulty, applyMove, stockfish]);

  // Game-end toast
  useEffect(() => {
    if (status.kind === "end") {
      toast(status.text, { duration: 5000 });
    }
  }, [status]);

  const handleNewGame = (side: Side = playerSide) => {
    setGame(new Chess());
    setPlayerSide(side);
    setOrientation(side);
    setThinking(false);
    setPendingPromotion(null);
    setCoachOpen(false);
    setAnalysis(null);
    setCoachError(null);
  };

  const handleAnalyze = async () => {
    setCoachOpen(true);
    setCoachLoading(true);
    setCoachError(null);
    setAnalysis(null);
    try {
      const pgn = game.pgn();
      const { data, error } = await supabase.functions.invoke("analyze-game", {
        body: { pgn, result: status.text, playerColor: playerSide },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis(data as Analysis);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to analyze game";
      setCoachError(msg);
      toast.error(msg);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleUndo = () => {
    // Undo player's last move + AI's reply
    const verbose = game.history({ verbose: true });
    if (verbose.length === 0) return;
    const undoCount = verbose[verbose.length - 1].color === playerSide ? 1 : 2;
    const fresh = new Chess();
    verbose.slice(0, Math.max(0, verbose.length - undoCount)).forEach((mv) =>
      fresh.move({ from: mv.from, to: mv.to, promotion: mv.promotion }),
    );
    setGame(fresh);
  };

  const handlePlayerMove = (m: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }) => {
    if (!isPlayerTurn) return;
    applyMove(m);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between py-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
              <span className="font-display text-xl font-semibold text-accent leading-none">♞</span>
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight leading-none">Gambit</h1>
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase mt-0.5">vs Stockfish</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}
              aria-label="Flip board"
              className="hidden sm:inline-flex"
            >
              <FlipVertical2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 lg:gap-10 items-start">
          {/* Board side */}
          <div className="flex flex-col items-center gap-5">
            <PlayerBar
              label={playerSide === "w" ? "Stockfish" : "Stockfish"}
              side={playerSide === "w" ? "b" : "w"}
              active={game.turn() !== playerSide && !game.isGameOver()}
              thinking={thinking}
              difficulty={SKILL_LEVELS[difficulty].label}
            />

            <Board
              game={game}
              orientation={orientation}
              onMove={handlePlayerMove}
              lastMove={lastMove}
              disabled={!isPlayerTurn}
              onPromotionNeeded={(from, to) => setPendingPromotion({ from, to })}
            />

            <PlayerBar
              label="You"
              side={playerSide}
              active={isPlayerTurn}
              you
            />
          </div>

          {/* Side panel */}
          <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
            {/* Status card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] tracking-widest uppercase text-muted-foreground">Status</span>
                {thinking && (
                  <span className="flex items-center gap-1.5 text-[11px] text-accent">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    thinking…
                  </span>
                )}
              </div>
              <p className={`font-display text-xl font-semibold tracking-tight ${status.kind === "check" ? "text-destructive" : ""}`}>
                {status.text}
              </p>
              {stockfish.usingFallback && (
                <p className="text-xs text-muted-foreground mt-2">
                  Stockfish CDN unavailable — using offline fallback engine.
                </p>
              )}
              {status.kind === "end" && history.length > 0 && (
                <Button
                  onClick={handleAnalyze}
                  disabled={coachLoading}
                  className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {coachLoading ? "Analyzing…" : "Analyze with AI Coach"}
                </Button>
              )}
            </div>

            {/* Controls */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] tracking-widest uppercase text-muted-foreground">Difficulty</label>
                <Select value={String(difficulty)} onValueChange={(v) => setDifficulty(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((l, i) => (
                      <SelectItem key={l.label} value={String(i)}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] tracking-widest uppercase text-muted-foreground">Play as</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={playerSide === "w" ? "default" : "outline"}
                    onClick={() => handleNewGame("w")}
                    className="font-medium"
                  >
                    ♔ White
                  </Button>
                  <Button
                    variant={playerSide === "b" ? "default" : "outline"}
                    onClick={() => handleNewGame("b")}
                    className="font-medium"
                  >
                    ♚ Black
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" onClick={handleUndo} disabled={history.length === 0 || thinking}>
                  <Undo2 className="h-4 w-4 mr-1.5" /> Undo
                </Button>
                <Button variant="outline" onClick={() => handleNewGame(playerSide)}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> New
                </Button>
              </div>
            </div>

            {/* History */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex-1 min-h-[260px] max-h-[420px] flex flex-col">
              <MoveHistory history={history} />
            </div>
          </aside>
        </div>
      </main>

      <PromotionDialog
        open={!!pendingPromotion}
        color={playerSide}
        onSelect={(p) => {
          if (pendingPromotion) {
            applyMove({ ...pendingPromotion, promotion: p });
            setPendingPromotion(null);
          }
        }}
        onCancel={() => setPendingPromotion(null)}
      />

      <AICoachPanel
        open={coachOpen}
        loading={coachLoading}
        error={coachError}
        analysis={analysis}
        onClose={() => setCoachOpen(false)}
        onRetry={handleAnalyze}
      />
    </div>
  );
};

function PlayerBar({
  label,
  side,
  active,
  thinking,
  difficulty,
  you,
}: {
  label: string;
  side: Side;
  active: boolean;
  thinking?: boolean;
  difficulty?: string;
  you?: boolean;
}) {
  return (
    <div
      className={`w-full max-w-[min(92vw,640px)] flex items-center justify-between rounded-xl px-4 py-2.5 transition-all ${
        active ? "bg-card border border-accent/40 shadow-soft" : "bg-card/40 border border-border/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-2xl leading-none ${
            side === "w" ? "bg-board-light text-neutral-900" : "bg-board-dark text-white"
          }`}
        >
          {side === "w" ? "♔" : "♚"}
        </div>
        <div className="leading-tight">
          <p className="font-display text-base font-semibold tracking-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground">
            {you ? "Human" : difficulty ? `AI · ${difficulty}` : "AI"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {thinking && <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />}
        <span className={`text-[10px] tracking-widest uppercase ${active ? "text-accent" : "text-muted-foreground"}`}>
          {active ? "to move" : "waiting"}
        </span>
      </div>
    </div>
  );
}

export default Index;
