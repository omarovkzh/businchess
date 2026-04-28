import { useCallback, useEffect, useRef } from "react";

// Subtle Web Audio sound effects — no external files.
// - move: short soft "tock"
// - capture: slightly deeper, two-stage thud
// - check: warmer two-note alert

export function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => { /* noop */ });
    }
    return ctxRef.current;
  }, []);

  // Resume audio on first user gesture (browser autoplay policies)
  useEffect(() => {
    const handler = () => getCtx();
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [getCtx]);

  const tone = useCallback(
    (
      freq: number,
      duration: number,
      {
        type = "sine" as OscillatorType,
        gain = 0.12,
        attack = 0.005,
        release = 0.08,
        delay = 0,
      } = {},
    ) => {
      const ctx = getCtx();
      if (!ctx || !enabledRef.current) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + release);
    },
    [getCtx],
  );

  const playMove = useCallback(() => {
    tone(420, 0.09, { type: "triangle", gain: 0.10 });
    tone(260, 0.12, { type: "sine", gain: 0.06, delay: 0.005 });
  }, [tone]);

  const playCapture = useCallback(() => {
    tone(180, 0.14, { type: "square", gain: 0.08 });
    tone(110, 0.18, { type: "triangle", gain: 0.10, delay: 0.02 });
  }, [tone]);

  const playCheck = useCallback(() => {
    tone(660, 0.12, { type: "triangle", gain: 0.11 });
    tone(880, 0.16, { type: "sine", gain: 0.10, delay: 0.09 });
  }, [tone]);

  const playEnd = useCallback(() => {
    tone(523, 0.18, { type: "sine", gain: 0.10 });
    tone(392, 0.22, { type: "sine", gain: 0.09, delay: 0.12 });
    tone(330, 0.32, { type: "sine", gain: 0.09, delay: 0.24 });
  }, [tone]);

  const setEnabled = useCallback((v: boolean) => {
    enabledRef.current = v;
  }, []);

  return { playMove, playCapture, playCheck, playEnd, setEnabled };
}
