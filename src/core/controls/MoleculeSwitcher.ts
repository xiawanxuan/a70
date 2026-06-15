import type { Molecule, DensityGrid, GridResolution } from '../../types';
import { useMoleculeStore } from '../../store/useMoleculeStore';
import { DensityWorkerManager } from '../renderer/DensityWorkerManager';
import { IsosurfaceGenerator } from '../renderer/Isosurface';
import { eventBus } from '../events/EventBus';

export type DisplayMode = 'single' | 'difference';

export class MoleculeSwitcher {
  private static displayMode: DisplayMode = 'difference';
  private static updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly DEBOUNCE_MS = 300;

  public static setDisplayMode(mode: DisplayMode): void {
    MoleculeSwitcher.displayMode = mode;
    MoleculeSwitcher.updateRendering();
  }

  public static getDisplayMode(): DisplayMode {
    return MoleculeSwitcher.displayMode;
  }

  public static setReactant(moleculeId: string): void {
    const { molecules, setReactantMolecule } = useMoleculeStore.getState();
    const molecule = molecules.find((m) => m.id === moleculeId);
    setReactantMolecule(molecule || null);
    MoleculeSwitcher.updateRendering();
  }

  public static setProduct(moleculeId: string): void {
    const { molecules, setProductMolecule } = useMoleculeStore.getState();
    const molecule = molecules.find((m) => m.id === moleculeId);
    setProductMolecule(molecule || null);
    MoleculeSwitcher.updateRendering();
  }

  public static switchMolecule(moleculeId: string): void {
    const { setActiveMolecule } = useMoleculeStore.getState();
    setActiveMolecule(moleculeId);
    MoleculeSwitcher.updateRendering();
  }

  public static toggleFragmentVisibility(fragmentId: string): void {
    const { molecules, activeMoleculeId, setFragmentVisibility } =
      useMoleculeStore.getState();
    const molecule = molecules.find((m) => m.id === activeMoleculeId);
    if (!molecule) return;

    const fragment = molecule.fragments.find((f) => f.id === fragmentId);
    if (!fragment) return;

    setFragmentVisibility(fragmentId, !fragment.visible);
    IsosurfaceGenerator.clearCache();
    MoleculeSwitcher.updateRendering();
  }

  public static async calculateDensityDifference(
    resolution: GridResolution
  ): Promise<{
    differenceGrid: DensityGrid;
    productGrid: DensityGrid;
    reactantGrid: DensityGrid;
  } | null> {
    const { reactantMolecule, productMolecule, setDensityGrid, setLoading, setError, setProgress } =
      useMoleculeStore.getState();

    if (!reactantMolecule || !productMolecule) {
      setError('请先选择反应物和产物分子');
      return null;
    }

    setLoading(true);
    setError(null);
    setProgress?.(0);

    try {
      const result = await DensityWorkerManager.calculateDifference(
        reactantMolecule.atoms,
        productMolecule.atoms,
        resolution,
        (progress) => setProgress?.(progress)
      );

      setDensityGrid(result.differenceGrid);
      setLoading(false);
      setProgress?.(1);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== 'Cancelled') {
        setError(`密度差分计算失败: ${errorMessage}`);
      }
      setLoading(false);
      return null;
    }
  }

  public static async calculateSingleDensity(
    molecule: Molecule,
    resolution: GridResolution
  ): Promise<DensityGrid | null> {
    const { setDensityGrid, setLoading, setError, setProgress } = useMoleculeStore.getState();

    setLoading(true);
    setError(null);
    setProgress?.(0);

    try {
      const grid = await DensityWorkerManager.calculateDensity(
        molecule.atoms,
        resolution,
        (progress) => setProgress?.(progress)
      );
      setDensityGrid(grid);
      setLoading(false);
      setProgress?.(1);
      return grid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== 'Cancelled') {
        setError(`密度计算失败: ${errorMessage}`);
      }
      setLoading(false);
      return null;
    }
  }

  public static updateRendering(): void {
    if (MoleculeSwitcher.updateTimeout) {
      clearTimeout(MoleculeSwitcher.updateTimeout);
    }

    MoleculeSwitcher.updateTimeout = setTimeout(() => {
      const { renderConfig, reactantMolecule, productMolecule, activeMoleculeId, molecules } =
        useMoleculeStore.getState();

      const activeMolecule = molecules.find((m) => m.id === activeMoleculeId);

      DensityWorkerManager.cancelAll();

      if (MoleculeSwitcher.displayMode === 'difference') {
        if (reactantMolecule && productMolecule) {
          MoleculeSwitcher.calculateDensityDifference(renderConfig.gridResolution);
        }
      } else {
        if (activeMolecule) {
          MoleculeSwitcher.calculateSingleDensity(activeMolecule, renderConfig.gridResolution);
        }
      }
    }, MoleculeSwitcher.DEBOUNCE_MS);
  }

  public static cancelUpdate(): void {
    if (MoleculeSwitcher.updateTimeout) {
      clearTimeout(MoleculeSwitcher.updateTimeout);
      MoleculeSwitcher.updateTimeout = null;
    }
    DensityWorkerManager.cancelAll();
  }

  public static reset(): void {
    MoleculeSwitcher.displayMode = 'difference';
    const { setDensityGrid, setReactantMolecule, setProductMolecule } =
      useMoleculeStore.getState();
    setDensityGrid(null);
    setReactantMolecule(null);
    setProductMolecule(null);
  }

  public static getAvailableMolecules(): Molecule[] {
    return useMoleculeStore.getState().molecules;
  }

  public static getMoleculeById(id: string): Molecule | undefined {
    return useMoleculeStore.getState().molecules.find((m) => m.id === id);
  }

  public static getActiveMolecule(): Molecule | undefined {
    const { molecules, activeMoleculeId } = useMoleculeStore.getState();
    return molecules.find((m) => m.id === activeMoleculeId);
  }
}
