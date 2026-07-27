import { invoke } from '@tauri-apps/api/core';
import { hideCommentsPanel } from '../features/comments-panel.js';

export function initializeImmersiveMode() {
  let isImmersiveMode = false;
  let sleepPrevented = false;

  const immersiveBtn = document.getElementById('immersive-mode-btn');
  const lyricsImmersiveBtn = document.getElementById('lyrics-immersive-btn');
  const appContainer = document.querySelector('.app-container');

  const toggleImmersive = async () => {
    try {
      isImmersiveMode = !isImmersiveMode;

      if (isImmersiveMode) {
        hideCommentsPanel();
        await invoke('set_fullscreen', { fullscreen: true });
        await invoke('set_prevent_sleep', { prevent: true });
        sleepPrevented = true;
        if (immersiveBtn) {
          immersiveBtn.style.color = 'var(--accent-color)';
          immersiveBtn.title = '退出沉浸全屏模式';
        }
        if (lyricsImmersiveBtn) {
          lyricsImmersiveBtn.style.color = 'var(--accent-color)';
          lyricsImmersiveBtn.title = '退出沉浸全屏模式';
        }
        appContainer?.classList.add('immersive-mode');
        // 根据设置决定是否隐藏标题栏
        const hideTitlebar = localStorage.getItem('kimo-immersive-hide-titlebar') !== 'false';
        appContainer?.classList.toggle('immersive-hide-titlebar', hideTitlebar);
        console.log('[Immersive] Entered immersive fullscreen mode');
      } else {
        // 退出时先播放淡出动画
        appContainer?.classList.add('immersive-exiting');
        await new Promise(r => setTimeout(r, 50));
        await invoke('set_fullscreen', { fullscreen: false });
        await invoke('set_prevent_sleep', { prevent: false });
        sleepPrevented = false;
        if (immersiveBtn) {
          immersiveBtn.style.color = '';
          immersiveBtn.title = '沉浸全屏模式';
        }
        if (lyricsImmersiveBtn) {
          lyricsImmersiveBtn.style.color = '';
          lyricsImmersiveBtn.title = '沉浸全屏模式';
        }
        setTimeout(() => {
          appContainer?.classList.remove('immersive-mode');
          appContainer?.classList.remove('immersive-hide-titlebar');
          appContainer?.classList.remove('immersive-exiting');
        }, 350);
        console.log('[Immersive] Exited immersive fullscreen mode');
      }
    } catch (err) {
      console.error('[Immersive] Toggle failed:', err);
      isImmersiveMode = !isImmersiveMode;
    }
  };

  if (immersiveBtn) {
    immersiveBtn.addEventListener('click', toggleImmersive);
  }
  if (lyricsImmersiveBtn) {
    lyricsImmersiveBtn.addEventListener('click', toggleImmersive);
  }

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && isImmersiveMode) {
      toggleImmersive();
    }
  });

  return {
    isSleepPrevented: () => sleepPrevented,
  };
}
