import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '🚀 一键在线升级，无需手动下载',
      items: [
        ['软件内即可直接一键检查并更新到最新版本'],
        ['新增清晰的下载进度条与 MB 大小显示，进度随时掌握'],
        ['下载完成后自动启动安装，听歌更新两不误'],
      ],
    },
    {
      title: '🔑 专属内测通道上线',
      items: [
        ['设置中新增【内测 Key】功能'],
        ['输入内测密钥即可抢先体验最新的测试版功能'],
      ],
    },
    {
      title: '🎨 视觉动效与细节体验优化',
      items: [
        ['全新重构的更新提示框与设置页面，动画更自然细腻'],
        ['优化网络连接与错误重试，播放体验更稳定'],
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
        <div style="font-size:12px;color:var(--text-secondary);">2026.07.28 在线自动更新与系统重构</div>
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
