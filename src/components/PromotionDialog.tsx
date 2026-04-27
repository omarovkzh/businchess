import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PIECE_GLYPHS } from "@/lib/pieces";
import { cn } from "@/lib/utils";

interface PromotionDialogProps {
  open: boolean;
  color: "w" | "b";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const CHOICES: Array<"q" | "r" | "b" | "n"> = ["q", "r", "b", "n"];

export function PromotionDialog({ open, color, onSelect, onCancel }: PromotionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Promote pawn</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 pt-2">
          {CHOICES.map((p) => (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className={cn(
                "aspect-square rounded-xl border border-border bg-secondary/60",
                "flex items-center justify-center text-5xl",
                "hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all",
                "hover:scale-105 piece-shadow",
                color === "w" ? "text-foreground" : "text-foreground",
              )}
              aria-label={p}
            >
              {PIECE_GLYPHS[`${color}${p.toUpperCase()}`]}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
