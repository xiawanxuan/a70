import { Vector3 } from 'three';

export type MoleculeType = 'reactant' | 'product' | 'intermediate';

export type GridResolution = 'coarse' | 'medium' | 'fine';

export type AtomStyle = 'ball' | 'stick' | 'ballstick';

export interface Vector3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface Atom {
  id: number;
  element: string;
  symbol: string;
  position: Vector3;
  atomicNumber: number;
  group?: string;
  fragmentId?: string;
  highlighted?: boolean;
  visible?: boolean;
}

export interface Bond {
  id: number;
  atom1: number;
  atom2: number;
  order: number;
  length: number;
}

export interface Molecule {
  id: string;
  name: string;
  type: MoleculeType;
  atoms: Atom[];
  bonds: Bond[];
  molecularFormula: string;
  charge: number;
  multiplicity: number;
  fragments: MoleculeFragment[];
  energy?: number;
}

export interface MoleculeFragment {
  id: string;
  name: string;
  atomIds: number[];
  visible: boolean;
}

export interface DensityGrid {
  dimensions: [number, number, number];
  origin: Vector3;
  spacing: Vector3;
  data: Float32Array;
  unit: string;
  resolution: GridResolution;
}

export interface RenderConfig {
  isoValue: number;
  positiveColor: string;
  negativeColor: string;
  opacity: number;
  gridResolution: GridResolution;
  showBonds: boolean;
  showAtoms: boolean;
  showIsosurface: boolean;
  atomStyle: AtomStyle;
  atomScale: number;
  bondRadius: number;
}

export interface ViewConfig {
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  cameraUp: [number, number, number];
  fov: number;
}

export interface HighlightConfig {
  enabled: boolean;
  color: string;
  glowIntensity: number;
  selectedAtomIds: number[];
  selectedElements: string[];
  selectedGroups: string[];
}

export interface ExportConfig {
  version: string;
  timestamp: string;
  viewConfig: ViewConfig;
  renderConfig: RenderConfig;
  highlightConfig: HighlightConfig;
  moleculeIds: string[];
  activeMoleculeId: string;
}

export interface GaussianOrbital {
  index: number;
  energy: number;
  occupation: number;
  symmetry: string;
  coefficients: number[];
}

export interface GaussianBasisFunction {
  shellType: string;
  exponent: number;
  contractionCoefficients: number[];
  center: Vector3;
}

export interface ParsedGaussianData {
  molecules: Molecule[];
  orbitals: GaussianOrbital[];
  basisFunctions: GaussianBasisFunction[];
  densityMatrix?: number[][];
  scfEnergy?: number;
  jobType: string;
  method: string;
  basisSet: string;
}

export type EventType =
  | 'FILE_UPLOADED'
  | 'FILE_PARSED'
  | 'PARSE_ERROR'
  | 'MOLECULE_CHANGED'
  | 'FRAGMENT_VISIBILITY_CHANGED'
  | 'ATOM_VISIBILITY_CHANGED'
  | 'VIEW_CHANGED'
  | 'RENDER_CONFIG_CHANGED'
  | 'FILTER_UPDATED'
  | 'ISO_VALUE_CHANGED'
  | 'ATOM_SELECTED'
  | 'EXPORT_CONFIG'
  | 'IMPORT_CONFIG';

export interface EventPayload {
  FILE_UPLOADED: { file: File; name: string };
  FILE_PARSED: { data: ParsedGaussianData };
  PARSE_ERROR: { error: string; file: string };
  MOLECULE_CHANGED: { moleculeId: string };
  FRAGMENT_VISIBILITY_CHANGED: { fragmentId: string; visible: boolean };
  ATOM_VISIBILITY_CHANGED: { atomId: number; visible: boolean };
  VIEW_CHANGED: { viewConfig: ViewConfig };
  RENDER_CONFIG_CHANGED: { config: Partial<RenderConfig> };
  FILTER_UPDATED: { highlightConfig: HighlightConfig };
  ISO_VALUE_CHANGED: { value: number };
  ATOM_SELECTED: { atomId: number; multi: boolean };
  EXPORT_CONFIG: { config: ExportConfig };
  IMPORT_CONFIG: { config: ExportConfig };
}

export const GRID_RESOLUTION_CONFIG: Record<GridResolution, { steps: number; spacing: number }> = {
  coarse: { steps: 40, spacing: 0.5 },
  medium: { steps: 60, spacing: 0.35 },
  fine: { steps: 80, spacing: 0.25 },
};

export const ELEMENT_LIST = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe',
];

export const FUNCTIONAL_GROUPS: Record<string, string[]> = {
  '羟基 (-OH)': ['O', 'H'],
  '羰基 (C=O)': ['C', 'O'],
  '氨基 (-NH2)': ['N', 'H', 'H'],
  '羧基 (-COOH)': ['C', 'O', 'O', 'H'],
  '苯环': ['C', 'C', 'C', 'C', 'C', 'C'],
  '甲基 (-CH3)': ['C', 'H', 'H', 'H'],
  '巯基 (-SH)': ['S', 'H'],
  '氰基 (-CN)': ['C', 'N'],
  '硝基 (-NO2)': ['N', 'O', 'O'],
  '磷酸基': ['P', 'O', 'O', 'O', 'O'],
};
