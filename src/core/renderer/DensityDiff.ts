import { DensityGrid, GridResolution, Atom } from '@/types';
import { DensityGridGenerator, AtomicDensityCalculator } from './DensityGrid';

export class DensityDifference {
  public static calculate(
    productAtoms: Atom[],
    reactantAtoms: Atom[],
    resolution: GridResolution = 'medium',
    onProgress?: (progress: number) => void
  ): {
    differenceGrid: DensityGrid;
    productGrid: DensityGrid;
    reactantGrid: DensityGrid;
  } {
    const allAtoms = [...productAtoms, ...reactantAtoms];

    const productGrid = DensityGridGenerator.createFromAtoms(allAtoms, resolution);
    const reactantGrid = DensityGridGenerator.clone(productGrid);
    const differenceGrid = DensityGridGenerator.clone(productGrid);

    if (onProgress) onProgress(0.1);

    AtomicDensityCalculator.calculateMolecularDensity(
      productAtoms,
      productGrid,
      (p) => onProgress?.(0.1 + p * 0.4)
    );

    AtomicDensityCalculator.calculateMolecularDensity(
      reactantAtoms,
      reactantGrid,
      (p) => onProgress?.(0.5 + p * 0.4)
    );

    for (let i = 0; i < productGrid.data.length; i++) {
      differenceGrid.data[i] = productGrid.data[i] - reactantGrid.data[i];
    }

    if (onProgress) onProgress(1);

    return { differenceGrid, productGrid, reactantGrid };
  }

  public static calculateAsync(
    productAtoms: Atom[],
    reactantAtoms: Atom[],
    resolution: GridResolution = 'medium',
    onProgress?: (progress: number) => void
  ): Promise<{
    differenceGrid: DensityGrid;
    productGrid: DensityGrid;
    reactantGrid: DensityGrid;
  }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.calculate(productAtoms, reactantAtoms, resolution, onProgress);
        resolve(result);
      }, 10);
    });
  }

  public static getPositiveNegativeGrids(
    differenceGrid: DensityGrid
  ): { positive: DensityGrid; negative: DensityGrid } {
    const positive = DensityGridGenerator.clone(differenceGrid);
    const negative = DensityGridGenerator.clone(differenceGrid);

    for (let i = 0; i < differenceGrid.data.length; i++) {
      const val = differenceGrid.data[i];
      positive.data[i] = val > 0 ? val : 0;
      negative.data[i] = val < 0 ? -val : 0;
    }

    return { positive, negative };
  }

  public static getAutoIsoValue(grid: DensityGrid, percentile: number = 0.85): number {
    const absValues: number[] = [];
    for (let i = 0; i < grid.data.length; i++) {
      const val = Math.abs(grid.data[i]);
      if (val > 1e-6) {
        absValues.push(val);
      }
    }

    if (absValues.length === 0) return 0.01;

    absValues.sort((a, b) => a - b);
    const index = Math.floor(absValues.length * percentile);
    return absValues[Math.min(index, absValues.length - 1)];
  }
}
