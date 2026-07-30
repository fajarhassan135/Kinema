"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { HOMEPAGE_FILMS } from "../../lib/homepageFilms";

type FilmData = {
  posterUrl: string | null;
  film: string;
  line: string;
};

export default function FilmStripHero() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationId: number;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let disposed = false;

    async function init() {
      const container = mountRef.current;
      if (!container) return;

      // 1. Fetch Movie Poster Data
      const filmData: FilmData[] = await Promise.all(
        HOMEPAGE_FILMS.map(async (f) => {
          try {
            const res = await fetch(`/api/movies?type=by_id&id=${f.tmdbId}`);
            const data = await res.json();
            const posterPath = data.movie?.poster_path || null;
            return {
              posterUrl: posterPath
                ? `/api/proxy-image?url=${encodeURIComponent(`https://image.tmdb.org/t/p/w500${posterPath}`)}`
                : null,
              film: f.film,
              line: f.line,
            };
          } catch {
            return { posterUrl: null, film: f.film, line: f.line };
          }
        })
      );

      if (disposed) return;

      // 2. Scene & Renderer
      scene = new THREE.Scene();

      // Reframed for a WIDE horizontal wave instead of a tall vertical spiral.
      // Pulled back on z and widened FOV so the full horizontal span is visible.
      camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.set(0, 1.5, 24);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);

      // 3. Cinematic Studio Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
      keyLight.position.set(10, 10, 10);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x88ccff, 1.0);
      fillLight.position.set(-10, 2, -5);
      scene.add(fillLight);

      // 4. Wave Path Geometry (replaces the old vertical spiral)
      // RANGE_X: total horizontal span the strip travels across.
      // AMPLITUDE_Y: how tall the up/down waves are.
      // AMPLITUDE_Z: how much depth/parallax the wave has (kept modest so it
      //   doesn't fight with the y-wave the way it did in the old CSS version).
      // WAVE_CYCLES: how many full down-up cycles happen across RANGE_X —
      //   this is the main knob for matching the reference video's rhythm.
      const RANGE_X = 34;
      const AMPLITUDE_Y = 3.2;
      const AMPLITUDE_Z = 2.0;
      const WAVE_CYCLES = 2.5;
      const SEGMENTS = 400;

      function pointAt(t: number): THREE.Vector3 {
        const x = (t - 0.5) * RANGE_X;
        const wavePhase = t * WAVE_CYCLES * Math.PI * 2;
        const y = Math.sin(wavePhase) * AMPLITUDE_Y;
        const z = Math.cos(wavePhase) * AMPLITUDE_Z;
        return new THREE.Vector3(x, y, z);
      }

      const curvePoints: THREE.Vector3[] = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        curvePoints.push(pointAt(i / SEGMENTS));
      }
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const totalSegments = SEGMENTS;
      const frames = curve.computeFrenetFrames(totalSegments, false);

      // 5. Build Extruded Film Ribbon (unchanged logic, just reuses the new curve)
      const ribbonWidth = 1.5;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      // REPEATS controls how many times the sprocket-hole texture tiles along
      // the strip. Detached from the old TURNS variable since there's no
      // longer a literal spiral revolution count.
      const REPEATS = 10;

      for (let i = 0; i <= totalSegments; i++) {
        const p = curve.getPointAt(i / totalSegments);
        const binormal = frames.binormals[i];

        const left = p.clone().addScaledVector(binormal, -ribbonWidth / 2);
        const right = p.clone().addScaledVector(binormal, ribbonWidth / 2);

        positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

        const v = (i / totalSegments) * REPEATS;
        uvs.push(0, v, 1, v);
      }
      for (let i = 0; i < totalSegments; i++) {
        const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
        indices.push(a, b, c, b, d, c);
      }

      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      ribbonGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      ribbonGeo.setIndex(indices);
      ribbonGeo.computeVertexNormals();

      // 6. Sprocket Film Texture (unchanged)
      const sprocketCanvas = document.createElement("canvas");
      sprocketCanvas.width = 128;
      sprocketCanvas.height = 512;
      const sctx = sprocketCanvas.getContext("2d")!;

      sctx.fillStyle = "#070708";
      sctx.fillRect(0, 0, 128, 512);

      sctx.fillStyle = "#010101";
      for (let y = 0; y < 512; y += 128) {
        sctx.fillRect(16, y + 8, 96, 112);
      }

      sctx.fillStyle = "#ffffff";
      for (let y = 4; y < 512; y += 32) {
        sctx.fillRect(4, y, 6, 14);
        sctx.fillRect(118, y, 6, 14);
      }

      const sprocketTexture = new THREE.CanvasTexture(sprocketCanvas);
      sprocketTexture.wrapS = THREE.RepeatWrapping;
      sprocketTexture.wrapT = THREE.RepeatWrapping;
      sprocketTexture.minFilter = THREE.LinearMipmapLinearFilter;
      sprocketTexture.generateMipmaps = true;

      const ribbonMat = new THREE.MeshStandardMaterial({
        map: sprocketTexture,
        side: THREE.DoubleSide,
        metalness: 0.7,
        roughness: 0.15,
      });

      const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
      scene.add(ribbonMesh);

      // 7. Dynamic Movie Posters
      // totalFrameSlots is now independent of TURNS — tune this directly to
      // control how many posters are visible along the strip at once.
      const totalFrameSlots = 20;
      const posterMeshes: {
        mesh: THREE.Mesh;
        canvas: HTMLCanvasElement;
        ctx: CanvasRenderingContext2D;
        texture: THREE.CanvasTexture;
        img: HTMLImageElement | null;
        data: FilmData;
        phase: number;
        baseT: number;
      }[] = [];

      const innerCellWidth = ribbonWidth * (96 / 128);
      const innerCellHeight = (ribbonWidth * (112 / 128)) * 1.05;

      for (let i = 0; i < totalFrameSlots; i++) {
        const baseT = i / totalFrameSlots;
        const data = filmData[i % filmData.length];

        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext("2d")!;
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const geo = new THREE.PlaneGeometry(innerCellWidth, innerCellHeight);

        const mat = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 0.2,
          metalness: 0.1,
        });

        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        let img: HTMLImageElement | null = null;
        if (data.posterUrl) {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.src = data.posterUrl;
        }

        posterMeshes.push({ mesh, canvas, ctx, texture, img, data, phase: Math.random() * Math.PI * 2, baseT });
      }

      function drawFrame(entry: typeof posterMeshes[number], elapsed: number) {
        const { ctx, canvas, img, data, phase } = entry;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (img && img.complete && img.naturalWidth > 0) {
          const zoomCycle = (Math.sin(elapsed * 0.2 + phase) + 1) / 2;
          const scale = 1.02 + zoomCycle * 0.08;
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(scale, scale);
          ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
          ctx.restore();
        }

        const captionCycle = (Math.sin(elapsed * 0.25 + phase + Math.PI) + 1) / 2;
        const alpha = Math.max(0, captionCycle - 0.4) / 0.6;
        if (alpha > 0.02) {
          ctx.fillStyle = `rgba(0,0,0,${0.75 * alpha})`;
          ctx.fillRect(0, canvas.height - 110, canvas.width, 110);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.font = "italic 16px Georgia, serif";
          ctx.textAlign = "center";
          wrapText(ctx, `"${data.line}"`, canvas.width / 2, canvas.height - 65, canvas.width - 30, 22);
          ctx.font = "bold 12px Arial";
          ctx.fillStyle = `rgba(230,200,100,${alpha})`;
          ctx.fillText(data.film, canvas.width / 2, canvas.height - 18);
        }

        entry.texture.needsUpdate = true;
      }

      function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
        const words = text.split(" ");
        let line = "";
        const lines: string[] = [];
        for (const word of words) {
          const testLine = line + word + " ";
          if (ctx.measureText(testLine).width > maxWidth && line !== "") {
            lines.push(line);
            line = word + " ";
          } else {
            line = testLine;
          }
        }
        lines.push(line);
        const startY = y - (lines.length - 1) * lineHeight;
        lines.forEach((l, idx) => ctx.fillText(l.trim(), x, startY + idx * lineHeight));
      }

      const startTime = performance.now();

      // 8. Animation Loop (unchanged wrap-around logic — still relies on both
      // ends of the path being off-screen so the t=1 -> t=0 jump isn't visible;
      // RANGE_X=34 should give some margin at this camera distance, but this
      // is untested and may need adjusting once you see it)
      function animate() {
        if (disposed) return;
        const elapsed = (performance.now() - startTime) / 1000;

        const scrollSpeed = 0.025;

        sprocketTexture.offset.y = -(elapsed * scrollSpeed * REPEATS);

        posterMeshes.forEach((entry) => {
          let currentT = (entry.baseT - (elapsed * scrollSpeed)) % 1.0;
          if (currentT < 0) currentT += 1.0;

          const pointOnCurve = curve.getPointAt(currentT);

          const segmentIndex = Math.min(Math.floor(currentT * totalSegments), totalSegments);
          const tangent = frames.tangents[segmentIndex];
          const normal = frames.normals[segmentIndex];
          const binormal = frames.binormals[segmentIndex];

          const offsetPosition = pointOnCurve.clone().addScaledVector(normal, 0.012);
          entry.mesh.position.copy(offsetPosition);

          const orientationMatrix = new THREE.Matrix4().makeBasis(binormal, tangent, normal);
          entry.mesh.setRotationFromMatrix(orientationMatrix);

          drawFrame(entry, elapsed);
        });

        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
      }
      animate();

      function handleResize() {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      }
      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }

    init();

    return () => {
      disposed = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) {
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentElement === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh", background: "#050506" }} />;
}
