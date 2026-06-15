import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Atom, Bond, HighlightConfig } from '../types';
import { ATOM_COLORS, ATOM_RADII, BOND_MATERIAL } from '../config/materials';

interface MoleculeRendererProps {
  atoms: Atom[];
  bonds: Bond[];
  showAtoms?: boolean;
  showBonds?: boolean;
  atomScale?: number;
  bondRadius?: number;
  highlightConfig?: HighlightConfig;
}

const GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function getCachedSphereGeometry(segments: number): THREE.SphereGeometry {
  const key = `sphere_${segments}`;
  if (!GEO_CACHE.has(key)) {
    GEO_CACHE.set(key, new THREE.SphereGeometry(1, segments, segments));
  }
  return GEO_CACHE.get(key) as THREE.SphereGeometry;
}

function getCachedCylinderGeometry(segments: number): THREE.CylinderGeometry {
  const key = `cylinder_${segments}`;
  if (!GEO_CACHE.has(key)) {
    GEO_CACHE.set(key, new THREE.CylinderGeometry(1, 1, 1, segments));
  }
  return GEO_CACHE.get(key) as THREE.CylinderGeometry;
}

export default function MoleculeRenderer({
  atoms,
  bonds,
  showAtoms = true,
  showBonds = true,
  atomScale = 1.0,
  bondRadius = 0.15,
  highlightConfig,
}: MoleculeRendererProps) {
  const atomsRef = useRef<THREE.InstancedMesh>(null);
  const bondsRef = useRef<THREE.InstancedMesh>(null);
  const highlightAtomsRef = useRef<THREE.InstancedMesh>(null);
  const lastUpdateRef = useRef<number>(0);

  const atomCount = atoms.length;
  const isLargeMolecule = atomCount > 50;
  const sphereSegments = isLargeMolecule ? 16 : 32;
  const cylinderSegments = isLargeMolecule ? 8 : 16;

  const visibleAtoms = useMemo(
    () => atoms.filter((atom) => atom.visible !== false),
    [atoms]
  );

  const highlightedAtomIds = useMemo(() => {
    if (!highlightConfig?.enabled) return new Set<number>();
    const ids = new Set<number>(highlightConfig.selectedAtomIds);
    highlightConfig.selectedElements.forEach((element) => {
      atoms
        .filter((a) => a.element === element)
        .forEach((a) => ids.add(a.id));
    });
    return ids;
  }, [highlightConfig, atoms]);

  const { atomData, bondData, highlightData } = useMemo(() => {
    const atomPositions: Float32Array = new Float32Array(visibleAtoms.length * 3);
    const atomColors: Float32Array = new Float32Array(visibleAtoms.length * 3);
    const atomScales: Float32Array = new Float32Array(visibleAtoms.length);

    visibleAtoms.forEach((atom, i) => {
      atomPositions[i * 3] = atom.position.x;
      atomPositions[i * 3 + 1] = atom.position.y;
      atomPositions[i * 3 + 2] = atom.position.z;

      const colorHex = ATOM_COLORS[atom.element] || '#B0B0B0';
      const color = new THREE.Color(colorHex);
      atomColors[i * 3] = color.r;
      atomColors[i * 3 + 1] = color.g;
      atomColors[i * 3 + 2] = color.b;

      atomScales[i] = (ATOM_RADII[atom.element] || 0.5) * atomScale;
    });

    const bondMatrices: Float32Array = new Float32Array(bonds.length * 16);
    let bondCount = 0;

    if (showBonds) {
      const atomMap = new Map(atoms.map((a) => [a.id, a]));
      const dummy = new THREE.Object3D();
      const up = new THREE.Vector3(0, 1, 0);

      bonds.forEach((bond) => {
        const atom1 = atomMap.get(bond.atom1);
        const atom2 = atomMap.get(bond.atom2);
        if (!atom1 || !atom2) return;
        if (atom1.visible === false || atom2.visible === false) return;

        const midpoint = new THREE.Vector3()
          .addVectors(atom1.position, atom2.position)
          .multiplyScalar(0.5);

        const direction = new THREE.Vector3()
          .subVectors(atom2.position, atom1.position)
          .normalize();

        dummy.position.copy(midpoint);
        dummy.quaternion.setFromUnitVectors(up, direction);
        dummy.scale.set(bondRadius, bond.length / 2, bondRadius);
        dummy.updateMatrix();

        bondMatrices.set(dummy.matrix.elements, bondCount * 16);
        bondCount++;
      });
    }

    const highlightAtoms = highlightConfig?.enabled
      ? visibleAtoms.filter((a) => highlightedAtomIds.has(a.id))
      : [];

    const highlightPositions: Float32Array = new Float32Array(highlightAtoms.length * 3);
    const highlightScales: Float32Array = new Float32Array(highlightAtoms.length);

    highlightAtoms.forEach((atom, i) => {
      highlightPositions[i * 3] = atom.position.x;
      highlightPositions[i * 3 + 1] = atom.position.y;
      highlightPositions[i * 3 + 2] = atom.position.z;
      highlightScales[i] = (ATOM_RADII[atom.element] || 0.5) * atomScale * 1.2;
    });

    return {
      atomData: { positions: atomPositions, colors: atomColors, scales: atomScales, count: visibleAtoms.length },
      bondData: { matrices: bondMatrices, count: bondCount },
      highlightData: { positions: highlightPositions, scales: highlightScales, count: highlightAtoms.length },
    };
  }, [visibleAtoms, bonds, atoms, showBonds, atomScale, bondRadius, highlightConfig, highlightedAtomIds]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    lastUpdateRef.current += delta;
    const updateInterval = isLargeMolecule ? 0.05 : 0;
    
    if (lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = 0;

    if (atomsRef.current && showAtoms && atomData.count > 0) {
      for (let i = 0; i < atomData.count; i++) {
        dummy.position.set(
          atomData.positions[i * 3],
          atomData.positions[i * 3 + 1],
          atomData.positions[i * 3 + 2]
        );
        dummy.scale.setScalar(atomData.scales[i]);
        dummy.updateMatrix();
        atomsRef.current.setMatrixAt(i, dummy.matrix);

        color.setRGB(
          atomData.colors[i * 3],
          atomData.colors[i * 3 + 1],
          atomData.colors[i * 3 + 2]
        );
        atomsRef.current.setColorAt(i, color);
      }
      atomsRef.current.instanceMatrix.needsUpdate = true;
      if (atomsRef.current.instanceColor) {
        atomsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (bondsRef.current && showBonds && bondData.count > 0) {
      for (let i = 0; i < bondData.count; i++) {
        dummy.matrix.fromArray(bondData.matrices, i * 16);
        bondsRef.current.setMatrixAt(i, dummy.matrix);
      }
      bondsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (highlightAtomsRef.current && highlightConfig?.enabled && highlightData.count > 0) {
      for (let i = 0; i < highlightData.count; i++) {
        dummy.position.set(
          highlightData.positions[i * 3],
          highlightData.positions[i * 3 + 1],
          highlightData.positions[i * 3 + 2]
        );
        dummy.scale.setScalar(highlightData.scales[i]);
        dummy.updateMatrix();
        highlightAtomsRef.current.setMatrixAt(i, dummy.matrix);
      }
      highlightAtomsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const sphereGeo = useMemo(() => getCachedSphereGeometry(sphereSegments), [sphereSegments]);
  const cylinderGeo = useMemo(() => getCachedCylinderGeometry(cylinderSegments), [cylinderSegments]);
  const atomMaterial = useMemo(() => new THREE.MeshPhongMaterial({ shininess: 100, specular: '#333333' }), []);
  const bondMaterial = useMemo(() => new THREE.MeshPhongMaterial({ ...BOND_MATERIAL }), []);
  const highlightMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: highlightConfig?.color || '#FFD700',
    transparent: true,
    opacity: 0.3 + (highlightConfig?.glowIntensity || 0.5) * 0.4,
    depthWrite: false,
  }), [highlightConfig]);

  useEffect(() => {
    return () => {
      atomMaterial.dispose();
      bondMaterial.dispose();
      highlightMaterial.dispose();
    };
  }, [atomMaterial, bondMaterial, highlightMaterial]);

  return (
    <group>
      {showAtoms && atomData.count > 0 && (
        <instancedMesh
          ref={atomsRef}
          args={[sphereGeo, atomMaterial, atomData.count]}
          castShadow
          receiveShadow
          frustumCulled={!isLargeMolecule}
        />
      )}

      {showBonds && bondData.count > 0 && (
        <instancedMesh
          ref={bondsRef}
          args={[cylinderGeo, bondMaterial, bondData.count]}
          castShadow
          receiveShadow
          frustumCulled={!isLargeMolecule}
        />
      )}

      {highlightData.count > 0 && highlightConfig?.enabled && (
        <instancedMesh
          ref={highlightAtomsRef}
          args={[sphereGeo, highlightMaterial, highlightData.count]}
          frustumCulled={!isLargeMolecule}
        />
      )}
    </group>
  );
}
