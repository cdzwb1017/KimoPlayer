import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const root = document.getElementById('desktop-lyrics');
const main = document.getElementById('desktop-lyrics-main');
const translation = document.getElementById('desktop-lyrics-translation');

const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

let currentFontSize = 34;

const applyStyle = (style = {}) => {
  if (Number.isFinite(style.fontSize)) {
    currentFontSize = style.fontSize;
    root.style.setProperty('--desktop-lyrics-size', `${style.fontSize}px`);
  }
  if (Number.isFinite(style.opacity)) {
    root.style.setProperty('--desktop-lyrics-opacity', String(style.opacity));
  }
  if (style.theme) {
    root.setAttribute('data-theme', style.theme);
  }
  if (style.dynamicColor) {
    root.style.setProperty('--dynamic-color', style.dynamicColor);
  }
  const appTheme = style.appTheme || localStorage.getItem('kimo-theme') || 'light';
  root.setAttribute('data-app-theme', appTheme);
  if (style.align) {
    root.setAttribute('data-align', style.align);
  }
  translation.style.display = style.showTranslation === false ? 'none' : '';
  if (typeof style.locked === 'boolean') {
    root.classList.toggle('is-locked', style.locked);
    getCurrentWindow().setIgnoreCursorEvents(style.locked).catch(() => {});
  }
  if (typeof style.glow === 'boolean') {
    root.setAttribute('data-glow', style.glow ? 'true' : 'false');
  }
  if (typeof style.stroke === 'boolean') {
    root.setAttribute('data-stroke', style.stroke ? 'true' : 'false');
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

function updateKaraokeSpans(charC, totalChars) {
  if (cachedSpans.length === 0) {
    cachedSpans = Array.from(main.querySelectorAll('.lyrics-word'));
  }
  if (cachedSpans.length === 0) return;

  for (let index = 0; index < cachedSpans.length; index += 1) {
    const barSpan = cachedSpans[index];
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
    barSpan.style.setProperty('--char-fill', charFillVal);

    if (clamped >= 99) {
      barSpan.classList.add('word-singing');
      barSpan.classList.remove('word-active');
    } else if (clamped <= 1) {
      if (barSpan.classList.contains('word-active') || barSpan.classList.contains('word-singing')) {
        barSpan.classList.remove('word-active', 'word-singing');
      }
    } else if (!barSpan.classList.contains('word-singing')) {
      barSpan.classList.add('word-singing');
      barSpan.classList.remove('word-active');
    }

    let subSpans = barSpan._barSubSpans;
    if (!subSpans) {
      subSpans = Array.from(barSpan.querySelectorAll('span'));
      barSpan._barSubSpans = subSpans;
    }
    for (let subIndex = 0; subIndex < subSpans.length; subIndex += 1) {
      subSpans[subIndex].style.setProperty('--char-fill', charFillVal);
    }
  }
}

// 逐帧卡拉 OK 进度同步（与迷你歌词完全同源引擎）
listen('desktop-lyrics-karaoke', (event) => {
  const { html = '', charC = 0, totalChars = 0, text = '', translation: translated = '', style, isPlaying } = event.payload || {};
  if (style) applyStyle(style);
  if (typeof isPlaying === 'boolean') updatePlayIcon(isPlaying);

  const wordByWordEnabled = style?.wordByWord !== false;

  if (!wordByWordEnabled) {
    main.textContent = text || '♪ KiomPlayer ♪';
    translation.textContent = translated;
    return;
  }

  // 检查是否切换了新的歌词文本
  if (text !== currentText || !main.querySelector('.lyrics-word')) {
    currentText = text;
    if (html && html.trim()) {
      main.innerHTML = html;
    } else {
      main.textContent = text || '♪ KiomPlayer ♪';
    }
    translation.textContent = translated;
    cachedSpans = Array.from(main.querySelectorAll('.lyrics-word'));
    
    // 同步初始化状态，切行时所有字块默认加上 word-singing 类
    cachedSpans.forEach(span => {
      span._barSubSpans = null;
      span.classList.add('word-singing');
      span.classList.remove('word-active');
    });
  }

  // 应用逐字卡拉 OK 扫字填色
  updateKaraokeSpans(charC, totalChars);
});

// 基础同步事件
listen('desktop-lyrics-update', (event) => {
  const { text = '', translation: translated = '', style, isPlaying } = event.payload || {};
  if (style) applyStyle(style);
  if (typeof isPlaying === 'boolean') updatePlayIcon(isPlaying);

  const wordByWordEnabled = style?.wordByWord !== false;
  if (!wordByWordEnabled) {
    main.textContent = text || '♪ KiomPlayer ♪';
    translation.textContent = translated;
    return;
  }

  if (text !== currentText) {
    currentText = text;
    main.textContent = text || '♪ KiomPlayer ♪';
    translation.textContent = translated;
    cachedSpans = [];
  }
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

