const UPDATE_SEEN_KEY = 'kimo-update-seen-146b01';

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '右键菜单玻璃材质统一',
      items: [
        ['所有右键菜单改为和评论区一致的玻璃材质'],
        ['支持深色/浅色/灰色三套主题自动适配'],
        ['歌词界面右键菜单跟随歌词深浅色主题'],
      ],
    },
    {
      title: '歌词面板控制按钮',
      items: [
        ['标题栏按钮、歌词控件按钮统一为玻璃材质'],
        ['弹出框移到 body 下避免被裁剪'],
        ['移除歌词面板内控制按钮的原生 tooltip'],
      ],
    },
    {
      title: '右键菜单精简',
      items: [
        ['移除空白区域默认右键菜单'],
        ['封面右键菜单仅在歌词页大封面触发'],
      ],
    },
  ];

  const sectionsHTML = sections.map(section => {
    const itemsHTML = section.items.map(([text]) => `
      <div style="color:var(--text-secondary);font-size:13px;line-height:1.65;">${text}</div>
    `).join('');
    return `
      <div style="margin-bottom:14px;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${section.title}</div>
        ${itemsHTML}
      </div>
    `;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'kimo-modal-overlay';
  overlay.innerHTML = `
    <div class="kimo-modal-card" style="max-width:460px;width:92%;padding:0;text-align:left;overflow:hidden;">
      <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">KimoPlayer 1.4.6-beta01</div>
        <div style="font-size:12px;color:var(--text-secondary);">2026.07.26 右键菜单重构</div>
      </div>
      <div style="padding:18px 24px 4px;">${sectionsHTML}</div>
      <div style="padding:14px 24px 20px;">
        <button id="kimo-update-ok-btn" style="width:100%;padding:10px;font-size:14px;font-weight:600;border:none;border-radius:8px;background:rgb(var(--dynamic-color,16,185,129));color:#fff;cursor:pointer;">开始使用</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => {
    if (event.target !== overlay && !event.target.closest('#kimo-update-ok-btn')) return;

    overlay.classList.add('is-closing');
    setTimeout(() => overlay.remove(), 200);
    localStorage.setItem(UPDATE_SEEN_KEY, 'true');
  });
}
