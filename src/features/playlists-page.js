import { invoke } from '@tauri-apps/api/core';
import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';
import {
  addSongToPlaylist,
  addSongsToPlaylist,
  createManualPlaylist,
  deletePlaylistById,
  importM3UPlaylist,
  removeSongFromPlaylist,
} from './playlist-service.js';
import { getPlaylists, savePlaylists } from '../storage/playlist-store.js';

export function createPlaylistsPage({
  player,
  getCoverSrc,
  showToast,
  customPrompt,
  customConfirm,
}) {
  let playlistViewMode = 'list';    // 'list' | 'detail'
  let currentPlaylistId = null;

  const switchToPlaylistListView = () => {
    playlistViewMode = 'list';
    currentPlaylistId = null;
    renderPlaylistsTab();
  };

    const switchToPlaylistDetail = (playlistId) => {
    playlistViewMode = 'detail';
    currentPlaylistId = playlistId;
    renderPlaylistsTab();
  };

  // 歌单卡片右键菜单
  const showPlaylistCardContextMenu = (e, playlist) => {
    // 移除已有菜单
    const existing = document.getElementById('kimo-playlist-card-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'kimo-playlist-card-ctx-menu';
    menu.style.cssText = `
      position: fixed; left: ${e.clientX}px; top: ${e.clientY}px; z-index: 10000;
      background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px;
      padding: 6px; min-width: 180px; box-shadow: var(--glass-shadow);
      animation: ctxMenuIn 0.15s ease;
    `;

    const menuItems = [
      { icon: '▶', label: '播放全部', action: () => {
        if (playlist.songs.length === 0) return showToast('歌单为空');
        player.playlist = [...playlist.songs];
        player.play(0);
      }},
      { icon: '✏️', label: '重命名', action: async () => {
        const newName = await customPrompt('重命名歌单', playlist.name, '请输入新名称');
        if (!newName || !newName.trim() || newName.trim() === playlist.name) return;
        const all = getPlaylists();
        const target = all.find(p => p.id === playlist.id);
        if (target) {
          target.name = newName.trim();
          savePlaylists(all);
          renderPlaylistsTab();
          showToast('已重命名');
        }
      }},
            { icon: '📤', label: '导出 M3U', action: async () => {
        if (playlist.songs.length === 0) return showToast('歌单为空，无法导出');
        let m3uContent = '#EXTM3U\n';
        playlist.songs.forEach(s => {
          const dur = s.duration > 0 ? Math.round(s.duration) : -1;
          m3uContent += `#EXTINF:${dur},${s.artist || 'Unknown'} - ${s.title || 'Unknown'}\n${s.file_path}\n`;
        });
        try {
          const filePath = await invoke('save_file_dialog', {
            defaultPath: `${playlist.name}.m3u`,
            filters: [{ name: 'M3U 播放列表', extensions: ['m3u'] }]
          });
          if (filePath) {
            await invoke('write_text_file', { path: filePath, content: m3uContent });
            showToast('导出成功');
          }
        } catch (err) {
          console.error('Export M3U failed:', err);
          showToast('导出失败: ' + err);
        }
      }},
      { icon: '🗑️', label: '删除歌单', danger: true, action: async () => {
        if (await customConfirm(`确定删除歌单"${playlist.name}"吗？此操作不可恢复。`)) {
          deletePlaylistById(playlist.id);
          renderPlaylistsTab();
          showToast('已删除');
        }
      }},
    ];

    menuItems.forEach(item => {
      const btn = document.createElement('div');
      btn.style.cssText = `
        display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px;
        font-size: 13px; cursor: pointer; transition: background 0.15s;
        color: ${item.danger ? 'rgb(239, 68, 68)' : 'var(--text-primary)'};
      `;
      btn.innerHTML = `<span style="font-size:14px;width:20px;text-align:center;">${item.icon}</span><span>${item.label}</span>`;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.08)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        item.action();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // 点击外部关闭
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  };

  // 歌单内歌曲右键菜单
  const showPlaylistSongContextMenu = (e, song, idx, playlist) => {
    const existing = document.getElementById('kimo-playlist-song-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'kimo-playlist-song-ctx-menu';
    menu.style.cssText = `
      position: fixed; left: ${e.clientX}px; top: ${e.clientY}px; z-index: 10000;
      background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px;
      padding: 6px; min-width: 180px; box-shadow: var(--glass-shadow);
      animation: ctxMenuIn 0.15s ease;
    `;

    const menuItems = [
      { icon: '▶', label: '播放', action: () => {
        player.playlist = [...playlist.songs];
        player.play(idx);
      }},
      { icon: '⬆️', label: '上移', action: () => {
        if (idx <= 0) return;
        const all = getPlaylists();
        const target = all.find(p => p.id === playlist.id);
        if (target) {
          [target.songs[idx - 1], target.songs[idx]] = [target.songs[idx], target.songs[idx - 1]];
          savePlaylists(all);
          renderPlaylistsTab();
        }
      }},
      { icon: '⬇️', label: '下移', action: () => {
        const all = getPlaylists();
        const target = all.find(p => p.id === playlist.id);
        if (target && idx < target.songs.length - 1) {
          [target.songs[idx], target.songs[idx + 1]] = [target.songs[idx + 1], target.songs[idx]];
          savePlaylists(all);
          renderPlaylistsTab();
        }
      }},
      { icon: '📋', label: '复制歌曲信息', action: () => {
        navigator.clipboard.writeText(`${song.title || '未知'} - ${song.artist || '未知歌手'}`)
          .then(() => showToast('已复制'))
          .catch(() => showToast('复制失败'));
      }},
      { icon: '🗑️', label: '从歌单移除', danger: true, action: () => {
        removeSongFromPlaylist(playlist.id, idx);
        renderPlaylistsTab();
        showToast('已移除');
      }},
    ];

    menuItems.forEach(item => {
      const btn = document.createElement('div');
      btn.style.cssText = `
        display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px;
        font-size: 13px; cursor: pointer; transition: background 0.15s;
        color: ${item.danger ? 'rgb(239, 68, 68)' : 'var(--text-primary)'};
      `;
      btn.innerHTML = `<span style="font-size:14px;width:20px;text-align:center;">${item.icon}</span><span>${item.label}</span>`;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.08)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        item.action();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  };

  const renderPlaylistsTab = () => {
    const listEl = document.getElementById('music-list');
    const countEl = document.getElementById('music-count');
    if (!listEl) return;
    if (countEl) countEl.style.display = 'none';

    const playlists = getPlaylists();
    listEl.innerHTML = '';

    // ======== 歌单列表视图 ========
    if (playlistViewMode === 'list') {
      // 头部操作化
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding:0 2px;';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:16px;font-weight:600;color:var(--text-primary);';
      title.textContent = `我的歌单 ${playlists.length}`;
      header.appendChild(title);

      const actWrap = document.createElement('div');
      actWrap.style.cssText = 'display:flex;gap:8px;';

      // 导入 M3U
      const impBtn = document.createElement('button');
      impBtn.className = 'setting-btn';
      impBtn.style.cssText = 'font-size:12px;padding:5px 12px;';
      impBtn.textContent = '📁 导入 M3U';
      impBtn.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.m3u,.m3u8';
        inp.style.display = 'none';
        inp.addEventListener('change', async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            const pl = await importM3UPlaylist(f);
            renderPlaylistsTab();
            showToast(`已导入 ${pl.name} · ${pl.songs.length} 首歌曲`);
          } catch (err) {
            showToast('M3U 解析失败: ' + err.message);
          }
        });
        document.body.appendChild(inp);
        inp.click();
        setTimeout(() => inp.remove(), 200);
      });
      actWrap.appendChild(impBtn);

      // 新建空歌单
      const newBtn = document.createElement('button');
      newBtn.className = 'setting-btn';
      newBtn.style.cssText = 'font-size:12px;padding:5px 12px;';
      newBtn.textContent = '+ 新建歌单';
      newBtn.addEventListener('click', async () => {
        const name = await customPrompt('新建歌单', '', '请输入歌单名称');
        if (!name || !name.trim()) return;
        createManualPlaylist(name.trim());
        renderPlaylistsTab();
        showToast(`已创建 ${name.trim()}`);
      });
      actWrap.appendChild(newBtn);
      header.appendChild(actWrap);
      listEl.appendChild(header);

      // 歌单列表卡片
      if (playlists.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:60px 0;color:var(--text-secondary);font-size:14px;';
        empty.textContent = '还没有歌单，点击上方按钮新建或导入M3U 吧！';
        listEl.appendChild(empty);
        return;
      }

      playlists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'song-item music-list-item';
        card.style.cssText = 'display:flex;align-items:center;gap:14px;cursor:pointer;';

        // 封面拼图（取前四首歌曲 2×2）。
        const coverWrap = document.createElement('div');
        coverWrap.className = 'playlist-card-cover';
        if (pl.songs.length > 0) {
          const first4 = pl.songs.slice(0, 4);
          while (first4.length < 4) first4.push(first4[0] || {});
          first4.forEach((s, i) => {
            const cell = document.createElement('img');
            cell.className = 'playlist-card-cover-cell';
            cell.src = getCoverSrc(s.cover_image);
            cell.alt = '';
            coverWrap.appendChild(cell);
          });
        } else {
          const ph = document.createElement('div');
          ph.className = 'playlist-card-cover-empty';
          ph.textContent = '🎵';
          coverWrap.appendChild(ph);
        }
        card.appendChild(coverWrap);

        // 信息化
        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        const nm = document.createElement('div');
        nm.style.cssText = 'font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nm.textContent = pl.name;
        info.appendChild(nm);
        const sub = document.createElement('div');
        sub.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-top:2px;';
        const src = pl.source === 'm3u' ? 'M3U 导入' : '手动创建';
        sub.textContent = `${pl.songs.length} 首 ${src}`;
        info.appendChild(sub);
        card.appendChild(info);

        // 操作按钮
        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px;padding:4px;opacity:0.5;transition:opacity 0.15s;flex-shrink:0;';
        delBtn.textContent = '🗑️';
        delBtn.title = '删除歌单';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await customConfirm(`确定删除歌单"${pl.name}"吗？此操作不可恢复。`)) {
            deletePlaylistById(pl.id);
            renderPlaylistsTab();
            showToast('已删除');
          }
        });
        card.appendChild(delBtn);

                // 右键菜单
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showPlaylistCardContextMenu(e, pl);
        });

        card.addEventListener('click', () => switchToPlaylistDetail(pl.id));
        listEl.appendChild(card);
      });
      return;
    }

    // ======== 歌单详情视图 ========
    const pl = getPlaylists().find(p => p.id === currentPlaylistId);
    if (!pl) { switchToPlaylistListView(); return; }

    // 顶部栏
    const topBar = document.createElement('div');
    topBar.className = 'playlist-detail-header';

    const backWrap = document.createElement('div');
    backWrap.className = 'playlist-detail-back';
    const backBtn = document.createElement('button');
    backBtn.className = 'playlist-detail-back-btn';
    backBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    backBtn.title = '返回歌单列表';
    backBtn.addEventListener('click', switchToPlaylistListView);
    backWrap.appendChild(backBtn);
    const nmEl = document.createElement('span');
    nmEl.className = 'playlist-detail-title';
    nmEl.textContent = pl.name;
    backWrap.appendChild(nmEl);
    topBar.appendChild(backWrap);

    const playAllBtn = document.createElement('button');
    playAllBtn.className = 'playlist-detail-play-all';
    playAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 播放全部 (${pl.songs.length})`;
    playAllBtn.addEventListener('click', () => {
      if (pl.songs.length === 0) return showToast('歌单为空');
      // ⭐ 直接替换播放列表为歌单歌曲⭐
      player.playlist = [...pl.songs];
      player.play(0);
    });
    topBar.appendChild(playAllBtn);
    listEl.appendChild(topBar);

    // 歌曲列表
    if (pl.songs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'playlist-detail-empty';
      empty.textContent = '歌单为空，去本地音乐右键添加歌曲吧！';
      listEl.appendChild(empty);
      return;
    }

    pl.songs.forEach((song, idx) => {
      const row = document.createElement('div');
      row.className = 'playlist-detail-item song-item';
      row.setAttribute('data-file-path', song.file_path);

      // 序号
      const num = document.createElement('span');
      num.className = 'playlist-detail-num';
      num.textContent = `${idx + 1}`;
      row.appendChild(num);

      // 封面小图
      const cov = document.createElement('img');
      cov.className = 'playlist-detail-cover';
      cov.src = getCoverSrc(song.cover_image);
      if (!song.cover_image) {
        // ⭐ 没有封面时异步读可metadata ⭐
        (async () => {
          try {
            const meta = await invoke('read_audio_metadata', { path: song.file_path });
            if (meta && meta.cover_image) {
              song.cover_image = meta.cover_image;
              cov.src = getCoverSrc(song.cover_image);
              // 持久化保存
              const all = getPlaylists();
              const targetPl = all.find(p => p.id === currentPlaylistId);
              if (targetPl) {
                const targetSong = targetPl.songs.find(s => s.file_path === song.file_path);
                if (targetSong) {
                  targetSong.cover_image = meta.cover_image;
                  savePlaylists(all);
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch cover:', song.file_path, err);
          }
        })();
      }
      row.appendChild(cov);

      // 标题 + 歌手
      const infoDiv = document.createElement('div');
      infoDiv.className = 'playlist-detail-info';
      const t = document.createElement('div');
      t.className = 'playlist-detail-song-title';
      t.textContent = song.title || '未知';
      infoDiv.appendChild(t);
      const a = document.createElement('div');
      a.className = 'playlist-detail-song-artist';
      a.innerHTML = renderArtistWithBadgesHtml(song.artist, song);
      infoDiv.appendChild(a);
      row.appendChild(infoDiv);

      // 时长
      const durEl = document.createElement('span');
      durEl.className = 'playlist-detail-duration';
      durEl.textContent = song.duration > 0 ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '';
      row.appendChild(durEl);

      // 删除按钮
      const rm = document.createElement('button');
      rm.className = 'playlist-detail-remove';
      rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      rm.title = '从歌单移闄';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSongFromPlaylist(pl.id, idx);
        renderPlaylistsTab();
      });
      row.appendChild(rm);

            // 单击播放：替换播放列表为歌单歌曲，然后播放该首
      row.addEventListener('click', () => {
        player.playlist = [...pl.songs];
        player.play(idx);
      });

      // 右键菜单
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPlaylistSongContextMenu(e, song, idx, pl);
      });

      listEl.appendChild(row);
    });
  };

  // 导出到右键菜单的添加到歌单效果
  window.addToPlaylistMenu = (songData) => {
    const songs = Array.isArray(songData) ? songData : [songData];
    const playlists = getPlaylists();
    if (playlists.length === 0) {
      showToast('请先创建歌单');
      return;
    }
    // 显示一个简易选择菜单
    const overlay = document.createElement('div');
    overlay.className = 'playlist-picker-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;transition:opacity 0.2s ease;';
    overlay.style.opacity = '0';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    const closeMenu = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });
    const menu = document.createElement('div');
    menu.className = 'playlist-picker-menu';
    menu.style.cssText = 'background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:10px;min-width:260px;max-width:340px;max-height:400px;overflow-y:auto;box-shadow:var(--glass-shadow);transition:opacity 0.2s ease, transform 0.2s ease;';
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.92) translateY(10px)';
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1) translateY(0)';
    });
    const title = document.createElement('div');
    title.style.cssText = 'padding:8px 10px 12px;font-size:14px;font-weight:650;color:var(--text-primary);';
    title.textContent = songs.length > 1 ? `添加 ${songs.length} 首歌曲到歌单` : '添加到歌单';
    menu.appendChild(title);

        playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlist-picker-item';
      item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;font-size:13px;color:var(--text-primary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s ease;';

      // 封面：优先显示歌单第一首歌的封面，否则显示占位符
      const coverSrc = pl.songs.length > 0 ? getCoverSrc(pl.songs[0].cover_image) : '';
      const coverHtml = coverSrc
        ? `<img src="${coverSrc}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;" />`
        : `<span style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:rgba(var(--dynamic-color,16,185,129),.14);color:rgb(var(--dynamic-color,16,185,129));font-size:16px;">♫</span>`;
      item.innerHTML = `${coverHtml}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;">${pl.name}</span><span style="margin-left:auto;color:var(--text-secondary);font-size:12px;">${pl.songs.length}</span>`;
      item.addEventListener('click', () => {
        const added = addSongsToPlaylist(pl.id, songs);
        closeMenu();
        showToast(added > 0 ? `已添加 ${added} 首到「${pl.name}」` : '歌曲已在该歌单中');
      });
      menu.appendChild(item);
    });
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
  };


  return {
    renderPlaylistsTab,
  };
}
