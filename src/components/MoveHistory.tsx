import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MoveHistoryProps {
  history: string[]; // SAN moves
}

export function MoveHistory({ history }: MoveHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length]);

  const pairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: history[i], black: history[i + 1] });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Moves</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {history.length} ply
        </span>
      </div>

      <ScrollArea className="flex-1 -mr-2 pr-2">
        {pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            The board awaits your opening.
          </p>
        ) : (
          <ol className="space-y-0.5 font-mono text-sm">
            {pairs.map((p) => (
              <li
                key={p.num}
                className="grid grid-cols-[2.25rem_1fr_1fr] gap-2 items-center px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors"
              >
                <span className="text-muted-foreground tabular-nums">{p.num}.</span>
                <span className="font-medium">{p.white}</span>
                <span className="font-medium text-muted-foreground">{p.black ?? ""}</span>
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </ScrollArea>
    </div>
  );
}
