/**
 * FrostedGlassMaterial —— 内置「玻璃」材质（对齐评论区玻璃质感：
 * blur(20px) saturate(1.4) + 半透明底色 + 顶部内高光/亮边）。
 *
 * 效果链：BlurPass（模糊+提饱和）→ TintPass（半透明着色）→ HighlightPass（顶部高光）→ NoisePass（噪点）。
 * 参数（Schema 驱动，设置 UI 可自动生成控件）：
 * - blurRadius   模糊半径（px）
 * - saturate     饱和度（1~2，对齐 --ui-saturate 140%）
 * - opacity      材质层透明度（0~1）
 * - tintColor    着色（CSS 颜色）
 * - tintAmount   着色强度（0~0.6）
 * - highlight    顶部内高光强度（0~1）
 * - noiseAmount  噪点强度（0~1）
 */
import { Material } from '../material/material.js';
import { Pass } from '../material/pass.js';

class BlurPass extends Pass {
  constructor() {
    super('blur');
  }

  _render(rc, input, output, params) {
    const radius = Math.max(0, params.get('blurRadius'));
    const saturate = Math.max(1, params.get('saturate'));
    const alpha = Math.max(0, Math.min(1, params.get('opacity')));
    const filters = [];
    if (radius > 0.5) filters.push(`blur(${radius}px)`);
    if (saturate > 1.01) filters.push(`saturate(${saturate})`);
    rc.blit(output, input.canvas, {
      filter: filters.length > 0 ? filters.join(' ') : 'none',
      alpha,
    });
  }
}

class TintPass extends Pass {
  constructor() {
    super('tint');
  }

  _render(rc, input, output, params) {
    const ctx = output.canvas.getContext('2d');
    const tintAlpha = Math.max(0, Math.min(0.6, params.get('tintAmount')));
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    if (tintAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = tintAlpha;
      ctx.fillStyle = params.get('tintColor');
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.restore();
    }
    output.version += 1; // 手工绘制后必须更新版本，否则破坏 pass 增量缓存链
  }
}

class HighlightPass extends Pass {
  constructor() {
    super('highlight');
  }

  _render(rc, input, output, params) {
    const ctx = output.canvas.getContext('2d');
    const strength = Math.max(0, Math.min(1, params.get('highlight')));
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    if (strength <= 0) {
      output.version += 1;
      return;
    }
    // 顶部内高光：25% 高度线性渐变（对齐评论区浅色玻璃的 inset 高光质感）。
    // 注意：低清采样纹理上不画 1px 亮边（放大后过粗），亮边由显示端 canvas 的 inset shadow 承担
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
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.drawImage(input.canvas, 0, 0, output.width, output.height);
    output.version += 1; // 先更新版本：amount<=0 提前返回也不破坏下游缓存链
    if (amount <= 0) return;
    // 噪点 tile：自身 createImageData 生成并 putImageData 到自建小画布
    // （非读取输入像素——输入图跨域时读像素会抛 SecurityError），永不 taint；
    // 平铺 + overlay 混合叠加噪点质感
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
    ctx.globalAlpha = Math.min(1, amount * 0.5);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.restore();
    output.version += 1; // 手工绘制后必须更新版本，否则破坏 pass 增量缓存链
  }
}

export class FrostedGlassMaterial extends Material {
  constructor() {
    super('frosted-glass', {
      blurRadius: { default: 20, min: 0, max: 120, step: 1, label: '模糊半径' },
      saturate: { default: 1.1, min: 1, max: 2, step: 0.05, label: '饱和度' },
      opacity: { default: 1, min: 0, max: 1, step: 0.05, label: '不透明度' },
      tintColor: { default: 'rgba(10, 10, 13, 0.6)', label: '着色' },
      tintAmount: { default: 0.35, min: 0, max: 0.6, step: 0.02, label: '着色强度' },
      highlight: { default: 0.8, min: 0, max: 1, step: 0.05, label: '顶部高光' },
      noiseAmount: { default: 0.2, min: 0, max: 1, step: 0.02, label: '噪点' },
    });
  }

  createPasses() {
    return [new BlurPass(), new TintPass(), new HighlightPass(), new NoisePass()];
  }
}
