import { useEffect, useRef, type RefObject } from "react";

/**
 * Geometry for the layered TV-head rig.
 *
 * banner.png is 887x887 with a transparent background.
 *
 * The layers were cut in Python from the alpha channel (see public/character/rig)
 * along real anatomy: the head splits at the neck, just above the collar. The
 * body is drawn over the head, so the collar hides the neck seam however far
 * the head turns.
 *
 * All boxes are percentages of the square stage.
 */
export const RIG = {
  head: { left: 19.9549, top: 3.6077, width: 64.1488, height: 48.478 },
  bodySign: { left: 10.7103, top: 47.9143, width: 83.3145, height: 50.2818 },
} as const;

/** Base of the neck — what the head pivots around. */
export const HEAD_PIVOT = { x: 51.86, y: 51.3 };

// How far the head is allowed to travel. A flat, front-facing sprite reads as a
// head turning only while the angles stay modest; past roughly 15 degrees it
// stops looking like a head and starts looking like a photo being spun.
const HEAD_MAX_X = 2.6; // % of stage
const HEAD_MAX_Y = 1.7;
const HEAD_MAX_YAW = 11; // deg
const HEAD_MAX_PITCH = 7.5;
const HEAD_MAX_ROLL = 3.2;

/** The body follows the head, but only a little — that difference is the weight. */
const BODY_FOLLOW = 0.26;

/** The picture drifts against the head, like a pupil inside an eye. */
const EYE_MAX = 3.4; // % of screen

/** Idle this long with no pointer movement and the character nods off. */
const SLEEP_AFTER_MS = 9000;

/** How far the pupils travel inside the eye, in SVG user units. */
const EYE_TRACK = 5.5;

type Spring = { value: number; velocity: number };

const spring = (): Spring => ({ value: 0, velocity: 0 });

/**
 * Critically-damped-ish spring. Cheaper than a real solver and stable at any
 * frame rate we care about, which matters because this runs every frame.
 */
function step(s: Spring, target: number, stiffness: number, damping: number) {
  s.velocity += (target - s.value) * stiffness;
  s.velocity *= damping;
  s.value += s.velocity;
}

export type RigMood = "awake" | "asleep";

export type RigOptions = {
  /** Powered down sits a little heavier, but it is idleness that puts it to sleep. */
  poweredOn: boolean;
  /** Skip the whole rig when the user asked for reduced motion. */
  enabled?: boolean;
  /** Fires on every mood change, so the face can yawn itself awake. */
  onMoodChange?: (mood: RigMood) => void;
};

/**
 * Drives the rig by writing CSS custom properties straight onto the stage
 * element every frame. Deliberately never calls setState: at 60fps that would
 * re-render the hero (and restart the CRT animations) sixty times a second.
 */
export function useCharacterRig(
  stageRef: RefObject<HTMLElement | null>,
  { poweredOn, enabled = true, onMoodChange }: RigOptions
) {
  // Held in a ref so a new callback identity never restarts the animation loop.
  const moodCbRef = useRef(onMoodChange);
  useEffect(() => {
    moodCbRef.current = onMoodChange;
  }, [onMoodChange]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    if (!enabled) {
      el.style.setProperty("--hx", "0");
      el.style.setProperty("--hy", "0");
      el.style.setProperty("--yaw", "0");
      el.style.setProperty("--pitch", "0");
      el.style.setProperty("--roll", "0");
      el.style.setProperty("--bx", "0");
      el.style.setProperty("--ex", "0");
      el.style.setProperty("--ey", "0");
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
      return;
    }

    // Pointer position as -1..1 relative to the character, so the head tracks
    // direction rather than raw pixels and behaves the same at any stage size.
    let nx = 0;
    let ny = 0;
    let lastMove = performance.now();
    let inView = true;

    const hx = spring();
    const hy = spring();
    const yaw = spring();
    const pitch = spring();
    const roll = spring();
    // Eyes are their own springs and much stiffer: they snap to whatever you
    // are doing while the head lumbers after them. That lead is most of the
    // reason it reads as looking at you rather than tilting toward you.
    const px = spring();
    const py = spring();
    let mood: RigMood = "awake";

    function onPointerMove(e: PointerEvent) {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.32; // the head, not the middle of the sprite
      // Normalise by a generous radius so the character notices you from across
      // the page instead of only when the cursor is right on top of it.
      const radius = Math.max(r.width, 420);
      nx = Math.max(-1, Math.min(1, (e.clientX - cx) / radius));
      ny = Math.max(-1, Math.min(1, (e.clientY - cy) / radius));
      lastMove = performance.now();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    observer.observe(el);

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = stageRef.current;
      if (!el || !inView) return;

      const now = performance.now();
      // Being ignored is what puts it to sleep; the power switch only changes
      // how heavily it rests, because switched off it still has a face.
      const asleep = now - lastMove > SLEEP_AFTER_MS;
      const nextMood: RigMood = asleep ? "asleep" : "awake";
      if (nextMood !== mood) {
        mood = nextMood;
        moodCbRef.current?.(mood);
      }

      let tx = nx;
      let ty = ny;
      let stiffness = 0.055;
      let damping = 0.82;

      if (asleep) {
        // Head droops forward and drifts; a slow sine keeps it breathing
        // rather than parked, and a dark set slumps further than a lit one.
        const depth = poweredOn ? 0.72 : 1;
        const drift = Math.sin(now / 2600) * 0.12 * depth;
        tx = drift;
        ty = depth;
        stiffness = 0.018;
        damping = 0.88;
      }

      step(hx, tx * HEAD_MAX_X, stiffness, damping);
      step(hy, ty * HEAD_MAX_Y, stiffness, damping);
      step(yaw, tx * HEAD_MAX_YAW, stiffness, damping);
      step(pitch, -ty * HEAD_MAX_PITCH, stiffness, damping);
      step(roll, tx * HEAD_MAX_ROLL, stiffness, damping);
      step(px, asleep ? 0 : nx * EYE_TRACK, 0.17, 0.7);
      step(py, asleep ? 0 : ny * EYE_TRACK * 0.7, 0.17, 0.7);

      el.style.setProperty("--hx", hx.value.toFixed(3));
      el.style.setProperty("--hy", hy.value.toFixed(3));
      el.style.setProperty("--yaw", yaw.value.toFixed(3));
      el.style.setProperty("--pitch", pitch.value.toFixed(3));
      el.style.setProperty("--roll", roll.value.toFixed(3));
      el.style.setProperty("--bx", (hx.value * BODY_FOLLOW).toFixed(3));
      el.style.setProperty("--ex", (-hx.value * (EYE_MAX / HEAD_MAX_X)).toFixed(3));
      el.style.setProperty("--ey", (-hy.value * (EYE_MAX / HEAD_MAX_Y) * 0.6).toFixed(3));
      el.style.setProperty("--px", px.value.toFixed(3));
      el.style.setProperty("--py", py.value.toFixed(3));
      el.dataset.mood = mood;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [stageRef, poweredOn, enabled]);
}
