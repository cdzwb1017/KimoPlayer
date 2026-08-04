import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';

const root = document.getElementById('desktop-lyrics');
const main = document.getElementById('desktop-lyrics-main');
const translation = document.getElementById('desktop-lyrics-translation');
const nextMain = document.getElementById('desktop-lyrics-next');
const nextTranslation = document.getElementById('desktop-lyrics-next-translation');
const nextContainer = document.getElementById('desktop-lyrics-next-container');
const mainContainer = document.getElementById('desktop-lyrics-main-container');

const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

let currentFontSize = 34;
let activeDesktopCustomFontFace = null;
let lastLoadedFontPath = '';
let fontLoadGeneration = 0; // 请求代际：快速切换时旧请求不覆盖新结果

const lastStyleState = {};

async function applyDesktopFont(fontMode, fontCustomPath, fontFamily) {
  // 只要传入了字体路径就尝试注册 FontFace（user/custom 模式，以及 follow 跟随界面用户字体）
  const isCustomOrUser = !!fontCustomPath
    && (fontMode === 'custom' || (fontMode && fontMode.startsWith('user:')) || fontMode === 'follow');
  if (isCustomOrUser) {
    if (lastLoadedFontPath === fontCustomPath && activeDesktopCustomFontFace) {
      return;
    }
    const generation = ++fontLoadGeneration;
    try {
      const sourceUrl = convertFileSrc(fontCustomPath);
      // user 模式：family 取自传入的 fontFamily 字符串（KimoUserFont_xxx），
      // custom（旧版）模式沿用固定 family
      const familyMatch = fontFamily?.match(/'([^']+)'/);
      const family = familyMatch ? familyMatch[1] : 'KimoDesktopLyricsCustom';
      const nextFontFace = new FontFace(family, `url(${JSON.stringify(sourceUrl)})`);
      await nextFontFace.load();
      // 加载期间若又切换了字体，丢弃本次过期结果
      if (generation !== fontLoadGeneration) return;
      if (activeDesktopCustomFontFace) {
        document.fonts.delete(activeDesktopCustomFontFace);
      }
      document.fonts.add(nextFontFace);
      activeDesktopCustomFontFace = nextFontFace;
      lastLoadedFontPath = fontCustomPath;
      root.style.fontFamily = fontFamily || `'${family}', system-ui, "Microsoft YaHei UI", sans-serif`;
      return;
    } catch (e) {
      if (generation !== fontLoadGeneration) return;
      console.warn('[DesktopLyricsWindow] Failed to load custom font:', e);
    }
  }

  if (activeDesktopCustomFontFace) {
    document.fonts.delete(activeDesktopCustomFontFace);
    activeDesktopCustomFontFace = null;
    lastLoadedFontPath = '';
  }
  // 用 root 实际字体而非 lastStyleState 判断：applyStyle 已先行更新
  // lastStyleState.fontFamily，若拿它比较会恒等导致字体永不应用
  if (fontFamily && root.style.fontFamily !== fontFamily) {
    root.style.fontFamily = fontFamily;
  } else if (!fontFamily && root.style.fontFamily) {
    root.style.fontFamily = '';
  }
}

// 双行模式/布局变化时自动调整窗口大小（单行 620x104；双行上下 620x160；双行左右 980x160）
function applyWindowSize() {
  const mode = lastStyleState.lineMode || root.getAttribute('data-line-mode') || 'single';
  const layout = lastStyleState.lineLayout || root.getAttribute('data-line-layout') || 'stacked';
  const win = getCurrentWindow();
  if (mode === 'single') {
    win.setSize({ width: 620, height: 104 }).catch(() => {});
  } else if (layout === 'split') {
    win.setSize({ width: 980, height: 160 }).catch(() => {});
  } else {
    win.setSize({ width: 620, height: 160 }).catch(() => {});
  }
}

const applyStyle = (style = {}) => {
  if (!style || typeof style !== 'object') return;

  if (Number.isFinite(style.fontSize) && lastStyleState.fontSize !== style.fontSize) {
    currentFontSize = style.fontSize;
    lastStyleState.fontSize = style.fontSize;
    root.style.setProperty('--desktop-lyrics-size', `${style.fontSize}px`);
  }

  if (Number.isFinite(style.opacity) && lastStyleState.opacity !== style.opacity) {
    lastStyleState.opacity = style.opacity;
    root.style.setProperty('--desktop-lyrics-opacity', String(style.opacity));
  }

  if (style.theme && lastStyleState.theme !== style.theme) {
    lastStyleState.theme = style.theme;
    root.setAttribute('data-theme', style.theme);
  }

  if (style.dynamicColor && lastStyleState.dynamicColor !== style.dynamicColor) {
    lastStyleState.dynamicColor = style.dynamicColor;
    root.style.setProperty('--dynamic-color', style.dynamicColor);
  }

  const appTheme = style.appTheme || localStorage.getItem('kimo-theme') || 'light';
  if (lastStyleState.appTheme !== appTheme) {
    lastStyleState.appTheme = appTheme;
    root.setAttribute('data-app-theme', appTheme);
  }

  if (style.align && lastStyleState.align !== style.align) {
    lastStyleState.align = style.align;
    root.setAttribute('data-align', style.align);
  }

  if (style.lineMode && lastStyleState.lineMode !== style.lineMode) {
    lastStyleState.lineMode = style.lineMode;
    root.setAttribute('data-line-mode', style.lineMode);
    // 模式切换时重置两句一组状态机
    dualPhase = false;
    nextDisplayText = '';
    applyWindowSize();
  }
  // 双行布局模式（上下/左右）：切换时自动调整窗口大小适配
  if (style.lineLayout && lastStyleState.lineLayout !== style.lineLayout) {
    lastStyleState.lineLayout = style.lineLayout;
    root.setAttribute('data-line-layout', style.lineLayout);
    applyWindowSize();
  }
  // 逐字扫字开关：由 style 事件吸收，供 karaoke/update 监听判定渲染模式
  if (typeof style.wordByWord === 'boolean') {
    lastStyleState.wordByWord = style.wordByWord;
  }

  if (typeof style.showTranslation === 'boolean' && lastStyleState.showTranslation !== style.showTranslation) {
    lastStyleState.showTranslation = style.showTranslation;
    translation.style.display = style.showTranslation ? '' : 'none';
    if (nextTranslation) nextTranslation.style.display = style.showTranslation ? '' : 'none';
  }

  // 🌟 重点优化：原生态 IPC 穿透调用 setIgnoreCursorEvents 仅在锁定状态变更时执行 🌟
  if (typeof style.locked === 'boolean' && lastStyleState.locked !== style.locked) {
    lastStyleState.locked = style.locked;
    root.classList.toggle('is-locked', style.locked);
    getCurrentWindow().setIgnoreCursorEvents(style.locked).catch(() => {});
  }

  if (typeof style.glow === 'boolean' && lastStyleState.glow !== style.glow) {
    lastStyleState.glow = style.glow;
    root.setAttribute('data-glow', style.glow ? 'true' : 'false');
  }

  if (typeof style.stroke === 'boolean' && lastStyleState.stroke !== style.stroke) {
    lastStyleState.stroke = style.stroke;
    root.setAttribute('data-stroke', style.stroke ? 'true' : 'false');
  }

  // 自由调色：已播放 / 未播放颜色（空值不覆盖，保持主题预设）
  if (typeof style.customColor === 'boolean' && lastStyleState.customColor !== style.customColor) {
    lastStyleState.customColor = style.customColor;
    root.setAttribute('data-custom-color', style.customColor ? 'true' : 'false');
  }
  if (style.activeColor && lastStyleState.activeColor !== style.activeColor) {
    lastStyleState.activeColor = style.activeColor;
    root.style.setProperty('--desktop-lyrics-active-color', style.activeColor);
  }
  if (style.inactiveColor && lastStyleState.inactiveColor !== style.inactiveColor) {
    lastStyleState.inactiveColor = style.inactiveColor;
    root.style.setProperty('--desktop-lyrics-inactive-color', style.inactiveColor);
  }

  if (style.fontMode !== lastStyleState.fontMode || style.fontCustomPath !== lastStyleState.fontCustomPath || style.fontFamily !== lastStyleState.fontFamily) {
    lastStyleState.fontMode = style.fontMode;
    lastStyleState.fontCustomPath = style.fontCustomPath;
    lastStyleState.fontFamily = style.fontFamily;
    applyDesktopFont(style.fontMode, style.fontCustomPath, style.fontFamily);
  }
};

const sendAction = (action, payload = {}) => {
  emit('desktop-lyrics-action', { action, ...payload }).catch(() => {});
};

// 绑定浮动工具栏按键事件
document.getElementById('btn-prev')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('prev');
});

document.getElementById('btn-play')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('toggle-play');
});

document.getElementById('btn-next')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('next');
});

document.getElementById('btn-theme')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('cycle-theme');
});

document.getElementById('btn-size-down')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('size-down');
});

document.getElementById('btn-size-up')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('size-up');
});

document.getElementById('btn-line-mode')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('toggle-line-mode');
});

document.getElementById('btn-lock')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('toggle-lock');
});

document.getElementById('btn-close')?.addEventListener('click', (e) => {
  e.stopPropagation();
  sendAction('close');
});

let currentText = '';
let cachedSpans = [];

function buildWordSpans(str) {
  if (!str) return '♪ KiomPlayer ♪';
  const chars = Array.from(str);
  return chars.map(ch => {
    const safe = ch === ' ' ? '&nbsp;' : ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="lyrics-word word-singing">${safe}</span>`;
  }).join('');
}

// 切歌/切行动画：歌词文本变化时挂载切换过渡 class（CSS .desktop-lyrics-switching）
let switchAnimTimer = null;
function triggerLineSwitchAnimation() {
  root.classList.remove('desktop-lyrics-switching');
  void root.offsetWidth; // 强制 reflow，确保动画重新触发
  root.classList.add('desktop-lyrics-switching');
  clearTimeout(switchAnimTimer);
  switchAnimTimer = setTimeout(() => {
    root.classList.remove('desktop-lyrics-switching');
  }, 650);
}

// update 监听抢跑渲染标记：切歌空窗时 update 先用纯 spans 兜底显示，
// karaoke 事件随后见到标记用完整 html（注音/进度）重建
let pendingKaraokeRebuild = false;
let pendingNextKaraokeRebuild = false;

// ── 双行模式「两句一组」状态机（基于 lineStart 唯一标识）──
// A 阶段（dualPhase=false）：main 唱第一句，next 预览第二句
// B 阶段（dualPhase=true）：main 保持已唱完的第一句，next 唱第二句
// 当第二句唱完、主窗口切到第三句时 → 新分组：main=第三句, next=第四句
let dualPhase = false;
let nextDisplayText = ''; // next 行当前显示的文本
let nextDisplayStart = -1; // next 行当前对应的 lineStart（唯一标识）
let groupMainStart = -1; // 当前分组第一句的 lineStart
let groupNextStart = -1; // 当前分组第二句的 lineStart
let lastNextPreviewText = ''; // update 事件最近收到的下一句预览文本
let lastNextPreviewStart = -1; // 上一帧 next 预览的 lineStart
let nextCachedSpans = [];

/**
 * 渲染 next 行（第二句演唱 / 预览共用）。
 * html 非空时用完整 html（注音/进度），否则按逐字/非逐字模式渲染纯文本。
 * isPreview=true 时字块设为 word-active（整行高亮），否则设为 word-singing（逐字填色）。
 */
function renderNextTextTo(textArg, htmlArg, translatedArg, wordByWord, isPreview = false) {
  nextDisplayText = textArg;
  if (wordByWord) {
    nextMain.innerHTML = (htmlArg && htmlArg.trim())
      ? htmlArg
      : buildWordSpans(textArg || '♪ KiomPlayer ♪');
    nextCachedSpans = Array.from(nextMain.querySelectorAll('.lyrics-word'));
    nextCachedSpans.forEach(span => {
      span._barSubSpans = null;
      span._lastBarFill = null;
      span._lastSingingState = null;
      if (isPreview) {
        span.classList.remove('word-active', 'word-singing');
      } else {
        span.classList.add('word-singing');
        span.classList.remove('word-active');
      }
    });
  } else {
    nextMain.textContent = textArg || '♪ KiomPlayer ♪';
    nextCachedSpans = [];
  }
  if (nextTranslation) nextTranslation.textContent = translatedArg;
  if (nextMain) resetScrollTarget(nextMain);
}

/**
 * karaoke 文本渲染（含双行两句一组状态机）。
 * 返回是否需要触发切行动画（调用方决定）。
 */
function renderKaraokeText(text, html, translated) {
  const isDouble = (lastStyleState.lineMode || root.getAttribute('data-line-mode')) === 'double';
  const wordByWord = lastStyleState.wordByWord !== false;

  const renderMainText = () => {
    currentText = text;
    if (wordByWord) {
      main.innerHTML = (html && html.trim()) ? html : buildWordSpans(text || '♪ KiomPlayer ♪');
      translation.textContent = translated;
      cachedSpans = Array.from(main.querySelectorAll('.lyrics-word'));
      cachedSpans.forEach(span => {
        span._barSubSpans = null;
        span._lastBarFill = null;
        span._lastSingingState = null;
        span.classList.add('word-singing');
        span.classList.remove('word-active');
      });
    } else {
      main.textContent = text || '♪ KiomPlayer ♪';
      translation.textContent = translated;
      cachedSpans = [];
    }
    if (main) resetScrollTarget(main);
  };

  if (isDouble && dualPhase) {
    if (text === nextDisplayText) {
      // 第二句演唱中：若 update 抢跑渲染了纯 spans，用 karaoke 完整 html（注音/进度）重建
      if (pendingKaraokeRebuild && html && html.trim()) {
        pendingKaraokeRebuild = false;
        renderNextTextTo(text, html, translated, wordByWord);
      }
      return false;
    }
    // 主窗口已切到下一组第一句 → 切组回 A 阶段
    dualPhase = false;
    nextDisplayText = '';
    renderMainText();
    return true;
  }

  // 常规路径（单行 / 双行第一句 / 切歌 / 跳行）
  const wasChanged = text !== currentText;
  renderMainText();
  pendingKaraokeRebuild = false; // 渲染已消费抢跑标记（非逐字路径同样清理）
  return wasChanged;
}

const countdownEl = document.getElementById('desktop-lyrics-countdown');
let lastKaraokeDone = false; // 当前行是否已唱完（karaoke charC >= totalChars）
let lastCountdownCount = -1;

function updateCountdown(lineEnd, currentTime, isInterlude = false) {
  if (!countdownEl) return;
  const lineMode = lastStyleState.lineMode || root.getAttribute('data-line-mode') || 'single';
  const remaining = (lineEnd && lineEnd > 0) ? (lineEnd - currentTime) : 0;
  const show = remaining > 0 && ((isInterlude && remaining <= 15) || (lastKaraokeDone && remaining <= 3.5));
  if (!show) {
    if (countdownEl.style.display !== 'none') countdownEl.style.display = 'none';
    lastCountdownCount = -1;
    return;
  }
  
  // 动态将倒计时 3-2-1 定位在“即将演唱”的歌词正上方
  const isDouble = lineMode === 'double';
  const upcomingContainer = (isDouble && dualPhase) ? nextContainer : mainContainer;
  const upcomingText = (isDouble && dualPhase) ? nextMain : main;
  const contentRoot = document.getElementById('desktop-lyrics-content');
  if (upcomingContainer && upcomingText && contentRoot) {
    const textRect = upcomingText.getBoundingClientRect();
    const containerRect = upcomingContainer.getBoundingClientRect();
    const rootRect = contentRoot.getBoundingClientRect();
    
    // 根据 align 对齐设置计算定位
    const align = lastStyleState.align || root.getAttribute('data-align') || 'left';
    const dotsWidth = 52;
    if (align === 'center') {
      const textCenterX = textRect.left + textRect.width / 2 - rootRect.left;
      countdownEl.style.left = `${Math.max(0, textCenterX - dotsWidth / 2)}px`;
    } else if (align === 'right') {
      const textRightX = textRect.right - rootRect.left;
      countdownEl.style.left = `${Math.max(0, textRightX - dotsWidth)}px`;
    } else {
      const textLeftX = textRect.left - rootRect.left;
      countdownEl.style.left = `${Math.max(0, textLeftX)}px`;
    }
    const topPos = containerRect.top - rootRect.top - 24;
    countdownEl.style.top = `${Math.max(0, topPos)}px`;
  }
  const count = Math.max(1, Math.min(3, Math.ceil(remaining)));
  if (count !== lastCountdownCount) {
    lastCountdownCount = count;
    countdownEl.setAttribute('data-count', String(count));
  }
  countdownEl.style.display = 'flex';
}

function updateKaraokeSpans(charC, totalChars, spans = cachedSpans) {
  if (spans.length === 0) {
    spans = Array.from(main.querySelectorAll('.lyrics-word'));
  }
  if (spans.length === 0) return;

  for (let index = 0; index < spans.length; index += 1) {
    const barSpan = spans[index];
    if (!barSpan) continue;

    let fill;
    if (charC < 0) {
      fill = 0;
    } else if (charC >= totalChars) {
      fill = 100;
    } else {
      const intPart = Math.floor(charC);
      if (index < intPart) fill = 100;
      else if (index > intPart) fill = 0;
      else fill = (charC - intPart) * 100;
    }

    const clamped = Math.max(0, Math.min(100, fill));
    const charFillVal = `${clamped.toFixed(1)}%`;

    // ⭐ 值守卫：fill 恒定则跳过 DOM 写入与子节点遍历（对齐 mini 歌词高效引擎）
    if (barSpan._lastBarFill !== charFillVal) {
      barSpan._lastBarFill = charFillVal;
      barSpan.style.setProperty('--char-fill', charFillVal);

      let subSpans = barSpan._barSubSpans;
      if (!subSpans) {
        subSpans = Array.from(barSpan.querySelectorAll('span'));
        barSpan._barSubSpans = subSpans;
      }
      for (let subIndex = 0; subIndex < subSpans.length; subIndex += 1) {
        subSpans[subIndex].style.setProperty('--char-fill', charFillVal);
      }
    }

    // ⭐ classList 状态守卫：仅在状态变化时才操作 DOM，长行场景从 O(n) 次/帧 降至 ~2 次/帧
    const needsSinging = clamped > 1;
    if (barSpan._lastSingingState !== needsSinging) {
      barSpan._lastSingingState = needsSinging;
      if (needsSinging) {
        barSpan.classList.add('word-singing');
        barSpan.classList.remove('word-active');
      } else {
        barSpan.classList.remove('word-singing', 'word-active');
      }
    }
  }
}

// 自动滚动功能已取消
function updateTargetProgress(el, container, ratio = 0, textKey) {
  // 空函数：不再进行计算与 transform
}

function resetScrollTarget(el) {
  if (!el) return;
  if (el._lastTransform !== '') {
    el._lastTransform = '';
    el.style.transform = '';
    el._currentOffset = 0;
  }
}

// 逐帧卡拉 OK 进度同步（与迷你歌词完全同源引擎）
listen('desktop-lyrics-karaoke', (event) => {
  const { html = '', charC = 0, totalChars = 0, text = '', translation: translated = '', style, isPlaying } = event.payload || {};
  if (style) applyStyle(style);
  if (typeof isPlaying === 'boolean') updatePlayIcon(isPlaying);

  if (nextMain) resetScrollTarget(nextMain);
  if (nextTranslation) resetScrollTarget(nextTranslation);

  const wordByWordEnabled = lastStyleState.wordByWord !== false;

  const ratio = totalChars > 0 ? Math.max(0, Math.min(1, charC / totalChars)) : 0;

  // 记录行完成状态（供 update 监听的前奏倒计时判断）
  lastKaraokeDone = totalChars > 0 && charC >= totalChars;

  if (!wordByWordEnabled) {
    // 双行模式两句一组状态机渲染（非逐字）
    const anim = renderKaraokeText(text, html, translated);
    if (anim) triggerLineSwitchAnimation();
    // 进度应用目标：B 阶段应用到 next 行
    const isDouble = (lastStyleState.lineMode || root.getAttribute('data-line-mode')) === 'double';
    const target = (isDouble && dualPhase) ? nextMain : main;
    const targetTrans = (isDouble && dualPhase) ? nextTranslation : translation;
    if (target && mainContainer) updateTargetProgress(target, mainContainer, ratio, text);
    if (targetTrans && mainContainer) updateTargetProgress(targetTrans, mainContainer, ratio, translated);
    return;
  }

  // 检查是否切换了新的歌词文本（karaoke 渲染条件：文本变 / 有抢跑标记 / 尚无 spans）
  if (text !== currentText || pendingKaraokeRebuild || !main.querySelector('.lyrics-word')) {
    const isTextChange = text !== currentText;
    const anim = renderKaraokeText(text, html, translated);
    // B 阶段（第二句演唱中）main 不变：text 与 currentText 恒不等，不得触发切行动画
    const isDoubleNow = (lastStyleState.lineMode || root.getAttribute('data-line-mode')) === 'double';
    if (anim || (isTextChange && !(isDoubleNow && dualPhase))) triggerLineSwitchAnimation();
    pendingKaraokeRebuild = false;
  }

  // 内容已更新，此时测量 overflow 才准确
  // B 阶段（双行第二句演唱中）：进度应用到 next 行，main 保持已唱完状态
  const isDouble = (lastStyleState.lineMode || root.getAttribute('data-line-mode')) === 'double';
  const progressMain = (isDouble && dualPhase) ? nextMain : main;
  const progressTrans = (isDouble && dualPhase) ? nextTranslation : translation;
  if (progressMain && mainContainer) updateTargetProgress(progressMain, mainContainer, ratio, text);
  if (progressTrans && mainContainer) updateTargetProgress(progressTrans, mainContainer, ratio, translated);

  // 应用逐字卡拉 OK 扫字填色（B 阶段作用在 next 行的字块上）
  updateKaraokeSpans(charC, totalChars, (isDouble && dualPhase) ? nextCachedSpans : cachedSpans);
});

// 基础同步事件
listen('desktop-lyrics-update', (event) => {
  let { text = '', translation: translated = '', nextText = '', nextTranslation: nextTrans = '', currentTime = 0, lineStart = 0, lineEnd = 0, isInterlude = false, style, isPlaying } = event.payload || {};
  if (style) applyStyle(style);
  if (typeof isPlaying === 'boolean') updatePlayIcon(isPlaying);

  // 防守拦截：当纯间奏点 '...' 作为歌词进来时，提升其为下一句真正要唱的歌词
  if ((text === '...' || text.trim() === '...') && nextText && nextText !== '...') {
    text = nextText;
    translated = nextTrans;
    isInterlude = true;
  }

  // 无歌词（切歌到无歌词音乐）：重置双行「两句一组」状态机并清空所有内容，
  // 必须在 A→B 判定之前 early return，否则空 text 会与空 prevNextPreview 匹配
  // 误入 B 阶段，导致 main 跳过重建而残留上一曲歌词
  if (!text) {
    dualPhase = false;
    nextDisplayText = '';
    lastNextPreviewText = '';
    lastKaraokeDone = false;
    currentText = '';
    if (nextMain) nextMain.textContent = '';
    if (nextTranslation) nextTranslation.textContent = '';
    triggerLineSwitchAnimation();
    main.innerHTML = buildWordSpans('♪ KiomPlayer ♪');
    translation.textContent = '';
    cachedSpans = Array.from(main.querySelectorAll('.lyrics-word'));
    if (main) resetScrollTarget(main);
    if (translation) resetScrollTarget(translation);
    return;
  }

  const duration = (lineEnd && lineStart && lineEnd > lineStart) ? (lineEnd - lineStart) : 0;
  const ratio = duration > 0 ? Math.max(0, Math.min(1, (currentTime - lineStart) / duration)) : 0;

  // ── 双行「两句一组」A→B 判定（update 先于 karaoke 到达，IPC 保序）──
  // 条件：双行模式 + 第一句阶段 + 上一帧已唱完 + 主窗口切到的行 == 上一帧的 next 预览文本
  const isDoubleMode = (lastStyleState.lineMode || root.getAttribute('data-line-mode')) === 'double';
  const prevNextPreview = lastNextPreviewText;
  // 记录下一句预览文本（供 A→B 判定：主窗口切到的行确实是窗口预测的下一句）
  lastNextPreviewText = nextText || '';
  if (
    isDoubleMode && !dualPhase
    && text !== currentText
    && text === prevNextPreview
  ) {
    // 第一句唱完、主窗口切到第二句 → 进入 B 阶段：第二句渲染到 next 行继续演唱
    dualPhase = true;
    const wordByWordNow = lastStyleState.wordByWord !== false;
    renderNextTextTo(text, '', translated, wordByWordNow);
    pendingKaraokeRebuild = true; // karaoke 随后用完整 html（注音/进度）重建 next
  }

  // B 阶段：next 行显示的是正在演唱的第二句，不覆盖为预览文本
  if (!dualPhase) {
    if (nextMain) {
      const wordByWordNow = lastStyleState.wordByWord !== false;
      if (wordByWordNow && nextText && nextText !== nextDisplayText) {
        // 逐字模式：next 预览也用 spans 构建，设为 word-active（整行高亮）
        // 这样样式与 main 行一致，避免纯文本走 :not(:has(.lyrics-word)) 渐变样式
        nextDisplayText = nextText;
        nextMain.innerHTML = buildWordSpans(nextText);
        nextCachedSpans = Array.from(nextMain.querySelectorAll('.lyrics-word'));
        nextCachedSpans.forEach(span => {
          span._barSubSpans = null;
          span._lastBarFill = null;
          span._lastSingingState = null;
          span.classList.remove('word-active', 'word-singing');
        });
        if (nextMain) resetScrollTarget(nextMain);
      } else if (!wordByWordNow && nextText !== nextDisplayText) {
        nextDisplayText = nextText;
        nextMain.textContent = nextText || '';
        nextCachedSpans = [];
      } else if (!nextText) {
        if (nextDisplayText !== '') {
          nextDisplayText = '';
          nextMain.textContent = '';
          nextCachedSpans = [];
        }
      }
    }
    if (nextTranslation) nextTranslation.textContent = (lastStyleState.showTranslation !== false && nextTrans) ? nextTrans : '';
  }

  // 前奏/间奏倒计时：当前行处于间奏或已唱完且距下一行开始 ≤3.5s 时，
  // 在即将演唱的歌词上方显示三个大点，随剩余秒数逐个消失（3-2-1）
  updateCountdown(lineEnd, currentTime, isInterlude);

  // 逐字模式：进度渲染由 karaoke 监听负责；这里兜底处理"切歌空窗"
  // （新歌未播放时 karaoke 事件不触发，若不渲染桌面歌词会停留在旧歌）。
  // 无条件重建纯 spans 并置抢跑标记：karaoke 随后用完整 html（注音/进度）重建；
  // 若 karaoke 迟迟不来（未播放），至少内容已是新歌
  if (lastStyleState.wordByWord !== false) {
    // B 阶段（双行第二句演唱中）：main 保持已唱完的第一句，不兜底重建（karaoke 每帧在渲染）
    if (text !== currentText && !dualPhase) {
      currentText = text;
      triggerLineSwitchAnimation();
      main.innerHTML = buildWordSpans(text || '♪ KiomPlayer ♪');
      translation.textContent = translated;
      cachedSpans = Array.from(main.querySelectorAll('.lyrics-word'));
      pendingKaraokeRebuild = true;
    }
    // B 阶段 main 已唱完，进度由 karaoke 应用到 next 行，此处不再更新 main
    if (main && mainContainer && !dualPhase) updateTargetProgress(main, mainContainer, ratio, text);
    if (translation && mainContainer && !dualPhase) updateTargetProgress(translation, mainContainer, ratio, translated);
    return;
  }

  if (text !== currentText && !dualPhase) {
    currentText = text;
    triggerLineSwitchAnimation();
    main.textContent = text || '♪ KiomPlayer ♪';
    translation.textContent = translated;
    cachedSpans = [];
  }

  // B 阶段 main 已唱完，进度由 karaoke 应用到 next 行，此处不再更新 main
  if (main && mainContainer && !dualPhase) updateTargetProgress(main, mainContainer, ratio, text);
  if (translation && mainContainer && !dualPhase) updateTargetProgress(translation, mainContainer, ratio, translated);
});

// 监听样式变动
listen('desktop-lyrics-style', (event) => applyStyle(event.payload));

// 监听播放状态更新
function updatePlayIcon(isPlaying) {
  if (iconPlay && iconPause) {
    iconPlay.style.display = isPlaying ? 'none' : 'inline-block';
    iconPause.style.display = isPlaying ? 'inline-block' : 'none';
  }
}

listen('desktop-lyrics-playback-state', (event) => {
  const { isPlaying } = event.payload || {};
  updatePlayIcon(!!isPlaying);
});

// 拖拽手柄安全代理：使用 Tauri 内置窗口拖动 API
const dragHandle = document.querySelector('.toolbar-drag-handle');
if (dragHandle) {
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  });
}

// 歌词区域任意位置拖动均可调整窗口位置（排除工具栏按钮，避免误拖）。
// 4px 移动阈值：纯点击/双击（关闭歌词）不触发拖动
let dragAnchorX = null;
let dragAnchorY = 0;
root.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.desktop-lyrics-toolbar')) return;
  dragAnchorX = e.clientX;
  dragAnchorY = e.clientY;
});
document.addEventListener('mousemove', (e) => {
  if (dragAnchorX === null) return;
  if (Math.hypot(e.clientX - dragAnchorX, e.clientY - dragAnchorY) > 4) {
    dragAnchorX = null;
    getCurrentWindow().startDragging().catch(() => {});
  }
});
document.addEventListener('mouseup', () => {
  dragAnchorX = null;
});

// 焦点轮廓：获得焦点显示半透明窗口轮廓（便于调整大小），失焦恢复透明仅剩歌词
getCurrentWindow().onFocusChanged(({ payload: focused }) => {
  root.setAttribute('data-focused', focused ? 'true' : 'false');
}).catch(() => {});

// 双击歌词空白区收起桌面歌词
root.addEventListener('dblclick', (e) => {
  if (e.target.closest('.desktop-lyrics-toolbar')) return;
  sendAction('close');
});

// 初始化就绪后，主动向主程序请求一次最新的全局样式与播放状态，防止初次打开时时序冲突导致样式丢失
emit('desktop-lyrics-request-style').catch(() => {});

// 监听鼠标滚轮事件无级调节桌面歌词字号
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  // 向上滚动调大，向下滚动调小 (deltaY < 0 时为上滚，加 1px；deltaY > 0 为下滚，减 1px)
  const diff = e.deltaY < 0 ? 1 : -1;
  const newSize = Math.max(12, Math.min(56, currentFontSize + diff));

  if (newSize !== currentFontSize) {
    // 立即在前端本地应用并渲染（免去等待 IPC 往返的延迟感，让滚轮缩放极致丝滑）
    currentFontSize = newSize;
    root.style.setProperty('--desktop-lyrics-size', `${newSize}px`);
    // 向上同步通知主程序更新 LocalStorage 与 UI 滑块状态
    sendAction('set-font-size', { size: newSize });
  }
}, { passive: false });

