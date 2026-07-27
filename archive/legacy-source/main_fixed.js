import './styles.css';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { parseLRC, parseTTML, parseJSONLyrics } from './lyrics.js';
import { getCurrentWindow } from '@tauri-apps/api/window';

// ══ Early Shell Window Controls (Rust-Command Driven) ══
try {
  const bindWindowControls = () => {
    const minimizeBtn = document.getElementById('titlebar-minimize');
    const maximizeBtn = document.getElementById('titlebar-maximize');
    const closeBtn = document.getElementById('titlebar-close');

    console.log('[Window] Initializing Rust Command-driven Custom Controls. Elements:', { minimizeBtn, maximizeBtn, closeBtn });

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        console.log('[Window] Invoke minimize_window');
        invoke('minimize_window').catch(err => console.error('[Window] Minimize failed:', err));
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        console.log('[Window] Invoke toggle_maximize_window');
        invoke('toggle_maximize_window').catch(err => console.error('[Window] Maximize failed:', err));
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('[Window] Invoke close_window');
        invoke('close_window').catch(err => console.error('[Window] Close failed:', err));
      });
    }
  };

  // Foolproof ReadyState Binding Timing Guard
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    bindWindowControls();
  } else {
    document.addEventListener('DOMContentLoaded', bindWindowControls);
  }
} catch (e) {
  console.error('[Window] Failed to register early window controls:', e);
}

// ══ Image Source Helper ══
const getCoverSrc = (coverImage) => {
  if (!coverImage) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23333'/></svg>";
  if (coverImage.startsWith('data:')) return coverImage;
  return convertFileSrc(coverImage);
};

// ══ HSL Color Utility for Saturation and Contrast Boost ══
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function adjustColorSaturationAndContrast(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  // Boost saturation: increase S by 40% and ensure it's at least 60%
  hsl.s = Math.max(60, Math.min(100, hsl.s * 1.4));
  // Ensure lightness is in a good range (not too dark, and especially not too light to maintain readability)
  hsl.l = Math.max(35, Math.min(65, hsl.l));
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

// ══ Color Extraction ══
function extractDominantColor(imgSrc) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 50;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const pr = data[i], pg = data[i+1], pb = data[i+2];
        const brightness = (pr + pg + pb) / 3;
        if (brightness > 30 && brightness < 230) { r += pr; g += pg; b += pb; count++; }
      }
      if (count > 0) { r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count); }
      else { r = 40; g = 40; b = 60; }
      resolve(adjustColorSaturationAndContrast(r, g, b));
    };
    img.onerror = () => resolve({ r: 40, g: 40, b: 60 });
    img.src = imgSrc;
  });
}

let activeBgLayer = 'a';
document.documentElement.style.setProperty('--dynamic-color-a', '40, 40, 60');
document.documentElement.style.setProperty('--dynamic-color-b', '40, 40, 60');

function applyDynamicColor(r, g, b, coverSrc) {
  document.documentElement.style.setProperty('--dynamic-color', `${r}, ${g}, ${b}`);

  const layerA = document.querySelector('.dynamic-bg-layer.layer-a');
  const layerB = document.querySelector('.dynamic-bg-layer.layer-b');
  const bgBlurA = document.getElementById('bg-blur-a');
  const bgBlurB = document.getElementById('bg-blur-b');
  
  const finalCoverSrc = coverSrc || getCoverSrc(null);
  
  try {
    localStorage.setItem('kimo-last-dynamic-color', `${r},${g},${b}`);
    localStorage.setItem('kimo-last-cover-src', finalCoverSrc);
  } catch (e) {
    console.error('Failed to save dynamic color state:', e);
  }
  
  if (layerA && layerB) {
    if (activeBgLayer === 'a') {
      if (bgBlurB) bgBlurB.src = finalCoverSrc;
      document.documentElement.style.setProperty('--dynamic-color-b', `${r}, ${g}, ${b}`);
      layerB.style.opacity = '1';
      activeBgLayer = 'b';
    } else {
      if (bgBlurA) bgBlurA.src = finalCoverSrc;
      document.documentElement.style.setProperty('--dynamic-color-a', `${r}, ${g}, ${b}`);
      layerB.style.opacity = '0';
      activeBgLayer = 'a';
    }
  }
}

let currentTheme = 'light';

function getDefaultDynamicColor() {
  return currentTheme === 'light' ? { r: 0, g: 119, b: 182 } : { r: 0, g: 180, b: 216 };
}

const applyTheme = (theme, opacityValue) => {
  currentTheme = theme;
  localStorage.setItem('kimo-theme', theme);

  const overlay = document.getElementById('dynamic-overlay');
  const container = document.querySelector('.app-container');
  const btn = document.getElementById('theme-toggle');

  // 遮罩透明度
  let op = opacityValue;
  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  if (!isCustom) {
    op = theme === 'light' ? '0.72' : '0.62';
  } else {
    if (op === null || op === undefined) {
      op = localStorage.getItem('kimo-overlay-opacity') || (theme === 'light' ? '0.72' : '0.62');
    }
  }
  localStorage.setItem('kimo-overlay-opacity', op);
  document.documentElement.style.setProperty('--overlay-opacity', op);

  // Apply default dynamic color only if no song is loaded or playing
  if (typeof player === 'undefined' || !player || player.currentIndex === -1) {
    const def = theme === 'light' ? '0, 119, 182' : '0, 180, 216';
    document.documentElement.style.setProperty('--dynamic-color', def);
  }

  if (theme === 'light') {
    if (overlay) overlay.className = 'dynamic-overlay light';
    if (container) {
      container.classList.remove('theme-dark', 'theme-grey');
      container.classList.add('theme-light');
    }
    document.body.classList.remove('theme-dark', 'theme-grey');
    document.body.classList.add('theme-light');
    if (btn) {
      btn.title = '当前主题：浅色遮罩';
      btn.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>`;
    }
  } else if (theme === 'grey') {
    if (overlay) overlay.className = 'dynamic-overlay grey';
    if (container) {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light', 'theme-grey');
    }
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light', 'theme-grey');
    if (btn) {
      btn.title = '当前主题：雅致灰色';
      btn.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20Z" fill="currentColor"/></svg>`;
    }
  } else {
    // theme === 'dark'
    if (overlay) overlay.className = 'dynamic-overlay dark';
    if (container) {
      container.classList.remove('theme-light', 'theme-grey');
      container.classList.add('theme-dark');
    }
    document.body.classList.remove('theme-light', 'theme-grey');
    document.body.classList.add('theme-dark');
    if (btn) {
      btn.title = '当前主题：深色遮罩';
      btn.innerHTML = `<svg class="theme-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
  }

  // 联动更新设置面板中的 UI 控件
  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) themeSelect.value = theme;
  const opacitySlider = document.getElementById('settings-slider-opacity');
  if (opacitySlider) {
    opacitySlider.value = Math.round(parseFloat(op) * 100);
    const valDisplay = document.getElementById('settings-opacity-val');
    if (valDisplay) valDisplay.textContent = `${Math.round(parseFloat(op) * 100)}%`;
  }
};

const cycleTheme = () => {
  let nextTheme = 'light';
  if (currentTheme === 'light') {
    nextTheme = 'grey';
  } else if (currentTheme === 'grey') {
    nextTheme = 'dark';
  } else {
    nextTheme = 'light';
  }
  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  const savedOp = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
  applyTheme(nextTheme, savedOp);
};

// ══ Lyrics Controller ══
class LyricsController {
  constructor(player) {
    this.player = player;
    this.lines = [];
    this.activeIndex = -1;
    this.isVisible = false;
    this.animFrameId = null;
    this.isUserScrolling = false;
    this.isAutoScrolling = false;
    this.currentScrollIndex = -1;
    this._lastViewActiveKey = '';
    this._scrollTimeout = null;
    // ⭐ 缓存 allLines，避免每次querySelectorAll 触发 DOM 树遍历⭐
    this._cachedAllLines = null;

    // Detect manual scroll: clear blur so user can read
    const scrollEl = document.getElementById('lyrics-scroll');
    if (scrollEl) {
      scrollEl.addEventListener('wheel', () => this.onUserScroll(), { passive: true });
      scrollEl.addEventListener('touchmove', () => this.onUserScroll(), { passive: true });
      scrollEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const oldMenu = document.getElementById('kimo-lyrics-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'kimo-lyrics-context-menu';
        menu.className = 'kimo-context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        const menuItemFull = document.createElement('div');
        menuItemFull.className = 'kimo-context-menu-item';
        menuItemFull.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>查看完整歌词文本</span>
        `;
        menuItemFull.addEventListener('click', () => {
          menu.remove();
          this.viewFullLyrics();
        });
        menu.appendChild(menuItemFull);
        document.body.appendChild(menu);

        const clickOut = () => {
          menu.remove();
          document.removeEventListener('click', clickOut);
        };
        setTimeout(() => {
          document.addEventListener('click', clickOut);
        }, 50);
      });
    }

    this.lyricsStaggerMode = localStorage.getItem('kimo-lyrics-stagger-mode') || 'word';
    this.updateStaggerUI();
  }

  aggregateLatinWords(words) {
    if (!words || words.length === 0) return [];
    
    const isLatin = (t) => /^[a-zA-Z\']/.test(t.trim());
    const result = [];
    
    words.forEach((w) => {
      if (result.length === 0) {
        result.push({ ...w });
        return;
      }
      
      const last = result[result.length - 1];
      const lastTextClean = last.text || '';
      const currentTextClean = w.text || '';
      
      const isLastLatin = isLatin(lastTextClean);
      const isCurrentLatin = isLatin(currentTextClean);
      // ⭐ 修复：parseWords 已trim text，必须同时检查spaceAfter/spaceBefore 标记，否到"I "(spaceAfter) + "feel" 会被误合并成 "Ifeel" ⭐
      const hasSpaceBetween = lastTextClean.endsWith(' ') || currentTextClean.startsWith(' ') || w.spaceBefore || last.spaceAfter;
      
      if (isLastLatin && isCurrentLatin && !hasSpaceBetween) {
        last.text += w.text;
        const wDur = w.duration || 0;
        if (w.time !== null && last.time !== null) {
          last.duration = (w.time + wDur) - last.time;
        } else {
          last.duration = (last.duration || 0) + wDur;
        }
        if (w.ruby) {
          last.ruby = (last.ruby || '') + w.ruby;
        }
      } else {
        result.push({ ...w });
      }
    });
    
    return result;
  }

  // ⭐ 借鉴 BetterLyrics：stagger 模式把 syllable 拆成单字符，用 syllable.duration 均分字符时间（avgCharDuration = syllableDur / len）。
  // syllable 文本含空格：空格字符保留为独立char（render 渲染为 textNode），不参与卡拉OK扫光
  splitLatinWordsToChars(words) {
    if (!words || words.length === 0) return [];
    const result = [];
    words.forEach((w) => {
      const text = w.text || '';
      const chars = Array.from(text);
      const n = chars.length;
      if (n === 0) return;
      // syllable.duration 来自 LRC/TTML 解析（下一时间戳 - 当前时间戳）；fallback 用 0.3s
      const wDur = Math.max(0.05, w.duration || 0.3);
      const charDur = wDur / n;
      chars.forEach((ch, ci) => {
        const isSpace = /^\s$/.test(ch);
        result.push({
          time: (w.time || 0) + ci * charDur,
          duration: charDur,
          text: ch,
          isCharLevel: true,
          isSpace,
        });
      });
    });
    return result;
  }

  updateStaggerUI() {
    const btn = document.getElementById('btn-stagger-toggle');
    const label = document.getElementById('lyric-stagger-value');
    if (btn) {
      if (this.lyricsStaggerMode === 'stagger') {
        btn.classList.add('stagger-active');
        btn.title = '当前模式: 字母依次上移 (点击切换为单词整体';
      } else {
        btn.classList.remove('stagger-active');
        btn.title = '当前模式: 单词整体上移 (点击切换为字母依娆?';
      }
    }
    if (label) {
      label.textContent = this.lyricsStaggerMode === 'stagger' ? '字母依次上移' : '单词整体上移';
    }
  }

  toggleStaggerMode() {
    this.lyricsStaggerMode = this.lyricsStaggerMode === 'stagger' ? 'word' : 'stagger';
    localStorage.setItem('kimo-lyrics-stagger-mode', this.lyricsStaggerMode);
    this.updateStaggerUI();
    this.render();
  }

  onUserScroll() {
    this.isUserScrolling = true;
    this.clearBlur();
    // Restore blur after 3s of no manual scrolling
    clearTimeout(this._scrollTimeout);
    this._scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
      const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
      if (this.activeIndex >= 0) {
        this.applyBlur(this.activeIndex, this.currentScrollIndex, allLines);
      }
    }, 3000);
  }

  applyBlur(activeIndices, scrollIdx, allLines) {
    if (!Array.isArray(activeIndices)) {
      activeIndices = activeIndices !== undefined && activeIndices !== null ? [activeIndices] : [];
    }
    if (scrollIdx === undefined || scrollIdx === null) {
      scrollIdx = activeIndices[0] || 0;
    }
    
    allLines.forEach((el, idx) => {
      let newFilter, newOpacity;

      if (activeIndices.includes(idx) || idx === scrollIdx) {
        newFilter = 'blur(0px)';
        newOpacity = '1';
      } else {
        let dActive = 999;
        activeIndices.forEach(aIdx => {
          const dist = Math.abs(idx - aIdx);
          if (dist < dActive) dActive = dist;
        });
        const dScroll = Math.abs(idx - scrollIdx);
        const d = Math.min(dActive, dScroll);
        
        if (idx < scrollIdx) {
          // ⭐ 唱完的过去行：绝对不加模糊滤镜，保持高清晰度锐利外观，只柔和淡出 ⭐
          newFilter = 'none';
          newOpacity = `${Math.max(0.35, 1 - d * 0.15).toFixed(2)}`;
        } else {
          // ⭐ 未来即将演唱行：施加景深模糊以聚焦当前句 ⭐
          const blurPx = Math.min(d * 1.0, 6).toFixed(1);
          newFilter = `blur(${blurPx}px)`;
          newOpacity = `${Math.max(0.2, 1 - d * 0.12).toFixed(2)}`;
        }
      }

      // ⭐ 脏检测：只在值真正变化时才写入style，减少无效合成层更新 ⭐
      if (el._lastFilter !== newFilter) {
        el.style.filter = newFilter;
        el._lastFilter = newFilter;
      }
      if (el._lastOpacity !== newOpacity) {
        el.style.opacity = newOpacity;
        el._lastOpacity = newOpacity;
      }
    });
  }

  clearBlur() {
    // 使用缓存（若已建立），同时清空脏值缓存以确保 applyBlur 可以重新写入
    const lines = this._cachedAllLines || Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
    lines.forEach(el => {
      el.style.filter = 'blur(0px)';
      el.style.opacity = '1';
      // 同步重置脏值缓存，否则 applyBlur 会误判为"无变化而跳过写入
      el._lastFilter = 'blur(0px)';
      el._lastOpacity = '1';
    });
  }

  updateSpacerHeights() {
    const container = document.getElementById('lyrics-scroll');
    if (!container) return;
    const spacers = container.querySelectorAll('.lyrics-spacer');
    if (spacers.length >= 2) {
      const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
      const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) ?? 0.5;
      
      const topSpacerHeight = containerHeight * alignOffset;
      const bottomSpacerHeight = containerHeight * (1 - alignOffset);
      
      spacers[0].style.height = `${topSpacerHeight}px`;
      spacers[1].style.height = `${bottomSpacerHeight}px`;
    }
  }

  realign() {
    this.updateSpacerHeights();
    const container = document.getElementById('lyrics-scroll');
    const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
    // 若未开始播放，默认以第一行(0) 进行物理对齐计算
    const scrollIndex = this.currentScrollIndex >= 0 ? this.currentScrollIndex : 0;
    if (container && allLines && allLines[scrollIndex]) {
      const lineEl = allLines[scrollIndex];
      const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
      const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
      const topSpacerHeight = containerHeight * alignOffset;
      
      container.scrollTop = lineEl.offsetTop - topSpacerHeight;
    }
  }

  resetAlignmentCache() {
    const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
    allLines.forEach(el => {
      el.removeAttribute('data-bg-aligned');
      el.dataset.bgAligned = 'false';
      delete el.rowsData;
      delete el._wordSpans;
      delete el._wordsList;
      delete el._prevFirstRelativeTop;
      delete el._prevLastRelativeTop;
      delete el.dataset.fixedState;
      delete el._lastFilter;
      delete el._lastOpacity;
      
      el.style.removeProperty('--line-width');
      el.querySelectorAll('.lyrics-word').forEach(w => {
        w.style.removeProperty('--line-width');
        w.style.removeProperty('--char-offset');
        w.style.removeProperty('--glow-left-pct');
        w.style.removeProperty('--glow-right-pct');
        w.style.removeProperty('--glow-mid-pct');
        w.style.removeProperty('--char-fill');
        w.removeAttribute('data-row-index');
        delete w.dataset.rowIndex;
        delete w.dataset.fillVal;
        delete w.dataset.liftVal;
        delete w._lastFill;
        delete w._lastPercent;
      });
      el.querySelectorAll('.lyrics-ruby-suffix').forEach(s => {
        s.style.removeProperty('--char-offset');
      });
    });
  }

  _getLineText(line) {
    return line ? (line.isInterlude ? '...' : (line.text || '')) : '';
  }

  // ?� 逐字卡拉OK回退：仅有行级时间戳时，把每行文本切成单字并平均分配时间，驱动字级 --char-fill 扫光 ?�
  _synthesizePerCharWords(line, idx) {
    const text = line.text || '';
    const chars = Array.from(text);
    const n = chars.length;
    if (n === 0) return [];
    const nextLine = this.lines[idx + 1];
    let lineEnd = (line.end && line.end > line.time + 0.05) ? line.end : 0;
    if (!lineEnd) {
      lineEnd = nextLine ? nextLine.time : line.time + 3.0;
    }
    const lineEndClamped = Math.max(lineEnd, line.time + 0.5);
    const lineDur = lineEndClamped - line.time;
    const charDur = lineDur / n;
    line.end = lineEndClamped; // ensure downstream duration calcs see the end
    return chars.map((ch, i) => {
      const isSpace = /^\s$/.test(ch);
      return {
        time: line.time + i * charDur,
        duration: charDur,
        text: ch,
        // ?� 标记为 char-level 路径，并记录空白字符，让 render 据此渲染为可见 textNode 而非 inline-block span（避免空白不可见）🌟
        isCharLevel: true,
        isSpace,
      };
    });
  }

  syncBarSpans(wordSpans, charC, totalChars) {
    // ?� 使用缓存的迷你歌词 span 引用，彻底避免每次 querySelectorAll ?�
    let barWordSpans = this._barWordSpans;
    if (!barWordSpans || barWordSpans.length === 0) {
      barWordSpans = Array.from(document.querySelectorAll('#bar-lyric-text-1 .lyrics-word'));
      this._barWordSpans = barWordSpans;
    }
    if (barWordSpans.length === 0) return;

    for (let i = 0; i < barWordSpans.length; i++) {
      const barSpan = barWordSpans[i];
      if (!barSpan) continue;

      // ⭐ 独立计算迷你歌词每个字的 fill：用与全屏物理引擎一致的 charC 逻辑，保证逐字扫光带始终可解⭐
      let fill;
      if (charC < 0) {
        fill = 0;
      } else if (charC >= totalChars) {
        fill = 100;
      } else {
        const intPart = Math.floor(charC);
        if (i < intPart) fill = 100;
        else if (i > intPart) fill = 0;
        else fill = (charC - intPart) * 100;
      }
      const clamped = Math.max(-10, Math.min(115, fill));
      const charFillVal = `${clamped.toFixed(1)}%`;

      // 仅更鏂?--char-fill（卡拉OK渐变填充），不再每帧触碰 classList / 读取全屏变量
      barSpan.style.setProperty('--char-fill', charFillVal);

      // 注音子结构：用缓存引用，避免每帧 querySelectorAll('span')
      let barSubSpans = barSpan._barSubSpans;
      if (!barSubSpans) {
        barSubSpans = Array.from(barSpan.querySelectorAll('span'));
        barSpan._barSubSpans = barSubSpans;
      }
      if (barSubSpans.length) {
        for (let s = 0; s < barSubSpans.length; s++) {
          barSubSpans[s].style.setProperty('--char-fill', charFillVal);
        }
      }
    }
  }

  updateBarLyrics(activeIdx) {
    const el1 = document.getElementById('bar-lyric-text-1');
    const el2 = document.getElementById('bar-lyric-text-2');
    const transEl1 = document.getElementById('bar-lyric-translation-1');
    const line1 = document.getElementById('bar-lyric-line-1');
    if (!el1) return;

    const cur = this.lines[activeIdx];
    const nxt = this.lines[activeIdx + 1];

    // Fade: instantly hide before swapping content, then fade in new content.
    // Use rAF to trigger the fade-in so we DON'T force a synchronous reflow (which caused line-switch jank).
    if (line1) {
      line1.style.transition = 'none';
      line1.style.opacity = '0';
    }

    // Clone the active line's DOM element from the full lyrics view if available to preserve spans
    const mainLyricLine = document.querySelector(`#lyrics-lines .lyrics-line[data-index="${activeIdx}"]`);
    if (mainLyricLine) {
      el1.innerHTML = '';
      const clonedMain = mainLyricLine.querySelector('.lyrics-main, .lyrics-interlude')?.cloneNode(true);
      if (clonedMain) {
        while (clonedMain.firstChild) {
          el1.appendChild(clonedMain.firstChild);
        }
      } else {
        el1.textContent = this._getLineText(cur);
      }
    } else {
      el1.textContent = this._getLineText(cur);
    }

    // Render translation text for the mini bar (CSS controls visibility based on user setting)
    if (transEl1) {
      transEl1.textContent = (cur && cur.translation) ? cur.translation : '';
    }

    el2.textContent = this._getLineText(nxt);

    // ⭐ Rebuild mini-lyric span cache and set the karaoke class ONCE (avoids per-frame DOM work) ⭐
    this._barWordSpans = Array.from(el1.querySelectorAll('.lyrics-word'));
    this._barWordSpans.forEach(span => {
      span._barSubSpans = null;
      span.classList.add('word-singing');
      span.classList.remove('word-active');
    });

    // Fade in (next animation frame)
    if (line1) {
      requestAnimationFrame(() => {
        line1.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        line1.style.opacity = '1';
      });
    }
  }

  async load(audioPath) {
    this.audioPath = audioPath;
    this.lines = [];
    this.activeIndex = -1;
    this._barWordSpans = null; // 清空迷你歌词缓存，避免引用已失效鐨?DOM
    const linesEl = document.getElementById('lyrics-lines');
    linesEl.innerHTML = '';
    
    const barLyric1 = document.getElementById('bar-lyric-text-1');
    const barLyric2 = document.getElementById('bar-lyric-text-2');
    if (barLyric1) barLyric1.textContent = '';
    if (barLyric2) barLyric2.textContent = '';

    try {
      const result = await invoke('get_lyrics', { audioPath });
      console.log('[Lyrics] type:', result.lyrics_type, 'content length:', result.content.length);

      if (result.lyrics_type === 'none') {
        linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
        if (barLyric1) barLyric1.textContent = '暂无歌词';
        if (barLyric2) barLyric2.textContent = '';
        return;
      }

      if (result.lyrics_type === 'lrc') {
        this.lines = parseLRC(result.content);
      } else if (result.lyrics_type === 'ttml') {
        this.lines = parseTTML(result.content);
      } else if (result.lyrics_type === 'json') {
        this.lines = parseJSONLyrics(result.content);
      }

      if (this.lines.length === 0) {
        linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
        if (barLyric1) barLyric1.textContent = '暂无歌词';
        if (barLyric2) barLyric2.textContent = '';
        return;
      }

      // --- Insert Interlude Lines for long gaps ---
      if (this.lines.length > 0) {
        const newLines = [];
        for (let i = 0; i < this.lines.length; i++) {
           const line = this.lines[i];
           if (i === 0) {
               if (line.time > 8.0) {
                   newLines.push({
                       time: 0,
                       end: line.time - 0.3,
                       isInterlude: true,
                       text: '...'
                   });
               }
           } else {
               const prevLine = this.lines[i-1];
               const prevEnd = prevLine.end || (prevLine.words && prevLine.words.length > 0 ? prevLine.words[prevLine.words.length - 1].time + 1.0 : prevLine.time + 2.0);
               if (line.time - prevEnd > 8.0) {
                   newLines.push({
                       time: prevEnd + 1.0,
                       end: line.time - 0.3,
                       isInterlude: true,
                       text: '...'
                   });
               }
           }
           newLines.push(line);
        }
        this.lines = newLines;
      }

      // console.log('[Lyrics] parsed lines:', this.lines.length);
      // this.lines.forEach((l, i) => console.log(`  [${i}] "${l.text}" | trans: "${l.translation || '-'}" | words: ${l.words ? l.words.length : 0} | interlude: ${!!l.isInterlude}`));

      this.render();
      // Force update of player bar lyrics immediately after loading completes,
      // ensuring the cloned nodes/spans are rendered instantly instead of falling back.
      const currentActive = this.activeIndex >= 0 ? this.activeIndex : 0;
      this.updateBarLyrics(currentActive);
      this.startSync();
    } catch (e) {
      console.error('Lyrics load error:', e);
      linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
      if (barLyric1) barLyric1.textContent = '暂无歌词';
      if (barLyric2) barLyric2.textContent = '';
    }
  }

  render() {
    const container = document.getElementById('lyrics-lines');
    container.innerHTML = '';
    // ⭐ render 时先清缓存，渲染完毕后重寤?⭐
    this._cachedAllLines = null;
    
    // Remove global interlude overlay if it exists
    const oldGlobal = document.getElementById('global-interlude');
    if (oldGlobal) oldGlobal.remove();

    this.lines.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'lyrics-line';
      div.dataset.index = idx;
      
      // ⭐ 对唱角色与背景歌词样式注入⭐
      if (line.isBackground) {
        div.classList.add('is-background-line');
      }
      if (line.role) {
        const cleanRole = line.role.trim().toLowerCase().replace(/\s+/g, '-');
        div.classList.add(`role-${cleanRole}`);
        if (cleanRole.includes('l1') || cleanRole.includes('v1')) div.classList.add('role-l1');
        if (cleanRole.includes('l2') || cleanRole.includes('v2')) div.classList.add('role-l2');
        if (cleanRole.includes('both') || cleanRole.includes('v3') || (cleanRole.includes('l1') && cleanRole.includes('l2')) || (cleanRole.includes('v1') && cleanRole.includes('v2'))) {
          div.classList.add('role-both');
        }
      }
      
      if (line.isInterlude) {
        div.classList.add('is-interlude-line');
      }

      // Main text (with word spans if available)
      const mainDiv = document.createElement('div');

      if (line.isInterlude) {
        mainDiv.className = 'lyrics-interlude';
        for(let j=0; j<3; j++) {
            const dot = document.createElement('span');
            dot.className = 'interlude-dot';
            mainDiv.appendChild(dot);
        }
      } else {
        mainDiv.className = 'lyrics-main';
        // Per-character karaoke fallback: synthesize per-char timing from line-level timestamps
        if (!line.words || line.words.length === 0) {
          line.words = this._synthesizePerCharWords(line, idx);
        }
        if (line.words && line.words.length >= 1) {
          const charWords = [];
          const isLatin = (t) => /^[a-zA-Z\']/.test(t.trim());
          const isWordCJK = (text) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);

          let wordsToRender = line.words;
          if (this.lyricsStaggerMode === 'word') {
            wordsToRender = this.aggregateLatinWords(line.words);
          } else if (this.lyricsStaggerMode === 'stagger') {
            wordsToRender = this.splitLatinWordsToChars(line.words);
          }

          // ⭐ 澶?kanji 注音拆分工具函数 ⭐
          const splitKanjiUnits = (text, ruby) => {
            const units = [];
            for (let i = 0; i < text.length; i++) {
              if (/[\u4e00-\u9faf]/.test(text[i])) {
                if (units.length > 0) {
                  units[units.length - 1].okurigana = text.substring(units[units.length - 1].endIdx, i);
                }
                units.push({ kanji: text[i], okurigana: '', endIdx: i + 1 });
              }
            }
            if (units.length > 0) {
              units[units.length - 1].okurigana = text.substring(units[units.length - 1].endIdx);
            }
            if (units.length > 0 && ruby) {
              const rubyChars = Array.from(ruby);
              for (let i = 0; i < units.length && i < rubyChars.length; i++) {
                units[i].ruby = rubyChars[i];
              }
              if (rubyChars.length > units.length) {
                units[units.length - 1].ruby = rubyChars.slice(units.length - 1).join('');
              }
            }
            return units;
          };

          // ⭐ 构建渲染单元列表：每个单入= { rubyText, mainText, time, duration, isRuby, ... } ⭐
          const renderUnits = [];

          wordsToRender.forEach((w, wi) => {
            // ⭐ 借鉴 BetterLyrics：syllable 文本含空格时，把前导/后继空格拆为 textNode（可见），核心文本为 span ⭐
            const rawText = w.text || '';
            // 前导空格 鈫?textNode
            const leadingMatch = rawText.match(/^(\s+)/);
            if (leadingMatch && wi > 0) {
              mainDiv.appendChild(document.createTextNode(leadingMatch[1]));
            }
            // 后继空格提取
            const trailingMatch = rawText.match(/(\s+)$/)
            const coreText = rawText.replace(/^\s+/, '').replace(/\s+$/, '');
            // 纯空鏍?syllable（stagger 拆出的空鏍?char锛夆啋 textNode，不计入 charWords
            if (coreText.length === 0) {
              if (trailingMatch && wi > 0) {
                mainDiv.appendChild(document.createTextNode(trailingMatch[1]));
              } else if (rawText.length > 0) {
                mainDiv.appendChild(document.createTextNode(rawText));
              }
              return;
            }
            
            const nextWordTime = wi + 1 < wordsToRender.length
              ? wordsToRender[wi + 1].time
              : (line.end && line.end > w.time + 0.05
                  ? line.end 
                  : (this.lines[idx + 1] ? Math.min(w.time + 1.0, this.lines[idx + 1].time) : w.time + 0.5));
            const wordDur = w.duration || Math.max(0.01, nextWordTime - w.time);
            
            // 正常单字/中文/带有注音的汉瀛?英文整体单词
            const cw = {
               time: w.time,
               duration: wordDur,
               topoPos: charWords.length,
               text: coreText
            };
            charWords.push(cw);
            
            const isWordLong = wordDur >= 0.8; // 拉长到0.8s 以上才发入
            
            const span = document.createElement('span');
            span.className = 'lyrics-word';
            if (isWordLong) span.classList.add('long-glow');
            if (w.ruby) {
              // ⭐ 大的 kanji 注音拆分：每个 kanji 独立 ruby 字符 + 自己的 okurigana ⭐
              // 解决 "あの日見た渚" 整个词的 ruby "ひみわたなぎ銇? 全部套在棣?kanji 上方错位 Bug
              const splitKanjiUnits = (text, ruby) => {
                const units = [];
                // 1. 找出所鏈?kanji 位置
                for (let i = 0; i < text.length; i++) {
                  if (/[\u4e00-\u9faf]/.test(text[i])) {
                    if (units.length > 0) {
                      // 给前一个 kanji 分配 okurigana（当前位置到下一个 kanji 之间的字符）
                      units[units.length - 1].okurigana = text.substring(units[units.length - 1].endIdx, i);
                    }
                    units.push({ kanji: text[i], okurigana: '', endIdx: i + 1 });
                  }
                }
                // trailing okurigana
                if (units.length > 0) {
                  units[units.length - 1].okurigana = text.substring(units[units.length - 1].endIdx);
                }
                // 2. 分配 ruby 字符：前 N 个 1:1 分配，剩余归最后 kanji
                if (units.length > 0 && ruby) {
                  const rubyChars = Array.from(ruby);
                  for (let i = 0; i < units.length && i < rubyChars.length; i++) {
                    units[i].ruby = rubyChars[i];
                  }
                  if (rubyChars.length > units.length) {
                    units[units.length - 1].ruby = rubyChars.slice(units.length - 1).join('');
                  }
                }
                return units;
              };
              
              const units = splitKanjiUnits(coreText, w.ruby);
              
              if (units.length > 1) {
                // ⭐ 大的 kanji：每个 kanji 独立 span，注音精确显示在各自汉字上方 ⭐
                // leading okurigana (rare: text starts with non-kanji)
                if (units[0].endIdx > 1) {
                  const leading = coreText.substring(0, units[0].endIdx - 1);
                  if (leading) {
                    mainDiv.appendChild(document.createTextNode(leading));
                  }
                }
                
                units.forEach((unit) => {
                  const subSpan = document.createElement('span');
                  subSpan.className = 'lyrics-word is-ruby-word';
                  
                  const rubyContainer = document.createElement('span');
                  rubyContainer.className = 'lyrics-ruby-container';
                  
                  const rtText = document.createElement('span');
                  rtText.className = 'lyrics-rt-text';
                  rtText.textContent = unit.ruby || '';
                  rubyContainer.appendChild(rtText);
                  
                  const charText = document.createElement('span');
                  charText.className = 'lyrics-char-text';
                  charText.textContent = unit.kanji;
                  rubyContainer.appendChild(charText);
                  
                  rubyContainer.dataset.rubyVal = unit.ruby || '';
                  subSpan.appendChild(rubyContainer);
                  
                  if (unit.okurigana) {
                    const suffixSpan = document.createElement('span');
                    suffixSpan.className = 'lyrics-ruby-suffix';
                    suffixSpan.textContent = unit.okurigana;
                    subSpan.appendChild(suffixSpan);
                  }
                  
                  mainDiv.appendChild(subSpan);
                  
                  // 每个 kanji 独立 charWords 条目（参与物理）
                  charWords.push({
                    time: w.time,
                    duration: wordDur,
                    topoPos: charWords.length,
                    text: unit.kanji
                  });
                });
                
                // 已有 kanji unit，不需默认 span/charWords
                return;
              }
              
              // 单kanji 或无 kanji：原逻辑
              span.classList.add('is-ruby-word');
              const kanjiPart = coreText.match(/^[\u4e00-\u9faf]+/);
              if (kanjiPart) {
                const kanjiText = kanjiPart[0];
                const remainingText = coreText.substring(kanjiText.length);
                const rubyContainer = document.createElement('span');
                rubyContainer.className = 'lyrics-ruby-container';
                const rtText = document.createElement('span');
                rtText.className = 'lyrics-rt-text';
                rtText.textContent = w.ruby;
                rubyContainer.appendChild(rtText);
                const charText = document.createElement('span');
                charText.className = 'lyrics-char-text';
                charText.textContent = kanjiText;
                rubyContainer.appendChild(charText);
                rubyContainer.dataset.rubyVal = w.ruby;
                span.appendChild(rubyContainer);
                if (remainingText) {
                  const suffixSpan = document.createElement('span');
                  suffixSpan.className = 'lyrics-ruby-suffix';
                  suffixSpan.textContent = remainingText;
                  span.appendChild(suffixSpan);
                }
              } else {
                const rubyContainer = document.createElement('span');
                rubyContainer.className = 'lyrics-ruby-container';
                const rtText = document.createElement('span');
                rtText.className = 'lyrics-rt-text';
                rtText.textContent = w.ruby;
                rubyContainer.appendChild(rtText);
                const charText = document.createElement('span');
                charText.className = 'lyrics-char-text';
                charText.textContent = coreText;
                rubyContainer.appendChild(charText);
                span.appendChild(rubyContainer);
              }
            } else {
              span.textContent = coreText;
            }
            
            // Dynamic lift duration based on how long it takes to sing (capped between 0.15s and 0.8s)
            const liftDur = Math.max(0.15, Math.min(0.8, wordDur * 1.5));
            span.style.setProperty('--lift-dur', `${liftDur.toFixed(2)}s`);
            
            mainDiv.appendChild(span);
            // ⭐ 后继空格 鈫?textNode（可见），syllable 文本含空格时由这里提供词间距 ⭐
            if (trailingMatch) {
              mainDiv.appendChild(document.createTextNode(trailingMatch[1]));
            }
          });

          line.charWords = charWords;
        } else {
          mainDiv.textContent = line.text;
        }
      }
      div.appendChild(mainDiv);

      // Translation line
      if (line.translation) {
        const transDiv = document.createElement('div');
        transDiv.className = 'lyrics-translation';
        transDiv.textContent = line.translation;
        div.appendChild(transDiv);
      }

      div.addEventListener('click', () => {
        this.player.audio.currentTime = line.time;
      });
      
      // ⭐ AI 智能单句校准：绑定右閿?contextmenu 快捷入口
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showCalibrationContextMenu(idx, e.clientX, e.clientY);
      });
      
      container.appendChild(div);
    });

    // ⭐ 在 render 结束后，此时所有行的 charWords 均已生成并绑定完成⭐
    // 进行 100% 精准的对唱及发声时间娈?endTime 的校出
    // ⭐ 修复：stagger 拆字母后 charWords 最后字较time+duration 被压缩（最后词 wDur 硬编鐮?0.5），
    //    导致 endTime 偏小、activeIndex 提前跳到下一行。优先用下一行time 作为行边界（最准）銆傪煂?
    this.lines.forEach((line, i) => {
      if (i < this.lines.length - 1) {
        // 有下一行：用下一行time 作为行边鐣?
        line.endTime = Math.min(this.lines[i + 1].time - 0.05, line.time + 6.0);
      } else if (line.charWords && line.charWords.length > 0) {
        // 最后一行（无下一行）：用 charWords 最后字较
        const lastWord = line.charWords[line.charWords.length - 1];
        line.endTime = lastWord.time + lastWord.duration;
      } else {
        line.endTime = line.time + 4.0;
      }
    });
    this.updateSpacerHeights();
  }

  showCalibrationContextMenu(idx, clientX, clientY) {
    const line = this.lines[idx];
    if (!line || line.isInterlude) return;

    // 1. Remove any existing context menus
    const oldMenu = document.getElementById('kimo-lyrics-context-menu');
    if (oldMenu) oldMenu.remove();

    // 2. Create high-end visual frosted-glass context menu card
    const menu = document.createElement('div');
    menu.id = 'kimo-lyrics-context-menu';
    menu.className = 'kimo-context-menu';
    
    // Position menu under cursor
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    // Option 1: AI Calibration
    const menuItemCalibrate = document.createElement('div');
    menuItemCalibrate.className = 'kimo-context-menu-item';
    menuItemCalibrate.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span>鉁?AI 智能校准此句</span>
    `;
    menuItemCalibrate.addEventListener('click', () => {
      menu.remove();
      this.startSingleLineCalibration(idx);
    });
    menu.appendChild(menuItemCalibrate);

    // Option 2: Seek to corresponding line
    const menuItemSeek = document.createElement('div');
    menuItemSeek.className = 'kimo-context-menu-item';
    menuItemSeek.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>跳转到对应句播放</span>
    `;
    menuItemSeek.addEventListener('click', () => {
      menu.remove();
      this.player.audio.currentTime = line.time;
    });
    menu.appendChild(menuItemSeek);

    // Option 3: View Full Lyrics
    const menuItemFull = document.createElement('div');
    menuItemFull.className = 'kimo-context-menu-item';
    menuItemFull.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span>查看完整歌词文本</span>
    `;
    menuItemFull.addEventListener('click', () => {
      menu.remove();
      this.viewFullLyrics();
    });
    menu.appendChild(menuItemFull);

    document.body.appendChild(menu);

    // 3. Clear menu when clicking outside
    const clickOut = () => {
      menu.remove();
      document.removeEventListener('click', clickOut);
    };
    setTimeout(() => {
      document.addEventListener('click', clickOut);
    }, 50);
  }

  viewFullLyrics() {
    const text = this.lines.map(l => l.isInterlude ? '' : l.text).filter(t => t).join('\n');
    
    const modal = document.createElement('div');
    modal.className = 'kimo-modal-overlay';
    modal.id = 'kimo-full-lyrics-modal';
    
    modal.innerHTML = `
      <div class="kimo-modal-card" style="max-width: 500px; width: 90%; display: flex; flex-direction: column;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--glass-border); padding:16px; margin-bottom:4px;">
          <span style="font-size:15px; font-weight:700; color:var(--text-primary);">完整歌词文本</span>
          <button id="full-lyrics-close-btn" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px; border-radius:50%; outline:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div style="flex:1; overflow-y:auto; padding:16px; margin:0 16px 16px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:10px; max-height:50vh; white-space:pre-wrap; font-family:var(--font-family); line-height:1.7; font-size:14.5px; color:var(--text-primary); user-select:text;">${text || '暂无歌词'}</div>
        <div style="display:flex; justify-content:flex-end; gap:12px; padding:0 16px 16px;">
          <button class="kimo-modal-btn secondary" id="full-lyrics-copy-btn" style="padding:10px 16px; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; border:1px solid var(--glass-border); background:rgba(255,255,255,0.05); color:var(--text-primary); display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>复制全部歌词</span>
          </button>
          <button class="kimo-modal-btn primary" id="full-lyrics-ok-btn" style="padding:10px 16px; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; border:none; background:rgb(var(--dynamic-color, 0, 240, 255)); color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.2);">确定</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const close = () => modal.remove();
    modal.querySelector('#full-lyrics-close-btn').addEventListener('click', close);
    modal.querySelector('#full-lyrics-ok-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    
    modal.querySelector('#full-lyrics-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('歌词已成功复制到剪贴板');
      }).catch(() => {
        this.showToast('复制失败');
      });
    });
  }

  async startSingleLineCalibration(idx) {
    const line = this.lines[idx];
    if (!line || !this.audioPath) return;
    this.showCalibrationModal(line, idx);
  }

  showCalibrationModal(line, idx) {
    const oldModal = document.getElementById('kimo-calibration-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'kimo-calibration-modal';
    modal.className = 'kimo-modal-overlay';
    
    modal.innerHTML = `
      <div class="kimo-modal-card">
        <div class="kimo-modal-header">
          <div class="kimo-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px; animation: sparkles-spin 4s linear infinite; color:var(--accent);"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            AI 时间戳单句精密校准对较
          </div>
          <button class="kimo-modal-close" id="kimo-modal-close-btn">&times;</button>
        </div>
        <div class="kimo-modal-body" id="kimo-modal-body-content">
          <div class="kimo-loading-wrapper">
            <div class="kimo-spinner"></div>
            <div class="kimo-loading-text">正在提取发音特征并执行CPU 毫秒级声谱对碰，请稍鍊?..</div>
            <div class="kimo-loading-subtext">鈥?${line.text} 鈥?/div>
          </div>
        </div>
        <div class="kimo-modal-footer" id="kimo-modal-footer-btns" style="display:none;">
          <button class="kimo-modal-btn cancel" id="kimo-btn-discard">放弃修改</button>
          <button class="kimo-modal-btn apply" id="kimo-btn-apply">应用校准</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#kimo-modal-close-btn');
    closeBtn.addEventListener('click', () => {
      const overlay = modal.closest('.kimo-modal-overlay');
      const card = modal.closest('.kimo-modal-card');
      if (overlay) overlay.style.opacity = '0';
      if (card) { card.style.opacity = '0'; card.style.transform = 'scale(0.9) translateY(20px)'; }
      setTimeout(() => modal.remove(), 200);
    });

    this.runSingleLineAlignment(line, idx, modal);
  }

  async runSingleLineAlignment(line, idx, modalEl) {
    const bodyContent = modalEl.querySelector('#kimo-modal-body-content');
    const footerBtns = modalEl.querySelector('#kimo-modal-footer-btns');

    try {
      const nextLine = this.lines[idx + 1];
      const endTime = line.endTime || (nextLine ? nextLine.time : line.time + 4.0);

      const { invoke } = window.__TAURI__.core;
      
      const serverUrl = localStorage.getItem('kimo-ai-server-url') || 'http://127.0.0.1:8000';
      const responseStr = await invoke('ai_align_single_line', {
        audioPath: this.audioPath,
        text: line.text,
        startTime: line.time,
        endTime: endTime,
        serverUrl: serverUrl
      });

      const result = JSON.parse(responseStr);
      if (!result.success || !result.syllables) {
        throw new Error("后端校准未能生成对齐字词数据");
      }

      const aiSyllables = result.syllables;
      this.renderDiffContent(line, aiSyllables, bodyContent, footerBtns, modalEl, idx);

    } catch (err) {
      console.error("[AI Alignment Error]", err);
      bodyContent.innerHTML = `
        <div style="text-align:center; padding: 30px; color:var(--system-red);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:10px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <div style="font-weight:600; font-size:16px;">AI 单句精密校准失败</div>
          <div style="font-size:12px; margin-top:8px; opacity:0.8;">错误原因: ${err.message || err}</div>
        </div>
      `;
    }
  }

  renderDiffContent(line, aiSyllables, bodyEl, footerEl, modalEl, idx) {
    const formatTime = (secs) => {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      const ms = Math.floor((secs % 1) * 1000).toString().padStart(3, '0').substring(0, 3);
      return `${m}:${s}.${ms}`;
    };

    bodyEl.innerHTML = '';
    
    const previewHeader = document.createElement('div');
    previewHeader.className = 'kimo-diff-preview-header';
    previewHeader.innerHTML = `
      <div class="kimo-diff-text-title">鈥?${line.text} 鈥?/div>
      <div class="kimo-diff-sub-desc">已为您完成发音波形对碰，检测并微调了以下时间戳偏差）。/div>
    `;
    bodyEl.appendChild(previewHeader);

    const table = document.createElement('div');
    table.className = 'kimo-diff-table';

    const tHeader = document.createElement('div');
    tHeader.className = 'kimo-diff-row header';
    tHeader.innerHTML = `
      <span class="col-char">字词</span>
      <span class="col-orig">原始时间我/span>
      <span class="col-arrow"></span>
      <span class="col-new">AI 校准后/span>
      <span class="col-delta">偏差微调</span>
    `;
    table.appendChild(tHeader);

    const oldWords = line.words || [];

    aiSyllables.forEach((item, charIdx) => {
      const origItem = oldWords[charIdx];
      const origTimeStr = origItem ? formatTime(origItem.time) : '未字对齐';
      const newTimeStr = formatTime(item.time);

      let deltaStr = '新字对齐';
      let deltaClass = 'new-aligned';

      if (origItem) {
        const delta = item.time - origItem.time;
        const deltaMs = Math.round(delta * 1000);
        if (Math.abs(deltaMs) < 5) {
          deltaStr = '完美吻合';
          deltaClass = 'perfect';
        } else if (deltaMs > 0) {
          deltaStr = `+${deltaMs}ms (延后)`;
          deltaClass = 'delay';
        } else {
          deltaStr = `${deltaMs}ms (提前)`;
          deltaClass = 'early';
        }
      }

      const row = document.createElement('div');
      row.className = 'kimo-diff-row';
      row.innerHTML = `
        <span class="col-char">${item.text}</span>
        <span class="col-orig">${origTimeStr}</span>
        <span class="col-arrow">鉃?/span>
        <span class="col-new">${newTimeStr}</span>
        <span class="col-delta ${deltaClass}">${deltaStr}</span>
      `;
      table.appendChild(row);
    });

    bodyEl.appendChild(table);

    footerEl.style.display = 'flex';

    const discardBtn = modalEl.querySelector('#kimo-btn-discard');
    discardBtn.addEventListener('click', () => modalEl.remove());

    const applyBtn = modalEl.querySelector('#kimo-btn-apply');
    applyBtn.addEventListener('click', () => {
      if (aiSyllables.length > 0) {
        line.time = aiSyllables[0].time;
      }
      line.words = aiSyllables;
      line.isWordTimed = true;

      this.render();
      this.saveLyricsCache();

      modalEl.remove();
      this.showToast('AI 时间戳校准已成功应用并持久化');
    });
  }

  saveLyricsCache() {
    if (!this.audioPath) return;
    try {
      const { invoke } = window.__TAURI__.core;
      const exportLines = this.lines
        .filter(l => !l.isInterlude)
        .map(l => ({
          time: l.time,
          text: l.text,
          translation: l.translation || null,
          end: l.endTime || null,
          syllables: (l.words || []).map(w => ({
            time: w.time,
            duration: w.duration || null,
            text: w.text
          }))
        }));

      const payload = {
        success: true,
        lyrics: exportLines
      };

      invoke('save_lyrics_cache', { 
        audioPath: this.audioPath, 
        jsonContent: JSON.stringify(payload, null, 2) 
      }).catch(e => console.error("[Save Cache Failed]", e));

    } catch (e) {
      console.error("[Lyrics Cache Save Error]", e);
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'kimo-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  updateVisualizer() {
    const visEl = document.getElementById('lyrics-visualizer');
    if (!visEl) return;

    const paused = this.player.audio.paused;
    if (paused) {
      visEl.classList.remove('playing');
      return;
    }

    visEl.classList.add('playing');

    const bars = visEl.querySelectorAll('.visualizer-bar');
    if (!bars.length) return;

    // ⭐ Lazy-initialize the Real Web Audio API context & nodes on first playing tick!
    if (!this.audioContext) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        // Ensure audioElement has CORS enabled
        this.player.audio.crossOrigin = "anonymous";

        // Connect media node
        this.audioSource = this.audioContext.createMediaElementSource(this.player.audio);
        this.analyser = this.audioContext.createAnalyser();
        
        // fftSize of 64 yields 32 frequency bins, ideal for our 24 visualizer bars!
        this.analyser.fftSize = 64; 
        this.analyser.smoothingTimeConstant = 0.75; // Sleek transition smoothing

        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      } catch (err) {
        console.warn("[LyricsVisualizer] Web Audio API initialization blocked or failed, using simulated high-fidelity waves:", err);
        this.audioContext = null;
      }
    }

    // Automatically resume AudioContext if browser state gets suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Try reading genuine frequency amplitude data
    let realDataAvailable = false;
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Compute data energy sum to verify it's not all zeros (CORS or silent state)
      let energy = 0;
      for (let i = 0; i < 24; i++) {
        energy += this.dataArray[i] || 0;
      }
      if (energy > 0) {
        realDataAvailable = true;
      }
    }

    // Initialize visualizer heights cache for frame-to-frame physics smoothing
    if (!this.visualizerHeights) {
      this.visualizerHeights = new Float32Array(24);
      this.visualizerHeights.fill(4); // Start at minimum height
    }

    const time = performance.now() / 1000;
    
    // ⭐ SMOOTH VOLUME ISOLATION
    // We isolate volume impact so that even at late-night low listening volumes, the visualizer still 
    // maintains a highly visible 60% active movement range, rather than shrinking completely flat.
    const volume = this.player.audio.volume !== undefined ? this.player.audio.volume : 0.8;
    const volMod = 0.6 + 0.4 * volume;

    bars.forEach((bar, idx) => {
      let amp = 0;

      if (realDataAvailable) {
        // Read actual volume amplitude from frequency bin [0 - 255]
        const rawAmp = this.dataArray[idx] || 0;
        amp = rawAmp / 255;

        // ⭐ GOLDEN-RATIO EXPONENTIAL AUDIO GAIN (AGC Calibrated)
        // Adjusted multipliers to achieve the perfect balance between high-amplitude waves 
        // and deep dynamic contrast. By reducing bass/mid/treble gains from the hyper-aggressive values, 
        // bars will no longer constantly pack at the top, unlocking dramatic hills, deep valleys, 
        // and highly satisfying wavelike motion!
        let gain = 1.15;
        if (idx > 16) {
          gain = 2.1; // Highly detailed responsive treble details without saturation
        } else if (idx > 6) {
          gain = 1.6; // Organic mid vocal frequency range representation
        } else {
          gain = 1.15; // Grounded solid deep bass punch dynamics
        }
        
        amp = 1.0 - Math.exp(-amp * gain);
      } else {
        // FALLBACK: Highly-tuned smart wave equations when real audio node is silent/blocked
        let wave = 0;
        if (idx < 6) {
          wave = Math.sin(time * 3.5 + idx * 0.8) * 0.45 
               + Math.cos(time * 8.2 - idx * 1.2) * 0.35
               + Math.sin(time * 22.0 + idx) * 0.2;
        } else if (idx < 18) {
          wave = Math.sin(time * 6.8 - idx * 0.5) * 0.4
               + Math.cos(time * 14.5 + idx * 0.9) * 0.35
               + Math.sin(time * 35.0 - idx) * 0.25;
        } else {
          wave = Math.sin(time * 12.0 + idx * 1.5) * 0.3
               + Math.cos(time * 28.0 - idx * 2.2) * 0.45
               + Math.sin(time * 58.0 + idx) * 0.25;
        }
        amp = Math.abs(wave);

        // Apply fallback rhythm pulse punch (approx. 132 BPM heartbeat sync)
        const currentTime = this.player.audio.currentTime;
        const beatProgress = (currentTime * 2.2) % 1.0;
        const punch = 1.2 + 0.4 * Math.exp(-Math.pow(beatProgress - 0.1, 2) * 20);
        amp *= punch;
        amp = Math.min(1.0, amp);
      }

      // Compute physical pixel heights (resting 4px, peak 54px for majestic 14x dynamic range!)
      const minHeight = 4;
      const maxHeight = 54;
      const targetHeight = minHeight + amp * (maxHeight - minHeight) * volMod;

      // ⭐ MAXIMUM DYNAMICS PHYSICS ENGINE (Attack & Decay)
      // Speed up Attack to instantly catch explosive beats, speed up Decay to dive deep, 
      // generating MASSIVE visually satisfying height differences!
      const currentH = this.visualizerHeights[idx] || minHeight;
      let nextH = currentH;

      if (targetHeight > currentH) {
        // Attack phase: Fast, explosive lightning-quick spring upwards (92% follow rate)
        nextH = currentH + (targetHeight - currentH) * 0.92;
      } else {
        // Decay phase: Slightly swifter drop to create large dramatic height differences (22% fall rate)
        nextH = currentH - (currentH - targetHeight) * 0.22;
      }

      // Apply soft lower boundary clamp
      nextH = Math.max(minHeight, nextH);

      this.visualizerHeights[idx] = nextH;
      bar.style.height = `${nextH.toFixed(1)}px`;
    });
  }

  startSync() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    
    let extrapolatedTime = this.player.audio.currentTime;
    let lastSysTime = performance.now();
    let lastAudioTime = extrapolatedTime;

    const tick = (now) => {
      const audioTime = this.player.audio.currentTime;
      const dt = (now - lastSysTime) / 1000;
      lastSysTime = now;

      if (!this.player.audio.paused && !this.player.audio.seeking) {
        // Move time forward smoothly
        extrapolatedTime += dt;

        // When the browser's audio time updates, gently correct our extrapolated time
        if (audioTime !== lastAudioTime) {
          const diff = audioTime - extrapolatedTime;
          if (Math.abs(diff) > 0.15) {
            extrapolatedTime = audioTime;
          } else {
            // Apply a rapid correction towards the true audio time for high-speed tracking
            extrapolatedTime += diff * 0.45;
          }
          lastAudioTime = audioTime;
        }
      } else {
        extrapolatedTime = audioTime;
        lastAudioTime = audioTime;
      }

      this.syncToTime(extrapolatedTime);
      if (this.isVisible) {
        this.updateVisualizer();
      }
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  stopSync() {
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
  }

  syncToTime(rawCurrentTime) {
    if (!this.lines.length) return;
    
    const timeOffset = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
    const currentTime = rawCurrentTime + timeOffset;
    const liftAmp = parseFloat(localStorage.getItem('kimo-lyrics-lift-amplitude')) ?? 4.0;

    // Helper: Determine if two lyric lines have actual overlapping active timeline boundaries
    const isOverlappingInTime = (lineA, lineB) => {
      if (!lineA || !lineB) return false;
      const getEnd = (l) => l.endTime || (l.words && l.words.length > 0 ? l.words[l.words.length - 1].time + 0.5 : l.time + 3.0);
      return (lineA.time < getEnd(lineB)) && (lineB.time < getEnd(lineA));
    };

    // ⭐ 计算物理帧时间差 dt，用于高精度动力学速度上限限制 ⭐
    const dt = this._prevPhysicsTime !== undefined ? Math.max(0.001, Math.min(0.08, currentTime - this._prevPhysicsTime)) : 0.016;
    this._prevPhysicsTime = currentTime;

    // 1. Calculate activeIndices & activeIndex (Support multiple overlapping active lines)
    // ⭐ 借鉴 BetterLyrics：LaneIndex 分轨 + 主唱行LaneIndex==0)优先 ⭐
    const activeIndices = [];
    let activeIndex = -1; // 主唱行（LaneIndex==0 中最晚开始的）。
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      // 处于演唱发声时间轴内（带 0.2s 提前预热入场，以可0.4s 温存出场）。
      if (currentTime >= line.time - 0.2 && currentTime <= line.endTime + 0.4) {
        activeIndices.push(i);
      }
    }

    // ⭐ CalculateLanes：贪心分轨，重叠行分到不后LaneIndex（BetterLyrics 风格）。
    // 同一时间在唱的行中，LaneIndex==0 为主唱行（最先开始的），其余为背景和澹?
    const laneEndTimes = []; // laneEndTimes[lane] = 该轨道最后行鐨?endTime
    for (const idx of activeIndices) {
      const line = this.lines[idx];
      let assignedLane = -1;
      for (let l = 0; l < laneEndTimes.length; l++) {
        // 容差 0.05s：行开始时闭>= 该轨道上一行结束时闭- 0.05 才能复用
        if (line.time >= laneEndTimes[l] - 0.05) {
          assignedLane = l;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = laneEndTimes.length;
        laneEndTimes.push(line.endTime);
      } else {
        laneEndTimes[assignedLane] = line.endTime;
      }
      line.laneIndex = assignedLane;
    }

    // ⭐ GetCurrentLineIndex：主唱行优先（LaneIndex==0），重叠时最灏?lane 优先（BetterLyrics 风格）。
    // 主唱行 = activeIndices 中 LaneIndex==0 且 currentTime >= line.time 的最晚行
    let primaryIdx = -1;
    let primaryTime = -Infinity;
    for (const idx of activeIndices) {
      const line = this.lines[idx];
      if (currentTime >= line.time && line.laneIndex === 0 && line.time > primaryTime) {
        primaryTime = line.time;
        primaryIdx = idx;
      }
    }
    // 兜底：若没有 LaneIndex==0 且 currentTime>=time 的行，取 activeIndices 第一个
    if (primaryIdx === -1 && activeIndices.length > 0) {
      primaryIdx = activeIndices[0];
    }
    activeIndex = primaryIdx;

    // 保底：如果当前没有多句重叠在唱，到activeIndices 兜底放入单主活跃行
    if (activeIndices.length === 0 && activeIndex >= 0) {
      activeIndices.push(activeIndex);
    }

    // 2. Calculate scrollIndex (anticipated time for vertical scroll)
    // ⭐ 借鉴 BetterLyrics：滚动目标 = 主唱行居中，非主唱重叠行不滚动⭐
    // scrollIndex 跟随主唱行（activeIndex）；主唱行未开始时用预滚动（time - 0.4）。
    let scrollIndex = -1;
    if (activeIndex >= 0) {
      scrollIndex = activeIndex;
    } else {
      // 无主唱行时：预滚动到下一个即将开始的行
      for (let i = 0; i < this.lines.length; i++) {
        const triggerTime = this.lines[i].time - 0.4;
        if (currentTime >= triggerTime) {
          scrollIndex = i;
        } else {
          break;
        }
      }
    }

    // ⭐ 使用缓存，避免每帧遍历DOM 树（querySelectorAll 在歌词行多时开销显著）。
    if (!this._cachedAllLines) {
      this._cachedAllLines = Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
    }
    const allLines = this._cachedAllLines;
    const container = document.getElementById('lyrics-scroll');

    // Calculate view-active overlapping lines (within scroll anticipation and fade-out windows)
    const viewActiveIndices = [];
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const windowStart = line.time - 0.4;
      const windowEnd = (line.endTime || (line.words && line.words.length > 0 ? line.words[line.words.length-1].time + 0.5 : line.time + 3.0)) + 0.4;
      if (currentTime >= windowStart && currentTime <= windowEnd) {
        viewActiveIndices.push(i);
      }
    }
    const viewActiveKey = JSON.stringify(viewActiveIndices);

    // Update scrolling position (scrollIndex triggers early for anticipatory positioning)
    // Runs when the primary scrollIndex changes OR when the set of overlapping active lines changes.
    if (scrollIndex !== this.currentScrollIndex || viewActiveKey !== this._lastViewActiveKey) {
      this.currentScrollIndex = scrollIndex;
      this._lastViewActiveKey = viewActiveKey;
      
      if (scrollIndex >= 0 && allLines[scrollIndex]) {
        this.isAutoScrolling = true;
        const lineEl = allLines[scrollIndex];
        
        // 1. 更新边界
        this.updateSpacerHeights();
        
        // Align strictly to the current primary scroll line's offset to keep active lyrics in place
        const baseOffsetTop = lineEl.offsetTop;
        
        const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
        const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
        const topSpacerHeight = containerHeight * alignOffset;
        const targetOffset = baseOffsetTop - topSpacerHeight;
        
        const maxScroll = container.scrollHeight - container.clientHeight;
        const finalTargetOffset = Math.max(0, Math.min(maxScroll > 0 ? maxScroll : 0, targetOffset));
        
        // ⭐ 同步对冲 + 单次全局 reflow）。
        //   1. 同步批量写transition:none + translateY(delta)（视觉保持原位）
        //   2. 读一娆?container.offsetHeight 触发全局 reflow（而非每行一次！）。
        //   3. 同步激活transition + translateY(0)（浏览器平滑动画归零）。
        //   全程在同一帧内完成，零延帧、零抽搐 ⭐
        const startScrollTop = container.scrollTop;
        const delta = finalTargetOffset - startScrollTop;

        if (Math.abs(delta) < 1) {
          container.scrollTop = finalTargetOffset;
        } else {
          container.scrollTop = finalTargetOffset;

          const targetIdx = scrollIndex;

          // ══ 步骤 A：批量关闭 transition，写入对齐 translateY(delta) ══
          allLines.forEach((el, idx) => {
            if (el.classList.contains('is-interlude-line')) return;
            el.style.transition = 'none';
            el.style.transform = `translateY(${delta}px)`;
          });

          // ══ 步骤 B：单次全局 reflow，让浏览器看到"上面的对冲状态══
          // 只读一次容器属性即可刷新所有子元素，开销远低于逐行 el.offsetHeight
          void container.offsetHeight;

          // ══ 步骤 C：同帧激活 transition，写入 translateY(0) 触发平滑动画 ══
          allLines.forEach((el, idx) => {
            if (el.classList.contains('is-interlude-line')) {
              const isCollapsing = (idx < targetIdx);
              if (isCollapsing) {
                el.style.transition = 'opacity 0.2s ease, height 0.45s cubic-bezier(0.25, 1, 0.5, 1) 0.2s, padding 0.45s cubic-bezier(0.25, 1, 0.5, 1) 0.2s';
              } else {
                el.style.transition = 'opacity 0.5s ease, height 0.6s cubic-bezier(0.25, 1, 0.5, 1), padding 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
              }
              el.style.transitionDelay = '';
            } else {
              let delay = 0;
              if (idx !== targetIdx) {
                const dist = Math.abs(idx - targetIdx);
                if (idx > targetIdx) {
                  delay = Math.min(0.25, 0.04 + dist * 0.015);
                } else {
                  delay = Math.min(0.15, 0.02 + dist * 0.01);
                }
              }
              el.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.5s ease, filter 0.5s ease';
              el.style.transitionDelay = `${delay}s`;
              el.style.transform = 'translateY(0)';
            }
          });

          // Cleanup: 850ms 后清 transition（等动画结束）。
          clearTimeout(this._scrollCleanup);
          this._scrollCleanup = setTimeout(() => {
            allLines.forEach(el => {
              el.style.transition = '';
              el.style.transitionDelay = '';
            });
            this.isAutoScrolling = false;
          }, 850);
        }
      }
    }

    // ⭐ 提前计算正在被实时高精度处理的行集合（包含当前所有活跃共唱行、滚动预测行、以及尚未唱完或正处于0.4s 温存期收尾的上一行） ⭐
    const linesToProcess = new Set([scrollIndex]);
    activeIndices.forEach(idx => {
      linesToProcess.add(idx);
      // 同时把处于这一行之前的"上一句歌词"也适度纳入缓存处理
      if (idx > 0) {
        const prevLine = this.lines[idx - 1];
        if (prevLine && currentTime < prevLine.endTime + 0.4) {
          linesToProcess.add(idx - 1);
        }
      }
    });

    // Update active/past visual classes, blur and clean up states based on dual axis sync (activeIndices + scrollIndex)
    const activeIndicesKey = JSON.stringify(activeIndices);
    if (activeIndicesKey !== this._lastActiveIndicesKey || scrollIndex !== this._lastVisualScrollIndex) {
      // Simple bottom bar lyric text update
      if (activeIndex !== this.activeIndex) {
        this.updateBarLyrics(activeIndex);
      }

      this.activeIndex = activeIndex;
      this._lastActiveIndicesKey = activeIndicesKey;
      this._lastVisualScrollIndex = scrollIndex;
      
      const minActiveIdx = activeIndices.length > 0 ? Math.min(...activeIndices) : activeIndex;
      
      allLines.forEach((el, idx) => {
        el.classList.remove('active', 'past', 'past-old');
        
        const effectiveActive = Math.max(activeIndex, scrollIndex);
        
        // ⭐ 如果当前行处于活跃共唱索引集合内，直接高亮渲染！ ⭐
        if (activeIndices.includes(idx)) {
          el.classList.add('active');
        } else if (idx < minActiveIdx && idx < effectiveActive) {
          el.classList.add('past');
          // 之前的歌词由 applyBlur 统一处理模糊和透明度，与之后的歌词对称
        }

        // ⭐ 排除掉仍鍦?linesToProcess 中实时插值收尾的行，不进行硬边界填充 ⭐
        // ⭐ 双保险：额外要求 currentTime > endTime + 0.4（温存期结束），防止重叠唱时上一句被提前充满 ⭐
        const lineEndWarmup = (this.lines[idx]?.endTime || 0) + 0.4;
        if (!activeIndices.includes(idx) && idx !== scrollIndex && !linesToProcess.has(idx) && currentTime > lineEndWarmup) {
            const targetState = (idx < minActiveIdx) ? 'past' : 'future';
            if (el.dataset.fixedState !== targetState) {
                if (!el._wordSpans) {
                  el._wordSpans = el.querySelectorAll('.lyrics-word');
                }
                const words = el._wordSpans;
                words.forEach(w => {
                   if (idx < minActiveIdx) {
                      w.style.setProperty('--char-fill', '112%');
                      w.dataset.fillVal = '112.0';
                      w.classList.add('word-active');
                      w.classList.remove('word-singing');
                      w.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease';
                      
                      const isBg = this.lines[idx] && this.lines[idx].isBackground;
                      let finalLift = isBg ? (-liftAmp * 0.5) : -liftAmp;
                      // 有两句同时唱（且时间存在实际重叠）的情况下，上一句不做轻微上抬移加
                      const hasOverlappingActive = viewActiveIndices.some(otherIdx => 
                        otherIdx !== idx && 
                        isOverlappingInTime(this.lines[idx], this.lines[otherIdx])
                      );
                      if (hasOverlappingActive && idx < Math.max(...viewActiveIndices)) {
                        finalLift = 0;
                      }
                      w.style.transform = `translateY(${finalLift.toFixed(2)}px) translateZ(0)`;
                      w.dataset.liftVal = finalLift.toFixed(3);
                   } else {
                      w.style.setProperty('--char-fill', '-10%');
                      w.dataset.fillVal = '-10.0';
                      w.classList.remove('word-active', 'word-singing');
                      w.style.transition = '';
                      w.style.transform = 'translateY(0px) translateZ(0)';
                      w.dataset.liftVal = '0.000';
                   }
                });
                el.dataset.fixedState = targetState;
            }
        } else {
            if (el.dataset.fixedState) {
                delete el.dataset.fixedState;
            }
            // ⭐ 修复：跳播时旧行杩?else 分支（不鍦?active/linesToProcess），
            //    浣?.lyrics-word 鐨?--char-fill 残留（如 past 行112%），必须清除 ⭐
            if (!activeIndices.includes(idx) && !linesToProcess.has(idx) && idx !== scrollIndex) {
                if (!el._wordSpans) el._wordSpans = el.querySelectorAll('.lyrics-word');
                const words = el._wordSpans;
                words.forEach(w => {
                    w.style.setProperty('--char-fill', '-10%');
                    w.classList.remove('word-active', 'word-singing');
                    w.style.transition = '';
                    w.style.transform = 'translateY(0px) translateZ(0)';
                });
            }
        }
      });

      if (!this.isUserScrolling) {
        this.applyBlur(activeIndices, scrollIndex, allLines);
      }
    }

    // Word-level (or character-level) smooth physics for both active and upcoming lines
    this._frameCount = (this._frameCount || 0) + 1;
    
    linesToProcess.forEach(idx => {
      if (idx >= 0 && this.lines[idx].charWords && this.lines[idx].charWords.length > 0) {
        const lineData = this.lines[idx];
        const domLine = document.querySelector(`#lyrics-lines .lyrics-line[data-index="${idx}"]`);
        if (domLine) {
          if (!domLine._wordSpans) {
            domLine._wordSpans = domLine.querySelectorAll('.lyrics-word');
          }
          const wordSpans = domLine._wordSpans;
          
          // ⭐ 物理背景分排对齐初始化(Row-Based Masterclass Background Attachment System)
          if (!domLine._wordsList) {
            domLine._wordsList = Array.from(domLine.querySelector('.lyrics-main')?.querySelectorAll('.lyrics-word') || []);
          }
          const words = domLine._wordsList;
          
          // ⭐ 自动折行监测：每行每 30 帧检测一次（避免每帧 3 娆?getBoundingClientRect 鈫?N 次强到reflow）。
          let needRealign = !domLine.rowsData || domLine.dataset.bgAligned !== 'true' || domLine.rowsData.some(r => r.width <= 0);
          if (!needRealign && words.length > 0 && (this._frameCount + idx) % 30 === 0) {
            const domLineRect = domLine.getBoundingClientRect();
            const firstRect = words[0].getBoundingClientRect();
            const lastRect = words[words.length - 1].getBoundingClientRect();
            
            const relativeFirstTop = firstRect.top - domLineRect.top;
            const relativeLastTop = lastRect.top - domLineRect.top;
            
            if (domLine._prevFirstRelativeTop === undefined || Math.abs(relativeFirstTop - domLine._prevFirstRelativeTop) > 2 || Math.abs(relativeLastTop - domLine._prevLastRelativeTop) > 2) {
              needRealign = true;
            }
          }
          
          if (needRealign && words.length > 0) {
            const domLineRect = domLine.getBoundingClientRect();
            const firstRect = words[0].getBoundingClientRect();
            const lastRect = words[words.length - 1].getBoundingClientRect();
            
            domLine._prevFirstRelativeTop = firstRect.top - domLineRect.top;
            domLine._prevLastRelativeTop = lastRect.top - domLineRect.top;
            
            // 1. 使用局部降噪屏幕高度进行绝对高度物理分排（阈值精密优化为 15px）。
            const rowGroups = [];
            words.forEach(w => {
              const y = w.getBoundingClientRect().top - domLineRect.top;
              let foundGroup = rowGroups.find(g => Math.abs(g[0]._relativeTop - y) < 15);
              if (foundGroup) {
                foundGroup.push(w);
              } else {
                w._relativeTop = y;
                rowGroups.push([w]);
              }
            });
            
            rowGroups.sort((a, b) => a[0]._relativeTop - b[0]._relativeTop);
            
            const rowsData = [];
            let allValid = true;
            rowGroups.forEach((rowWords, rowIndex) => {
              rowWords.sort((a, b) => a.offsetLeft - b.offsetLeft);
                  
                  const firstWord = rowWords[0];
                  const lastWord = rowWords[rowWords.length - 1];
                  
                  const rowLeft = firstWord.offsetLeft;
                  const rowRight = lastWord.offsetLeft + lastWord.offsetWidth;
                  const rowWidth = rowRight - rowLeft;
                  
                  if (rowWidth <= 0) {
                    allValid = false;
                  }
                  
                  const widthToUse = rowWidth || 300;
                  
                   rowWords.forEach(w => {
                     w.style.setProperty('--line-width', `${widthToUse}px`);
                     const baseOffset = w.offsetLeft - rowLeft;
                     w.style.setProperty('--char-offset', `${baseOffset}px`);
                     
                     // ⭐ 假名后缀绝对位置物理补偿 ⭐
                     const suffixNode = w.querySelector('.lyrics-ruby-suffix');
                     if (suffixNode) {
                       const suffixOffset = baseOffset + suffixNode.offsetLeft;
                       suffixNode.style.setProperty('--char-offset', `${suffixOffset}px`);
                     }
                     
                     w.style.setProperty('--glow-left-pct', ((70 / widthToUse) * 100).toFixed(3));
                     w.style.setProperty('--glow-right-pct', ((50 / widthToUse) * 100).toFixed(3));
                     w.style.setProperty('--glow-mid-pct', ((20 / widthToUse) * 100).toFixed(3));
                     w.dataset.rowIndex = rowIndex;
                   });
                  
                  rowsData.push({
                    rowIndex,
                    left: rowLeft,
                    width: widthToUse,
                    words: rowWords,
                    startIdx: words.indexOf(firstWord),
                    endIdx: words.indexOf(lastWord)
                  });
                });
                
                domLine.rowsData = rowsData;
                
                // 只有当所有排的物理宽度均合法且首个字元已被真实渲染时，才锁定 true 避免首帧零值污鏌?
                if (allValid && words[0].offsetWidth > 0) {
                  domLine.dataset.bgAligned = 'true';
                }
          }
          
          // --- Continuous Gap-Smoothing Topological Playhead ---
          let charC = -1;
          const totalChars = lineData.charWords.length;
          
          let lastIdx = -1;
          for (let i = 0; i < totalChars; i++) {
              const cw = lineData.charWords[i];
              if (currentTime >= cw.time && currentTime < (cw.time + cw.duration)) {
                  charC = i + ((currentTime - cw.time) / cw.duration);
                  lastIdx = i;
                  break;
              } else if (currentTime >= cw.time + cw.duration) {
                  lastIdx = i;
              }
          }
          
          // Handle gaps and bounds for absolute mathematical continuity
          if (charC === -1) {
              if (lastIdx === -1) {
                  charC = 0 - ((lineData.charWords[0].time - currentTime) / 0.3);
              } else if (lastIdx === totalChars - 1) {
                  const lastCw = lineData.charWords[lastIdx];
                  charC = (lastIdx + 1) + ((currentTime - (lastCw.time + lastCw.duration)) / 0.3);
              } else {
                  // ⭐ 间隙平滑过渡：在两字之间的停顿期间，用缓动插鍊?
                  //    让唱头缓慢漂移通过间隙，而非冻结在常量上 ⭐
                  const prevCw = lineData.charWords[lastIdx];
                  const nextCw = lineData.charWords[lastIdx + 1];
                  const gapStart = prevCw.time + prevCw.duration;
                  const gapEnd = nextCw.time;
                  const gapDuration = gapEnd - gapStart;
                  if (gapDuration > 0.01) {
                      const t = Math.min(1, (currentTime - gapStart) / gapDuration);
                      // ease-out: 动画前段快后段慢，模拟演唱气息的自然减少
                      const eased = 1 - (1 - t) * (1 - t);
                      // 漂移 0.35 个字符单位，足够保持视觉流动又不会过度侵入下一瀛?
                      charC = (lastIdx + 1) + eased * 0.35;
                  } else {
                      charC = lastIdx + 1;
                  }
              }
          }

          // Pre-collect all long-glow character indices in this line to build glowing ripple fields
          const longIndices = [];
          lineData.charWords.forEach((cw, idx) => {
            const s = wordSpans[idx];
            if (s && s.classList.contains('long-glow')) {
              longIndices.push(idx);
            }
          });

          // ⭐ 全屏歌词隐藏时，仅为迷你歌词更新逐字卡拉OK填充，彻底跳过全屏物理渲染（分排对齐/抬起/发光等），避免每帧重计算卡顿 ⭐
          if (!this.isVisible) {
            if (idx === this.activeIndex) {
              this.syncBarSpans(wordSpans, charC, totalChars);
            }
            return;
          }

          // ⭐ 大师级物理排物理拼接渐变与唱头碰撞检娴?system (Viewport Texture Mapping & Playhead Collision Detection) ⭐
          if (domLine.rowsData && domLine.rowsData.length > 0) {
            const currentInt = Math.floor(charC);
            const currentDec = charC - currentInt;
            
            // 找到当前唱到的字元所处的排索寮?
            let activeRowIndex = 0;
            const activeCw = lineData.charWords[currentInt];
            if (activeCw && wordSpans[currentInt]) {
              const activeSpan = wordSpans[currentInt];
              activeRowIndex = parseInt(activeSpan.dataset.rowIndex || '0', 10);
            }
            
            // 过渡宽度比例约 8%（使高亮带极其短小精悍、利落清脆）
            const transitionRatio = 0.08;

            domLine.rowsData.forEach(row => {
              const rowWidth = row.width;
              const rowLeft = row.left;
              const transitionWidthPx = rowWidth * transitionRatio;

              // ⭐ 跨折行多排线性投影无缝流光过渡算娉?(Multi-Row Linear Projection Seamless Karaoke Flow System) ⭐
              let playheadX = 0;
              if (charC < 0) {
                // 唱头处于行前静止期，做left侧负像素投影
                const firstWordWidth = row.words[0]?.offsetWidth || 40;
                playheadX = 0 - (0 - charC) * firstWordWidth;
              } else if (charC >= totalChars) {
                // 唱头越过整行，做right侧超界投褰?
                const lastWordWidth = row.words[row.words.length - 1]?.offsetWidth || 40;
                playheadX = rowWidth + (charC - totalChars) * lastWordWidth;
              } else {
                if (charC >= row.startIdx && charC <= row.endIdx + 1) {
                  // 1. 唱头当前正处于这一排内，进行高精度像素提取
                  const activeSpan = wordSpans[currentInt];
                  if (activeSpan) {
                    playheadX = activeSpan.offsetLeft - rowLeft + activeSpan.offsetWidth * currentDec;
                  } else {
                    playheadX = 0;
                  }
                } else if (charC < row.startIdx) {
                  // 2. 唱头尚未唱到这一排，向左线性投影为虚拟负像素位缃?
                  const dist = row.startIdx - charC;
                  const firstWordWidth = row.words[0]?.offsetWidth || 40;
                  playheadX = 0 - dist * firstWordWidth;
                } else {
                  // 3. 唱头已经滚过这一排，向右线性投影为虚拟正像素位缃?
                  const dist = charC - (row.endIdx + 1);
                  const lastWordWidth = row.words[row.words.length - 1]?.offsetWidth || 40;
                  playheadX = rowWidth + dist * lastWordWidth;
                }
              }

              // ⭐ 物理降维大成：对这一排的所有字元彻底打通整排联觉卡拉OK渐变长河系统 ⭐
              const rowPercent = (playheadX / rowWidth) * 100;
              const isRowComplete = playheadX >= rowWidth - 1;
              row.words.forEach(w => {
                if (isRowComplete) {
                  // ⭐ 扫光完成后切到word-active 实心填色，避免整行100% 渐变"色块" ⭐
                  w.classList.add('word-active');
                  w.classList.remove('word-singing');
                  w.style.removeProperty('--line-percent');
                } else {
                  w.classList.add('word-singing');
                  w.classList.remove('word-active');
                  const clampedPercent = Math.max(0, Math.min(100, rowPercent));
                  const roundedPercent = clampedPercent.toFixed(1);
                  if (w._lastPercent !== roundedPercent) {
                    w._lastPercent = roundedPercent;
                    w.style.setProperty('--line-percent', `${roundedPercent}%`);
                  }
                }
              });
            });
          } else {
            // 降级经典经典的单字元填色
            wordSpans.forEach((span, i) => {
              const cw = lineData.charWords[i];
              if (!cw) return;
              let fill = (charC < 0) ? 0 : (charC >= totalChars ? 100 : (i < Math.floor(charC) ? 100 : (i > Math.floor(charC) ? 0 : (charC - Math.floor(charC)) * 100)));
              
              const clampedFill = Math.max(-10, Math.min(115, fill));
              const roundedFill = clampedFill.toFixed(1);
              
              if (span._lastFill !== roundedFill) {
                span._lastFill = roundedFill;
                span.style.setProperty('--char-fill', `${roundedFill}%`);
              }
              
              if (fill === 100) {
                span.classList.add('word-active');
                span.classList.remove('word-singing');
              } else if (fill === 0) {
                span.classList.remove('word-active', 'word-singing');
              } else {
                span.classList.add('word-singing');
                span.classList.remove('word-active');
              }
            });
          }
          
          // --- 2. Hermite Multi-Word Stagger Wave Lift (多字依次抬起柔性波浪衔接系给 ---
          wordSpans.forEach((span, i) => {
            const cw = lineData.charWords[i];
            if (!cw) return;
            
            const charX = i - charC; // 当前字元与唱头之间的字元距离差（实数）。
            const waveRadius = 1.8;  // 抬起过渡的半径（控制多字抬起衔接的宽度）
            
            let lift = 0;
            
            // ⭐ 核心安全栓：若当前时间尚未到这一句的首字时间，整行字元必须牢牢立在基线上，彻底降伏首字提前浮空的视觉盲区）。⭐
            if (currentTime < lineData.charWords[0].time) {
              lift = 0;
            } else {
              const charX = i - charC; // 当前字元与唱头之间的字元距离差（实数）。
              const waveRadius = 1.2;  // 抬起过渡半径

              if (charX < -1.0) {
                // 已经唱完的字入-> 高悬绌?
                lift = -liftAmp;
              } else if (charX < waveRadius) {
                // 正在鍞?/ 预热逼近 -> 线性上抬（唱头匀閫?鈫?字匀速）锔?
                const range = waveRadius + 1.0;
                const t = 1.0 - (charX + 1.0) / range;
                lift = t * -liftAmp;
              } else {
                // 尚未唱到的字入-> 基线
                lift = 0;
              }
            }

            // ⭐ 伴唱/背景歌词物理抬起幅度缩减 0.5 倍以增强立体高度透视 ⭐
            if (lineData.isBackground) {
              lift = lift * 0.5;
            }

            // ⭐ 借鉴 BetterLyrics：所有行（主歌词/背景和声）都正常上抬，不鎸?LaneIndex 抑制 ⭐
            // 背景和声鐨?出现/消失"由行时间范围(active/past)判定，不是靠抑制上抬
            // LaneIndex 仅用于滚动分轨（scrollIndex 跟随主唱行LaneIndex==0）。

            const prevLift = parseFloat(span.dataset.liftVal || '0.000');
            // ⭐ 鐓?audio-player.js：不用速度阻尼，lift 直接跟随目标值（charX 本身平滑变化）。
            const nextLift = lift;

            // ⭐ 绾?delta 脏检测：只在抬起量真正变化时才写 transform）。
            //    消除边界值（0 / -liftAmp）每帧冗余重写导致的微卡椤?⭐
            if (Math.abs(nextLift - prevLift) > 0.005) {
              span.style.transition = 'none';
              span.style.transform = `translateY(${nextLift.toFixed(2)}px) translateZ(0)`;
              span.dataset.liftVal = nextLift.toFixed(3);
            }

            // --- 3. Mathematical Long Character Glowing Ripple Halo (时空双轴拓扑发光预判与延迟 ---
            let glowVal = 0.0;
            longIndices.forEach(L => {
              const charX = L - charC;
              let power = 0;
              if (charX > 0) {
                power = Math.max(0, 1 - charX / 1.2);
              } else {
                power = Math.max(0, 1 - Math.abs(charX) / 1.8);
              }
              const dist = Math.abs(i - L);
              let spread = 0;
              if (dist === 0) {
                spread = 1.0;
              } else {
                spread = Math.max(0, 1 - dist / 1.2) * 0.55;
              }
              const contribution = power * spread;
              if (contribution > glowVal) {
                glowVal = contribution;
              }
            });

            // 3. 动态注入CSS 变量以实现时空浮点数无缝晕染
            const prevGlow = parseFloat(span.dataset.glowVal || '-999');
            if (Math.abs(glowVal - prevGlow) > 0.01 || glowVal === 0 || glowVal === 1) {
              span.style.setProperty('--singing-glow-intensity', glowVal.toFixed(3));
              span.dataset.glowVal = glowVal.toFixed(3);
              
              if (glowVal > 0.01) {
                span.classList.add('singing-glow');
              } else {
                span.classList.remove('singing-glow');
              }
            }
          });

          if (idx === this.activeIndex) {
            this.syncBarSpans(wordSpans, charC, totalChars);
          }
        }
      }
    });
  }

  // Staggered scroll: break total scroll into steps with delays between each
  staggeredScrollTo(lineEl) {
    const container = document.getElementById('lyrics-scroll');
    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
    const targetScroll = container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * alignOffset;
    const totalDiff = targetScroll - container.scrollTop;

    if (Math.abs(totalDiff) < 2) return;

    // Cancel previous
    if (this._scrollTimers) {
      this._scrollTimers.forEach(t => clearTimeout(t));
    }
    if (this._scrollAnim) cancelAnimationFrame(this._scrollAnim);
    this._scrollTimers = [];

    // Break into 5 steps, each step delayed by 100ms
    const steps = 5;
    const stepDelay = 100; // ms between each step starting
    const stepDuration = 400; // ms for each step's easing
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    let scrolledSoFar = 0;

    for (let i = 0; i < steps; i++) {
      const stepAmount = totalDiff / steps;
      const timer = setTimeout(() => {
        const startPos = container.scrollTop;
        const startTime = performance.now();

        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / stepDuration);
          container.scrollTop = startPos + stepAmount * easeOut(progress);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else if (i === steps - 1) {
            this.isAutoScrolling = false;
          }
        };
        requestAnimationFrame(animate);
      }, i * stepDelay);

      this._scrollTimers.push(timer);
    }
  }

  // Keep smoothScrollTo as fallback
  smoothScrollTo(lineEl) {
    const container = document.getElementById('lyrics-scroll');
    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
    const targetScroll = container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * alignOffset;
    const startScroll = container.scrollTop;
    const diff = targetScroll - startScroll;

    if (Math.abs(diff) < 2) return;

    if (this._scrollAnim) cancelAnimationFrame(this._scrollAnim);

    const duration = 900;
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      container.scrollTop = startScroll + diff * easeOutCubic(progress);
      if (progress < 1) {
        this._scrollAnim = requestAnimationFrame(step);
      } else {
        this.isAutoScrolling = false;
      }
    };
    this._scrollAnim = requestAnimationFrame(step);
  }

  show() {
    const panel = document.getElementById('lyrics-panel');
    if (panel) panel.classList.add('active');
    this.isVisible = true;

    // Lazily load the heavy large cover art only when the panel is shown
    if (this.player.currentIndex >= 0) {
      const song = this.player.playlist[this.player.currentIndex];
      if (song) {
        const cover = getCoverSrc(song.cover_image);
        const largeCoverEl = document.getElementById('lyrics-large-cover');
        if (largeCoverEl && largeCoverEl.src !== cover) {
          transitionContent(largeCoverEl, cover, true);
        }
      }
    }
    
    this.realign();
    setTimeout(() => {
      this.realign();
    }, 100);
    setTimeout(() => {
      this.realign();
    }, 650);
  }

  hide() {
    const panel = document.getElementById('lyrics-panel');
    if (panel) panel.classList.remove('active');
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) this.hide(); else this.show();
  }
}

const transitionContent = (el, content, isImg = false) => {
  if (!el) return;
  
  // ══ Ultra-Performance Deduplication: Avoid redundant transitions to eliminate flashing ══
  if (isImg) {
    const currentSrc = el.src ? new URL(el.src, window.location.href).href : '';
    const targetSrc = content ? new URL(content, window.location.href).href : '';
    if (currentSrc === targetSrc) return;
  } else {
    if (el.innerText === content) return;
  }

  el.classList.add('changing');
  setTimeout(() => {
    if (isImg) {
      el.src = content;
    } else {
      el.innerText = content;
    }
    el.classList.remove('changing');
  }, 350);
};

// ══ Audio Player ══
class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.activeSearchQuery = null;
    this.lyrics = new LyricsController(this);
    this.setupEvents();
  }

  setupEvents() {
    // Seek to pending seek time on metadata load
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeekTime !== undefined && this.pendingSeekTime !== null) {
        this.audio.currentTime = this.pendingSeekTime;
        this.pendingSeekTime = null;
      }
    });

    // Live real-time audio progress updates
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration) {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        
        try {
          localStorage.setItem('kimo-last-played-time', this.audio.currentTime.toString());
        } catch (e) {
          console.error('Failed to save last played time:', e);
        }
        
        // Update main player progress bar
        const mainBar = document.getElementById('progress-bar');
        if (mainBar) mainBar.style.width = `${progress}%`;
        
        // Update main player current elapsed time text
        const mainCurrentTimeText = document.querySelector('.player-progress-time.current');
        if (mainCurrentTimeText) {
          mainCurrentTimeText.innerText = Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60).toString().padStart(2, '0');
        }

        // Update integrated lyrics progress bar
        const lyricsBar = document.getElementById('lyrics-progress-bar');
        if (lyricsBar) lyricsBar.style.width = `${progress}%`;
        
        // Update interactive current elapsed time text
        const currentTimeText = document.querySelector('.lyrics-progress-time.current');
        if (currentTimeText) {
          currentTimeText.innerText = Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60).toString().padStart(2, '0');
        }
      }
    });

    // Elegant global state synchronization driven directly by HTML5 events
    const syncPlayState = (playing) => {
      this.isPlaying = playing;
      
      const clickArea = document.getElementById('lyrics-cover-click-area');
      if (clickArea) {
        clickArea.classList.toggle('is-playing', playing);
      }
      
      const playBtn = document.getElementById('play-btn');
      if (playBtn) {
        playBtn.classList.toggle('is-playing', playing);
      }

      // Sync active CSS Equalizers jumping state
      document.querySelectorAll('.song-item .eq-animation').forEach(el => {
        el.classList.toggle('paused', !playing);
      });

      // Synchronize Windows Native Media playback state (Prevent jitter during active track switching)
      if ('mediaSession' in navigator && !this.isSwitchingTrack) {
        navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      }
    };

    this.audio.addEventListener('play', () => syncPlayState(true));
    this.audio.addEventListener('pause', () => syncPlayState(false));
    this.audio.addEventListener('ended', () => this.next());

    // ══ Windows Native SMTC Media Control Actions Integration ══
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.toggle();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.toggle();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.next();
      });
    }
  }

  async play(index) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentIndex = index;
    let song = this.playlist[index];

    // Save last played song path to localStorage
    try {
      localStorage.setItem('kimo-last-played-path', song.file_path);
      localStorage.setItem('kimo-last-played-time', '0');
    } catch (e) {
      console.error('Failed to save last played path to localStorage:', e);
    }

    // Set state lock to avoid intermediate play/pause flickering in SMTC
    this.isSwitchingTrack = true;

    // 1. Advance metadata and SMTC state BEFORE changing raw HTML5 src (smooth track swap)
    this.updateUI(song);

    // 2. Physical hot swap of the audio source
    this.audio.src = convertFileSrc(song.file_path);
    this.audio.play()
      .then(() => {
        this.isSwitchingTrack = false;
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      })
      .catch(e => {
        this.isSwitchingTrack = false;
        console.error('Play error:', e);
      });

    // Save to recent plays cache
    if (window.addToRecentPlays) {
      window.addToRecentPlays(song);
    }

    // If cover is missing (loaded from cache), fetch it in the background to avoid storing megabytes in localStorage
    if (!song.cover_image) {
      try {
        const meta = await invoke('read_audio_metadata', { path: song.file_path });
        if (meta && meta.cover_image) {
          song.cover_image = meta.cover_image;
          this.playlist[index] = song;
          
          // Dynamically update UI cover art in real-time
          this.updateUI(song);
          const songItems = document.querySelectorAll('.song-item');
          if (songItems[index]) {
            const coverImg = songItems[index].querySelector('.song-cover');
            if (coverImg) coverImg.src = getCoverSrc(song.cover_image);
          }

          // Asynchronously extract and cache color
          extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
            song.dominant_color = color;
            if (index === this.currentIndex) {
              applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
            }
          });
        }
      } catch (err) {
        console.error('Failed to dynamically fetch metadata on play:', err);
      }
    }

    // Dynamic color matching (fully non-blocking background task with caching)
    if (song.dominant_color) {
      applyDynamicColor(song.dominant_color.r, song.dominant_color.g, song.dominant_color.b, getCoverSrc(song.cover_image));
    } else if (song.cover_image) {
      extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
        song.dominant_color = color;
        if (index === this.currentIndex) {
          applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
        }
      });
    } else {
      const defColor = getDefaultDynamicColor();
      applyDynamicColor(defColor.r, defColor.g, defColor.b, getCoverSrc(null));
    }

    // Load lyrics
    this.lyrics.load(song.file_path);

    // ⭐ 实时更新播放列表面板当前播放标记 ⭐
    if (typeof window.updatePlaylistPanelCurrent === 'function') {
      window.updatePlaylistPanelCurrent();
    }
  }

  toggle() {
    if (this.currentIndex === -1 && this.playlist.length > 0) { this.play(0); return; }
    if (this.isPlaying) { this.audio.pause(); } else { this.audio.play().catch(e => console.error(e)); }
  }

  // Play modes: 'list-loop' | 'single-loop' | 'shuffle'
  playMode = 'list-loop';
  speedSteps = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  speedIndex = 2; // default 1.0x

  next() {
    if (this.playlist.length === 0) return;
    if (this.playMode === 'shuffle') {
      this.play(Math.floor(Math.random() * this.playlist.length));
    } else {
      this.play((this.currentIndex + 1) % this.playlist.length);
    }
  }
  prev() { if (this.playlist.length > 0) this.play((this.currentIndex - 1 + this.playlist.length) % this.playlist.length); }

  cyclePlayMode() {
    const modes = ['list-loop', 'single-loop', 'shuffle'];
    const labels = { 'list-loop': '列表循环', 'single-loop': '单曲循环', 'shuffle': '随机播放' };
    const svgs = {
      'list-loop': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      'single-loop': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-weight="bold">1</text></svg>',
      'shuffle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>'
    };
    const idx = modes.indexOf(this.playMode);
    this.playMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('play-mode-btn');
    if (btn) {
      btn.innerHTML = svgs[this.playMode];
      btn.title = '播放模式: ' + labels[this.playMode];
      btn.classList.toggle('is-active', this.playMode !== 'list-loop');
    }
    // Set audio loop for single-loop mode
    this.audio.loop = this.playMode === 'single-loop';
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speedSteps.length;
    const speed = this.speedSteps[this.speedIndex];
    this.audio.playbackRate = speed;
    const btn = document.getElementById('speed-btn');
    if (btn) {
      const label = btn.querySelector('.speed-label');
      if (label) label.textContent = speed + 'x';
      btn.title = '倍速 ' + speed + 'x';
      btn.classList.toggle('is-active', speed !== 1.0);
    }
  }

  updateUI(song) {
    const title = song.title || 'Unknown Title';
    const artist = song.artist || 'Unknown Artist';
    const cover = getCoverSrc(song.cover_image);
    const miniCover = getCoverSrc(song.cover_image);

    // ══ Windows Native Toast Notifications (Silent for uninterrupted audio experience) ══
    if (window.Notification && this.lastNotifiedFilePath !== song.file_path) {
      this.lastNotifiedFilePath = song.file_path;
      const triggerNotification = () => {
        new Notification("KiomPlayer 正在播放", {
          body: `${title} - ${artist}`,
          silent: true
        });
      };
      if (Notification.permission === "granted") {
        triggerNotification();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            triggerNotification();
          }
        });
      }
    }

    // ══ Windows Native SMTC Media Session Metadata Integration (High-precision Deduplication) ══
    const smtcKey = `${song.file_path}_${song.cover_image || ''}`;
    if ('mediaSession' in navigator && this.lastSMTCKey !== smtcKey) {
      this.lastSMTCKey = smtcKey;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: song.album || 'Unknown Album',
        artwork: song.cover_image ? [
          {
            src: getCoverSrc(song.cover_image),
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ] : []
      });
    }

    transitionContent(document.getElementById('current-title'), title);
    transitionContent(document.getElementById('current-artist'), artist);

    transitionContent(document.getElementById('lyrics-header-title'), title);
    transitionContent(document.getElementById('lyrics-header-artist'), artist);
    transitionContent(document.getElementById('lyrics-under-title'), title);
    transitionContent(document.getElementById('lyrics-under-artist'), artist);
    
    if (this.lyrics.isVisible) {
      transitionContent(document.getElementById('lyrics-large-cover'), cover, true);
    }
    transitionContent(document.getElementById('current-cover'), miniCover, true);

    // Set duration text for the integrated lyrics progress container
    const totalTimeText = document.querySelector('.lyrics-progress-time.total');
    if (totalTimeText) {
      totalTimeText.innerText = song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : '0:00';
    }

    const mainTotalTime = document.querySelector('.player-progress-time.total');
    if (mainTotalTime) {
      mainTotalTime.innerText = song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : '0:00';
    }

    document.querySelectorAll('.song-item').forEach((el) => {
      const filePath = el.getAttribute('data-file-path');
      const isCurrent = filePath && this.playlist[this.currentIndex] && filePath === this.playlist[this.currentIndex].file_path;
      el.classList.toggle('playing', isCurrent);
      const eq = el.querySelector('.eq-animation');
      if (eq) {
        if (isCurrent) {
          eq.classList.toggle('paused', this.audio.paused);
        } else {
          eq.classList.add('paused');
        }
      }
    });

    // Make sure interactive click areas have proper playing state classes on transition
    const clickArea = document.getElementById('lyrics-cover-click-area');
    if (clickArea) {
      clickArea.classList.toggle('is-playing', this.isPlaying);
    }

    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.classList.toggle('is-playing', this.isPlaying);
    }
  }
}

const player = new AudioPlayer();

// ══ Init ══
document.addEventListener('DOMContentLoaded', () => {
  // ⭐ 立即隐藏启动屏（防卡死），后续初始化失败也不影响 UI 可见 ⭐
  setTimeout(() => {
    const splash = document.getElementById('app-splash-screen');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    }
  }, 100);

  // Restore default lyric lift amplitude to 4.0 on version 1.2.2 launch (word lift animation)
  if (localStorage.getItem('kimo-lyrics-lift-amplitude-migrated-122') !== 'true') {
    localStorage.setItem('kimo-lyrics-lift-amplitude', '4.0');
    localStorage.setItem('kimo-lyrics-lift-amplitude-migrated-122', 'true');
  }

  // 载入持久化主题设置，首次默认为浅色（light）。
  let savedTheme = localStorage.getItem('kimo-theme');
  if (!savedTheme) {
    savedTheme = 'light';
  }
  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  let savedOp = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
  applyTheme(savedTheme, savedOp);

  let savedScale = parseFloat(localStorage.getItem('kimo-ui-scale')) || 1.0;
  if (savedScale > 1.2) {
    savedScale = 1.2;
    localStorage.setItem('kimo-ui-scale', '1.2');
  }
  document.documentElement.style.setProperty('--ui-scale', savedScale.toString());
  document.documentElement.style.zoom = savedScale.toString();

  // Window
  document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
  document.getElementById('titlebar-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
  document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());




  // Handle window resizing to dynamically recalibrate lyric spacers with high precision
  window.addEventListener('resize', () => {
    if (player.lyrics) {
      player.lyrics.resetAlignmentCache();
    }
    if (player.lyrics.isVisible) {
      player.lyrics.realign();
      requestAnimationFrame(() => {
        if (player.lyrics.isVisible) {
          player.lyrics.realign();
        }
      });
    }
  });

  // Fix Chromium zoom hit-testing scroll bug on flex containers
  window.addEventListener('wheel', (e) => {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      if (contentArea.contains(e.target)) {
        if (contentArea.scrollHeight > contentArea.clientHeight) {
          const scrollableChild = e.target.closest('.ai-console-logs, .kimo-modal-body, input[type="range"]');
          if (!scrollableChild) {
            contentArea.scrollTop += e.deltaY;
          }
        }
      }
    }
  }, { passive: true });

  // Player
  document.getElementById('play-btn')?.addEventListener('click', () => player.toggle());
  document.getElementById('next-btn')?.addEventListener('click', () => player.next());
  document.getElementById('prev-btn')?.addEventListener('click', () => player.prev());

  // Play mode & speed controls
  document.getElementById('play-mode-btn')?.addEventListener('click', () => player.cyclePlayMode());
  document.getElementById('speed-btn')?.addEventListener('click', () => player.cycleSpeed());

  // Bottom bar lyric click opens lyrics panel
  document.getElementById('player-bar-lyric-trigger')?.addEventListener('click', () => player.lyrics.show());

  // Integrated Lyrics Controls
  document.getElementById('lyrics-cover-click-area')?.addEventListener('click', () => player.toggle());
  document.getElementById('lyrics-next-btn')?.addEventListener('click', () => player.next());
  document.getElementById('lyrics-prev-btn')?.addEventListener('click', () => player.prev());

  // Interactive scrubbing for progress bars (referencing the professional feel algorithm in audio-player.js)
  const setupProgressScrubbing = (trackEl, fillEl) => {
    let isDragging = false;
    let didMove = false;
    let wasPlayingBeforeDrag = false;
    let clickPercent = 0;
    let downX = 0;
    let downTime = 0;
    let dragStartTime = 0;
    const MOVE_THRESHOLD = 5;
    const SHORT_PRESS_MS = 400;

    const handleStart = (e) => {
      if (e.type !== 'touchstart') {
        e.preventDefault();
      }
      if (!player.audio.duration) return;

      isDragging = true;
      didMove = false;

      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      downX = clientX;
      downTime = Date.now();

      wasPlayingBeforeDrag = !player.audio.paused;
      if (wasPlayingBeforeDrag) {
        player.audio.pause();
      }

      const rect = trackEl.getBoundingClientRect();
      clickPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      dragStartTime = player.audio.currentTime;

      // Add visual feedback
      trackEl.classList.add('is-dragging');
    };

    const handleMove = (e) => {
      if (!isDragging || !player.audio.duration) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;

      if (!didMove && Math.abs(clientX - downX) > MOVE_THRESHOLD) {
        didMove = true;
      }

      if (!didMove) return;

      if (e.type === 'touchmove') e.preventDefault();

      const rect = trackEl.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const duration = player.audio.duration;

      // Premium formula: newTime = PressTime + (CurrentPercent - PressPercent) * Duration
      const deltaPercent = percent - clickPercent;
      let newTime = dragStartTime + deltaPercent * duration;
      newTime = Math.max(0, Math.min(duration, newTime));

      player.audio.currentTime = newTime;

      // Instantly update fill bar width for snappy visual feedback during drag
      if (fillEl) {
        fillEl.style.width = `${(newTime / duration) * 100}%`;
      }
    };

    const handleEnd = (e) => {
      if (isDragging && player.audio.duration) {
        if (!didMove && (Date.now() - downTime) < SHORT_PRESS_MS) {
          player.audio.currentTime = clickPercent * player.audio.duration;
        }
        if (wasPlayingBeforeDrag) {
          player.audio.play().catch(err => console.error('Resume failed:', err));
        }
      }
      isDragging = false;
      wasPlayingBeforeDrag = false;
      trackEl.classList.remove('is-dragging');
    };

    trackEl.addEventListener('mousedown', handleStart);
    trackEl.addEventListener('touchstart', handleStart, { passive: false });

    // ⭐ ERGONOMIC TIMELINE NAVIGATION: Up for seek forward (3s), down for seek backward (-3s) on mouse wheel
    trackEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!player.audio.duration) return;
      const step = 3;
      const delta = e.deltaY < 0 ? step : -step;
      let newTime = Math.max(0, Math.min(player.audio.duration, player.audio.currentTime + delta));
      player.audio.currentTime = newTime;
      
      // Update UI instantaneously
      if (fillEl) {
        fillEl.style.width = `${(newTime / player.audio.duration) * 100}%`;
      }
    }, { passive: false });

    // Document-level events for smooth tracking outside container bounds
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  };

  const lyricsProgressTrack = document.getElementById('lyrics-progress-track');
  const lyricsProgressBar = document.getElementById('lyrics-progress-bar');
  if (lyricsProgressTrack) {
    setupProgressScrubbing(lyricsProgressTrack, lyricsProgressBar);
  }

  const mainProgressTrack = document.querySelector('.player-bar .progress-track');
  const mainProgressBar = document.getElementById('progress-bar');
  if (mainProgressTrack) {
    setupProgressScrubbing(mainProgressTrack, mainProgressBar);
  }
  // Volume Controls Bindings
  const volTrack = document.getElementById('volume-track');
  const volBar = document.getElementById('volume-bar');
  const volBtn = document.getElementById('volume-btn');
  
  let savedVolume = parseFloat(localStorage.getItem('kimo-player-volume'));
  if (isNaN(savedVolume)) savedVolume = 0.8;
  player.audio.volume = savedVolume;

  const updateVolumeUI = () => {
    const vol = player.audio.volume;
    if (volBar) volBar.style.width = `${vol * 100}%`;
    const iconOn = document.querySelector('.icon-volume-on');
    const iconMute = document.querySelector('.icon-volume-mute');
    if (iconOn && iconMute) {
      if (vol === 0) {
        iconOn.style.display = 'none';
        iconMute.style.display = 'block';
      } else {
        iconOn.style.display = 'block';
        iconMute.style.display = 'none';
      }
    }
  };

  updateVolumeUI();

  let previousVolume = savedVolume > 0 ? savedVolume : 0.8;

  if (volBtn) {
    volBtn.addEventListener('click', () => {
      if (player.audio.volume > 0) {
        previousVolume = player.audio.volume;
        player.audio.volume = 0;
      } else {
        player.audio.volume = previousVolume;
      }
      localStorage.setItem('kimo-player-volume', player.audio.volume);
      updateVolumeUI();
    });
  }

  if (volTrack) {
    let isDraggingVol = false;

    const updateVolumeFromX = (clientX) => {
      const rect = volTrack.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      player.audio.volume = percent;
      localStorage.setItem('kimo-player-volume', percent);
      updateVolumeUI();
    };

    volTrack.addEventListener('mousedown', (e) => {
      isDraggingVol = true;
      volTrack.classList.add('is-dragging');
      updateVolumeFromX(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDraggingVol) {
        updateVolumeFromX(e.clientX);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDraggingVol) {
        isDraggingVol = false;
        volTrack.classList.remove('is-dragging');
      }
    });

    // ⭐ ERGONOMIC VOLUME SCROLL: Adjust volume smoothly by scrolling anywhere within the volume track or its parent container
    const handleVolumeWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.04 : -0.04;
      const nextVol = Math.max(0, Math.min(1, player.audio.volume + delta));
      player.audio.volume = nextVol;
      localStorage.setItem('kimo-player-volume', nextVol);
      updateVolumeUI();
    };

    volTrack.addEventListener('wheel', handleVolumeWheel, { passive: false });
    const volumeContainer = document.querySelector('.volume-container');
    if (volumeContainer) {
      volumeContainer.addEventListener('wheel', handleVolumeWheel, { passive: false });
    }
  }

  // Theme
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);

  // Lyrics Font Size Slider Control
  let currentFontSize = parseFloat(localStorage.getItem('kimo-lyrics-font-size')) || 22;
  const fontSizeSlider = document.getElementById('slider-font-size');
  const fontSizeValue = document.getElementById('lyric-font-size-value');
  
  const updateFontSize = (size) => {
    currentFontSize = Math.max(16, Math.min(36, size));
    document.documentElement.style.setProperty('--lyrics-font-size', `${currentFontSize}px`);
    if (fontSizeSlider) fontSizeSlider.value = currentFontSize;
    if (fontSizeValue) fontSizeValue.innerText = `字号: ${currentFontSize.toFixed(1)}px`;
    if (player && player.lyrics) player.lyrics.resetAlignmentCache();
  };
  
  if (fontSizeSlider) {
    fontSizeSlider.value = currentFontSize;
    // Butter smooth real-time DOM update on drag (No disk I/O lag!)
    fontSizeSlider.addEventListener('input', (e) => {
      updateFontSize(parseFloat(e.target.value));
    });
    // High performance persistent save exactly once when drag ends
    fontSizeSlider.addEventListener('change', (e) => {
      localStorage.setItem('kimo-lyrics-font-size', parseFloat(e.target.value));
    });

    // ⭐ MOUSE WHEEL ADJUSTMENT: Allow effortless scrolling anywhere on the input or its control item to shift font size by 0.5px
    const handleFontSizeWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const nextVal = Math.max(16, Math.min(36, currentFontSize + delta));
      updateFontSize(nextVal);
      localStorage.setItem('kimo-lyrics-font-size', nextVal);
    };
    fontSizeSlider.addEventListener('wheel', handleFontSizeWheel, { passive: false });
    const parentItem = fontSizeSlider.closest('.lyrics-control-item');
    if (parentItem) {
      parentItem.addEventListener('wheel', handleFontSizeWheel, { passive: false });
    }
  }
  updateFontSize(currentFontSize);

  // Lyrics Line Spacing initialization
  const savedLineSpacing = localStorage.getItem('kimo-lyrics-line-spacing');
  if (savedLineSpacing !== null && !isNaN(parseFloat(savedLineSpacing))) {
    document.documentElement.style.setProperty('--lyrics-line-spacing', parseFloat(savedLineSpacing));
  }

  // Lyrics Font Weight Slider Control
  // Supports dynamic continuous variable font weight mapping from 150 (Thin) to 900 (Heavy)
  let currentFontWeight = parseInt(localStorage.getItem('kimo-lyrics-font-weight')) || 400;

  const fontWeightSlider = document.getElementById('slider-font-weight');
  const fontWeightValue = document.getElementById('lyric-font-weight-value');
  
  const updateFontWeight = (weight) => {
    currentFontWeight = Math.max(150, Math.min(900, weight));
    
    // Apply actual variable font-weight dynamically to CSS variable
    document.documentElement.style.setProperty('--lyrics-font-weight', currentFontWeight);
    
    // Label display with both weight category and precise value for premium vibe
    let weightLabel = '常规';
    if (currentFontWeight < 250) weightLabel = '极细';
    else if (currentFontWeight < 350) weightLabel = '细';
    else if (currentFontWeight < 450) weightLabel = '常规';
    else if (currentFontWeight < 550) weightLabel = '中等';
    else if (currentFontWeight < 650) weightLabel = '半粗';
    else if (currentFontWeight < 750) weightLabel = '粗';
    else weightLabel = '极粗';

    if (fontWeightSlider) fontWeightSlider.value = currentFontWeight;
    if (fontWeightValue) fontWeightValue.innerText = `字重: ${weightLabel} (${currentFontWeight})`;
    if (player && player.lyrics) player.lyrics.resetAlignmentCache();
  };
  
  if (fontWeightSlider) {
    // Set appropriate range attributes dynamically in case HTML attributes are static
    fontWeightSlider.min = 150;
    fontWeightSlider.max = 900;
    fontWeightSlider.step = 1;
    fontWeightSlider.value = currentFontWeight;
    
    // Butter smooth real-time DOM update on drag
    fontWeightSlider.addEventListener('input', (e) => {
      updateFontWeight(parseInt(e.target.value));
    });
    // High performance persistent save exactly once when drag ends
    fontWeightSlider.addEventListener('change', (e) => {
      localStorage.setItem('kimo-lyrics-font-weight', currentFontWeight);
    });

    // ⭐ MOUSE WHEEL ADJUSTMENT: Ultra-smooth scrolling shifts font weight by 10
    const handleFontWeightWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      const nextWeight = Math.max(150, Math.min(900, currentFontWeight + delta));
      updateFontWeight(nextWeight);
      localStorage.setItem('kimo-lyrics-font-weight', nextWeight);
    };
    fontWeightSlider.addEventListener('wheel', handleFontWeightWheel, { passive: false });
    const parentItem = fontWeightSlider.closest('.lyrics-control-item');
    if (parentItem) {
      parentItem.addEventListener('wheel', handleFontWeightWheel, { passive: false });
    }
  }
  updateFontWeight(currentFontWeight);

  // Lyrics Alignment Toggle
  const alignBtn = document.getElementById('btn-align-toggle');
  const scrollEl = document.getElementById('lyrics-scroll');
  let currentAlign = localStorage.getItem('kimo-lyrics-align') || 'center';

  const applyAlign = (align) => {
    if (!scrollEl || !alignBtn) return;
    if (align === 'left') {
      scrollEl.classList.remove('align-center');
      scrollEl.classList.add('align-left');
      alignBtn.classList.add('left-active');
    } else {
      scrollEl.classList.remove('align-left');
      scrollEl.classList.add('align-center');
      alignBtn.classList.remove('left-active');
    }
    if (player && player.lyrics) player.lyrics.resetAlignmentCache();
  };

  if (alignBtn) {
    applyAlign(currentAlign);
    alignBtn.addEventListener('click', () => {
      currentAlign = currentAlign === 'center' ? 'left' : 'center';
      localStorage.setItem('kimo-lyrics-align', currentAlign);
      applyAlign(currentAlign);
    });
  }

  // Lyrics Timing Offset Slider Control
  let currentTimeOffset = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
  const lyricOffsetSlider = document.getElementById('slider-lyric-offset');
  const lyricOffsetValue = document.getElementById('lyric-offset-value');
  
  const updateOffsetLabel = (val) => {
    if (!lyricOffsetValue) return;
    if (val === 0) {
      lyricOffsetValue.innerText = '无延迟(0.0s)';
    } else if (val > 0) {
      lyricOffsetValue.innerText = `延迟 +${val.toFixed(1)}s`;
    } else {
      lyricOffsetValue.innerText = `提前 ${val.toFixed(1)}s`;
    }
  };

  if (lyricOffsetSlider) {
    lyricOffsetSlider.value = currentTimeOffset;
    updateOffsetLabel(currentTimeOffset);
    
    // Real-time label updates on drag for responsive visual feedback
    lyricOffsetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateOffsetLabel(val);
    });
    
    // Save to local storage and sync immediately on drag release/change
    lyricOffsetSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-time-offset', val);
      updateOffsetLabel(val);
      // Instantly refresh the lyrics position to align with the new time base
      if (player.lyrics && player.audio) {
        player.lyrics.syncToTime(player.audio.currentTime);
      }
    });

    // ⭐ MOUSE WHEEL ADJUSTMENT: Tweak lyrics delay in 0.1s steps smoothly on wheel roll
    const handleOffsetWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const min = parseFloat(lyricOffsetSlider.min) || -5.0;
      const max = parseFloat(lyricOffsetSlider.max) || 5.0;
      const nextVal = Math.max(min, Math.min(max, currentTimeOffset + delta));
      currentTimeOffset = nextVal;
      updateOffsetLabel(nextVal);
      localStorage.setItem('kimo-lyrics-time-offset', nextVal);
      if (player.lyrics && player.audio) {
        player.lyrics.syncToTime(player.audio.currentTime);
      }
    };
    lyricOffsetSlider.addEventListener('wheel', handleOffsetWheel, { passive: false });
    const parentItem = lyricOffsetSlider.closest('.lyrics-control-item');
    if (parentItem) {
      parentItem.addEventListener('wheel', handleOffsetWheel, { passive: false });
    }
  }

  // Lyrics Scroll Alignment Height Slider Control (kimo-lyrics-scroll-align)
  let currentScrollAlign = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
  const lyricAlignSlider = document.getElementById('slider-lyric-align');
  const lyricAlignValue = document.getElementById('lyric-align-value');

  const updateAlignLabel = (val) => {
    if (!lyricAlignValue) return;
    const percentage = Math.round(val * 100);
    if (val === 0.35) {
      lyricAlignValue.innerText = `默认居中偏上 (${percentage}%)`;
    } else if (val < 0.35) {
      lyricAlignValue.innerText = `偏上 (${percentage}%)`;
    } else {
      lyricAlignValue.innerText = `偏下 (${percentage}%)`;
    }
  };

  if (lyricAlignSlider) {
    lyricAlignSlider.value = currentScrollAlign;
    updateAlignLabel(currentScrollAlign);

    // Real-time label updates and scroll adjustment on drag
    lyricAlignSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateAlignLabel(val);
      localStorage.setItem('kimo-lyrics-scroll-align', val);
      if (player.lyrics) {
        player.lyrics.realign();
      }
    });

    // Save persistently on change release
    lyricAlignSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-scroll-align', val);
      updateAlignLabel(val);
      if (player.lyrics) {
        player.lyrics.realign();
      }
    });

    // ⭐ MOUSE WHEEL ADJUSTMENT: Tweak scroll vertical alignment (y-offset center percentage) in 5% steps
    const handleAlignWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const min = parseFloat(lyricAlignSlider.min) || 0.1;
      const max = parseFloat(lyricAlignSlider.max) || 0.8;
      const nextVal = Math.max(min, Math.min(max, currentScrollAlign + delta));
      currentScrollAlign = nextVal;
      updateAlignLabel(nextVal);
      localStorage.setItem('kimo-lyrics-scroll-align', nextVal);
      if (player.lyrics) {
        player.lyrics.realign();
      }
    };
    lyricAlignSlider.addEventListener('wheel', handleAlignWheel, { passive: false });
    const parentAlignItem = lyricAlignSlider.closest('.lyrics-control-item');
    if (parentAlignItem) {
      parentAlignItem.addEventListener('wheel', handleAlignWheel, { passive: false });
    }
  }

  // Lyrics Lift Amplitude Slider Control (slider-lyric-lift)
  let currentLiftAmp = parseFloat(localStorage.getItem('kimo-lyrics-lift-amplitude')) ?? 4.0;
  const lyricLiftSlider = document.getElementById('slider-lyric-lift');
  const lyricLiftValue = document.getElementById('lyric-lift-value');

  const updateLiftLabel = (val) => {
    if (!lyricLiftValue) return;
    lyricLiftValue.innerText = `抬起: ${val.toFixed(1)}px`;
  };

  if (lyricLiftSlider) {
    lyricLiftSlider.value = currentLiftAmp;
    updateLiftLabel(currentLiftAmp);

    // Real-time label updates and active render sync on drag
    lyricLiftSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateLiftLabel(val);
      localStorage.setItem('kimo-lyrics-lift-amplitude', val);
      if (player.lyrics && player.audio) {
        player.lyrics.syncToTime(player.audio.currentTime);
      }
    });

    // Save persistently on change release
    lyricLiftSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-lift-amplitude', val);
      updateLiftLabel(val);
      if (player.lyrics && player.audio) {
        player.lyrics.syncToTime(player.audio.currentTime);
      }
    });

    // ⭐ MOUSE WHEEL ADJUSTMENT: Tweak lyric lift amplitude in 0.5px steps
    const handleLiftWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const min = parseFloat(lyricLiftSlider.min) || 0.0;
      const max = parseFloat(lyricLiftSlider.max) || 15.0;
      const nextVal = Math.max(min, Math.min(max, currentLiftAmp + delta));
      currentLiftAmp = nextVal;
      updateLiftLabel(nextVal);
      lyricLiftSlider.value = nextVal;
      localStorage.setItem('kimo-lyrics-lift-amplitude', nextVal);
      if (player.lyrics && player.audio) {
        player.lyrics.syncToTime(player.audio.currentTime);
      }
    };
    lyricLiftSlider.addEventListener('wheel', handleLiftWheel, { passive: false });
    const parentLiftItem = lyricLiftSlider.closest('.lyrics-control-item');
    if (parentLiftItem) {
      parentLiftItem.addEventListener('wheel', handleLiftWheel, { passive: false });
    }
  }

  // ⭐ Stagger Animation Mode Toggle Control (btn-stagger-toggle) ⭐
  const staggerToggleBtn = document.getElementById('btn-stagger-toggle');
  if (staggerToggleBtn) {
    staggerToggleBtn.addEventListener('click', () => {
      if (player.lyrics) {
        player.lyrics.toggleStaggerMode();
        if (player.audio) {
          player.lyrics.syncToTime(player.audio.currentTime);
        }
      }
    });
  }

  // Click back button to slide down lyrics
  document.getElementById('lyrics-back-btn')?.addEventListener('click', () => {
    player.lyrics.hide();
  });

  // Click player info panel (cover, title, artist) to slide up lyrics
  const triggerLyricsShow = () => {
    if (player.currentIndex >= 0) player.lyrics.show();
  };
  document.getElementById('player-meta-trigger')?.addEventListener('click', triggerLyricsShow);
  document.getElementById('player-bar-lyric-trigger')?.addEventListener('click', triggerLyricsShow);

  // Render Playlist Helper
  const renderPlaylist = (playlist) => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    playlist.forEach((song, idx) => {
      const div = document.createElement('div');
      const isCurrent = idx === player.currentIndex;
      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      const coverSrc = getCoverSrc(song.cover_image);
      
      const isPaused = player.audio.paused;
      div.innerHTML = `
        <img src="${coverSrc}" class="song-cover" />
        <div class="song-info">
          <div class="song-title">${song.title || 'Unknown'}</div>
          <div class="song-artist">${song.artist || 'Unknown'}</div>
        </div>
        <div class="eq-animation ${isPaused ? 'paused' : ''}">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>
        <div class="song-duration">${song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : ''}</div>
      `;
      div.addEventListener('click', () => player.play(idx));
      listEl.appendChild(div);
    });
  };

  // Background load missing covers from metadata on startup (avoids writing MBs to localStorage)
  const backgroundLoadCovers = async (playlist) => {
    const CONCURRENCY_LIMIT = 4;
    const queue = [...playlist.entries()];

    const worker = async () => {
      while (queue.length > 0) {
        const [index, song] = queue.shift();
        // ⭐ cover_image 为 null 或 undefined 时都需要重新加载（slim cache 把大封面置空）。
        if (song.cover_image === undefined || song.cover_image === null) {
          try {
            const meta = await invoke('read_audio_metadata', { path: song.file_path });
            song.cover_image = (meta && meta.cover_image) ? meta.cover_image : null;
            if (meta && meta.cover_image) {
              playlist[index] = song;

              // Dynamically update the cover image in the playlist DOM
              const songItems = document.querySelectorAll('.song-item');
              if (songItems[index]) {
                const coverImg = songItems[index].querySelector('.song-cover');
                if (coverImg) {
                  coverImg.src = getCoverSrc(song.cover_image);
                }
              }

              // Update the active player UI covers if this song happens to be the active one
              if (index === player.currentIndex) {
                player.updateUI(song);
                extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
                  song.dominant_color = color;
                  if (index === player.currentIndex) {
                    applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
                  }
                });
              }
            }
          } catch (err) {
            console.error('Failed to background load cover for:', song.file_path, err);
            song.cover_image = null;
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, playlist.length) }, worker);
    await Promise.all(workers);
  };

  // ══ Tab Management and Navigation System ══
  let currentTab = 'discover';
  let sessionRecommendations = null;

  // ⭐ 音乐库（与 player.playlist 分离）：本地扫描的全部歌曲，独立于当前播放队列⭐
  let musicLibrary = [];

  // ══ Tab Sub-States for Local Library & Helper Functions ══
  let currentSubTab = 'all'; // 'all', 'album', 'artist', 'genre'
  let currentDetailFilter = null; // null or { type: 'album'|'artist'|'genre', name: 'xxx' }

  // Global High Performance Toast Notice
  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'kimo-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  };
  window.showToast = showToast;

  const playSongCollection = (songs) => {
    if (!songs || songs.length === 0) return;
    player.playlist = [...songs];
    player.currentIndex = 0;
    player.play(0);
    if (currentTab === 'local') {
      renderLocalMusicTab();
    } else if (currentTab === 'recent') {
      renderRecentPlaysTab();
    }
  };

  const renderCategoryDetail = (listEl, filter) => {
    let filteredSongs = [];
    let titleLabel = '';
    let subtitleLabel = '';

    if (filter.type === 'album') {
      filteredSongs = musicLibrary.filter(s => (s.album || '未知专辑') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `专辑 ? ${filteredSongs.length} 首歌曲`;
    } else if (filter.type === 'artist') {
      filteredSongs = musicLibrary.filter(s => (s.artist || '未知艺术家') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `艺术家 ? ${filteredSongs.length} 首歌曲`;
    } else if (filter.type === 'genre') {
      filteredSongs = musicLibrary.filter(s => (s.genre || '未知流派') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `流派 ? ${filteredSongs.length} 首歌曲`;
    }

    const header = document.createElement('div');
    header.className = 'detail-header';
    header.className = "detail-header";
    header.innerHTML = `
      <button class="detail-back-btn" title="返回">
      </button>
      <div class="detail-title-info">
        <div class="detail-title">${titleLabel}</div>
        <div class="detail-subtitle">${subtitleLabel}</div>
      </div>
    `;

    header.querySelector('.detail-back-btn').addEventListener('click', () => {
      currentDetailFilter = null;
      renderLocalMusicTab();
      listEl.classList.remove('fade-in-up');
      void listEl.offsetWidth;
      listEl.classList.add('fade-in-up');
    });

    const songsListContainer = document.createElement('div');
    songsListContainer.className = 'list-songs-container';
    listEl.appendChild(songsListContainer);

    filteredSongs.forEach(song => {
      const div = document.createElement('div');
      const mainIdx = player.playlist.findIndex(s => s.file_path === song.file_path);
      const isCurrent = mainIdx >= 0 && mainIdx === player.currentIndex;
      
      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      const coverSrc = getCoverSrc(song.cover_image);
      const isPaused = player.audio.paused;

      div.innerHTML = `
        <img src="${coverSrc}" class="song-cover" />
        <div class="song-info">
          <div class="song-title">${song.title || 'Unknown'}</div>
          <div class="song-artist">${song.artist || 'Unknown'}</div>
        </div>
        <div class="eq-animation ${isPaused ? 'paused' : ''}">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>
        <div class="song-duration">${song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : ''}</div>
      `;

      div.addEventListener('click', () => {
        // ⭐ 点击播放：先替换播放列表为当前分类的歌曲，再播放该首 ⭐
        player.playlist = [...filteredSongs];
        player.play(filteredSongs.indexOf(song));
      });

      songsListContainer.appendChild(div);
    });
  };

  const renderLocalMusicTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (musicLibrary.length === 0) {
      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); gap: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <div style="font-size: 14px; font-weight: 500;">您的本地音乐库为空，请在设置中"添加扫描文件夹"后点击扫描</div>
        </div>
      `;
      return;
    }

    if (currentDetailFilter) {
      renderCategoryDetail(listEl, currentDetailFilter);
      return;
    }

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'local-tabs';
    tabsContainer.innerHTML = `
      <button class="local-tab-btn ${currentSubTab === 'all' ? 'active' : ''}" data-subtab="all">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        全部歌曲
      </button>
      <button class="local-tab-btn ${currentSubTab === 'album' ? 'active' : ''}" data-subtab="album">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        专辑
      </button>
      <button class="local-tab-btn ${currentSubTab === 'artist' ? 'active' : ''}" data-subtab="artist">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        艺术瀹?
      </button>
      <button class="local-tab-btn ${currentSubTab === 'genre' ? 'active' : ''}" data-subtab="genre">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        流派
      </button>
    `;
    listEl.appendChild(tabsContainer);

    // Set initial scrolled state if container is already scrolled
    const initialContentArea = document.querySelector('.content-area');
    if (initialContentArea && initialContentArea.scrollTop > 5) {
      tabsContainer.classList.add('scrolled');
    }

    tabsContainer.querySelectorAll('.local-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        currentSubTab = sub;
        currentDetailFilter = null;
        renderLocalMusicTab();
        
        const contentEl = listEl.querySelector('.list-songs-container, .albums-grid, .artists-grid, .genres-grid');
        if (contentEl) {
          contentEl.classList.remove('fade-in-up');
          void contentEl.offsetWidth;
          contentEl.classList.add('fade-in-up');
        }
      });
    });

    if (currentSubTab === 'all') {
      const songsListContainer = document.createElement('div');
      songsListContainer.id = 'local-songs-list';
      songsListContainer.className = 'list-songs-container';
      listEl.appendChild(songsListContainer);

      const renderAllSongs = () => {
        songsListContainer.innerHTML = '';
        if (musicLibrary.length === 0) {
          songsListContainer.innerHTML = `
            <div class="search-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <div style="font-size: 14px; font-weight: 500;">本地音乐列表为空</div>
            </div>
          `;
          return;
        }

        musicLibrary.forEach((song) => {
          const div = document.createElement('div');
          const currentSongPath = player.playlist[player.currentIndex]?.file_path;
          const isCurrent = currentSongPath === song.file_path;

          div.className = `song-item${isCurrent ? ' playing' : ''}`;
          div.setAttribute('data-file-path', song.file_path);
          const coverSrc = getCoverSrc(song.cover_image);
          const isPaused = player.audio.paused;

          div.innerHTML = `
            <img src="${coverSrc}" class="song-cover" />
            <div class="song-info">
              <div class="song-title">${song.title || 'Unknown'}</div>
              <div class="song-artist">${song.artist || 'Unknown'}</div>
            </div>
            <div class="eq-animation ${isPaused ? 'paused' : ''}">
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
            </div>
            <div class="song-duration">${song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : ''}</div>
          `;

          div.addEventListener('click', () => {
            // ⭐ 全部歌曲视图：点击播放时，如果当前播放列表是空的就用整个音乐库，否则用当前播放列表的索引播放 ⭐
            const idx = player.playlist.findIndex(s => s.file_path === song.file_path);
            if (idx >= 0) {
              player.play(idx);
            } else {
              // 歌曲不在当前播放列表：把音乐库设为播放列行
              player.playlist = [...musicLibrary];
              player.play(musicLibrary.findIndex(s => s.file_path === song.file_path));
            }
          });

          songsListContainer.appendChild(div);
        });
      };

      renderAllSongs();

    } else if (currentSubTab === 'album') {
      const albums = {};
      musicLibrary.forEach(song => {
        const albumName = song.album || '未知专辑';
        if (!albums[albumName]) {
          albums[albumName] = {
            name: albumName,
            cover: song.cover_image,
            songs: []
          };
        }
        albums[albumName].songs.push(song);
      });

      const albumsGrid = document.createElement('div');
      albumsGrid.className = 'albums-grid';
      
      Object.keys(albums).forEach(albumName => {
        const album = albums[albumName];
        const card = document.createElement('div');
        card.className = 'album-card';
        const coverSrc = getCoverSrc(album.cover);
        
        card.innerHTML = `
          <div class="album-cover-wrapper">
            <img class="album-card-cover" src="${coverSrc}" />
            <div class="album-card-play">
              <div class="album-card-play-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
          </div>
          <div class="album-card-info">
            <div class="album-card-title">${albumName}</div>
            <div class="album-card-count">${album.songs.length} 首歌鏇?/div>
          </div>
        `;
        
        card.addEventListener('click', (e) => {
          const playBtn = card.querySelector('.album-card-play-btn');
          if (playBtn && (playBtn.contains(e.target) || e.target === playBtn)) {
            e.stopPropagation();
            playSongCollection(album.songs);
            return;
          }
          currentDetailFilter = { type: 'album', name: albumName };
          renderLocalMusicTab();
          listEl.classList.remove('fade-in-up');
          void listEl.offsetWidth;
          listEl.classList.add('fade-in-up');
        });
        
        albumsGrid.appendChild(card);
      });
      listEl.appendChild(albumsGrid);

    } else if (currentSubTab === 'artist') {
      const artists = {};
      musicLibrary.forEach(song => {
        const artistName = song.artist || '未知艺术家';
        if (!artists[artistName]) {
          artists[artistName] = {
            name: artistName,
            cover: song.cover_image,
            songs: []
          };
        }
        artists[artistName].songs.push(song);
      });

      const artistsGrid = document.createElement('div');
      artistsGrid.className = 'artists-grid';
      
      Object.keys(artists).forEach(artistName => {
        const artist = artists[artistName];
        const card = document.createElement('div');
        card.className = 'artist-card';
        const coverSrc = getCoverSrc(artist.cover);
        
        card.innerHTML = `
          <div class="artist-avatar-wrapper">
            <img class="artist-card-avatar" src="${coverSrc}" />
          </div>
          <div class="artist-card-title">${artistName}</div>
          <div class="artist-card-count">${artist.songs.length} 首歌鏇?/div>
        `;
        
        card.addEventListener('click', () => {
          currentDetailFilter = { type: 'artist', name: artistName };
          renderLocalMusicTab();
          listEl.classList.remove('fade-in-up');
          void listEl.offsetWidth;
          listEl.classList.add('fade-in-up');
        });
        
        artistsGrid.appendChild(card);
      });
      listEl.appendChild(artistsGrid);

    } else if (currentSubTab === 'genre') {
      const genres = {};
      musicLibrary.forEach(song => {
        const genreName = song.genre || '未知流派';
        if (!genres[genreName]) {
          genres[genreName] = {
            name: genreName,
            songs: []
          };
        }
        genres[genreName].songs.push(song);
      });

      const genresGrid = document.createElement('div');
      genresGrid.className = 'genres-grid';

      const gradients = [
        'linear-gradient(135deg, #f53b57 0%, #3c40c6 100%)',
        'linear-gradient(135deg, #05c46b 0%, #0fbcf9 100%)',
        'linear-gradient(135deg, #ffc048 0%, #ff5e57 100%)',
        'linear-gradient(135deg, #575fcf 0%, #f53b57 100%)',
        'linear-gradient(135deg, #0be881 0%, #05c46b 100%)',
        'linear-gradient(135deg, #4bcffa 0%, #3c40c6 100%)',
      ];
      const getGenreGradient = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return gradients[Math.abs(hash) % gradients.length];
      };

      Object.keys(genres).forEach(genreName => {
        const genre = genres[genreName];
        const card = document.createElement('div');
        card.className = 'genre-card';
        card.style.background = getGenreGradient(genreName);
        
        card.innerHTML = `
          <div class="genre-card-title">${genreName}</div>
          <div class="genre-card-count">${genre.songs.length} 首歌鏇?/div>
        `;
        
        card.addEventListener('click', () => {
          currentDetailFilter = { type: 'genre', name: genreName };
          renderLocalMusicTab();
          listEl.classList.remove('fade-in-up');
          void listEl.offsetWidth;
          listEl.classList.add('fade-in-up');
        });
        
        genresGrid.appendChild(card);
      });
      listEl.appendChild(genresGrid);
    }
  };

  // ========== 自定义弹窗（替代浏览器原生 prompt/confirm，避免 WebView 里的丑陋样式）。==========
  const customPrompt = (message, defaultValue = '', placeholder = '') => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'kimo-modal-overlay';
      overlay.style.background = 'none';
      overlay.style.backdropFilter = 'none';
      overlay.innerHTML = `<div class="kimo-modal-card" style="max-width:380px;width:90%;padding:22px 22px 18px;text-align:left;">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:14px;">${message}</div>
        <input type="text" class="kimo-prompt-input" id="kimo-prompt-input" value="${(defaultValue || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="${placeholder}" />
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button data-act="cancel" class="kimo-modal-btn-cancel">取消</button>
          <button data-act="ok" style="padding:7px 18px;font-size:13px;background:rgb(var(--dynamic-color,16,185,129));border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:600;">确定</button>
        </div>
      </div>`;
      const finish = (val) => {
        overlay.style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.transform = 'scale(0.9) translateY(20px)';
        setTimeout(() => { overlay.remove(); resolve(val); }, 200);
      };
      overlay.addEventListener('click', (e) => {
        const act = e.target.dataset?.act;
        if (act === 'ok') finish(overlay.querySelector('#kimo-prompt-input').value);
        else if (act === 'cancel' || e.target === overlay) finish(null);
      });
      const input = overlay.querySelector('#kimo-prompt-input');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(input.value);
        else if (e.key === 'Escape') finish(null);
      });
      document.body.appendChild(overlay);
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  };

  const customConfirm = (message) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'kimo-modal-overlay';
      overlay.style.background = 'none';
      overlay.style.backdropFilter = 'none';
      overlay.innerHTML = `<div class="kimo-modal-card" style="max-width:360px;width:90%;padding:22px;text-align:left;">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">确认</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">${message}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
          <button data-act="cancel" class="kimo-modal-btn-cancel">取消</button>
          <button data-act="ok" style="padding:7px 18px;font-size:13px;background:rgb(var(--dynamic-color,239,68,68));border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:600;">确定</button>
        </div>
      </div>`;
      const finish = (val) => {
        overlay.style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.transform = 'scale(0.9) translateY(20px)';
        setTimeout(() => { overlay.remove(); resolve(val); }, 200);
      };
      overlay.addEventListener('click', (e) => {
        const act = e.target.dataset?.act;
        if (act === 'ok') finish(true);
        else if (act === 'cancel' || e.target === overlay) finish(false);
      });
      const keyHandler = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', keyHandler); finish(false); }
      };
      document.addEventListener('keydown', keyHandler);
      document.body.appendChild(overlay);
    });
  };

  // ========== 歌单模块 (1.3) ==========
  const PLAYLISTS_KEY = 'kimo-playlists';

  const getPlaylists = () => {
    try { return JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]'); } catch (e) { return []; }
  };
  const savePlaylists = (list) => localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(list));

  // 生成简短唯一 ID
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 解析 M3U/M3U8 文件内容 鈫?{ name, songs: [] }
  const parseM3U = (content) => {
    const lines = content.split(/\r?\n/);
    const songs = [];
    let playlistName = null;
    let currentMeta = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line === '\r') continue;
      if (line.startsWith('#PLAYLIST:')) {
        playlistName = line.slice('#PLAYLIST:'.length).trim() || null;
      } else if (line.startsWith('#EXTINF:')) {
        const m = line.match(/^#EXTINF:([^,]*),(.+)$/);
        if (m) {
          const dur = parseFloat(m[1]) || 0;
          const label = m[2].trim();
          const dash = label.lastIndexOf(' - ');
          const artist = dash > 0 ? label.slice(0, dash).trim() : '';
          const title = dash > 0 ? label.slice(dash + 3).trim() : label;
          currentMeta = { artist, title, duration: Math.round(dur), label };
        }
      } else if (!line.startsWith('#')) {
        // 文件路径：如果不是绝对路径，则尝试相对于 M3U 文件所在目录解鏋?
        let filePath = line;
        if (!/^[A-Za-z]:/.test(line) && !line.startsWith('/') && !line.startsWith('\\\\')) {
          filePath = line; // 存原始相对路径，播放时由上层解析
        }
        const entry = { file_path: filePath.replace(/\\/g, '/') };
        if (currentMeta) {
          entry.title = currentMeta.title;
          entry.artist = currentMeta.artist;
          entry.duration = currentMeta.duration;
          currentMeta = null;
        } else {
          // 无元数据时用文件名推鏂?
          const name = line.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
          const dash = name.lastIndexOf(' - ');
          entry.artist = dash > 0 ? name.slice(0, dash).trim() : '';
          entry.title = dash > 0 ? name.slice(dash + 3).trim() : name;
          entry.duration = 0;
        }
        songs.push(entry);
      }
    }
    return { name: playlistName || '导入的歌鍗', songs };
  };

  // 灏?M3U 导入为新歌单
  const importM3UPlaylist = async (file) => {
    const text = await file.text();
    const parsed = parseM3U(text);
    const pl = {
      id: genId(),
      name: parsed.name || file.name.replace(/\.m3u8?$/i, ''),
      songs: parsed.songs,
      source: 'm3u',
      createdAt: Date.now(),
    };
    const all = getPlaylists();
    all.unshift(pl);
    savePlaylists(all);
    return pl;
  };

  // 创建手动歌单
  const createManualPlaylist = (name) => {
    const pl = { id: genId(), name, songs: [], source: 'manual', createdAt: Date.now() };
    const all = getPlaylists();
    all.unshift(pl);
    savePlaylists(all);
    return pl;
  };

  // 删除歌单
  const deletePlaylistById = (id) => {
    const all = getPlaylists().filter(p => p.id !== id);
    savePlaylists(all);
  };

  // 添加歌曲到歌单
  const addSongToPlaylist = (playlistId, song) => {
    const all = getPlaylists();
    const pl = all.find(p => p.id === playlistId);
    if (!pl) return false;
    const entry = {
      file_path: song.file_path || song.path || '',
      title: song.title || '未知',
      artist: song.artist || '',
      album: song.album || '',
      duration: typeof song.duration === 'number' ? song.duration : 0,
      cover_image: song.cover_image || '',
    };
    // 去重
    if (pl.songs.every(s => s.file_path !== entry.file_path)) {
      pl.songs.push(entry);
      savePlaylists(all);

      // ⭐ 如果没有封面，异步读可metadata 补全 ⭐
      if (!entry.cover_image) {
        (async () => {
          try {
            const meta = await invoke('read_audio_metadata', { path: entry.file_path });
            if (meta && meta.cover_image) {
              entry.cover_image = meta.cover_image;
              savePlaylists(all);
            }
          } catch (err) {
            console.error('Failed to fetch cover for playlist song:', entry.file_path, err);
          }
        })();
      }
    }
    return true;
  };

  // 删除歌单中歌鏇?
  const removeSongFromPlaylist = (playlistId, idx) => {
    const all = getPlaylists();
    const pl = all.find(p => p.id === playlistId);
    if (!pl) return;
    pl.songs.splice(idx, 1);
    savePlaylists(all);
  };

  // ========== 默认「我喜欢」歌单==========
  const LIKED_PLAYLIST_ID = '__liked__';

  const getLikedPlaylist = () => {
    const all = getPlaylists();
    let liked = all.find(p => p.id === LIKED_PLAYLIST_ID);
    if (!liked) {
      liked = { id: LIKED_PLAYLIST_ID, name: '我喜娆', songs: [], source: 'manual', createdAt: Date.now() };
      all.unshift(liked);
      savePlaylists(all);
    }
    return liked;
  };
  getLikedPlaylist(); // 确保第一次启动就有这个歌单

  const isSongLiked = (filePath) => {
    return getLikedPlaylist().songs.some(s => s.file_path === filePath);
  };

  const toggleLikeSong = (songData) => {
    const all = getPlaylists();
    const liked = all.find(p => p.id === LIKED_PLAYLIST_ID);
    if (!liked) return;
    const filePath = songData.file_path || songData.path || '';
    const idx = liked.songs.findIndex(s => s.file_path === filePath);
    if (idx >= 0) {
      liked.songs.splice(idx, 1);
    } else {
      liked.songs.push({
        file_path: filePath,
        title: songData.title || '',
        artist: songData.artist || '',
        album: songData.album || '',
        duration: typeof songData.duration === 'number' ? songData.duration : 0,
        cover_image: songData.cover_image || '',
      });
    }
    savePlaylists(all);       // all 鍜?liked 是同一个数组里的同一个对象，变更会被保存
    updateHeartButton();
    const likedNow = isSongLiked(filePath);
    showToast(likedNow ? '已添加到我喜娆' : '已从我喜欢移闄');
  };

  const updateHeartButton = () => {
    const outline = document.getElementById('like-icon-outline');
    const filled = document.getElementById('like-icon-filled');
    if (!outline || !filled) return;
    try {
      const track = (player.currentIndex >= 0 && player.playlist) ? player.playlist[player.currentIndex] : null;
      const filePath = track?.file_path || track?.path || '';
      const liked = filePath ? isSongLiked(filePath) : false;
      outline.style.display = liked ? 'none' : '';
      filled.style.display = liked ? '' : 'none';
    } catch (_) {
      outline.style.display = '';
      filled.style.display = 'none';
    }
  };

  document.getElementById('like-btn')?.addEventListener('click', () => {
    try {
      const track = (player.currentIndex >= 0 && player.playlist) ? player.playlist[player.currentIndex] : null;
      if (!track) { showToast('暂无播放歌曲'); return; }
      const songData = {
        file_path: track.file_path || track.path || '',
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        duration: track.duration || 0,
        cover_image: track.cover_image || '',
      };
      toggleLikeSong(songData);
    } catch (e) { showToast('操作失败'); }
  });

  // ⭐ 播放列表弹出面板 ⭐
  const playlistPanel = document.getElementById('playlist-panel');
  const playlistPanelList = document.getElementById('playlist-panel-list');
  const playlistPanelCount = document.getElementById('playlist-panel-count');
  const playlistPanelClear = document.getElementById('playlist-panel-clear');
  const playlistPanelBtn = document.getElementById('playlist-panel-btn');

  const renderPlaylistPanel = () => {
    if (!playlistPanelList) return;
    playlistPanelList.innerHTML = '';
    playlistPanelCount.textContent = `${player.playlist.length} 首歌曲`;

    player.playlist.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = `playlist-panel-item${idx === player.currentIndex ? ' is-current' : ''}`;

      // 封面
      const cover = document.createElement('img');
      cover.className = 'playlist-panel-item-cover';
      cover.src = getCoverSrc(song.cover_image);
      item.appendChild(cover);

      // 信息
      const info = document.createElement('div');
      info.className = 'playlist-panel-item-info';
      const t = document.createElement('div');
      t.className = 'playlist-panel-item-title';
      t.textContent = song.title || '未知';
      info.appendChild(t);
      const a = document.createElement('div');
      a.className = 'playlist-panel-item-artist';
      a.textContent = song.artist || '未知歌手';
      info.appendChild(a);
      item.appendChild(info);

      // 时长
      const dur = document.createElement('span');
      dur.className = 'playlist-panel-item-duration';
      dur.textContent = song.duration > 0 ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '';
      item.appendChild(dur);

      // 删除
      const rm = document.createElement('button');
      rm.className = 'playlist-panel-item-remove';
      rm.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      rm.title = '移除';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        player.playlist.splice(idx, 1);
        if (idx < player.currentIndex) player.currentIndex--;
        else if (idx === player.currentIndex && player.playlist.length > 0) {
          player.play(Math.min(idx, player.playlist.length - 1));
        } else if (player.playlist.length === 0) {
          player.currentIndex = -1;
          player.audio.pause();
        }
        renderPlaylistPanel();
      });
      item.appendChild(rm);

      // 点击播放
      item.addEventListener('click', () => {
        player.play(idx);
      });

      playlistPanelList.appendChild(item);
    });

    // ⭐ 渲染后自动滚动到当前播放 ⭐
    const currentItem = playlistPanelList.querySelector('.is-current');
    if (currentItem) {
      currentItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // ⭐ 实时更新当前播放标记（不重新渲染整个列表，保持滚动位置和动画状态）⭐
  const updatePlaylistPanelCurrent = () => {
    if (!playlistPanelList || !playlistPanel.classList.contains('is-visible')) return;
    const items = playlistPanelList.querySelectorAll('.playlist-panel-item');
    items.forEach((item, idx) => {
      if (idx === player.currentIndex) {
        item.classList.add('is-current');
        // 平滑滚动到当前播放位缃?
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('is-current');
      }
    });
  };

  // 暴露给 AudioPlayer 用于播放切换时调用
  window.updatePlaylistPanelCurrent = updatePlaylistPanelCurrent;

  playlistPanelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playlistPanel.classList.contains('is-visible')) {
      playlistPanel.classList.remove('is-visible');
    } else {
      renderPlaylistPanel();
      playlistPanel.classList.add('is-visible');
    }
  });

  playlistPanelClear?.addEventListener('click', () => {
    player.playlist = [];
    player.currentIndex = -1;
    player.audio.pause();
    renderPlaylistPanel();
    showToast('已清空播放列琛');
  });

  // 点击面板外关闭
  document.addEventListener('click', (e) => {
    if (playlistPanel.classList.contains('is-visible') && !playlistPanel.contains(e.target) && !playlistPanelBtn.contains(e.target)) {
      playlistPanel.classList.remove('is-visible');
    }
  });

  // ========== 歌单 UI ==========
  let playlistViewMode = 'list';    // 'list' | 'detail'
  let currentPlaylistId = null;

  const switchToPlaylistListView = () => {
    playlistViewMode = 'list';
    currentPlaylistId = null;
    renderPlaylistsTab();
  };

  const switchToPlaylistDetail = (playlistId) => {
    playlistViewMode = 'detail';
    currentPlaylistId = playlistId;
    renderPlaylistsTab();
  };

  const renderPlaylistsTab = () => {
    const listEl = document.getElementById('music-list');
    const countEl = document.getElementById('music-count');
    if (!listEl) return;
    if (countEl) countEl.style.display = 'none';

    const playlists = getPlaylists();
    listEl.innerHTML = '';

    // ======== 歌单列表视图 ========
    if (playlistViewMode === 'list') {
      // 头部操作化
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding:0 2px;';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:16px;font-weight:600;color:var(--text-primary);';
      title.textContent = `我的歌单 路 ${playlists.length}`;
      header.appendChild(title);

      const actWrap = document.createElement('div');
      actWrap.style.cssText = 'display:flex;gap:8px;';

      // 导入 M3U
      const impBtn = document.createElement('button');
      impBtn.className = 'setting-btn';
      impBtn.style.cssText = 'font-size:12px;padding:5px 12px;';
      impBtn.textContent = '馃搧 导入 M3U';
      impBtn.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.m3u,.m3u8';
        inp.style.display = 'none';
        inp.addEventListener('change', async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            const pl = await importM3UPlaylist(f);
            renderPlaylistsTab();
            showToast(`已导入 ${pl.name} · ${pl.songs.length} 首歌曲`);
          } catch (err) {
            showToast('M3U 解析失败: ' + err.message);
          }
        });
        document.body.appendChild(inp);
        inp.click();
        setTimeout(() => inp.remove(), 200);
      });
      actWrap.appendChild(impBtn);

      // 新建空歌单
      const newBtn = document.createElement('button');
      newBtn.className = 'setting-btn';
      newBtn.style.cssText = 'font-size:12px;padding:5px 12px;';
      newBtn.textContent = '+ 新建歌单';
      newBtn.addEventListener('click', async () => {
        const name = await customPrompt('新建歌单', '', '请输入歌单名绉');
        if (!name || !name.trim()) return;
        createManualPlaylist(name.trim());
        renderPlaylistsTab();
        showToast(`已创寤? ${name.trim()}`);
      });
      actWrap.appendChild(newBtn);
      header.appendChild(actWrap);
      listEl.appendChild(header);

      // 歌单列表卡片
      if (playlists.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:60px 0;color:var(--text-secondary);font-size:14px;';
        empty.textContent = '还没有歌单，点击上方按钮新建或导入M3U 吧！';
        listEl.appendChild(empty);
        return;
      }

      playlists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'song-item music-list-item';
        card.style.cssText = 'display:flex;align-items:center;gap:14px;cursor:pointer;';

        // 封面拼图（取前四首歌鍋?2脳2）。
        const coverWrap = document.createElement('div');
        coverWrap.className = 'playlist-card-cover';
        if (pl.songs.length > 0) {
          const first4 = pl.songs.slice(0, 4);
          while (first4.length < 4) first4.push(first4[0] || {});
          first4.forEach((s, i) => {
            const cell = document.createElement('img');
            cell.className = 'playlist-card-cover-cell';
            cell.src = getCoverSrc(s.cover_image);
            cell.alt = '';
            coverWrap.appendChild(cell);
          });
        } else {
          const ph = document.createElement('div');
          ph.className = 'playlist-card-cover-empty';
          ph.textContent = '馃幍';
          coverWrap.appendChild(ph);
        }
        card.appendChild(coverWrap);

        // 信息化
        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        const nm = document.createElement('div');
        nm.style.cssText = 'font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nm.textContent = pl.name;
        info.appendChild(nm);
        const sub = document.createElement('div');
        sub.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-top:2px;';
        const src = pl.source === 'm3u' ? 'M3U 导入' : '手动创建';
        sub.textContent = `${pl.songs.length} 棣?路 ${src}`;
        info.appendChild(sub);
        card.appendChild(info);

        // 操作按钮
        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px;padding:4px;opacity:0.5;transition:opacity 0.15s;flex-shrink:0;';
        delBtn.textContent = '馃棏';
        delBtn.title = '删除歌单';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await customConfirm(`确定删除歌单"${pl.name}"吗？此操作不可恢复。`)) {
            deletePlaylistById(pl.id);
            renderPlaylistsTab();
            showToast('已删闄');
          }
        });
        card.appendChild(delBtn);

        card.addEventListener('click', () => switchToPlaylistDetail(pl.id));
        listEl.appendChild(card);
      });
      return;
    }

    // ======== 歌单详情视图 ========
    const pl = getPlaylists().find(p => p.id === currentPlaylistId);
    if (!pl) { switchToPlaylistListView(); return; }

    // 顶部鏍?
    const topBar = document.createElement('div');
    topBar.className = 'playlist-detail-header';

    const backWrap = document.createElement('div');
    backWrap.className = 'playlist-detail-back';
    const backBtn = document.createElement('button');
    backBtn.className = 'playlist-detail-back-btn';
    backBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    backBtn.title = '返回歌单列表';
    backBtn.addEventListener('click', switchToPlaylistListView);
    backWrap.appendChild(backBtn);
    const nmEl = document.createElement('span');
    nmEl.className = 'playlist-detail-title';
    nmEl.textContent = pl.name;
    backWrap.appendChild(nmEl);
    topBar.appendChild(backWrap);

    const playAllBtn = document.createElement('button');
    playAllBtn.className = 'playlist-detail-play-all';
    playAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 播放全部 (${pl.songs.length})`;
    playAllBtn.addEventListener('click', () => {
      if (pl.songs.length === 0) return showToast('歌单为空');
      // ⭐ 直接替换播放列表为歌单歌鏇?⭐
      player.playlist = [...pl.songs];
      player.play(0);
    });
    topBar.appendChild(playAllBtn);
    listEl.appendChild(topBar);

    // 歌曲列表
    if (pl.songs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'playlist-detail-empty';
      empty.textContent = '歌单为空，去本地音乐右键添加歌曲吧！';
      listEl.appendChild(empty);
      return;
    }

    pl.songs.forEach((song, idx) => {
      const row = document.createElement('div');
      row.className = 'playlist-detail-item song-item';
      row.setAttribute('data-file-path', song.file_path);

      // 序号
      const num = document.createElement('span');
      num.className = 'playlist-detail-num';
      num.textContent = `${idx + 1}`;
      row.appendChild(num);

      // 封面小图
      const cov = document.createElement('img');
      cov.className = 'playlist-detail-cover';
      cov.src = getCoverSrc(song.cover_image);
      if (!song.cover_image) {
        // ⭐ 没有封面时异步读可metadata ⭐
        (async () => {
          try {
            const meta = await invoke('read_audio_metadata', { path: song.file_path });
            if (meta && meta.cover_image) {
              song.cover_image = meta.cover_image;
              cov.src = getCoverSrc(song.cover_image);
              // 持久化保瀛?
              const all = getPlaylists();
              const targetPl = all.find(p => p.id === currentPlaylistId);
              if (targetPl) {
                const targetSong = targetPl.songs.find(s => s.file_path === song.file_path);
                if (targetSong) {
                  targetSong.cover_image = meta.cover_image;
                  savePlaylists(all);
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch cover:', song.file_path, err);
          }
        })();
      }
      row.appendChild(cov);

      // 标题 + 歌手
      const infoDiv = document.createElement('div');
      infoDiv.className = 'playlist-detail-info';
      const t = document.createElement('div');
      t.className = 'playlist-detail-song-title';
      t.textContent = song.title || '未知';
      infoDiv.appendChild(t);
      const a = document.createElement('div');
      a.className = 'playlist-detail-song-artist';
      a.textContent = song.artist || '未知歌手';
      infoDiv.appendChild(a);
      row.appendChild(infoDiv);

      // 时长
      const durEl = document.createElement('span');
      durEl.className = 'playlist-detail-duration';
      durEl.textContent = song.duration > 0 ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '';
      row.appendChild(durEl);

      // 删除按钮
      const rm = document.createElement('button');
      rm.className = 'playlist-detail-remove';
      rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      rm.title = '从歌单移闄';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSongFromPlaylist(pl.id, idx);
        renderPlaylistsTab();
      });
      row.appendChild(rm);

      // 单击播放：替换播放列表为歌单歌曲，然后播放该棣?
      row.addEventListener('click', () => {
        player.playlist = [...pl.songs];
        player.play(idx);
      });

      listEl.appendChild(row);
    });
  };

  // 导出到右键菜单的鈥滄坊鍔犲埌姝屽崟鈥濆嚱鏁?
  window.addToPlaylistMenu = (songData) => {
    const playlists = getPlaylists();
    if (playlists.length === 0) {
      showToast('请先创建歌单');
      return;
    }
    // 显示一个简易选择菜单
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;transition:opacity 0.2s ease;';
    overlay.style.opacity = '0';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    const closeMenu = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });
    const menu = document.createElement('div');
    menu.style.cssText = 'background:var(--bg-card, #1e1e1e);border-radius:12px;padding:12px 0;min-width:220px;max-width:320px;max-height:360px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:opacity 0.2s ease, transform 0.2s ease;';
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.92) translateY(10px)';
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1) translateY(0)';
    });
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:9px 20px;font-size:13px;color:var(--text-primary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      item.textContent = pl.name;
      item.addEventListener('click', () => {
        addSongToPlaylist(pl.id, songData);
        closeMenu();
        showToast(`已添加到: ${pl.name}`);
      });
      menu.appendChild(item);
    });
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
  };

  const renderSettingsTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const staggerMode = localStorage.getItem('lyricsStaggerMode') || 'stagger';
    const fsRaw = localStorage.getItem('kimo-lyrics-font-size');
    const fontSize = (fsRaw !== null && !isNaN(parseFloat(fsRaw))) ? parseFloat(fsRaw) : 22.0;
    const liftRaw = localStorage.getItem('kimo-lyrics-lift-amplitude');
    const liftAmp = (liftRaw !== null && !isNaN(parseFloat(liftRaw))) ? parseFloat(liftRaw) : 4.0;
    const lineSpacingRaw = localStorage.getItem('kimo-lyrics-line-spacing');
    const lineSpacing = (lineSpacingRaw !== null && !isNaN(parseFloat(lineSpacingRaw))) ? parseFloat(lineSpacingRaw) : 0.85;
    const miniTransVal = localStorage.getItem('kimo-mini-lyrics-show-translation') === 'true';
    const aiServerUrl = localStorage.getItem('kimo-ai-server-url') || 'http://127.0.0.1:8000';
    
    let scannedDirs = [];
    try {
      scannedDirs = JSON.parse(localStorage.getItem('kimo-scanned-dirs') || '[]');
    } catch(e) {}

    const container = document.createElement('div');
    container.className = 'settings-container';
    
    const lyricCard = document.createElement('div');
    lyricCard.className = 'settings-card';
    lyricCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        歌词与视觉动效？
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词动画切换模式</div>
          <div class="setting-desc">控制卡拉OK歌词播放时，是以单个字母为单位依次上移，还是以完整单词为单位整体上移銆?/div>
        </div>
        <div class="setting-radio-group" id="settings-stagger-group" data-active-idx="${staggerMode === 'stagger' ? '0' : '1'}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${staggerMode === 'stagger' ? 'active' : ''}" data-val="stagger">字母依次</button>
          <button class="setting-radio-btn ${staggerMode === 'word' ? 'active' : ''}" data-val="word">单词整体</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词默认字号</div>
          <div class="setting-desc">调节全屏歌词面板中的歌词渲染大小。支持无级缩放。/div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-font-size" min="16" max="36" step="0.5" value="${fontSize}">
          <div class="setting-value-display" id="settings-font-size-val">${fontSize.toFixed(1)}px</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词上抬动画幅度</div>
          <div class="setting-desc">调节当前发音的歌词向上漂移抬升的物理高度（以像素为单位）銆?/div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-lift" min="0" max="40" step="1" value="${liftAmp}">
          <div class="setting-value-display" id="settings-lift-val">${liftAmp}px</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">歌词行间璺?/div>
          <div class="setting-desc">调节两句歌词之间的上下间距（相对字号倍数，=紧贴）。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-line-spacing" min="0" max="2.0" step="0.05" value="${lineSpacing}">
          <div class="setting-value-display" id="settings-line-spacing-val">${lineSpacing.toFixed(2)}</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">迷你歌词显示翻译</div>
          <div class="setting-desc">开启后，主播放页中央的迷你歌词下方会显示当前行的翻译内容。/div>
        </div>
        <div style="display: flex; align-items: center;">
          <input type="checkbox" id="settings-mini-translation" ${miniTransVal ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: rgb(var(--dynamic-color, 16, 185, 129));" />
        </div>
      </div>
    `;
    container.appendChild(lyricCard);

    const themeCard = document.createElement('div');
    themeCard.className = 'settings-card';
    const themeVal = localStorage.getItem('kimo-theme') || 'light';
    const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
    const savedOpVal = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
    const opacityNum = savedOpVal !== null ? Math.round(parseFloat(savedOpVal) * 100) : (themeVal === 'light' ? 72 : (themeVal === 'grey' ? 65 : 62));

    const zoomRaw = localStorage.getItem('kimo-ui-scale');
    const currentZoom = (zoomRaw !== null && !isNaN(parseFloat(zoomRaw))) ? parseFloat(zoomRaw) : 1.0;
    const zoomPercent = Math.round(currentZoom * 100);

    const radiusRaw = localStorage.getItem('kimo-window-radius');
    const currentRadius = (radiusRaw !== null && !isNaN(parseFloat(radiusRaw))) ? parseInt(radiusRaw, 10) : 5;

    themeCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 1 0 10 10"/></svg>
        外观主题与遮罩设置？
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">默认外观主题</div>
          <div class="setting-desc">设置播放器的外观主题（支持浅色遮罩、雅致灰色与深色遮罩主题）。/div>
        </div>
        <div class="setting-radio-group" id="settings-theme-group" data-active-idx="${themeVal === 'light' ? '0' : (themeVal === 'grey' ? '1' : '2')}">
          <div class="setting-radio-active-bg"></div>
          <button class="setting-radio-btn ${themeVal === 'light' ? 'active' : ''}" data-val="light">浅色遮罩</button>
          <button class="setting-radio-btn ${themeVal === 'grey' ? 'active' : ''}" data-val="grey">雅致灰色</button>
          <button class="setting-radio-btn ${themeVal === 'dark' ? 'active' : ''}" data-val="dark">深色遮罩</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">背景遮罩透明搴?/div>
          <div class="setting-desc">无级微调背景高斯模糊遮罩层的不透明度。/div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-opacity" min="0" max="100" step="1" value="${opacityNum}">
          <div class="setting-value-display" id="settings-opacity-val">${opacityNum}%</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">软件界面缩放比例</div>
          <div class="setting-desc">无级微调整个播放器软件组件的缩放大小，以完美适配不同的高分屏或低分辨率屏幕。</div>
        </div>
        <div class="setting-slider-wrapper">
          <input type="range" class="setting-slider" id="settings-slider-zoom" min="80" max="120" step="1" value="${zoomPercent}">
          <div class="setting-value-display" id="settings-zoom-val">${zoomPercent}%</div>
        </div>
      </div>
    `;
    container.appendChild(themeCard);

    const aiCard = document.createElement('div');
    aiCard.className = 'settings-card';
    aiCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        AI 语音识别服务 (ASR)
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">推理服务器地址 (Server URL)</div>
          <div class="setting-desc">用于提供未配对歌词音频的 Whisper 时间戳对齐服务后台接口。/div>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" class="setting-input" id="settings-asr-url" value="${aiServerUrl}">
          <button class="setting-btn accent" id="settings-save-asr-btn">保存</button>
        </div>
      </div>
    `;
    container.appendChild(aiCard);

    const playbackCard = document.createElement('div');
    playbackCard.className = 'settings-card';
    const autoPlayVal = localStorage.getItem('kimo-auto-play-on-start') === 'true';
    playbackCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        播放与启动设置？
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">启动自动播放</div>
          <div class="setting-desc">打开软件时，自动播放上次关闭前播放的歌曲。/div>
        </div>
        <div style="display: flex; align-items: center;">
          <input type="checkbox" id="settings-autoplay-on-start" ${autoPlayVal ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: rgb(var(--dynamic-color, 16, 185, 129));" />
        </div>
      </div>
    `;
    container.appendChild(playbackCard);

    playbackCard.querySelector('#settings-autoplay-on-start').addEventListener('change', (e) => {
      localStorage.setItem('kimo-auto-play-on-start', e.target.checked);
      showToast(`已{e.target.checked ? '开启' : '关闭'}启动自动播放`);
    });

    const scanCard = document.createElement('div');
    scanCard.className = 'settings-card';
    
    let pathsHtml = '';
    if (scannedDirs.length === 0) {
      pathsHtml = `<div class="scanned-paths-empty">暂无已添加的扫描文件夹目录，请点击下方按钮添加。/div>`;
    } else {
      pathsHtml = `<div class="scanned-paths-list">`;
      scannedDirs.forEach((dir, index) => {
        pathsHtml += `
          <div class="scanned-path-item">
            <div class="scanned-path-text" title="${dir}">${dir}</div>
            <button class="scanned-path-remove" data-idx="${index}" title="移出列表">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
      });
      pathsHtml += `</div>`;
    }

    scanCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        音乐文件夹扫描管理？
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${pathsHtml}
        <div class="settings-actions">
          <button class="setting-btn" id="settings-clear-dirs">清空歌曲缓存</button>
          <button class="setting-btn" id="settings-add-dir-btn">添加文件澶?/button>
          <button class="setting-btn accent" id="settings-scan-btn">立即重新扫描</button>
        </div>
      </div>
    `;
    container.appendChild(scanCard);

    // 关于软件 Card
    const aboutCard = document.createElement('div');
    aboutCard.className = 'settings-card';
    aboutCard.innerHTML = `
      <div class="settings-card-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        关于软件
      </div>
      
      <div class="setting-row" style="flex-direction: column; align-items: flex-start; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <div class="about-logo" style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, rgb(16, 185, 129), rgb(5, 150, 105)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px;">KimoPlayer</div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">版本: 1.3.0-beta0721</div>
          </div>
        </div>
        
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; font-family: var(--font-family);">
          KimoPlayer 是一款轻量、精美的本地音频播放器。支持卡拉OK逐词歌词同步与编辑制作、歌词离线检索匹配、流畅的歌词滚动对齐以及极简的毛玻璃动态背景，为您带来纯净、舒适的本地音乐播放体验銆?
        </div>
        
        <div style="width: 100%; height: 1px; background: var(--glass-border); margin: 8px 0;"></div>
        
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-tertiary); width: 100%;">
          <div style="display: flex; justify-content: space-between;">
            <span>核心技鏈?/span>
            <span style="color: var(--text-secondary);">Tauri + Rust + Vite + Vanilla JS</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>版权所鏈?/span>
            <span style="color: var(--text-secondary);">漏 2026 KimoPlayer. 保留所有权。/span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(aboutCard);
    listEl.appendChild(container);

    lyricCard.querySelectorAll('#settings-stagger-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        lyricCard.querySelectorAll('#settings-stagger-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lyricCard.querySelector('#settings-stagger-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        // ⭐ 修复：使用与 toggleStaggerMode 一致的 localStorage key，并触发 render + realign 让模式真正生鏁?⭐
        localStorage.setItem('kimo-lyrics-stagger-mode', val);
        if (player && player.lyrics) {
          player.lyrics.lyricsStaggerMode = val;
          player.lyrics.updateStaggerUI();
          player.lyrics.render();
          if (player.lyrics.isVisible) {
            player.lyrics.realign();
            if (player.audio) {
              player.lyrics.syncToTime(player.audio.currentTime);
            }
          }
        }
        showToast(`已切换为: ${val === 'stagger' ? '字母依次上移' : '单词整体上移'}`);
      });
    });

    lyricCard.querySelector('#settings-mini-translation').addEventListener('change', (e) => {
      localStorage.setItem('kimo-mini-lyrics-show-translation', e.target.checked);
      applyMiniLyricsTranslationSetting();
      showToast(`已{e.target.checked ? '开启' : '关闭'}迷你歌词翻译`);
    });

    // 主题分段钮组事件监听
    themeCard.querySelectorAll('#settings-theme-group .setting-radio-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        themeCard.querySelectorAll('#settings-theme-group .setting-radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeCard.querySelector('#settings-theme-group').setAttribute('data-active-idx', idx.toString());
        const val = btn.getAttribute('data-val');
        const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
        const op = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
        applyTheme(val, op);
        showToast(`已切换至: ${val === 'light' ? '浅色遮罩主题' : (val === 'grey' ? '雅致灰色主题' : '深色遮罩主题')}`);
      });
    });

    const opInput = themeCard.querySelector('#settings-slider-opacity');
    const opDisplay = themeCard.querySelector('#settings-opacity-val');
    opInput.addEventListener('input', (e) => {
      const percentage = parseInt(e.target.value, 10);
      opDisplay.textContent = `${percentage}%`;
      const val = percentage / 100;
      localStorage.setItem('kimo-overlay-opacity-custom', 'true');
      applyTheme(currentTheme, val.toString());
    });
    opInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(0, Math.min(100, parseInt(opInput.value) + delta));
      opInput.value = nextVal;
      opDisplay.textContent = `${nextVal}%`;
      const val = nextVal / 100;
      localStorage.setItem('kimo-overlay-opacity-custom', 'true');
      applyTheme(currentTheme, val.toString());
    }, { passive: false });

    const zoomInput = themeCard.querySelector('#settings-slider-zoom');
    const zoomDisplay = themeCard.querySelector('#settings-zoom-val');
    zoomInput.addEventListener('input', (e) => {
      const percentage = parseInt(e.target.value, 10);
      zoomDisplay.textContent = `${percentage}%`;
      const val = percentage / 100;
      document.documentElement.style.setProperty('--ui-scale', val.toString());
      document.documentElement.style.zoom = val.toString();
      localStorage.setItem('kimo-ui-scale', val.toString());
    });
    zoomInput.addEventListener('change', (e) => {
      const percentage = parseInt(e.target.value, 10);
      const val = percentage / 100;
      localStorage.setItem('kimo-ui-scale', val.toString());
    });
    zoomInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(80, Math.min(120, parseInt(zoomInput.value) + delta));
      zoomInput.value = nextVal;
      zoomDisplay.textContent = `${nextVal}%`;
      const val = nextVal / 100;
      document.documentElement.style.setProperty('--ui-scale', val.toString());
      document.documentElement.style.zoom = val.toString();
      localStorage.setItem('kimo-ui-scale', val.toString());
    }, { passive: false });

    const fsInput = lyricCard.querySelector('#settings-slider-font-size');
    const fsDisplay = lyricCard.querySelector('#settings-font-size-val');
    fsInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      fsDisplay.innerText = `${val.toFixed(1)}px`;
      document.documentElement.style.setProperty('--lyrics-font-size', `${val}px`);
      if (player && player.lyrics) player.lyrics.resetAlignmentCache();
    });
    fsInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-font-size', val);
    });
    fsInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const nextVal = Math.max(16, Math.min(36, parseFloat(fsInput.value) + delta));
      fsInput.value = nextVal;
      fsDisplay.innerText = `${nextVal.toFixed(1)}px`;
      document.documentElement.style.setProperty('--lyrics-font-size', `${nextVal}px`);
      if (player && player.lyrics) player.lyrics.resetAlignmentCache();
      localStorage.setItem('kimo-lyrics-font-size', nextVal);
    }, { passive: false });

    const liftInput = lyricCard.querySelector('#settings-slider-lift');
    const liftDisplay = lyricCard.querySelector('#settings-lift-val');
    liftInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      liftDisplay.innerText = `${val}px`;
    });
    liftInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      localStorage.setItem('kimo-lyrics-lift-amplitude', val);
    });
    liftInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(0, Math.min(40, parseInt(liftInput.value) + delta));
      liftInput.value = nextVal;
      liftDisplay.innerText = `${nextVal}px`;
      localStorage.setItem('kimo-lyrics-lift-amplitude', nextVal);
    }, { passive: false });

    const spacingInput = lyricCard.querySelector('#settings-slider-line-spacing');
    const spacingDisplay = lyricCard.querySelector('#settings-line-spacing-val');
    const applyLineSpacing = (val) => {
      spacingDisplay.innerText = `${parseFloat(val).toFixed(2)}`;
      document.documentElement.style.setProperty('--lyrics-line-spacing', val);
    };
    spacingInput.addEventListener('input', (e) => {
      applyLineSpacing(parseFloat(e.target.value));
    });
    spacingInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      localStorage.setItem('kimo-lyrics-line-spacing', val);
    });
    spacingInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const nextVal = Math.max(0, Math.min(2.0, parseFloat(spacingInput.value) + delta));
      spacingInput.value = nextVal;
      applyLineSpacing(nextVal);
      localStorage.setItem('kimo-lyrics-line-spacing', nextVal);
    }, { passive: false });

    const asrUrlInput = aiCard.querySelector('#settings-asr-url');
    aiCard.querySelector('#settings-save-asr-btn').addEventListener('click', () => {
      const url = asrUrlInput.value.trim();
      localStorage.setItem('kimo-ai-server-url', url);
      showToast('AI ASR 服务器地址保存成功');
    });

    scanCard.querySelectorAll('.scanned-path-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        scannedDirs.splice(idx, 1);
        localStorage.setItem('kimo-scanned-dirs', JSON.stringify(scannedDirs));
        showToast('已移出该扫描路径');
        renderSettingsTab();
      });
    });

    scanCard.querySelector('#settings-clear-dirs').addEventListener('click', async () => {
      if (await customConfirm('确定要清空所有本地音乐的缓存及扫描路径列表吗？此操作不可恢复。')) {
        localStorage.removeItem('kimo-scanned-dirs');
        localStorage.removeItem('kimo-scanned-dir');
        localStorage.removeItem('kimo-playlist-cache');
        localStorage.removeItem('kimo-music-library');
        player.playlist = [];
        musicLibrary = [];
        lyricsCache.clear();
        clearLyricsDB();
        searchWorker.postMessage({ type: 'clear_cache' });
        showToast('歌曲缓存已清绌');
        renderSettingsTab();
      }
    });

    scanCard.querySelector('#settings-add-dir-btn').addEventListener('click', async () => {
      try {
        const selected = await open({ directory: true, multiple: true });
        if (!selected) return;
        
        const newPaths = Array.isArray(selected) ? selected : [selected];
        newPaths.forEach(p => {
          if (!scannedDirs.includes(p)) {
            scannedDirs.push(p);
          }
        });

        localStorage.setItem('kimo-scanned-dirs', JSON.stringify(scannedDirs));
        showToast('成功添加扫描文件澶');
        renderSettingsTab();
      } catch (e) {
        console.error('Add directory error:', e);
        showToast('选择文件夹失璐');
      }
    });

    scanCard.querySelector('#settings-scan-btn').addEventListener('click', async () => {
      if (scannedDirs.length === 0) {
        showToast('请先添加需要扫描的文件夹目褰');
        return;
      }

      const scanBtn = scanCard.querySelector('#settings-scan-btn');
      scanBtn.disabled = true;
      scanBtn.innerText = '正在扫描目录...';
      
      try {
        const allFiles = [];
        for (const dir of scannedDirs) {
          try {
            const files = await invoke('scan_directory', { dir });
            if (Array.isArray(files)) {
              allFiles.push(...files);
            }
          } catch(err) {
             console.error('Scan failed for dir:', dir, err);
          }
        }

        const uniqueFiles = Array.from(new Set(allFiles));
        
        if (uniqueFiles.length === 0) {
          showToast('未在指定文件夹中检索到音频文件');
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
          return;
        }

        scanBtn.innerText = `正在读取元数鎹?(0/${uniqueFiles.length})...`;
        
        const tempPlaylist = [];
        for (let i = 0; i < uniqueFiles.length; i++) {
          try {
            scanBtn.innerText = `正在读取元数鎹?(${i + 1}/${uniqueFiles.length})...`;
            const meta = await invoke('read_audio_metadata', { path: uniqueFiles[i] });
            if (meta) {
              tempPlaylist.push(meta);
            }
          } catch (e) {
            console.error('Failed to read metadata for', uniqueFiles[i], e);
          }
        }

        if (tempPlaylist.length > 0) {
          musicLibrary = tempPlaylist;
          player.playlist = [...tempPlaylist]; // 初次扫描时把全部歌曲同时设为播放列表
          sessionRecommendations = null;

          // ⭐ localStorage 不存大字段（cover_image data URI 可能瓒?5MB 配额），先精简再存 ⭐
          const slimPlaylist = tempPlaylist.map(s => ({
            file_path: s.file_path,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            year: s.year,
            track_number: s.track_number,
            genre: s.genre,
            // ⭐ 封面仅保留路径引用，data URI 留空（启动时 backgroundLoadCovers 会按需补全）。
            cover_image: typeof s.cover_image === 'string' && s.cover_image.startsWith('data:') ? null : s.cover_image,
          }));

          try {
            localStorage.setItem('kimo-music-library', JSON.stringify(slimPlaylist));
            localStorage.setItem('kimo-playlist-cache', JSON.stringify(slimPlaylist));
          } catch (e) {
            console.warn('localStorage 写入失败（配额满？），已跳过持久化：', e);
          }

          // ⭐ 异步加载封面（不阻塞扫描完成提示）。
          backgroundLoadCovers(player.playlist);

          showToast(`扫描完成！共导入 ${tempPlaylist.length} 首歌曲`);
          // ⭐ 隔离 switchTab 错误，避免渲染错误覆盖成功提绀?⭐
          try {
            switchTab('local');
          } catch (tabErr) {
            console.error('switchTab error after scan:', tabErr);
          }
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
        } else {
          showToast('扫描完成，未读取到有效的音频文件元数鎹');
          scanBtn.disabled = false;
          scanBtn.innerText = '立即重新扫描';
        }
      } catch(err) {
        console.error('Global scan error:', err);
        showToast('扫描失败，请重试');
        scanBtn.disabled = false;
        scanBtn.innerText = '立即重新扫描';
      }
    });
  };

  const renderRecentPlaysTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    let recents = [];
    try {
      const cached = localStorage.getItem('kimo-recent-plays');
      if (cached) recents = JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
    
    if (recents.length === 0) {
      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); gap: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size: 14px; font-weight: 500;">暂无播放记录，快去听听歌吧！</div>
        </div>
      `;
      return;
    }
    
    recents.forEach((song, idx) => {
      const div = document.createElement('div');
      const isCurrent = player.currentIndex >= 0 && player.playlist[player.currentIndex]?.file_path === song.file_path;
      
      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      const coverSrc = getCoverSrc(song.cover_image);
      
      const isPaused = player.audio.paused;
      div.innerHTML = `
        <img src="${coverSrc}" class="song-cover" />
        <div class="song-info">
          <div class="song-title">${song.title || 'Unknown'}</div>
          <div class="song-artist">${song.artist || 'Unknown'}</div>
        </div>
        <div class="eq-animation ${isPaused ? 'paused' : ''}">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>
        <div class="song-duration">${song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : ''}</div>
      `;
      
      div.addEventListener('click', () => {
        const originalIdx = player.playlist.findIndex(s => s.file_path === song.file_path);
        if (originalIdx >= 0) {
          player.play(originalIdx);
        } else {
          player.playlist.push(song);
          renderPlaylist(player.playlist);
          player.play(player.playlist.length - 1);
        }
        
        // Trigger a visual active item refresh
        setTimeout(() => {
          if (currentTab === 'recent') renderRecentPlaysTab();
        }, 60);
      });
      listEl.appendChild(div);
    });
  };

  const renderDiscoverTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    
    const playlist = player.playlist;
    
    // Select 3 smart recommendations based on user listening habits (top artists)
    let recommended = [];
    if (playlist && playlist.length > 0) {
      if (sessionRecommendations && sessionRecommendations.length > 0) {
        recommended = sessionRecommendations;
      } else {
        // Read recent plays to extract listening habits
        let recentHistory = [];
        try {
          const cached = localStorage.getItem('kimo-recent-plays');
          if (cached) recentHistory = JSON.parse(cached);
        } catch (e) {
          console.error(e);
        }

        if (recentHistory.length > 0) {
          // Smart recommendations based on recently played artists
          const recentArtists = new Set(recentHistory.map(s => s.artist).filter(Boolean));
          const recentPaths = new Set(recentHistory.slice(0, 4).map(s => s.file_path)); // Exclude last 4 played songs
          
          let matches = playlist.filter(song => recentArtists.has(song.artist) && !recentPaths.has(song.file_path));
          
          if (matches.length < 3) {
            // Fill the rest with random songs not in matches or not recently played
            const filledPaths = new Set(matches.map(m => m.file_path));
            const remaining = playlist.filter(song => !filledPaths.has(song.file_path) && !recentPaths.has(song.file_path));
            const shuffledRemaining = remaining.sort(() => 0.5 - Math.random());
            matches = [...matches, ...shuffledRemaining].slice(0, 3);
          } else {
            matches = matches.sort(() => 0.5 - Math.random()).slice(0, 3);
          }
          recommended = matches;
        } else {
          // Fallback to random if history is empty
          const shuffled = [...playlist].sort(() => 0.5 - Math.random());
          recommended = shuffled.slice(0, Math.min(3, shuffled.length));
        }
        // Cache in session to prevent reshuffling on song changes!
        sessionRecommendations = recommended;
      }
    }
    
    // Get recent plays preview
    let recentPreview = [];
    try {
      const cached = localStorage.getItem('kimo-recent-plays');
      if (cached) recentPreview = JSON.parse(cached).slice(0, 4);
    } catch (e) {
      console.error(e);
    }
    
    let html = `
      <!-- Today's Recommendations Section -->
      <div class="discover-section">
        <h2 class="section-title">今日推荐</h2>
        <div class="recommendations-grid">
    `;
    
    if (recommended.length > 0) {
      recommended.forEach((song) => {
        const idx = playlist.findIndex(s => s.file_path === song.file_path);
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="recommend-card" data-index="${idx}">
            <img src="${cover}" class="recommend-cover" />
            <div class="recommend-info">
              <div class="recommend-title">${song.title || 'Unknown Title'}</div>
              <div class="recommend-artist">${song.artist || 'Unknown Artist'}</div>
            </div>
            <button class="recommend-play-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        `;
      });
    } else {
      html += `
        <div class="empty-recommend">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>本地音乐为空，扫描本地音乐后将为您生成今日个性化推荐</span>
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
      
      <!-- Split Row for Recents and Features -->
      <div class="discover-row">
        <!-- Recent Plays Column -->
        <div class="discover-col col-recents">
          <h2 class="section-title">最近播鏀?<span class="view-all-btn" id="view-all-recents">查看全部</span></h2>
          <div class="recents-list">
    `;
    
    if (recentPreview.length > 0) {
      recentPreview.forEach((song) => {
        const idx = playlist.findIndex(s => s.file_path === song.file_path);
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="recent-item" data-index="${idx}" data-file-path="${song.file_path}">
            <img src="${cover}" class="recent-cover" />
            <div class="recent-info">
              <div class="recent-title">${song.title || 'Unknown Title'}</div>
              <div class="recent-artist">${song.artist || 'Unknown Artist'}</div>
            </div>
            <svg class="recent-play-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        `;
      });
    } else {
      html += `
        <div class="empty-recents">
          <span>暂无播放记录，快去听听歌后/span>
        </div>
      `;
    }
    
    html += `
          </div>
        </div>
        
        <!-- Feature Playlists Column -->
        <div class="discover-col col-playlists">
          <h2 class="section-title">精选场鏅?/h2>
          <div class="scene-grid">
            <div class="scene-card scene-1" id="scene-heart">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">心动推荐</span>
              <span class="scene-name">心动旋律</span>
            </div>
            <div class="scene-card scene-2" id="scene-afternoon">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">午后闲暇</span>
              <span class="scene-name">午后纯音</span>
            </div>
            <div class="scene-card scene-3" id="scene-night">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">深夜入眠</span>
              <span class="scene-name">疗愈雨声</span>
            </div>
            <div class="scene-card scene-4" id="scene-focus">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">学习专注</span>
              <span class="scene-name">深度专注</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    listEl.innerHTML = html;
    
    // Recommended card clicks
    listEl.querySelectorAll('.recommend-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.getAttribute('data-index'));
        if (index >= 0) player.play(index);
      });
    });
    
    // Recent items clicks
    listEl.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index'));
        if (index >= 0) {
          player.play(index);
        } else {
          const filePath = item.getAttribute('data-file-path');
          const songObj = recentPreview.find(s => s.file_path === filePath);
          if (songObj) {
            player.playlist.push(songObj);
            renderPlaylist(player.playlist);
            player.play(player.playlist.length - 1);
          }
        }
      });
    });
    
    // View All click handler
    document.getElementById('view-all-recents')?.addEventListener('click', () => {
      switchTab('recent');
    });

    // Preset scene clicks triggers a quick play of dynamic tracks if available!
    const triggerScenePlay = () => {
      if (player.playlist.length > 0) {
        const randIdx = Math.floor(Math.random() * player.playlist.length);
        player.play(randIdx);
      }
    };
    document.getElementById('scene-heart')?.addEventListener('click', triggerScenePlay);
    document.getElementById('scene-afternoon')?.addEventListener('click', triggerScenePlay);
    document.getElementById('scene-night')?.addEventListener('click', triggerScenePlay);
    document.getElementById('scene-focus')?.addEventListener('click', triggerScenePlay);
  };

  const switchTab = (tabName) => {
    currentTab = tabName;
    
    // Update sidebar navigation active classes
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
      el.classList.remove('active');
    });
    
    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) activeNav.classList.add('active');
    
    // Control visibility of individual floating actions
    const floatToTop = document.getElementById('float-to-top');
    const floatToPlaying = document.getElementById('float-to-playing');
    const isListTab = tabName === 'local' || tabName === 'recent' || tabName === 'playlists';
    if (floatToTop) floatToTop.style.display = isListTab ? 'flex' : 'none';
    if (floatToPlaying) floatToPlaying.style.display = isListTab ? 'flex' : 'none';
    
    // Change tab content area
    const contentTitle = document.getElementById('content-title');
    if (!contentTitle) return;
    
    if (tabName === 'discover') {
      contentTitle.innerText = '发现音乐';
      renderDiscoverTab();
    } else if (tabName === 'local') {
      contentTitle.innerText = '本地音乐';
      renderLocalMusicTab();
    } else if (tabName === 'recent') {
      contentTitle.innerText = '最近播鏀';
      renderRecentPlaysTab();
    } else if (tabName === 'search') {
      contentTitle.innerText = '全局搜索';
      renderSearchTab();
    } else if (tabName === 'playlists') {
      contentTitle.innerText = '我的歌单';
      renderPlaylistsTab();
    } else if (tabName === 'settings') {
      contentTitle.innerText = '系统设置';
      renderSettingsTab();
    }

    // Trigger fluid tab transition with hardware acceleration
    const listEl = document.getElementById('music-list');
    if (listEl) {
      listEl.classList.remove('fade-in-up');
      void listEl.offsetWidth; // Force reflow
      listEl.classList.add('fade-in-up');
    }
  };

  // Bind Switch Tab functions to global so player can refresh them
  window.addToRecentPlays = (song) => {
    let recents = [];
    try {
      const cached = localStorage.getItem('kimo-recent-plays');
      if (cached) recents = JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
    recents = recents.filter(s => s.file_path !== song.file_path);
    recents.unshift(song);
    if (recents.length > 50) recents.pop();
    
    localStorage.setItem('kimo-recent-plays', JSON.stringify(recents));
    
    // Dynamically update view if current active tab needs refresh
    if (currentTab === 'recent') {
      renderRecentPlaysTab();
    } else if (currentTab === 'discover') {
      renderDiscoverTab();
    }
  };

  // Wire up sidebar navigation buttons
  document.getElementById('nav-discover')?.addEventListener('click', () => switchTab('discover'));
  document.getElementById('nav-local')?.addEventListener('click', () => switchTab('local'));
  document.getElementById('nav-recent')?.addEventListener('click', () => switchTab('recent'));
  document.getElementById('nav-search')?.addEventListener('click', () => switchTab('search'));
  document.getElementById('nav-playlists')?.addEventListener('click', () => switchTab('playlists'));
  document.getElementById('nav-settings')?.addEventListener('click', () => switchTab('settings'));

  // Ensure floating action bar container is always visible
  document.getElementById('floating-actions')?.classList.add('visible');

  // Wire up list floating actions
  document.getElementById('float-to-top')?.addEventListener('click', () => {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('float-to-playing')?.addEventListener('click', () => {
    const activeSong = document.querySelector('.song-item.playing');
    if (activeSong) {
      activeSong.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // ══ ⭐ Premium Sidebar Search Tab & Background Caching System (Off-thread Web Worker) ══
  const lyricsCache = new Map();

  // ══ ⭐ IndexedDB Cache for Parsed Lyrics Persistence ══
  const dbName = 'KimoLyricsCacheDB';
  const storeName = 'lyricsCache';

  const openLyricsDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  };

  const saveLyricsToDB = async (filePath, lines) => {
    try {
      const db = await openLyricsDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(lines, filePath);
    } catch (e) {
      console.error('[LyricsCacheDB] Failed to save to IndexedDB:', e);
    }
  };

  const loadAllLyricsFromDB = async () => {
    try {
      const db = await openLyricsDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      const cache = new Map();
      return new Promise((resolve) => {
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cache.set(cursor.key, cursor.value);
            cursor.continue();
          } else {
            resolve(cache);
          }
        };
        request.onerror = () => resolve(cache);
      });
    } catch (e) {
      console.error('[LyricsCacheDB] Failed to load from IndexedDB:', e);
      return new Map();
    }
  };

  const clearLyricsDB = async () => {
    try {
      const db = await openLyricsDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
    } catch (e) {
      console.error('[LyricsCacheDB] Failed to clear IndexedDB:', e);
    }
  };

  // Populate memory cache and search worker on startup from IndexedDB
  loadAllLyricsFromDB().then(cache => {
    cache.forEach((val, key) => {
      lyricsCache.set(key, val);
      searchWorker.postMessage({
        type: 'update_cache',
        data: { filePath: key, lines: val }
      });
    });
  }).catch(err => {
    console.error('[LyricsCacheDB] Failed to restore cache on startup:', err);
  });
  let isIndexing = false;
  let currentSearchQuery = '';
  let currentSearchSubTab = 'all'; // 'all', 'songs', 'albums', 'artists', 'lyrics', 'others'
  let lastSearchResults = { songs: [], albums: [], artists: [], lyrics: [], others: [] };

  // Inline Web Worker definition for off-thread search processing
  const searchWorkerCode = `
    let lyricsCache = new Map();
    let playlist = [];

    self.onmessage = function(e) {
      const { type, data } = e.data;
      if (type === 'init') {
        playlist = data.playlist || [];
      } else if (type === 'update_cache') {
        const { filePath, lines } = data;
        lyricsCache.set(filePath, lines);
      } else if (type === 'clear_cache') {
        lyricsCache.clear();
      } else if (type === 'search') {
        const { query } = data;
        if (!query) {
          self.postMessage({ type: 'search_results', results: { songs: [], albums: [], artists: [], lyrics: [], others: [] }, query });
          return;
        }
        
        const lowerQuery = query.toLowerCase();

        // 1. Search metadata categories
        const matchedSongs = [];
        const matchedAlbums = [];
        const matchedArtists = [];
        const matchedOthers = [];

        playlist.forEach((song) => {
          if (song.title && song.title.toLowerCase().includes(lowerQuery)) {
            matchedSongs.push(song);
          }
          if (song.album && song.album.toLowerCase().includes(lowerQuery)) {
            matchedAlbums.push(song);
          }
          if (song.artist && song.artist.toLowerCase().includes(lowerQuery)) {
            matchedArtists.push(song);
          }

          const genreMatch = song.genre && song.genre.toLowerCase().includes(lowerQuery);
          const yearMatch = song.year && song.year.toString().includes(lowerQuery);
          const composerMatch = song.composer && song.composer.toLowerCase().includes(lowerQuery);
          const lyricistMatch = song.lyricist && song.lyricist.toLowerCase().includes(lowerQuery);
          const commentMatch = song.comment && song.comment.toLowerCase().includes(lowerQuery);

          if (genreMatch || yearMatch || composerMatch || lyricistMatch || commentMatch) {
            let fieldLabel = '';
            if (genreMatch) fieldLabel = "流派: " + song.genre;
            else if (yearMatch) fieldLabel = "年份: " + song.year;
            else if (composerMatch) fieldLabel = "作曲: " + song.composer;
            else if (lyricistMatch) fieldLabel = "作词: " + song.lyricist;
            else if (commentMatch) fieldLabel = "备注: " + song.comment;

            matchedOthers.push({ song, fieldLabel });
          }
        });

        // 2. Search lyrics
        const lyricsMatches = [];
        playlist.forEach((song) => {
          const lines = lyricsCache.get(song.file_path);
          if (!lines) return;

          const matches = [];
          lines.forEach((line) => {
            const textMatch = line.text && line.text.toLowerCase().includes(lowerQuery);
            const transMatch = line.translation && line.translation.toLowerCase().includes(lowerQuery);
            if (textMatch || transMatch) {
              matches.push(line);
            }
          });

          if (matches.length > 0) {
            lyricsMatches.push({ song, matches });
          }
        });

        self.postMessage({
          type: 'search_results',
          results: {
            songs: matchedSongs,
            albums: matchedAlbums,
            artists: matchedArtists,
            lyrics: lyricsMatches,
            others: matchedOthers
          },
          query
        });
      }
    };
  `;

  const searchWorkerBlob = new Blob([searchWorkerCode], { type: 'application/javascript' });
  const searchWorker = new Worker(URL.createObjectURL(searchWorkerBlob));

  // Handle messages returned from Web Worker
  searchWorker.onmessage = (e) => {
    const { type, results, query } = e.data;
    if (type === 'search_results') {
      // Prevent race conditions by making sure results match the active query
      if (query === currentSearchQuery) {
        lastSearchResults = results;
        const resultsContainer = document.getElementById('search-results-list');
        if (resultsContainer) {
          renderSearchList(resultsContainer);
        }
      }
    }
  };

  // Helper to update index progress bar UI in real-time
  const updateIndexingProgress = () => {
    const progressContainer = document.getElementById('indexing-progress-container');
    if (!progressContainer) return;

    const total = player.playlist.length;
    const cached = lyricsCache.size;

    if (total === 0 || cached >= total) {
      progressContainer.style.display = 'none';
      return;
    }

    progressContainer.style.display = 'block';
    const percent = Math.round((cached / total) * 100);
    const fill = progressContainer.querySelector('.indexing-progress-fill');
    const text = progressContainer.querySelector('.indexing-progress-text');

    if (fill) fill.style.width = `${percent}%`;
    if (text) text.innerText = `正在后台生成歌词索引中(${cached}/${total} 首歌曲已索引)... 首次搜索可能不完整，生成后即可展示全部结果`;
  };

  // Background Indexer: Incremental lyrics loader
  const startIndexingLyrics = async () => {
    if (isIndexing) return;
    isIndexing = true;
    updateIndexingProgress();

    // Sync playlist to Web Worker
    searchWorker.postMessage({ type: 'init', data: { playlist: player.playlist } });

    try {
      const uncached = player.playlist.filter(s => !lyricsCache.has(s.file_path));
      if (uncached.length === 0) {
        isIndexing = false;
        updateIndexingProgress();
        return;
      }

      const concurrency = 3;
      for (let i = 0; i < uncached.length; i += concurrency) {
        if (player.playlist.length === 0) break;
        
        // Temporarily pause indexing if the user is typing/searching to prevent IPC congestion & UI stuttering
        if (currentSearchQuery) {
          isIndexing = false;
          return;
        }

        const chunk = uncached.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (song) => {
          try {
            const res = await invoke('get_lyrics', { audioPath: song.file_path });
            if (res && res.content) {
              let parsedLines = [];
              if (res.lyrics_type === 'lrc') parsedLines = parseLRC(res.content);
              else if (res.lyrics_type === 'ttml') parsedLines = parseTTML(res.content);
              else if (res.lyrics_type === 'json') parsedLines = parseJSONLyrics(res.content);
              
              // Sync with Web Worker cache
              lyricsCache.set(song.file_path, parsedLines);
              saveLyricsToDB(song.file_path, parsedLines);
              searchWorker.postMessage({
                type: 'update_cache',
                data: { filePath: song.file_path, lines: parsedLines }
              });
            } else {
              lyricsCache.set(song.file_path, []);
              saveLyricsToDB(song.file_path, []);
              searchWorker.postMessage({
                type: 'update_cache',
                data: { filePath: song.file_path, lines: [] }
              });
            }
          } catch (e) {
            lyricsCache.set(song.file_path, []);
            saveLyricsToDB(song.file_path, []);
            searchWorker.postMessage({
              type: 'update_cache',
              data: { filePath: song.file_path, lines: [] }
            });
          }
        }));
        
        // Update progress dynamically
        updateIndexingProgress();
        await new Promise(r => setTimeout(r, 50));
      }
    } catch (err) {
      console.error('[LyricsIndexer] Pre-indexing error:', err);
    } finally {
      isIndexing = false;
      updateIndexingProgress();
    }
  };

  // Run indexer automatically every 5 seconds if there are playlist changes
  setInterval(() => {
    if (player.playlist.length > 0) {
      startIndexingLyrics();
    }
  }, 5000);

  const openSearch = () => {
    switchTab('search');
    setTimeout(() => {
      document.getElementById('global-search-input')?.focus();
    }, 50);
  };

  // Keyboard shortcut listener
  window.addEventListener('keydown', (e) => {
    // Ctrl + F opens search tab
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openSearch();
    }
  });

  // Wire search buttons to switch tabs and focus
  document.getElementById('float-search')?.addEventListener('click', openSearch);
  document.getElementById('lyrics-search-btn')?.addEventListener('click', openSearch);

  // Debounced search trigger (150ms for snappy local lookup)
  let searchTimeout = null;
  const debouncedSearch = (query, container) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(query, container);
    }, 150);
  };

  const performSearch = (query, container) => {
    if (!query) {
      lastSearchResults = { songs: [], albums: [], artists: [], lyrics: [], others: [] };
      container.innerHTML = '<div class="search-placeholder">输入关键词开始全局搜索...</div>';
      const tabsEl = document.querySelector('.local-tabs');
      if (tabsEl) tabsEl.style.display = 'none';
      return;
    }

    // Delegate search lookup completely to searchWorker to keep the UI main thread 100% lag-free
    searchWorker.postMessage({ type: 'init', data: { playlist: player.playlist } });
    searchWorker.postMessage({ type: 'search', data: { query } });
  };

  const highlightText = (text, query) => {
    if (!text) return '';
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  };

  const renderSearchList = (container) => {
    if (!container) return;

    const { songs, albums, artists, lyrics, others } = lastSearchResults;
    const query = currentSearchQuery;

    // Toggle tabs container visibility depending on query and results availability
    const tabsEl = document.querySelector('.local-tabs');
    const totalResults = songs.length + albums.length + artists.length + lyrics.length + others.length;
    const hasResults = query && totalResults > 0;
    if (tabsEl) {
      tabsEl.style.display = hasResults ? 'flex' : 'none';
    }

    const showAll = currentSearchSubTab === 'all';
    const showSongs = showAll || currentSearchSubTab === 'songs';
    const showAlbums = showAll || currentSearchSubTab === 'albums';
    const showArtists = showAll || currentSearchSubTab === 'artists';
    const showLyrics = showAll || currentSearchSubTab === 'lyrics';
    const showOthers = showAll || currentSearchSubTab === 'others';

    const hasSongs = showSongs && songs.length > 0;
    const hasAlbums = showAlbums && albums.length > 0;
    const hasArtists = showArtists && artists.length > 0;
    const hasLyrics = showLyrics && lyrics.length > 0;
    const hasOthers = showOthers && others.length > 0;

    if (!hasSongs && !hasAlbums && !hasArtists && !hasLyrics && !hasOthers) {
      container.innerHTML = '<div class="search-placeholder">未找到匹配的结果銆?/div>';
      return;
    }

    let html = '';

    // 1. Render Songs
    if (hasSongs) {
      html += '<div class="search-group-title">歌曲</div>';
      songs.forEach((song) => {
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="search-item" data-type="song" data-file-path="${song.file_path}">
            <img class="search-item-icon" src="${cover}" />
            <div class="search-item-info">
              <div class="search-item-title">${highlightText(song.title, query)}</div>
              <div class="search-item-artist">${highlightText(song.artist, query)} ${song.album ? ' - ' + highlightText(song.album, query) : ''}</div>
            </div>
          </div>
        `;
      });
    }

    // 2. Render Albums
    if (hasAlbums) {
      html += '<div class="search-group-title">专辑</div>';
      albums.forEach((song) => {
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="search-item" data-type="song" data-file-path="${song.file_path}">
            <img class="search-item-icon" src="${cover}" />
            <div class="search-item-info">
              <div class="search-item-title">${highlightText(song.title, query)} - <span style="font-size: 12px; color: rgba(255,255,255,0.4);">${song.artist || '未知歌手'}</span></div>
              <div class="search-item-artist">专辑: ${highlightText(song.album, query)}</div>
            </div>
          </div>
        `;
      });
    }

    // 3. Render Artists
    if (hasArtists) {
      html += '<div class="search-group-title">艺术瀹?/div>';
      artists.forEach((song) => {
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="search-item" data-type="song" data-file-path="${song.file_path}">
            <img class="search-item-icon" src="${cover}" />
            <div class="search-item-info">
              <div class="search-item-title">${highlightText(song.title, query)}</div>
              <div class="search-item-artist">歌手: ${highlightText(song.artist, query)} ${song.album ? ' - 专辑: ' + highlightText(song.album, query) : ''}</div>
            </div>
          </div>
        `;
      });
    }

    // 4. Render Lyrics matches
    if (hasLyrics) {
      html += '<div class="search-group-title">歌词内容</div>';
      lyrics.forEach(({ song, matches }) => {
        if (matches && matches.length > 0) {
          const line = matches[0];
          const cover = getCoverSrc(song.cover_image);
          const timeMin = Math.floor(line.time / 60);
          const timeSec = (Math.floor(line.time) % 60).toString().padStart(2, '0');
          const previewText = line.text ? highlightText(line.text, query) : '';
          const previewTrans = line.translation ? '<br/>' + highlightText(line.translation, query) : '';
          
          html += `
            <div class="search-item" data-type="lyric" data-file-path="${song.file_path}" data-time="${line.time}">
              <img class="search-item-icon" src="${cover}" />
              <div class="search-item-info">
                <div class="search-item-title">${highlightText(song.title, query)} - <span style="font-size: 12px; color: rgba(255,255,255,0.4);">${song.artist || '未知歌手'}</span></div>
                <div class="search-item-lyrics-line">
                  <div>${previewText}${previewTrans}</div>
                  <span class="search-item-lyrics-time">${timeMin}:${timeSec}</span>
                </div>
              </div>
            </div>
          `;
        }
      });
    }

    // 5. Render Others
    if (hasOthers) {
      html += '<div class="search-group-title">其他元数据匹閰?/div>';
      others.forEach(({ song, fieldLabel }) => {
        const cover = getCoverSrc(song.cover_image);
        html += `
          <div class="search-item" data-type="song" data-file-path="${song.file_path}">
            <img class="search-item-icon" src="${cover}" />
            <div class="search-item-info">
              <div class="search-item-title">${highlightText(song.title, query)} - <span style="font-size: 12px; color: rgba(255,255,255,0.4);">${song.artist || '未知歌手'}</span></div>
              <div class="search-item-artist" style="color: rgb(var(--dynamic-color, 16, 185, 129)); font-weight: 500;">${highlightText(fieldLabel, query)}</div>
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    // Attach click listeners to rendered search items
    container.querySelectorAll('.search-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const filePath = item.getAttribute('data-file-path');
        const type = item.getAttribute('data-type');
        const time = parseFloat(item.getAttribute('data-time') || '0');

        const songIdx = player.playlist.findIndex((s) => s.file_path === filePath);
        if (songIdx >= 0) {
          const currentSong = player.playlist[player.currentIndex];
          if (currentSong && currentSong.file_path === filePath) {
            if (type === 'lyric') {
              player.audio.currentTime = time;
            }
          } else {
            if (type === 'lyric') {
              player.pendingSeekTime = time;
            }
            await player.play(songIdx);
          }
          player.lyrics.show();
        } else {
          showToast('无法在播放列表中找到该歌鏇');
        }
      });
    });
  };

  const renderSearchTab = () => {
    startIndexingLyrics();
    const listEl = document.getElementById('music-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="search-container">
        <div class="search-box">
          <svg class="search-box-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="global-search-input" placeholder="搜索歌曲标题、歌手、专辑或歌词..." />
          <button id="global-search-clear-btn" class="search-clear-btn" style="display: none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      
      <!-- Real-time dynamic indexing progress bar -->
      <div id="indexing-progress-container" class="indexing-progress-container" style="display: none;">
        <div class="indexing-progress-bar">
          <div class="indexing-progress-fill"></div>
        </div>
        <div class="indexing-progress-text">正在后台生成歌词检索索引中...</div>
      </div>

      <div class="local-tabs" style="display: none;">
        <button class="local-tab-btn ${currentSearchSubTab === 'all' ? 'active' : ''}" data-tab="all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          全部
        </button>
        <button class="local-tab-btn ${currentSearchSubTab === 'songs' ? 'active' : ''}" data-tab="songs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          歌曲
        </button>
        <button class="local-tab-btn ${currentSearchSubTab === 'albums' ? 'active' : ''}" data-tab="albums">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          专辑
        </button>
        <button class="local-tab-btn ${currentSearchSubTab === 'artists' ? 'active' : ''}" data-tab="artists">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          艺术瀹?
        </button>
        <button class="local-tab-btn ${currentSearchSubTab === 'lyrics' ? 'active' : ''}" data-tab="lyrics">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          歌词
        </button>
        <button class="local-tab-btn ${currentSearchSubTab === 'others' ? 'active' : ''}" data-tab="others">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          其他
        </button>
      </div>
      <div id="search-results-list" class="list-songs-container">
        <div class="search-placeholder">输入关键词开始全局搜索...</div>
      </div>
    `;

    // Immediately trigger progress UI update on mount
    updateIndexingProgress();

    const tabsEl = listEl.querySelector('.local-tabs');
    const contentArea = document.querySelector('.content-area');
    if (tabsEl && contentArea && contentArea.scrollTop > 5) {
      tabsEl.classList.add('scrolled');
    }

    const searchInput = listEl.querySelector('#global-search-input');
    const searchClearBtn = listEl.querySelector('#global-search-clear-btn');
    const resultsContainer = listEl.querySelector('#search-results-list');

    if (searchInput) {
      searchInput.value = currentSearchQuery;
      searchClearBtn.style.display = currentSearchQuery ? 'flex' : 'none';
    }

    if (currentSearchQuery) {
      renderSearchList(resultsContainer);
    }

    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      currentSearchQuery = val;
      searchClearBtn.style.display = val ? 'flex' : 'none';
      debouncedSearch(val, resultsContainer);
    });

    searchClearBtn?.addEventListener('click', () => {
      currentSearchQuery = '';
      if (searchInput) searchInput.value = '';
      searchClearBtn.style.display = 'none';
      lastSearchResults = { songs: [], albums: [], artists: [], lyrics: [], others: [] };
      resultsContainer.innerHTML = '<div class="search-placeholder">输入关键词开始全局搜索...</div>';
      const tabsEl = listEl.querySelector('.local-tabs');
      if (tabsEl) tabsEl.style.display = 'none';
      searchInput?.focus();
    });

    listEl.querySelectorAll('.local-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        listEl.querySelectorAll('.local-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSearchSubTab = btn.getAttribute('data-tab');
        if (currentSearchQuery) {
          renderSearchList(resultsContainer);
          resultsContainer.classList.remove('fade-in-up');
          void resultsContainer.offsetWidth;
          resultsContainer.classList.add('fade-in-up');
        }
      });
    });
  };

  // ══ Scanned Directories Initialization & Backward Compatibility ══
  try {
    const cachedDirs = localStorage.getItem('kimo-scanned-dirs');
    if (!cachedDirs) {
      const oldSingle = localStorage.getItem('kimo-scanned-dir');
      if (oldSingle) {
        localStorage.setItem('kimo-scanned-dirs', JSON.stringify([oldSingle]));
      }
    }
  } catch (e) {
    console.error('Failed to init scanned directories:', e);
  }

  // Auto Load Cached Music Library on Startup
  const cachedLibrary = localStorage.getItem('kimo-music-library');
  if (cachedLibrary) {
    try {
      const parsed = JSON.parse(cachedLibrary);
      if (Array.isArray(parsed) && parsed.length > 0) {
        musicLibrary = parsed;
        // 如果 player.playlist 是空的，恢复为整个音乐库
        if (player.playlist.length === 0) {
          player.playlist = [...parsed];
        }
        // Spin up background concurrency task to restore missing cover images
        backgroundLoadCovers(musicLibrary);
      }
    } catch (e) {
      console.error('Failed to load cached music library on startup', e);
    }
  }

  // ⭐ 兼容旧版本：如果没有 musicLibrary 浣?player.playlist 有歌曲，用它初始化library ⭐
  if (musicLibrary.length === 0 && player.playlist.length > 0) {
    musicLibrary = [...player.playlist];
    localStorage.setItem('kimo-music-library', JSON.stringify(musicLibrary));
  }

  // Restore last played song on startup
  try {
    const lastPlayedPath = localStorage.getItem('kimo-last-played-path');
    if (lastPlayedPath && player.playlist.length > 0) {
      const index = player.playlist.findIndex(s => s.file_path === lastPlayedPath);
      if (index >= 0) {
        const song = player.playlist[index];
        player.currentIndex = index;
        
        // Prevent Windows toast notification on startup
        player.lastNotifiedFilePath = song.file_path;
        
        // Update UI with last song
        player.updateUI(song);
        updateHeartButton();
        
        // Load audio source
        player.audio.src = convertFileSrc(song.file_path);
        
        // Load lyrics
        player.lyrics.load(song.file_path);
        
        // Restore progress position
        const savedTime = parseFloat(localStorage.getItem('kimo-last-played-time')) || 0;
        if (savedTime > 0) {
          player.pendingSeekTime = savedTime;
        }

        // Restore dynamic color background state
        const cachedColorStr = localStorage.getItem('kimo-last-dynamic-color');
        const cachedCoverSrc = localStorage.getItem('kimo-last-cover-src');
        if (cachedColorStr) {
          const [r, g, b] = cachedColorStr.split(',').map(Number);
          applyDynamicColor(r, g, b, cachedCoverSrc);
        } else {
          extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
            song.dominant_color = color;
            if (player.currentIndex === index) {
              applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
            }
          });
        }
        
        // Auto play if enabled
        const autoPlayOnStart = localStorage.getItem('kimo-auto-play-on-start') === 'true';
        if (autoPlayOnStart) {
          player.audio.play().catch(e => console.error('Autoplay on start failed:', e));
        }
      }
    }
  } catch (e) {
    console.error('Failed to restore last played song on startup:', e);
  }

  // Switch to discover homepage on startup!
  switchTab('discover');

  // ══ ⭐ 桌面端音乐文件拖放播放系统(Desktop File Drag & Drop Playback System) ⭐ ══
  // 1. 拦截原生拖放以屏钄?Webview 默认页面跳转行为
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  const playDroppedFile = async (filePath) => {
    try {
      console.log('[Drag Drop] Handling dropped file path:', filePath);
      // 判断是否已经在播放列表中
      const existingIdx = player.playlist.findIndex(s => s.file_path === filePath);
      if (existingIdx !== -1) {
        console.log('[Drag Drop] File already in playlist, playing directly. Index:', existingIdx);
        player.play(existingIdx);
        return;
      }

      // 读取音频元数鎹?
      const meta = await invoke('read_audio_metadata', { path: filePath });
      const fileName = filePath.substring(Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1);
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

      const newSong = {
        file_path: filePath,
        title: meta?.title || nameWithoutExt,
        artist: meta?.artist || '未知艺术家',
        album: meta?.album || '未知专辑',
        duration: meta?.duration || 0,
        cover_image: meta?.cover_image || null
      };

      // 追加到播放列表并重新渲染
      player.playlist.push(newSong);
      renderPlaylist(player.playlist);
      
      // 异步更新本地缓存
      localStorage.setItem('kimo-playlist-cache', JSON.stringify(player.playlist));
      
      // 立即播放最后一首（即新拖入的这首）
      player.play(player.playlist.length - 1);
    } catch (err) {
      console.error('[Drag Drop] Failed to process dropped file:', err);
    }
  };

  // 2. 监听 Tauri 原生拖放事件
  try {
    if (window.__TAURI_INTERNALS__) {
      getCurrentWindow().listen('tauri://drag-drop', async (event) => {
        // payload 的格式类似于 { paths: ["C:\\path\\to\\music.mp3"] }
        const paths = event.payload?.paths;
        if (paths && paths.length > 0) {
          const musicExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
          const audioFile = paths.find(p => musicExtensions.some(ext => p.toLowerCase().endsWith(ext)));
          if (audioFile) {
            await playDroppedFile(audioFile);
          } else {
            console.log('[Drag Drop] Dropped files do not contain supported audio formats:', paths);
          }
        }
      });
    } else {
      console.warn('[Drag Drop] Skipped listening to Tauri drag-drop events outside Tauri.');
    }
  } catch (e) {
    console.error('[Drag Drop] Failed to listen to tauri drag-drop events:', e);
  }

  // ══ ⭐ 极致美学自定义亚克力右键菜单系统 (Premium Acrylic Custom Context Menu) ⭐ ══
  let menuEl = document.getElementById('custom-context-menu');
  if (!menuEl) {
    menuEl = document.createElement('div');
    menuEl.id = 'custom-context-menu';
    menuEl.className = 'custom-context-menu';
    document.body.appendChild(menuEl);
  }

  // 拦截并接管全局 contextmenu 右键菜单
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const songItem = e.target.closest('.song-item');
    const albumCard = e.target.closest('.album-card');
    const artistCard = e.target.closest('.artist-card');
    const genreCard = e.target.closest('.genre-card');

    let menuType = 'default';
    let menuHeight = 320;

    if (songItem) {
      menuType = 'song';
      menuHeight = 280;
      const filePath = songItem.getAttribute('data-file-path');
      const songTitle = songItem.querySelector('.song-title')?.textContent || '未知歌曲';
      const songArtist = songItem.querySelector('.song-artist')?.textContent || '未知歌手';
      const songCover = songItem.querySelector('.song-cover')?.src || '';
      // 从播放列表数据获取完整信鎭?
      const plData = player.playlist.find(s => s.file_path === filePath);
      const songAlbum = plData?.album || '';
      const songDuration = plData?.duration || 0;

      menuEl.innerHTML = `
        <div class="context-menu-item" id="menu-song-play">
          <span class="menu-icon">⬜</span>
          <span>立即播放</span>
        </div>
        <div class="context-menu-item" id="menu-song-playnext">
          <span class="menu-icon">🎤</span>
          <span>下一首播鏀?/span>
        </div>
        <div class="context-menu-item" id="menu-song-copy">
          <span class="menu-icon">🔍</span>
          <span>复制歌曲信息</span>
        </div>
        <div class="context-menu-item" id="menu-song-addplaylist">
          <span class="menu-icon">🎵</span>
          <span>添加到歌单/span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="menu-song-edit">
          <span class="menu-icon">✅</span>
          <span>编辑元数鎹?/span>
        </div>
        <div class="context-menu-item" id="menu-song-reveal">
          <span class="menu-icon">📋</span>
          <span>在资源管理器中显绀?/span>
        </div>
      `;

      menuEl.querySelector('#menu-song-play').addEventListener('click', () => {
        const idx = player.playlist.findIndex(s => s.file_path === filePath);
        if (idx >= 0) {
          player.play(idx);
        } else {
          showToast('无法在当前播放列表中找到该歌鏇');
        }
      });

      menuEl.querySelector('#menu-song-playnext').addEventListener('click', () => {
        const currentIdx = player.currentIndex;
        const targetIdx = player.playlist.findIndex(s => s.file_path === filePath);
        if (targetIdx >= 0) {
          const songObj = player.playlist[targetIdx];
          player.playlist.splice(targetIdx, 1);
          let newInsertIdx = currentIdx + 1;
          if (targetIdx < currentIdx) {
            player.currentIndex -= 1;
            newInsertIdx = player.currentIndex + 1;
          }
          player.playlist.splice(newInsertIdx, 0, songObj);
          showToast(`已将銆?{songTitle}》设为下一首播放`);
        } else {
          showToast('无法在当前播放列表中找到该歌鏇');
        }
      });

      menuEl.querySelector('#menu-song-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(`${songTitle} - ${songArtist}`).then(() => {
          showToast('歌曲信息已复制到剪贴鏉');
        }).catch(err => {
          console.error('[ContextMenu] Clipboard copy failed:', err);
          showToast('复制失败');
        });
      });

      menuEl.querySelector('#menu-song-addplaylist').addEventListener('click', () => {
        menuEl.style.display = 'none';
        const songData = { file_path: filePath, title: songTitle, artist: songArtist, album: songAlbum, duration: songDuration, cover_image: songCover };
        if (typeof window.addToPlaylistMenu === 'function') {
          window.addToPlaylistMenu(songData);
        } else {
          showToast('歌单功能未就缁');
        }
      });

      menuEl.querySelector('#menu-song-edit').addEventListener('click', () => {
        openMetadataEditor(filePath);
      });

      menuEl.querySelector('#menu-song-reveal').addEventListener('click', () => {
        invoke('show_in_folder', { path: filePath })
          .then(() => showToast('已在资源管理器中定位文件'))
          .catch(err => {
            console.error('[ContextMenu] show_in_folder failed:', err);
            showToast('定位文件失败');
          });
      });

    } else if (albumCard) {
      menuType = 'album';
      menuHeight = 90;
      const albumTitle = albumCard.querySelector('.album-card-title')?.textContent || '未知专辑';
      const albumSongs = player.playlist.filter(s => (s.album || '未知专辑') === albumTitle);

      menuEl.innerHTML = `
        <div class="context-menu-item" id="menu-album-playall">
          <span class="menu-icon">⬜</span>
          <span>播放专辑全部歌曲</span>
        </div>
        <div class="context-menu-item" id="menu-album-queueall">
          <span class="menu-icon">鉃?/span>
          <span>将专辑追加至末尾</span>
        </div>
      `;

      menuEl.querySelector('#menu-album-playall').addEventListener('click', () => {
        if (albumSongs.length > 0) {
          playSongCollection(albumSongs);
          showToast(`正在播放专辑銆?{albumTitle}》`);
        } else {
          showToast('该专辑下暂无歌曲');
        }
      });

      menuEl.querySelector('#menu-album-queueall').addEventListener('click', () => {
        if (albumSongs.length > 0) {
          let count = 0;
          albumSongs.forEach(song => {
            if (!player.playlist.some(s => s.file_path === song.file_path)) {
              player.playlist.push(song);
              count++;
            }
          });
          showToast(`已追加${count} 首歌曲至队列末尾`);
        }
      });

    } else if (artistCard) {
      menuType = 'artist';
      menuHeight = 90;
      const artistTitle = artistCard.querySelector('.artist-card-title')?.textContent || '未知艺术家';
      const artistSongs = player.playlist.filter(s => (s.artist || '未知艺术家') === artistTitle);

      menuEl.innerHTML = `
        <div class="context-menu-item" id="menu-artist-playall">
          <span class="menu-icon">⬜</span>
          <span>播放歌手全部歌曲</span>
        </div>
        <div class="context-menu-item" id="menu-artist-queueall">
          <span class="menu-icon">鉃?/span>
          <span>将歌曲追加至末尾</span>
        </div>
      `;

      menuEl.querySelector('#menu-artist-playall').addEventListener('click', () => {
        if (artistSongs.length > 0) {
          playSongCollection(artistSongs);
          showToast(`正在播放歌手銆?{artistTitle}》的歌曲`);
        } else {
          showToast('该歌手下暂无歌曲');
        }
      });

      menuEl.querySelector('#menu-artist-queueall').addEventListener('click', () => {
        if (artistSongs.length > 0) {
          let count = 0;
          artistSongs.forEach(song => {
            if (!player.playlist.some(s => s.file_path === song.file_path)) {
              player.playlist.push(song);
              count++;
            }
          });
          showToast(`已追加${count} 首歌曲至队列末尾`);
        }
      });

    } else if (genreCard) {
      menuType = 'genre';
      menuHeight = 90;
      const genreTitle = genreCard.querySelector('.genre-card-title')?.textContent || '未知流派';
      const genreSongs = player.playlist.filter(s => (s.genre || '未知流派') === genreTitle);

      menuEl.innerHTML = `
        <div class="context-menu-item" id="menu-genre-playall">
          <span class="menu-icon">⬜</span>
          <span>播放流派全部歌曲</span>
        </div>
        <div class="context-menu-item" id="menu-genre-queueall">
          <span class="menu-icon">鉃?/span>
          <span>将歌曲追加至末尾</span>
        </div>
      `;

      menuEl.querySelector('#menu-genre-playall').addEventListener('click', () => {
        if (genreSongs.length > 0) {
          playSongCollection(genreSongs);
          showToast(`正在播放流派銆?{genreTitle}》的歌曲`);
        } else {
          showToast('该流派下暂无歌曲');
        }
      });

      menuEl.querySelector('#menu-genre-queueall').addEventListener('click', () => {
        if (genreSongs.length > 0) {
          let count = 0;
          genreSongs.forEach(song => {
            if (!player.playlist.some(s => s.file_path === song.file_path)) {
              player.playlist.push(song);
              count++;
            }
          });
          showToast(`已追加${count} 首歌曲至队列末尾`);
        }
      });

    } else {
      // 默认全局菜单
      menuEl.innerHTML = `
        <div class="context-menu-item" id="menu-play">
          <span class="menu-icon">⬜</span>
          <span>播放 / 暂停</span>
        </div>
        <div class="context-menu-item" id="menu-prev">
          <span class="menu-icon">🎧</span>
          <span>上一棣?/span>
        </div>
        <div class="context-menu-item" id="menu-next">
          <span class="menu-icon">🎤</span>
          <span>下一棣?/span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="menu-goto-settings">
          <span class="menu-icon">⭐</span>
          <span>打开扫描与设缃?/span>
        </div>
        <div class="context-menu-item" id="menu-offset-dec">
          <span class="menu-icon">📁</span>
          <span>歌词提前 0.5s</span>
        </div>
        <div class="context-menu-item" id="menu-offset-inc">
          <span class="menu-icon">📁</span>
          <span>歌词延后 0.5s</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="menu-reload">
          <span class="menu-icon">⚙️</span>
          <span>重新加载界面</span>
        </div>
        <div class="context-menu-item" id="menu-close" style="color: #ff5555;">
          <span class="menu-icon">鉂?/span>
          <span>关闭播放鍣?/span>
        </div>
      `;

      const playIcon = menuEl.querySelector('#menu-play .menu-icon');
      const playText = menuEl.querySelector('#menu-play span:not(.menu-icon)');
      if (player && player.audio && !player.audio.paused) {
        if (playIcon) playIcon.textContent = '鈴革笍';
        if (playText) playText.textContent = '暂停播放';
      } else {
        if (playIcon) playIcon.textContent = '⬜';
        if (playText) playText.textContent = '播放音乐';
      }

      menuEl.querySelector('#menu-play').addEventListener('click', () => {
        const playBtn = document.getElementById('play-btn') || document.querySelector('.btn-play');
        if (playBtn) playBtn.click();
      });

      menuEl.querySelector('#menu-prev').addEventListener('click', () => {
        if (player && typeof player.prev === 'function') player.prev();
      });

      menuEl.querySelector('#menu-next').addEventListener('click', () => {
        if (player && typeof player.next === 'function') player.next();
      });

      menuEl.querySelector('#menu-goto-settings').addEventListener('click', () => {
        switchTab('settings');
      });

      menuEl.querySelector('#menu-offset-dec').addEventListener('click', () => {
        const current = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
        localStorage.setItem('kimo-lyrics-time-offset', (current - 0.5).toFixed(2));
        showToast('歌词已提鍓?0.5s');
      });

      menuEl.querySelector('#menu-offset-inc').addEventListener('click', () => {
        const current = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
        localStorage.setItem('kimo-lyrics-time-offset', (current + 0.5).toFixed(2));
        showToast('歌词已延迟0.5s');
      });

      menuEl.querySelector('#menu-reload').addEventListener('click', () => {
        window.location.reload();
      });

      menuEl.querySelector('#menu-close').addEventListener('click', () => {
        invoke('close_window').catch(err => console.error('[Window] Close failed:', err));
      });
    }

    const menuWidth = 200;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
    menuEl.classList.add('visible');
  });

  window.addEventListener('click', () => {
    if (menuEl) menuEl.classList.remove('visible');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl) {
      menuEl.classList.remove('visible');
    }
  });

  // ══ AI Lyric Transcription & Alignment Integration ══
  const btnAiTranscribe = document.getElementById('btn-ai-transcribe');
  const aiConsole = document.getElementById('kiom-ai-console');
  const aiConsoleLogs = document.getElementById('ai-console-logs');
  const aiConsoleStatus = document.getElementById('ai-console-status-text');
  const aiProgressBar = document.getElementById('ai-console-progress-bar');
  const aiConsoleCloseBtn = document.getElementById('ai-console-close-btn');

  // Close console handler
  if (aiConsoleCloseBtn && aiConsole) {
    aiConsoleCloseBtn.addEventListener('click', () => {
      aiConsole.classList.remove('visible');
    });
  }

  function appendAiLog(message, type = 'info') {
    if (!aiConsoleLogs) return;
    const row = document.createElement('div');
    row.className = `ai-log-row ${type}`;
    
    const time = new Date().toLocaleTimeString();
    row.innerText = `[${time}] ${message}`;
    aiConsoleLogs.appendChild(row);
    aiConsoleLogs.scrollTop = aiConsoleLogs.scrollHeight;
  }

  if (btnAiTranscribe) {
    btnAiTranscribe.addEventListener('click', async () => {
      // 1. Guard check: Check if player is active and has a track
      if (!player || player.currentIndex === -1 || !player.playlist || !player.playlist[player.currentIndex]) {
        alert('当前未播放任何歌曲，请先选择一首歌曲播放后再使用 AI 识别）。');
        return;
      }
      
      const track = player.playlist[player.currentIndex];
      const audioPath = track.file_path;
      const fileName = audioPath.substring(audioPath.lastIndexOf('\\') + 1);
      
      // 2. Open console and initialize UI
      if (aiConsole) {
        aiConsole.classList.add('visible');
      }
      if (aiConsoleLogs) {
        aiConsoleLogs.innerHTML = ''; // Clear previous logs
      }
      if (aiProgressBar) {
        aiProgressBar.className = 'ai-console-progress-bar';
        aiProgressBar.style.width = '10%';
      }
      if (aiConsoleStatus) {
        aiConsoleStatus.innerText = '准备传输...';
      }
      
      appendAiLog(`📋 选定音轨: ${fileName}`, 'info');
      appendAiLog(`馃摗 本地路径: ${audioPath}`, 'info');
      
      // Set loading status with visual micro-animations
      btnAiTranscribe.classList.add('is-loading');
      btnAiTranscribe.title = 'AI 歌词识别中，请稍鍊?..';
      
      try {
        // Default local GPU backend. Can be configured via localStorage.
        const serverUrl = localStorage.getItem('kimo-ai-server-url') || 'http://127.0.0.1:8000/api/v1/transcribe';
        
        appendAiLog(`馃攲 正在连接本地 ASR 推理服务鍣? ${serverUrl}`, 'info');
        appendAiLog(`馃挕 [硬件与模型升级播报] 检测到您的电脑搭载强劲鐨?NVIDIA RTX 3070 Ti 显卡！`, 'success');
        appendAiLog(`馃挕 [硬件与模型升级播报] 已为您自动升级为业界最顶级鐨?[large-v3] 超清声学大模型！`, 'success');
        appendAiLog(`鈿狅笍 [首次使用注意] 首次启动识别时，后台服务器需要自动拉取大模型包(约3GB)。国内网速下可能需要等待数分钟，期间可能会持续显示挂起。请关注您的 Python 终端观察具体下载进度，后续识别将直接用 CUDA 显卡闪电加速！`, 'warn');
        appendAiLog(`   正在读取音频波形数据并准备封装 Multipart 数据化..`, 'info');
        
        if (aiConsoleStatus) aiConsoleStatus.innerText = '正在上传数据...';
        if (aiProgressBar) aiProgressBar.style.width = '30%';
        appendAiLog(`馃殌 音频二进制数据包已打包上传，正在等待 AI 大脑唤醒推理...`, 'info');
        
        // 3. Call Rust command to perform asynchronous HTTP multipart upload and transcription
        const jsonResStr = await invoke('ai_transcribe_audio', { audioPath, serverUrl });
        const res = JSON.parse(jsonResStr);
        
        if (aiProgressBar) aiProgressBar.style.width = '80%';
        appendAiLog(`鉁?ASR 转写成功！自动识别语绉? [${res.language}]`, 'success');
        
        if (!res.lyrics || res.lyrics.length === 0) {
          throw new Error('AI 未能在该歌曲中探测到清晰的人声唱词轨（VAD声谱判定为空）。建议选择人声频段更加清亮响亮的歌曲再次进行识别！');
        }
        
        appendAiLog(`馃搳 成功对齐段落鏁? ${res.lyrics.length} 句, 'info'`);
        // Sample first line
        appendAiLog(`馃幍 首句解析: "${res.lyrics[0].text}"`, 'info');
        appendAiLog(`鈿?CTC 声谱图特征毫秒级字对齐校验通过！, 'success'`);
        
        if (aiConsoleStatus) aiConsoleStatus.innerText = '正在载入...';
        if (aiProgressBar) {
          aiProgressBar.classList.add('success-state');
          aiProgressBar.style.width = '100%';
        }
        
        // 4. Force lyrics scroller to reload from the newly created JSON cache
        appendAiLog(`馃捑 正在写入本地同名离线 JSON 高速缓瀛?..`, 'info');
        if (player.lyrics && typeof player.lyrics.load === 'function') {
          await player.lyrics.load(audioPath);
        }
        
        if (aiConsoleStatus) aiConsoleStatus.innerText = '对齐成功 馃帀';
        appendAiLog(`馃帀 恭喜！高保真卡拉OK流光歌词加载完毕！, 'success'`);
      } catch (err) {
        console.error('[AI Lyric] Failed:', err);
        if (aiProgressBar) {
          aiProgressBar.classList.add('error-state');
          aiProgressBar.style.width = '100%';
        }
        if (aiConsoleStatus) aiConsoleStatus.innerText = '识别失败 鉂';
        
        const errMsg = err.message || err;
        appendAiLog(`鉂?AI 歌词识别失败！, 'error'`);
        appendAiLog(`馃挕 错误详情: ${errMsg}`, 'error');
        appendAiLog(`馃挕 请确保本鍦?8000 端口服务已开启。若为首次点击，请观瀵?Python 终端的模型下载进度！`, 'warn');
      } finally {
        // 5. Restore button state
        btnAiTranscribe.classList.remove('is-loading');
        btnAiTranscribe.title = 'AI 一键生成高保真卡拉OK歌词';
      }
    });
  }

  // ══ ✅ 元数据与歌词字级时轴编辑器内核(Premium Timeline Lyrics Editor System) ══
  
  // 临时内存歌词结构化对璞?
  let currentEditableLyrics = [];
  let currentLyricsType = 'lrc'; // 'json', 'enhanced-lrc', 或者是 'lrc'
  let currentLyricsEditorMode = 'timeline'; // 'timeline' 或者是 'raw'

  // 创建并动态注入悬浮气泡编辑器
  let bubbleEditor = document.getElementById('word-bubble-editor');
  if (!bubbleEditor) {
    bubbleEditor = document.createElement('div');
    bubbleEditor.id = 'word-bubble-editor';
    bubbleEditor.className = 'word-bubble-editor';
    bubbleEditor.innerHTML = `
      <div class="bubble-group">
        <label>开始时闭/label>
        <input type="text" class="bubble-input start" placeholder="00:00.000" />
      </div>
      <div class="bubble-group">
        <label>瀛?璇?/label>
        <input type="text" class="bubble-input text" placeholder="瀛? />
      </div>
      <div class="bubble-group">
        <label>结束时间</label>
        <input type="text" class="bubble-input end" placeholder="00:00.000" />
      </div>
    `;
    document.body.appendChild(bubbleEditor);
    
    // 全局点击自动关闭气泡
    document.addEventListener('click', (e) => {
      if (!bubbleEditor.classList.contains('active')) return;
      if (bubbleEditor.contains(e.target) || e.target.closest('.word-unit-card')) {
        return;
      }
      bubbleEditor.classList.remove('active');
      document.querySelectorAll('.word-unit-card.active').forEach(c => c.classList.remove('active'));
    });
  }

  // 秒转 mm:ss.fff
  const formatSecondsToMinSecMs = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00.000';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // mm:ss.ff (LRC 标准两位小数时间我
  const formatLrcTimePrefix = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '[00:00.00]';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
  };

  const formatLrcTimeStr = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // mm:ss.fff 转秒
  const parseMinSecMsToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10) || 0;
      const sParts = parts[1].split('.');
      const s = parseInt(sParts[0], 10) || 0;
      const ms = sParts[1] ? parseInt(sParts[1], 10) : 0;
      const msScale = sParts[1] ? Math.pow(10, 3 - sParts[1].length) : 1;
      const finalMs = sParts[1] ? (ms * msScale) : 0;
      return m * 60 + s + finalMs / 1000;
    }
    return parseFloat(timeStr) || 0;
  };

  // 解析歌词原文本为结构化列表（新增行翻译的自动合并和多语言 LRC 兼容）。
  const parseLyricsFromRawText = (rawText) => {
    // 1. 判断是否鏄?JSON 歌词
    try {
      const parsed = parseJSONLyrics(rawText);
      if (parsed && parsed.length > 0 && parsed.some(p => p.words)) {
        currentLyricsType = 'json';
        return parsed;
      }
    } catch(e) {}

    // 2. 判断是否鏄?TTML 歌词
    if (rawText.includes('<tt') || rawText.includes('xmlns="http://www.w3.org/ns/ttml"')) {
      currentLyricsType = 'ttml';
      return parseTTML(rawText);
    }

    // 3. 解析 LRC (普通或增强鍨?
    const lines = rawText.split('\n');
    const tempRows = [];
    let isEnhanced = false;

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      // 提取行头时间轴，比如 [00:26.70]
      const rowTimeMatch = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (rowTimeMatch) {
        const m = parseInt(rowTimeMatch[1], 10);
        const s = parseFloat(rowTimeMatch[2]);
        const rowTime = m * 60 + s;
        const remainingText = rowTimeMatch[3].trim();

        // 检查剩余部分是否包含行内字级时间戳，如 ほ[00:26.87] 我銇?00:26.87>
        const inlineTimeRegex = /(?:<|\[)(\d+:\d+(?:\.\d+)?)(?:>|\])/;
        if (inlineTimeRegex.test(remainingText)) {
          isEnhanced = true;
          
          const words = [];
          const wordRegex = /([^<\[]+)(?:<|\[)(\d+:\d+(?:\.\d+)?)(?:>|\])/g;
          let match;
          let lastEndTime = rowTime;

          while ((match = wordRegex.exec(remainingText)) !== null) {
            let wText = match[1];
            const wEndTime = parseMinSecMsToSeconds(match[2]);
            const duration = Math.max(0, wEndTime - lastEndTime);

            const hasCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(wText);
            if (hasCJK) {
              wText = wText.trim();
            }

            words.push({
              time: lastEndTime,
              duration: duration,
              text: wText
            });
            lastEndTime = wEndTime;
          }

          if (words.length > 0) {
            tempRows.push({
              time: rowTime,
              text: remainingText,
              words: words,
              end: lastEndTime,
              translation: null
            });
          } else {
            tempRows.push({ time: rowTime, text: remainingText, translation: null });
          }
        } else {
          // 普通。LRC 行
          tempRows.push({ time: rowTime, text: remainingText, translation: null });
        }
      } else {
        // 无行时间我
        tempRows.push({ time: 0, text: line, translation: null });
      }
    });

    // 译文行自动合并过滤器）。
    // 如果某行的时间与上一行几乎相同（差。<= 0.15秒）且上一行尚未绑定译文，则将当前行判定为上一行的翻译行并进行合并
    const list = [];
    tempRows.forEach(row => {
      if (list.length > 0) {
        const lastRow = list[list.length - 1];
        if (Math.abs(row.time - lastRow.time) <= 0.15 && !lastRow.translation) {
          let textVal = row.text || '';
          let transEndTime = null;

          // 提取并过滤剥除译文末尾可能存在的结束时间戳，例如: 此刻 优美的交响乐[00:09.76]
          const tailTimeMatch = textVal.match(/^(.*?)\s*(?:\[|<)(\d+:\d+(?:\.\d+)?)(?:\]|>)\s*$/);
          if (tailTimeMatch) {
            textVal = tailTimeMatch[1].trim();
            transEndTime = parseMinSecMsToSeconds(tailTimeMatch[2]);
          }

          lastRow.translation = textVal;
          lastRow.translationTime = row.time;
          if (transEndTime) {
            lastRow.translationEnd = transEndTime;
          }
          return; // 过滤本行，不再作为独立歌词行展示
        }
      }
      list.push(row);
    });

    currentLyricsType = isEnhanced ? 'enhanced-lrc' : 'lrc';
    return list;
  };

  // 动态渲染译文输入栏
  const renderTranslationBar = (row, rowDiv) => {
    let transBar = rowDiv.querySelector('.lyric-row-translation-bar');
    if (!transBar) {
      transBar = document.createElement('div');
      transBar.className = 'lyric-row-translation-bar';
      rowDiv.appendChild(transBar);
    }

    if (row.translation !== null && row.translation !== undefined) {
      transBar.innerHTML = `
        <span class="translation-label">璇?/span>
        <input type="text" class="translation-input" value="${row.translation}" placeholder="请输入行翻译内容" />
        <button class="btn-translation-delete" title="删除行翻璇?>&times;</button>
      `;

      // 绑定编辑修改
      transBar.querySelector('.translation-input').addEventListener('change', (e) => {
        row.translation = e.target.value;
      });

      // 绑定删除
      transBar.querySelector('.btn-translation-delete').addEventListener('click', () => {
        row.translation = null;
        row.translationTime = null;
        renderTranslationBar(row, rowDiv);
      });
    } else {
      transBar.innerHTML = `
        <button class="btn-translation-add">鉃?添加行翻璇?/button>
      `;

      // 绑定添加
      transBar.querySelector('.btn-translation-add').addEventListener('click', () => {
        row.translation = '';
        row.translationTime = row.time; // 默认译文时间戳与原文行一鑷?
        renderTranslationBar(row, rowDiv);
      });
    }
  };

  // 图形时间轴歌词渲染渲染器
  const renderLyricsTimeline = (lyricsList) => {
    const viewport = document.getElementById('lyrics-editor-viewport');
    if (!viewport) return;
    viewport.innerHTML = '';

    if (!lyricsList || lyricsList.length === 0) {
      viewport.innerHTML = '<div class="lyrics-editor-loading">暂无歌词数据</div>';
      return;
    }

    lyricsList.forEach((row, rowIdx) => {
      const rowDiv = document.createElement('div');
      
      if (row.words && Array.isArray(row.words)) {
        rowDiv.className = 'lyric-row-item';
        rowDiv.setAttribute('data-row-idx', rowIdx);

        const activeTag = row.tag || '';
        
        rowDiv.innerHTML = `
          <div class="lyric-row-header">
            <div class="lyric-row-meta-left">
              <span class="lyric-row-number">${rowIdx + 1}</span>
              <div class="lyric-row-id-group">
                <button class="lyric-row-id-btn${activeTag === 'v1' ? ' active' : ''}" data-tag="v1">v1</button>
                <button class="lyric-row-id-btn${activeTag === '合唱' ? ' active' : ''}" data-tag="合唱">合唱</button>
                <button class="lyric-row-id-btn${activeTag === '和声' ? ' active' : ''}" data-tag="和声">和声</button>
                <button class="lyric-row-id-btn${activeTag === '段落' ? ' active' : ''}" data-tag="段落">段落</button>
              </div>
            </div>
            <button class="btn-row-remove" title="删除整行">删除行/button>
          </div>
          <div class="lyric-word-grid"></div>
        `;

        const grid = rowDiv.querySelector('.lyric-word-grid');
        row.words.forEach((w, wIdx) => {
          const card = document.createElement('div');
          card.className = 'word-unit-card';
          card.setAttribute('data-word-idx', wIdx);
          
          const startTimeStr = formatSecondsToMinSecMs(w.time);
          const endTimeStr = formatSecondsToMinSecMs(w.time + (w.duration || 0));

          card.innerHTML = `
            <span class="word-time-badge start">${startTimeStr}</span>
            <div class="word-text-display">${w.text || ''}</div>
            <span class="word-time-badge end">${endTimeStr}</span>
          `;
          
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            
            document.querySelectorAll('.word-unit-card.active').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const rect = card.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            const startInput = bubbleEditor.querySelector('.start');
            const textInput = bubbleEditor.querySelector('.text');
            const endInput = bubbleEditor.querySelector('.end');
            
            startInput.value = formatSecondsToMinSecMs(w.time);
            textInput.value = w.text || '';
            endInput.value = formatSecondsToMinSecMs(w.time + (w.duration || 0));
            
            startInput.onchange = (ev) => {
              const newSec = parseMinSecMsToSeconds(ev.target.value);
              w.time = newSec;
              ev.target.value = formatSecondsToMinSecMs(newSec);
              card.querySelector('.start').textContent = formatSecondsToMinSecMs(newSec);
            };
            endInput.onchange = (ev) => {
              const endSec = parseMinSecMsToSeconds(ev.target.value);
              w.duration = Math.max(0, endSec - w.time);
              ev.target.value = formatSecondsToMinSecMs(w.time + w.duration);
              card.querySelector('.end').textContent = formatSecondsToMinSecMs(w.time + w.duration);
            };
            textInput.onchange = (ev) => {
              w.text = ev.target.value;
              card.querySelector('.word-text-display').textContent = ev.target.value;
            };
            
            bubbleEditor.style.left = `${rect.left + rect.width / 2 + scrollLeft}px`;
            bubbleEditor.style.top = `${rect.top + scrollTop - 12}px`;
            bubbleEditor.classList.add('active');
          });

          grid.appendChild(card);
        });

        rowDiv.querySelector('.btn-row-remove').addEventListener('click', () => {
          lyricsList.splice(rowIdx, 1);
          renderLyricsTimeline(lyricsList);
        });

        rowDiv.querySelectorAll('.lyric-row-id-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const tag = e.target.getAttribute('data-tag');
            if (row.tag === tag) {
              row.tag = '';
              e.target.classList.remove('active');
            } else {
              row.tag = tag;
              rowDiv.querySelectorAll('.lyric-row-id-btn').forEach(b => b.classList.remove('active'));
              e.target.classList.add('active');
            }
          });
        });

        // 动态附加翻译栏
        renderTranslationBar(row, rowDiv);

      } else {
        rowDiv.className = 'lrc-row-item-container'; // 使用外层包裹容器以优雅容纳原文和译文行
        rowDiv.innerHTML = `
          <div class="lrc-row-item" data-row-idx="${rowIdx}">
            <input type="text" class="lrc-time-input" value="${formatSecondsToMinSecMs(row.time)}" />
            <input type="text" class="lrc-text-input" value="${row.text || ''}" placeholder="歌词文本" />
            <button class="btn-row-remove" title="删除此行">删除</button>
          </div>
        `;

        rowDiv.querySelector('.lrc-time-input').addEventListener('change', (e) => {
          const newSec = parseMinSecMsToSeconds(e.target.value);
          row.time = newSec;
          e.target.value = formatSecondsToMinSecMs(newSec);
        });
        rowDiv.querySelector('.lrc-text-input').addEventListener('change', (e) => {
          row.text = e.target.value;
        });
        rowDiv.querySelector('.btn-row-remove').addEventListener('click', () => {
          lyricsList.splice(rowIdx, 1);
          renderLyricsTimeline(lyricsList);
        });

        // 动态附加翻译栏
        renderTranslationBar(row, rowDiv);
      }

      viewport.appendChild(rowDiv);
    });
  };

  const formatTTMLTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const serializeTTML = (lyricsList) => {
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<tt xml:lang="zh" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">\n`;
    xml += `  <head>\n    <metadata>\n      <ttm:title>Lyrics</ttm:title>\n    </metadata>\n  </head>\n  <body>\n    <div>\n`;
    
    lyricsList.forEach(row => {
      const pBegin = formatTTMLTime(row.time);
      const pEnd = row.end ? formatTTMLTime(row.end) : null;
      
      let pAttr = `begin="${pBegin}"`;
      if (pEnd) pAttr += ` end="${pEnd}"`;
      if (row.tag) pAttr += ` ttm:role="${row.tag}"`;
      
      xml += `      <p ${pAttr}>`;
      
      if (row.words && Array.isArray(row.words) && row.words.length > 0) {
        xml += `\n`;
        row.words.forEach((w, idx) => {
          const wBegin = formatTTMLTime(w.time);
          let nextTime = null;
          if (idx < row.words.length - 1) {
            nextTime = row.words[idx + 1].time;
          } else {
            nextTime = row.end || (w.time + (w.duration || 0.1));
          }
          const wEnd = formatTTMLTime(nextTime);
          
          let spanAttr = `begin="${wBegin}" end="${wEnd}"`;
          const escapedText = (w.text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          xml += `        <span ${spanAttr}>${escapedText}</span>\n`;
        });
        xml += `      </p>\n`;
      } else {
        const escapedText = (row.text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        xml += `${escapedText}</p>\n`;
      }
    });
    
    xml += `    </div>\n  </body>\n</tt>`;
    return xml;
  };

  // 将工作区时轴序列化回文本
  const serializeLyricsFromWorkspace = () => {
    if (currentLyricsType === 'ttml') {
      return serializeTTML(currentEditableLyrics);
    }
    if (currentLyricsType === 'json') {
      const list = currentEditableLyrics.map(row => {
        let rowText = row.text;
        if (row.words && Array.isArray(row.words)) {
          rowText = row.words.map(w => w.text).join('');
        }
        return {
          time: row.time,
          text: rowText,
          tag: row.tag || null,
          translation: row.translation || null,
          end: row.end || null,
          words: row.words ? row.words.map(w => ({
            time: w.time,
            duration: w.duration,
            text: w.text
          })) : null
        };
      });
      return JSON.stringify({ lyrics: list });
    } else if (currentLyricsType === 'enhanced-lrc') {
      const resultLines = [];
      currentEditableLyrics.forEach(row => {
        const rowTimeStr = formatLrcTimePrefix(row.time);
        if (row.words && Array.isArray(row.words)) {
          const wordParts = row.words.map(w => {
            const endTimeStr = formatLrcTimeStr(w.time + (w.duration || 0));
            return `${w.text || ''}[${endTimeStr}]`;
          }).join('');
          resultLines.push(`${rowTimeStr}${wordParts}`);
        } else {
          resultLines.push(`${rowTimeStr}${row.text || ''}`);
        }
        
        // 如果该行有翻译，拆分成相同时间戳的伴生译文行输出
        if (row.translation !== null && row.translation !== undefined) {
          const transTimeStr = formatLrcTimePrefix(row.translationTime !== undefined && row.translationTime !== null ? row.translationTime : row.time);
          let transEndTimeStr = "";
          if (row.translationEnd !== undefined && row.translationEnd !== null) {
            transEndTimeStr = `[${formatLrcTimeStr(row.translationEnd)}]`;
          }
          resultLines.push(`${transTimeStr}${row.translation}${transEndTimeStr}`);
        }
      });
      return resultLines.join('\n');
    } else {
      const resultLines = [];
      currentEditableLyrics.forEach(row => {
        const rowTimeStr = formatLrcTimePrefix(row.time);
        resultLines.push(`${rowTimeStr}${row.text || ''}`);
        
        // 如果该行有翻译，拆分成相同时间戳的伴生译文行输出
        if (row.translation !== null && row.translation !== undefined) {
          const transTimeStr = formatLrcTimePrefix(row.translationTime !== undefined && row.translationTime !== null ? row.translationTime : row.time);
          let transEndTimeStr = "";
          if (row.translationEnd !== undefined && row.translationEnd !== null) {
            transEndTimeStr = `[${formatLrcTimeStr(row.translationEnd)}]`;
          }
          resultLines.push(`${transTimeStr}${row.translation}${transEndTimeStr}`);
        }
      });
      return resultLines.join('\n');
    }
  };

  const openMetadataEditor = async (filePath) => {
    const song = player.playlist.find(s => s.file_path === filePath);
    if (!song) {
      showToast('未在当前播放列表中找到该歌曲信息');
      return;
    }

    const modal = document.getElementById('metadata-editor-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    const fileName = filePath.substring(Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1);
    const filenameTip = document.getElementById('edit-metadata-filename-tip');
    if (filenameTip) filenameTip.textContent = `文件路径: ${fileName}`;

    document.getElementById('edit-metadata-path').value = filePath;
    document.getElementById('edit-metadata-title').value = song.title || '';
    document.getElementById('edit-metadata-artist').value = song.artist || '';
    document.getElementById('edit-metadata-album').value = song.album || '';
    document.getElementById('edit-metadata-cover-preview').src = getCoverSrc(song.cover_image);
    document.getElementById('edit-metadata-cover-path').value = '';
    document.getElementById('edit-metadata-remove-cover').value = 'false';

    document.getElementById('edit-metadata-year').value = '';
    document.getElementById('edit-metadata-track').value = '';
    document.getElementById('edit-metadata-disc').value = '';
    document.getElementById('edit-metadata-genre').value = '';
    document.getElementById('edit-metadata-album-artist').value = '';
    document.getElementById('edit-metadata-composer').value = '';
    document.getElementById('edit-metadata-lyricist').value = '';
    document.getElementById('edit-metadata-comment').value = '';
    document.getElementById('edit-metadata-lyrics').value = '正在读取歌词中..';

    try {
      const meta = await invoke('read_audio_metadata', { path: filePath });
      if (meta) {
        document.getElementById('edit-metadata-title').value = meta.title || song.title || '';
        document.getElementById('edit-metadata-artist').value = meta.artist || song.artist || '';
        document.getElementById('edit-metadata-album').value = meta.album || song.album || '';
        document.getElementById('edit-metadata-year').value = meta.year || '';
        document.getElementById('edit-metadata-track').value = meta.track_number || '';
        document.getElementById('edit-metadata-disc').value = meta.disc_number || '';
        document.getElementById('edit-metadata-genre').value = meta.genre || '';
        document.getElementById('edit-metadata-album-artist').value = meta.album_artist || '';
        document.getElementById('edit-metadata-composer').value = meta.composer || '';
        document.getElementById('edit-metadata-lyricist').value = meta.lyricist || '';
        document.getElementById('edit-metadata-comment').value = meta.comment || '';
        if (meta.cover_image) {
          document.getElementById('edit-metadata-cover-preview').src = getCoverSrc(meta.cover_image);
        }
      }

      const lyrRes = await invoke('get_lyrics', { audioPath: filePath });
      let lyricsContent = '';
      if (lyrRes && lyrRes.content) {
        lyricsContent = lyrRes.content;
      }

      currentLyricsEditorMode = 'timeline';
      document.getElementById('lyrics-editor-raw-container').style.display = 'none';
      document.getElementById('lyrics-editor-viewport').style.display = 'block';
      document.getElementById('btn-lyrics-raw-toggle').textContent = '切换纯文本编杈';

      const list = parseLyricsFromRawText(lyricsContent);
      currentEditableLyrics = list;
      renderLyricsTimeline(list);

      const addLineBtn = document.getElementById('btn-lyrics-add-line');
      if (addLineBtn) {
        addLineBtn.style.display = currentLyricsType === 'lrc' ? 'inline-block' : 'none';
      }

      document.getElementById('edit-metadata-lyrics').value = lyricsContent;
    } catch (e) {
      console.error('[MetadataEditor] Failed to fetch full metadata/lyrics on load:', e);
      document.getElementById('edit-metadata-lyrics').value = '';
    }
  };

  const closeMetadataEditor = () => {
    const modal = document.getElementById('metadata-editor-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.style.display = 'none', 300);
    }
    if (bubbleEditor) {
      bubbleEditor.classList.remove('active');
      document.querySelectorAll('.word-unit-card.active').forEach(c => c.classList.remove('active'));
    }
  };

  document.getElementById('metadata-editor-close')?.addEventListener('click', closeMetadataEditor);
  document.getElementById('metadata-editor-cancel')?.addEventListener('click', closeMetadataEditor);

  document.getElementById('edit-metadata-change-cover')?.addEventListener('click', async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
        }]
      });
      if (selected) {
        document.getElementById('edit-metadata-cover-path').value = selected;
        document.getElementById('edit-metadata-cover-preview').src = convertFileSrc(selected);
        document.getElementById('edit-metadata-remove-cover').value = 'false';
      }
    } catch (err) {
      console.error('[MetadataEditor] Failed to select cover image:', err);
      showToast('选择图片失败');
    }
  });

  document.getElementById('edit-metadata-delete-cover')?.addEventListener('click', () => {
    document.getElementById('edit-metadata-remove-cover').value = 'true';
    document.getElementById('edit-metadata-cover-path').value = '';
    document.getElementById('edit-metadata-cover-preview').src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23333'/></svg>";
  });

  // 导入外部歌词文件绑定
  document.getElementById('btn-lyrics-import')?.addEventListener('click', async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Lyrics Files',
          extensions: ['lrc', 'ttml', 'txt']
        }]
      });
      if (selected) {
        const content = await invoke('read_text_file', { path: selected });
        if (!content || !content.trim()) {
          showToast('歌词文件为空');
          return;
        }

        const list = parseLyricsFromRawText(content);
        if (!list || list.length === 0) {
          showToast('歌词解析失败，请检查格寮');
          return;
        }

        currentEditableLyrics = list;
        document.getElementById('edit-metadata-lyrics').value = content;
        renderLyricsTimeline(list);
        showToast('成功导入外部歌词文件');
      }
    } catch (err) {
      console.error('[MetadataEditor] Failed to import external lyrics:', err);
      showToast('导入歌词文件失败');
    }
  });

  // 歌词模式切换绑定
  document.getElementById('btn-lyrics-raw-toggle')?.addEventListener('click', () => {
    const rawContainer = document.getElementById('lyrics-editor-raw-container');
    const viewport = document.getElementById('lyrics-editor-viewport');
    const textarea = document.getElementById('edit-metadata-lyrics');
    const toggleBtn = document.getElementById('btn-lyrics-raw-toggle');
    const addLineBtn = document.getElementById('btn-lyrics-add-line');

    if (currentLyricsEditorMode === 'timeline') {
      const serialized = serializeLyricsFromWorkspace();
      textarea.value = serialized;
      viewport.style.display = 'none';
      rawContainer.style.display = 'block';
      toggleBtn.textContent = '切换图形时间杞';
      if (addLineBtn) addLineBtn.style.display = 'none';
      currentLyricsEditorMode = 'raw';
    } else {
      const list = parseLyricsFromRawText(textarea.value);
      currentEditableLyrics = list;
      renderLyricsTimeline(list);
      rawContainer.style.display = 'none';
      viewport.style.display = 'block';
      toggleBtn.textContent = '切换纯文本编杈';
      if (addLineBtn && currentLyricsType === 'lrc') {
        addLineBtn.style.display = 'inline-block';
      } else if (addLineBtn) {
        addLineBtn.style.display = 'none';
      }
      currentLyricsEditorMode = 'timeline';
    }
  });

  // 新增歌词行绑瀹?
  document.getElementById('btn-lyrics-add-line')?.addEventListener('click', () => {
    if (currentLyricsType === 'lrc' && currentEditableLyrics) {
      const lastTime = currentEditableLyrics.length > 0 ? currentEditableLyrics[currentEditableLyrics.length - 1].time + 5 : 0;
      currentEditableLyrics.push({ time: lastTime, text: '新歌词行' });
      renderLyricsTimeline(currentEditableLyrics);
    }
  });

  document.getElementById('metadata-editor-save')?.addEventListener('click', async () => {
    const filePath = document.getElementById('edit-metadata-path').value;
    const title = document.getElementById('edit-metadata-title').value.trim();
    const artist = document.getElementById('edit-metadata-artist').value.trim();
    const album = document.getElementById('edit-metadata-album').value.trim();
    const coverPath = document.getElementById('edit-metadata-cover-path').value;
    const removeCover = document.getElementById('edit-metadata-remove-cover').value === 'true';

    const yearVal = document.getElementById('edit-metadata-year').value;
    const trackVal = document.getElementById('edit-metadata-track').value;
    const discVal = document.getElementById('edit-metadata-disc').value;
    const genre = document.getElementById('edit-metadata-genre').value;
    const albumArtist = document.getElementById('edit-metadata-album-artist').value;
    const composer = document.getElementById('edit-metadata-composer').value;
    const lyricist = document.getElementById('edit-metadata-lyricist').value;
    const comment = document.getElementById('edit-metadata-comment').value;

    const isRawMode = currentLyricsEditorMode === 'raw';
    const lyricsVal = isRawMode 
      ? document.getElementById('edit-metadata-lyrics').value 
      : serializeLyricsFromWorkspace();

    if (!title) {
      showToast('歌曲标题不能为空');
      return;
    }

    const saveBtn = document.getElementById('metadata-editor-save');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '保存中..';
    saveBtn.disabled = true;

    try {
      await invoke('write_audio_metadata', {
        path: filePath,
        title,
        artist: artist || '未知歌手',
        album: album || '未知专辑',
        year: yearVal ? parseInt(yearVal, 10) : null,
        trackNumber: trackVal ? parseInt(trackVal, 10) : null,
        discNumber: discVal ? parseInt(discVal, 10) : null,
        genre: genre || null,
        albumArtist: albumArtist || null,
        composer: composer || null,
        lyricist: lyricist || null,
        comment: comment || null,
        lyrics: lyricsVal || null,
        coverImagePath: coverPath || null,
        removeCover: removeCover
      });

      const updatedMeta = await invoke('read_audio_metadata', { path: filePath });

      const songIdx = player.playlist.findIndex(s => s.file_path === filePath);
      if (songIdx !== -1) {
        const originalSong = player.playlist[songIdx];
        const updatedSong = {
          ...originalSong,
          title: updatedMeta.title || title,
          artist: updatedMeta.artist || artist || '未知歌手',
          album: updatedMeta.album || album || '未知专辑',
          cover_image: updatedMeta.cover_image || null,
        };

        if (coverPath || removeCover) {
          updatedSong.dominant_color = null;
        }

        player.playlist[songIdx] = updatedSong;

        localStorage.setItem('kimo-playlist-cache', JSON.stringify(player.playlist));

        renderPlaylist(player.playlist);

        if (songIdx === player.currentIndex) {
          player.updateUI(updatedSong);
          updateHeartButton();
          if (player.lyrics && typeof player.lyrics.load === 'function') {
            await player.lyrics.load(filePath);
          }

          if (updatedSong.cover_image) {
            extractDominantColor(getCoverSrc(updatedSong.cover_image)).then(color => {
              updatedSong.dominant_color = color;
              if (player.currentIndex === songIdx) {
                applyDynamicColor(color.r, color.g, color.b, getCoverSrc(updatedSong.cover_image));
              }
            });
          } else {
            const defColor = getDefaultDynamicColor();
            applyDynamicColor(defColor.r, defColor.g, defColor.b, getCoverSrc(null));
          }
        }
      }

      showToast('元数据与歌词修改并保存成鍔');
      closeMetadataEditor();
    } catch (err) {
      console.error('[MetadataEditor] Failed to save metadata:', err);
      showToast(`保存失败: ${err}`);
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  });

  // Expose openMetadataEditor globally
  window.openMetadataEditor = openMetadataEditor;

  // ══ Album Cover Context Menu and Image View Modal ══
  const viewAlbumImageLarge = (coverSrc) => {
    const oldModal = document.getElementById('kimo-album-zoom-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'kimo-album-zoom-modal';
    modal.className = 'kimo-modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '99999';

    modal.innerHTML = `
      <div class="kimo-modal-card" style="max-width: 480px; width: 90%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px;">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 12px; margin-bottom: 4px;">
          <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">专辑大图查看</span>
          <button id="close-zoom-modal-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none; padding: 4px; border-radius: 50%; transition: background 0.2s;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <img src="${coverSrc}" style="width: 100%; aspect-ratio: 1/1; border-radius: 12px; object-fit: cover; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); user-select: none;" />
        <div style="display: flex; gap: 12px; width: 100%; margin-top: 4px;">
          <button class="kimo-modal-btn secondary" id="download-zoom-cover-btn" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--glass-border); background: rgba(255, 255, 255, 0.05); color: var(--text-primary); transition: all 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>保存图片</span>
          </button>
          <button class="kimo-modal-btn primary" id="close-zoom-cover-btn" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; background: rgb(var(--dynamic-color, 0, 240, 255)); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: all 0.2s;">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };
    
    modal.querySelector('#close-zoom-modal-btn').addEventListener('click', close);
    modal.querySelector('#close-zoom-cover-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    modal.querySelector('#download-zoom-cover-btn').addEventListener('click', async () => {
      try {
        const response = await fetch(coverSrc);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'album_cover.jpg';
        a.click();
        if (window.showToast) window.showToast('已启动专辑封面图片下杞');
      } catch (e) {
        if (window.showToast) window.showToast('图片保存失败: ' + e.message);
      }
    });
  };

  const onCoverContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const song = player.playlist[player.currentIndex];
    if (!song) return;
    
    const oldMenu = document.getElementById('kimo-album-context-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'kimo-album-context-menu';
    menu.className = 'kimo-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const itemImg = document.createElement('div');
    itemImg.className = 'kimo-context-menu-item';
    itemImg.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>查看专辑大图</span>
    `;
    itemImg.addEventListener('click', () => {
      menu.remove();
      viewAlbumImageLarge(getCoverSrc(song.cover_image));
    });

    const itemMeta = document.createElement('div');
    itemMeta.className = 'kimo-context-menu-item';
    itemMeta.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>查看歌曲元数鎹?/span>
    `;
    itemMeta.addEventListener('click', () => {
      menu.remove();
      if (window.openMetadataEditor) {
        window.openMetadataEditor(song.file_path);
      }
    });

    menu.appendChild(itemImg);
    menu.appendChild(itemMeta);
    document.body.appendChild(menu);

    const clickOut = () => {
      menu.remove();
      document.removeEventListener('click', clickOut);
    };
    setTimeout(() => {
      document.addEventListener('click', clickOut);
    }, 50);
  };

  document.getElementById('current-cover')?.addEventListener('contextmenu', onCoverContextMenu);
  document.getElementById('lyrics-cover-click-area')?.addEventListener('contextmenu', onCoverContextMenu);

  // Lyrics settings toolbar: hidden by default, click gear to expand, auto-hide on outside click / ESC
  (() => {
    const controls = document.querySelector('.lyrics-controls');
    const toggle = document.getElementById('lyrics-settings-toggle');
    if (!controls || !toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      controls.classList.toggle('is-collapsed');
    });
    document.addEventListener('click', (e) => {
      if (controls.classList.contains('is-collapsed')) return;
      if (!controls.contains(e.target)) {
        controls.classList.add('is-collapsed');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !controls.classList.contains('is-collapsed')) {
        controls.classList.add('is-collapsed');
      }
    });
  })();

  // Mini lyrics: apply "show translation" setting (toggled from settings panel)
  function applyMiniLyricsTranslationSetting() {
    const container = document.querySelector('.player-center-lyrics');
    if (!container) return;
    const show = localStorage.getItem('kimo-mini-lyrics-show-translation') === 'true';
    container.classList.toggle('mini-show-translation', show);
  }
  applyMiniLyricsTranslationSetting();

  // 首次打开 1.3.0-beta0721 弹出更新公告
  if (localStorage.getItem('kimo-update-seen-130') !== 'true') {
    const sections = [
      {
        title: '播放列表',
        items: [
          ['🔍', '<b>播放列表弹出面板</b><br>底部播放栏新增按钮，点击查看当前队列<br>支持查看路播放/路移除/路一键清空，实时高亮当前曲目'],
        ],
      },
      {
        title: '歌单',
        items: [
          ['📋', '<b>歌单详情页重写/b><br>单击直接播放、悬停动画、入场效果、SVG 图标'],
          ['📋', '歌单歌曲支持<b>右键菜单</b>（添加到歌单/播放/复制等）'],
          ['📋', '点击歌单歌曲或播放全部时<b>自动替换播放队列</b>'],
          ['📋', '歌单封面改用 <b>img 标签</b>，加载更稳定'],
        ],
      },
      {
        title: '其他优化',
        items: [
          ['馃幍', '歌词行间距可调节（设置页面）'],
          ['馃帹', '弹窗加入退场动画'],         ['馃悰', '修复全部歌曲随播放队列变化的问题'],
          ['馃悰', '修复大型曲库扫描报错'],
        ],
      },
    ];

    const sectionsHTML = sections.map(sec => {
      const itemsHTML = sec.items.map(([icon, text]) =>
        `<div style="display:flex;gap:10px;margin-bottom:8px;line-height:1.5;">
          <span style="flex-shrink:0;font-size:14px;line-height:1.5;">${icon}</span>
          <span style="flex:1;color:var(--text-secondary);font-size:12.5px;line-height:1.6;">${text}</span>
        </div>`
      ).join('');
      return `<div style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">${sec.title}</div>
        ${itemsHTML}
      </div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'kimo-modal-overlay';
    overlay.innerHTML = `<div class="kimo-modal-card" style="max-width:480px;width:92%;max-height:78vh;padding:0;text-align:left;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:24px 26px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:22px;">馃帀</span> KiomPlayer 1.3.0-beta
        </div>
        <div style="font-size:11px;color:var(--text-secondary);">2026.07.21 路 Beta</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px 26px;font-size:13px;color:var(--text-secondary);line-height:1.8;min-height:0;">${sectionsHTML}</div>
      <div style="padding:14px 26px;border-top:1px solid rgba(255,255,255,0.08);">
        <button id="kimo-update-ok-btn" style="width:100%;padding:10px;font-size:14px;font-weight:600;border:none;border-radius:8px;background:rgb(var(--dynamic-color,16,185,129));color:#fff;cursor:pointer;">开始体楠?/button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.id === 'kimo-update-ok-btn') {
        overlay.style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.opacity = '0';
        overlay.querySelector('.kimo-modal-card').style.transform = 'scale(0.9) translateY(20px)';
        setTimeout(() => overlay.remove(), 200);
        localStorage.setItem('kimo-update-seen-130', 'true');
      }
    });
  }
});
