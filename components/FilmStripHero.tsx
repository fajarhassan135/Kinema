"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { HOMEPAGE_FILMS } from "@/lib/homepageFilms";
import { playButtonPress, playPower, setMuted } from "@/lib/tvAudio";
import { HEAD_PIVOT, RIG, useCharacterRig, type RigMood } from "@/lib/characterRig";

type Channel = {
  film: string;
  tmdbId: number;
  quote: string;
  /** Landscape backdrop, proxied. Falls back to the poster if there is none. */
  imageUrl: string;
  year: string;
};

/**
 * off      — tube dark, character powered down
 * warmup   — the scanline bloom as the tube energises
 * greeting — the character says hello (first power-on only)
 * live     — channels are tuned in, quotes running as subtitles
 */
type Stage = "off" | "warmup" | "greeting" | "live";

const WARMUP_MS = 900;
const TYPE_CHAR_MS = 30;
const HI_HOLD_MS = 900;
const WELCOME_HOLD_MS = 1200;
const GLITCH_MS = 340;
const OSD_MS = 2200;

/** The face is either looking at you or asleep. */
type FaceState = "awake" | "asleep";

const RIG_SRC = {
  head: "/character/rig/head.png",
  bodySign: "/character/rig/body-sign.png",
};

/** Places a cut layer back at the exact spot it occupied in the source sprite. */
function layerBox(box: { left: number; top: number; width: number; height: number }) {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  } as const;
}

// Measured off banner.png by flood-filling the dark glass inside the bezel.
// Percent convention: relative to the square stage.
//
// The glass is not a symmetric rounded rectangle: the tube is drawn at a
// slight tilt, the four corner radii differ, the bottom edge curves and the
// left side bulges. No border-radius can describe that, so the screen is
// clipped with SCREEN_MASK -- traced from that same flood fill, then eroded
// ~10px and feathered. The erosion matters: the artwork paints a dark rim
// just inside the glass where the bezel shadows the recessed tube, and a mask
// running to the outermost glass pixel covered it, butting the picture
// straight against the bright bezel. Keeping that rim, and letting the
// picture dissolve into it, is what makes the screen look recessed rather
// than pasted on.
const SCREEN_BOX_PCT = { x: 27.3957, y: 11.3867, w: 49.4927, h: 33.9346 };
const SCREEN_MASK = "/character/rig/screen-mask.png";
const BANNER_BOX_PCT = { x: 10.7, y: 58.6, w: 80.7, h: 30.1 };

/**
 * Types `text` out one character at a time.
 *
 * This owns its own state on purpose. When the parent held the partial string,
 * every character re-rendered the whole hero — which restarted the CSS
 * animations on the picture and the channel bug, so the Ken Burns pan and the
 * OSD fade never actually played. Keeping the ticking state down here means the
 * hero renders once per channel change instead of thirty times a second.
 */
const TypedText = memo(function TypedText({
  text,
  className,
  charMs = TYPE_CHAR_MS,
  onDone,
}: {
  text: string;
  className?: string;
  charMs?: number;
  onDone?: () => void;
}) {
  // Storing the text alongside the progress lets a change of line reset the
  // reveal during render, rather than firing a setState from inside an effect.
  const [typed, setTyped] = useState({ text, shown: "" });
  const shown = typed.text === text ? typed.shown : "";
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped({ text, shown: text.slice(0, i) });
      if (i >= text.length) {
        clearInterval(id);
        onDoneRef.current?.();
      }
    }, charMs);
    return () => clearInterval(id);
  }, [text, charMs]);

  return <span className={className}>{shown}</span>;
});

/**
 * One remote key. Owns its own pressed state so the whole hero does not
 * re-render on every press, and so the press feel is defined once.
 */
const RemoteButton = memo(function RemoteButton({
  className,
  label,
  onPress,
  disabled = false,
  ariaPressed,
  children,
}: {
  className: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  ariaPressed?: boolean;
  children: React.ReactNode;
}) {
  const [down, setDown] = useState(false);
  return (
    <button
      className={className}
      aria-label={label}
      aria-pressed={ariaPressed}
      disabled={disabled}
      data-pressed={down ? "true" : undefined}
      onPointerDown={() => {
        setDown(true);
        playButtonPress(true);
      }}
      onPointerUp={() => {
        setDown(false);
        playButtonPress(false);
      }}
      onPointerLeave={() => setDown(false)}
      onClick={onPress}
    >
      {children}
    </button>
  );
});

function proxied(path: string, size: string) {
  return `/api/proxy-image?url=${encodeURIComponent(`https://image.tmdb.org/t/p/${size}${path}`)}`;
}

export default function FilmStripHero({
  onSelectFilm,
}: {
  onSelectFilm?: (tmdbId: number) => void;
}) {
  const [stage, setStage] = useState<Stage>("off");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelIndex, setChannelIndex] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [greetPhase, setGreetPhase] = useState<"hi" | "welcome">("hi");
  const [pictureReady, setPictureReady] = useState(false);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [faceState, setFaceState] = useState<FaceState>("awake");

  const isOn = stage !== "off";
  const isLive = stage === "live";

  // Once the character has introduced itself, later power-ons go straight to
  // the channels — sitting through the same greeting every time gets old.
  const hasGreetedOnce = useRef(false);

  const seqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
    if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
  }, []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [rigEnabled, setRigEnabled] = useState(true);

  useEffect(() => {
    Object.values(RIG_SRC).forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setRigEnabled(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  // Backdrops are landscape, which is what the CRT actually is — so the
  // picture fills the tube edge to edge instead of being letterboxed the
  // way a portrait poster was.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        HOMEPAGE_FILMS.map(async (f): Promise<Channel | null> => {
          try {
            const res = await fetch(`/api/movies?type=by_id&id=${f.tmdbId}`);
            const data = await res.json();
            const movie = data.movie;
            const backdrop = movie?.backdrop_path;
            const poster = movie?.poster_path;
            if (!backdrop && !poster) return null;
            return {
              film: f.film,
              tmdbId: f.tmdbId,
              quote: f.quote,
              imageUrl: backdrop ? proxied(backdrop, "w1280") : proxied(poster, "w780"),
              year: (movie?.release_date ?? "").slice(0, 4),
            };
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setChannels(results.filter((c): c is Channel => c !== null));
        setChannelsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Warm-up always resolves into either the greeting or straight to live.
  useEffect(() => {
    if (stage !== "warmup") return;
    warmupTimerRef.current = setTimeout(() => {
      setStage(hasGreetedOnce.current ? "live" : "greeting");
    }, WARMUP_MS);
    return () => {
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
    };
  }, [stage]);

  // Advances when each greeting line finishes typing (TypedText calls back).
  const onGreetLineDone = useCallback(() => {
    if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    if (greetPhase === "hi") {
      seqTimerRef.current = setTimeout(() => setGreetPhase("welcome"), HI_HOLD_MS);
    } else {
      seqTimerRef.current = setTimeout(() => {
        hasGreetedOnce.current = true;
        setStage("live");
      }, WELCOME_HOLD_MS);
    }
  }, [greetPhase]);

  const changeChannel = useCallback(
    (direction: 1 | -1) => {
      if (!isLive || isGlitching || channels.length === 0) return;
      setIsGlitching(true);
      glitchTimerRef.current = setTimeout(() => {
        setPictureReady(false);
        setChannelIndex((i) => (i + direction + channels.length) % channels.length);
        setIsGlitching(false);
      }, GLITCH_MS);
    },
    [isLive, isGlitching, channels.length]
  );

  const goPrev = useCallback(() => changeChannel(-1), [changeChannel]);
  const goNext = useCallback(() => changeChannel(1), [changeChannel]);

  const togglePower = useCallback(() => {
    clearAllTimers();
    setStage((current) => {
      const turningOn = current === "off";
      playPower(turningOn);
      if (!turningOn) {
        setGreetPhase("hi");
        setIsGlitching(false);
        setPictureReady(false);
        return "off";
      }
      return "warmup";
    });
  }, [clearAllTimers]);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      // Unmuting should be audible; muting should not chirp on its way out.
      if (m) {
        setMuted(false);
        playButtonPress(true);
      }
      return !m;
    });
  }, []);

  // Keyboard control, so the hero is usable without hunting for the remote.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        playButtonPress(true);
        changeChannel(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        playButtonPress(true);
        changeChannel(-1);
      } else if (e.key === " " || e.key.toLowerCase() === "p") {
        e.preventDefault();
        playButtonPress(true);
        togglePower();
      } else if (e.key.toLowerCase() === "m") {
        toggleMute();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeChannel, togglePower, toggleMute]);

  // The character sleeps while the set is off and dozes off when ignored.
  // A cached image can finish decoding before React attaches onLoad, so that
  // event never fires and the subtitle and channel bug stay hidden forever.
  // Checking `complete` as the node mounts covers the cached case.
  const handlePictureRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setPictureReady(true);
  }, []);

  const handleMood = useCallback((mood: RigMood) => {
    setFaceState(mood === "asleep" ? "asleep" : "awake");
  }, []);

  useCharacterRig(stageRef, {
    poweredOn: isOn,
    enabled: rigEnabled,
    onMoodChange: handleMood,
  });

  const current = channels[channelIndex];
  const channelNumber = String(channelIndex + 1).padStart(2, "0");

  return (
    <div className="tv-hero">
      <style>{`
        .tv-hero {
          --brass: #c9a227;
          --brass-lit: #e8ce7a;
          --oxblood: #6b0016;
          --oxblood-lit: #9b1b30;
          --bone: #f4efe6;
          --shell: #17151300;

          width: 100%;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: clamp(16px, 3vw, 48px);
          padding: 24px;
        }

        .pixelated-sprite { image-rendering: pixelated; }

        .tv-stage { width: min(52vw, 520px); flex-shrink: 0; }
        .tv-stage-inner { position: relative; width: 100%; padding-top: 100%; }

        /* ---------- the layered character rig ---------- */

        /* The character never disappears — powering off just dims and
           desaturates it, the way a real set sits dark in the room. */
        .rig { position: absolute; inset: 0; perspective: 900px; }
        /* Dim the sprite art only. The face is not part of the sprite — it is
           lit from inside the tube, so it stays bright while the set is dark. */
        .rig img { transition: filter 600ms ease; filter: grayscale(0) brightness(1); }
        .rig.is-off img { filter: grayscale(0.62) brightness(0.46); }

        .rig-layer { position: absolute; inset: 0; }
        .rig-layer img { position: absolute; }

        /* Pivots at the base of the neck, so it tilts like a head on a spine
           rather than sliding around like a sticker. The yaw/pitch are what
           read as "looking at you"; the roll adds the bit of personality. */
        .rig-head {
          transform-origin: ${HEAD_PIVOT.x}% ${HEAD_PIVOT.y}%;
          transform:
            translate3d(calc(var(--hx, 0) * 1%), calc(var(--hy, 0) * 1%), 0)
            rotateY(calc(var(--yaw, 0) * 1deg))
            rotateX(calc(var(--pitch, 0) * 1deg))
            rotate(calc(var(--roll, 0) * 1deg));
          will-change: transform;
        }

        /* The body lags well behind the head. That gap is what gives the
           motion weight instead of making the whole sprite slide as one. */
        .rig-body {
          transform-origin: 50% 100%;
          transform:
            translate3d(calc(var(--bx, 0) * 1%), 0, 0)
            rotate(calc(var(--roll, 0) * 0.3deg));
          will-change: transform;
        }

        /* Dozing dims the tube and softens the glow; asleep goes further. */
        .tv-stage-inner[data-mood="dozing"] .crt-screen { filter: brightness(0.6) saturate(0.8); }
        .tv-stage-inner[data-mood="dozing"] .rig,
        .tv-stage-inner[data-mood="asleep"] .rig { animation-duration: 5.6s; }

        @keyframes charBreathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1.2%) scale(1.008); }
        }
        .char-breathe { animation: charBreathe 3.2s ease-in-out infinite; transform-origin: 50% 100%; }

        /* ---------- the tube ---------- */

        .crt-screen {
          position: absolute;
          overflow: hidden;
          background: #000;
          -webkit-mask-image: url("${SCREEN_MASK}");
          mask-image: url("${SCREEN_MASK}");
          -webkit-mask-size: 100% 100%;
          mask-size: 100% 100%;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          container-type: size;
          container-name: crt;
        }
        .crt-screen.is-live { cursor: pointer; }

        /* Picture fills the tube: the source is a landscape backdrop and
           object-fit: cover crops the overflow, so there are no black bars. */
        .crt-picture {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          /* A sharp modern still inside hand-painted pixel art reads as a
             foreign object. Softening and desaturating it slightly pulls it
             into the same world as the frame around it. */
          filter: saturate(0.84) contrast(0.93) blur(0.35px);
          animation: kenBurns 22s ease-in-out infinite alternate, pictureIn 520ms ease-out both;
        }
        /* Parallax: the picture drifts against the head like a pupil in an
           eye. Uses the translate property rather than transform so it
           composes with the Ken Burns pan instead of overwriting it. */
        .crt-picture { translate: calc(var(--ex, 0) * 1%) calc(var(--ey, 0) * 1%); }
        .crt-glass-glare { translate: calc(var(--ex, 0) * -1.6%) 0; }

        @keyframes kenBurns {
          from { transform: scale(1.06) translate(0, 0); }
          to   { transform: scale(1.16) translate(-2%, -1.5%); }
        }
        @keyframes pictureIn {
          from { opacity: 0; filter: brightness(2.4) contrast(0.4); }
          to   { opacity: 1; filter: none; }
        }

        /* Warm-up: the horizontal line that blooms open into a picture. */
        .crt-warmup { position: absolute; inset: 0; background: #000; overflow: hidden; }
        .crt-warmup::after {
          content: "";
          position: absolute; left: 0; right: 0; top: 50%;
          height: 2px; background: var(--bone);
          box-shadow: 0 0 18px 6px rgba(244,239,230,0.8);
          animation: tubeBloom ${WARMUP_MS}ms cubic-bezier(.2,.7,.3,1) forwards;
        }
        @keyframes tubeBloom {
          0%   { transform: scaleX(0.02); opacity: 0; }
          22%  { transform: scaleX(1); opacity: 1; height: 2px; }
          60%  { height: 26%; opacity: 0.75; }
          100% { height: 100%; top: 0; opacity: 0; }
        }

        /* No channels came back — show the colour bars rather than a void. */
        .crt-nosignal {
          position: absolute; inset: 0; z-index: 2;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 6cqh;
          background: #05060a;
        }
        .crt-nosignal-bars {
          width: 74cqw; height: 26cqh;
          background: linear-gradient(90deg,
            #c9c9c9 0 14.28%, #c9c14a 14.28% 28.56%, #4ac9c9 28.56% 42.84%,
            #4ac94a 42.84% 57.12%, #c94ac9 57.12% 71.4%, #c94a4a 71.4% 85.68%,
            #4a4ac9 85.68% 100%);
          opacity: 0.55;
        }
        .crt-nosignal-text {
          color: var(--bone);
          font-family: ui-monospace, Menlo, monospace;
          font-size: 6cqw;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          text-shadow: 0 0 8px rgba(0,0,0,0.9);
        }

        /* ---------- subtitles ---------- */

        /* Sized in container units so the line scales with the tube itself
           rather than the viewport — the screen is only ~25% of the stage. */
        .crt-subtitle-band {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 0 6cqw 5cqh;
          display: flex; justify-content: center;
          background: linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.45) 55%, transparent);
          z-index: 2;
        }
        .crt-subtitle {
          margin: 0;
          color: var(--bone);
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-weight: 600;
          font-size: 6.2cqw;
          line-height: 1.25;
          text-align: center;
          text-shadow: 0 0.4cqw 0.8cqw rgba(0,0,0,0.95), 0 0 0.3cqw rgba(0,0,0,1);
          text-wrap: balance;
        }

        /* Channel bug, top-left, exactly where a broadcaster would put it. */
        .crt-osd {
          position: absolute; top: 5cqh; left: 5cqw;
          z-index: 2;
          display: flex; align-items: baseline; gap: 1.6cqw;
          padding: 1.4cqh 2.4cqw;
          background: rgba(6,6,8,0.62);
          border-left: 0.7cqw solid var(--brass);
          opacity: 1;
          pointer-events: none;
          /* Shows itself and clears itself. Keyed on the channel, so tuning
             restarts the flash without any timer or state to keep in sync. */
          animation: osdFlash 2200ms ease-out forwards;
        }
        @keyframes osdFlash {
          0%   { opacity: 0; transform: translateX(-8%); }
          8%   { opacity: 1; transform: none; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .crt-osd-num {
          color: var(--brass-lit);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-weight: 700; font-size: 5.4cqw; letter-spacing: 0.04em;
        }
        .crt-osd-name {
          color: var(--bone);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-weight: 500; font-size: 4cqw;
          text-transform: uppercase; letter-spacing: 0.12em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 46cqw;
        }

        /* ---------- greeting ---------- */

        /* Pitch black behind the greeting — the tube is unlit apart from the
           text itself, so no coloured wash. */
        .greeting-glow { position: absolute; inset: 0; background: #000; }
        .screen-text {
          position: relative; z-index: 1;
          color: #f2d9a0;
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 9cqw;
          text-shadow: 0 0 10px rgba(212,175,97,0.85), 0 0 3px #000;
        }
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

        /* ---------- glass ---------- */

        .crt-scanlines {
          position: absolute; inset: 0; pointer-events: none; z-index: 3;
          background: repeating-linear-gradient(
            to bottom, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 2px, transparent 3px
          );
          mix-blend-mode: multiply;
        }
        /* Edge darkening as a gradient, not an inset box-shadow: a shadow
           hugs the rectangular border box and would square off the corners
           the mask just rounded. This falls off toward the real edge and
           reads as the picture curving away on a convex tube. */
        .crt-vignette {
          position: absolute; inset: 0; pointer-events: none; z-index: 3;
          background: radial-gradient(118% 118% at 50% 46%,
            transparent 52%, rgba(0,0,0,0.22) 80%, rgba(0,0,0,0.5) 97%, rgba(0,0,0,0.62) 100%);
        }
        /* Warm phosphor cast, multiplied over the picture so it shares the
           frame's palette instead of glowing cold against it. */
        .crt-warmth {
          position: absolute; inset: 0; pointer-events: none; z-index: 2;
          background: rgb(255, 216, 160);
          mix-blend-mode: multiply;
          opacity: 0.34;
        }

        /* Curved glass catches light along the top and shades at the base. */
        .crt-bulge {
          position: absolute; inset: 0; pointer-events: none; z-index: 4;
          background:
            radial-gradient(90% 46% at 50% -6%, rgba(255,255,255,0.14), transparent 62%),
            radial-gradient(80% 40% at 50% 106%, rgba(0,0,0,0.34), transparent 58%);
        }
        .crt-glass-glare {
          position: absolute; inset: 0; pointer-events: none; z-index: 4;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.10) 44%, rgba(255,255,255,0.03) 51%, transparent 66%);
        }
        /* Slow bright band drifting down the tube — the rolling refresh bar. */
        .crt-rollbar {
          position: absolute; left: 0; right: 0; height: 22%; pointer-events: none; z-index: 3;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.055), transparent);
          animation: rollDown 7s linear infinite;
        }
        @keyframes rollDown { from { top: -25%; } to { top: 105%; } }

        .crt-static {
          position: absolute; inset: 0; z-index: 5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 120px 120px;
          opacity: 0.55;
          mix-blend-mode: screen;
          animation: staticJitter 90ms steps(2) infinite, staticFlicker 90ms linear infinite;
        }
        @keyframes staticJitter { 0% { transform: translate(0,0); } 50% { transform: translate(-2%, 1%); } 100% { transform: translate(1%, -2%); } }
        @keyframes staticFlicker { 0%, 100% { filter: brightness(1) contrast(1.4); } 50% { filter: brightness(1.4) contrast(1.8); } }

        /* Horizontal hold slipping while the tuner hunts for the next channel.
           This rides on the signal wrapper inside the glass, never on the tube
           itself: the screen is masked to the bezel and must stay welded to the
           frame, so only the picture is allowed to tear and roll. */
        .crt-signal { position: absolute; inset: 0; }
        .crt-screen.is-glitching .crt-signal { animation: hSlip ${GLITCH_MS}ms steps(7) 1; }
        @keyframes hSlip {
          0%   { transform: translate3d(0, 0, 0) skewX(0deg); }
          20%  { transform: translate3d(4%, -6%, 0) skewX(-2.4deg); }
          45%  { transform: translate3d(-5%, 9%, 0) skewX(1.8deg); }
          70%  { transform: translate3d(3%, -4%, 0) skewX(-1deg); }
          88%  { transform: translate3d(-1.5%, 2%, 0) skewX(0.4deg); }
          100% { transform: translate3d(0, 0, 0) skewX(0deg); }
        }

        /* ---------- the face ---------- */

        /* Switched off, the tube is a face rather than a dead screen. Drawn as
           vectors so the expressions can be tweened instead of swapped. */
        .face-box {
          position: absolute;
          display: flex; align-items: center; justify-content: center;
          -webkit-mask-image: url("${SCREEN_MASK}");
          mask-image: url("${SCREEN_MASK}");
          -webkit-mask-size: 100% 100%;
          mask-size: 100% 100%;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
        }
        .face {
          width: 100%; height: 100%;
          overflow: visible;
          filter: drop-shadow(0 0 6px rgba(226,178,90,0.5));
        }

        .eye-ball { fill: #f2d9a0; }
        .eye-pupil {
          fill: #140b04;
          /* The pupils get their own spring in the rig and a much stiffer one,
             so they arrive before the head does — which is how eyes work. */
          transform: translate(calc(var(--px, 0) * 1px), calc(var(--py, 0) * 1px));
        }
        /* Lids drop from the top of the socket; scaleY is the whole animation. */
        .eye-lid {
          fill: #000;
          transform-box: fill-box;
          transform-origin: top;
          transform: scaleY(0);
          transition: transform 180ms ease;
        }
        .brow {
          fill: #e2b25a;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 320ms ease;
        }
        /* A catchlight does more for friendliness than any other single
           detail — it turns a flat disc into a wet, living eye. */
        .eye-shine { fill: #fffaf0; opacity: 0.9; }
        /* Shut eyes are a lash line, not a filled shape. Covering the eye with
           a dark rectangle showed up as a black box against the tube gradients
           instead of reading as closed. */
        .eye-closed {
          fill: none;
          stroke: #e2b25a;
          stroke-width: 4;
          stroke-linecap: round;
          opacity: 0;
          transition: opacity 160ms ease;
        }

        /* Resting mouth is an open, upturned smile rather than a neutral slot. */
        .mouth {
          fill: none;
          stroke: #e2b25a;
          stroke-width: 4.5;
          stroke-linecap: round;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 320ms cubic-bezier(.34,1.4,.64,1);
        }

        /* Awake: eyes open and bright, brows lifted into a friendly arch,
           with the odd blink. */
        .face[data-face="awake"] .eye-lid { animation: blink 5.4s ease-in-out infinite; }
        .face[data-face="awake"] .brow-l { transform: translateY(-2px) rotate(-7deg); }
        .face[data-face="awake"] .brow-r { transform: translateY(-2px) rotate(7deg); }
        .face[data-face="awake"] .mouth { transform: scale(1.05); }
        /* A slow excited bob, so the happy face is never completely still. */
        .face[data-face="awake"] .brows { animation: browBob 3.4s ease-in-out infinite; }
        @keyframes browBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.6px); }
        }
        @keyframes blink {
          0%, 92%, 100% { transform: scaleY(0); }
          95%, 97%      { transform: scaleY(1); }
        }

        /* Asleep: lids shut, brows relaxed, mouth a small slack o. */
        .face[data-face="asleep"] .eye-ball,
        .face[data-face="asleep"] .eye-pupil,
        .face[data-face="asleep"] .eye-shine { opacity: 0; }
        .face[data-face="asleep"] .eye-closed { opacity: 1; }
        .face[data-face="asleep"] .brow-l { transform: translateY(4px) rotate(7deg); }
        .face[data-face="asleep"] .brow-r { transform: translateY(4px) rotate(-7deg); }
        .face[data-face="asleep"] .mouth { transform: scale(0.55, 0.3); }

        /* Sleep zeds, only while it is actually asleep. */
        .z {
          fill: #e2b25a;
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 13px;
          opacity: 0;
        }
        .face[data-face="asleep"] .z { animation: zFloat 3.2s ease-in-out infinite; }
        .face[data-face="asleep"] .z2 { animation-delay: 0.5s; }
        .face[data-face="asleep"] .z3 { animation-delay: 1s; }
        @keyframes zFloat {
          0%   { opacity: 0; transform: translateY(4px) scale(0.7); }
          30%  { opacity: 0.95; }
          100% { opacity: 0; transform: translateY(-12px) scale(1.15); }
        }

        /* ---------- the held sign ---------- */

        .sign-area {
          position: absolute;
          display: flex; align-items: center; justify-content: center;
          padding: 3%;
          container-type: size;
          container-name: sign;
          text-align: center;
        }
        .sign-title {
          margin: 0;
          color: #2a1a10;
          font-family: 'Times New Roman', Georgia, serif;
          font-weight: 700;
          font-size: 15cqh;
          line-height: 1.1;
          letter-spacing: 0.01em;
          text-wrap: balance;
        }
        .sign-year {
          display: block;
          margin-top: 0.35em;
          color: #7a2020;
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 9cqh;
          letter-spacing: 0.34em;
        }

        /* ---------- the remote ---------- */

        .remote {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px;
          padding: 20px 18px 22px;
          border-radius: 30px;
          background:
            linear-gradient(168deg, #262220 0%, #131110 46%, #0a0908 100%);
          border: 1px solid #3b342c;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.09),
            inset 0 -14px 26px rgba(0,0,0,0.65),
            0 22px 42px rgba(0,0,0,0.6);
        }
        .remote-brand {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 0.55rem; font-weight: 700;
          letter-spacing: 0.34em; text-transform: uppercase;
          color: #6d6257;
          margin-bottom: 2px;
        }
        /* Standby LED: dark when off, a live red glow when the set is on. */
        .remote-led {
          width: 8px; height: 8px; border-radius: 50%;
          background: #3a1512;
          transition: background 260ms ease, box-shadow 260ms ease;
        }
        .remote-led.is-on {
          background: #ff4d4d;
          box-shadow: 0 0 10px 2px rgba(255,60,60,0.75);
        }

        .rbtn {
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          cursor: pointer;
          color: var(--bone);
          transition: transform 90ms ease, box-shadow 90ms ease, filter 200ms ease;
        }
        .rbtn:focus-visible { outline: 2px solid var(--brass); outline-offset: 3px; }
        .rbtn[data-pressed="true"] { transform: translateY(3px); }
        .rbtn:disabled { cursor: not-allowed; filter: grayscale(0.7) brightness(0.55); }

        /* Power: the one key that is always live, so it gets the accent. */
        .rbtn-power {
          width: 60px; height: 60px;
          background: radial-gradient(circle at 34% 28%, #4a1119, #2a0a0e 72%);
          border: 2px solid #5d4a34;
          box-shadow: 0 4px 0 #000, inset 0 1px 2px rgba(255,255,255,0.18);
        }
        .rbtn-power.is-on {
          background: radial-gradient(circle at 34% 28%, var(--oxblood-lit), var(--oxblood) 74%);
          border-color: var(--brass);
          box-shadow: 0 4px 0 #000, 0 0 20px 3px rgba(155,27,48,0.55), inset 0 1px 2px rgba(255,255,255,0.25);
        }
        .rbtn-power[data-pressed="true"] { box-shadow: 0 1px 0 #000, inset 0 2px 6px rgba(0,0,0,0.7); }

        /* Channel keys: the primary action, so they are the biggest keys. */
        .rbtn-ch {
          width: 66px; height: 66px;
          background: radial-gradient(circle at 34% 26%, #34302b, #1a1715 76%);
          border: 2px solid var(--brass);
          box-shadow: 0 4px 0 #000, inset 0 1px 2px rgba(255,255,255,0.16);
        }
        .rbtn-ch:not(:disabled):hover { box-shadow: 0 4px 0 #000, 0 0 16px 2px rgba(201,162,39,0.4), inset 0 1px 2px rgba(255,255,255,0.2); }
        .rbtn-ch[data-pressed="true"] { box-shadow: 0 1px 0 #000, inset 0 2px 6px rgba(0,0,0,0.7); }

        .rbtn-mute {
          width: 44px; height: 44px;
          background: radial-gradient(circle at 34% 26%, #2a2724, #131110 78%);
          border: 2px solid #4d453a;
          box-shadow: 0 3px 0 #000;
          color: #9c9186;
        }
        .rbtn-mute.is-muted { color: var(--oxblood-lit); border-color: var(--oxblood); }
        .rbtn-mute[data-pressed="true"] { box-shadow: 0 1px 0 #000; }

        .remote-label {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 0.58rem; font-weight: 700;
          letter-spacing: 0.24em; text-transform: uppercase;
          color: #8a7c6b;
        }
        .remote-divider { width: 46px; height: 1px; background: #352e26; }
        .remote-hint {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 0.5rem; letter-spacing: 0.1em;
          color: #5c534a; text-align: center; line-height: 1.6;
        }

        @media (max-width: 1024px) {
          .tv-hero { flex-direction: column; }
          .tv-stage { width: min(76vw, 440px); }
          .remote {
            flex-direction: row; flex-wrap: wrap; justify-content: center;
            max-width: 100%;
            gap: 18px; border-radius: 40px; padding: 16px 22px;
          }
          .remote-brand, .remote-divider, .remote-hint { display: none; }
        }

        /* Phones: the keys have to shrink or the remote is wider than the
           screen and drags the whole page into horizontal scroll. */
        @media (max-width: 560px) {
          .tv-hero { gap: 14px; padding: 16px 12px; }
          .remote { gap: 10px; padding: 12px 14px; }
          .remote-label { display: none; }
          .rbtn-power { width: 48px; height: 48px; }
          .rbtn-ch { width: 52px; height: 52px; }
          .rbtn-mute { width: 38px; height: 38px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .char-breathe, .crt-picture, .crt-rollbar, .greeting-pop, .eye-lid, .z, .brows, .crt-signal { animation: none !important; }
          .crt-picture { transform: scale(1.06); }
        }
      `}</style>

      <div className="tv-stage">
        <div className="tv-stage-inner" ref={stageRef}>
          <div className={`rig char-breathe${isOn ? "" : " is-off"}`}>
            <div className="rig-layer rig-head">
              <img src={RIG_SRC.head} alt="" className="pixelated-sprite" style={layerBox(RIG.head)} />

              {/* With the set off the tube is not a blank screen, it is the
                  character's face. Eyes lead the head, close when it sleeps,
                  and it yawns its way back awake. */}
              {!isOn && (
                <div
                  className="face-box"
                  style={{
                    left: `${SCREEN_BOX_PCT.x}%`,
                    top: `${SCREEN_BOX_PCT.y}%`,
                    width: `${SCREEN_BOX_PCT.w}%`,
                    height: `${SCREEN_BOX_PCT.h}%`,
                  }}
                >
                  <svg
                    className="face"
                    data-face={faceState}
                    viewBox="0 0 146 100"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                  >
                    <g className="brows">
                      <rect className="brow brow-l" x="28" y="16" width="34" height="5.5" rx="2.75" />
                      <rect className="brow brow-r" x="84" y="16" width="34" height="5.5" rx="2.75" />
                    </g>

                    <g className="eye eye-l" transform="translate(46 46)">
                      <ellipse className="eye-ball" rx="17" ry="15" />
                      <circle className="eye-pupil" r="6.4" />
                      <circle className="eye-shine" cx="6" cy="-6" r="3.1" />
                      <path className="eye-closed" d="M-13 0 Q0 7 13 0" />
                      <rect className="eye-lid" x="-18" y="-16" width="36" height="32" />
                    </g>
                    <g className="eye eye-r" transform="translate(100 46)">
                      <ellipse className="eye-ball" rx="17" ry="15" />
                      <circle className="eye-pupil" r="6.4" />
                      <circle className="eye-shine" cx="6" cy="-6" r="3.1" />
                      <path className="eye-closed" d="M-13 0 Q0 7 13 0" />
                      <rect className="eye-lid" x="-18" y="-16" width="36" height="32" />
                    </g>

                    <path className="mouth" d="M57 74 Q73 91 89 74" />

                    <g className="zzz">
                      <text className="z z1" x="118" y="26">z</text>
                      <text className="z z2" x="126" y="18">z</text>
                      <text className="z z3" x="133" y="11">z</text>
                    </g>
                  </svg>
                </div>
              )}

            {isOn && (
              <div
                className={`crt-screen${isGlitching ? " is-glitching" : ""}${
                  isLive && current ? " is-live" : ""
                }`}
                style={{
                  left: `${SCREEN_BOX_PCT.x}%`,
                  top: `${SCREEN_BOX_PCT.y}%`,
                  width: `${SCREEN_BOX_PCT.w}%`,
                  height: `${SCREEN_BOX_PCT.h}%`,
                }}
                onClick={() => {
                  if (isLive && current && onSelectFilm) onSelectFilm(current.tmdbId);
                }}
                role={isLive && current ? "button" : undefined}
                aria-label={isLive && current ? `Open ${current.film}` : undefined}
              >
                {stage === "warmup" && <div className="crt-warmup" />}

                {stage === "greeting" && (
                  <>
                    <div className="greeting-glow" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span key={greetPhase} className="screen-text greeting-pop">
                        <TypedText
                          text={greetPhase === "hi" ? "Hi!" : "Welcome nerd"}
                          onDone={onGreetLineDone}
                        />
                      </span>
                    </div>
                  </>
                )}

                {/* Upstream can fail transiently. A dark tube with no
                    explanation reads as broken; a real set says NO SIGNAL. */}
                {isLive && !current && channelsLoaded && (
                  <div className="crt-nosignal">
                    <span className="crt-nosignal-bars" />
                    <span className="crt-nosignal-text">No signal</span>
                  </div>
                )}

                {isLive && current && (
                  <>
                    <div className="crt-signal">
                      <img
                        key={current.tmdbId}
                        src={current.imageUrl}
                        alt={current.film}
                        className="crt-picture"
                        ref={handlePictureRef}
                        onLoad={() => setPictureReady(true)}
                      />
                    </div>

                    {pictureReady && (
                      <div className="crt-osd" key={channelIndex}>
                        <span className="crt-osd-num">CH {channelNumber}</span>
                        <span className="crt-osd-name">{current.film}</span>
                      </div>
                    )}

                    {pictureReady && !isGlitching && (
                      <div className="crt-subtitle-band">
                        <p className="crt-subtitle">
                          <TypedText key={current.tmdbId} text={current.quote} />
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="crt-rollbar" />
                <div className="crt-scanlines" />
                <div className="crt-warmth" />
                <div className="crt-vignette" />
                <div className="crt-bulge" />
                <div className="crt-glass-glare" />
                {isGlitching && <div className="crt-static" />}
              </div>
            )}
            </div>

            <div className="rig-layer rig-body">
              <img
                src={RIG_SRC.bodySign}
                alt=""
                className="pixelated-sprite"
                style={layerBox(RIG.bodySign)}
              />

            {/* The sign now carries the identity of what is on screen; the
                quote itself moved into the tube as subtitles. */}
            {isLive && current && (
              <div
                className="sign-area"
                style={{
                  left: `${BANNER_BOX_PCT.x}%`,
                  top: `${BANNER_BOX_PCT.y}%`,
                  width: `${BANNER_BOX_PCT.w}%`,
                  height: `${BANNER_BOX_PCT.h}%`,
                }}
              >
                <p className="sign-title">
                  {current.film}
                  {current.year && <span className="sign-year">{current.year}</span>}
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="remote">
        <span className="remote-brand">Kinema</span>
        <span className={`remote-led${isOn ? " is-on" : ""}`} />

        <RemoteButton
          className={`rbtn rbtn-power${isOn ? " is-on" : ""}`}
          label={isOn ? "Turn TV off" : "Turn TV on"}
          ariaPressed={isOn}
          onPress={togglePower}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 3.5v8" />
            <path d="M6.4 6.6a8 8 0 1 0 11.2 0" />
          </svg>
        </RemoteButton>

        <span className="remote-label">Power</span>
        <span className="remote-divider" />

        <RemoteButton
          className="rbtn rbtn-ch"
          label="Previous channel"
          disabled={!isLive || isGlitching}
          onPress={goPrev}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
            <path d="M20 4 L10 12 L20 20 Z" />
            <path d="M11 4 L1 12 L11 20 Z" />
          </svg>
        </RemoteButton>

        <span className="remote-label">CH</span>

        <RemoteButton
          className="rbtn rbtn-ch"
          label="Next channel"
          disabled={!isLive || isGlitching}
          onPress={goNext}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" style={{ transform: "scaleX(-1)" }}>
            <path d="M20 4 L10 12 L20 20 Z" />
            <path d="M11 4 L1 12 L11 20 Z" />
          </svg>
        </RemoteButton>

        <span className="remote-divider" />

        <RemoteButton
          className={`rbtn rbtn-mute${muted ? " is-muted" : ""}`}
          label={muted ? "Unmute" : "Mute"}
          ariaPressed={muted}
          onPress={toggleMute}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            {muted ? (
              <>
                <path d="M17 9.5l4 5" />
                <path d="M21 9.5l-4 5" />
              </>
            ) : (
              <path d="M17 8.5a5 5 0 0 1 0 7" />
            )}
          </svg>
        </RemoteButton>

        <span className="remote-hint">← → channel<br />space power · m mute</span>
      </div>
    </div>
  );
}
