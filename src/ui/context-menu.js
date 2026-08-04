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
const FAVORITE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
const QUEUE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
const SHARE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
const WIFI_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';

const item = (id, icon, label, style = '') => `
  <div class="context-menu-item" id="${id}"${style ? ` style="${style}"` : ''}>
    <span class="menu-icon">${icon}</span>
    <span>${label}</span>
  </div>
`;

const divider = () => '<div class="context-menu-divider"></div>';

const addClick = (root, selector, handler) => {
  root.querySelector(selector)?.addEventListener('click', (e) => {
    closeAllContextMenus();
    handler(e);
  });
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
  const menu = document.getElementById('custom-context-menu');
  if (menu) {
    menu.classList.remove('visible');
    menu.style.display = '';
  }
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

    // ── LunaBeat 局域网来源判断 ──
    // 识别方式：
    //   1) song-item 上有 dataset.filePath 是 lunaId（非绝对路径/非 file://）
    //   2) window.kimoLunaContext 全局上下文桥提供 getSongs/playCollection 等方法
    const isLuna = Boolean(window.kimoLunaContext);

    let menuHeight = 320;

    if (songItem) {
      const filePath = songItem.dataset.filePath || songItem.dataset.path || '';
      // LunaBeat 歌曲：filePath 为 _lunaId（不含路径分隔符和扩展名即可判定）
      const isLunaSong = isLuna && filePath && !/^[a-zA-Z]:[\\/]/.test(filePath) && !filePath.startsWith('file://') && !filePath.startsWith('/');

      const songTitle = songItem.querySelector('.song-title')?.textContent || '未知歌曲';
      const songArtistRaw = songItem.querySelector('.song-artist')?.textContent || '未知艺术家';
      // song-artist 内可能包含音质徽章 HTML，取第一个文字节点纯文本
      const songArtist = (() => {
        const el = songItem.querySelector('.song-artist');
        if (!el) return songArtistRaw;
        return (el.childNodes[0]?.nodeType === Node.TEXT_NODE ? el.childNodes[0].textContent?.trim() : el.textContent?.trim()) || songArtistRaw;
      })();
      const songAlbum = songItem.dataset.album || '';
      const songDuration = parseFloat(songItem.dataset.duration || '0');
      const songCover = songItem.dataset.cover || null;

      if (isLunaSong) {
        // ══════════════ LunaBeat 局域网歌曲专属菜单 ══════════════
        menuHeight = 260;
        const luna = window.kimoLunaContext;
        const lunaSong = luna.getSongById(filePath);
        const lunaSongs = luna.getSongsCache();

        menuEl.innerHTML = [
          item('menu-luna-play', PLAY_ICON, '播放歌曲'),
          item('menu-luna-playnext', NEXT_ICON, '下一首播放'),
          item('menu-luna-queue', QUEUE_ICON, '添加到播放队列'),
          item('menu-luna-addplaylist', ADD_ICON, '添加到歌单'),
          divider(),
          item('menu-luna-favorite', FAVORITE_ICON, '收藏到本地'),
          item('menu-luna-copy', COPY_ICON, '复制歌曲信息'),
          divider(),
          item('menu-luna-gotoalbum', FOLDER_ICON, '查看专辑'),
          item('menu-luna-gotoartist', WIFI_ICON, '查看艺人'),
        ].join('');

        const resolveAndPlay = (playIdx = null) => {
          // 切到歌曲视图并定位播放
          const songs = Array.isArray(lunaSongs) && lunaSongs.length > 0 ? lunaSongs : [];
          if (songs.length === 0) return;
          const idx = playIdx !== null ? playIdx : songs.findIndex(s => s._lunaId === filePath);
          if (idx < 0) return;
          player.playlist = songs.map(s => ({
            ...s,
            duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
          }));
          player.currentIndex = idx;
          player.playFromLunaBeat(idx);
        };

        addClick(menuEl, '#menu-luna-play', () => {
          resolveAndPlay();
        });

        addClick(menuEl, '#menu-luna-playnext', () => {
          if (!lunaSong) { showToast('歌曲信息未就绪'); return; }
          const playSong = {
            ...lunaSong,
            duration: lunaSong.durationMs ? lunaSong.durationMs / 1000 : (lunaSong.duration || 0),
          };
          const existsIdx = player.playlist.findIndex(s => s._lunaId === lunaSong._lunaId);
          if (existsIdx >= 0) player.playlist.splice(existsIdx, 1);
          const insertAt = Math.min(player.currentIndex + 1, player.playlist.length);
          player.playlist.splice(insertAt, 0, playSong);
          showToast(`已将《${songTitle}》设为下一首播放`);
        });

        addClick(menuEl, '#menu-luna-queue', () => {
          if (!lunaSong) { showToast('歌曲信息未就绪'); return; }
          const playSong = {
            ...lunaSong,
            duration: lunaSong.durationMs ? lunaSong.durationMs / 1000 : (lunaSong.duration || 0),
          };
          if (!player.playlist.some(s => s._lunaId === lunaSong._lunaId)) {
            player.playlist.push(playSong);
          }
          showToast(`已将《${songTitle}》追加到队列末尾`);
        });

        addClick(menuEl, '#menu-luna-addplaylist', () => {
          if (!lunaSong) { showToast('歌曲信息未就绪'); return; }
          menuEl.style.display = 'none';
          const songData = {
            file_path: lunaSong._lunaId,
            title: lunaSong.title || songTitle,
            artist: lunaSong.artist || songArtist,
            album: lunaSong.album || songAlbum,
            duration: lunaSong.durationMs ? lunaSong.durationMs / 1000 : songDuration,
            cover_image: songCover,
            _source: 'luna',
          };
          if (typeof window.addToPlaylistMenu === 'function') {
            window.addToPlaylistMenu(songData);
          } else {
            showToast('歌单功能未就绪');
          }
        });

        addClick(menuEl, '#menu-luna-favorite', () => {
          showToast('局域网歌曲暂不支持本地收藏（请先下载到本地）');
        });

        addClick(menuEl, '#menu-luna-copy', () => {
          navigator.clipboard.writeText(`${songTitle} - ${songArtist}`).then(() => {
            showToast('歌曲信息已复制到剪贴板');
          }).catch(err => {
            console.error('[ContextMenu] Clipboard copy failed:', err);
            showToast('复制失败');
          });
        });

        addClick(menuEl, '#menu-luna-gotoalbum', () => {
          if (!lunaSong || !lunaSong.album) { showToast('该歌曲未包含专辑信息'); return; }
          if (typeof luna.navigateTo === 'function') {
            luna.navigateTo('albums', { type: 'album', name: lunaSong.album, audioId: lunaSong._lunaId });
          }
        });

        addClick(menuEl, '#menu-luna-gotoartist', () => {
          if (!lunaSong || !lunaSong.artist) { showToast('该歌曲未包含艺人信息'); return; }
          if (typeof luna.navigateTo === 'function') {
            luna.navigateTo('artists', { type: 'artist', name: lunaSong.artist, audioId: lunaSong._lunaId });
          }
        });
      } else {
        // ══════════════ 本地歌曲菜单 ══════════════
        menuHeight = 280;
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
      }
    } else if (albumCard) {
      // ── LunaBeat 专辑卡片：判断是否在 LunaBeat 页面（LunaBeat 专辑有全局桥）
      const albumTitle = albumCard.querySelector('.album-card-title')?.textContent || '未知专辑';
      const isLunaAlbum = isLuna && albumCard.closest('#music-list')?.parentNode && (() => {
        try {
          const albums = window.kimoLunaContext?.getAlbumsCache?.();
          return Array.isArray(albums) && albums.some(a => (a.title || a.album) === albumTitle);
        } catch (_) { return false; }
      })();

      if (isLunaAlbum) {
        menuHeight = 120;
        const luna = window.kimoLunaContext;
        const allSongs = luna.getSongsCache() || [];
        const albumSongs = allSongs.filter(s => s.album === albumTitle);

        menuEl.innerHTML = [
          item('menu-luna-album-play', PLAY_ICON, '播放专辑全部歌曲'),
          item('menu-luna-album-queue', QUEUE_ICON, '将专辑追加到播放队列'),
          divider(),
          item('menu-luna-album-artist', WIFI_ICON, '查看艺人'),
        ].join('');

        addClick(menuEl, '#menu-luna-album-play', () => {
          if (albumSongs.length === 0) { showToast('该专辑下暂无歌曲'); return; }
          player.playlist = albumSongs.map(s => ({
            ...s,
            duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
          }));
          player.currentIndex = 0;
          player.playFromLunaBeat(0);
          showToast(`正在播放专辑《${albumTitle}》`);
        });

        addClick(menuEl, '#menu-luna-album-queue', () => {
          let count = 0;
          albumSongs.forEach(s => {
            if (!player.playlist.some(p => p._lunaId === s._lunaId)) {
              player.playlist.push({
              ...s,
              duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
            });
              count++;
            }
          });
          showToast(`已追加 ${count} 首歌曲至队列末尾`);
        });

        addClick(menuEl, '#menu-luna-album-artist', () => {
          const firstSong = albumSongs[0];
          if (!firstSong || !firstSong.artist) { showToast('无法确定艺人'); return; }
          if (typeof luna.navigateTo === 'function') {
            luna.navigateTo('artists', { type: 'artist', name: firstSong.artist, audioId: firstSong._lunaId });
          }
        });
      } else {
        menuHeight = 90;
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
      }
    } else if (artistCard) {
      const artistTitle = artistCard.querySelector('.artist-card-title')?.textContent || '未知艺术家';
      const isLunaArtist = isLuna && artistCard.closest('#music-list')?.parentNode && (() => {
        try {
          const artists = window.kimoLunaContext?.getArtistsCache?.();
          return Array.isArray(artists) && artists.some(a => (a.name || a.title) === artistTitle);
        } catch (_) { return false; }
      })();

      if (isLunaArtist) {
        menuHeight = 90;
        const luna = window.kimoLunaContext;
        const allSongs = luna.getSongsCache() || [];
        const artistSongs = allSongs.filter(s => s.artist === artistTitle);

        menuEl.innerHTML = [
          item('menu-luna-artist-play', PLAY_ICON, '播放艺人全部歌曲'),
          item('menu-luna-artist-queue', QUEUE_ICON, '将歌曲追加到播放队列'),
        ].join('');

        addClick(menuEl, '#menu-luna-artist-play', () => {
          if (artistSongs.length === 0) { showToast('该艺人下暂无歌曲'); return; }
          player.playlist = artistSongs.map(s => ({
            ...s,
            duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
          }));
          player.currentIndex = 0;
          player.playFromLunaBeat(0);
          showToast(`正在播放艺人《${artistTitle}》的歌曲`);
        });

        addClick(menuEl, '#menu-luna-artist-queue', () => {
          let count = 0;
          artistSongs.forEach(s => {
            if (!player.playlist.some(p => p._lunaId === s._lunaId)) {
              player.playlist.push({
                ...s,
                duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
              });
              count++;
            }
          });
          showToast(`已追加 ${count} 首歌曲至队列末尾`);
        });
      } else {
        menuHeight = 90;
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
      }
    } else if (genreCard) {
      const genreTitle = genreCard.querySelector('.genre-card-title')?.textContent || '未知流派';
      // LunaBeat 的文件夹是用 genre-card 样式渲染，判断是否为 LunaBeat 文件夹
      const isLunaFolder = isLuna && genreCard.closest('#music-list')?.parentNode && (() => {
        try {
          const folders = window.kimoLunaContext?.getFoldersCache?.();
          return Array.isArray(folders) && folders.some(f => (f.name || f.title) === genreTitle);
        } catch (_) { return false; }
      })();

      if (isLunaFolder) {
        menuHeight = 90;
        const luna = window.kimoLunaContext;
        const allSongs = luna.getSongsCache() || [];
        const folderSongs = allSongs.filter(s => s.folder === genreTitle || (s.path && s.path.includes(genreTitle)));

        menuEl.innerHTML = [
          item('menu-luna-folder-play', PLAY_ICON, '播放文件夹全部歌曲'),
          item('menu-luna-folder-queue', QUEUE_ICON, '将歌曲追加到播放队列'),
        ].join('');

        addClick(menuEl, '#menu-luna-folder-play', () => {
          if (folderSongs.length === 0) { showToast('该文件夹下暂无歌曲'); return; }
          player.playlist = folderSongs.map(s => ({
            ...s,
            duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
          }));
          player.currentIndex = 0;
          player.playFromLunaBeat(0);
          showToast(`正在播放文件夹《${genreTitle}》`);
        });

        addClick(menuEl, '#menu-luna-folder-queue', () => {
          let count = 0;
          folderSongs.forEach(s => {
            if (!player.playlist.some(p => p._lunaId === s._lunaId)) {
              player.playlist.push({
                ...s,
                duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
              });
              count++;
            }
          });
          showToast(`已追加 ${count} 首歌曲至队列末尾`);
        });
      } else {
        menuHeight = 90;
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
      }
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
