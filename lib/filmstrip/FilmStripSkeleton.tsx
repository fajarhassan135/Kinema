"use client";
import { getFilmStripPath } from "../../lib/filmStripPath";

const FRAME_WIDTH = 180;
const FRAME_HEIGHT = 130;

export default function FilmStripSkeleton() {
  const points = getFilmStripPath({
    count: 14,
    spacingX: 220,
    amplitudeY: 160,
    amplitudeZ: 260,
    frequency: 0.6,
  });

  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        height: "70vh",
        position: "relative",
        overflow: "hidden",
        perspective: "1400px",
        background: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transformStyle: "preserve-3d",
        }}
      >
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: FRAME_WIDTH,
              height: FRAME_HEIGHT,
              marginLeft: -FRAME_WIDTH / 2,
              marginTop: -FRAME_HEIGHT / 2,
              background: "#3a3a3a",
              border: "6px solid #000",
              outline: "2px solid #555",
              transform: `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateY(${p.rotateY}deg)`,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
      </div>
    </div>
  );
}