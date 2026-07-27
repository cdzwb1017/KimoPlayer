export function showLyricContextMenu({
  line,
  lineIndex,
  clientX,
  clientY,
  onCalibrate,
  onSeek,
  onViewFullLyrics,
}) {
  if (!line || line.isInterlude) return;

  if (window.closeAllContextMenus) window.closeAllContextMenus();
  const oldMenu = document.getElementById('kimo-lyrics-context-menu');
  if (oldMenu) oldMenu.remove();

  const menu = document.createElement('div');
  menu.id = 'kimo-lyrics-context-menu';
  menu.className = 'kimo-context-menu';
  // 跟随歌词界面深浅色主题
  const lyricsPanel = document.querySelector('.lyrics-panel');
  const lyricsTheme = lyricsPanel?.classList.contains('lyrics-theme-light') ? 'light' : 'dark';
  menu.setAttribute('data-lyrics-theme', lyricsTheme);
  menu.style.left = `${clientX}px`;
  menu.style.top = `${clientY}px`;

  const menuItemCalibrate = document.createElement('div');
  menuItemCalibrate.className = 'kimo-context-menu-item';
  menuItemCalibrate.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    <span>AI 智能校准此句</span>
  `;
  menuItemCalibrate.addEventListener('click', () => {
    menu.remove();
    onCalibrate(lineIndex);
  });
  menu.appendChild(menuItemCalibrate);

  const menuItemSeek = document.createElement('div');
  menuItemSeek.className = 'kimo-context-menu-item';
  menuItemSeek.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span>跳转到对应句播放</span>
  `;
  menuItemSeek.addEventListener('click', () => {
    menu.remove();
    onSeek(line);
  });
  menu.appendChild(menuItemSeek);

  const menuItemFull = document.createElement('div');
  menuItemFull.className = 'kimo-context-menu-item';
  menuItemFull.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    <span>查看完整歌词文本</span>
  `;
  menuItemFull.addEventListener('click', () => {
    menu.remove();
    onViewFullLyrics();
  });
  menu.appendChild(menuItemFull);

  document.body.appendChild(menu);

  const clickOut = () => {
    menu.remove();
    document.removeEventListener('click', clickOut);
  };
  setTimeout(() => {
    document.addEventListener('click', clickOut);
  }, 50);
}

export function showFullLyricsModal({ lines, onToast }) {
  const text = lines.map(line => line.isInterlude ? '' : line.text).filter(Boolean).join('\n');
  const modal = document.createElement('div');
  modal.className = 'kimo-modal-overlay';
  modal.id = 'kimo-full-lyrics-modal';

  modal.innerHTML = `
    <div class="kimo-modal-card" style="max-width: 500px; width: 90%; display: flex; flex-direction: column;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--glass-border); padding:16px; margin-bottom:4px;">
        <span style="font-size:15px; font-weight:700; color:var(--text-primary);">完整歌词文本</span>
        <button id="full-lyrics-close-btn" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px; border-radius:50%; outline:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div style="flex:1; overflow-y:auto; padding:16px; margin:0 16px 16px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:10px; max-height:50vh; white-space:pre-wrap; font-family:var(--font-family); line-height:1.7; font-size:14.5px; color:var(--text-primary); user-select:text;">${text || '暂无歌词'}</div>
      <div style="display:flex; justify-content:flex-end; gap:12px; padding:0 16px 16px;">
        <button class="kimo-modal-btn secondary" id="full-lyrics-copy-btn" style="padding:10px 16px; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; border:1px solid var(--glass-border); background:rgba(255,255,255,0.05); color:var(--text-primary); display:flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>复制全部歌词</span>
        </button>
        <button class="kimo-modal-btn primary" id="full-lyrics-ok-btn" style="padding:10px 16px; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; border:none; background:rgb(var(--dynamic-color, 0, 240, 255)); color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.2);">确定</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#full-lyrics-close-btn').addEventListener('click', close);
  modal.querySelector('#full-lyrics-ok-btn').addEventListener('click', close);
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });

  modal.querySelector('#full-lyrics-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      onToast('歌词已成功复制到剪贴板');
    }).catch(() => {
      onToast('复制失败');
    });
  });
}
