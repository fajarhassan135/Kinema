"use client";
import { useEffect, useRef, useState } from "react";

type Flash = { id: number; x: number; y: number };

export default function CustomCursor() {
  const cursorRef = useRef<HTMLImageElement>(null);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 2}px, ${e.clientY - 4}px)`;
      }
    }
    function handleClick(e: MouseEvent) {
      const id = nextId.current++;
      setFlashes((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.id !== id));
      }, 400);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <>
      <img
        ref={cursorRef}
        src="/camera_cursor.png"
        alt=""
        style={{
          position: "fixed", top: 0, left: 0, width: 20, height: 20,
          pointerEvents: "none", zIndex: 9999, transform: "translate(-9999px, -9999px)",
        }}
      />
      {flashes.map((f) => (
        <img
          key={f.id}
          src="/flash_burst.png"
          alt=""
          style={{
            position: "fixed", top: f.y - 60, left: f.x - 60, width: 120, height: 120,
            pointerEvents: "none", zIndex: 9998,
            animation: "flash-fade 0.4s ease-out forwards",
          }}
        />
      ))}
      <style jsx global>{`
        body, a, button, [role="button"] { cursor: none !important; }
        input, textarea, select { cursor: auto !important; }
        @keyframes flash-fade {
          0% { opacity: 1; transform: scale(0.6); }
          100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>
    </>
  );
}