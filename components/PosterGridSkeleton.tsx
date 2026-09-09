"use client";

/**
 * Placeholder cards shown while a grid loads.
 *
 * Better than a "Loading…" line: the page keeps its shape, so nothing jumps
 * when the real posters arrive.
 */
export default function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="poster-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="poster-skeleton" style={{ animationDelay: `${(i % 6) * 90}ms` }}>
          <div className="poster-skeleton-frame" />
          <div className="poster-skeleton-line" />
          <div className="poster-skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
