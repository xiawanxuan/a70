import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type {
  Molecule,
  DipoleMoment,
  IntermolecularForce,
  VectorAnnotationConfig,
  ForceType,
} from '../types';
import { VectorCalculator } from '../core/vector/VectorCalculator';
import { FORCE_TYPE_NAMES } from '../types';

interface VectorRendererProps {
  reactantMolecule: Molecule | null;
  productMolecule: Molecule | null;
  activeMolecule: Molecule | null;
  vectorConfig: VectorAnnotationConfig;
}

interface ArrowGeometryCacheEntry {
  direction: THREE.Vector3;
  length: number;
  geometry: THREE.CylinderGeometry;
  coneGeometry: THREE.ConeGeometry;
}

export default function VectorRenderer({
  reactantMolecule,
  productMolecule,
  activeMolecule,
  vectorConfig,
}: VectorRendererProps) {
  const groupRef = useRef<THREE.Group>(null);
  const geometriesRef = useRef<Map<string, ArrowGeometryCacheEntry>>(new Map());
  const materialsRef = useRef<Map<string, THREE.MeshPhongMaterial>>(new Map());

  const dipoleArrows = useMemo(() => {
    const arrows: Array<{
      origin: THREE.Vector3;
      direction: THREE.Vector3;
      length: number;
      color: string;
      label: string;
      type: 'dipole';
      moleculeId: string;
      magnitude: number;
    }> = [];

    if (!vectorConfig.showDipoleMoment) return arrows;

    const molecules = [
      { mol: reactantMolecule, id: 'reactant' },
      { mol: productMolecule, id: 'product' },
      { mol: activeMolecule, id: 'active' },
    ].filter((m): m is { mol: Molecule; id: string } => m.mol !== null);

    const seenMolecules = new Set<string>();

    molecules.forEach(({ mol, id }) => {
      if (seenMolecules.has(mol.id)) return;
      seenMolecules.add(mol.id);

      const dipole: DipoleMoment = VectorCalculator.calculateDipoleMoment(mol);
      if (dipole.magnitude < 0.05) return;

      const dir = dipole.vector.clone().normalize();
      const length = Math.min(dipole.magnitude * 3 * vectorConfig.arrowScale, 8);
      const origin = dipole.origin.clone();
      const endPoint = origin.clone().add(dir.clone().multiplyScalar(length));

      arrows.push({
        origin,
        direction: dir,
        length,
        color: vectorConfig.dipoleColor,
        label: `μ=${dipole.magnitude.toFixed(3)} ${dipole.unit}`,
        type: 'dipole',
        moleculeId: mol.id,
        magnitude: dipole.magnitude,
      });
    });

    return arrows;
  }, [reactantMolecule, productMolecule, activeMolecule, vectorConfig.showDipoleMoment, vectorConfig.arrowScale, vectorConfig.dipoleColor]);

  const forceArrows = useMemo(() => {
    const arrows: Array<{
      origin: THREE.Vector3;
      direction: THREE.Vector3;
      length: number;
      color: string;
      label: string;
      type: ForceType;
      magnitude: number;
    }> = [];

    if (!vectorConfig.showIntermolecularForces) return arrows;
    if (!reactantMolecule || !productMolecule) return arrows;

    const forces: IntermolecularForce[] = VectorCalculator.calculateAllForces(
      reactantMolecule,
      productMolecule
    );

    const typeCounts: Record<string, number> = {};

    forces.forEach((force) => {
      const key = `${force.type}-${force.sourceAtomId || 'mol'}-${force.targetAtomId || 'mol'}`;
      typeCounts[force.type] = (typeCounts[force.type] || 0) + 1;

      if (typeCounts[force.type]! > vectorConfig.maxForceDisplay) return;
      if (force.magnitude < vectorConfig.minForceMagnitude) return;

      const dir = force.vector.clone().normalize();
      const length = Math.min(force.magnitude * 0.15 * vectorConfig.arrowScale, 6);
      const color = vectorConfig.forceColors[force.type] || '#888888';

      arrows.push({
        origin: force.origin.clone(),
        direction: dir,
        length,
        color,
        label: `${FORCE_TYPE_NAMES[force.type]}: ${force.energy.toFixed(2)} kJ/mol`,
        type: force.type,
        magnitude: force.magnitude,
      });
    });

    return arrows;
  }, [reactantMolecule, productMolecule, vectorConfig]);

  useEffect(() => {
    return () => {
      geometriesRef.current.forEach((entry) => {
        entry.geometry.dispose();
        entry.coneGeometry.dispose();
      });
      geometriesRef.current.clear();

      materialsRef.current.forEach((mat) => {
        mat.dispose();
      });
      materialsRef.current.clear();
    };
  }, []);

  const getOrCreateMaterial = (color: string): THREE.MeshPhongMaterial => {
    const key = color;
    if (!materialsRef.current.has(key)) {
      materialsRef.current.set(
        key,
        new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          shininess: 100,
          specular: new THREE.Color('#444444'),
          transparent: true,
          opacity: 0.9,
        })
      );
    }
    return materialsRef.current.get(key)!;
  };

  const renderArrow = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    color: string,
    key: string
  ) => {
    if (length < 0.1) return null;

    const material = getOrCreateMaterial(color);

    const shaftLength = length * (1 - vectorConfig.arrowHeadLength / length);
    const actualShaftLength = Math.max(shaftLength, 0.1);
    const headLength = Math.min(vectorConfig.arrowHeadLength, length * 0.3);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

    const shaftPosition = origin
      .clone()
      .add(direction.clone().multiplyScalar(actualShaftLength / 2));

    const headPosition = origin
      .clone()
      .add(direction.clone().multiplyScalar(actualShaftLength));

    return (
      <group key={key}>
        <mesh
          position={shaftPosition}
          quaternion={quaternion}
          material={material}
          renderOrder={10}
        >
          <cylinderGeometry
            args={[
              vectorConfig.arrowRadius,
              vectorConfig.arrowRadius,
              actualShaftLength,
              12,
              1,
            ]}
          />
        </mesh>
        <mesh
          position={headPosition}
          quaternion={quaternion}
          material={material}
          renderOrder={10}
        >
          <coneGeometry
            args={[
              vectorConfig.arrowRadius * 2.5,
              headLength,
              12,
              1,
            ]}
          />
        </mesh>
      </group>
    );
  };

  const visible = vectorConfig.showDipoleMoment || vectorConfig.showIntermolecularForces;

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {dipoleArrows.map((arrow, idx) =>
        renderArrow(
          arrow.origin,
          arrow.direction,
          arrow.length,
          arrow.color,
          `dipole-${arrow.moleculeId}-${idx}`
        )
      )}
      {forceArrows.map((arrow, idx) =>
        renderArrow(
          arrow.origin,
          arrow.direction,
          arrow.length,
          arrow.color,
          `force-${arrow.type}-${idx}`
        )
      )}

      {vectorConfig.showForceLabels && (dipoleArrows.length > 0 || forceArrows.length > 0) && (
        <group>
          {dipoleArrows.map((arrow, idx) => {
            const labelPos = arrow.origin
              .clone()
              .add(arrow.direction.clone().multiplyScalar(arrow.length + 0.5));
            return (
              <sprite
                key={`label-dipole-${idx}`}
                position={labelPos}
                scale={[2, 0.8, 1]}
                renderOrder={100}
              >
                <spriteMaterial
                  attach="material"
                  transparent
                  opacity={0}
                  depthTest={false}
                />
              </sprite>
            );
          })}
        </group>
      )}
    </group>
  );
}
