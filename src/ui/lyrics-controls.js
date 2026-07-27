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
      popover.style.left = `${rect.left + rect.width / 2}px`;
      popover.style.top = `${rect.top - 4}px`;
      popover.style.transform = 'translateX(-50%) translateY(-100%) scale(1)';
      document.body.appendChild(popover);
    });

    item.addEventListener('mouseleave', () => {
      popover.classList.remove('moved-to-body');
      popover.style.left = '';
      popover.style.top = '';
      popover.style.transform = '';
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
