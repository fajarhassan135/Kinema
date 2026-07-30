"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { HOMEPAGE_FILMS } from "@/lib/homepageFilms";

type PosterData = {
  posterUrl: string | null;
  film: string;
};

type Stage = "neutral" | "happy" | "greeting";

const STAGE_DURATIONS: Partial<Record<Stage, number>> = {
  neutral: 1400,
  happy: 1400,
};

const TYPE_CHAR_MS = 32;
const HI_HOLD_MS = 1100;
const WELCOME_HOLD_MS = 1400;
const GLITCH_MS = 320;

const CHARACTER_SRC = "/character/banner.png";

// Measured directly off banner.png via connected-component analysis.
// Percent convention: relative to the square stage.
const SCREEN_BOX_PCT = { x: 27.4, y: 11.4, w: 49.4, h: 33.8 };
const BANNER_BOX_PCT = { x: 10.7, y: 58.6, w: 80.7, h: 30.1 };

const QUOTE_MAP: Record<string, string> = {
  "The Notebook": "I am nothing special, of this I am sure.",
  "La La Land": "Here's to the fools who dream.",
  "Crazy Rich Asians": "It's not my job to make you feel like a man.",
  "Superbad": "I am McLovin.",
  "The Grand Budapest Hotel": "Rudeness is merely an expression of fear.",
  "Mad Max: Fury Road": "What a lovely day!",
  "John Wick": "Yeah. I'm thinking I'm back.",
  "Inception": "You mustn't be afraid to dream a little bigger, darling.",
  "Interstellar": "Do not go gentle into that good night.",
  "Dune": "Fear is the mind-killer.",
};

// Real distortion this time: a buzzy low-frequency source pushed through
// a WaveShaperNode with a hard-clipping curve. That's the actual technique
// for harmonic distortion (adds overtones via nonlinear clipping) — a
// harsh, gritty, buzzing crunch, not just a clean filtered noise sweep.
// Duration matches GLITCH_MS so it's synced to the visual static overlay.
function makeClippingCurve(amount: number) {
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function playChannelDistortion() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const dur = GLITCH_MS / 1000;
    const now = ctx.currentTime;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeClippingCurve(650);
    shaper.oversample = "4x";

    // Buzzy source: a sawtooth with unstable, jittering pitch (like a
    // signal that can't hold a lock) — this is what gives the clipped
    // result its "old TV losing channel" character rather than just
    // sounding like a fuzz pedal.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, now);
    for (let t = 0; t < dur; t += 0.02) {
      osc.frequency.setValueAtTime(60 + Math.random() * 180, now + t);
    }

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = "bandpass";
    toneFilter.Q.value = 0.6;
    toneFilter.frequency.setValueAtTime(1800, now);
    toneFilter.frequency.exponentialRampToValueAtTime(220, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(shaper).connect(toneFilter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  } catch {
    // no-op
  }
}

// Relay-clack: two quick clicks in succession, like a real mechanical
// switch engaging — ascending pitch on ON, descending on OFF.
function playClick(on: boolean) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const freqs = on ? [340, 560] : [560, 340];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      const t0 = now + i * 0.045;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.04);
    });
  } catch {
    // Web Audio unavailable — fail silently, this is a nice-to-have.
  }
}

export default function FilmStripHero() {
  const [isOn, setIsOn] = useState(false);
  const [stage, setStage] = useState<Stage>("neutral");
  const [posters, setPosters] = useState<PosterData[]>([]);
  const [posterIndex, setPosterIndex] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [greetingPopKey, setGreetingPopKey] = useState(0);
  const [bannerText, setBannerText] = useState("");
  const [hasGreeted, setHasGreeted] = useState(false);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = CHARACTER_SRC;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        HOMEPAGE_FILMS.map(async (f) => {
          try {
            const res = await fetch(`/api/movies?type=by_id&id=${f.tmdbId}`);
            const data = await res.json();
            const imagePath = data.movie?.poster_path || data.movie?.backdrop_path || null;
            return {
              posterUrl: imagePath
                ? `/api/proxy-image?url=${encodeURIComponent(`https://image.tmdb.org/t/p/w780${imagePath}`)}`
                : null,
              film: f.film,
            };
          } catch {
            return { posterUrl: null, film: f.film };
          }
        })
      );
      if (!cancelled) setPosters(results.filter((p) => p.posterUrl));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOn) return;
    const order: Stage[] = ["neutral", "happy", "greeting"];
    const currentIndex = order.indexOf(stage);
    if (currentIndex === -1 || currentIndex === order.length - 1) return;
    const duration = STAGE_DURATIONS[stage] ?? 1400;
    advanceTimerRef.current = setTimeout(() => setStage(order[currentIndex + 1]), duration);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [stage, isOn]);

  const typeText = useCallback((text: string, setter: (t: string) => void, onDone?: () => void) => {
    setter("");
    let i = 0;
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    typeTimerRef.current = setInterval(() => {
      i += 1;
      setter(text.slice(0, i));
      if (i >= text.length) {
        if (typeTimerRef.current) clearInterval(typeTimerRef.current);
        onDone?.();
      }
    }, TYPE_CHAR_MS);
  }, []);

  useEffect(() => {
    if (!isOn || stage !== "greeting" || hasGreeted) return;
    setGreetingPopKey((k) => k + 1);
    typeText("Hi!", setGreetingText, () => {
      seqTimerRef.current = setTimeout(() => {
        setGreetingPopKey((k) => k + 1);
        typeText("Welcome nerd", setGreetingText, () => {
          seqTimerRef.current = setTimeout(() => {
            setGreetingText("");
            setHasGreeted(true);
          }, WELCOME_HOLD_MS);
        });
      }, HI_HOLD_MS);
    });
    return () => {
      if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, hasGreeted, isOn]);

  useEffect(() => {
    if (!isOn || !hasGreeted || posters.length === 0) return;
    const film = posters[posterIndex]?.film ?? "";
    typeText(QUOTE_MAP[film] ?? "This one's a favorite of mine.", setBannerText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOn, hasGreeted, posterIndex, posters]);

  const changeChannel = useCallback((direction: 1 | -1) => {
    if (!isOn || !hasGreeted || isGlitching || posters.length === 0) return;
    playChannelDistortion();
    setIsGlitching(true);
    glitchTimerRef.current = setTimeout(() => {
      setPosterIndex((i) => (i + direction + posters.length) % posters.length);
      setIsGlitching(false);
    }, GLITCH_MS);
  }, [isOn, hasGreeted, isGlitching, posters.length]);

  const togglePower = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);

    setIsOn((wasOn) => {
      playClick(!wasOn);
      if (wasOn) {
        setStage("neutral");
        setHasGreeted(false);
        setGreetingText("");
        setBannerText("");
        setPosterIndex(0);
        setIsGlitching(false);
        return false;
      }
      setStage("neutral");
      return true;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
      if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const showScreen = isOn && stage === "greeting";
  const currentPoster = posters[posterIndex];

  return (
    <div
      style={{
        width: "100%",
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "#000",
        padding: "24px",
      }}
    >
      <style>{`
        .pixelated-sprite { image-rendering: pixelated; }

        /* Character is ALWAYS visible now, on or off — off just looks
           powered-down (dim/desaturated), like a real TV, instead of
           vanishing. Smooth, consistent transition either direction. */
        .char-wrap {
          transition: filter 500ms ease, opacity 500ms ease;
          filter: grayscale(0) brightness(1);
        }
        .char-wrap.tv-off { filter: grayscale(0.75) brightness(0.42); }

        @keyframes charBreathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1.2%) scale(1.008); }
        }
        .char-breathe { animation: charBreathe 3.2s ease-in-out infinite; transform-origin: 50% 100%; }

        .screen-text {
          color: #f2d9a0;
          font-family: monospace;
          font-weight: 700;
          font-size: clamp(0.9rem, 2.2vw, 1.4rem);
          text-shadow: 0 0 10px rgba(212,175,97,0.85), 0 0 3px #000;
          position: relative;
          z-index: 1;
        }

        /* Cinema-glow behind the greeting — a warm gold/maroon pulse
           instead of flat black, so it feels like a theater screen. */
        .greeting-glow {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(212,175,97,0.4), rgba(122,32,32,0.28) 55%, rgba(0,0,0,0.92) 100%);
          animation: greetingGlowPulse 2.6s ease-in-out infinite;
        }
        @keyframes greetingGlowPulse {
          0%, 100% { filter: brightness(1) saturate(1); }
          50% { filter: brightness(1.3) saturate(1.35); }
        }

        /* Bounces/tilts in once per line (keyed on line change), then
           keeps a gentle wiggle while it's on screen. */
        .greeting-pop {
          display: inline-block;
          animation: greetingPopIn 550ms cubic-bezier(.34,1.56,.64,1) both,
                     greetingWiggle 2.2s ease-in-out 550ms infinite;
        }
        @keyframes greetingPopIn {
          0% { transform: scale(0.2) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes greetingWiggle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-2.5deg); }
        }

        .crt-scanlines {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            to bottom, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 2px, transparent 3px
          );
          mix-blend-mode: multiply;
        }
        .crt-vignette { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 22% 4% rgba(0,0,0,0.65); }
        .crt-glow { position: absolute; inset: -6%; pointer-events: none; box-shadow: 0 0 44px 14px rgba(120,200,160,0.2); }
        .crt-glass-glare {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.13) 45%, rgba(255,255,255,0.04) 52%, transparent 68%);
        }
        .crt-static {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 120px 120px;
          opacity: 0.9;
          animation: staticJitter 90ms steps(2) infinite, staticFlicker 90ms linear infinite;
        }
        @keyframes staticJitter { 0% { transform: translate(0,0); } 50% { transform: translate(-2%, 1%); } 100% { transform: translate(1%, -2%); } }
        @keyframes staticFlicker { 0%, 100% { filter: brightness(1) contrast(1.4); } 50% { filter: brightness(1.4) contrast(1.8); } }

        /* Toggle-switch power control, red/black/white themed. */
        .power-toggle {
          position: relative;
          width: 72px; height: 50px;
          border-radius: 999px;
          background: #0d0d0d;
          border: 2px solid #6b1f1f;
          cursor: pointer;
          padding: 0;
        }
        .power-side-label {
          font-family: monospace; font-weight: 700; font-size: 0.7rem;
          letter-spacing: 0.05em;
          color: #fff;
          opacity: 0.35;
          text-shadow: 0 0 6px rgba(255,255,255,0.55);
          transition: opacity 220ms ease;
        }
        .power-side-label.active { opacity: 1; }
        .power-toggle .thumb {
          position: absolute; top: 4px; left: 4px;
          width: 38px; height: 38px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fff, #cfcfcf 70%);
          box-shadow: 0 0 6px rgba(0,0,0,0.6);
          transition: transform 220ms ease, background 220ms ease, box-shadow 220ms ease;
        }
        .power-toggle.is-on .thumb {
          transform: translateX(22px);
          background: radial-gradient(circle at 35% 30%, #ff6b6b, #b91c1c 75%);
          box-shadow: 0 0 12px 3px rgba(220,40,40,0.85);
        }
        .power-toggle:active .thumb { transform: scale(0.94) translateX(var(--tx, 0)); }

        .channel-btn {
          display: flex; align-items: center; justify-content: center;
          width: 54px; height: 54px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #8a2530, #5c1018 75%);
          border: 2px solid #f2f2f2;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 3px 0 #000, 0 0 8px rgba(255,255,255,0.2);
        }
        .channel-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #000; }
        .channel-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .banner-quote {
          color: #2a1a10;
          font-family: monospace;
          font-weight: 700;
          font-size: clamp(0.55rem, 1.55vw, 0.95rem);
          text-align: center;
          line-height: 1.25;
          max-width: 92%;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .banner-attribution {
          color: #7a2020;
          font-family: monospace;
          font-weight: 700;
          font-size: clamp(0.48rem, 1.15vw, 0.75rem);
          text-align: center;
        }
      `}</style>

      <div style={{ alignSelf: "center", display: "flex", flexDirection: "row", gap: 10 }}>
        <button
          className="channel-btn"
          onClick={() => changeChannel(-1)}
          disabled={!isOn || !hasGreeted || isGlitching}
          aria-label="Previous channel"
        >
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M18 4 L8 12 L18 20 Z" fill="currentColor" />
            <path d="M10 4 L0 12 L10 20 Z" fill="currentColor" />
          </svg>
        </button>
        <button
          className="channel-btn"
          onClick={() => changeChannel(1)}
          disabled={!isOn || !hasGreeted || isGlitching}
          aria-label="Next channel"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" style={{ transform: "scaleX(-1)" }}>
            <path d="M18 4 L8 12 L18 20 Z" fill="currentColor" />
            <path d="M10 4 L0 12 L10 20 Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div style={{ width: "min(70vw, 560px)", flexShrink: 0 }}>
        <div style={{ position: "relative", width: "100%", paddingTop: "100%" }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {/* Character is always rendered — off just dims/desaturates it,
                matching a real powered-down TV instead of disappearing. */}
            <div className={`char-wrap char-breathe${isOn ? "" : " tv-off"}`} style={{ position: "absolute", inset: 0 }}>
              <img
                src={CHARACTER_SRC}
                alt=""
                className="pixelated-sprite"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />

              {showScreen && (
                <div
                  style={{
                    position: "absolute",
                    left: `${SCREEN_BOX_PCT.x}%`,
                    top: `${SCREEN_BOX_PCT.y}%`,
                    width: `${SCREEN_BOX_PCT.w}%`,
                    height: `${SCREEN_BOX_PCT.h}%`,
                    background: "#000",
                    overflow: "hidden",
                    borderRadius: "10%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {!hasGreeted && (
                    <>
                      <div className="greeting-glow" />
                      <span key={greetingPopKey} className="screen-text greeting-pop">{greetingText}</span>
                    </>
                  )}
                  {hasGreeted && currentPoster?.posterUrl && (
                    <img
                      key={posterIndex}
                      src={currentPoster.posterUrl}
                      alt={currentPoster.film}
                      className="pixelated-sprite"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  )}
                  <div className="crt-scanlines" />
                  <div className="crt-vignette" />
                  <div className="crt-glow" />
                  <div className="crt-glass-glare" />
                  {isGlitching && <div className="crt-static" />}
                </div>
              )}

              {isOn && hasGreeted && (
                <div
                  style={{
                    position: "absolute",
                    left: `${BANNER_BOX_PCT.x}%`,
                    top: `${BANNER_BOX_PCT.y}%`,
                    width: `${BANNER_BOX_PCT.w}%`,
                    height: `${BANNER_BOX_PCT.h}%`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "3%",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35em", maxWidth: "100%" }}>
                    <span className="banner-quote">{bannerText}</span>
                    {currentPoster?.film && bannerText.length > 0 && (
                      <span className="banner-attribution">– {currentPoster.film}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 10 }}>
        <span className={`power-side-label${!isOn ? " active" : ""}`}>OFF</span>
        <button
          className={`power-toggle${isOn ? " is-on" : ""}`}
          onClick={togglePower}
          aria-label={isOn ? "Turn TV off" : "Turn TV on"}
        >
          <span className="thumb" />
        </button>
        <span className={`power-side-label${isOn ? " active" : ""}`}>ON</span>
      </div>
    </div>
  );
}