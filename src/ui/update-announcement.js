import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '🎨 专辑封面取色设置',
      items: [
        ['新增取色开关，可一键开启或关闭专辑封面取色，关闭后使用默认蓝色主题'],
        ['智能取色模式：根据当前主题自动适配最佳亮度，保证界面可读性'],
        ['手动调节模式：自由调整取色深浅（-50 偏深 ~ +50 偏浅），实时预览'],
      ],
    },
    {
      title: '🎵 歌词面板修复',
      items: [
        ['修复歌词面板无法进入的问题，恢复正常滑入动画'],
        ['歌词面板与控制栏弹出框不受 UI 缩放比例影响，始终保持原始尺寸'],
      ],
    },
    {
      title: '✨ 界面细节优化',
      items: [
        ['移除启动画面与关于页面 logo 的阴影效果，视觉更简洁'],
        ['GitHub 仓库主页 README 新增 KimoPlayer logo 图标展示'],
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
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">KimoPlayer ${APP_VERSION}</div>
        <div style="font-size:12px;color:var(--text-secondary);">2026.07.30 取色与界面优化</div>
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
