import { invoke } from '@tauri-apps/api/core';

export function initializeWindowControls() {
  const bindWindowControls = () => {
    const minimizeBtn = document.getElementById('titlebar-minimize');
    const maximizeBtn = document.getElementById('titlebar-maximize');
    const closeBtn = document.getElementById('titlebar-close');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        invoke('minimize_window').catch((error) => {
          console.error('[Window] Minimize failed:', error);
        });
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        invoke('toggle_maximize_window').catch((error) => {
          console.error('[Window] Maximize failed:', error);
        });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        invoke('close_window').catch((error) => {
          console.error('[Window] Close failed:', error);
        });
      });
    }
  };

  try {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      bindWindowControls();
    } else {
      document.addEventListener('DOMContentLoaded', bindWindowControls, { once: true });
    }
  } catch (error) {
    console.error('[Window] Failed to register early window controls:', error);
  }
}
