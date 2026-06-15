import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
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
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const prevGeometriesRef = useRef<{
    positive: THREE.BufferGeometry | null;
    negative: THREE.BufferGeometry | null;
  }>({ positive: null, negative: null });
  const prevMaterialsRef = useRef<{
    positive: THREE.Material | null;
    negative: THREE.Material | null;
  }>({ positive: null, negative: null });

  useEffect(() => {
    if (!densityGrid) {
      gl.clear(true, true, true);
      
      if (prevGeometriesRef.current.positive) {
        prevGeometriesRef.current.positive.dispose();
        prevGeometriesRef.current.positive = null;
      }
      if (prevGeometriesRef.current.negative) {
        prevGeometriesRef.current.negative.dispose();
        prevGeometriesRef.current.negative = null;
      }
      if (prevMaterialsRef.current.positive) {
        prevMaterialsRef.current.positive.dispose();
        prevMaterialsRef.current.positive = null;
      }
      if (prevMaterialsRef.current.negative) {
        prevMaterialsRef.current.negative.dispose();
        prevMaterialsRef.current.negative = null;
      }
    }
  }, [densityGrid, gl]);

  const { positiveGeometry, negativeGeometry } = useMemo(() => {
    if (!densityGrid || !renderConfig.showIsosurface) {
      if (prevGeometriesRef.current.positive) {
        prevGeometriesRef.current.positive.dispose();
        prevGeometriesRef.current.positive = null;
      }
      if (prevGeometriesRef.current.negative) {
        prevGeometriesRef.current.negative.dispose();
        prevGeometriesRef.current.negative = null;
      }
      return { positiveGeometry: null, negativeGeometry: null };
    }

    try {
      const { positive, negative } = IsosurfaceGenerator.generatePositiveNegative(
        densityGrid,
        renderConfig.isoValue
      );

      const posGeo = IsosurfaceGenerator.toThreeGeometry(positive);
      const negGeo = IsosurfaceGenerator.toThreeGeometry(negative);

      if (prevGeometriesRef.current.positive && prevGeometriesRef.current.positive !== posGeo) {
        prevGeometriesRef.current.positive.dispose();
      }
      if (prevGeometriesRef.current.negative && prevGeometriesRef.current.negative !== negGeo) {
        prevGeometriesRef.current.negative.dispose();
      }
      
      prevGeometriesRef.current = { positive: posGeo, negative: negGeo };

      return { positiveGeometry: posGeo, negativeGeometry: negGeo };
    } catch (error) {
      console.error('等值面生成失败:', error);
      return { positiveGeometry: null, negativeGeometry: null };
    }
  }, [densityGrid, renderConfig.isoValue, renderConfig.showIsosurface]);

  const positiveMaterial = useMemo(() => {
    if (prevMaterialsRef.current.positive) {
      prevMaterialsRef.current.positive.dispose();
    }
    const mat = new THREE.MeshPhongMaterial({
      ...DENSITY_MATERIALS.positive,
      color: new THREE.Color(renderConfig.positiveColor || DENSITY_MATERIALS.positive.color),
      opacity: renderConfig.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    prevMaterialsRef.current.positive = mat;
    return mat;
  }, [renderConfig.positiveColor, renderConfig.opacity]);

  const negativeMaterial = useMemo(() => {
    if (prevMaterialsRef.current.negative) {
      prevMaterialsRef.current.negative.dispose();
    }
    const mat = new THREE.MeshPhongMaterial({
      ...DENSITY_MATERIALS.negative,
      color: new THREE.Color(renderConfig.negativeColor || DENSITY_MATERIALS.negative.color),
      opacity: renderConfig.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    prevMaterialsRef.current.negative = mat;
    return mat;
  }, [renderConfig.negativeColor, renderConfig.opacity]);

  useEffect(() => {
    return () => {
      if (prevMaterialsRef.current.positive) {
        prevMaterialsRef.current.positive.dispose();
      }
      if (prevMaterialsRef.current.negative) {
        prevMaterialsRef.current.negative.dispose();
      }
      if (prevGeometriesRef.current.positive) {
        prevGeometriesRef.current.positive.dispose();
      }
      if (prevGeometriesRef.current.negative) {
        prevGeometriesRef.current.negative.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = !!(densityGrid && renderConfig.showIsosurface);
    }
  }, [densityGrid, renderConfig.showIsosurface]);

  const hasPositive = positiveGeometry && 
    positiveGeometry.attributes.position && 
    positiveGeometry.attributes.position.count > 0;
  
  const hasNegative = negativeGeometry && 
    negativeGeometry.attributes.position && 
    negativeGeometry.attributes.position.count > 0;

  if (!renderConfig.showIsosurface || !densityGrid) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {hasPositive && (
        <mesh
          geometry={positiveGeometry!}
          material={positiveMaterial}
          frustumCulled={false}
          renderOrder={1}
        />
      )}

      {hasNegative && (
        <mesh
          geometry={negativeGeometry!}
          material={negativeMaterial}
          frustumCulled={false}
          renderOrder={2}
        />
      )}
    </group>
  );
}
