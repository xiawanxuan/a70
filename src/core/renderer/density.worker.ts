/// <reference lib="webworker" />
import type { Atom, DensityGrid, GridResolution } from '../../types';
import { GRID_RESOLUTION_CONFIG } from '../../types';
import { getBoundingBox, getBoundingBoxSize } from '../../utils/math';

interface WorkerMessage {
  type: 'calculateDensity' | 'calculateDifference' | 'cancel';
  id: string;
  payload?: any;
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  id: string;
  payload?: any;
  progress?: number;
  error?: string;
}

const STO3G_EXPONENTS: Record<string, number[]> = {
  H: [3.42525, 0.62391, 0.16886],
  C: [2.94125, 0.68348, 0.22229],
  N: [3.78045, 0.87849, 0.28572],
  O: [4.5737, 1.0395, 0.33695],
  F: [5.3804, 1.2194, 0.39472],
  S: [14.045, 3.1644, 1.0241],
  P: [11.625, 2.7113, 0.89055],
  Cl: [16.385, 3.6492, 1.1758],
};

const STO3G_COEFFICIENTS: Record<string, number[]> = {
  H: [0.15433, 0.53533, 0.44463],
  C: [-0.1009, 0.5508, 0.5278],
  N: [-0.1317, 0.5659, 0.5367],
  O: [-0.1608, 0.5796, 0.5440],
  F: [-0.1876, 0.5915, 0.5501],
  S: [-0.0659, 0.5270, 0.5517],
  P: [-0.0595, 0.5180, 0.5518],
  Cl: [-0.0707, 0.5350, 0.5513],
};

let isCancelled = false;

function calculateAtomicDensity(
  centerX: number, centerY: number, centerZ: number,
  pointX: number, pointY: number, pointZ: number,
  element: string
): number {
  const dx = pointX - centerX;
  const dy = pointY - centerY;
  const dz = pointZ - centerZ;
  const r2 = dx * dx + dy * dy + dz * dz;
  const r = Math.sqrt(r2);
  
  const exponents = STO3G_EXPONENTS[element] || STO3G_EXPONENTS.C;
  const coefficients = STO3G_COEFFICIENTS[element] || STO3G_COEFFICIENTS.C;

  let density = 0;
  for (let i = 0; i < exponents.length; i++) {
    const alpha = exponents[i];
    const c = coefficients[i];
    const basis = Math.pow(alpha / Math.PI, 0.75) * Math.exp(-alpha * r * r);
    density += c * basis;
  }

  return density * density;
}

function createGridFromAtoms(
  atoms: Atom[],
  resolution: GridResolution,
  padding: number = 3.0
): DensityGrid {
  const positions = atoms.map(a => ({ x: a.position.x, y: a.position.y, z: a.position.z }));
  
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

  const config = GRID_RESOLUTION_CONFIG[resolution];
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + padding * 2;
  const steps = config.steps;
  const spacing = size / steps;

  const origin = {
    x: minX - padding,
    y: minY - padding,
    z: minZ - padding,
  };

  const dimensions: [number, number, number] = [steps, steps, steps];
  const data = new Float32Array(steps * steps * steps);

  return {
    dimensions,
    origin: { x: origin.x, y: origin.y, z: origin.z } as any,
    spacing: { x: spacing, y: spacing, z: spacing } as any,
    data,
    unit: 'e/bohr^3',
    resolution,
  };
}

function calculateMolecularDensity(
  atoms: Atom[],
  grid: DensityGrid,
  onProgress?: (progress: number) => void
): DensityGrid {
  const [nx, ny, nz] = grid.dimensions;
  const totalPoints = nx * ny * nz;
  let processed = 0;
  const reportInterval = Math.max(1, Math.floor(totalPoints / 100));

  const visibleAtoms = atoms.filter(a => a.visible !== false);
  const atomData = visibleAtoms.map(a => ({
    x: a.position.x,
    y: a.position.y,
    z: a.position.z,
    element: a.symbol,
  }));

  const ox = grid.origin.x as unknown as number;
  const oy = grid.origin.y as unknown as number;
  const oz = grid.origin.z as unknown as number;
  const sx = grid.spacing.x as unknown as number;
  const sy = grid.spacing.y as unknown as number;
  const sz = grid.spacing.z as unknown as number;

  for (let iz = 0; iz < nz; iz++) {
    if (isCancelled) break;
    
    const z = oz + iz * sz;
    
    for (let iy = 0; iy < ny; iy++) {
      const y = oy + iy * sy;
      
      for (let ix = 0; ix < nx; ix++) {
        const x = ox + ix * sx;

        let totalDensity = 0;
        for (const atom of atomData) {
          totalDensity += calculateAtomicDensity(
            atom.x, atom.y, atom.z,
            x, y, z,
            atom.element
          );
        }

        const index = iz * nx * ny + iy * nx + ix;
        grid.data[index] = totalDensity;
        
        processed++;
        if (processed % reportInterval === 0) {
          onProgress?.(processed / totalPoints);
        }
      }
    }
  }

  onProgress?.(1);
  return grid;
}

function serializeGrid(grid: DensityGrid): any {
  return {
    dimensions: grid.dimensions,
    origin: { x: grid.origin.x, y: grid.origin.y, z: grid.origin.z },
    spacing: { x: grid.spacing.x, y: grid.spacing.y, z: grid.spacing.z },
    data: Array.from(grid.data),
    unit: grid.unit,
    resolution: grid.resolution,
  };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = e.data;

  if (type === 'cancel') {
    isCancelled = true;
    return;
  }

  isCancelled = false;

  try {
    if (type === 'calculateDensity') {
      const { atoms, resolution } = payload;
      
      const sendProgress = (progress: number) => {
        (self as any).postMessage({
          type: 'progress',
          id,
          progress,
        } as WorkerResponse);
      };

      const grid = createGridFromAtoms(atoms, resolution);
      calculateMolecularDensity(atoms, grid, sendProgress);
      
      if (isCancelled) return;

      (self as any).postMessage({
        type: 'result',
        id,
        payload: serializeGrid(grid),
      } as WorkerResponse);
    }

    if (type === 'calculateDifference') {
      const { reactantAtoms, productAtoms, resolution } = payload;
      const allAtoms = [...reactantAtoms, ...productAtoms];

      const sendProgress = (progress: number) => {
        (self as any).postMessage({
          type: 'progress',
          id,
          progress,
        } as WorkerResponse);
      };

      const productGrid = createGridFromAtoms(allAtoms, resolution);
      const reactantGrid = createGridFromAtoms(allAtoms, resolution);
      const differenceGrid = createGridFromAtoms(allAtoms, resolution);

      sendProgress(0.05);

      calculateMolecularDensity(productAtoms, productGrid, (p) => {
        sendProgress(0.05 + p * 0.4);
      });

      if (isCancelled) return;

      calculateMolecularDensity(reactantAtoms, reactantGrid, (p) => {
        sendProgress(0.45 + p * 0.4);
      });

      if (isCancelled) return;

      for (let i = 0; i < productGrid.data.length; i++) {
        differenceGrid.data[i] = productGrid.data[i] - reactantGrid.data[i];
      }

      sendProgress(1);

      (self as any).postMessage({
        type: 'result',
        id,
        payload: {
          differenceGrid: serializeGrid(differenceGrid),
          productGrid: serializeGrid(productGrid),
          reactantGrid: serializeGrid(reactantGrid),
        },
      } as WorkerResponse);
    }
  } catch (error) {
    (self as any).postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse);
  }
};
