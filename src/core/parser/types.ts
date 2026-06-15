export interface ParsedCoordinates {
  element: string;
  x: number;
  y: number;
  z: number;
}

export interface ParsedMolecule {
  title: string;
  charge: number;
  multiplicity: number;
  coordinates: ParsedCoordinates[];
  energy?: number;
  step?: number;
}

export interface ParsedOrbital {
  index: number;
  energy: number;
  occupation: number;
  symmetry: string;
}

export interface ParsedBasisSet {
  element: string;
  shellType: string;
  exponent: number;
  coefficients: number[];
}

export interface ParseResult {
  success: boolean;
  error?: string;
  data?: {
    molecules: ParsedMolecule[];
    orbitals: ParsedOrbital[];
    basisSet: ParsedBasisSet[];
    densityMatrix?: number[][];
    scfEnergy?: number;
    jobType: string;
    method: string;
    basisSetName: string;
  };
}

export const GAUSSIAN_PATTERNS = {
  JOB_TYPE: /#[Pp]\s+(\S+)\s*\/\s*(\S+)/,
  ROUTE_LINE: /#([^\n]+)/,
  TITLE: /\n\n([^\n]+)\n\n\s+(-?\d+)\s+(-?\d+)\s*\n/,
  COORDINATES: /(\w+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g,
  STANDARD_ORIENTATION: /Standard orientation:([\s\S]*?)Rotational constants/,
  ZMATRIX: /Z-Matrix orientation:([\s\S]*?)Rotational constants/,
  INPUT_ORIENTATION: /Input orientation:([\s\S]*?)Rotational constants/,
  SCF_ENERGY: /SCF Done:\s*E\(\S+\)\s*=\s*(-?\d+\.?\d*)/,
  ORBITAL_ENERGIES: /Population analysis using the SCF density([\s\S]*?)Sum of electronic and thermal/,
  MO_COEFFICIENTS: /Molecular Orbital Coefficients([\s\S]*?)Condensed to atoms/,
  DENSITY_MATRIX: /Density matrix:([\s\S]*?)Total SCF density/,
  BASIS_SET: /Basis set\(.*?\) in the form of basis functions:([\s\S]*?)(?=\n\n|\nLeave Link)/,
  ATOMIC_NUMBER: /AtmWgt=.*?NAtm=(\d+)/,
  CHARGE_MULT: /Charge\s*=\s*(-?\d+)\s+Multiplicity\s*=\s*(\d+)/,
  GEOMETRY_OPTIMIZATION: /Optimization completed/,
  REACTION_COORDINATE: /IRC\s*=\s*(-?\d+\.?\d*)/,
  ORBITAL_LIST: /\s*(O|V)\s+(\d+)\s+(-?\d+\.\d+)\s+([A-Za-z0-9]+)?/,
  HOMO_ENERGY: /Alpha\s+occ\.\s+eigenvalues--([\s\S]*?)(?=\n\n|Alpha virt)/,
  LUMO_ENERGY: /Alpha\s+virt\.\s+eigenvalues--([\s\S]*?)(?=\n\n|Beta)/,
  DIPOLE_MOMENT: /Dipole moment.*?X=\s*(-?\d+\.\d+)\s+Y=\s*(-?\d+\.\d+)\s+Z=\s*(-?\d+\.\d+)/,
  MULLIKEN_CHARGES: /Mulliken atomic charges:([\s\S]*?)(?=\n\n|Sum of Mulliken)/,
};

export const ELEMENT_SYMBOLS: string[] = [
  'X', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe',
];
