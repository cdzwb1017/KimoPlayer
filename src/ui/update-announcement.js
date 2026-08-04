import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '🎨 界面',
      items: [
        ['字体系统重构：字体下拉直接显示字体名称（思源黑体（默认）等）'],
        ['新增字体管理弹窗：可添加/删除自选字体，内置字体锁定'],
        ['新增推荐字体应用内下载（霞鹜文楷、得意黑），带实时进度'],
      ],
    },
    {
      title: '⚡ 性能',
      items: [
        ['音频格式图标体积压缩 95%，列表加载与滚动更流畅'],
      ],
    },
    {
      title: '🛠️ 其他',
      items: [
        ['修复启动时偶尔自动弹出开发者工具窗口的问题'],
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
      <div style="padding:22px 24px 18px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(var(--dynamic-color,0,180,230),0.12),transparent 62%);">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgb(var(--dynamic-color,0,180,230));margin-bottom:8px;">版本更新</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:9px;">
          <div style="font-size:25px;line-height:1.1;font-weight:800;letter-spacing:-0.035em;color:var(--text-primary);">KimoPlayer</div>
          <div style="font-size:17px;line-height:1;font-weight:800;padding:6px 10px;border-radius:99px;background:rgb(var(--dynamic-color,0,180,230));color:#fff;box-shadow:0 6px 18px rgba(var(--dynamic-color,0,180,230),0.22);">v${APP_VERSION}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);">
          <span>2026.08.02</span>
          <span style="width:3px;height:3px;border-radius:50%;background:currentColor;opacity:0.45;"></span>
          <span style="padding:2px 7px;border-radius:999px;background:rgba(var(--dynamic-color,0,180,230),0.1);color:rgb(var(--dynamic-color,0,180,230));font-weight:600;">正式版</span>
          <span>歌词渲染同源对齐与设置交互修复</span>
        </div>
      </div>
      <div style="padding:18px 24px 4px;max-height:min(58vh,470px);overflow-y:auto;">${sectionsHTML}</div>
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
