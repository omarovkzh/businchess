import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { MoveHistory } from "@/components/MoveHistory";
import { PromotionDialog } from "@/components/PromotionDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/hooks/useTheme";
import { useStockfish } from "@/hooks/useStockfish";
import { useSounds } from "@/hooks/useSounds";

import { GameOverDialog, type GameResult, type EndReason } from "@/components/GameOverDialog";
import { Moon, Sun, RotateCcw, Undo2, FlipVertical2, Sparkles, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { AICoachPanel, type Analysis } from "@/components/AICoachPanel";
import { supabase } from "@/integrations/supabase/client";

type Side = "w" | "b";

const DIFFICULTY_LEVELS = [
  { label: "Easy",   movetime: 500 },
  { label: "Medium", movetime: 800 },
  { label: "Hard",   movetime: 1200 },
];

const INITIAL_TIME_MS = 5 * 60 * 1000;

const Index = () => {
  const { theme, toggle } = useTheme();
  const [game, setGame] = useState(() => new Chess());
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [playerSide, setPlayerSide] = useState<Side>("w");
  const [orientation, setOrientation] = useState<Side>("w");
  const [difficulty, setDifficulty] = useState(1);
  const [pendingDifficulty, setPendingDifficulty] = useState(1);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  // Clock
  const [whiteMs, setWhiteMs] = useState(INITIAL_TIME_MS);
  const [blackMs, setBlackMs] = useState(INITIAL_TIME_MS);
  const [timeoutSide, setTimeoutSide] = useState<Side | null>(null);

  // Sounds
  const sounds = useSounds();
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { sounds.setEnabled(soundOn); }, [soundOn, sounds]);

  // Game-over modal
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const endHandledRef = useRef(false);

  const stockfish = useStockfish();
  const gameRef = useRef(game);
  gameRef.current = game;

  const history = game.history();
  const lastMove = useMemo(() => {
    const verbose = game.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    return last ? { from: last.from as Square, to: last.to as Square } : null;
  }, [game, history.length]);

  const isOver = game.isGameOver() || timeoutSide !== null;

  const status = useMemo(() => {
    if (timeoutSide) return { kind: "end" as const, text: `Time out — ${timeoutSide === "w" ? "Black" : "White"} wins` };
    if (game.isCheckmate()) return { kind: "end" as const, text: `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins` };
    if (game.isStalemate()) return { kind: "end" as const, text: "Stalemate — draw" };
    if (game.isInsufficientMaterial()) return { kind: "end" as const, text: "Draw — insufficient material" };
    if (game.isThreefoldRepetition()) return { kind: "end" as const, text: "Draw — threefold repetition" };
    if (game.isDraw()) return { kind: "end" as const, text: "Draw" };
    if (game.inCheck()) return { kind: "check" as const, text: `${game.turn() === "w" ? "White" : "Black"} in check` };
    return { kind: "turn" as const, text: `${game.turn() === "w" ? "White" : "Black"} to move` };
  }, [game, history.length, timeoutSide]);

  const isPlayerTurn = game.turn() === playerSide && !isOver;
  // Clock runs for the side to move whenever the game is in progress.
  const runningSide: Side | null = isOver ? null : game.turn();

  // Tick the clock
  useEffect(() => {
    if (!runningSide) return;
    const id = setInterval(() => {
      if (runningSide === "w") {
        setWhiteMs((ms) => Math.max(0, ms - 100));
      } else {
        setBlackMs((ms) => Math.max(0, ms - 100));
      }
    }, 100);
    return () => clearInterval(id);
  }, [runningSide]);

  // Detect timeout
  useEffect(() => {
    if (timeoutSide) return;
    if (whiteMs <= 0) setTimeoutSide("w");
    else if (blackMs <= 0) setTimeoutSide("b");
  }, [whiteMs, blackMs, timeoutSide]);

  const applyMove = useCallback((m: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }) => {
    const verbose = gameRef.current.history({ verbose: true });
    const fresh = new Chess();
    verbose.forEach((mv) => fresh.move({ from: mv.from, to: mv.to, promotion: mv.promotion }));
    try {
      const moved = fresh.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
      if (!moved) return false;

      // Sound feedback
      if (fresh.isCheckmate() || fresh.inCheck()) {
        sounds.playCheck();
      } else if (moved.captured) {
        sounds.playCapture();
      } else {
        sounds.playMove();
      }

      setGame(fresh);
      return true;
    } catch {
      return false;
    }
  }, [sounds]);

  // Trigger AI move
  useEffect(() => {
    if (isOver) return;
    if (game.turn() === playerSide) return;
    if (!stockfish.ready) return;

    setThinking(true);
    const cfg = DIFFICULTY_LEVELS[difficulty];
    const fen = game.fen();

    const handle = setTimeout(() => {
      stockfish.requestMove(fen, cfg.depth, (mv) => {
        if (!mv.from || !mv.to) {
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
  }, [game, playerSide, stockfish.ready, difficulty, applyMove, stockfish, isOver]);

  // Handle game end → modal + end sound
  useEffect(() => {
    if (status.kind === "end" && !endHandledRef.current) {
      endHandledRef.current = true;
      sounds.playEnd();
      // Slight delay so the final move sound plays first if both fire
      setTimeout(() => setGameOverOpen(true), 350);
      toast(status.text, { duration: 5000 });
    }
  }, [status, sounds]);

  // Game outcome for modal
  const { result, reason, moveCount } = useMemo<{ result: GameResult; reason: EndReason; moveCount: number }>(() => {
    const moves = history.length;
    if (timeoutSide) {
      return {
        result: timeoutSide === playerSide ? "ai" : "player",
        reason: "timeout",
        moveCount: moves,
      };
    }
    if (game.isCheckmate()) {
      // Player to move is the loser
      return {
        result: game.turn() === playerSide ? "ai" : "player",
        reason: "checkmate",
        moveCount: moves,
      };
    }
    if (game.isStalemate()) return { result: "draw", reason: "stalemate", moveCount: moves };
    if (game.isInsufficientMaterial()) return { result: "draw", reason: "insufficient", moveCount: moves };
    if (game.isThreefoldRepetition()) return { result: "draw", reason: "repetition", moveCount: moves };
    if (game.isDraw()) return { result: "draw", reason: "draw", moveCount: moves };
    return { result: "draw", reason: "draw", moveCount: moves };
  }, [game, history.length, timeoutSide, playerSide]);

  const handleNewGame = (side: Side = playerSide) => {
    setGame(new Chess());
    setPlayerSide(side);
    setOrientation(side);
    setDifficulty(pendingDifficulty);
    setThinking(false);
    setPendingPromotion(null);
    setCoachOpen(false);
    setAnalysis(null);
    setCoachError(null);
    setWhiteMs(INITIAL_TIME_MS);
    setBlackMs(INITIAL_TIME_MS);
    setTimeoutSide(null);
    setGameOverOpen(false);
    endHandledRef.current = false;
  };

  const gameInProgress = history.length > 0 && !isOver;

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

  const handleAnalyzeFromModal = async () => {
    setGameOverOpen(false);
    await handleAnalyze();
  };

  const handleUndo = () => {
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
        <div className="container mx-auto flex items-center justify-between py-3 sm:py-4 px-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
              <span className="font-display text-lg sm:text-xl font-semibold text-accent leading-none">♞</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl font-semibold tracking-tight leading-none truncate">Gambit</h1>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground tracking-wide uppercase mt-0.5">vs Stockfish</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundOn((s) => !s)}
              aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}
              aria-label="Flip board"
            >
              <FlipVertical2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-10">
        <div className="grid lg:grid-cols-[1fr_340px] gap-5 lg:gap-10 items-start">
          {/* Board side */}
          <div className="flex flex-col items-center gap-3 sm:gap-5">
            {/* Difficulty label */}
            <div className="w-full max-w-[min(96vw,640px)] flex items-center justify-center gap-2">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Difficulty</span>
              <span className="text-[11px] tracking-widest uppercase font-medium text-accent px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20">
                {DIFFICULTY_LEVELS[difficulty].label}
              </span>
            </div>

            {/* Top player + clock */}
            <div className="w-full max-w-[min(96vw,640px)] flex items-stretch gap-2 sm:gap-3">
              <PlayerBar
                label="Stockfish"
                side={playerSide === "w" ? "b" : "w"}
                active={game.turn() !== playerSide && !isOver}
                thinking={thinking}
                difficulty={DIFFICULTY_LEVELS[difficulty].label}
              />
              <ClockSingle
                ms={playerSide === "w" ? blackMs : whiteMs}
                active={game.turn() !== playerSide && !isOver}
              />
            </div>

            <Board
              game={game}
              orientation={orientation}
              onMove={handlePlayerMove}
              lastMove={lastMove}
              disabled={!isPlayerTurn}
              onPromotionNeeded={(from, to) => setPendingPromotion({ from, to })}
            />

            {/* Bottom player + clock */}
            <div className="w-full max-w-[min(96vw,640px)] flex items-stretch gap-2 sm:gap-3">
              <PlayerBar
                label="You"
                side={playerSide}
                active={isPlayerTurn}
                you
              />
              <ClockSingle
                ms={playerSide === "w" ? whiteMs : blackMs}
                active={isPlayerTurn}
              />
            </div>
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
              <p className={`font-display text-lg sm:text-xl font-semibold tracking-tight ${status.kind === "check" ? "text-destructive" : ""}`}>
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
                <Select
                  value={String(pendingDifficulty)}
                  onValueChange={(v) => setPendingDifficulty(Number(v))}
                  disabled={gameInProgress}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map((l, i) => (
                      <SelectItem key={l.label} value={String(i)}>
                        {l.label} <span className="text-muted-foreground">· depth {l.depth}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {gameInProgress
                  ? <p className="text-[11px] text-muted-foreground">Applies on next new game.</p>
                  : pendingDifficulty !== difficulty
                    ? <p className="text-[11px] text-accent">Starts on next new game.</p>
                    : null}
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
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex-1 min-h-[220px] max-h-[420px] flex flex-col">
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

      <GameOverDialog
        open={gameOverOpen}
        result={result}
        reason={reason}
        moveCount={moveCount}
        onNewGame={() => handleNewGame(playerSide)}
        onAnalyze={handleAnalyzeFromModal}
        analyzing={coachLoading}
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
      className={`flex-1 min-w-0 flex items-center justify-between rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 transition-all ${
        active ? "bg-card border border-accent/40 shadow-soft" : "bg-card/40 border border-border/60"
      }`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xl sm:text-2xl leading-none shrink-0 ${
            side === "w" ? "bg-board-light text-neutral-900" : "bg-board-dark text-white"
          }`}
        >
          {side === "w" ? "♔" : "♚"}
        </div>
        <div className="leading-tight min-w-0">
          <p className="font-display text-sm sm:text-base font-semibold tracking-tight truncate">{label}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
            {you ? "Human" : difficulty ? `AI · ${difficulty}` : "AI"}
          </p>
        </div>
      </div>
      {thinking && <span className="h-2 w-2 rounded-full bg-accent animate-pulse shrink-0 ml-2" />}
    </div>
  );
}

function ClockSingle({ ms, active }: { ms: number; active: boolean }) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const formatted = `${m}:${s.toString().padStart(2, "0")}`;
  const low = ms < 30_000;

  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 border tabular-nums font-mono text-lg sm:text-xl font-semibold transition-all ${
        active
          ? low
            ? "bg-destructive/10 border-destructive/50 text-destructive"
            : "bg-accent/10 border-accent/40 text-accent shadow-soft"
          : "bg-card/40 border-border/60 text-muted-foreground"
      }`}
      aria-label="Clock"
    >
      {formatted}
    </div>
  );
}

export default Index;
