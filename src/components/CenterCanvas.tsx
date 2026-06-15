import { useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMoleculeStore } from '../store/useMoleculeStore';
import MoleculeRenderer from './MoleculeRenderer';
import IsosurfaceRenderer from './IsosurfaceRenderer';

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { viewConfig, updateViewConfig } = useMoleculeStore();

  useEffect(() => {
    camera.position.set(...viewConfig.cameraPosition);
    camera.up.set(...viewConfig.cameraUp);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = viewConfig.fov;
      camera.updateProjectionMatrix();
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(...viewConfig.cameraTarget);
      controlsRef.current.update();
    }
  }, []);

  const handleControlsChange = useCallback(() => {
    if (!controlsRef.current) return;

    const pos = controlsRef.current.object.position;
    const target = controlsRef.current.target;
    const up = controlsRef.current.object.up;

    updateViewConfig({
      cameraPosition: [pos.x, pos.y, pos.z],
      cameraTarget: [target.x, target.y, target.z],
      cameraUp: [up.x, up.y, up.z],
    });
  }, [updateViewConfig]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={50}
      onChange={handleControlsChange}
      makeDefault
    />
  );
}

function SceneContent() {
  const {
    molecules,
    activeMoleculeId,
    reactantMolecule,
    productMolecule,
    densityGrid,
    renderConfig,
    highlightConfig,
  } = useMoleculeStore();

  const activeMolecule = molecules.find((m) => m.id === activeMoleculeId);

  return (
    <>
      <hemisphereLight args={['#ffffff', '#404040', 0.6]} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} />
      <ambientLight intensity={0.3} />

      <axesHelper args={[2]} position={[-5, -3, -3]} />

      {reactantMolecule && (
        <group>
          <MoleculeRenderer
            atoms={reactantMolecule.atoms}
            bonds={reactantMolecule.bonds}
            showAtoms={renderConfig.showAtoms}
            showBonds={renderConfig.showBonds}
            atomScale={renderConfig.atomScale}
            bondRadius={renderConfig.bondRadius}
            highlightConfig={highlightConfig}
          />
        </group>
      )}

      {productMolecule && (
        <group>
          <MoleculeRenderer
            atoms={productMolecule.atoms}
            bonds={productMolecule.bonds}
            showAtoms={renderConfig.showAtoms}
            showBonds={renderConfig.showBonds}
            atomScale={renderConfig.atomScale}
            bondRadius={renderConfig.bondRadius}
            highlightConfig={highlightConfig}
          />
        </group>
      )}

      {!reactantMolecule && !productMolecule && activeMolecule && (
        <MoleculeRenderer
          atoms={activeMolecule.atoms}
          bonds={activeMolecule.bonds}
          showAtoms={renderConfig.showAtoms}
          showBonds={renderConfig.showBonds}
          atomScale={renderConfig.atomScale}
          bondRadius={renderConfig.bondRadius}
          highlightConfig={highlightConfig}
        />
      )}

      <IsosurfaceRenderer densityGrid={densityGrid} renderConfig={renderConfig} />

      <gridHelper args={[20, 20, '#666666', '#444444']} position={[0, -4, 0]} />
    </>
  );
}

export default function CenterCanvas() {
  const { isLoading, error, molecules, densityGrid, renderConfig, progress } = useMoleculeStore();

  return (
    <div className="flex-1 h-full bg-gray-50 relative">
      <Canvas
        shadows
        camera={{ position: [0, 2, 12], fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#f8f9fa']} />
        <fog attach="fog" args={['#f8f9fa', 30, 60]} />
        <CameraController />
        <SceneContent />
      </Canvas>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-center w-64">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-3">正在计算密度差分...</p>
            {progress !== null && progress >= 0 && progress <= 1 && (
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
            {progress !== null && progress >= 0 && progress <= 1 && (
              <p className="text-xs text-gray-500 mt-2">
                {Math.round(progress * 100)}%
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md">
            <p className="font-medium">错误</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {molecules.length === 0 && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">⚛️</div>
            <p className="text-lg font-medium">请上传 Gaussian 输出文件</p>
            <p className="text-sm mt-2">或点击左侧"加载乙烷脱氢示例"按钮</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow">
        <div className="text-xs text-gray-600 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1565C0' }} />
            <span>电子富集区 (Δρ &gt; 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#C62828' }} />
            <span>电子缺失区 (Δρ &lt; 0)</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow">
        <div className="text-xs text-gray-500 space-y-0.5">
          {densityGrid && (
            <p>
              网格: {densityGrid.dimensions[0]}×{densityGrid.dimensions[1]}×
              {densityGrid.dimensions[2]}
            </p>
          )}
          <p>等值面: {renderConfig.isoValue.toFixed(4)}</p>
        </div>
      </div>
    </div>
  );
}
