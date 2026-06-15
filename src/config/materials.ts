import * as THREE from 'three';
import { MeshPhongMaterialParameters } from 'three';

export const ATOM_COLORS: Record<string, string> = {
  H: '#FFFFFF',
  He: '#D9FFFF',
  Li: '#CC80FF',
  Be: '#C2FF00',
  B: '#FFB5B5',
  C: '#909090',
  N: '#3050F8',
  O: '#FF0D0D',
  F: '#90E050',
  Ne: '#B3E3F5',
  Na: '#AB5CF2',
  Mg: '#8AFF00',
  Al: '#BFA6A6',
  Si: '#F0C8A0',
  P: '#FF8000',
  S: '#FFFF30',
  Cl: '#1FF01F',
  Ar: '#80D1E3',
  K: '#8F40D4',
  Ca: '#3DFF00',
  Sc: '#E6E6E6',
  Ti: '#BFC2C7',
  V: '#A6A6AB',
  Cr: '#8A99C7',
  Mn: '#9C7AC7',
  Fe: '#E06633',
  Co: '#F090A0',
  Ni: '#50D050',
  Cu: '#C88033',
  Zn: '#7D80B0',
  Ga: '#C28F8F',
  Ge: '#668F8F',
  As: '#BD80E3',
  Se: '#FFA100',
  Br: '#A62929',
  Kr: '#5CB8D1',
  Rb: '#702EB0',
  Sr: '#00FF00',
  Y: '#94FFFF',
  Zr: '#94E0E0',
  Nb: '#73C2C9',
  Mo: '#54B5B5',
  Tc: '#3B9E9E',
  Ru: '#248F8F',
  Rh: '#0A7D8C',
  Pd: '#006985',
  Ag: '#C0C0C0',
  Cd: '#FFD98F',
  In: '#A67573',
  Sn: '#668080',
  Sb: '#9E63B5',
  Te: '#D47A00',
  I: '#940094',
  Xe: '#429EB0',
};

export const ATOM_RADII: Record<string, number> = {
  H: 0.31,
  He: 0.28,
  Li: 1.28,
  Be: 0.96,
  B: 0.84,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  Ne: 0.58,
  Na: 1.66,
  Mg: 1.41,
  Al: 1.21,
  Si: 1.11,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Ar: 1.06,
  K: 2.03,
  Ca: 1.76,
  Sc: 1.70,
  Ti: 1.60,
  V: 1.53,
  Cr: 1.39,
  Mn: 1.61,
  Fe: 1.52,
  Co: 1.50,
  Ni: 1.24,
  Cu: 1.32,
  Zn: 1.22,
  Ga: 1.22,
  Ge: 1.20,
  As: 1.19,
  Se: 1.20,
  Br: 1.20,
  Kr: 1.16,
  Rb: 2.20,
  Sr: 1.95,
  Y: 1.90,
  Zr: 1.75,
  Nb: 1.64,
  Mo: 1.54,
  Tc: 1.47,
  Ru: 1.46,
  Rh: 1.42,
  Pd: 1.39,
  Ag: 1.45,
  Cd: 1.44,
  In: 1.42,
  Sn: 1.39,
  Sb: 1.39,
  Te: 1.38,
  I: 1.39,
  Xe: 1.40,
};

export const ATOMIC_NUMBERS: Record<string, number> = {
  H: 1, He: 2, Li: 3, Be: 4, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10,
  Na: 11, Mg: 12, Al: 13, Si: 14, P: 15, S: 16, Cl: 17, Ar: 18, K: 19, Ca: 20,
  Sc: 21, Ti: 22, V: 23, Cr: 24, Mn: 25, Fe: 26, Co: 27, Ni: 28, Cu: 29, Zn: 30,
  Ga: 31, Ge: 32, As: 33, Se: 34, Br: 35, Kr: 36, Rb: 37, Sr: 38, Y: 39, Zr: 40,
  Nb: 41, Mo: 42, Tc: 43, Ru: 44, Rh: 45, Pd: 46, Ag: 47, Cd: 48, In: 49, Sn: 50,
  Sb: 51, Te: 52, I: 53, Xe: 54,
};

export const DENSITY_MATERIALS: {
  positive: MeshPhongMaterialParameters;
  negative: MeshPhongMaterialParameters;
} = {
  positive: {
    color: new THREE.Color('#1565C0'),
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    shininess: 100,
    specular: new THREE.Color('#444444'),
  },
  negative: {
    color: new THREE.Color('#C62828'),
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    shininess: 100,
    specular: new THREE.Color('#444444'),
  },
};

export const ATOM_MATERIAL_CONFIG: MeshPhongMaterialParameters = {
  shininess: 150,
  specular: new THREE.Color('#333333'),
  transparent: true,
  opacity: 0.95,
};

export const BOND_MATERIAL_CONFIG: MeshPhongMaterialParameters = {
  color: new THREE.Color('#606060'),
  shininess: 80,
  specular: new THREE.Color('#222222'),
};

export const BOND_MATERIAL = BOND_MATERIAL_CONFIG;

export const HIGHLIGHT_MATERIAL_CONFIG: MeshPhongMaterialParameters = {
  color: new THREE.Color('#FFD700'),
  emissive: new THREE.Color('#FFA500'),
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.9,
  shininess: 200,
};

export const getAtomColor = (symbol: string): string => {
  return ATOM_COLORS[symbol] || '#A0A0A0';
};

export const getAtomRadius = (symbol: string, scale: number = 1.0): number => {
  return (ATOM_RADII[symbol] || 0.7) * scale;
};

export const getAtomicNumber = (symbol: string): number => {
  return ATOMIC_NUMBERS[symbol] || 6;
};

export const createAtomMaterial = (color: string): THREE.MeshPhongMaterial => {
  return new THREE.MeshPhongMaterial({
    ...ATOM_MATERIAL_CONFIG,
    color: new THREE.Color(color),
  });
};

export const createBondMaterial = (): THREE.MeshPhongMaterial => {
  return new THREE.MeshPhongMaterial({ ...BOND_MATERIAL_CONFIG });
};

export const createHighlightMaterial = (): THREE.MeshPhongMaterial => {
  return new THREE.MeshPhongMaterial({ ...HIGHLIGHT_MATERIAL_CONFIG });
};

export const createDensityMaterial = (isPositive: boolean): THREE.MeshPhongMaterial => {
  const config = isPositive ? DENSITY_MATERIALS.positive : DENSITY_MATERIALS.negative;
  return new THREE.MeshPhongMaterial(config);
};

export const VECTOR_MATERIAL_CONFIG: MeshPhongMaterialParameters = {
  shininess: 100,
  specular: new THREE.Color('#444444'),
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
};

export const createVectorMaterial = (color: string): THREE.MeshPhongMaterial => {
  return new THREE.MeshPhongMaterial({
    ...VECTOR_MATERIAL_CONFIG,
    color: new THREE.Color(color),
  });
};

export const DEFAULT_DIPOLE_COLOR = '#FF6B35';
export const DEFAULT_FORCE_COLORS: Record<string, string> = {
  electrostatic: '#9C27B0',
  vdw: '#2E7D32',
  hydrogen_bond: '#00ACC1',
  dipole_dipole: '#F57C00',
};
