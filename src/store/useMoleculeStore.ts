import { create } from 'zustand';
import type {
  Molecule,
  DensityGrid,
  RenderConfig,
  ViewConfig,
  HighlightConfig,
  ExportConfig,
  ParsedGaussianData,
  GridResolution,
} from '../types';
import { eventBus } from '../core/events/EventBus';

interface MoleculeState {
  molecules: Molecule[];
  activeMoleculeId: string | null;
  reactantMolecule: Molecule | null;
  productMolecule: Molecule | null;
  densityGrid: DensityGrid | null;
  renderConfig: RenderConfig;
  viewConfig: ViewConfig;
  highlightConfig: HighlightConfig;
  parsedData: ParsedGaussianData | null;
  isLoading: boolean;
  error: string | null;
  progress: number | null;
}

interface MoleculeActions {
  setParsedData: (data: ParsedGaussianData) => void;
  setActiveMolecule: (moleculeId: string) => void;
  setReactantMolecule: (molecule: Molecule | null) => void;
  setProductMolecule: (molecule: Molecule | null) => void;
  setDensityGrid: (grid: DensityGrid | null) => void;
  updateRenderConfig: (config: Partial<RenderConfig>) => void;
  updateViewConfig: (config: Partial<ViewConfig>) => void;
  updateHighlightConfig: (config: Partial<HighlightConfig>) => void;
  setFragmentVisibility: (fragmentId: string, visible: boolean) => void;
  setAtomVisibility: (atomId: number, visible: boolean) => void;
  selectAtom: (atomId: number, multi: boolean) => void;
  setGridResolution: (resolution: GridResolution) => void;
  setIsoValue: (value: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number | null) => void;
  getExportConfig: () => ExportConfig;
  applyImportConfig: (config: ExportConfig) => void;
  reset: () => void;
}

const defaultRenderConfig: RenderConfig = {
  isoValue: 0.001,
  positiveColor: '#1565C0',
  negativeColor: '#C62828',
  opacity: 0.6,
  gridResolution: 'medium',
  showBonds: true,
  showAtoms: true,
  showIsosurface: true,
  atomStyle: 'ballstick',
  atomScale: 1.0,
  bondRadius: 0.15,
};

const defaultViewConfig: ViewConfig = {
  cameraPosition: [0, 0, 10],
  cameraTarget: [0, 0, 0],
  cameraUp: [0, 1, 0],
  fov: 45,
};

const defaultHighlightConfig: HighlightConfig = {
  enabled: false,
  color: '#FFD700',
  glowIntensity: 0.5,
  selectedAtomIds: [],
  selectedElements: [],
  selectedGroups: [],
};

const initialState: MoleculeState = {
  molecules: [],
  activeMoleculeId: null,
  reactantMolecule: null,
  productMolecule: null,
  densityGrid: null,
  renderConfig: defaultRenderConfig,
  viewConfig: defaultViewConfig,
  highlightConfig: defaultHighlightConfig,
  parsedData: null,
  isLoading: false,
  error: null,
  progress: null,
};

export const useMoleculeStore = create<MoleculeState & MoleculeActions>((set, get) => ({
  ...initialState,

  setParsedData: (data: ParsedGaussianData) => {
    set({
      molecules: data.molecules,
      parsedData: data,
      activeMoleculeId: data.molecules[0]?.id || null,
      error: null,
    });
    eventBus.emit('FILE_PARSED', { data });
  },

  setActiveMolecule: (moleculeId: string) => {
    set({ activeMoleculeId: moleculeId });
    eventBus.emit('MOLECULE_CHANGED', { moleculeId });
  },

  setReactantMolecule: (molecule: Molecule | null) => {
    set({ reactantMolecule: molecule });
  },

  setProductMolecule: (molecule: Molecule | null) => {
    set({ productMolecule: molecule });
  },

  setDensityGrid: (grid: DensityGrid | null) => {
    set({ densityGrid: grid });
  },

  updateRenderConfig: (config: Partial<RenderConfig>) => {
    const newConfig = { ...get().renderConfig, ...config };
    set({ renderConfig: newConfig });
    eventBus.emit('RENDER_CONFIG_CHANGED', { config });
  },

  updateViewConfig: (config: Partial<ViewConfig>) => {
    const newConfig = { ...get().viewConfig, ...config };
    set({ viewConfig: newConfig });
    eventBus.emit('VIEW_CHANGED', { viewConfig: newConfig });
  },

  updateHighlightConfig: (config: Partial<HighlightConfig>) => {
    const newConfig = { ...get().highlightConfig, ...config };
    set({ highlightConfig: newConfig });
    eventBus.emit('FILTER_UPDATED', { highlightConfig: newConfig });
  },

  setFragmentVisibility: (fragmentId: string, visible: boolean) => {
    const state = get();
    const molecules = state.molecules.map((mol) => ({
      ...mol,
      fragments: mol.fragments.map((frag) =>
        frag.id === fragmentId ? { ...frag, visible } : frag
      ),
      atoms: mol.atoms.map((atom) => {
        const fragment = mol.fragments.find((f) => f.id === fragmentId);
        if (fragment && fragment.atomIds.includes(atom.id)) {
          return { ...atom, visible };
        }
        return atom;
      }),
    }));

    let { reactantMolecule, productMolecule } = state;
    
    if (reactantMolecule) {
      const updatedReactant = molecules.find((m) => m.id === reactantMolecule!.id);
      if (updatedReactant) {
        reactantMolecule = updatedReactant;
      }
    }
    
    if (productMolecule) {
      const updatedProduct = molecules.find((m) => m.id === productMolecule!.id);
      if (updatedProduct) {
        productMolecule = updatedProduct;
      }
    }

    set({ molecules, reactantMolecule, productMolecule });
    eventBus.emit('FRAGMENT_VISIBILITY_CHANGED', { fragmentId, visible });
  },

  setAtomVisibility: (atomId: number, visible: boolean) => {
    const state = get();
    const molecules = state.molecules.map((mol) => ({
      ...mol,
      atoms: mol.atoms.map((atom) =>
        atom.id === atomId ? { ...atom, visible } : atom
      ),
    }));

    let { reactantMolecule, productMolecule } = state;
    
    if (reactantMolecule) {
      const updatedReactant = molecules.find((m) => m.id === reactantMolecule!.id);
      if (updatedReactant) {
        reactantMolecule = updatedReactant;
      }
    }
    
    if (productMolecule) {
      const updatedProduct = molecules.find((m) => m.id === productMolecule!.id);
      if (updatedProduct) {
        productMolecule = updatedProduct;
      }
    }

    set({ molecules, reactantMolecule, productMolecule });
    eventBus.emit('ATOM_VISIBILITY_CHANGED', { atomId, visible });
  },

  selectAtom: (atomId: number, multi: boolean) => {
    const { selectedAtomIds } = get().highlightConfig;
    let newSelected: number[];

    if (multi) {
      newSelected = selectedAtomIds.includes(atomId)
        ? selectedAtomIds.filter((id) => id !== atomId)
        : [...selectedAtomIds, atomId];
    } else {
      newSelected = selectedAtomIds.includes(atomId) && selectedAtomIds.length === 1
        ? []
        : [atomId];
    }

    set({
      highlightConfig: { ...get().highlightConfig, selectedAtomIds: newSelected },
    });
    eventBus.emit('ATOM_SELECTED', { atomId, multi });
  },

  setGridResolution: (resolution: GridResolution) => {
    get().updateRenderConfig({ gridResolution: resolution });
  },

  setIsoValue: (value: number) => {
    get().updateRenderConfig({ isoValue: value });
    eventBus.emit('ISO_VALUE_CHANGED', { value });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setProgress: (progress: number | null) => {
    set({ progress });
  },

  getExportConfig: (): ExportConfig => {
    const state = get();
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      viewConfig: state.viewConfig,
      renderConfig: state.renderConfig,
      highlightConfig: state.highlightConfig,
      moleculeIds: state.molecules.map((m) => m.id),
      activeMoleculeId: state.activeMoleculeId || '',
    };
  },

  applyImportConfig: (config: ExportConfig) => {
    set({
      viewConfig: config.viewConfig,
      renderConfig: config.renderConfig,
      highlightConfig: config.highlightConfig,
      activeMoleculeId: config.activeMoleculeId,
    });
    eventBus.emit('IMPORT_CONFIG', { config });
  },

  reset: () => {
    set(initialState);
  },
}));
