/**
 * BackgroundSource —— 背景源抽象：把"背景内容"捕获为纹理。
 *
 * 架构定位（docs/material-layer-architecture.md §2.1）：
 * - 背景层与材质层解耦：材质层只消费纹理，不知道背景是图/渐变/动态；
 * - 本实现支持两种源：HTMLImageElement（现有 bg-blur-img）与 Canvas。
 *
 * 捕获策略：尺寸取元素当前渲染尺寸（* dpr 保证清晰度），
 * 源变化（如换壁纸）时调用 markChanged() 使 version++。
 */

export class BackgroundSource {
  /**
   * @param {HTMLImageElement|HTMLCanvasElement} element
   * @param {number} [scale] 中间纹理降采样倍率（0.25~1，模糊类默认 0.5）
   * @param {number} [dpr] 设备像素比（默认 window.devicePixelRatio）
   */
  constructor(element, { scale = 0.5, dpr } = {}) {
    this.element = element;
    this.scale = scale;
    this.dpr = dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.version = 0;
    /** @type {import('../core/render-context.js').TextureHandle|null} */
    this._cached = null;
    this._lastNaturalWidth = 0;
    this._lastNaturalHeight = 0;
  }

  /** 源内容变化时调用（换壁纸/切封面） */
  markChanged() {
    this.version += 1;
    this._cached = null;
  }

  /**
   * 捕获当前内容为纹理（内容未变时复用缓存）。
   * @param {import('../core/render-context.js').RenderContext} rc
   * @returns {import('../core/render-context.js').TextureHandle|null}
   */
  capture(rc) {
    const el = this.element;
    if (!el) return null;
    const nw = el.naturalWidth || el.width || el.videoWidth || 0;
    const nh = el.naturalHeight || el.height || el.videoHeight || 0;
    if (!nw || !nh) return null;

    if (
      this._cached &&
      this._cached.width === Math.max(1, Math.round(nw * this.scale)) &&
      this._cached.height === Math.max(1, Math.round(nh * this.scale))
    ) {
      return this._cached;
    }

    const tex = rc.getTexture(
      'bg:source',
      Math.max(1, Math.round(nw * this.scale)),
      Math.max(1, Math.round(nh * this.scale)),
    );
    rc.blit(tex, el, { dw: tex.width, dh: tex.height });
    this._cached = tex;
    return tex;
  }
}
