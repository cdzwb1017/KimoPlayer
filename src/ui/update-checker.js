// ═══════════════════════════════════════════════════════════════
// 软件更新检测 — 支持正式版 / 测试版双通道
// ═══════════════════════════════════════════════════════════════

const REPO = 'kiomosu/KimoPlayer';
const CURRENT_VERSION = '1.4.6-beta01';
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

export async function checkForUpdates(showNotification = true) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const releases = await resp.json();

    let candidates = releases;

    if (!isBetaUser()) {
      // 正式版用户：只看稳定版本
      candidates = releases.filter(r => !r.prerelease);
    }
    // 测试版用户：看所有版本（包括 pre-release）

    if (candidates.length === 0) return null;

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
  } catch (err) {
    console.error('[UpdateChecker] Failed to check updates:', err);
    return null;
  }
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
      ${info.body ? `<div style="padding:16px 24px;font-size:12px;color:var(--text-secondary);line-height:1.6;max-height:200px;overflow-y:auto;white-space:pre-wrap;">${info.body.slice(0, 500)}</div>` : ''}
      <div style="padding:14px 24px 20px;display:flex;gap:10px;">
        <button id="update-ok-btn" style="flex:1;padding:10px;font-size:14px;font-weight:600;border:none;border-radius:8px;background:rgb(var(--dynamic-color,16,185,129));color:#fff;cursor:pointer;">前往下载</button>
        <button id="update-later-btn" style="flex:1;padding:10px;font-size:14px;font-weight:600;border:1px solid var(--glass-border);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;">稍后再说</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#update-ok-btn').addEventListener('click', () => {
    window.open(info.url, '_blank');
    overlay.remove();
  });

  overlay.querySelector('#update-later-btn').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// 启动时检查更新（延迟 3 秒，不阻塞启动）
export function startupUpdateCheck() {
  setTimeout(() => {
    checkForUpdates(true);
  }, 3000);
}
