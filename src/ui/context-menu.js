import { invoke } from '@tauri-apps/api/core';

const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const NEXT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';
const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>';
const ADD_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const EDIT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const FOLDER_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const SETTINGS_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const CLOCK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const RELOAD_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
const CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const item = (id, icon, label, style = '') => `
  <div class="context-menu-item" id="${id}"${style ? ` style="${style}"` : ''}>
    <span class="menu-icon">${icon}</span>
    <span>${label}</span>
  </div>
`;

const divider = () => '<div class="context-menu-divider"></div>';

const addClick = (root, selector, handler) => {
  root.querySelector(selector)?.addEventListener('click', handler);
};

const queueSongs = (player, songs) => {
  let count = 0;
  songs.forEach(song => {
    if (!player.playlist.some(s => s.file_path === song.file_path)) {
      player.playlist.push(song);
      count++;
    }
  });
  return count;
};

export function closeAllContextMenus() {
  document.getElementById('custom-context-menu')?.classList.remove('visible');
  document.querySelectorAll('.comment-context-menu').forEach(m => m.style.display = 'none');
  document.querySelectorAll('.kimo-context-menu').forEach(m => m.remove());
}
window.closeAllContextMenus = closeAllContextMenus;

export function initializeCustomContextMenu({
  player,
  showToast,
  switchTab,
  playSongCollection,
  openMetadataEditor,
}) {
  let menuEl = document.getElementById('custom-context-menu');
  if (!menuEl) {
    menuEl = document.createElement('div');
    menuEl.id = 'custom-context-menu';
    menuEl.className = 'custom-context-menu';
    document.body.appendChild(menuEl);
  }

  window.addEventListener('contextmenu', (e) => {
    // 播放器信息栏区域不触发此菜单
    if (e.target.closest('.player-info') || e.target.closest('.player-bar')) return;

    e.preventDefault();
    e.stopPropagation();

    closeAllContextMenus();

    const songItem = e.target.closest('.song-item');
    const albumCard = e.target.closest('.album-card');
    const artistCard = e.target.closest('.artist-card');
    const genreCard = e.target.closest('.genre-card');

    let menuHeight = 320;

    if (songItem) {
      menuHeight = 280;
      const filePath = songItem.dataset.filePath || songItem.dataset.path || '';
      const songTitle = songItem.querySelector('.song-title')?.textContent || '未知歌曲';
      const songArtist = songItem.querySelector('.song-artist')?.textContent || '未知艺术家';
      const songAlbum = songItem.dataset.album || '';
      const songDuration = parseFloat(songItem.dataset.duration || '0');
      const songCover = songItem.dataset.cover || null;

      menuEl.innerHTML = [
        item('menu-song-play', PLAY_ICON, '播放歌曲'),
        item('menu-song-playnext', NEXT_ICON, '下一首播放'),
        item('menu-song-copy', COPY_ICON, '复制歌曲信息'),
        item('menu-song-addplaylist', ADD_ICON, '添加到歌单'),
        divider(),
        item('menu-song-edit', EDIT_ICON, '编辑元数据与歌词'),
        item('menu-song-reveal', FOLDER_ICON, '在资源管理器中显示'),
      ].join('');

      addClick(menuEl, '#menu-song-play', () => {
        const idx = player.playlist.findIndex(s => s.file_path === filePath);
        if (idx >= 0) {
          player.play(idx);
        } else {
          showToast('无法在当前播放列表中找到该歌曲');
        }
      });

      addClick(menuEl, '#menu-song-playnext', () => {
        const targetIdx = player.playlist.findIndex(s => s.file_path === filePath);
        if (targetIdx >= 0) {
          const songObj = player.playlist[targetIdx];
          player.playlist.splice(targetIdx, 1);
          let newInsertIdx = player.currentIndex + 1;
          if (targetIdx < player.currentIndex) {
            player.currentIndex -= 1;
            newInsertIdx = player.currentIndex + 1;
          }
          player.playlist.splice(newInsertIdx, 0, songObj);
          showToast(`已将《${songTitle}》设为下一首播放`);
        } else {
          showToast('无法在当前播放列表中找到该歌曲');
        }
      });

      addClick(menuEl, '#menu-song-copy', () => {
        navigator.clipboard.writeText(`${songTitle} - ${songArtist}`).then(() => {
          showToast('歌曲信息已复制到剪贴板');
        }).catch(err => {
          console.error('[ContextMenu] Clipboard copy failed:', err);
          showToast('复制失败');
        });
      });

      addClick(menuEl, '#menu-song-addplaylist', () => {
        menuEl.style.display = 'none';
        const songData = { file_path: filePath, title: songTitle, artist: songArtist, album: songAlbum, duration: songDuration, cover_image: songCover };
        if (typeof window.addToPlaylistMenu === 'function') {
          window.addToPlaylistMenu(songData);
        } else {
          showToast('歌单功能未就绪');
        }
      });

      addClick(menuEl, '#menu-song-edit', () => {
        if (!filePath) {
          showToast('无法编辑：未获取到歌曲文件路径');
          return;
        }
        openMetadataEditor(filePath);
      });

      addClick(menuEl, '#menu-song-reveal', () => {
        if (!filePath) {
          showToast('无法定位：未获取到歌曲文件路径');
          return;
        }
        invoke('show_in_folder', { path: filePath })
          .then(() => showToast('已在资源管理器中定位文件'))
          .catch(err => {
            console.error('[ContextMenu] show_in_folder failed:', err);
            showToast('定位文件失败');
          });
      });
    } else if (albumCard) {
      menuHeight = 90;
      const albumTitle = albumCard.querySelector('.album-card-title')?.textContent || '未知专辑';
      const albumSongs = player.playlist.filter(s => (s.album || '未知专辑') === albumTitle);
      renderCollectionMenu(menuEl, 'album', '播放专辑全部歌曲', '将专辑追加至末尾');

      addClick(menuEl, '#menu-album-playall', () => {
        if (albumSongs.length > 0) {
          playSongCollection(albumSongs);
          showToast(`正在播放专辑《${albumTitle}》`);
        } else {
          showToast('该专辑下暂无歌曲');
        }
      });

      addClick(menuEl, '#menu-album-queueall', () => {
        if (albumSongs.length > 0) {
          showToast(`已追加${queueSongs(player, albumSongs)} 首歌曲至队列末尾`);
        }
      });
    } else if (artistCard) {
      menuHeight = 90;
      const artistTitle = artistCard.querySelector('.artist-card-title')?.textContent || '未知艺术家';
      const artistSongs = player.playlist.filter(s => (s.artist || '未知艺术家') === artistTitle);
      renderCollectionMenu(menuEl, 'artist', '播放歌手全部歌曲', '将歌曲追加至末尾');

      addClick(menuEl, '#menu-artist-playall', () => {
        if (artistSongs.length > 0) {
          playSongCollection(artistSongs);
          showToast(`正在播放歌手《${artistTitle}》的歌曲`);
        } else {
          showToast('该歌手下暂无歌曲');
        }
      });

      addClick(menuEl, '#menu-artist-queueall', () => {
        if (artistSongs.length > 0) {
          showToast(`已追加${queueSongs(player, artistSongs)} 首歌曲至队列末尾`);
        }
      });
    } else if (genreCard) {
      menuHeight = 90;
      const genreTitle = genreCard.querySelector('.genre-card-title')?.textContent || '未知流派';
      const genreSongs = player.playlist.filter(s => (s.genre || '未知流派') === genreTitle);
      renderCollectionMenu(menuEl, 'genre', '播放流派全部歌曲', '将歌曲追加至末尾');

      addClick(menuEl, '#menu-genre-playall', () => {
        if (genreSongs.length > 0) {
          playSongCollection(genreSongs);
          showToast(`正在播放流派《${genreTitle}》的歌曲`);
        } else {
          showToast('该流派下暂无歌曲');
        }
      });

      addClick(menuEl, '#menu-genre-queueall', () => {
        if (genreSongs.length > 0) {
          showToast(`已追加${queueSongs(player, genreSongs)} 首歌曲至队列末尾`);
        }
      });
    } else {
      // 非特定元素右键，不显示菜单
      menuEl.classList.remove('visible');
      return;
    }

    positionMenu(menuEl, e.clientX, e.clientY, menuHeight);
  });

  window.addEventListener('click', () => {
    if (menuEl) menuEl.classList.remove('visible');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl) {
      menuEl.classList.remove('visible');
    }
  });
}

function renderCollectionMenu(menuEl, type, playLabel, queueLabel) {
  menuEl.innerHTML = [
    item(`menu-${type}-playall`, PLAY_ICON, playLabel),
    item(`menu-${type}-queueall`, '→', queueLabel),
  ].join('');
}

function renderDefaultMenu(menuEl, player) {
  menuEl.innerHTML = [
    item('menu-play', PLAY_ICON, '播放 / 暂停'),
    item('menu-prev', NEXT_ICON, '上一首'),
    item('menu-next', NEXT_ICON, '下一首'),
    divider(),
    item('menu-goto-settings', SETTINGS_ICON, '打开扫描与设置'),
    item('menu-offset-dec', CLOCK_ICON, '歌词提前 0.5s'),
    item('menu-offset-inc', CLOCK_ICON, '歌词延后 0.5s'),
    divider(),
    item('menu-reload', RELOAD_ICON, '重新加载界面'),
    item('menu-close', CLOSE_ICON, '关闭播放器', 'color: #ff5555;'),
  ].join('');

  const playIcon = menuEl.querySelector('#menu-play .menu-icon');
  const playText = menuEl.querySelector('#menu-play span:not(.menu-icon)');
  if (player && player.audio && !player.audio.paused) {
    if (playIcon) playIcon.innerHTML = PAUSE_ICON;
    if (playText) playText.textContent = '暂停播放';
  } else {
    if (playIcon) playIcon.innerHTML = PLAY_ICON;
    if (playText) playText.textContent = '播放音乐';
  }
}

function positionMenu(menuEl, clientX, clientY, menuHeight) {
  const menuWidth = 200;
  let x = clientX;
  let y = clientY;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  menuEl.style.left = `${x}px`;
  menuEl.style.top = `${y}px`;
  menuEl.classList.add('visible');
}
