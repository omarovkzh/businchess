import { Chess, type Square } from "chess.js";
import { useMemo } from "react";
import { PieceIcon } from "@/components/PieceIcon";
import { cn } from "@/lib/utils";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

interface ReplayBoardProps {
  fen: string;
  orientation?: "w" | "b";
  lastMove?: { from: Square; to: Square } | null;
  highlight?: { from: Square; to: Square } | null;
}

export function ReplayBoard({ fen, orientation = "w", lastMove, highlight }: ReplayBoardProps) {
  const chess = useMemo(() => {
    const c = new Chess();
    try { c.load(fen); } catch { /* noop */ }
    return c;
  }, [fen]);

  const board = chess.board();
  const files = orientation === "w" ? FILES : [...FILES].reverse();
  const ranks = orientation === "w" ? RANKS : [...RANKS].reverse();

  return (
    <div className="relative w-full aspect-square rounded-2xl bg-[hsl(var(--board-frame))] p-3 sm:p-4 shadow-elegant">
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
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isHi = highlight && (highlight.from === square || highlight.to === square);

            return (
              <div
                key={square}
                className={cn(
                  "relative w-full h-full overflow-hidden",
                  isLight ? "bg-board-light" : "bg-board-dark",
                )}
              >
                {isLast && (
                  <div className="absolute inset-0 bg-[hsl(var(--square-last)/0.35)]" />
                )}
                {isHi && (
                  <div className="absolute inset-0 ring-2 ring-inset ring-accent/80" />
                )}
                {piece && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center piece-shadow leading-none pointer-events-none">
                    <PieceIcon color={piece.color} type={piece.type} className="w-[88%] h-[88%]" />
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
