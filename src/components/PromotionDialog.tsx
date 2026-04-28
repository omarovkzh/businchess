import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PieceIcon } from "@/components/PieceIcon";
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
                "flex items-center justify-center p-2",
                "hover:bg-accent/10 hover:border-accent transition-all hover:scale-105 piece-shadow",
              )}
              aria-label={p}
            >
              <PieceIcon color={color} type={p} className="w-full h-full" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
