// ═══════════════════════════════════════════════════════════════
// 软件更新检测 — 支持正式版 / 测试版双通道
// ═══════════════════════════════════════════════════════════════

import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';

/* global __APP_VERSION__ — 由 Vite 从 package.json 注入，作为版本号唯一来源 */

const REPO = 'kiomosu/KimoPlayer';
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_VERSION = CURRENT_VERSION;
export const BETA_KEY = 'KimoBeta2026';

function isBetaUser() {
  return localStorage.getItem('kimo-beta-key') === BETA_KEY;
}

export function setBetaKey(key) {
  if (key === BETA_KEY) {
    localStorage.setItem('kimo-beta-key', key);
    return true;
  }
  return false;
}

export function getBetaStatus() {
  return isBetaUser();
}

function parseVersion(v) {
  // "1.4.6-beta01" → [1, 4, 6, "beta01"]
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) return [0, 0, 0, ''];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] || ''];
}

function isNewer(latest, current) {
  const [l1, l2, l3, lPre] = parseVersion(latest);
  const [c1, c2, c3, cPre] = parseVersion(current);

  if (l1 !== c1) return l1 > c1;
  if (l2 !== c2) return l2 > c2;
  if (l3 !== c3) return l3 > c3;

  // 同版本号时，正式版 > 测试版
  if (!lPre && cPre) return true;  // 正式版 > 测试版
  if (lPre && !cPre) return false; // 测试版 < 正式版

  return false;
}

/**
 * 轻量 Markdown → HTML 渲染器（专为更新公告设计）
 * 支持: ## 标题, - 列表, **粗体**, --- 分割线, 段落
 */
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // 分割线
    if (/^-{3,}$/.test(trimmed)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<hr style="border:none;border-top:1px solid rgba(128,128,128,0.15);margin:10px 0;">';
      continue;
    }

    // 标题 ## / ###
    const hMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    if (hMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:12px 0 4px;">${hMatch[1]}</div>`;
      continue;
    }

    // 一级标题 #
    const h1Match = trimmed.match(/^#\s+(.+)/);
    if (h1Match) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin:12px 0 4px;">${h1Match[1]}</div>`;
      continue;
    }

    // 列表项 - / *
    const liMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (liMatch) {
      if (!inList) { html += '<ul style="margin:0;padding-left:16px;">'; inList = true; }
      html += `<li style="margin-bottom:3px;">${liMatch[1]}</li>`;
      continue;
    }

    // 普通段落
    if (inList) { html += '</ul>'; inList = false; }
    html += `<div style="margin-bottom:4px;">${trimmed}</div>`;
  }

  if (inList) html += '</ul>';

  // 粗体 **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 行内代码 `code`
  html = html.replace(/`(.+?)`/g, '<code style="background:rgba(128,128,128,0.12);padding:1px 4px;border-radius:3px;font-size:11px;">$1</code>');

  return html;
}

/**
 * 从 release assets 中选择最佳安装包：
 * 1. 优先 NSIS 正规安装版（-setup.exe / -installer.exe）
 * 2. 其次任何非便携标记的 .exe（排除 -safe / -ultra）
 * 3. 找不到则返回 null（前端回退到浏览器打开 release 页面）
 */
function pickInstallerAsset(assets) {
  // 1. NSIS 安装包（命名约定 -setup.exe 或 -installer.exe）
  let asset = assets.find(a =>
    a.name.endsWith('.exe') &&
    (a.name.includes('-setup') || a.name.includes('-installer'))
  );
  if (asset) return asset;

  // 2. 非 portable 的 .exe（排除 safe / ultra 便携变体）
  asset = assets.find(a =>
    a.name.endsWith('.exe') &&
    !a.name.includes('safe') &&
    !a.name.includes('ultra') &&
    !a.name.includes('portable')
  );
  if (asset) return asset;

  // 3. 无可用安装包
  return null;
}

export async function checkForUpdates(showNotification = true) {
  const resp = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!resp.ok) throw new Error(`GitHub API 返回 ${resp.status}`);
  const releases = await resp.json();

  let candidates = releases;

  if (!isBetaUser()) {
    // 正式版用户：只看稳定版本
    candidates = releases.filter(r => !r.prerelease);
  }
  // 测试版用户：看所有版本（包括 pre-release）

  if (candidates.length === 0) return null;

  // 按版本号降序排序，确保取到真正的最新版（GitHub API 默认按创建时间排序，不可靠）
  candidates.sort((a, b) => {
    const va = parseVersion(a.tag_name.replace(/^v/, ''));
    const vb = parseVersion(b.tag_name.replace(/^v/, ''));
    for (let i = 0; i < 4; i++) {
      const ta = typeof va[i] === 'string' ? va[i] : String(va[i]);
      const tb = typeof vb[i] === 'string' ? vb[i] : String(vb[i]);
      if (ta !== tb) return tb.localeCompare(ta, undefined, { numeric: true });
    }
    return 0;
  });

  const latest = candidates[0];
  const latestVersion = latest.tag_name.replace(/^v/, '');

  if (isNewer(latestVersion, CURRENT_VERSION)) {
    // 找到更新
    const updateInfo = {
      version: latestVersion,
      name: latest.name || latest.tag_name,
      body: latest.body || '',
      url: latest.html_url,
      publishedAt: latest.published_at,
      isPreRelease: latest.prerelease,
      assets: (latest.assets || []).map(a => ({
        name: a.name,
        size: a.size,
        downloadUrl: a.browser_download_url,
      })),
    };

    if (showNotification) {
      showUpdateNotification(updateInfo);
    }

    return updateInfo;
  }

  return null; // 已是最新版本
}

function showUpdateNotification(info) {
  const overlay = document.createElement('div');
  overlay.className = 'kimo-modal-overlay';
  overlay.innerHTML = `
    <div class="kimo-modal-card" style="max-width:420px;width:92%;padding:0;text-align:left;overflow:hidden;">
      <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">
          发现新版本
          ${info.isPreRelease ? '<span style="font-size:11px;background:rgba(var(--dynamic-color,0,240,255),0.15);color:rgb(var(--dynamic-color,0,240,255));padding:2px 8px;border-radius:10px;margin-left:8px;">测试版</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);">v${info.version} · ${new Date(info.publishedAt).toLocaleDateString('zh-CN')}</div>
      </div>
      ${info.body ? `<div style="padding:16px 24px;font-size:12px;color:var(--text-secondary);line-height:1.6;max-height:240px;overflow-y:auto;">${renderMarkdown(info.body.slice(0, 800))}</div>` : ''}
      <div id="update-actions" style="padding:14px 24px 20px;display:flex;gap:10px;">
        <button id="update-ok-btn" style="flex:1;padding:10px;font-size:14px;font-weight:600;border:none;border-radius:8px;background:rgb(var(--dynamic-color,16,185,129));color:#fff;cursor:pointer;">下载并安装</button>
        <button id="update-later-btn" style="flex:1;padding:10px;font-size:14px;font-weight:600;border:1px solid var(--glass-border);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;">稍后再说</button>
      </div>
      <div id="update-progress" style="display:none;padding:18px 24px 20px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
          <div id="update-spinner" style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.15);border-top-color:rgb(var(--dynamic-color,16,185,129));border-radius:50%;animation:kimo-update-spin 0.8s linear infinite;"></div>
          <div id="update-progress-text" style="font-size:13px;font-weight:600;color:var(--text-primary);">正在下载... 0%</div>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
          <div id="update-progress-bar" style="height:100%;width:0%;background:rgb(var(--dynamic-color,16,185,129));transition:width 0.3s ease;border-radius:3px;"></div>
        </div>
        <div id="update-progress-detail" style="font-size:11px;color:var(--text-tertiary);margin-top:8px;text-align:center;">0.0 / 0.0 MB</div>
      </div>
    </div>
    <style>@keyframes kimo-update-spin{to{transform:rotate(360deg)}}</style>
  `;

  document.body.appendChild(overlay);

  // 选择 NSIS 安装包，而非便携版
  const installerAsset = pickInstallerAsset(info.assets);
  const downloadUrl = installerAsset ? installerAsset.downloadUrl : null;

  // 下载进度事件监听器（后端 emit "update-download-progress"）
  let progressUnlisten = null;

  overlay.querySelector('#update-ok-btn').addEventListener('click', async () => {
    if (!downloadUrl) {
      // 无安装包，回退到浏览器打开 release 页面
      openUrl(info.url).catch(() => { window.open(info.url, '_blank'); });
      overlay.remove();
      return;
    }

    // 切换到下载状态：隐藏按钮，显示进度
    const actionsDiv = overlay.querySelector('#update-actions');
    const progressDiv = overlay.querySelector('#update-progress');
    const progressBar = overlay.querySelector('#update-progress-bar');
    const progressText = overlay.querySelector('#update-progress-text');
    const progressDetail = overlay.querySelector('#update-progress-detail');

    actionsDiv.style.display = 'none';
    progressDiv.style.display = 'block';

    // 监听下载进度
    if (progressUnlisten) progressUnlisten();
    progressUnlisten = await listen('update-download-progress', (event) => {
      const { downloaded, total, percent } = event.payload;
      progressBar.style.width = percent + '%';
      const downloadedMB = (downloaded / 1048576).toFixed(1);
      const totalMB = (total / 1048576).toFixed(1);
      progressText.textContent = `正在下载... ${percent.toFixed(0)}%`;
      progressDetail.textContent = `${downloadedMB} / ${totalMB} MB`;
    });

    try {
      await invoke('download_and_install_update', { url: downloadUrl });
      // 下载完成，切换到安装状态
      progressBar.style.width = '100%';
      progressText.textContent = '下载完成，正在安装...';
      progressDetail.textContent = '应用即将关闭并启动安装程序';
    } catch (err) {
      console.error('[UpdateChecker] Download failed:', err);
      // 切换回按钮状态，显示重试
      progressDiv.style.display = 'none';
      actionsDiv.style.display = 'flex';
      const btn = overlay.querySelector('#update-ok-btn');
      btn.textContent = '重试下载';
      // 显示错误提示
      let errTip = overlay.querySelector('#update-error-tip');
      if (!errTip) {
        errTip = document.createElement('div');
        errTip.id = 'update-error-tip';
        errTip.style.cssText = 'padding:0 24px 0;font-size:11px;color:#f87171;margin-bottom:8px;';
        actionsDiv.parentNode.insertBefore(errTip, actionsDiv);
      }
      errTip.textContent = '下载失败: ' + err;
    }
  });

  // 清理事件监听器
  const cleanup = () => {
    if (progressUnlisten) {
      progressUnlisten();
      progressUnlisten = null;
    }
  };

  overlay.querySelector('#update-later-btn').addEventListener('click', () => {
    cleanup();
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanup();
      overlay.remove();
    }
  });
}

// 启动时检查更新（延迟 3 秒，不阻塞启动）
export function startupUpdateCheck() {
  setTimeout(() => {
    checkForUpdates(true).catch(() => {});
  }, 3000);
}
