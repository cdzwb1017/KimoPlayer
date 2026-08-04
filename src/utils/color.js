function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const channel = Math.round(l * 255);
    return { r: channel, g: channel, b: channel };
  }

  const hueToRgb = (p, q, value) => {
    let t = value;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * 根据取色模式调整颜色的亮度
 * @param {number} r - Red 0-255
 * @param {number} g - Green 0-255
 * @param {number} b - Blue 0-255
 * @param {object} options - { mode: 'smart'|'manual', intensity: -50~50, theme: 'light'|'dark' }
 * @returns {{r,g,b}}
 */
function adjustColorByMode(r, g, b, options = {}) {
  const hsl = rgbToHsl(r, g, b);
  const mode = options.mode || 'smart';
  const intensity = options.intensity || 0; // -50 (偏深) ~ +50 (偏浅)
  const theme = options.theme || 'dark';

  // 饱和度增强（保持鲜艳）
  hsl.s = Math.max(50, Math.min(100, hsl.s * 1.35));

  if (mode === 'smart') {
    // 智能模式：根据主题自动适配亮度，保证可读性
    // 深色主题：取色偏亮（l: 45-65），在暗背景上更醒目
    // 浅色主题：取色偏深（l: 35-55），在亮背景上更清晰
    if (theme === 'light') {
      hsl.l = Math.max(35, Math.min(55, hsl.l));
    } else {
      hsl.l = Math.max(45, Math.min(65, hsl.l));
    }
  } else {
    // 手动模式：以 50 为中心，intensity 正值偏浅，负值偏深
    const targetL = 50 + intensity * 0.3; // -50→35, 0→50, +50→65
    hsl.l = Math.max(20, Math.min(80, targetL));
  }

  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

export function extractDominantColor(imgSrc, options = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    // 只有非 blob: 与非 data: 类型的远程 URL 才需要加 crossOrigin = 'anonymous'，避免 blob / data URI 触发 CORS 安全拦截导致 onerror
    if (typeof imgSrc === 'string' && !imgSrc.startsWith('blob:') && !imgSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 50;
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext('2d');
      if (!context) {
        resolve({ r: 40, g: 40, b: 60 });
        return;
      }

      context.drawImage(img, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let index = 0; index < data.length; index += 16) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const brightness = (red + green + blue) / 3;

        if (brightness > 30 && brightness < 230) {
          r += red;
          g += green;
          b += blue;
          count += 1;
        }
      }

      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
      } else {
        r = 40;
        g = 40;
        b = 60;
      }

      // 取色关闭时（options 为 null）返回原始颜色，不做亮度调整
      if (!options) {
        resolve({ r, g, b });
      } else {
        // 缓存原始提取颜色，供设置页实时预览重新调整时使用
        try {
          localStorage.setItem('kimo-last-raw-color', `${r},${g},${b}`);
        } catch (_) {}
        resolve(adjustColorByMode(r, g, b, options));
      }
    };

    img.onerror = () => resolve({ r: 40, g: 40, b: 60 });
    img.src = imgSrc;
  });
}

/**
 * 读取取色设置
 * @returns {{enabled: boolean, mode: 'smart'|'manual', intensity: number}}
 */
export function getColorExtractionSettings() {
  const enabled = localStorage.getItem('kimo-color-extraction') !== 'off'; // 默认开启
  const mode = localStorage.getItem('kimo-color-mode') || 'smart'; // 'smart' | 'manual'
  const intensity = parseInt(localStorage.getItem('kimo-color-intensity'), 10) || 0; // -50 ~ 50
  return { enabled, mode, intensity };
}

/**
 * 对已有 RGB 颜色重新应用取色模式调整（无需重新提取）
 * 用于设置页调整滑块时实时预览
 */
export function readjustColor(r, g, b, options = {}) {
  return adjustColorByMode(r, g, b, options);
}
