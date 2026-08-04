/**
 * GlassOverlayMaterial —— 玻璃质感叠加层（无输入纯合成材质）。
 *
 * 架构定位：系统级底座（DWM 亚克力/云母，模糊窗口后真实内容）之上，
 * 应用内材质层叠加自定义质感——本材质不依赖任何输入像素：
 * tint（半透明着色）+ highlight（顶部高光）+ noise（噪点颗粒）。
 * 输出半透明，DWM 模糊透过可见。
 *
 * 参数（Schema 驱动）：
 * - opacity      叠加层整体透明度（0~1）
 * - tintColor    着色（CSS 颜色）
 * - tintAmount   着色强度（0~0.6）
 * - highlight    顶部内高光强度（0~1）
 * - noiseAmount  噪点强度（0~1）
 */
import { Material } from '../material/material.js';
import { Pass } from '../material/pass.js';

class TintPass extends Pass {
  constructor() {
    super('tint');
  }

  _render(rc, input, output, params) {
    const ctx = output.canvas.getContext('2d');
    const alpha = Math.max(0, Math.min(1, params.get('opacity')));
    const tintAlpha = Math.max(0, Math.min(0.6, params.get('tintAmount')));
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    ctx.globalAlpha = alpha * tintAlpha;
    ctx.fillStyle = params.get('tintColor');
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.globalAlpha = 1;
    output.version += 1;
  }
}

class HighlightPass extends Pass {
  constructor() {
    super('highlight');
  }

  _render(rc, input, output, params) {
    const ctx = output.canvas.getContext('2d');
    const strength = Math.max(0, Math.min(1, params.get('highlight')));
    const alpha = Math.max(0, Math.min(1, params.get('opacity')));
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    ctx.globalAlpha = 1;
    if (strength <= 0) {
      output.version += 1;
      return;
    }
    // 顶部内高光：25% 高度线性渐变（玻璃边缘光泽）
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(1, output.height * 0.25));
    grad.addColorStop(0, `rgba(255, 255, 255, ${(0.22 * strength).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, output.width, Math.max(1, output.height * 0.25));
    output.version += 1;
  }
}

class NoisePass extends Pass {
  constructor() {
    super('noise');
  }

  _render(rc, input, output, params) {
    const ctx = output.canvas.getContext('2d');
    const amount = Math.max(0, Math.min(1, params.get('noiseAmount')));
    const alpha = Math.max(0, Math.min(1, params.get('opacity')));
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    ctx.globalAlpha = 1;
    output.version += 1; // 先更新版本：amount<=0 提前返回也不破坏下游缓存链
    if (amount <= 0) return;
    // 噪点 tile：自身 createImageData 生成（永不 taint），平铺 + overlay 混合
    if (!this._noiseTile) {
      const size = 64;
      this._noiseTile = document.createElement('canvas');
      this._noiseTile.width = size;
      this._noiseTile.height = size;
      const nctx = this._noiseTile.getContext('2d');
      const imgData = nctx.createImageData(size, size);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 40;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      nctx.putImageData(imgData, 0, 0);
    }
    const pattern = ctx.createPattern(this._noiseTile, 'repeat');
    ctx.save();
    ctx.globalAlpha = Math.min(1, amount * 0.5 * alpha);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.restore();
  }
}

export class GlassOverlayMaterial extends Material {
  constructor() {
    super('glass-overlay', {
      opacity: { default: 0.5, min: 0, max: 1, step: 0.05, label: '叠加透明度' },
      tintColor: { default: 'rgba(10, 10, 13, 0.6)', label: '着色' },
      tintAmount: { default: 0.4, min: 0, max: 0.6, step: 0.02, label: '着色强度' },
      highlight: { default: 0.7, min: 0, max: 1, step: 0.05, label: '顶部高光' },
      noiseAmount: { default: 0.15, min: 0, max: 1, step: 0.02, label: '噪点' },
    });
  }

  createPasses() {
    return [new TintPass(), new HighlightPass(), new NoisePass()];
  }
}
