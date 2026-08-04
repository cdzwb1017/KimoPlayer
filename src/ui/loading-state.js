/**
 * 精致的加载占位组件（局域网连接 / 页面初始化等场景）
 * 视觉：旋转轨道 + 脉冲 Wi-Fi 图标 + 主/副文案
 * 样式定义在 src/styles/player-bar.css 的「LunaBeat 加载占位」区块。
 */

// 转义文案，防止未来传入外部数据（如设备名）时成为 XSS 面
const escapeHtml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * 渲染加载占位到容器
 * @param {HTMLElement|null} container - 挂载容器（通常是 #music-list）
 * @param {object} opts
 * @param {string} opts.title - 主文案，如「正在连接 LunaBeat 服务…」
 * @param {string} [opts.sub] - 副文案说明（可空）
 * @param {string} [opts.icon] - 图标变体，'wifi'（默认）| 'music'
 */
export function renderLoadingPlaceholder(container, { title, sub = '', icon = 'wifi' }) {
  if (!container) return;
  const iconSvg = icon === 'music'
    ? '<svg class="luna-loading-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
    : '<svg class="luna-loading-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  const titleHtml = escapeHtml(title);
  const subHtml = sub ? escapeHtml(sub) : '';
  container.innerHTML = `
    <div class="luna-loading-state">
      <div class="luna-loading-visual">
        <span class="luna-loading-ring ring-1"></span>
        <span class="luna-loading-ring ring-2"></span>
        ${iconSvg}
      </div>
      <div class="luna-loading-title">${titleHtml}</div>
      ${subHtml ? `<div class="luna-loading-sub">${subHtml}</div>` : ''}
    </div>
  `;
}
