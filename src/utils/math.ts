import { Vector3 } from 'three';

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothStep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const distance3D = (p1: Vector3, p2: Vector3): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const distanceSquared3D = (p1: Vector3, p2: Vector3): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return dx * dx + dy * dy + dz * dz;
};

export const vectorFromArray = (arr: [number, number, number]): Vector3 =>
  new Vector3(arr[0], arr[1], arr[2]);

export const vectorToArray = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

export const getBoundingBox = (positions: Vector3[]): { min: Vector3; max: Vector3; center: Vector3 } => {
  if (positions.length === 0) {
    return {
      min: new Vector3(0, 0, 0),
      max: new Vector3(0, 0, 0),
      center: new Vector3(0, 0, 0),
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const p of positions) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    min: new Vector3(minX, minY, minZ),
    max: new Vector3(maxX, maxY, maxZ),
    center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
  };
};

export const getBoundingBoxSize = (min: Vector3, max: Vector3): number => {
  const dx = max.x - min.x;
  const dy = max.y - min.y;
  const dz = max.z - min.z;
  return Math.max(dx, dy, dz);
};

export const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatScientific = (value: number, precision: number = 4): string => {
  return value.toExponential(precision);
};

export const formatDecimal = (value: number, precision: number = 4): string => {
  return value.toFixed(precision);
};

export const trilinearInterpolate = (
  data: Float32Array,
  dims: [number, number, number],
  x: number, y: number, z: number
): number => {
  const [nx, ny, nz] = dims;

  const x0 = Math.floor(x); const y0 = Math.floor(y); const z0 = Math.floor(z);
  const x1 = Math.min(x0 + 1, nx - 1);
  const y1 = Math.min(y0 + 1, ny - 1);
  const z1 = Math.min(z0 + 1, nz - 1);

  const fx = x - x0; const fy = y - y0; const fz = z - z0;

  const idx = (ix: number, iy: number, iz: number) => iz * nx * ny + iy * nx + ix;

  const c000 = data[idx(x0, y0, z0)];
  const c100 = data[idx(x1, y0, z0)];
  const c010 = data[idx(x0, y1, z0)];
  const c110 = data[idx(x1, y1, z0)];
  const c001 = data[idx(x0, y0, z1)];
  const c101 = data[idx(x1, y0, z1)];
  const c011 = data[idx(x0, y1, z1)];
  const c111 = data[idx(x1, y1, z1)];

  const c00 = c000 * (1 - fx) + c100 * fx;
  const c10 = c010 * (1 - fx) + c110 * fx;
  const c01 = c001 * (1 - fx) + c101 * fx;
  const c11 = c011 * (1 - fx) + c111 * fx;

  const c0 = c00 * (1 - fy) + c10 * fy;
  const c1 = c01 * (1 - fy) + c11 * fy;

  return c0 * (1 - fz) + c1 * fz;
};
