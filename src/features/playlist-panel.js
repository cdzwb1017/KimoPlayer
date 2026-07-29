export function initializePlaylistPanel({ player, getCoverSrc, showToast }) {
  const panel = document.getElementById('playlist-panel');
  const list = document.getElementById('playlist-panel-list');
  const count = document.getElementById('playlist-panel-count');
  const clearButton = document.getElementById('playlist-panel-clear');
  const closeButton = document.getElementById('playlist-panel-close');
  const toggleButton = document.getElementById('playlist-panel-btn');

  if (!panel || !list) return null;

  // 与评论区保持相同的顶层合成上下文，避免嵌套 backdrop-filter 只透明不模糊。
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  const render = () => {
    list.innerHTML = '';
    if (count) count.textContent = `${player.playlist.length} 首歌曲`;

    player.playlist.forEach((song, index) => {
      const item = document.createElement('div');
      item.className = `playlist-panel-item${index === player.currentIndex ? ' is-current' : ''}`;

      const cover = document.createElement('img');
      cover.className = 'playlist-panel-item-cover';
      cover.src = getCoverSrc(song.cover_image);
      item.appendChild(cover);

      const info = document.createElement('div');
      info.className = 'playlist-panel-item-info';

      const title = document.createElement('div');
      title.className = 'playlist-panel-item-title';
      title.textContent = song.title || '未知';
      info.appendChild(title);

      const artist = document.createElement('div');
      artist.className = 'playlist-panel-item-artist';
      artist.textContent = song.artist || '未知歌手';
      info.appendChild(artist);
      item.appendChild(info);

      const duration = document.createElement('span');
      duration.className = 'playlist-panel-item-duration';
      duration.textContent = song.duration > 0
        ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}`
        : '';
      item.appendChild(duration);

      const removeButton = document.createElement('button');
      removeButton.className = 'playlist-panel-item-remove';
      removeButton.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeButton.title = '移除';
      removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        player.playlist.splice(index, 1);
        if (index < player.currentIndex) {
          player.currentIndex -= 1;
        } else if (index === player.currentIndex && player.playlist.length > 0) {
          player.play(Math.min(index, player.playlist.length - 1));
        } else if (player.playlist.length === 0) {
          player.currentIndex = -1;
          player.audio.pause();
        }
        render();
      });
      item.appendChild(removeButton);

      item.addEventListener('click', () => player.play(index));
      list.appendChild(item);
    });

    list.querySelector('.is-current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const updateCurrent = () => {
    if (!panel.classList.contains('is-visible')) return;
    list.querySelectorAll('.playlist-panel-item').forEach((item, index) => {
      const isCurrent = index === player.currentIndex;
      item.classList.toggle('is-current', isCurrent);
      if (isCurrent) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  window.updatePlaylistPanelCurrent = updateCurrent;

  const setPanelVisible = (visible) => {
    panel.classList.toggle('is-visible', visible);
    document.body.classList.toggle('playlist-panel-open', visible);
    toggleButton?.classList.toggle('active', visible);
    toggleButton?.setAttribute('aria-expanded', String(visible));
  };

  toggleButton?.setAttribute('aria-expanded', 'false');
  toggleButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    const shouldOpen = !panel.classList.contains('is-visible');
    if (shouldOpen) {
      render();
    }
    setPanelVisible(shouldOpen);
  });

  closeButton?.addEventListener('click', () => setPanelVisible(false));

  clearButton?.addEventListener('click', () => {
    player.playlist = [];
    player.currentIndex = -1;
    player.audio.pause();
    render();
    showToast('已清空播放列表');
  });

  document.addEventListener('click', (event) => {
    if (
      panel.classList.contains('is-visible')
      && !panel.contains(event.target)
      && !toggleButton?.contains(event.target)
    ) {
      setPanelVisible(false);
    }
  });

  return { render, updateCurrent };
}
