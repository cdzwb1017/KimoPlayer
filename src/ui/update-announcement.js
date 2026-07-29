import { APP_VERSION } from './update-checker.js';

// 版本号唯一来源：package.json → Vite __APP_VERSION__ → update-checker.js APP_VERSION
const UPDATE_SEEN_KEY = `kimo-update-seen-${APP_VERSION}`;

export function showStartupUpdateAnnouncement() {
  if (localStorage.getItem(UPDATE_SEEN_KEY) === 'true') return;

  const sections = [
    {
      title: '🎵 歌词解析全面升级',
      items: [
        ['逐字 LRC 与 TTML 统一为明确的行、单元时间模型，相邻单元无缝衔接'],
        ['修复英文空格、单字母、末尾单词染色及编辑预览不一致问题'],
        ['完善翻译、共唱与 TTML 背景人声解析'],
      ],
    },
    {
      title: '✨ 共唱与歌词动效',
      items: [
        ['正确区分真正重叠与首尾相接的歌词，修复共唱滚动抽搐'],
        ['背景人声在主句下方独立展开并原位收起'],
        ['缩放还原与上移同步，快速歌词自动缩短切换动画'],
      ],
    },
    {
      title: '📝 元数据编辑器焕新',
      items: [
        ['重新设计歌曲信息与歌词编辑窗口，适配主题和 UI 材质'],
        ['完整展示逐字时间、翻译、声道与背景人声'],
      ],
    },
    {
      title: '🛠️ 交互与更新修复',
      items: [
        ['歌词滑块浮层全区域支持滚轮，抬起幅度上限调整为 5px'],
        ['播放列表、侧边栏选中滑块与三枚页面悬浮按钮完整适配四套 UI 材质'],
        ['修复应用内更新后不自动重启以及任务栏保留旧图标的问题'],
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
        <div style="font-size:12px;color:var(--text-secondary);">2026.07.30 歌词引擎与编辑器升级</div>
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
