import { Vector3 } from 'three';
import type { Atom, Molecule, MoleculeFragment, Bond } from '../types';
import { getAtomicNumber } from '../config/materials';
import { generateId, distance3D } from './math';
import { IsosurfaceGenerator } from '../core/renderer/Isosurface';
import { DensityGridGenerator, AtomicDensityCalculator } from '../core/renderer/DensityGrid';

export interface PerformanceResult {
  name: string;
  duration: number;
  atomCount?: number;
  vertexCount?: number;
  triangleCount?: number;
  details?: Record<string, number>;
}

export class PerformanceTest {
  private static results: PerformanceResult[] = [];

  public static createLargeMolecule(atomCount: number, name: string = 'Large Molecule'): Molecule {
    const atoms: Atom[] = [];
    const elements = ['C', 'H', 'O', 'N', 'S', 'P'];
    
    for (let i = 0; i < atomCount; i++) {
      const angle = (i / atomCount) * Math.PI * 8;
      const radius = 2 + (i % 10) * 0.5;
      const height = (i / atomCount) * 20 - 10;
      
      const element = elements[i % elements.length];
      atoms.push({
        id: i,
        element,
        symbol: element,
        position: new Vector3(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        ),
        atomicNumber: getAtomicNumber(element),
        visible: true,
      });
    }

    const bonds: Bond[] = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < Math.min(i + 5, atoms.length); j++) {
        const dist = distance3D(atoms[i].position, atoms[j].position);
        if (dist < 2.0) {
          bonds.push({
            id: bonds.length,
            atom1: i,
            atom2: j,
            order: 1,
            length: dist,
          });
        }
      }
    }

    const fragments: MoleculeFragment[] = [
      {
        id: 'frag-main',
        name: 'Main Chain',
        atomIds: atoms.filter((_, i) => i % 2 === 0).map((a) => a.id),
        visible: true,
      },
      {
        id: 'frag-side',
        name: 'Side Groups',
        atomIds: atoms.filter((_, i) => i % 2 === 1).map((a) => a.id),
        visible: true,
      },
    ];

    return {
      id: generateId(),
      name,
      type: 'intermediate',
      atoms,
      bonds,
      molecularFormula: `C${Math.floor(atomCount/3)}H${Math.floor(atomCount/2)}O${Math.floor(atomCount/10)}`,
      charge: 0,
      multiplicity: 1,
      fragments,
    };
  }

  public static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    details?: Record<string, number>
  ): Promise<{ result: T; performance: PerformanceResult }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    const perfResult: PerformanceResult = {
      name,
      duration,
      details,
    };
    
    this.results.push(perfResult);
    return { result, performance: perfResult };
  }

  public static measure<T>(
    name: string,
    fn: () => T,
    details?: Record<string, number>
  ): { result: T; performance: PerformanceResult } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    const perfResult: PerformanceResult = {
      name,
      duration,
      details,
    };
    
    this.results.push(perfResult);
    return { result, performance: perfResult };
  }

  public static async runDensityTest(atomCount: number): Promise<PerformanceResult[]> {
    console.log(`Running density test for ${atomCount} atoms...`);
    const testResults: PerformanceResult[] = [];

    const molecule = this.createLargeMolecule(atomCount, `Test Molecule (${atomCount} atoms)`);
    
    const gridCreate = this.measure(
      'Create Density Grid',
      () => DensityGridGenerator.createFromAtoms(molecule.atoms, 'medium'),
      { atomCount }
    );
    testResults.push(gridCreate.performance);

    const densityCalc = await this.measureAsync(
      'Calculate Molecular Density',
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const grid = DensityGridGenerator.clone(gridCreate.result);
            AtomicDensityCalculator.calculateMolecularDensity(molecule.atoms, grid);
            resolve(grid);
          }, 10);
        });
      },
      { atomCount, gridSize: gridCreate.result.data.length }
    );
    testResults.push(densityCalc.performance);

    const isoGenerate = this.measure(
      'Generate Isosurface',
      () => {
        const { positive, negative } = IsosurfaceGenerator.generatePositiveNegative(
          densityCalc.result as any,
          0.001
        );
        return { positive, negative };
      },
      { atomCount }
    );
    testResults.push({
      ...isoGenerate.performance,
      vertexCount: isoGenerate.result.positive.vertexCount + isoGenerate.result.negative.vertexCount,
      triangleCount: isoGenerate.result.positive.triangleCount + isoGenerate.result.negative.triangleCount,
    });

    console.log('Test results:', testResults);
    return testResults;
  }

  public static async runBenchmark(): Promise<PerformanceResult[]> {
    console.log('Starting performance benchmark...');
    const allResults: PerformanceResult[] = [];

    const sizes = [20, 50, 100, 200];
    
    for (const size of sizes) {
      const results = await this.runDensityTest(size);
      allResults.push(...results);
      
      const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
      console.log(`Total time for ${size} atoms: ${totalTime.toFixed(2)}ms`);
      
      if (size < sizes[sizes.length - 1]) {
        IsosurfaceGenerator.clearCache();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log('Benchmark complete!');
    console.log('Summary:');
    allResults.forEach((r) => {
      console.log(`  ${r.name}: ${r.duration.toFixed(2)}ms${r.atomCount ? ` (${r.atomCount} atoms)` : ''}`);
    });

    return allResults;
  }

  public static getResults(): PerformanceResult[] {
    return [...this.results];
  }

  public static clearResults(): void {
    this.results = [];
  }

  public static formatResults(results: PerformanceResult[]): string {
    return results
      .map(
        (r) =>
          `${r.name}: ${r.duration.toFixed(2)}ms` +
          (r.atomCount ? ` | Atoms: ${r.atomCount}` : '') +
          (r.vertexCount ? ` | Vertices: ${r.vertexCount}` : '') +
          (r.triangleCount ? ` | Triangles: ${r.triangleCount}` : '')
      )
      .join('\n');
  }
}

if (typeof window !== 'undefined') {
  (window as any).PerformanceTest = PerformanceTest;
}
