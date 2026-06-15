import { useMoleculeStore } from '../store/useMoleculeStore';
import { AtomSelector } from '../core/filter/AtomSelector';
import { FUNCTIONAL_GROUPS, ELEMENT_LIST, FORCE_TYPE_NAMES } from '../types';
import type { Molecule, ForceType } from '../types';

export default function RightPanel() {
  const {
    molecules,
    activeMoleculeId,
    renderConfig,
    highlightConfig,
    updateHighlightConfig,
    updateVectorConfig,
    selectAtom,
  } = useMoleculeStore();

  const { vectorConfig } = renderConfig;

  const activeMolecule = molecules.find((m) => m.id === activeMoleculeId) as Molecule | undefined;

  const handleElementToggle = (element: string) => {
    AtomSelector.highlightByElement(element, true);
  };

  const handleGroupToggle = (groupName: string) => {
    AtomSelector.highlightByGroup(groupName);
  };

  const handleClearHighlight = () => {
    AtomSelector.clearHighlight();
  };

  const handleHighlightEnabled = (enabled: boolean) => {
    updateHighlightConfig({ enabled });
  };

  const handleAtomClick = (atomId: number, e: React.MouseEvent) => {
    selectAtom(atomId, e.ctrlKey || e.metaKey);
  };

  const distinctElements = activeMolecule
    ? AtomSelector.getDistinctElements(activeMolecule)
    : [];

  const elementCounts = activeMolecule ? AtomSelector.getElementCounts(activeMolecule) : {};

  const visibleAtoms = activeMolecule ? AtomSelector.getVisibleAtoms(activeMolecule) : [];

  const commonElements = ELEMENT_LIST.filter((el) => distinctElements.includes(el));

  return (
    <div className="w-[240px] h-full bg-gray-100 border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">原子筛选面板</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            分子矢量标注
          </h3>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-xs text-gray-600 cursor-pointer">
              <span>显示偶极矩</span>
              <input
                type="checkbox"
                checked={vectorConfig.showDipoleMoment}
                onChange={(e) => updateVectorConfig({ showDipoleMoment: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-gray-600 cursor-pointer">
              <span>显示分子间作用力</span>
              <input
                type="checkbox"
                checked={vectorConfig.showIntermolecularForces}
                onChange={(e) => updateVectorConfig({ showIntermolecularForces: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
            </label>

            <div className="pt-1 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span>箭头缩放</span>
                <span className="font-mono text-gray-500">{vectorConfig.arrowScale.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.1"
                value={vectorConfig.arrowScale}
                onChange={(e) => updateVectorConfig({ arrowScale: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="pt-1 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span>最大作用力显示</span>
                <span className="font-mono text-gray-500">{vectorConfig.maxForceDisplay}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={vectorConfig.maxForceDisplay}
                onChange={(e) => updateVectorConfig({ maxForceDisplay: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="pt-1 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span>最小力阈值</span>
                <span className="font-mono text-gray-500">{vectorConfig.minForceMagnitude.toFixed(3)}</span>
              </label>
              <input
                type="range"
                min="0.001"
                max="0.5"
                step="0.005"
                value={vectorConfig.minForceMagnitude}
                onChange={(e) => updateVectorConfig({ minForceMagnitude: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">作用力类型颜色</p>
              <div className="space-y-1.5">
                {(Object.keys(FORCE_TYPE_NAMES) as ForceType[]).map((type) => (
                  <label key={type} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{FORCE_TYPE_NAMES[type]}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-gray-300"
                        style={{ backgroundColor: vectorConfig.forceColors[type] }}
                      />
                      <input
                        type="color"
                        value={vectorConfig.forceColors[type]}
                        onChange={(e) =>
                          updateVectorConfig({
                            forceColors: {
                              ...vectorConfig.forceColors,
                              [type]: e.target.value,
                            },
                          })
                        }
                        className="w-5 h-5 rounded border-none cursor-pointer p-0 bg-transparent"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-1 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs">
                <span className="text-gray-600">偶极矩颜色</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-gray-300"
                    style={{ backgroundColor: vectorConfig.dipoleColor }}
                  />
                  <input
                    type="color"
                    value={vectorConfig.dipoleColor}
                    onChange={(e) => updateVectorConfig({ dipoleColor: e.target.value })}
                    className="w-5 h-5 rounded border-none cursor-pointer p-0 bg-transparent"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={highlightConfig.enabled}
              onChange={(e) => handleHighlightEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            启用高亮显示
          </label>
          <button
            onClick={handleClearHighlight}
            className="w-full px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            清除所有选择
          </button>
        </div>

        {activeMolecule && (
          <>
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-xs font-medium text-gray-700 mb-3">按元素筛选</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {commonElements.map((element) => (
                  <button
                    key={element}
                    onClick={() => handleElementToggle(element)}
                    className={`px-2 py-1.5 text-xs rounded transition-colors ${
                      highlightConfig.selectedElements.includes(element)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={`${element} (${elementCounts[element] || 0} 个)`}
                  >
                    {element}
                    <span className="text-xs opacity-70 ml-0.5">
                      ({elementCounts[element] || 0})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-b border-gray-200">
              <h3 className="text-xs font-medium text-gray-700 mb-3">按官能团筛选</h3>
              <div className="space-y-1.5">
                {Object.keys(FUNCTIONAL_GROUPS).map((groupName) => (
                  <button
                    key={groupName}
                    onClick={() => handleGroupToggle(groupName)}
                    className={`w-full px-2 py-1.5 text-xs text-left rounded transition-colors ${
                      highlightConfig.selectedGroups.includes(groupName)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {groupName}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-b border-gray-200">
              <h3 className="text-xs font-medium text-gray-700 mb-2">分子信息</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">分子式</span>
                  <span className="font-mono">{activeMolecule.molecularFormula}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">原子数</span>
                  <span>{activeMolecule.atoms.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">可见原子</span>
                  <span>{visibleAtoms.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">键数</span>
                  <span>{activeMolecule.bonds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">片段数</span>
                  <span>{activeMolecule.fragments.length}</span>
                </div>
                {activeMolecule.energy !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">能量</span>
                    <span className="font-mono">{activeMolecule.energy.toFixed(6)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              <h3 className="text-xs font-medium text-gray-700 mb-3">原子列表</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {visibleAtoms.slice(0, 50).map((atom) => (
                  <div
                    key={atom.id}
                    onClick={(e) => handleAtomClick(atom.id, e)}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer transition-colors ${
                      highlightConfig.selectedAtomIds.includes(atom.id)
                        ? 'bg-blue-100 text-blue-800'
                        : 'hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{
                        backgroundColor:
                          atom.element === 'H'
                            ? '#FFFFFF'
                            : atom.element === 'C'
                            ? '#909090'
                            : atom.element === 'N'
                            ? '#3050F8'
                            : atom.element === 'O'
                            ? '#FF0D0D'
                            : '#B0B0B0',
                      }}
                    />
                    <span className="w-6">{atom.symbol}</span>
                    <span className="text-gray-400">#{atom.id}</span>
                    <span className="text-gray-400 ml-auto">
                      ({atom.position.x.toFixed(1)}, {atom.position.y.toFixed(1)},{' '}
                      {atom.position.z.toFixed(1)})
                    </span>
                  </div>
                ))}
                {visibleAtoms.length > 50 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    ... 还有 {visibleAtoms.length - 50} 个原子
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                按住 Ctrl/Cmd 点击可多选
              </p>
            </div>
          </>
        )}

        {!activeMolecule && (
          <div className="p-4 text-center text-xs text-gray-400">
            <p>请先加载分子文件</p>
            <p className="mt-1">或点击"加载乙烷脱氢示例"</p>
          </div>
        )}
      </div>

      {highlightConfig.selectedAtomIds.length > 0 && (
        <div className="p-3 bg-blue-50 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            已选中 {highlightConfig.selectedAtomIds.length} 个原子
          </p>
        </div>
      )}
    </div>
  );
}
