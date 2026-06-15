import { Vector3 } from 'three';
import type {
  Molecule,
  Atom,
  DipoleMoment,
  IntermolecularForce,
  ForceType,
} from '../../types';
import { getAtomicNumber } from '../../config/materials';
import { generateId, distance3D } from '../../utils/math';

const PARTIAL_CHARGES: Record<string, number> = {
  H: 0.08,
  C: -0.12,
  N: -0.30,
  O: -0.35,
  F: -0.40,
  S: -0.18,
  P: 0.10,
  Cl: -0.25,
  Br: -0.20,
  I: -0.15,
  Na: 0.50,
  Mg: 0.40,
  K: 0.50,
  Ca: 0.40,
};

const VDW_RADII: Record<string, number> = {
  H: 1.20,
  C: 1.70,
  N: 1.55,
  O: 1.52,
  F: 1.47,
  S: 1.80,
  P: 1.80,
  Cl: 1.75,
  Br: 1.85,
  I: 1.98,
  Na: 2.27,
  Mg: 1.73,
  K: 2.75,
  Ca: 2.31,
};

const EPSILON: Record<string, number> = {
  H: 0.015,
  C: 0.105,
  N: 0.130,
  O: 0.109,
  F: 0.055,
  S: 0.274,
  P: 0.200,
  Cl: 0.170,
  Br: 0.207,
  I: 0.265,
  Na: 0.030,
  Mg: 0.050,
  K: 0.040,
  Ca: 0.050,
};

const COULOMB_CONSTANT = 14.39417;
const HYDROGEN_BOND_DISTANCE_MIN = 1.5;
const HYDROGEN_BOND_DISTANCE_MAX = 3.5;
const HYDROGEN_BOND_ANGLE_CUTOFF = 120;

export class VectorCalculator {
  public static getPartialCharge(atom: Atom): number {
    return PARTIAL_CHARGES[atom.element] ?? 0.0;
  }

  public static calculateDipoleMoment(molecule: Molecule): DipoleMoment {
    const atoms = molecule.atoms.filter((a) => a.visible !== false);
    const center = new Vector3(0, 0, 0);

    atoms.forEach((atom) => {
      center.add(atom.position);
    });
    center.divideScalar(Math.max(atoms.length, 1));

    const dipole = new Vector3(0, 0, 0);
    atoms.forEach((atom) => {
      const charge = this.getPartialCharge(atom);
      const pos = atom.position.clone().sub(center);
      dipole.add(pos.multiplyScalar(charge));
    });

    const magnitude = dipole.length();

    return {
      vector: dipole,
      magnitude,
      origin: center.clone(),
      components: { x: dipole.x, y: dipole.y, z: dipole.z },
      unit: 'D',
    };
  }

  public static calculateElectrostaticForce(
    atom1: Atom,
    atom2: Atom,
    distance: number
  ): number {
    const q1 = this.getPartialCharge(atom1);
    const q2 = this.getPartialCharge(atom2);
    if (Math.abs(q1) < 1e-6 || Math.abs(q2) < 1e-6) return 0;
    return (COULOMB_CONSTANT * q1 * q2) / (distance * distance);
  }

  public static calculateVdWForce(
    atom1: Atom,
    atom2: Atom,
    distance: number
  ): number {
    const r1 = VDW_RADII[atom1.element] ?? 1.7;
    const r2 = VDW_RADII[atom2.element] ?? 1.7;
    const e1 = EPSILON[atom1.element] ?? 0.1;
    const e2 = EPSILON[atom2.element] ?? 0.1;

    const sigma = (r1 + r2) / 2;
    const epsilon = Math.sqrt(e1 * e2);
    const ratio = sigma / distance;
    const ratio6 = Math.pow(ratio, 6);
    const ratio12 = ratio6 * ratio6;

    const potential = 4 * epsilon * (ratio12 - ratio6);
    const force = 24 * epsilon * (2 * ratio12 - ratio6) / distance;

    return force;
  }

  public static detectHydrogenBond(
    atom1: Atom,
    atom2: Atom,
    atoms: Atom[]
  ): { isHydrogenBond: boolean; donorH?: Atom; distance: number } {
    const electronegative = ['O', 'N', 'F', 'S'];
    const dist = distance3D(atom1.position, atom2.position);

    if (dist < HYDROGEN_BOND_DISTANCE_MIN || dist > HYDROGEN_BOND_DISTANCE_MAX) {
      return { isHydrogenBond: false, distance: dist };
    }

    let donor: Atom | null = null;
    let acceptor: Atom | null = null;
    let donorH: Atom | null = null;

    if (atom1.element === 'H' && electronegative.includes(atom2.element)) {
      donorH = atom1;
      acceptor = atom2;
      const bondedH = atoms
        .filter((a) => a.element !== 'H' && electronegative.includes(a.element))
        .filter((a) => distance3D(a.position, atom1.position) < 1.5);
      if (bondedH.length > 0) donor = bondedH[0];
    } else if (atom2.element === 'H' && electronegative.includes(atom1.element)) {
      donorH = atom2;
      acceptor = atom1;
      const bondedH = atoms
        .filter((a) => a.element !== 'H' && electronegative.includes(a.element))
        .filter((a) => distance3D(a.position, atom2.position) < 1.5);
      if (bondedH.length > 0) donor = bondedH[0];
    }

    if (donor && acceptor && donorH) {
      const v1 = donor.position.clone().sub(donorH.position).normalize();
      const v2 = acceptor.position.clone().sub(donorH.position).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))) * (180 / Math.PI);

      if (angle >= HYDROGEN_BOND_ANGLE_CUTOFF) {
        return { isHydrogenBond: true, donorH, distance: dist };
      }
    }

    return { isHydrogenBond: false, distance: dist };
  }

  public static calculateIntermolecularForces(
    molecule1: Molecule,
    molecule2: Molecule
  ): IntermolecularForce[] {
    const forces: IntermolecularForce[] = [];
    const atoms1 = molecule1.atoms.filter((a) => a.visible !== false);
    const atoms2 = molecule2.atoms.filter((a) => a.visible !== false);
    const allAtoms = [...atoms1, ...atoms2];

    for (const atom1 of atoms1) {
      for (const atom2 of atoms2) {
        const dist = distance3D(atom1.position, atom2.position);
        if (dist > 10.0) continue;

        const hBond = this.detectHydrogenBond(atom1, atom2, allAtoms);
        if (hBond.isHydrogenBond && hBond.donorH) {
          const donorH = hBond.donorH;
          const direction = atom1.element === 'H'
            ? atom2.position.clone().sub(atom1.position)
            : atom1.position.clone().sub(atom2.position);
          const magnitude = Math.max(5, 30 / (dist * dist));
          const energy = -20 / dist;

          forces.push({
            id: generateId(),
            type: 'hydrogen_bond',
            vector: direction.normalize().multiplyScalar(magnitude),
            magnitude,
            origin: donorH.position.clone(),
            target: atom1.element === 'H' ? atom2.position.clone() : atom1.position.clone(),
            sourceMoleculeId: donorH.id === atom1.id ? molecule1.id : molecule2.id,
            targetMoleculeId: donorH.id === atom1.id ? molecule2.id : molecule1.id,
            sourceAtomId: donorH.id,
            targetAtomId: atom1.element === 'H' ? atom2.id : atom1.id,
            energy,
            distance: dist,
          });
          continue;
        }

        const electrostatic = this.calculateElectrostaticForce(atom1, atom2, dist);
        if (Math.abs(electrostatic) > 0.1) {
          const direction = electrostatic > 0
            ? atom1.position.clone().sub(atom2.position)
            : atom2.position.clone().sub(atom1.position);
          const scaledMag = Math.min(Math.abs(electrostatic), 50) * 0.5;

          forces.push({
            id: generateId(),
            type: 'electrostatic',
            vector: direction.normalize().multiplyScalar(scaledMag),
            magnitude: scaledMag,
            origin: atom1.position.clone().add(atom2.position).multiplyScalar(0.5),
            target: electrostatic > 0 ? atom1.position.clone() : atom2.position.clone(),
            sourceMoleculeId: molecule1.id,
            targetMoleculeId: molecule2.id,
            sourceAtomId: atom1.id,
            targetAtomId: atom2.id,
            energy: electrostatic,
            distance: dist,
          });
        }

        const vdw = this.calculateVdWForce(atom1, atom2, dist);
        if (Math.abs(vdw) > 0.01) {
          const direction = vdw > 0
            ? atom1.position.clone().sub(atom2.position)
            : atom2.position.clone().sub(atom1.position);
          const scaledMag = Math.min(Math.abs(vdw) * 100, 30);

          forces.push({
            id: generateId(),
            type: 'vdw',
            vector: direction.normalize().multiplyScalar(scaledMag),
            magnitude: scaledMag,
            origin: atom1.position.clone().add(atom2.position).multiplyScalar(0.5),
            target: vdw > 0 ? atom1.position.clone() : atom2.position.clone(),
            sourceMoleculeId: molecule1.id,
            targetMoleculeId: molecule2.id,
            sourceAtomId: atom1.id,
            targetAtomId: atom2.id,
            energy: vdw,
            distance: dist,
          });
        }
      }
    }

    return forces;
  }

  public static calculateDipoleDipoleInteraction(
    mol1: Molecule,
    mol2: Molecule
  ): IntermolecularForce | null {
    const d1 = this.calculateDipoleMoment(mol1);
    const d2 = this.calculateDipoleMoment(mol2);

    if (d1.magnitude < 0.05 || d2.magnitude < 0.05) return null;

    const distVec = d2.origin.clone().sub(d1.origin);
    const dist = distVec.length();

    if (dist > 15.0) return null;

    const rHat = distVec.clone().normalize();
    const mu1 = d1.vector.clone();
    const mu2 = d2.vector.clone();

    const term1 = mu1.dot(mu2);
    const term2 = 3 * (mu1.dot(rHat) * mu2.dot(rHat));

    const energy = 2 * (term1 - term2) / Math.pow(dist, 3);
    const magnitude = Math.min(Math.abs(energy) * 5, 40);
    const direction = energy > 0
      ? rHat.clone()
      : rHat.clone().negate();

    return {
      id: generateId(),
      type: 'dipole_dipole',
      vector: direction.multiplyScalar(magnitude),
      magnitude,
      origin: d1.origin.clone().add(d2.origin).multiplyScalar(0.5),
      target: energy > 0 ? d2.origin.clone() : d1.origin.clone(),
      sourceMoleculeId: mol1.id,
      targetMoleculeId: mol2.id,
      energy,
      distance: dist,
    };
  }

  public static calculateAllForces(
    molecule1: Molecule | null,
    molecule2: Molecule | null
  ): IntermolecularForce[] {
    if (!molecule1 || !molecule2) return [];

    const forces = this.calculateIntermolecularForces(molecule1, molecule2);
    const dipoleForce = this.calculateDipoleDipoleInteraction(molecule1, molecule2);
    if (dipoleForce) {
      forces.push(dipoleForce);
    }

    return forces;
  }
}
