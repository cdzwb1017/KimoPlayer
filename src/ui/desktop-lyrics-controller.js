import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { hideCommentsPanel } from '../features/comments-panel.js';

const THEME_PRESETS = ['follow-app', 'aurora', 'cyber', 'sunset', 'ocean', 'white'];

const getStyle = () => {
  const dynamicColor = document.documentElement.style.getPropertyValue('--dynamic-color-a') || '0, 180, 216';
  return {
    fontSize: Number(localStorage.getItem('kimo-desktop-lyrics-font-size') || 34),
    opacity: Number(localStorage.getItem('kimo-desktop-lyrics-opacity') || 0.96),
    showTranslation: localStorage.getItem('kimo-desktop-lyrics-show-translation') !== 'false',
    locked: localStorage.getItem('kimo-desktop-lyrics-locked') === 'true',
    wordByWord: localStorage.getItem('kimo-desktop-lyrics-word-by-word') !== 'false',
    glow: localStorage.getItem('kimo-desktop-lyrics-glow') !== 'false',
    stroke: localStorage.getItem('kimo-desktop-lyrics-stroke') !== 'false',
    theme: localStorage.getItem('kimo-desktop-lyrics-theme') || 'follow-app',
    appTheme: localStorage.getItem('kimo-theme') || 'light',
    align: localStorage.getItem('kimo-desktop-lyrics-align') || 'center',
    dynamicColor: dynamicColor.trim(),
  };
};

export function createDesktopLyricsController({ showToast, player }) {
  let currentKey = '';
  let latestLine = null;
  let activePlayer = player || null;

  const setPlayer = (p) => {
    activePlayer = p;
  };

  const updateStyle = async () => {
    await emit('desktop-lyrics-style', getStyle()).catch(() => {});
  };

    const setVisible = async (visible, { silent = false } = {}) => {
    localStorage.setItem('kimo-desktop-lyrics-enabled', visible ? 'true' : 'false');
    emit('desktop-lyrics-visibility-changed', { visible }).catch(() => {});
    try {
      await invoke('set_desktop_lyrics_visible', { visible });
      if (visible) {
        hideCommentsPanel();
        currentKey = '';
        await updateStyle();
        setTimeout(() => {
          if (latestLine) sync(latestLine);
        }, 240);
      }
      if (!silent) showToast(`桌面歌词已${visible ? '开启' : '关闭'}`);
    } catch (error) {
      console.error('[DesktopLyrics] Failed to change visibility:', error);
      if (!silent) showToast('桌面歌词操作失败');
    }
  };

  const sync = ({ text, translation, words, currentTime, lineStart, lineEnd }) => {
    latestLine = { text, translation, words, currentTime, lineStart, lineEnd };
    if (localStorage.getItem('kimo-desktop-lyrics-enabled') !== 'true') return;
    const isPlaying = activePlayer ? !activePlayer.audio?.paused : false;
    emit('desktop-lyrics-update', {
      text,
      translation,
      words,
      currentTime,
      lineStart,
      lineEnd,
      style: getStyle(),
      isPlaying,
    }).catch(() => {});
  };

  const syncKaraokeProgress = ({ html, charC, totalChars, text, translation }) => {
    if (localStorage.getItem('kimo-desktop-lyrics-enabled') !== 'true') return;
    const isPlaying = activePlayer ? !activePlayer.audio?.paused : false;
    emit('desktop-lyrics-karaoke', {
      html,
      charC,
      totalChars,
      text,
      translation,
      style: getStyle(),
      isPlaying,
    }).catch(() => {});
  };

  const notifyPlaybackState = (isPlaying) => {
    emit('desktop-lyrics-playback-state', { isPlaying }).catch(() => {});
  };

  // 监听桌面窗口刚启动时的主动样式与状态拉取请求
  listen('desktop-lyrics-request-style', () => {
    updateStyle();
    if (latestLine) {
      sync(latestLine);
    } else {
      const isPlaying = activePlayer ? !activePlayer.audio?.paused : false;
      emit('desktop-lyrics-update', {
        text: 'KiomPlayer',
        style: getStyle(),
        isPlaying,
      }).catch(() => {});
    }
  });

  // 监听桌面歌词发送的交互控制指令
  listen('desktop-lyrics-action', (event) => {
    const { action } = event.payload || {};
    if (!action) return;

    switch (action) {
      case 'prev':
        if (activePlayer) activePlayer.prev?.();
        break;
      case 'toggle-play':
        if (activePlayer) activePlayer.toggle?.();
        break;
      case 'next':
        if (activePlayer) activePlayer.next?.();
        break;
      case 'cycle-theme': {
        const currentTheme = getStyle().theme;
        const currIndex = THEME_PRESETS.indexOf(currentTheme);
        const nextTheme = THEME_PRESETS[(currIndex + 1) % THEME_PRESETS.length];
        localStorage.setItem('kimo-desktop-lyrics-theme', nextTheme);
        updateStyle();
        showToast(`歌词主题: ${nextTheme}`);
        break;
      }
      case 'size-down': {
        const currSize = getStyle().fontSize;
        const newSize = Math.max(12, currSize - 2);
        localStorage.setItem('kimo-desktop-lyrics-font-size', String(newSize));
        // 同步更新主程序可能正开启着的设置滑块 UI
        const sizeSlider = document.getElementById('settings-desktop-lyrics-size');
        const sizeVal = document.getElementById('desktop-lyrics-size-val');
        if (sizeSlider) sizeSlider.value = newSize;
        if (sizeVal) sizeVal.textContent = `${newSize}px`;
        updateStyle();
        break;
      }
      case 'size-up': {
        const currSize = getStyle().fontSize;
        const newSize = Math.min(56, currSize + 2);
        localStorage.setItem('kimo-desktop-lyrics-font-size', String(newSize));
        // 同步更新主程序可能正开启着的设置滑块 UI
        const sizeSlider = document.getElementById('settings-desktop-lyrics-size');
        const sizeVal = document.getElementById('desktop-lyrics-size-val');
        if (sizeSlider) sizeSlider.value = newSize;
        if (sizeVal) sizeVal.textContent = `${newSize}px`;
        updateStyle();
        break;
      }
      case 'set-font-size': {
        const { size } = event.payload || {};
        if (typeof size === 'number') {
          const newSize = Math.max(12, Math.min(56, size));
          localStorage.setItem('kimo-desktop-lyrics-font-size', String(newSize));
          // 精准同步主程序可能正开启着的设置滑块与数值数值
          const sizeSlider = document.getElementById('settings-desktop-lyrics-size');
          const sizeVal = document.getElementById('desktop-lyrics-size-val');
          if (sizeSlider) sizeSlider.value = newSize;
          if (sizeVal) sizeVal.textContent = `${newSize}px`;
          updateStyle();
        }
        break;
      }
      case 'toggle-lock': {
        const locked = !getStyle().locked;
        localStorage.setItem('kimo-desktop-lyrics-locked', locked ? 'true' : 'false');
        updateStyle();
        showToast(`桌面歌词已${locked ? '锁定(穿透)' : '解锁'}`);
        break;
      }
      case 'close':
        setVisible(false);
        break;
    }
  });

  return { getStyle, setVisible, sync, syncKaraokeProgress, updateStyle, setPlayer, notifyPlaybackState };
}

