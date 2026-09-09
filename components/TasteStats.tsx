"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` when the panel first appears.
 *
 * A number that ticks up reads as a tally being totted; one that just appears
 * reads as a static label. Duration is fixed rather than per-unit so 3 and 300
 * take the same time to land.
 */
function useCountUp(value: number, durationMs = 900) {
  // Storing the target alongside the count lets a changed target reset during
  // render, so the effect never calls setState synchronously.
  const [state, setState] = useState({ target: value, shown: 0 });
  const shown = state.target === value ? state.shown : 0;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) return;
    const started = performance.now();
    const tick = () => {
      const progress = Math.min((performance.now() - started) / durationMs, 1);
      // Ease-out cubic, so it sprints then settles.
      const eased = 1 - Math.pow(1 - progress, 3);
      setState({ target: value, shown: Math.round(value * eased) });
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return shown;
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const shown = useCountUp(value);
  return (
    <div className="stat">
      <span className="stat-value">{shown}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

/**
 * Describes the user's rating habit in plain terms.
 *
 * Only ever derived from ratings they actually gave — nothing here is invented,
 * and it says so honestly when there is not enough to go on.
 */
function criticBadge(ratings: number[]): { title: string; blurb: string } | null {
  if (ratings.length < 3) return null;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  if (avg >= 4.3) {
    return { title: "Easily delighted", blurb: `You average ${avg.toFixed(1)} stars. Everything is someone's favourite.` };
  }
  if (avg <= 2.4) {
    return { title: "Tough crowd", blurb: `You average ${avg.toFixed(1)} stars. Films have to earn it with you.` };
  }
  return { title: "Fair and balanced", blurb: `You average ${avg.toFixed(1)} stars across ${ratings.length} reviews.` };
}

export default function TasteStats({
  watchlistCount,
  watchedCount,
  reviewsCount,
  favouritesCount,
  ratings,
}: {
  watchlistCount: number;
  watchedCount: number;
  reviewsCount: number;
  favouritesCount: number;
  ratings: number[];
}) {
  const badge = criticBadge(ratings);

  // Buckets 1..5. The tallest bar sets the scale so a small sample still reads.
  const buckets = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: ratings.filter((r) => Math.round(r) === star).length,
  }));
  const tallest = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <section className="taste" aria-labelledby="taste-title">
      <div className="row-head" style={{ marginBottom: "var(--space-4)" }}>
        <span className="stamp">Your taste</span>
        <h2 id="taste-title" className="section-title">
          The tally so far
        </h2>
      </div>

      <div className="stat-row">
        <Stat label="On the watchlist" value={watchlistCount} />
        <Stat label="Watched" value={watchedCount} />
        <Stat label="Reviews written" value={reviewsCount} />
        <Stat label="Favourites" value={favouritesCount} hint="max 5" />
      </div>

      {ratings.length > 0 ? (
        <div className="rating-chart">
          <h3 className="rating-chart-title">How you rate</h3>
          <ul className="rating-bars">
            {buckets.map(({ star, count }, i) => (
              <li key={star} className="rating-bar-row">
                <span className="rating-bar-label">
                  {star}
                  <span aria-hidden="true">★</span>
                </span>
                <span className="rating-bar-track">
                  <span
                    className="rating-bar-fill"
                    style={{
                      // Zero stays visible as a sliver so the row is not a gap.
                      width: `${count === 0 ? 1.5 : (count / tallest) * 100}%`,
                      animationDelay: `${i * 90}ms`,
                    }}
                  />
                </span>
                <span className="rating-bar-count">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="taste-empty">
          Rate a few films and your habits will show up here.
        </p>
      )}

      {badge && (
        <div className="critic-badge">
          <span className="critic-badge-title">{badge.title}</span>
          <span className="critic-badge-blurb">{badge.blurb}</span>
        </div>
      )}
    </section>
  );
}
