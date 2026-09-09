"use client";
import { useCallback, useRef, useState } from "react";
import { playButtonPress } from "../lib/tvAudio";

type Pick = { id: string; title: string; posterPath: string | null };

const SPIN_MS = 2400;

/**
 * "Can't decide?" — cycles through the watchlist like a slot reel and stops on
 * one film.
 *
 * The reel decelerates rather than running at a constant speed: intervals grow
 * on a curve, so it feels like something with weight coming to rest instead of
 * a timer expiring.
 */
export default function SpinTheReel({ items }: { items: Pick[] }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState<Pick | null>(null);
  const [landed, setLanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spin = useCallback(() => {
    if (spinning || items.length === 0) return;
    playButtonPress(true);
    setSpinning(true);
    setLanded(false);

    // Decide the winner up front so the animation is pure decoration.
    const winner = items[Math.floor(Math.random() * items.length)];
    const started = performance.now();

    const step = () => {
      const elapsed = performance.now() - started;
      const progress = Math.min(elapsed / SPIN_MS, 1);

      if (progress >= 1) {
        setCurrent(winner);
        setSpinning(false);
        setLanded(true);
        playButtonPress(false);
        return;
      }

      setCurrent(items[Math.floor(Math.random() * items.length)]);
      // Ease-out cubic: 55ms between frames at the start, ~420ms at the end.
      const delay = 55 + 365 * Math.pow(progress, 3);
      timerRef.current = setTimeout(step, delay);
    };

    step();
  }, [items, spinning]);

  if (items.length === 0) return null;

  return (
    <div className="reel">
      <button
        type="button"
        className="btn btn-primary reel-btn"
        onClick={spin}
        disabled={spinning}
      >
        {spinning ? "Spinning…" : "Can't decide? Spin the reel"}
      </button>

      {current && (
        <div className={`reel-result${landed ? " has-landed" : ""}`} aria-live="polite">
          <span className="reel-poster">
            {current.posterPath ? (
              <img src={`https://image.tmdb.org/t/p/w185${current.posterPath}`} alt="" />
            ) : (
              <span className="reel-poster-empty" />
            )}
          </span>
          <span className="reel-copy">
            <span className="reel-label">{spinning ? "Picking…" : "Tonight you're watching"}</span>
            <span className="reel-title">{current.title}</span>
          </span>
        </div>
      )}
    </div>
  );
}
