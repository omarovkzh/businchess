import { Chess, Square, type Move } from "chess.js";
import { useMemo, useState } from "react";
import { PIECE_GLYPHS, pieceKey } from "@/lib/pieces";
import { cn } from "@/lib/utils";

interface BoardProps {
  game: Chess;
  orientation: "w" | "b";
  onMove: (move: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }) => void;
  lastMove?: { from: Square; to: Square } | null;
  disabled?: boolean;
  onPromotionNeeded: (from: Square, to: Square) => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function Board({ game, orientation, onMove, lastMove, disabled, onPromotionNeeded }: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);

  const files = orientation === "w" ? FILES : [...FILES].reverse();
  const ranks = orientation === "w" ? RANKS : [...RANKS].reverse();

  const board = game.board();
  const turn = game.turn();
  const inCheck = game.inCheck();

  const legalMoves: Move[] = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) as Move[] : []),
    [selected, game],
  );
  const legalTargets = new Set(legalMoves.map((m) => m.to));

  const kingSquare: Square | null = useMemo(() => {
    if (!inCheck) return null;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          return (FILES[f] + (8 - r)) as Square;
        }
      }
    }
    return null;
  }, [board, inCheck, turn]);

  const handleClick = (square: Square) => {
    if (disabled) return;
    const piece = game.get(square);

    if (selected && legalTargets.has(square)) {
      const moveData = legalMoves.find((m) => m.to === square)!;
      if (moveData.promotion) {
        onPromotionNeeded(selected, square);
      } else {
        onMove({ from: selected, to: square });
      }
      setSelected(null);
      return;
    }

    if (piece && piece.color === turn) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="relative w-full max-w-[min(92vw,640px)] aspect-square rounded-2xl bg-[hsl(var(--board-frame))] p-3 sm:p-4 shadow-elegant animate-scale-in">
      {/* File labels top */}
      <div className="absolute inset-x-3 sm:inset-x-4 top-0.5 flex justify-around text-[10px] sm:text-xs font-medium text-[hsl(var(--board-light))]/70 tracking-wider uppercase">
        {files.map((f) => <span key={`t-${f}`}>{f}</span>)}
      </div>
      <div className="absolute inset-x-3 sm:inset-x-4 bottom-0.5 flex justify-around text-[10px] sm:text-xs font-medium text-[hsl(var(--board-light))]/70 tracking-wider uppercase">
        {files.map((f) => <span key={`b-${f}`}>{f}</span>)}
      </div>
      <div className="absolute inset-y-3 sm:inset-y-4 left-0.5 flex flex-col justify-around text-[10px] sm:text-xs font-medium text-[hsl(var(--board-light))]/70">
        {ranks.map((r) => <span key={`l-${r}`}>{r}</span>)}
      </div>
      <div className="absolute inset-y-3 sm:inset-y-4 right-0.5 flex flex-col justify-around text-[10px] sm:text-xs font-medium text-[hsl(var(--board-light))]/70">
        {ranks.map((r) => <span key={`r-${r}`}>{r}</span>)}
      </div>

      <div className="board-grid w-full h-full overflow-hidden rounded-md">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = (file + rank) as Square;
            const fileIdx = FILES.indexOf(file);
            const rankIdx = 8 - rank;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const piece = board[rankIdx][fileIdx];
            const isSelected = selected === square;
            const isLegal = legalTargets.has(square);
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = kingSquare === square;
            const isCapture = isLegal && !!piece;

            return (
              <button
                key={square}
                onClick={() => handleClick(square)}
                className={cn(
                  "relative flex items-center justify-center transition-colors duration-150 select-none",
                  isLight ? "bg-board-light" : "bg-board-dark",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                )}
                aria-label={square}
              >
                {isLast && (
                  <div className="absolute inset-0 bg-[hsl(var(--square-last)/0.35)]" />
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-[hsl(var(--square-selected)/0.45)]" />
                )}
                {isCheck && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--square-check)/0.7),transparent_70%)]" />
                )}

                {piece && (
                  <span
                    className={cn(
                      "relative z-10 piece-shadow leading-none",
                      "text-[clamp(1.6rem,7.5vw,3.6rem)]",
                      piece.color === "w" ? "text-white" : "text-neutral-900",
                    )}
                    style={{ textShadow: piece.color === "w" ? "0 0 1px rgba(0,0,0,0.6)" : "0 0 1px rgba(255,255,255,0.4)" }}
                  >
                    {PIECE_GLYPHS[pieceKey(piece.color, piece.type)]}
                  </span>
                )}

                {isLegal && !isCapture && (
                  <div className="move-dot absolute z-20" />
                )}
                {isLegal && isCapture && (
                  <div className="capture-ring z-20" />
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
