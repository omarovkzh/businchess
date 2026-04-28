import { Timer } from "lucide-react";

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GameClock({
  whiteMs,
  blackMs,
  activeSide,
  orientation,
}: {
  whiteMs: number;
  blackMs: number;
  activeSide: "w" | "b" | null;
  orientation: "w" | "b";
}) {
  const top = orientation === "w" ? "b" : "w";
  const bottom = orientation;
  const value = (s: "w" | "b") => (s === "w" ? whiteMs : blackMs);

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <ClockChip ms={value(top)} active={activeSide === top} />
      <ClockChip ms={value(bottom)} active={activeSide === bottom} />
    </div>
  );
}

function ClockChip({ ms, active }: { ms: number; active: boolean }) {
  const low = ms < 30_000;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 border tabular-nums font-mono text-sm transition-all ${
        active
          ? low
            ? "bg-destructive/15 border-destructive/50 text-destructive"
            : "bg-accent/15 border-accent/40 text-accent"
          : "bg-card/40 border-border/60 text-muted-foreground"
      }`}
    >
      <Timer className="h-3.5 w-3.5 opacity-70" />
      <span className="font-semibold">{formatTime(ms)}</span>
    </div>
  );
}
