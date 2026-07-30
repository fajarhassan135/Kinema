export type PathPoint = {
    x: number;
    y: number;
    z: number;
    rotateY: number; // degrees
  };
  
  export type FilmStripPathOptions = {
    count: number;
    spacingX: number;   // horizontal distance between consecutive frames
    amplitudeY: number; // vertical wave height
    amplitudeZ: number; // depth wave (toward/away from camera)
    frequency: number;  // wave cycles per unit of spacingX
  };
  
  /**
   * Computes a set of 3D points + yaw rotation along a horizontal S-curve.
   * Tangent is estimated via finite difference (sampling t and t+epsilon)
   * to derive rotateY, so each frame appears to "face" along the path.
   */
  export function getFilmStripPath(options: FilmStripPathOptions): PathPoint[] {
    const { count, spacingX, amplitudeY, amplitudeZ, frequency } = options;
    const epsilon = 0.01;
  
    function positionAt(t: number): { x: number; y: number; z: number } {
      const x = t * spacingX;
      const y = Math.sin(t * frequency) * amplitudeY;
      const z = Math.cos(t * frequency) * amplitudeZ;
      return { x, y, z };
    }
  
    const points: PathPoint[] = [];
  
    for (let i = 0; i < count; i++) {
      const t = i;
      const p = positionAt(t);
      const pNext = positionAt(t + epsilon);
  
      const dx = pNext.x - p.x;
      const dz = pNext.z - p.z;
      const rotateY = (Math.atan2(dz, dx) * 180) / Math.PI;
  
      points.push({ x: p.x, y: p.y, z: p.z, rotateY });
    }
  
    return points;
  }