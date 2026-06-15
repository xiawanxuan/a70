import { Vector3 } from 'three';
import { Atom, Bond, Molecule, MoleculeFragment, MoleculeType, ParsedGaussianData, GaussianOrbital, GaussianBasisFunction } from '@/types';
import { getAtomicNumber, getAtomRadius } from '@/config/materials';
import { generateId, getBoundingBox, distance3D } from '@/utils/math';
import { GAUSSIAN_PATTERNS, ELEMENT_SYMBOLS, ParsedMolecule, ParsedOrbital, ParsedBasisSet, ParsedCoordinates, ParseResult } from './types';

export class GaussianParser {
  private content: string;
  private fileName: string;

  constructor(content: string, fileName: string) {
    this.content = content;
    this.fileName = fileName;
  }

  public parse(): ParsedGaussianData {
    const result = this.parseContent();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to parse Gaussian output');
    }

    const molecules = this.convertToMolecules(result.data.molecules);
    const orbitals = this.convertToOrbitals(result.data.orbitals);
    const basisFunctions = this.convertToBasisFunctions(result.data.basisSet);

    return {
      molecules,
      orbitals,
      basisFunctions,
      densityMatrix: result.data.densityMatrix,
      scfEnergy: result.data.scfEnergy,
      jobType: result.data.jobType,
      method: result.data.method,
      basisSet: result.data.basisSetName,
    };
  }

  private parseContent(): ParseResult {
    try {
      const routeMatch = this.content.match(GAUSSIAN_PATTERNS.ROUTE_LINE);
      const route = routeMatch ? routeMatch[1].trim() : '';

      const jobTypeMatch = route.match(/#[Pp]\s+(\S+)/);
      const jobType = jobTypeMatch ? jobTypeMatch[1] : 'SP';

      const basisMatch = route.match(/\/\s*(\S+)/);
      const basisSetName = basisMatch ? basisMatch[1] : 'STO-3G';

      const methodMatch = route.match(/(?:#\s+)?([A-Za-z0-9-]+)\s*\//);
      const method = methodMatch ? methodMatch[1] : 'HF';

      const molecules = this.parseMolecules();
      const orbitals = this.parseOrbitals();
      const basisSet = this.parseBasisSet();
      const densityMatrix = this.parseDensityMatrix();
      const scfEnergy = this.parseSCFEnergy();

      return {
        success: true,
        data: {
          molecules,
          orbitals,
          basisSet,
          densityMatrix,
          scfEnergy,
          jobType,
          method,
          basisSetName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  private parseMolecules(): ParsedMolecule[] {
    const molecules: ParsedMolecule[] = [];

    let title = 'Unknown Molecule';
    let charge = 0;
    let multiplicity = 1;

    const titleMatch = this.content.match(GAUSSIAN_PATTERNS.TITLE);
    if (titleMatch) {
      title = titleMatch[1].trim();
      charge = parseInt(titleMatch[2], 10);
      multiplicity = parseInt(titleMatch[3], 10);
    } else {
      const chargeMultMatch = this.content.match(GAUSSIAN_PATTERNS.CHARGE_MULT);
      if (chargeMultMatch) {
        charge = parseInt(chargeMultMatch[1], 10);
        multiplicity = parseInt(chargeMultMatch[2], 10);
      }
    }

    const orientationMatches = [
      ...this.content.matchAll(GAUSSIAN_PATTERNS.STANDARD_ORIENTATION),
      ...this.content.matchAll(GAUSSIAN_PATTERNS.INPUT_ORIENTATION),
      ...this.content.matchAll(GAUSSIAN_PATTERNS.ZMATRIX),
    ].sort((a, b) => (a.index || 0) - (b.index || 0));

    if (orientationMatches.length === 0) {
      const coordinates = this.parseCoordinateSection(this.content);
      if (coordinates.length > 0) {
        molecules.push({
          title,
          charge,
          multiplicity,
          coordinates,
        });
      } else {
        const simpleCoords = this.parseSimpleCoordinates();
        if (simpleCoords.length > 0) {
          molecules.push({
            title,
            charge,
            multiplicity,
            coordinates: simpleCoords,
          });
        }
      }
    } else {
      const uniqueMatches = this.deduplicateOrientationMatches(orientationMatches);
      
      for (let i = 0; i < uniqueMatches.length; i++) {
        const match = uniqueMatches[i];
        const section = match[1];
        const coordinates = this.parseCoordinateSection(section);
        
        if (coordinates.length > 0) {
          const energy = this.findEnergyNear(match.index || 0);

          molecules.push({
            title: `${title} (Step ${i + 1})`,
            charge,
            multiplicity,
            coordinates,
            energy,
            step: i + 1,
          });
        }
      }
    }

    if (molecules.length === 0) {
      throw new Error('No molecular coordinates found in the output file');
    }

    return molecules;
  }

  private deduplicateOrientationMatches(matches: RegExpMatchArray[]): RegExpMatchArray[] {
    const unique: RegExpMatchArray[] = [];
    const minDistance = 1000;

    for (const match of matches) {
      const idx = match.index || 0;
      const isDuplicate = unique.some(
        (u) => Math.abs((u.index || 0) - idx) < minDistance
      );
      if (!isDuplicate) {
        unique.push(match);
      }
    }

    return unique;
  }

  private parseSimpleCoordinates(): ParsedCoordinates[] {
    const coordinates: ParsedCoordinates[] = [];
    const lines = this.content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        const firstPart = parts[0];
        const elementMatch = firstPart.match(/^([A-Za-z]+)/);
        
        if (elementMatch && ELEMENT_SYMBOLS.includes(elementMatch[1].charAt(0).toUpperCase() + elementMatch[1].slice(1).toLowerCase())) {
          const element = elementMatch[1].charAt(0).toUpperCase() + elementMatch[1].slice(1).toLowerCase();
          const x = parseFloat(parts[parts.length - 3]);
          const y = parseFloat(parts[parts.length - 2]);
          const z = parseFloat(parts[parts.length - 1]);
          
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            coordinates.push({ element, x, y, z });
          }
        }
      }
    }
    
    return coordinates.length >= 2 ? coordinates : [];
  }

  private parseCoordinateSection(section: string): ParsedCoordinates[] {
    const coordinates: ParsedCoordinates[] = [];
    const lines = section.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        const atomicNumber = parseInt(parts[0], 10);
        if (!isNaN(atomicNumber) && atomicNumber >= 1 && atomicNumber < ELEMENT_SYMBOLS.length) {
          const element = ELEMENT_SYMBOLS[atomicNumber];
          const x = parseFloat(parts[parts.length - 3]);
          const y = parseFloat(parts[parts.length - 2]);
          const z = parseFloat(parts[parts.length - 1]);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            coordinates.push({ element, x, y, z });
          }
        } else if (ELEMENT_SYMBOLS.includes(parts[0]) || ELEMENT_SYMBOLS.map(s => s.toLowerCase()).includes(parts[0].toLowerCase())) {
          const element = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);
          const z = parseFloat(parts[3]);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            coordinates.push({ element, x, y, z });
          }
        }
      }
    }

    return coordinates;
  }

  private findEnergyNear(index: number): number | undefined {
    const nearbyContent = this.content.substring(Math.max(0, index - 500), index + 500);
    const energyMatch = nearbyContent.match(GAUSSIAN_PATTERNS.SCF_ENERGY);
    if (energyMatch) {
      return parseFloat(energyMatch[1]);
    }
    return undefined;
  }

  private parseOrbitals(): ParsedOrbital[] {
    const orbitals: ParsedOrbital[] = [];
    
    orbitals.push(...this.parseOrbitalsFromPattern(GAUSSIAN_PATTERNS.ORBITAL_ENERGIES));
    orbitals.push(...this.parseOrbitalsFromPattern(GAUSSIAN_PATTERNS.HOMO_ENERGY));
    orbitals.push(...this.parseOrbitalsFromPattern(GAUSSIAN_PATTERNS.LUMO_ENERGY));

    const orbitalRegex = new RegExp(GAUSSIAN_PATTERNS.ORBITAL_LIST.source, 'g');
    let match;
    while ((match = orbitalRegex.exec(this.content)) !== null) {
      const isOccupied = match[1] === 'O';
      const index = parseInt(match[2], 10);
      const energy = parseFloat(match[3]);
      const symmetry = match[4] || '';

      if (!isNaN(index) && !isNaN(energy) && !orbitals.some(o => o.index === index)) {
        orbitals.push({
          index,
          energy,
          occupation: isOccupied ? 2 : 0,
          symmetry,
        });
      }
    }

    return orbitals.sort((a, b) => a.index - b.index);
  }

  private parseOrbitalsFromPattern(pattern: RegExp): ParsedOrbital[] {
    const orbitals: ParsedOrbital[] = [];
    const moMatch = this.content.match(pattern);

    if (!moMatch) return orbitals;

    const section = moMatch[1];
    const lines = section.split('\n');
    let currentIndex = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const numbers = trimmed.match(/-?\d+\.\d+/g);
      if (numbers) {
        for (const numStr of numbers) {
          const energy = parseFloat(numStr);
          if (!isNaN(energy)) {
            orbitals.push({
              index: currentIndex,
              energy,
              occupation: 0,
              symmetry: '',
            });
            currentIndex++;
          }
        }
      }
    }

    return orbitals;
  }

  private parseBasisSet(): ParsedBasisSet[] {
    const basisSet: ParsedBasisSet[] = [];
    const basisMatch = this.content.match(GAUSSIAN_PATTERNS.BASIS_SET);

    if (!basisMatch) return basisSet;

    const section = basisMatch[1];
    const lines = section.split('\n');

    let currentElement = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length === 1 && ELEMENT_SYMBOLS.includes(parts[0])) {
        currentElement = parts[0];
      } else if (parts.length >= 2 && currentElement) {
        const shellType = parts[0];
        const exponent = parseFloat(parts[1]);
        const coefficients: number[] = [];

        for (let i = 2; i < parts.length; i++) {
          const coeff = parseFloat(parts[i]);
          if (!isNaN(coeff)) {
            coefficients.push(coeff);
          }
        }

        if (shellType && !isNaN(exponent) && coefficients.length > 0) {
          basisSet.push({
            element: currentElement,
            shellType,
            exponent,
            coefficients,
          });
        }
      }
    }

    return basisSet;
  }

  private parseDensityMatrix(): number[][] | undefined {
    const densityMatch = this.content.match(GAUSSIAN_PATTERNS.DENSITY_MATRIX);
    if (!densityMatch) return undefined;

    const section = densityMatch[1];
    const lines = section.split('\n');
    const matrix: number[][] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.match(/^\d+\s*$/)) continue;

      const parts = trimmed.split(/\s+/);
      const values: number[] = [];

      for (const part of parts) {
        const num = parseFloat(part);
        if (!isNaN(num)) {
          values.push(num);
        }
      }

      if (values.length > 0) {
        matrix.push(values);
      }
    }

    return matrix.length > 0 ? matrix : undefined;
  }

  private parseSCFEnergy(): number | undefined {
    const energyMatch = this.content.match(GAUSSIAN_PATTERNS.SCF_ENERGY);
    if (energyMatch) {
      return parseFloat(energyMatch[1]);
    }
    return undefined;
  }

  private convertToMolecules(parsed: ParsedMolecule[]): Molecule[] {
    const molecules: Molecule[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const pm = parsed[i];
      const atoms: Atom[] = [];
      const positions: Vector3[] = [];

      for (let j = 0; j < pm.coordinates.length; j++) {
        const coord = pm.coordinates[j];
        const position = new Vector3(coord.x, coord.y, coord.z);
        positions.push(position);

        atoms.push({
          id: j,
          element: coord.element,
          symbol: coord.element,
          position,
          atomicNumber: getAtomicNumber(coord.element),
          visible: true,
        });
      }

      const bonds = this.calculateBonds(atoms);
      const fragments = this.detectFragments(atoms, bonds);
      const molecularFormula = this.calculateFormula(atoms);

      let type: MoleculeType = 'intermediate';
      if (i === 0 && parsed.length > 1) type = 'reactant';
      else if (i === parsed.length - 1 && parsed.length > 1) type = 'product';

      molecules.push({
        id: generateId(),
        name: pm.title || `${this.fileName} - ${type}`,
        type,
        atoms,
        bonds,
        molecularFormula,
        charge: pm.charge,
        multiplicity: pm.multiplicity,
        fragments,
        energy: pm.energy,
      });
    }

    return molecules;
  }

  private calculateBonds(atoms: Atom[]): Bond[] {
    const bonds: Bond[] = [];
    const maxBondLength = 1.9;

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dist = distance3D(atoms[i].position, atoms[j].position);
        const radiusSum = getAtomRadius(atoms[i].symbol) + getAtomRadius(atoms[j].symbol);

        if (dist < Math.min(maxBondLength, radiusSum * 1.2)) {
          let order = 1;
          if (dist < radiusSum * 0.85) order = 2;
          if (dist < radiusSum * 0.75) order = 3;

          bonds.push({
            id: bonds.length,
            atom1: i,
            atom2: j,
            order,
            length: dist,
          });
        }
      }
    }

    return bonds;
  }

  private detectFragments(atoms: Atom[], bonds: Bond[]): MoleculeFragment[] {
    const visited = new Set<number>();
    const fragments: MoleculeFragment[] = [];

    for (let i = 0; i < atoms.length; i++) {
      if (visited.has(i)) continue;

      const fragmentAtoms: number[] = [];
      const queue: number[] = [i];
      visited.add(i);

      while (queue.length > 0) {
        const current = queue.shift()!;
        fragmentAtoms.push(current);

        for (const bond of bonds) {
          let neighbor = -1;
          if (bond.atom1 === current) neighbor = bond.atom2;
          else if (bond.atom2 === current) neighbor = bond.atom1;

          if (neighbor >= 0 && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const fragmentAtomsObj = fragmentAtoms.map(id => atoms[id]);
      const formula = this.calculateFormula(fragmentAtomsObj);

      fragments.push({
        id: `frag-${fragments.length}`,
        name: `Fragment ${fragments.length + 1} (${formula})`,
        atomIds: fragmentAtoms,
        visible: true,
      });
    }

    return fragments;
  }

  private calculateFormula(atoms: { symbol: string }[]): string {
    const counts: Record<string, number> = {};
    for (const atom of atoms) {
      counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
    }

    const order = ['C', 'H', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I'];
    let formula = '';

    for (const elem of order) {
      if (counts[elem]) {
        formula += elem + (counts[elem] > 1 ? counts[elem] : '');
        delete counts[elem];
      }
    }

    for (const [elem, count] of Object.entries(counts)) {
      formula += elem + (count > 1 ? count : '');
    }

    return formula;
  }

  private convertToOrbitals(parsed: ParsedOrbital[]): GaussianOrbital[] {
    return parsed.map(po => ({
      index: po.index,
      energy: po.energy,
      occupation: po.occupation,
      symmetry: po.symmetry,
      coefficients: [],
    }));
  }

  private convertToBasisFunctions(parsed: ParsedBasisSet[]): GaussianBasisFunction[] {
    return parsed.map(pb => ({
      shellType: pb.shellType,
      exponent: pb.exponent,
      contractionCoefficients: pb.coefficients,
      center: new Vector3(0, 0, 0),
    }));
  }

  public static parseMockData(): ParsedGaussianData {
    const mockMolecules: Molecule[] = [];

    const reactantAtoms: Atom[] = [
      { id: 0, element: 'C', symbol: 'C', position: new Vector3(0, 0, 0), atomicNumber: 6, visible: true },
      { id: 1, element: 'C', symbol: 'C', position: new Vector3(1.54, 0, 0), atomicNumber: 6, visible: true },
      { id: 2, element: 'H', symbol: 'H', position: new Vector3(-0.52, 1.02, 0), atomicNumber: 1, visible: true },
      { id: 3, element: 'H', symbol: 'H', position: new Vector3(-0.52, -1.02, 0), atomicNumber: 1, visible: true },
      { id: 4, element: 'H', symbol: 'H', position: new Vector3(0, 0, 1.02), atomicNumber: 1, visible: true },
      { id: 5, element: 'H', symbol: 'H', position: new Vector3(2.06, 1.02, 0), atomicNumber: 1, visible: true },
      { id: 6, element: 'H', symbol: 'H', position: new Vector3(2.06, -1.02, 0), atomicNumber: 1, visible: true },
      { id: 7, element: 'H', symbol: 'H', position: new Vector3(1.54, 0, 1.02), atomicNumber: 1, visible: true },
    ];

    const productAtoms: Atom[] = [
      { id: 0, element: 'C', symbol: 'C', position: new Vector3(0, 0, 0), atomicNumber: 6, visible: true },
      { id: 1, element: 'C', symbol: 'C', position: new Vector3(1.34, 0, 0), atomicNumber: 6, visible: true },
      { id: 2, element: 'H', symbol: 'H', position: new Vector3(-0.6, 0.9, 0), atomicNumber: 1, visible: true },
      { id: 3, element: 'H', symbol: 'H', position: new Vector3(-0.6, -0.9, 0), atomicNumber: 1, visible: true },
      { id: 4, element: 'H', symbol: 'H', position: new Vector3(1.94, 0.9, 0), atomicNumber: 1, visible: true },
      { id: 5, element: 'H', symbol: 'H', position: new Vector3(1.94, -0.9, 0), atomicNumber: 1, visible: true },
    ];

    const createBonds = (atoms: Atom[]): Bond[] => {
      const bonds: Bond[] = [];
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dist = distance3D(atoms[i].position, atoms[j].position);
          if (dist < 1.6) {
            bonds.push({ id: bonds.length, atom1: i, atom2: j, order: 1, length: dist });
          }
        }
      }
      return bonds;
    };

    const createFragments = (atoms: Atom[]): MoleculeFragment[] => [
      { id: 'frag-0', name: 'Main Molecule', atomIds: atoms.map((_, i) => i), visible: true },
    ];

    mockMolecules.push({
      id: 'mol-reactant',
      name: 'Ethane (Reactant)',
      type: 'reactant',
      atoms: reactantAtoms,
      bonds: createBonds(reactantAtoms),
      molecularFormula: 'C2H6',
      charge: 0,
      multiplicity: 1,
      fragments: createFragments(reactantAtoms),
      energy: -79.234567,
    });

    mockMolecules.push({
      id: 'mol-product',
      name: 'Ethylene + H2 (Product)',
      type: 'product',
      atoms: productAtoms,
      bonds: createBonds(productAtoms),
      molecularFormula: 'C2H4',
      charge: 0,
      multiplicity: 1,
      fragments: createFragments(productAtoms),
      energy: -78.123456,
    });

    return {
      molecules: mockMolecules,
      orbitals: [],
      basisFunctions: [],
      scfEnergy: -79.234567,
      jobType: 'SP',
      method: 'B3LYP',
      basisSet: '6-31G(d)',
    };
  }
}
