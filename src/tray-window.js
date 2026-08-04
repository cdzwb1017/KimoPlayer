import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const win = getCurrentWebviewWindow();
// 获取元素
const coverEl = document.getElementById('tray-cover');
const titleEl = document.getElementById('tray-title');
const artistEl = document.getElementById('tray-artist');

const btnPrev = document.getElementById('btn-prev');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNext = document.getElementById('btn-next');
const btnPlayMode = document.getElementById('btn-play-mode');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

const svgs = {
  'list-loop': '<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  'single-loop': '<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-weight="bold">1</text></svg>',
  'shuffle': '<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  'lyrics-text': '<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold" fill="currentColor" style="font-family: var(--font-family, sans-serif);">词</text></svg>',
  'lyrics-locked': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>',
  'lyrics-unlocked': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>'
};
const labels = { 'list-loop': '列表循环', 'single-loop': '单曲循环', 'shuffle': '随机播放' };

function updateUI(state) {
  const dynamicColor = localStorage.getItem('kimo-last-dynamic-color');
  if (dynamicColor) {
    document.documentElement.style.setProperty('--accent', `rgb(${dynamicColor})`);
  } else {
    document.documentElement.style.setProperty('--accent', '#10b981');
  }

  const btnLyrics = document.getElementById('btn-lyrics');
  if (btnLyrics) {
    const lyricsEnabled = localStorage.getItem('kimo-desktop-lyrics-enabled') === 'true';
    const lyricsLocked = localStorage.getItem('kimo-desktop-lyrics-locked') === 'true';
    if (!lyricsEnabled) {
      btnLyrics.innerHTML = svgs['lyrics-text'];
      btnLyrics.title = '打开桌面歌词';
    } else if (lyricsLocked) {
      btnLyrics.innerHTML = svgs['lyrics-locked'];
      btnLyrics.title = '解锁桌面歌词';
    } else {
      btnLyrics.innerHTML = svgs['lyrics-unlocked'];
      btnLyrics.title = '锁定桌面歌词 (穿透)';
    }
  }

  if (!state) {
    titleEl.textContent = 'KimoPlayer';
    artistEl.textContent = '暂无播放记录';
    coverEl.src = '/audio-icons/mp3.png';
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    return;
  }
  
  titleEl.textContent = state.title || '未知标题';
  artistEl.textContent = state.artist || '未知歌手';
  if (state.coverSrc) {
    coverEl.src = state.coverSrc;
  } else {
    coverEl.src = '/audio-icons/mp3.png';
  }
  
  if (state.isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }

  if (state.playMode && btnPlayMode) {
    btnPlayMode.innerHTML = svgs[state.playMode];
    btnPlayMode.title = '播放模式: ' + labels[state.playMode];
  }
}

// 初始化状态
function loadInitialState() {
  try {
    const stateStr = localStorage.getItem('kimo-tray-state');
    if (stateStr) {
      updateUI(JSON.parse(stateStr));
    }
  } catch (err) {
    console.error('Failed to parse tray state', err);
  }
}

// 监听状态改变
window.addEventListener('storage', (e) => {
  if (e.key === 'kimo-tray-state') {
    try {
      updateUI(JSON.parse(e.newValue));
    } catch (err) {}
  } else if (e.key === 'kimo-desktop-lyrics-enabled' || e.key === 'kimo-desktop-lyrics-locked' || e.key === 'kimo-last-dynamic-color') {
    try {
      const stateStr = localStorage.getItem('kimo-tray-state');
      updateUI(stateStr ? JSON.parse(stateStr) : null);
    } catch (err) {}
  }
});

// 绑定按钮事件
if (btnPlayMode) {
  btnPlayMode.addEventListener('click', () => {
    emit('tray-toggle-play-mode').catch(() => {});
  });
}

btnPrev.addEventListener('click', () => {
  emit('tray-prev').catch(() => {});
});

btnPlayPause.addEventListener('click', () => {
  emit('tray-play').catch(() => {});
});

btnNext.addEventListener('click', () => {
  emit('tray-next').catch(() => {});
});

const showMainWindow = async () => {
  emit('tray-show-main').catch(() => {});
};

document.getElementById('cover-wrapper').addEventListener('click', showMainWindow);
document.querySelector('.info-wrapper').addEventListener('click', showMainWindow);

document.getElementById('btn-lyrics').addEventListener('click', () => {
  const enabled = localStorage.getItem('kimo-desktop-lyrics-enabled') === 'true';
  if (!enabled) {
    emit('tray-toggle-desktop-lyrics').catch(() => {});
  } else {
    emit('tray-toggle-desktop-lyrics-lock').catch(() => {});
  }
});

document.getElementById('btn-show-main').addEventListener('click', () => {
  showMainWindow();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  emit('tray-open-settings').catch(() => {});
  showMainWindow();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  const { exit } = window.__TAURI__?.process || { exit: () => {} };
  // or use emit
  emit('tray-quit').catch(() => {});
});

// 初始化
loadInitialState();
