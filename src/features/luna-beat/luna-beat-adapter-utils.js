/**
 * LunaBeat 适配器工具函数
 * 管理全局适配器实例，并提供给 playback-controller 使用的播放方法
 */

import { applyDynamicColor, getColorOptions } from '../../ui/theme.js';
import { extractDominantColor } from '../../utils/color.js';

let _adapter = null;

/** 获取全局 LunaBeat 适配器实例 */
export async function getLunaBeatAdapter() {
  if (window.__lunaBeatAdapter) return window.__lunaBeatAdapter;
  if (_adapter) return _adapter;

  // 动态 import 避免循环依赖
  const { LunaBeatAdapter } = await import('./luna-beat-adapter.js');
  const cfg = LunaBeatAdapter.loadConfig();
  if (!cfg.baseUrl) return null;

  _adapter = new LunaBeatAdapter(cfg.baseUrl);
  if (cfg.pinCode) {
    try { await _adapter.authenticate(cfg.pinCode); } catch (e) {}
  }
  window.__lunaBeatAdapter = _adapter;
  return _adapter;
}

/** 重置适配器（设置变更或断开时调用） */
export function resetLunaBeatAdapter() {
  if (window.__lunaBeatAdapter) {
    try { window.__lunaBeatAdapter.dispose(); } catch (e) {}
    window.__lunaBeatAdapter = null;
  }
  if (_adapter) {
    try { _adapter.dispose(); } catch (e) {}
    _adapter = null;
  }
}

/**
 * 创建独立的 LunaBeat 下载进度指示器（不复用播放进度条，避免语义混用）
 * 覆盖在 progress-track 上方，带轻微透明分层与流动动画
 * @returns {{el: HTMLElement, setProgress: (pct:number)=>void, remove: ()=>void}}
 */
function createDownloadIndicator() {
  const track = document.getElementById('main-progress-track');
  if (!track) return null;

  const el = document.createElement('div');
  el.className = 'luna-download-indicator';
  el.innerHTML = `
    <div class="luna-download-shimmer"></div>
    <div class="luna-download-fill"></div>
    <span class="luna-download-text">正在加载局域网音频…</span>
  `;
  track.appendChild(el);

  return {
    el,
    setProgress(pct) {
      const fill = el.querySelector('.luna-download-fill');
      if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    },
    remove() {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
}

/**
 * 统一处理封面加载与动态颜色刷新（避免多入口重复触发）
 * 大封面场景统一请求 1440px，用于：沉浸歌词页封面、播放条封面、动态毛玻璃取色
 * @param {object} adapter LunaBeatAdapter 实例
 * @param {object} song 歌曲对象
 */
function applyCoverAndColor(adapter, song) {
  if (!song._lunaId) return;
  let COVER_SIZE_LARGE = 1440;
  try {
    // 动态 import 避免顶部循环依赖
    import('./luna-beat-adapter.js').then(m => {
      if (m && m.COVER_SIZE_LARGE) COVER_SIZE_LARGE = m.COVER_SIZE_LARGE;
    }).catch(() => {});
  } catch (_) {}
  adapter.getCoverBlobUrl(song, COVER_SIZE_LARGE).then(url => {
    if (!url) return;
    song.cover_image = url;
    const coverEl = document.getElementById('current-cover');
    if (coverEl) coverEl.src = url;
    const largeCover = document.getElementById('lyrics-large-cover');
    if (largeCover) largeCover.src = url;

    // 提取封面色彩并刷新全应用动态毛玻璃背景
    extractDominantColor(url, getColorOptions ? getColorOptions() : undefined).then(color => {
      song.dominant_color = color;
      applyDynamicColor(color.r, color.g, color.b, url);
    }).catch(() => {
      applyDynamicColor(120, 120, 120, url);
    });
  }).catch(() => {});
}

/**
 * 播放 LunaBeat 局域网歌曲（统一音频代理与封面/色彩处理）
 * @param {object} player kiomPlayer PlaybackController 实例
 * @param {object} song LunaBeat 歌曲对象（_source === 'luna'）
 */
export async function playLunaBeatSong(player, song) {
  if (!song || song._source !== 'luna') {
    console.error('[LunaBeat] 不是 LunaBeat 歌曲');
    return;
  }

  const adapter = await getLunaBeatAdapter();
  if (!adapter) {
    return;
  }

  // 标记当前播放歌曲，LRU 淘汰时保护其音频 blob 不被释放
  adapter.pinAudioId(song._lunaId);

  // 1. 异步非阻塞预取封面 blob URL，并更新全应用动态毛玻璃背景（统一入口，避免重复触发）
  applyCoverAndColor(adapter, song);

  // 2. 本地 HTTP 分段 Range 代理流式开播（极速响应，支持 Range 拖动 Seeking，免全量等待）
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const proxyPort = await invoke('get_luna_proxy_port');
    const targetAudioUrl = adapter.getAudioUrl(song._lunaId);

    if (proxyPort && targetAudioUrl) {
      const streamProxyUrl = `http://127.0.0.1:${proxyPort}/stream?url=${encodeURIComponent(targetAudioUrl)}`;
      player.audio.pause();
      player.audio.src = streamProxyUrl;
      await player.audio.play();
      return;
    }
  } catch (err) {
    console.warn('[LunaBeat] 本地代理流式播放失败，尝试降级为全量下载:', err);
  }

  // 3. 降级逻辑：若本地代理通道建立失败，再通过 Rust 代理 Blob 全量下载
  // 使用独立的下载指示器，不复用播放进度条，避免与播放位置语义混用
  const indicator = createDownloadIndicator();

  try {
    const blobUrl = await adapter.fetchAudioBlob(song._lunaId, song, (loaded, total) => {
      if (total > 0 && indicator) {
        indicator.setProgress((loaded / total) * 100);
      }
    });

    if (indicator) indicator.remove();

    player.audio.pause();
    player.audio.src = blobUrl;
    player.audio.load();
    await player.audio.play();
  } catch (e) {
    console.error('[LunaBeat] 播放失败:', e);
    if (indicator) indicator.remove();
    throw e;
  }
}

/**
 * 加载 LunaBeat 歌词
 * @param {object} song LunaBeat 歌曲
 * @returns {Promise<Array|null>} kimoPlayer 格式的歌词行数组
 */
export async function loadLunaBeatLyrics(song) {
  if (!song || song._source !== 'luna') return null;
  const adapter = await getLunaBeatAdapter();
  if (!adapter) return null;
  try {
    return await adapter.fetchLyrics(song._lunaId);
  } catch (e) {
    console.error('[LunaBeat] 歌词加载失败:', e);
    return null;
  }
}
