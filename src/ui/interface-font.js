import { convertFileSrc } from '@tauri-apps/api/core';

const MODE_KEY = 'kimo-interface-font-mode';
const CUSTOM_PATH_KEY = 'kimo-interface-font-path';
const CUSTOM_FAMILY = 'KimoInterfaceCustom';

export const INTERFACE_FONT_PRESETS = [
  {
    value: 'default',
    label: '推荐字体',
    family: `'MiSans', 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif`,
  },
  {
    value: 'system',
    label: '系统默认',
    family: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif`,
  },
  {
    value: 'microsoft-yahei',
    label: '微软雅黑',
    family: `"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif`,
  },
  {
    value: 'simhei',
    label: '黑体',
    family: `SimHei, "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`,
  },
  {
    value: 'serif',
    label: '衬线字体',
    family: `"Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif`,
  },
];

let activeCustomFontFace = null;

function getPreset(mode) {
  return INTERFACE_FONT_PRESETS.find(preset => preset.value === mode) || INTERFACE_FONT_PRESETS[0];
}

function applyFamily(family) {
  document.documentElement.style.setProperty('--font-family', family);
}

export function getStoredInterfaceFont() {
  return {
    mode: localStorage.getItem(MODE_KEY) || 'default',
    customPath: localStorage.getItem(CUSTOM_PATH_KEY) || '',
  };
}

export function getFontFileName(filePath) {
  if (!filePath) return '尚未选择字体文件';
  return filePath.split(/[\\/]/).pop() || filePath;
}

export async function applyInterfaceFont(mode, customPath = '', { persist = true } = {}) {
  if (mode !== 'custom') {
    if (activeCustomFontFace) {
      document.fonts.delete(activeCustomFontFace);
      activeCustomFontFace = null;
    }
    applyFamily(getPreset(mode).family);
    if (persist) localStorage.setItem(MODE_KEY, mode);
    return true;
  }

  if (!customPath) return false;

  const sourceUrl = convertFileSrc(customPath);
  const nextFontFace = new FontFace(CUSTOM_FAMILY, `url(${JSON.stringify(sourceUrl)})`);
  await nextFontFace.load();

  if (activeCustomFontFace) {
    document.fonts.delete(activeCustomFontFace);
  }
  document.fonts.add(nextFontFace);
  activeCustomFontFace = nextFontFace;
  applyFamily(`'${CUSTOM_FAMILY}', system-ui, "Microsoft YaHei UI", sans-serif`);

  if (persist) {
    localStorage.setItem(MODE_KEY, 'custom');
    localStorage.setItem(CUSTOM_PATH_KEY, customPath);
  }
  return true;
}

export async function applyStoredInterfaceFont() {
  const { mode, customPath } = getStoredInterfaceFont();
  try {
    const applied = await applyInterfaceFont(mode, customPath, { persist: false });
    if (!applied) applyFamily(getPreset('default').family);
    return applied;
  } catch (error) {
    console.warn('[InterfaceFont] Failed to load saved font:', error);
    applyFamily(getPreset('default').family);
    return false;
  }
}
