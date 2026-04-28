import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RotateCcw, Trophy, Handshake, Flag } from "lucide-react";

export type GameResult = "player" | "ai" | "draw";
export type EndReason = "checkmate" | "stalemate" | "timeout" | "draw" | "insufficient" | "repetition";

export function GameOverDialog({
  open,
  result,
  reason,
  moveCount,
  onNewGame,
  onAnalyze,
  analyzing,
}: {
  open: boolean;
  result: GameResult;
  reason: EndReason;
  moveCount: number;
  onNewGame: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const { title, body, Icon, tone } = describe(result, reason);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-border [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className={`px-6 pt-7 pb-5 ${tone.bg} border-b border-border`}>
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tone.iconBg} border ${tone.iconBorder}`}>
              <Icon className={`h-6 w-6 ${tone.icon}`} />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-center">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground text-center">
                {body}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Moves" value={String(moveCount)} />
            <Stat label="Outcome" value={reasonLabel(reason)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={onNewGame}
              className="font-medium"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> New Game
            </Button>
            <Button
              onClick={onAnalyze}
              disabled={analyzing || moveCount === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {analyzing ? "Analyzing…" : "Analyze with AI Coach"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5">
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tracking-tight mt-0.5">{value}</p>
    </div>
  );
}

function reasonLabel(r: EndReason) {
  switch (r) {
    case "checkmate": return "Checkmate";
    case "stalemate": return "Stalemate";
    case "timeout": return "Time out";
    case "insufficient": return "Insufficient material";
    case "repetition": return "Threefold repetition";
    case "draw": return "Draw";
  }
}

function describe(result: GameResult, reason: EndReason) {
  if (result === "player") {
    return {
      title: "You win",
      body: `Stockfish loses by ${reasonLabel(reason).toLowerCase()}.`,
      Icon: Trophy,
      tone: {
        bg: "bg-accent/10",
        iconBg: "bg-accent/20",
        iconBorder: "border-accent/40",
        icon: "text-accent",
      },
    };
  }
  if (result === "ai") {
    return {
      title: "Stockfish wins",
      body: `You lose by ${reasonLabel(reason).toLowerCase()}.`,
      Icon: Flag,
      tone: {
        bg: "bg-destructive/10",
        iconBg: "bg-destructive/20",
        iconBorder: "border-destructive/40",
        icon: "text-destructive",
      },
    };
  }
  return {
    title: "Draw",
    body: `The game ended in a draw — ${reasonLabel(reason).toLowerCase()}.`,
    Icon: Handshake,
    tone: {
      bg: "bg-muted/40",
      iconBg: "bg-muted",
      iconBorder: "border-border",
      icon: "text-foreground",
    },
  };
}
