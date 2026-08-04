import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}-final`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '🎤 桌面歌词优化',
      items: [
        ['色彩自由定义：新增歌词颜色自定义功能，现在您可以分别设置“已唱”与“未唱”歌词的专属色彩'],
        ['多行对齐模式：新增单行/双行模式自由无缝切换，双行模式现已支持“左对齐”与“交叉对齐”'],
        ['双行平滑过渡：彻底修复了双行模式下，第二句歌词在等待开唱时出现的左右高频抖动问题'],
        ['纯净沉浸展示：移除了超长歌词的自动左右摇摆滚动效果，文本将始终保持静止并居中对齐'],
      ],
    },
    {
      title: '🎨 界面与系统焕新',
      items: [
        ['全新托盘界面：重新设计了系统托盘菜单，不仅颜值大幅提升，功能交互也更加直观实用'],
        ['专属文件图标：在系统级全局实装全新设计的 Windows 音频文件关联图标（支持 12 种主流格式）'],
        ['个性字体管理：全新上线字体管理中心，可一键下载应用内推荐字体，也支持安装新的自定义字体'],
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
          <span>2026.08.05</span>
          <span style="width:3px;height:3px;border-radius:50%;background:currentColor;opacity:0.45;"></span>
          <span style="padding:2px 7px;border-radius:999px;background:rgba(var(--dynamic-color,0,180,230),0.1);color:rgb(var(--dynamic-color,0,180,230));font-weight:600;">正式版</span>
          <span>体验打磨</span>
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
