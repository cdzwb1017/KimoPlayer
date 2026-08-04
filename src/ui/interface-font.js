import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const MODE_KEY = 'kimo-interface-font-mode';
const CUSTOM_PATH_KEY = 'kimo-interface-font-path';
const USER_FONTS_KEY = 'kimo-user-fonts';
const CUSTOM_FAMILY = 'KimoInterfaceCustom';

// 旧版 custom 模式遗留 FontFace 句柄（迁移后不再新建，仅用于清理）
let activeCustomFontFace = null;
let activeLyricsCustomFontFace = null;

// ════════════════════════════════════════════════
// 内置字体（随应用分发，不可删除、不可修改）
// ════════════════════════════════════════════════
export const INTERFACE_FONT_PRESETS = [
  {
    value: 'default',
    label: '思源黑体（默认）',
    builtin: true,
    family: `'Source Han Sans CN', 'MiSans', 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif`,
  },
  {
    value: 'microsoft-yahei',
    label: '微软雅黑',
    builtin: true,
    family: `"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif`,
  },
  {
    value: 'simhei',
    label: '黑体',
    builtin: true,
    family: `SimHei, "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`,
  },
  {
    value: 'serif',
    label: '衬线字体',
    builtin: true,
    family: `"Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif`,
  },
];

// ════════════════════════════════════════════════
// 可下载推荐字体（应用内下载到安装目录，下载后自动加入用户字体列表）
// ════════════════════════════════════════════════
export const DOWNLOADABLE_FONTS = [
  {
    name: '思源黑体（默认）',
    description: '默认字体，首次启动自动下载（开源可商用）',
    auto: true,
    files: [
      { url: 'https://github.com/adobe-fonts/source-han-sans/raw/release/SubsetOTF/CN/SourceHanSansCN-Regular.otf', filename: 'SourceHanSansCN-Regular.otf', extract: null },
      { url: 'https://github.com/adobe-fonts/source-han-sans/raw/release/SubsetOTF/CN/SourceHanSansCN-Bold.otf', filename: 'SourceHanSansCN-Bold.otf', extract: null },
    ],
  },
  {
    name: '霞鹜文楷',
    description: '开源楷体，笔画清晰、阅读舒适，适合长文本界面',
    url: 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Regular.ttf',
    filename: 'LXGWWenKai-Regular.ttf',
    extract: null,
  },
  {
    name: '得意黑',
    description: '开源现代黑体，字形简洁有力、辨识度高',
    url: 'https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip',
    filename: 'SmileySans-Oblique.ttf',
    extract: 'SmileySans-Oblique.ttf',
  },
];

// ════════════════════════════════════════════════
// 用户字体注册表（localStorage 持久化，可增删；内置字体不在其中）
// ════════════════════════════════════════════════
export function getUserFonts() {
  try {
    const list = JSON.parse(localStorage.getItem(USER_FONTS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveUserFonts(list) {
  localStorage.setItem(USER_FONTS_KEY, JSON.stringify(list));
}

export function getFontFileName(filePath) {
  if (!filePath) return '尚未选择字体文件';
  return filePath.split(/[\\/]/).pop() || filePath;
}

/** 由路径生成稳定且唯一的 FontFace family（同一路径重启后一致） */
function familyForPath(path) {
  let h = 0;
  for (let i = 0; i < path.length; i++) {
    h = (h * 31 + path.charCodeAt(i)) | 0;
  }
  return `KimoUserFont_${(h >>> 0).toString(36)}`;
}

/** 删除 document.fonts 中指定 family 的 FontFace（兼容带引号的 family 名） */
function deleteFontFaceByFamily(family) {
  for (const ff of [...document.fonts]) {
    const raw = ff.family.replace(/^"|"$/g, '');
    if (raw === family) {
      document.fonts.delete(ff);
    }
  }
}

async function loadFontFace(family, pathOrUrl, { weight = '400' } = {}) {
  const ff = new FontFace(family, `url(${JSON.stringify(pathOrUrl)})`, { weight });
  await ff.load();
  document.fonts.add(ff);
  return ff;
}

/** 添加用户字体：注册 FontFace 并写入注册表（已存在则幂等返回） */
export async function addUserFont(path) {
  const list = getUserFonts();
  const existing = list.find(f => f.path === path);
  if (existing) return existing;
  const family = familyForPath(path);
  const sourceUrl = convertFileSrc(path);
  await loadFontFace(family, sourceUrl);
  const entry = {
    name: getFontFileName(path).replace(/\.[^.]+$/, '') || '自定义字体',
    path,
    family,
  };
  list.push(entry);
  saveUserFonts(list);
  return entry;
}

/** 删除用户字体：注销 FontFace、移除注册表；若正在使用则回退默认 */
export async function removeUserFont(path) {
  const list = getUserFonts();
  const entry = list.find(f => f.path === path);
  if (!entry) return false;
  deleteFontFaceByFamily(entry.family);

  // 先持久化删除结果，再执行回退（回退失败也不留孤儿注册表项）
  saveUserFonts(list.filter(f => f.path !== path));

  const iface = getStoredInterfaceFont();
  if (iface.mode === `user:${path}`) await applyInterfaceFont('default');
  const lyr = getStoredLyricsFont();
  if (lyr.mode === `user:${path}`) await applyLyricsFont('follow');
  const dlyr = getStoredDesktopLyricsFont();
  if (dlyr.mode === `user:${path}`) {
    localStorage.setItem(DESKTOP_MODE_KEY, 'follow');
    localStorage.removeItem(DESKTOP_CUSTOM_PATH_KEY);
  }

  return true;
}

/** 启动时/桌面歌词窗口重新注册全部用户字体（加载失败的文件自动移出列表并回退引用） */
export async function ensureUserFonts() {
  const list = getUserFonts();
  const results = await Promise.all(
    list.map(async entry => {
      try {
        const sourceUrl = convertFileSrc(entry.path);
        // 先清理同 family 的旧 FontFace，避免重复注册累积
        deleteFontFaceByFamily(entry.family);
        await loadFontFace(entry.family, sourceUrl);
        return true;
      } catch (error) {
        console.warn(`[InterfaceFont] 用户字体「${entry.name}」加载失败，已从列表移除：`, error);
        return false;
      }
    }),
  );
  const failed = list.filter((_, i) => !results[i]);
  for (const entry of failed) {
    // 复用删除逻辑：注销 + 移除注册表 + 清理引用它的 mode（避免孤儿 user:path）
    await removeUserFont(entry.path);
  }
}

// ════════════════════════════════════════════════
// 内置字体 FontFace 注册（dev 走 vite public，生产走 resources 资源目录）
// ════════════════════════════════════════════════
let builtinFontsReady = null;
export function ensureBuiltinFonts() {
  if (!builtinFontsReady) builtinFontsReady = registerBuiltinFonts();
  return builtinFontsReady;
}

async function registerBuiltinFonts() {
  const entries = [
    { family: 'Source Han Sans CN', weight: '400', file: 'fonts/SourceHanSansCN-Regular.otf' },
    { family: 'Source Han Sans CN', weight: '700', file: 'fonts/SourceHanSansCN-Bold.otf' },
  ];
  await Promise.all(
    entries.map(async ({ family, weight, file }) => {
      try {
        let url;
        if (import.meta.env.DEV) {
          url = `/${file}`;
        } else {
          const abs = await resolveResource(file);
          url = convertFileSrc(abs);
        }
        await loadFontFace(family, url, { weight });
      } catch (error) {
        console.warn(`[InterfaceFont] 内置字体 ${family}（${weight}）加载失败：`, error);
      }
    }),
  );
}

// ════════════════════════════════════════════════
// 字体选项（下拉列表 = 内置 + 用户字体；歌词/桌面歌词可含"跟随"）
// ════════════════════════════════════════════════
export function getFontOptions(includeFollow = false) {
  const opts = [];
  if (includeFollow) {
    opts.push({ value: 'follow', label: '跟随界面字体', family: 'var(--font-family)' });
  }
  for (const preset of INTERFACE_FONT_PRESETS) {
    opts.push({ value: preset.value, label: preset.label, family: preset.family });
  }
  for (const f of getUserFonts()) {
    opts.push({
      value: `user:${f.path}`,
      label: f.name,
      family: `'${f.family}', system-ui, "Microsoft YaHei UI", sans-serif`,
    });
  }
  return opts;
}

/** 兼容旧导出：静态内置列表（设置页渲染用 getFontOptions 替代） */
export const LYRICS_FONT_PRESETS = [
  { value: 'follow', label: '跟随界面字体', family: 'var(--font-family)' },
  ...INTERFACE_FONT_PRESETS,
];
export const DESKTOP_LYRICS_FONT_PRESETS = [
  { value: 'follow', label: '跟随界面字体', family: 'var(--font-family)' },
  ...INTERFACE_FONT_PRESETS,
];

// ════════════════════════════════════════════════
// 存储键
// ════════════════════════════════════════════════
const LYRICS_MODE_KEY = 'kimo-lyrics-font-mode';
const LYRICS_CUSTOM_PATH_KEY = 'kimo-lyrics-font-path';
const LYRICS_CUSTOM_FAMILY = 'KimoLyricsCustom';
const DESKTOP_MODE_KEY = 'kimo-desktop-lyrics-font-mode';
const DESKTOP_CUSTOM_PATH_KEY = 'kimo-desktop-lyrics-font-path';
const DESKTOP_CUSTOM_FAMILY = 'KimoDesktopLyricsCustom';

export function getStoredInterfaceFont() {
  return {
    mode: localStorage.getItem(MODE_KEY) || 'default',
    customPath: localStorage.getItem(CUSTOM_PATH_KEY) || '',
  };
}

export function getStoredLyricsFont() {
  return {
    mode: localStorage.getItem(LYRICS_MODE_KEY) || 'follow',
    customPath: localStorage.getItem(LYRICS_CUSTOM_PATH_KEY) || '',
  };
}

export function getStoredDesktopLyricsFont() {
  return {
    mode: localStorage.getItem(DESKTOP_MODE_KEY) || 'follow',
    customPath: localStorage.getItem(DESKTOP_CUSTOM_PATH_KEY) || '',
  };
}

function getPreset(mode) {
  return INTERFACE_FONT_PRESETS.find(preset => preset.value === mode) || INTERFACE_FONT_PRESETS[0];
}

function applyFamily(family) {
  document.documentElement.style.setProperty('--font-family', family);
}

function applyLyricsFamily(family) {
  document.documentElement.style.setProperty('--lyrics-font-family', family);
}

/** 应用用户字体（user:path）并返回是否成功 */
async function applyUserFontMode(mode, persist, storeKeys, applyFn) {
  const path = mode.slice(5);
  const entry = getUserFonts().find(f => f.path === path);
  if (!entry) return false;
  try {
    const sourceUrl = convertFileSrc(entry.path);
    // 先清理同 family 旧 FontFace，避免切换时重复注册累积
    deleteFontFaceByFamily(entry.family);
    await loadFontFace(entry.family, sourceUrl);
    applyFn(`'${entry.family}', system-ui, "Microsoft YaHei UI", sans-serif`);
    if (persist) {
      localStorage.setItem(storeKeys.mode, mode);
      localStorage.removeItem(storeKeys.path);
    }
    return true;
  } catch (error) {
    console.warn('[InterfaceFont] 用户字体加载失败：', error);
    return false;
  }
}

/** 兼容旧版 custom 模式：把自定义路径迁移为用户字体并应用 */
async function migrateLegacyCustom(customPath, persist, storeKeys, applyFn) {
  try {
    const entry = await addUserFont(customPath);
    applyFn(`'${entry.family}', system-ui, "Microsoft YaHei UI", sans-serif`);
    if (persist) {
      localStorage.setItem(storeKeys.mode, `user:${customPath}`);
      localStorage.removeItem(storeKeys.path);
    }
    return true;
  } catch (error) {
    console.warn('[InterfaceFont] 旧版自定义字体迁移失败：', error);
    return false;
  }
}

export async function applyInterfaceFont(mode, customPath = '', { persist = true } = {}) {
  // 用户字体（user:path）
  if (mode && mode.startsWith('user:')) {
    const ok = await applyUserFontMode(mode, persist, { mode: MODE_KEY, path: CUSTOM_PATH_KEY }, applyFamily);
    if (ok) applyStoredLyricsFont();
    return ok;
  }
  // 旧版 custom 兼容（迁移为用户字体）
  if (mode === 'custom') {
    if (!customPath) return false;
    const ok = await migrateLegacyCustom(customPath, persist, { mode: MODE_KEY, path: CUSTOM_PATH_KEY }, applyFamily);
    if (ok) applyStoredLyricsFont();
    return ok;
  }

  if (activeCustomFontFace) {
    document.fonts.delete(activeCustomFontFace);
    activeCustomFontFace = null;
  }
  applyFamily(getPreset(mode).family);
  if (persist) localStorage.setItem(MODE_KEY, mode);
  applyStoredLyricsFont();
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

// ════════════════════════════════════════════════
// 歌词页面字体控制
// ════════════════════════════════════════════════
export async function applyLyricsFont(mode, customPath = '', { persist = true } = {}) {
  if (mode === 'follow') {
    if (activeLyricsCustomFontFace) {
      document.fonts.delete(activeLyricsCustomFontFace);
      activeLyricsCustomFontFace = null;
    }
    applyLyricsFamily('var(--font-family)');
    if (persist) localStorage.setItem(LYRICS_MODE_KEY, 'follow');
    return true;
  }
  if (mode && mode.startsWith('user:')) {
    return applyUserFontMode(mode, persist, { mode: LYRICS_MODE_KEY, path: LYRICS_CUSTOM_PATH_KEY }, applyLyricsFamily);
  }
  if (mode === 'custom') {
    if (!customPath) return false;
    return migrateLegacyCustom(customPath, persist, { mode: LYRICS_MODE_KEY, path: LYRICS_CUSTOM_PATH_KEY }, applyLyricsFamily);
  }

  if (activeLyricsCustomFontFace) {
    document.fonts.delete(activeLyricsCustomFontFace);
    activeLyricsCustomFontFace = null;
  }
  const preset = getPreset(mode);
  applyLyricsFamily(preset.family);
  if (persist) localStorage.setItem(LYRICS_MODE_KEY, mode);
  return true;
}

export async function applyStoredLyricsFont() {
  const { mode, customPath } = getStoredLyricsFont();
  try {
    const applied = await applyLyricsFont(mode, customPath, { persist: false });
    if (!applied) applyLyricsFamily('var(--font-family)');
    return applied;
  } catch (error) {
    console.warn('[LyricsFont] Failed to load stored lyrics font:', error);
    applyLyricsFamily('var(--font-family)');
    return false;
  }
}

// ════════════════════════════════════════════════
// 桌面歌词字体解析
// ════════════════════════════════════════════════
export function resolveDesktopLyricsFontFamily(mode, customPath = '') {
  if (mode === 'follow') {
    const interfaceFont = getStoredInterfaceFont();
    if (interfaceFont.mode.startsWith('user:')) {
      const entry = getUserFonts().find(f => f.path === interfaceFont.mode.slice(5));
      if (entry) return `'${entry.family}', system-ui, "Microsoft YaHei UI", sans-serif`;
    }
    if (interfaceFont.mode === 'custom' && interfaceFont.customPath) {
      const entry = getUserFonts().find(f => f.path === interfaceFont.customPath);
      if (entry) return `'${entry.family}', system-ui, "Microsoft YaHei UI", sans-serif`;
    }
    const preset = getPreset(interfaceFont.mode);
    return preset.family;
  }
  if (mode && mode.startsWith('user:')) {
    const entry = getUserFonts().find(f => f.path === mode.slice(5));
    if (entry) return `'${entry.family}', system-ui, "Microsoft YaHei UI", sans-serif`;
  }
  if (mode === 'custom') {
    return `'${DESKTOP_CUSTOM_FAMILY}', system-ui, "Microsoft YaHei UI", sans-serif`;
  }
  const preset = getPreset(mode);
  return preset.family;
}

// ════════════════════════════════════════════════
// 应用内下载推荐字体（进度事件 → 完成后自动加入用户字体列表）
// ════════════════════════════════════════════════
const activeDownloads = new Map(); // filename → { unlisten, done }

/**
 * 下载字体到安装目录并注册。
 * 支持单文件条目（url/filename/extract）或多文件条目（files 数组，串行下载）。
 * @param {object} fontInfo DOWNLOADABLE_FONTS 条目
 * @param {(progress: {downloaded:number,total:number,percent:number}) => void} onProgress
 * @returns {Promise<string|string[]>} 下载后的本地绝对路径（多文件时为数组）
 */
export async function downloadFont(fontInfo, onProgress) {
  const files = fontInfo.files || [{ url: fontInfo.url, filename: fontInfo.filename, extract: fontInfo.extract ?? null }];
  const key = fontInfo.filename || files[0].filename;
  if (activeDownloads.has(key)) return activeDownloads.get(key).promise;

  let unlisten = null;
  const promise = (async () => {
    unlisten = await listen('font-download-progress', event => {
      const payload = event.payload;
      if (payload && files.some(f => f.filename === payload.filename)) {
        onProgress?.({
          downloaded: payload.downloaded,
          total: payload.total,
          percent: payload.percent,
        });
      }
    });
    try {
      const targetPaths = [];
      for (const file of files) {
        const targetPath = await invoke('download_font', {
          url: file.url,
          filename: file.filename,
          extract: file.extract ?? null,
        });
        // 下载完成后自动注册为用户字体（幂等）
        await addUserFont(targetPath);
        targetPaths.push(targetPath);
      }
      return targetPaths.length === 1 ? targetPaths[0] : targetPaths;
    } finally {
      if (unlisten) unlisten();
      activeDownloads.delete(key);
    }
  })();

  activeDownloads.set(key, { promise, key });
  return promise;
}

/**
 * 确保默认字体（思源黑体）已安装：未安装时自动下载（首次启动初始化）。
 * 下载后按内置字体注册（family 'Source Han Sans CN'），不进入用户字体注册表——
 * 默认字体语义为内置字体，不出现在「我的字体」列表、不可删除。
 * @param {{ onProgress?: (p: {downloaded:number,total:number,percent:number}) => void }} options
 * @returns {Promise<boolean>} 本次是否实际执行了下载
 */
const DEFAULT_FONT_READY_KEY = 'kimo-default-font-ready';

export async function ensureDefaultFont({ onProgress } = {}) {
  // dev 模式：public/fonts 由 vite 直接服务（CSS @font-face），无需下载
  if (import.meta.env.DEV) return false;
  const entry = DOWNLOADABLE_FONTS.find(f => f.auto);
  if (!entry) return false;
  if (localStorage.getItem(DEFAULT_FONT_READY_KEY) === 'true') return false;

  const files = entry.files || [{ url: entry.url, filename: entry.filename, extract: entry.extract ?? null }];
  try {
    const paths = [];
    for (const file of files) {
      const targetPath = await invoke('download_font', {
        url: file.url,
        filename: file.filename,
        extract: file.extract ?? null,
      });
      paths.push(targetPath);
    }
    // 按内置字体语义注册（Regular 400 / Bold 700），与 CSS @font-face 同名
    const regular = paths[0];
    const bold = paths[1] || paths[0];
    await loadFontFace('Source Han Sans CN', convertFileSrc(regular), { weight: '400' });
    await loadFontFace('Source Han Sans CN', convertFileSrc(bold), { weight: '700' });
    localStorage.setItem(DEFAULT_FONT_READY_KEY, 'true');
    // 重新应用存储的字体（此时思源黑体已注册可用）
    await applyStoredInterfaceFont();
    return true;
  } catch (error) {
    // 失败不置标记：下次启动重试（Rust 侧幂等，已下载的文件直接复用）
    localStorage.removeItem(DEFAULT_FONT_READY_KEY);
    console.warn('[InterfaceFont] 默认字体下载失败：', error);
    return false;
  }
}

export { CUSTOM_FAMILY, LYRICS_CUSTOM_FAMILY, DESKTOP_CUSTOM_FAMILY };
