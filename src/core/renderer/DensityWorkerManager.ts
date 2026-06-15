import { Vector3 } from 'three';
import type { Atom, DensityGrid, GridResolution } from '../../types';

type ProgressCallback = (progress: number) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  onProgress?: ProgressCallback;
}

export class DensityWorkerManager {
  private static worker: Worker | null = null;
  private static pendingRequests = new Map<string, PendingRequest>();
  private static requestCounter = 0;

  private static initWorker(): void {
    if (DensityWorkerManager.worker) return;

    try {
      DensityWorkerManager.worker = new Worker(
        new URL('./density.worker.ts', import.meta.url),
        { type: 'module' }
      );

      DensityWorkerManager.worker.onmessage = (e: MessageEvent) => {
        const { type, id, payload, progress, error } = e.data;

        const request = DensityWorkerManager.pendingRequests.get(id);
        if (!request) return;

        if (type === 'progress') {
          request.onProgress?.(progress || 0);
        } else if (type === 'result') {
          request.resolve(DensityWorkerManager.deserializePayload(payload));
          DensityWorkerManager.pendingRequests.delete(id);
        } else if (type === 'error') {
          request.reject(new Error(error || 'Unknown error'));
          DensityWorkerManager.pendingRequests.delete(id);
        }
      };

      DensityWorkerManager.worker.onerror = (error) => {
        console.error('Density worker error:', error);
        DensityWorkerManager.pendingRequests.forEach((req) => {
          req.reject(new Error('Worker error'));
        });
        DensityWorkerManager.pendingRequests.clear();
      };
    } catch (error) {
      console.warn('Failed to create Web Worker, falling back to main thread:', error);
      DensityWorkerManager.worker = null;
    }
  }

  private static deserializePayload(payload: any): any {
    if (payload && payload.differenceGrid) {
      return {
        differenceGrid: DensityWorkerManager.deserializeGrid(payload.differenceGrid),
        productGrid: DensityWorkerManager.deserializeGrid(payload.productGrid),
        reactantGrid: DensityWorkerManager.deserializeGrid(payload.reactantGrid),
      };
    }
    if (payload && payload.dimensions) {
      return DensityWorkerManager.deserializeGrid(payload);
    }
    return payload;
  }

  private static deserializeGrid(data: any): DensityGrid {
    return {
      dimensions: data.dimensions as [number, number, number],
      origin: new Vector3(data.origin.x, data.origin.y, data.origin.z),
      spacing: new Vector3(data.spacing.x, data.spacing.y, data.spacing.z),
      data: new Float32Array(data.data),
      unit: data.unit,
      resolution: data.resolution,
    };
  }

  private static serializeAtoms(atoms: Atom[]): any[] {
    return atoms.map((atom) => ({
      id: atom.id,
      symbol: atom.symbol,
      element: atom.element,
      position: {
        x: atom.position.x,
        y: atom.position.y,
        z: atom.position.z,
      },
      visible: atom.visible,
    }));
  }

  public static async calculateDensity(
    atoms: Atom[],
    resolution: GridResolution,
    onProgress?: ProgressCallback
  ): Promise<DensityGrid> {
    DensityWorkerManager.initWorker();

    if (!DensityWorkerManager.worker) {
      const { DensityDifference } = await import('./DensityDiff');
      const { DensityGridGenerator, AtomicDensityCalculator } = await import('./DensityGrid');
      
      const grid = DensityGridGenerator.createFromAtoms(atoms, resolution);
      return new Promise((resolve) => {
        setTimeout(() => {
          AtomicDensityCalculator.calculateMolecularDensity(atoms, grid, onProgress);
          resolve(grid);
        }, 10);
      });
    }

    const id = `req-${++DensityWorkerManager.requestCounter}`;
    const promise = new Promise<any>((resolve, reject) => {
      DensityWorkerManager.pendingRequests.set(id, { resolve, reject, onProgress });
    });

    DensityWorkerManager.worker.postMessage({
      type: 'calculateDensity',
      id,
      payload: {
        atoms: DensityWorkerManager.serializeAtoms(atoms),
        resolution,
      },
    });

    return promise;
  }

  public static async calculateDifference(
    reactantAtoms: Atom[],
    productAtoms: Atom[],
    resolution: GridResolution,
    onProgress?: ProgressCallback
  ): Promise<{
    differenceGrid: DensityGrid;
    productGrid: DensityGrid;
    reactantGrid: DensityGrid;
  }> {
    DensityWorkerManager.initWorker();

    if (!DensityWorkerManager.worker) {
      const { DensityDifference } = await import('./DensityDiff');
      return DensityDifference.calculate(productAtoms, reactantAtoms, resolution, onProgress);
    }

    const id = `req-${++DensityWorkerManager.requestCounter}`;
    const promise = new Promise<any>((resolve, reject) => {
      DensityWorkerManager.pendingRequests.set(id, { resolve, reject, onProgress });
    });

    DensityWorkerManager.worker.postMessage({
      type: 'calculateDifference',
      id,
      payload: {
        reactantAtoms: DensityWorkerManager.serializeAtoms(reactantAtoms),
        productAtoms: DensityWorkerManager.serializeAtoms(productAtoms),
        resolution,
      },
    });

    return promise;
  }

  public static cancelAll(): void {
    if (DensityWorkerManager.worker) {
      DensityWorkerManager.worker.postMessage({ type: 'cancel', id: 'cancel' });
    }
    DensityWorkerManager.pendingRequests.forEach((req) => {
      req.reject(new Error('Cancelled'));
    });
    DensityWorkerManager.pendingRequests.clear();
  }

  public static terminate(): void {
    if (DensityWorkerManager.worker) {
      DensityWorkerManager.worker.terminate();
      DensityWorkerManager.worker = null;
    }
    DensityWorkerManager.pendingRequests.clear();
  }
}
