import type { ExportConfig, ViewConfig, RenderConfig, HighlightConfig } from '../../types';
import { useMoleculeStore } from '../../store/useMoleculeStore';
import { eventBus } from '../events/EventBus';

export class ConfigExporter {
  public static exportToJson(filename?: string): void {
    const { getExportConfig } = useMoleculeStore.getState();
    const config = getExportConfig();

    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const defaultFilename = `density-config-${new Date().toISOString().slice(0, 10)}.json`;
    const downloadFilename = filename || defaultFilename;

    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    eventBus.emit('EXPORT_CONFIG', { config });
  }

  public static async importFromJson(file: File): Promise<ExportConfig | null> {
    try {
      const text = await file.text();
      const config = JSON.parse(text) as ExportConfig;

      if (!ConfigExporter.validateConfig(config)) {
        throw new Error('无效的配置文件格式');
      }

      const { applyImportConfig, setError } = useMoleculeStore.getState();
      applyImportConfig(config);
      setError(null);

      return config;
    } catch (error) {
      const { setError } = useMoleculeStore.getState();
      const errorMsg = `配置导入失败: ${error instanceof Error ? error.message : String(error)}`;
      setError(errorMsg);
      return null;
    }
  }

  public static validateConfig(config: unknown): config is ExportConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as Record<string, unknown>;

    if (typeof c.version !== 'string') return false;
    if (typeof c.timestamp !== 'string') return false;
    if (!ConfigExporter.validateViewConfig(c.viewConfig)) return false;
    if (!ConfigExporter.validateRenderConfig(c.renderConfig)) return false;
    if (!ConfigExporter.validateHighlightConfig(c.highlightConfig)) return false;
    if (!Array.isArray(c.moleculeIds)) return false;
    if (typeof c.activeMoleculeId !== 'string') return false;

    return true;
  }

  private static validateViewConfig(config: unknown): config is ViewConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as Record<string, unknown>;

    if (!Array.isArray(c.cameraPosition) || c.cameraPosition.length !== 3) return false;
    if (!Array.isArray(c.cameraTarget) || c.cameraTarget.length !== 3) return false;
    if (!Array.isArray(c.cameraUp) || c.cameraUp.length !== 3) return false;
    if (typeof c.fov !== 'number') return false;

    return true;
  }

  private static validateRenderConfig(config: unknown): config is RenderConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as Record<string, unknown>;

    if (typeof c.isoValue !== 'number') return false;
    if (typeof c.positiveColor !== 'string') return false;
    if (typeof c.negativeColor !== 'string') return false;
    if (typeof c.opacity !== 'number') return false;
    if (typeof c.gridResolution !== 'string') return false;
    if (typeof c.showBonds !== 'boolean') return false;
    if (typeof c.showAtoms !== 'boolean') return false;
    if (typeof c.showIsosurface !== 'boolean') return false;
    if (typeof c.atomStyle !== 'string') return false;
    if (typeof c.atomScale !== 'number') return false;
    if (typeof c.bondRadius !== 'number') return false;

    return true;
  }

  private static validateHighlightConfig(config: unknown): config is HighlightConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as Record<string, unknown>;

    if (typeof c.enabled !== 'boolean') return false;
    if (typeof c.color !== 'string') return false;
    if (typeof c.glowIntensity !== 'number') return false;
    if (!Array.isArray(c.selectedAtomIds)) return false;
    if (!Array.isArray(c.selectedElements)) return false;
    if (!Array.isArray(c.selectedGroups)) return false;

    return true;
  }

  public static generateConfigSummary(config: ExportConfig): string {
    return [
      `配置版本: ${config.version}`,
      `导出时间: ${new Date(config.timestamp).toLocaleString()}`,
      `相机位置: (${config.viewConfig.cameraPosition.map((v) => v.toFixed(2)).join(', ')})`,
      `等值面值: ${config.renderConfig.isoValue.toFixed(4)}`,
      `网格精度: ${config.renderConfig.gridResolution}`,
      `透明度: ${(config.renderConfig.opacity * 100).toFixed(0)}%`,
      `选中原子: ${config.highlightConfig.selectedAtomIds.length} 个`,
      `选中元素: ${config.highlightConfig.selectedElements.join(', ') || '无'}`,
    ].join('\n');
  }

  public static copyConfigToClipboard(): Promise<boolean> {
    const { getExportConfig } = useMoleculeStore.getState();
    const config = getExportConfig();
    const jsonStr = JSON.stringify(config, null, 2);

    return navigator.clipboard
      .writeText(jsonStr)
      .then(() => true)
      .catch(() => false);
  }

  public static pasteConfigFromClipboard(): Promise<ExportConfig | null> {
    return navigator.clipboard
      .readText()
      .then((text) => {
        try {
          const config = JSON.parse(text) as ExportConfig;
          if (!ConfigExporter.validateConfig(config)) {
            return null;
          }
          const { applyImportConfig } = useMoleculeStore.getState();
          applyImportConfig(config);
          return config;
        } catch {
          return null;
        }
      })
      .catch(() => null);
  }
}
