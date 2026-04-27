// Unicode chess pieces with proper styling
import type { PieceSymbol, Color } from "chess.js";

export const PIECE_GLYPHS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

export const pieceKey = (color: Color, type: PieceSymbol) =>
  `${color}${type.toUpperCase()}`;

export const PIECE_NAMES: Record<string, string> = {
  k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn",
};
