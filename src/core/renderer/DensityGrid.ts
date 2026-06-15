import { Vector3 } from 'three';
import { DensityGrid, GridResolution, GRID_RESOLUTION_CONFIG } from '@/types';
import { getBoundingBox, getBoundingBoxSize, trilinearInterpolate } from '@/utils/math';
import { Atom } from '@/types';

export class DensityGridGenerator {
  public static createFromAtoms(
    atoms: Atom[],
    resolution: GridResolution = 'medium',
    padding: number = 3.0
  ): DensityGrid {
    const positions = atoms.map(a => a.position);
    const bbox = getBoundingBox(positions);
    const config = GRID_RESOLUTION_CONFIG[resolution];

    const size = getBoundingBoxSize(bbox.min, bbox.max) + padding * 2;
    const steps = config.steps;
    const spacing = size / steps;

    const origin = new Vector3(
      bbox.min.x - padding,
      bbox.min.y - padding,
      bbox.min.z - padding
    );

    const dimensions: [number, number, number] = [steps, steps, steps];
    const spacingVec = new Vector3(spacing, spacing, spacing);
    const data = new Float32Array(steps * steps * steps);

    return {
      dimensions,
      origin,
      spacing: spacingVec,
      data,
      unit: 'e/bohr^3',
      resolution,
    };
  }

  public static getValue(grid: DensityGrid, x: number, y: number, z: number): number {
    const [nx, ny, nz] = grid.dimensions;
    const localX = (x - grid.origin.x) / grid.spacing.x;
    const localY = (y - grid.origin.y) / grid.spacing.y;
    const localZ = (z - grid.origin.z) / grid.spacing.z;

    if (localX < 0 || localX >= nx - 1 || localY < 0 || localY >= ny - 1 || localZ < 0 || localZ >= nz - 1) {
      return 0;
    }

    return trilinearInterpolate(grid.data, grid.dimensions, localX, localY, localZ);
  }

  public static setValue(grid: DensityGrid, ix: number, iy: number, iz: number, value: number): void {
    const [nx, ny] = grid.dimensions;
    const index = iz * nx * ny + iy * nx + ix;
    grid.data[index] = value;
  }

  public static getMinMax(grid: DensityGrid): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < grid.data.length; i++) {
      const val = grid.data[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    return { min, max };
  }

  public static normalize(grid: DensityGrid): DensityGrid {
    const { min, max } = this.getMinMax(grid);
    const range = max - min || 1;

    for (let i = 0; i < grid.data.length; i++) {
      grid.data[i] = (grid.data[i] - min) / range;
    }

    return grid;
  }

  public static clone(grid: DensityGrid): DensityGrid {
    return {
      dimensions: [...grid.dimensions] as [number, number, number],
      origin: grid.origin.clone(),
      spacing: grid.spacing.clone(),
      data: new Float32Array(grid.data),
      unit: grid.unit,
      resolution: grid.resolution,
    };
  }
}

export class AtomicDensityCalculator {
  private static STO3G_EXPONENTS: Record<string, number[]> = {
    H: [3.42525, 0.62391, 0.16886],
    C: [2.94125, 0.68348, 0.22229],
    N: [3.78045, 0.87849, 0.28572],
    O: [4.5737, 1.0395, 0.33695],
    F: [5.3804, 1.2194, 0.39472],
    S: [14.045, 3.1644, 1.0241],
    P: [11.625, 2.7113, 0.89055],
    Cl: [16.385, 3.6492, 1.1758],
  };

  private static STO3G_COEFFICIENTS: Record<string, number[]> = {
    H: [0.15433, 0.53533, 0.44463],
    C: [-0.1009, 0.5508, 0.5278],
    N: [-0.1317, 0.5659, 0.5367],
    O: [-0.1608, 0.5796, 0.5440],
    F: [-0.1876, 0.5915, 0.5501],
    S: [-0.0659, 0.5270, 0.5517],
    P: [-0.0595, 0.5180, 0.5518],
    Cl: [-0.0707, 0.5350, 0.5513],
  };

  public static calculateAtomicDensity(
    center: Vector3,
    point: Vector3,
    element: string
  ): number {
    const r = center.distanceTo(point);
    const exponents = this.STO3G_EXPONENTS[element] || this.STO3G_EXPONENTS.C;
    const coefficients = this.STO3G_COEFFICIENTS[element] || this.STO3G_COEFFICIENTS.C;

    let density = 0;
    for (let i = 0; i < exponents.length; i++) {
      const alpha = exponents[i];
      const c = coefficients[i];
      const basis = Math.pow(alpha / Math.PI, 0.75) * Math.exp(-alpha * r * r);
      density += c * basis;
    }

    return density * density;
  }

  public static calculateMolecularDensity(
    atoms: Atom[],
    grid: DensityGrid,
    onProgress?: (progress: number) => void
  ): DensityGrid {
    const [nx, ny, nz] = grid.dimensions;
    const totalPoints = nx * ny * nz;
    let processed = 0;

    for (let iz = 0; iz < nz; iz++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const point = new Vector3(
            grid.origin.x + ix * grid.spacing.x,
            grid.origin.y + iy * grid.spacing.y,
            grid.origin.z + iz * grid.spacing.z
          );

          let totalDensity = 0;
          for (const atom of atoms) {
            if (atom.visible !== false) {
              totalDensity += this.calculateAtomicDensity(atom.position, point, atom.symbol);
            }
          }

          DensityGridGenerator.setValue(grid, ix, iy, iz, totalDensity);
          processed++;

          if (onProgress && processed % 10000 === 0) {
            onProgress(processed / totalPoints);
          }
        }
      }
    }

    if (onProgress) onProgress(1);
    return grid;
  }
}
