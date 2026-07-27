import { getCoverSrc } from '../utils/cover.js';

let activeBackgroundLayer = 'a';
let getPlayer = () => null;

export let currentTheme = 'light';

document.documentElement.style.setProperty('--dynamic-color-a', '40, 40, 60');
document.documentElement.style.setProperty('--dynamic-color-b', '40, 40, 60');

export function configureThemePlayer(playerGetter) {
  getPlayer = typeof playerGetter === 'function' ? playerGetter : () => null;
}

export function applyDynamicColor(r, g, b, coverSrc) {
  document.documentElement.style.setProperty('--dynamic-color', `${r}, ${g}, ${b}`);

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

  if (!layerA || !layerB) return;

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
