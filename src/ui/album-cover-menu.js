import { getEffectiveLyricsTheme } from './lyrics-controls.js';

export function initializeAlbumCoverMenu({
  player,
  getCoverSrc,
  showToast,
  openMetadataEditor,
}) {
  const viewAlbumImageLarge = (coverSrc) => {
    const oldModal = document.getElementById('kimo-album-zoom-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'kimo-album-zoom-modal';
    modal.className = 'kimo-modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '99999';

    modal.innerHTML = `
      <div class="kimo-modal-card" style="max-width: 480px; width: 90%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px;">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 12px; margin-bottom: 4px;">
          <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">专辑大图查看</span>
          <button id="close-zoom-modal-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none; padding: 4px; border-radius: 50%; transition: background 0.2s;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <img src="${coverSrc}" style="width: 100%; aspect-ratio: 1/1; border-radius: 12px; object-fit: cover; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); user-select: none;" />
        <div style="display: flex; gap: 12px; width: 100%; margin-top: 4px;">
          <button class="kimo-modal-btn secondary" id="download-zoom-cover-btn" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--glass-border); background: rgba(255, 255, 255, 0.05); color: var(--text-primary); transition: all 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>保存图片</span>
          </button>
          <button class="kimo-modal-btn primary" id="close-zoom-cover-btn" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; background: rgb(var(--dynamic-color, 0, 240, 255)); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: all 0.2s;">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    modal.querySelector('#close-zoom-modal-btn')?.addEventListener('click', close);
    modal.querySelector('#close-zoom-cover-btn')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    modal.querySelector('#download-zoom-cover-btn')?.addEventListener('click', async () => {
      try {
        const response = await fetch(coverSrc);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'album_cover.jpg';
        a.click();
        showToast('已启动专辑封面图片下载');
      } catch (e) {
        showToast('图片保存失败: ' + e.message);
      }
    });
  };

  const onCoverContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.closeAllContextMenus) window.closeAllContextMenus();
    const song = player.playlist[player.currentIndex];
    if (!song) return;

    const oldMenu = document.getElementById('kimo-album-context-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'kimo-album-context-menu';
    menu.className = 'kimo-context-menu';
    // 跟随歌词界面深浅色主题（含"跟随软件"模式）
    menu.setAttribute('data-lyrics-theme', getEffectiveLyricsTheme());
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const itemImg = document.createElement('div');
    itemImg.className = 'kimo-context-menu-item';
    itemImg.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>查看专辑大图</span>
    `;
    itemImg.addEventListener('click', () => {
      menu.remove();
      viewAlbumImageLarge(getCoverSrc(song.cover_image));
    });

    const itemMeta = document.createElement('div');
    itemMeta.className = 'kimo-context-menu-item';
    itemMeta.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>查看歌曲元数据</span>
    `;
    itemMeta.addEventListener('click', () => {
      menu.remove();
      openMetadataEditor(song.file_path);
    });

    menu.appendChild(itemImg);
    menu.appendChild(itemMeta);
    document.body.appendChild(menu);

    const clickOut = () => {
      menu.remove();
      document.removeEventListener('click', clickOut);
    };
    setTimeout(() => {
      document.addEventListener('click', clickOut);
    }, 50);
  };

  document.getElementById('lyrics-cover-click-area')?.addEventListener('contextmenu', onCoverContextMenu);
}
