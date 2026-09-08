"use client";

export default function HeroIntro() {
  const heading = "Welcome to Kinema";
  const words = heading.split(" ");

  return (
    <div style={{ textAlign: "center", padding: "60px 24px 20px" }}>
      <h1 style={{ fontSize: "2.2rem", fontFamily: "'Times New Roman', serif", marginBottom: 16 }}>
        {/* The trailing space keeps the accessible name as
            "Welcome to Kinema" rather than one run-together word. */}
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: 12,
              opacity: 0,
              animation: `fall-into-place 0.6s ease-out forwards`,
              animationDelay: `${i * 0.15}s`,
            }}
          >
            {word === "Kinema" ? <span style={{ color: "#6b0016" }}>{word}</span> : word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </h1>
      <p
        style={{
          color: "#bdbdbd",
          fontSize: "1.05rem",
          maxWidth: 560,
          margin: "0 auto",
          opacity: 0,
          animation: "fade-in 0.8s ease-out forwards",
          animationDelay: `${words.length * 0.15 + 0.3}s`,
        }}
      >
        A living reel of the films that shaped us — quietly turning, one frame at a time.
      </p>

      <style jsx>{`
        @keyframes fall-into-place {
          0% {
            opacity: 0;
            transform: translateY(-40px);
          }
          60% {
            opacity: 1;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}