import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { DensityGrid, RenderConfig } from '../types';
import { IsosurfaceGenerator } from '../core/renderer/Isosurface';
import { DENSITY_MATERIALS } from '../config/materials';

interface IsosurfaceRendererProps {
  densityGrid: DensityGrid | null;
  renderConfig: RenderConfig;
}

export default function IsosurfaceRenderer({
  densityGrid,
  renderConfig,
}: IsosurfaceRendererProps) {
  const positiveMeshRef = useRef<THREE.Mesh>(null);
  const negativeMeshRef = useRef<THREE.Mesh>(null);
  const prevGeometriesRef = useRef<{
    positive: THREE.BufferGeometry | null;
    negative: THREE.BufferGeometry | null;
  }>({ positive: null, negative: null });

  const { positiveGeometry, negativeGeometry } = useMemo(() => {
    if (!densityGrid || !renderConfig.showIsosurface) {
      return { positiveGeometry: null, negativeGeometry: null };
    }

    try {
      const { positive, negative } = IsosurfaceGenerator.generatePositiveNegative(
        densityGrid,
        renderConfig.isoValue
      );

      const posGeo = IsosurfaceGenerator.toThreeGeometry(positive);
      const negGeo = IsosurfaceGenerator.toThreeGeometry(negative);

      return { positiveGeometry: posGeo, negativeGeometry: negGeo };
    } catch (error) {
      console.error('等值面生成失败:', error);
      return { positiveGeometry: null, negativeGeometry: null };
    }
  }, [densityGrid, renderConfig.isoValue, renderConfig.showIsosurface]);

  useEffect(() => {
    if (prevGeometriesRef.current.positive && prevGeometriesRef.current.positive !== positiveGeometry) {
      prevGeometriesRef.current.positive.dispose();
    }
    if (prevGeometriesRef.current.negative && prevGeometriesRef.current.negative !== negativeGeometry) {
      prevGeometriesRef.current.negative.dispose();
    }
    prevGeometriesRef.current = { positive: positiveGeometry, negative: negativeGeometry };
  }, [positiveGeometry, negativeGeometry]);

  const positiveMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        ...DENSITY_MATERIALS.positive,
        color: new THREE.Color(renderConfig.positiveColor || DENSITY_MATERIALS.positive.color),
        opacity: renderConfig.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [renderConfig.positiveColor, renderConfig.opacity]
  );

  const negativeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        ...DENSITY_MATERIALS.negative,
        color: new THREE.Color(renderConfig.negativeColor || DENSITY_MATERIALS.negative.color),
        opacity: renderConfig.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [renderConfig.negativeColor, renderConfig.opacity]
  );

  useEffect(() => {
    return () => {
      positiveMaterial.dispose();
      negativeMaterial.dispose();
      if (prevGeometriesRef.current.positive) {
        prevGeometriesRef.current.positive.dispose();
      }
      if (prevGeometriesRef.current.negative) {
        prevGeometriesRef.current.negative.dispose();
      }
    };
  }, [positiveMaterial, negativeMaterial]);

  if (!renderConfig.showIsosurface || !densityGrid) {
    return null;
  }

  return (
    <group>
      {positiveGeometry && positiveGeometry.attributes.position && positiveGeometry.attributes.position.count > 0 && (
        <mesh
          ref={positiveMeshRef}
          geometry={positiveGeometry}
          material={positiveMaterial}
          frustumCulled={false}
        />
      )}

      {negativeGeometry && negativeGeometry.attributes.position && negativeGeometry.attributes.position.count > 0 && (
        <mesh
          ref={negativeMeshRef}
          geometry={negativeGeometry}
          material={negativeMaterial}
          frustumCulled={false}
        />
      )}
    </group>
  );
}
