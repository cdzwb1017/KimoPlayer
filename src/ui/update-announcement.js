import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '📂 系统文件关联，双击即播',
      items: [
        ['安装后在操作系统中双击音频文件，直接用 KiomPlayer 打开播放'],
        ['支持 mp3、flac、wav、ogg、m4a、aac、wma、opus、ape、aiff 共 10 种格式'],
        ['应用已运行时自动追加到播放列表，未运行时启动后自动加载'],
      ],
    },
    {
      title: '🌌 背景样式与 UI 风格体系',
      items: [
        ['新增三种背景模式：去除背景、静态背景、动态背景（可调旋转速率）'],
        ['四种 UI 风格：默认效果、亚克力、高斯模糊、液态玻璃，按视觉复杂度递增'],
        ['评论区、右键菜单、Toast 提示全面适配四种 UI 风格'],
      ],
    },
    {
      title: '🎛️ 歌词弹出框重新设计',
      items: [
        ['滑块弹出框改为现代玻璃胶囊风格，跟随歌词页面主题自动切换深浅色'],
        ['滑块轨道新增进度填充效果，已调节部分以动态主题色高亮'],
        ['所有滑块统一支持鼠标滚轮调整，修复字号与抬起幅度上限不匹配的问题'],
      ],
    },
    {
      title: '🔧 体验优化与修复',
      items: [
        ['设置页 GitHub 仓库链接、更新检查器、评论区图片跳转修复，改用系统浏览器打开'],
        ['历史更新记录新增 1.5.1 和 1.5.0 版本条目'],
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
        <div style="font-size:12px;color:var(--text-secondary);">2026.07.29 系统文件关联与 UI 风格体系</div>
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
