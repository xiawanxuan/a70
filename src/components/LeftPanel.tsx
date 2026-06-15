import { useState, useRef } from 'react';
import { useMoleculeStore } from '../store/useMoleculeStore';
import { eventBus } from '../core/events/EventBus';
import { GaussianParser } from '../core/parser/GaussianParser';
import { MoleculeSwitcher } from '../core/controls/MoleculeSwitcher';
import { ConfigExporter } from '../core/export/ConfigExporter';
import type { MoleculeType, GridResolution } from '../types';
import { GRID_RESOLUTION_CONFIG } from '../types';

export default function LeftPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [displayMode, setDisplayMode] = useState<'single' | 'difference'>('difference');

  const {
    molecules,
    activeMoleculeId,
    reactantMolecule,
    productMolecule,
    renderConfig,
    setLoading,
    setError,
    setGridResolution,
    setIsoValue,
    updateRenderConfig,
    setParsedData,
    setActiveMolecule,
  } = useMoleculeStore();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const validExtensions = ['.log', '.out', '.txt'];
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      setError('请上传 .log, .out 或 .txt 格式的 Gaussian 输出文件');
      return;
    }

    setLoading(true);
    setError(null);
    eventBus.emit('FILE_UPLOADED', { file, name: file.name });

    try {
      const text = await file.text();
      const parser = new GaussianParser(text, file.name);
      const data = parser.parse();
      setParsedData(data);

      if (data.molecules.length >= 2) {
        MoleculeSwitcher.setReactant(data.molecules[0].id);
        MoleculeSwitcher.setProduct(data.molecules[1].id);
      }
    } catch (error) {
      const errorMsg = `文件解析失败: ${error instanceof Error ? error.message : String(error)}`;
      setError(errorMsg);
      eventBus.emit('PARSE_ERROR', { error: errorMsg, file: file.name });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const loadMockData = () => {
    setLoading(true);
    try {
      const mockData = GaussianParser.parseMockData();
      setParsedData(mockData);
      if (mockData.molecules.length >= 2) {
        MoleculeSwitcher.setReactant(mockData.molecules[0].id);
        MoleculeSwitcher.setProduct(mockData.molecules[1].id);
      }
    } catch (error) {
      setError(`加载示例数据失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode: 'single' | 'difference') => {
    setDisplayMode(mode);
    MoleculeSwitcher.setDisplayMode(mode);
  };

  const handleMoleculeSelect = (moleculeId: string, type: MoleculeType) => {
    if (type === 'reactant') {
      MoleculeSwitcher.setReactant(moleculeId);
    } else if (type === 'product') {
      MoleculeSwitcher.setProduct(moleculeId);
    }
    setActiveMolecule(moleculeId);
  };

  const handleExportConfig = () => {
    ConfigExporter.exportToJson();
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await ConfigExporter.importFromJson(file);
      }
    };
    input.click();
  };

  const handleFragmentToggle = (fragmentId: string) => {
    MoleculeSwitcher.toggleFragmentVisibility(fragmentId);
  };

  const activeMolecule = molecules.find((m) => m.id === activeMoleculeId);

  return (
    <div className="w-[280px] h-full bg-gray-100 border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800 mb-1">分子轨道可视化</h1>
        <p className="text-xs text-gray-500">Gaussian 密度差分分析</p>
      </div>

      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-3">文件上传</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-2xl mb-2">📄</div>
          <p className="text-xs text-gray-600">拖拽文件到此处</p>
          <p className="text-xs text-gray-400 mt-1">或点击选择文件</p>
          <p className="text-xs text-gray-400">.log, .out, .txt</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".log,.out,.txt"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
        <button
          onClick={loadMockData}
          className="w-full mt-2 px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          加载乙烷脱氢示例
        </button>
      </div>

      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-3">显示模式</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('single')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              displayMode === 'single'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            单分子
          </button>
          <button
            onClick={() => handleModeChange('difference')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              displayMode === 'difference'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            密度差分
          </button>
        </div>
      </div>

      {molecules.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 mb-3">分子选择</h2>
          {displayMode === 'difference' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">反应物</label>
                <select
                  value={reactantMolecule?.id || ''}
                  onChange={(e) => handleMoleculeSelect(e.target.value, 'reactant')}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-400"
                >
                  <option value="">选择反应物...</option>
                  {molecules.map((mol) => (
                    <option key={mol.id} value={mol.id}>
                      {mol.name} ({mol.molecularFormula})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">产物</label>
                <select
                  value={productMolecule?.id || ''}
                  onChange={(e) => handleMoleculeSelect(e.target.value, 'product')}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-400"
                >
                  <option value="">选择产物...</option>
                  {molecules.map((mol) => (
                    <option key={mol.id} value={mol.id}>
                      {mol.name} ({mol.molecularFormula})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 block mb-1">当前分子</label>
              <select
                value={activeMoleculeId || ''}
                onChange={(e) => setActiveMolecule(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="">选择分子...</option>
                {molecules.map((mol) => (
                  <option key={mol.id} value={mol.id}>
                    {mol.name} ({mol.molecularFormula})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {activeMolecule && activeMolecule.fragments.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 mb-3">分子片段</h2>
          <div className="space-y-2">
            {activeMolecule.fragments.map((fragment) => (
              <label
                key={fragment.id}
                className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={fragment.visible}
                  onChange={() => handleFragmentToggle(fragment.id)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                />
                <span>{fragment.name}</span>
                <span className="text-gray-400">({fragment.atomIds.length} 原子)</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-3">渲染参数</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              网格精度: {GRID_RESOLUTION_CONFIG[renderConfig.gridResolution].steps}³
            </label>
            <select
              value={renderConfig.gridResolution}
              onChange={(e) => setGridResolution(e.target.value as GridResolution)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="coarse">粗糙 (快速)</option>
              <option value="medium">中等</option>
              <option value="fine">精细 (慢速)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              等值面值: {renderConfig.isoValue.toFixed(4)}
            </label>
            <input
              type="range"
              min="0.0005"
              max="0.05"
              step="0.0005"
              value={renderConfig.isoValue}
              onChange={(e) => setIsoValue(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.0005</span>
              <span>0.05</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              透明度: {(renderConfig.opacity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={renderConfig.opacity}
              onChange={(e) => updateRenderConfig({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={renderConfig.showAtoms}
                onChange={(e) => updateRenderConfig({ showAtoms: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              显示原子
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={renderConfig.showBonds}
                onChange={(e) => updateRenderConfig({ showBonds: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              显示键
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={renderConfig.showIsosurface}
                onChange={(e) => updateRenderConfig({ showIsosurface: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              等值面
            </label>
          </div>
        </div>
      </div>

      <div className="p-4 mt-auto">
        <h2 className="text-sm font-medium text-gray-700 mb-3">配置管理</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportConfig}
            className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            导出配置
          </button>
          <button
            onClick={handleImportConfig}
            className="flex-1 px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            导入配置
          </button>
        </div>
      </div>
    </div>
  );
}
