import { useEffect, useRef, useState } from "react";

// Loads Stockfish as a Web Worker from CDN. Falls back to a simple random-move engine
// if the worker fails to load (offline / CSP), so the app stays playable.

type BestMoveCallback = (move: { from: string; to: string; promotion?: string }) => void;

const STOCKFISH_URL = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef<BestMoveCallback | null>(null);
  const [ready, setReady] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;

    const init = async () => {
      try {
        // Build a tiny loader worker that imports Stockfish from CDN
        const loader = `importScripts(${JSON.stringify(STOCKFISH_URL)});`;
        const blob = new Blob([loader], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);

        worker.onmessage = (e: MessageEvent<string>) => {
          const line = typeof e.data === "string" ? e.data : "";
          if (line.startsWith("uciok")) {
            worker?.postMessage("isready");
          } else if (line.startsWith("readyok")) {
            if (!cancelled) setReady(true);
          } else if (line.startsWith("bestmove")) {
            const parts = line.split(" ");
            const mv = parts[1];
            if (mv && mv !== "(none)" && callbackRef.current) {
              callbackRef.current({
                from: mv.slice(0, 2),
                to: mv.slice(2, 4),
                promotion: mv.length > 4 ? mv.slice(4, 5) : undefined,
              });
              callbackRef.current = null;
            }
          }
        };

        worker.onerror = () => {
          if (!cancelled) {
            setUsingFallback(true);
            setReady(true);
          }
        };

        worker.postMessage("uci");
        workerRef.current = worker;
      } catch {
        if (!cancelled) {
          setUsingFallback(true);
          setReady(true);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      try {
        worker?.postMessage("quit");
      } catch { /* noop */ }
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestMove = (
    fen: string,
    skill: number,
    movetimeMs: number,
    cb: BestMoveCallback,
  ) => {
    callbackRef.current = cb;

    if (usingFallback || !workerRef.current) {
      // Fallback handled by caller (random legal move). Signal via cb=null marker.
      callbackRef.current = null;
      cb({ from: "", to: "" });
      return;
    }

    const w = workerRef.current;
    w.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, skill))}`);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${movetimeMs}`);
  };

  return { ready, usingFallback, requestMove };
}
