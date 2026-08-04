import { getCoverSrc } from '../utils/cover.js';
import { getColorExtractionSettings, readjustColor } from '../utils/color.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow, Effect, EffectState } from '@tauri-apps/api/window';

let activeBackgroundLayer = 'a';
let getPlayer = () => null;

export let currentTheme = 'light';

document.documentElement.style.setProperty('--dynamic-color-a', '40, 40, 60');
document.documentElement.style.setProperty('--dynamic-color-b', '40, 40, 60');

export function configureThemePlayer(playerGetter) {
  getPlayer = typeof playerGetter === 'function' ? playerGetter : () => null;
}

/**
 * 获取当前取色设置（供外部调用方在 extractDominantColor 时传入 options）
 */
export function getColorOptions() {
  const settings = getColorExtractionSettings();
  if (!settings.enabled) {
    // 取色关闭：使用默认颜色逻辑
    return null;
  }
  return {
    mode: settings.mode,
    intensity: settings.intensity,
    theme: currentTheme === 'light' ? 'light' : 'dark',
  };
}

/**
 * 对当前缓存的动态颜色重新应用取色模式调整
 * 用于设置页调整滑块/开关时实时预览，无需重新提取封面
 */
export function reapplyCurrentColor() {
  const settings = getColorExtractionSettings();
  // 优先使用原始提取颜色（未经过亮度调整），避免反复调整导致亮度叠加
  const rawColorStr = localStorage.getItem('kimo-last-raw-color');
  const cachedColorStr = localStorage.getItem('kimo-last-dynamic-color');
  const sourceColorStr = rawColorStr || cachedColorStr;
  if (!sourceColorStr) return;

  const [r, g, b] = sourceColorStr.split(',').map(Number);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return;

  if (!settings.enabled) {
    // 取色关闭：使用默认颜色
    const def = getDefaultDynamicColor();
    applyDynamicColor(def.r, def.g, def.b, localStorage.getItem('kimo-last-cover-src'));
    return;
  }

  const adjusted = readjustColor(r, g, b, {
    mode: settings.mode,
    intensity: settings.intensity,
    theme: currentTheme === 'light' ? 'light' : 'dark',
  });
  applyDynamicColor(adjusted.r, adjusted.g, adjusted.b, localStorage.getItem('kimo-last-cover-src'));
}

export function applyDynamicColor(r, g, b, coverSrc) {
  document.documentElement.style.setProperty('--dynamic-color', `${r}, ${g}, ${b}`);

  // ⭐ 自定义背景模式下：切歌不覆盖用户背景图（背景 src 由 applyBackgroundStyle 管理），
  // 动态色变量仍正常更新（主题取色不受影响）
  const appContainer = document.querySelector('.app-container');
  const isCustomBg = appContainer?.classList.contains('bg-style-custom') === true;

  const layerA = document.querySelector('.dynamic-bg-layer.layer-a');
  const layerB = document.querySelector('.dynamic-bg-layer.layer-b');
  const backgroundA = document.getElementById('bg-blur-a');
  const backgroundB = document.getElementById('bg-blur-b');
  const finalCoverSrc = coverSrc || getCoverSrc(null);

  try {
    localStorage.setItem('kimo-last-dynamic-color', `${r},${g},${b}`);
    localStorage.setItem('kimo-last-cover-src', finalCoverSrc);
  } catch (error) {
    console.error('Failed to save dynamic color state:', error);
  }

  if (!layerA || !layerB) {
    if (!isCustomBg) {
      if (backgroundA) backgroundA.src = finalCoverSrc;
      if (backgroundB) backgroundB.src = finalCoverSrc;
    }
    return;
  }

  // ⭐ 自定义背景模式：锁定 layerA（用户图所在层）可见、layerB 隐藏，
  // 不执行 A/B 交叉淡入切换——否则切换后 layerA opacity=0，用户背景会消失/显示旧封面
  if (isCustomBg) {
    if (layerA.style.opacity !== '1') layerA.style.opacity = '1';
    if (layerB.style.opacity !== '0') layerB.style.opacity = '0';
    return;
  }

  // ⭐ A/B 双背景图层 1.6s 优雅平滑淡入淡出 (Cross-Fade) 渐变动画 ⭐
  if (activeBackgroundLayer === 'a') {
    if (backgroundB) backgroundB.src = finalCoverSrc;
    document.documentElement.style.setProperty('--dynamic-color-b', `${r}, ${g}, ${b}`);
    layerB.style.opacity = '1';
    activeBackgroundLayer = 'b';
  } else {
    if (backgroundA) backgroundA.src = finalCoverSrc;
    document.documentElement.style.setProperty('--dynamic-color-a', `${r}, ${g}, ${b}`);
    layerB.style.opacity = '0';
    activeBackgroundLayer = 'a';
  }
  // 材质引擎联动（可选，弱耦合）：背景源内容已变化，需重算
  window.__materialEngine?.onBackgroundChanged?.();
}

export function getDefaultDynamicColor() {
  return currentTheme === 'light'
    ? { r: 0, g: 119, b: 182 }
    : { r: 0, g: 180, b: 216 };
}

let getDesktopLyrics = () => null;

export function configureThemeDesktopLyrics(getter) {
  getDesktopLyrics = typeof getter === 'function' ? getter : () => null;
}

export function applyTheme(theme, opacityValue) {
  currentTheme = theme;
  localStorage.setItem('kimo-theme', theme);
  try {
    getDesktopLyrics()?.updateStyle();
  } catch (_) {}

  const overlay = document.getElementById('dynamic-overlay');
  const container = document.querySelector('.app-container');
  const button = document.getElementById('theme-toggle');

  let opacity = opacityValue;
  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  if (!isCustom) {
    opacity = theme === 'light' ? '0.72' : '0.62';
  } else if (opacity === null || opacity === undefined) {
    opacity = localStorage.getItem('kimo-overlay-opacity') || (theme === 'light' ? '0.72' : '0.62');
  }

  localStorage.setItem('kimo-overlay-opacity', opacity);
  document.documentElement.style.setProperty('--overlay-opacity', opacity);

  const player = getPlayer();
  if (!player || player.currentIndex === -1) {
    const defaultColor = theme === 'light' ? '0, 119, 182' : '0, 180, 216';
    document.documentElement.style.setProperty('--dynamic-color', defaultColor);
  }

  if (theme === 'light') {
    if (overlay) overlay.className = 'dynamic-overlay light';
    if (container) {
      container.classList.remove('theme-dark', 'theme-grey');
      container.classList.add('theme-light');
    }
    document.body.classList.remove('theme-dark', 'theme-grey');
    document.body.classList.add('theme-light');
    if (button) {
      button.title = '当前主题：浅色遮罩';
      button.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>`;
    }
  } else if (theme === 'grey') {
    if (overlay) overlay.className = 'dynamic-overlay grey';
    if (container) {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light', 'theme-grey');
    }
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light', 'theme-grey');
    if (button) {
      button.title = '当前主题：雅致灰色';
      button.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20Z" fill="currentColor"/></svg>`;
    }
  } else {
    if (overlay) overlay.className = 'dynamic-overlay dark';
    if (container) {
      container.classList.remove('theme-light', 'theme-grey');
      container.classList.add('theme-dark');
    }
    document.body.classList.remove('theme-light', 'theme-grey');
    document.body.classList.add('theme-dark');
    if (button) {
      button.title = '当前主题：深色遮罩';
      button.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
  }

  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) themeSelect.value = theme;

  const opacitySlider = document.getElementById('settings-slider-opacity');
  if (opacitySlider) {
    const percentage = Math.round(parseFloat(opacity) * 100);
    opacitySlider.value = percentage;
    const valueDisplay = document.getElementById('settings-opacity-val');
    if (valueDisplay) valueDisplay.textContent = `${percentage}%`;
  }
}

export function cycleTheme() {
  let nextTheme = 'light';
  if (currentTheme === 'light') nextTheme = 'grey';
  else if (currentTheme === 'grey') nextTheme = 'dark';

  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  const savedOpacity = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
  applyTheme(nextTheme, savedOpacity);
}

export function applyUiStyle(uiStyle) {
  const container = document.querySelector('.app-container');

  // 移除所有 UI 风格类（同时加在 app-container 和 body 上，确保 body 级元素如 toast 也能生效）
  container?.classList.remove('ui-style-acrylic', 'ui-style-gaussian', 'ui-style-liquid', 'ui-style-solid');
  document.body.classList.remove('ui-style-acrylic', 'ui-style-gaussian', 'ui-style-liquid', 'ui-style-solid');

  // 添加当前风格类
  if (uiStyle) {
    container?.classList.add(`ui-style-${uiStyle}`);
    document.body.classList.add(`ui-style-${uiStyle}`);
  }

  localStorage.setItem('kimo-ui-style', uiStyle);
}

/**
 * 背景遮罩模糊应用：设置 --bg-custom-blur CSS 变量（由 .bg-mask-layer 消费）。
 * 背景图保持高清直出（不再直设 img filter），模糊由遮罩层 backdrop-filter 承担。
 */
export function applyCustomBgBlur(blurPx) {
  const v = Number.isFinite(blurPx) ? Math.max(0, Math.min(200, blurPx)) : 0;
  document.documentElement.style.setProperty('--bg-custom-blur', `${v}px`);
  // 清除历史遗留的内联 filter（旧版直设过 img filter，需清掉否则覆盖高清规则）
  const img = document.getElementById('bg-blur-a');
  if (img) img.style.removeProperty('filter');
}

/**
 * 窗口透明度：作用于整个窗口（壁纸 + 全部 UI 一起透明），与背景设置无关。
 * 透明度 < 100% 时 html/body 也需透明（透出桌面而非深色底），= 100% 时移除。
 */
export function applyWindowOpacity(percent) {
  // 下限 5%：保证界面保底可见可操作（透出桌面可达 95%，视觉接近全透明）
  const v = Number.isFinite(percent) ? Math.max(5, Math.min(100, percent)) / 100 : 1;
  document.documentElement.style.setProperty('--window-opacity', String(v));
  // 背景透明状态统一管理（透明度 < 100 或材质开启时透明）
  syncBgTransparent();
}

/**
 * 窗口材质（Windows 系统级底座）：DWM 实时模糊窗口后的真实内容（无自反馈）。
 * - none   → 无材质（clearEffects）
 * - acrylic → 亚克力（Windows 10/11）
 * - mica   → 云母（Windows 11）
 * - blur   → 模糊（Windows 7/10/11 22H1+）
 */
export async function applyWindowMaterial(material) {
  try {
    const win = getCurrentWindow();
    if (!material || material === 'none') {
      await win.clearEffects();
      document.documentElement.removeAttribute('data-window-material');
      syncBgTransparent();
      return;
    }
    const effect = material === 'mica' ? Effect.Mica
      : material === 'blur' ? Effect.Blur
      : Effect.Acrylic;
    // Effects 结构：effects 为 Effect 字符串数组，state 在顶层（macOS only）
    await win.setEffects({ effects: [effect], state: EffectState.Active });
    // 材质标记：CSS 据此降低表面背景透明度，让系统材质透过表面可见
    document.documentElement.setAttribute('data-window-material', material);
    syncBgTransparent();
  } catch (err) {
    console.error('[Material] apply window material failed:', err);
    // 失败时同步清理标记，避免表面残留半透明而窗口无系统材质
    document.documentElement.removeAttribute('data-window-material');
    syncBgTransparent();
  }
}

/**
 * 背景透明状态统一管理：材质非 none 或窗口透明度 < 100% 时设置 data-bg-transparent
 * （背景层透明化，露出系统材质/桌面）；否则移除。
 */
export function syncBgTransparent() {
  const material = localStorage.getItem('kimo-window-material') || 'none';
  const opacity = parseFloat(localStorage.getItem('kimo-window-opacity') || '100');
  const transparent = material !== 'none' || (Number.isFinite(opacity) && opacity < 100);
  const container = document.querySelector('.app-container');
  if (transparent) {
    document.documentElement.setAttribute('data-bg-transparent', 'true');
    container?.setAttribute('data-bg-transparent', 'true');
  } else {
    document.documentElement.removeAttribute('data-bg-transparent');
    container?.removeAttribute('data-bg-transparent');
  }
}

export function applyBackgroundStyle(bgStyle) {
  const container = document.querySelector('.app-container');
  if (!container) return;

  // 移除所有背景样式类
  container.classList.remove('bg-style-none', 'bg-style-static', 'bg-style-dynamic', 'bg-style-custom');

  // 读取百分比速率并转换为持续时长：100% → 10s, 50% → 20s, 10% → 100s
  const rotatePct = parseFloat(localStorage.getItem('kimo-bg-rotate-speed')) || 50;
  const rotateDuration = Math.round(1000 / rotatePct);
  document.documentElement.style.setProperty('--bg-rotate-duration', `${rotateDuration}s`);

  if (bgStyle === 'dynamic') {
    document.documentElement.style.setProperty('--bg-rotate-play-state', 'running');
  } else {
    document.documentElement.style.setProperty('--bg-rotate-play-state', 'paused');
  }

  if (bgStyle === 'custom') {
    // 标记到 <html>：custom 模式下的背景层状态由 html[data-bg-custom] 规则
    // 一锤定音（特异性 0,5,1 压过 ui-styles 的任何规则），UI 风格彻底无法影响遮罩
    document.documentElement.setAttribute('data-bg-custom', 'true');
    // 自定义背景：遮罩开关（默认关闭 = 图片原样直出，无视模糊/UI 风格）
    const maskOff = localStorage.getItem('kimo-bg-mask-enabled') !== 'true';
    if (maskOff) {
      document.documentElement.setAttribute('data-bg-mask-off', 'true');
    } else {
      document.documentElement.removeAttribute('data-bg-mask-off');
    }
    // 自定义背景：应用模糊变量，并挂载用户图片到背景图层
    // 强制 layerA（用户图所在层）可见、layerB 隐藏，防止此前 A/B 切换残留 opacity 0
    const bgLayerA = document.querySelector('.dynamic-bg-layer.layer-a');
    const bgLayerB = document.querySelector('.dynamic-bg-layer.layer-b');
    if (bgLayerA) bgLayerA.style.opacity = '1';
    if (bgLayerB) bgLayerB.style.opacity = '0';
    const blurRaw = parseFloat(localStorage.getItem('kimo-bg-custom-blur'));
    const blur = Number.isFinite(blurRaw) ? Math.max(0, Math.min(200, blurRaw)) : 40;
    document.documentElement.style.setProperty('--bg-custom-blur', `${blur}px`);

    const customPath = localStorage.getItem('kimo-custom-bg-path');
    if (customPath) {
      const img = document.getElementById('bg-blur-a');
      if (img) {
        img.src = convertFileSrc(customPath);
        // 内联直设 filter：blur=0 时绝对清晰（绕开任何 CSS filter 干扰）
        applyCustomBgBlur(blur);
      }
    }
  } else {
    document.documentElement.removeAttribute('data-bg-custom');
    document.documentElement.removeAttribute('data-bg-mask-off');
    // 注意：data-bg-transparent 由 applyWindowOpacity 统一管理，此处不再触碰
    // 退出自定义背景：无条件清除内联 filter（否则 blur(0px) 永久压掉 CSS filter）
    const restoreA = document.getElementById('bg-blur-a');
    const restoreB = document.getElementById('bg-blur-b');
    if (restoreA) restoreA.style.filter = '';
    if (restoreB) restoreB.style.filter = '';
    // 恢复封面模糊图（此前 custom 挂载的用户图会残留）
    const lastCover = localStorage.getItem('kimo-last-cover-src');
    if (lastCover) {
      if (restoreA) restoreA.src = lastCover;
      if (restoreB) restoreB.src = lastCover;
    }
  }

  if (bgStyle) {
    container.classList.add(`bg-style-${bgStyle}`);
  }

  localStorage.setItem('kimo-bg-style', bgStyle);
}

export function applyLyricsTheme(lyricsTheme) {
  const lyricsPanel = document.getElementById('lyrics-panel');
  if (!lyricsPanel) return;

  // 移除之前的歌词主题类
  lyricsPanel.classList.remove('lyrics-theme-light', 'lyrics-theme-dark');

  if (lyricsTheme === 'follow') {
    // 跟随软件主题，不添加额外类
    return;
  }

  // 应用独立的歌词主题
  if (lyricsTheme === 'light') {
    lyricsPanel.classList.add('lyrics-theme-light');
  } else if (lyricsTheme === 'dark') {
    lyricsPanel.classList.add('lyrics-theme-dark');
  }
}

export function initLyricsTheme() {
  const lyricsTheme = localStorage.getItem('kimo-lyrics-theme') || 'follow';
  applyLyricsTheme(lyricsTheme);
}

export function applyAnimationSpeed(mode) {
  const speed = mode || localStorage.getItem('kimo-anim-speed') || 'slow';
  document.documentElement.setAttribute('data-anim-speed', speed);
}
