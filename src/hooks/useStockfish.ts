import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Loads Stockfish as a Web Worker from CDN. Falls back to a simple random-move engine
// if the worker fails to load (offline / CSP), so the app stays playable.

type BestMoveCallback = (move: { from: string; to: string; promotion?: string }) => void;

const HARD_TIMEOUT_MS = 3000;

const STOCKFISH_URL = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

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

  const requestMove = useCallback((
    fen: string,
    movetime: number,
    cb: BestMoveCallback,
  ) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    callbackRef.current = cb;

    if (usingFallback || !workerRef.current) {
      console.log("[Stockfish] using fallback (random move)");
      callbackRef.current = null;
      cb({ from: "", to: "" });
      return;
    }

    const mt = 800;
    const w = workerRef.current;
    requestStartRef.current = Date.now();
    console.log(`[Stockfish] sending: go movetime ${mt}`);
    w.postMessage("ucinewgame");
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${mt}`);

    // Hard timeout: if no response in 3s, force a random legal move via empty callback
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (!callbackRef.current) return;
      console.warn(`[Stockfish] HARD TIMEOUT after ${HARD_TIMEOUT_MS}ms — forcing fallback move`);
      try {
        w.postMessage("stop");
      } catch { /* noop */ }
      const cbNow = callbackRef.current;
      callbackRef.current = null;
      cbNow({ from: "", to: "" });
    }, HARD_TIMEOUT_MS);
  }, [usingFallback]);

  return useMemo(() => ({ ready, usingFallback, requestMove }), [ready, usingFallback, requestMove]);
}
