import { useEffect, useRef, useState } from "react";

// Loads Stockfish as a Web Worker from CDN. Falls back to a simple random-move engine
// if the worker fails to load (offline / CSP), so the app stays playable.

type BestMoveCallback = (move: { from: string; to: string; promotion?: string }) => void;

const HARD_TIMEOUT_MS = 2000;

const STOCKFISH_URL = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef<BestMoveCallback | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestStartRef = useRef<number>(0);
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
            const elapsed = requestStartRef.current ? Date.now() - requestStartRef.current : 0;
            console.log(`[Stockfish] bestmove received: ${mv} (${elapsed}ms)`);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            if (mv && mv !== "(none)" && callbackRef.current) {
              const cb = callbackRef.current;
              callbackRef.current = null;
              cb({
                from: mv.slice(0, 2),
                to: mv.slice(2, 4),
                promotion: mv.length > 4 ? mv.slice(4, 5) : undefined,
              });
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
    movetime: number,
    cb: BestMoveCallback,
  ) => {
    callbackRef.current = cb;

    if (usingFallback || !workerRef.current) {
      callbackRef.current = null;
      cb({ from: "", to: "" });
      return;
    }

    const w = workerRef.current;
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${Math.max(100, Math.min(5000, movetime))}`);
  };

  return { ready, usingFallback, requestMove };
}
