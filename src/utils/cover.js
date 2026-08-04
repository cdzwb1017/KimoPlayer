import { convertFileSrc } from '@tauri-apps/api/core';
import { getLunaCoverBlob } from '../storage/luna-cover-cache.js';

// 音频格式图标映射
const FORMAT_ICONS = {
  mp3: '/audio-icons/mp3.png',
  flac: '/audio-icons/flac.png',
  wav: '/audio-icons/wav.png',
  ogg: '/audio-icons/ogg.png',
  m4a: '/audio-icons/m4a.png',
  aac: '/audio-icons/aac.png',
  wma: '/audio-icons/wma.png',
  opus: '/audio-icons/opus.png',
  ape: '/audio-icons/ape.png',
  aiff: '/audio-icons/aiff.png',
  // 额外支持的格式（预留）
  alac: '/audio-icons/alac.png',
  dts: '/audio-icons/dts.png',
  amr: '/audio-icons/amr.png',
  dd: '/audio-icons/dd.png',
  ac3: '/audio-icons/dd.png'
};

// 默认图标（未知格式时使用MP3图标作为通用图标）
const DEFAULT_AUDIO_ICON = '/audio-icons/mp3.png';

// 尺寸常量（与 luna-beat-adapter.js 对齐，避免循环依赖）
const _COVER_SIZE_SMALL = 480;
const _COVER_SIZE_LARGE = 1440;

/**
 * 从文件路径提取音频格式（小写扩展名）
 */
function getAudioFormat(filePath) {
  if (!filePath) return null;
  const match = filePath.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

/**
 * 获取格式对应的图标路径，无匹配时返回默认图标
 */
function getFormatIcon(filePath) {
  const fmt = getAudioFormat(filePath);
  if (fmt && FORMAT_ICONS[fmt]) {
    return FORMAT_ICONS[fmt];
  }
  return DEFAULT_AUDIO_ICON;
}

/** 适配新的分区缓存 key：`${lunaId}::${size}` */
function _getCachedLunaCover(adapter, lunaId, preferLarge = true) {
  if (!adapter || !adapter._coverUrlCache) return null;
  const cache = adapter._coverUrlCache;
  const largeKey = `${lunaId}::${_COVER_SIZE_LARGE}`;
  const smallKey = `${lunaId}::${_COVER_SIZE_SMALL}`;
  if (preferLarge && cache.has(largeKey)) return cache.get(largeKey);
  if (cache.has(smallKey)) return cache.get(smallKey);
  if (!preferLarge && cache.has(largeKey)) return cache.get(largeKey);
  return null;
}

/**
 * 内部实现：获取封面图片URL
 * @param {string|null} coverImage - 封面图片路径或URL
 * @param {string} [filePath] - 音频文件路径（用于无封面时显示格式图标）
 */
function _getCoverSrcImpl(coverImage, filePath) {
  // 没有封面时返回对应格式的图标
  if (!coverImage) {
    return getFormatIcon(filePath);
  }
  
  if (coverImage.startsWith('data:') || coverImage.startsWith('blob:')) {
    // 存量统计记录可能存了会话级 blob URL（重启后失效）：
    // 若歌曲是 luna 歌曲，不直接返回失效 URL，改走 luna 恢复链路
    if (filePath && filePath.startsWith('luna://')) {
      const lunaId = filePath.replace('luna://', '');
      if (window.__lunaBeatAdapter) {
        const cached = _getCachedLunaCover(window.__lunaBeatAdapter, lunaId, true);
        if (cached) return cached;
      }
      restoreLunaCoverAsync(lunaId, filePath);
      return getFormatIcon(filePath);
    }
    return coverImage;
  }

  // ⭐ 从 LunaBeat 全局单例缓存中提取 Blob URL ⭐
  if (coverImage.includes('/api/cover/') || coverImage.startsWith('luna://')) {
    const match = coverImage.match(/\/api\/cover\/([\w-]+)/) || coverImage.match(/luna:\/\/([\w-]+)/);
    if (match && match[1]) {
      const lunaId = match[1];
      if (window.__lunaBeatAdapter) {
        const cached = _getCachedLunaCover(window.__lunaBeatAdapter, lunaId, true);
        if (cached) return cached;
      }
      // 内存未命中：优先从持久化缓存恢复（局域网离线也可显示），未命中再触发网络下载
      restoreLunaCoverAsync(lunaId, filePath);
    }
    // LunaBeat 封面未加载完成时，先显示格式图标
    return getFormatIcon(filePath);
  }

  // HTTP/HTTPS 直接使用
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) return coverImage;
  return convertFileSrc(coverImage);
}

/**
 * 异步恢复 LunaBeat 封面：
 * 1. 查 IndexedDB 持久化缓存（重启/离线场景），命中后生成 object URL 并更新对应 <img>；
 * 2. 未命中且 adapter 可用时，触发网络下载（默认 480 缩略图，保证首屏速度）。
 * 恢复成功后同时塞回内存缓存，避免重复创建 object URL。
 */
function restoreLunaCoverAsync(lunaId, filePath) {
  getLunaCoverBlob(lunaId)
    .then((blob) => {
      const adapter = window.__lunaBeatAdapter;
      const cachedUrl = adapter ? _getCachedLunaCover(adapter, lunaId, true) : null;
      if (cachedUrl) {
        // 并发恢复流程已把封面填入内存缓存：把该 URL 补到 <img>，避免一直停在格式图标
        document.querySelectorAll(`img[data-luna-id="${lunaId}"]`).forEach((img) => {
          if (!img.src.startsWith('blob:') && !img.src.startsWith('data:')) img.src = cachedUrl;
        });
        return;
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        if (adapter && adapter._coverUrlCache && !adapter._coverUrlCache.has(`${lunaId}::${_COVER_SIZE_SMALL}`)) {
          adapter._coverUrlCache.set(`${lunaId}::${_COVER_SIZE_SMALL}`, url);
        }
        document.querySelectorAll(`img[data-luna-id="${lunaId}"]`).forEach((img) => {
          img.src = url;
        });
        return;
      }
      if (window.__lunaBeatAdapter) {
        window.__lunaBeatAdapter.getCoverBlobUrl({ _lunaId: lunaId }, _COVER_SIZE_SMALL).then((blobUrl) => {
          if (blobUrl) {
            document.querySelectorAll(`img[data-luna-id="${lunaId}"]`).forEach((img) => {
              img.src = blobUrl;
            });
          }
        }).catch(() => {});
      }
    })
    .catch(() => {});
}

/**
 * 获取封面图片URL（增强版，支持多种调用方式）
 * 
 * 调用方式：
 * 1. getCoverSrc(song) - 传入歌曲对象，自动提取 cover_image 和 file_path
 * 2. getCoverSrc(coverImage, filePath) - 传入封面路径和可选的文件路径
 * 3. getCoverSrc(null) - 获取默认音频图标
 */
export function getCoverSrc(coverImageOrSong, filePath) {
  // 检测第一个参数是否是歌曲对象（具有 cover_image 属性）
  if (coverImageOrSong !== null && typeof coverImageOrSong === 'object' && !coverImageOrSong.startsWith) {
    const song = coverImageOrSong;
    return _getCoverSrcImpl(song.cover_image || null, song.file_path || filePath);
  }
  return _getCoverSrcImpl(coverImageOrSong, filePath);
}

/**
 * 批量获取歌曲的封面URL（自动传入file_path用于格式图标回退）
 */
export function getSongCoverSrc(song) {
  return getCoverSrc(song);
}
