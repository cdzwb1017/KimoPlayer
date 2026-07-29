/**
 * Detect the effective lyrics theme (light/dark), accounting for 'follow' mode.
 * - If lyrics panel has explicit theme class, use that.
 * - If 'follow' mode (no explicit class), inherit from app theme.
 *   (Grey mode also carries theme-light, so it maps to light.)
 */
export function getEffectiveLyricsTheme() {
  const lyricsPanel = document.querySelector('.lyrics-panel');
  if (!lyricsPanel) return 'dark';
  if (lyricsPanel.classList.contains('lyrics-theme-light')) return 'light';
  if (lyricsPanel.classList.contains('lyrics-theme-dark')) return 'dark';

  // Follow mode — check app theme (theme-light covers both light & grey)
  const container = document.querySelector('.app-container');
  if (container?.classList.contains('theme-light')) return 'light';
  return 'dark';
}

export function initializeLyricsSettingsToolbar() {
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

  // 弹出框移到 body 下，避免被歌词面板 overflow: hidden 裁剪
  document.querySelectorAll('.lyrics-control-item').forEach(item => {
    const popover = item.querySelector('.slider-popover');
    if (!popover) return;

    item.addEventListener('mouseenter', () => {
      const rect = item.getBoundingClientRect();
      popover.classList.add('moved-to-body');
      popover.setAttribute('data-lyrics-theme', getEffectiveLyricsTheme());
      popover.style.left = `${rect.left + rect.width / 2}px`;
      popover.style.top = `${rect.bottom + 8}px`;
      popover.style.transform = 'translateX(-50%) scale(0.92)';
      popover.style.opacity = '0';
      document.body.appendChild(popover);

      // Trigger entrance transition on next frame
      requestAnimationFrame(() => {
        popover.style.transform = 'translateX(-50%) scale(1)';
        popover.style.opacity = '1';
      });
    });

    item.addEventListener('mouseleave', () => {
      popover.classList.remove('moved-to-body');
      popover.removeAttribute('data-lyrics-theme');
      popover.style.left = '';
      popover.style.top = '';
      popover.style.transform = '';
      popover.style.opacity = '';
      item.appendChild(popover);
    });
  });
}

export function applyMiniLyricsTranslationSetting() {
  const container = document.querySelector('.player-center-lyrics');
  if (!container) return;
  const show = localStorage.getItem('kimo-mini-lyrics-show-translation') === 'true';
  container.classList.toggle('mini-show-translation', show);
}
