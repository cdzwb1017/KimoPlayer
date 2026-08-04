// ═══════════════════════════════════════════════════════════════
// Audio Quality & Bitrate Badge Utility
// 音质与比特率标签生成与归一化解析工具
// ═══════════════════════════════════════════════════════════════

/**
 * 解析歌曲的音质和比特率元数据
 * @param {Object} song - 歌曲对象
 * @returns {Object} { format, quality, bitrateText, isHiRes, isLossless }
 */
export function getAudioQualityInfo(song) {
  if (!song) return { format: '', quality: '', bitrateText: '', isHiRes: false, isLossless: false };

  const path = song.file_path || song.url || song.path || '';
  // 提取扩展名：取路径最后一段的最后一点之后的部分；
  // 无有效扩展名（如 luna://{id} 或目录名含点）时回退 song.format 字段（LunaBeat 等来源）
  let ext = '';
  if (path) {
    // 兼容正/反斜杠路径（Windows 拖拽等场景 file_path 可能为反斜杠）
    const lastSeg = String(path).split(/[\\/]/).pop() || '';
    const dotIdx = lastSeg.lastIndexOf('.');
    if (dotIdx > 0) ext = lastSeg.slice(dotIdx + 1).toLowerCase();
  }
  if (!ext && song.format) ext = String(song.format).toLowerCase();

  let rawBitrate = song.bitrate || song.max_br || song.br || 0;
  // 智能矫正比特率：如果大于 5000，通常是 bps (如 320000 -> 320, 1411200 -> 1411)
  if (rawBitrate > 5000) {
    rawBitrate = Math.round(rawBitrate / 1000);
  } else if (rawBitrate > 0) {
    rawBitrate = Math.round(rawBitrate);
  }

  const sampleRate = song.sample_rate || song.sampleRate || 0;
  const bitDepth = song.bit_depth || song.bitDepth || 0;

  let quality = '';
  let format = ext ? ext.toUpperCase() : '';

  // 判断无损/Hi-Res 格式
  const isLosslessFormat = ['flac', 'wav', 'ape', 'alac', 'dsd', 'dsf'].includes(ext) || song.is_lossless || song.sq;
  const isHiRes = sampleRate >= 48000 || bitDepth > 16 || rawBitrate >= 2000 || song.hr || song.hires;

  if (isHiRes) {
    quality = 'Hi-Res';
  } else if (isLosslessFormat || rawBitrate >= 800) {
    quality = 'SQ';
  } else if (rawBitrate >= 256) {
    quality = 'HQ';
  } else if (rawBitrate >= 64) {
    quality = '标准';
  }

  // 统一输出码率文本 (Bitrate Text)，未显式读取到时依据格式级别进行补齐
  let bitrateText = '';
  if (rawBitrate >= 64) {
    bitrateText = `${rawBitrate}k`;
  } else if (isHiRes) {
    bitrateText = '2304k';
  } else if (isLosslessFormat || quality === 'SQ') {
    bitrateText = '1411k';
  } else if (quality === 'HQ') {
    bitrateText = '320k';
  } else if (rawBitrate > 0) {
    bitrateText = '128k';
  }

  return { format, quality, bitrateText, isHiRes, isLossless: isLosslessFormat || quality === 'SQ' };
}

/**
 * 渲染音质与比特率的 HTML 标签字符串 (支持独立配置开关控制与区域特化)
 * @param {Object} song 
 * @param {Object} options - { hideBitrate: boolean }
 * @returns {string} HTML 字符串
 */
export function renderAudioQualityBadgesHtml(song, options = {}) {
  const showQuality = localStorage.getItem('kimo-show-quality-badge') !== 'false';
  const showBitrate = options.hideBitrate ? false : (localStorage.getItem('kimo-show-bitrate-badge') !== 'false');

  if (!showQuality && !showBitrate) return '';

  const info = getAudioQualityInfo(song);
  let html = '';

  if (showQuality) {
    if (info.quality === 'Hi-Res') {
      html += `<span class="audio-badge badge-hires" title="Hi-Res 高解析度无损">Hi-Res</span>`;
    } else if (info.quality === 'SQ') {
      html += `<span class="audio-badge badge-sq" title="SQ 超高无损音质">SQ</span>`;
    } else if (info.quality === 'HQ') {
      html += `<span class="audio-badge badge-hq" title="HQ 高品质">HQ</span>`;
    }
  }

  if (showBitrate && info.bitrateText) {
    html += `<span class="audio-badge badge-bitrate">${info.bitrateText}</span>`;
  }

  return html ? `<div class="song-audio-badges">${html}</div>` : '';
}

/**
 * 渲染包含歌手名字 (受挤压保护) 与独立音质微标的组合 HTML 字符串
 * @param {string} artist 歌手名称
 * @param {Object} song 歌曲对象
 * @param {Object} options - { hideBitrate: boolean }
 * @returns {string} HTML 字符串
 */
const escapeHtml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function renderArtistWithBadgesHtml(artist, song, options = {}) {
  const safeArtist = escapeHtml(artist || '未知歌手');
  const badgesHtml = renderAudioQualityBadgesHtml(song, options);
  return `<span class="artist-name-text" title="${safeArtist}">${safeArtist}</span>${badgesHtml}`;
}
