/**
 * RenderContext —— 材质引擎渲染后端抽象（Canvas2D 实现）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.1）：
 * - 材质只写逻辑，不绑定具体渲染 API；后端可替换（WebGL/Canvas2D）。
 * - TextureHandle 是帧间可缓存的中间纹理；本实现用离屏 canvas。
 *
 * 纹理池：按 key + 尺寸复用中间纹理，避免每帧分配 canvas。
 */

/**
 * 纹理句柄：材质管线中流转的中间图像。
 */
export class TextureHandle {
  constructor(canvas, key) {
    this.canvas = canvas;
    this.key = key;
    this.width = canvas.width;
    this.height = canvas.height;
    this.version = 0; // 内容版本：绘制后自增，供 pass 缓存判断
  }
}

export class RenderContext {
  /**
   * @param {number} [maxTextureCount] 纹理池上限（防止泄漏）
   */
  constructor({ maxTextureCount = 32 } = {}) {
    this._pool = new Map();
    this._maxTextureCount = maxTextureCount;
    this._textures = 0;
    this._trimIndex = 0;
  }

  /**
   * 从池中取（或创建）纹理。同 key 同尺寸复用。
   * @param {string} key
   * @param {number} width
   * @param {number} height
   * @returns {TextureHandle}
   */
  getTexture(key, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const poolKey = `${key}:${w}x${h}`;
    let tex = this._pool.get(poolKey);
    if (!tex) {
      if (this._textures >= this._maxTextureCount) this._trim();
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      tex = new TextureHandle(canvas, key);
      this._pool.set(poolKey, tex);
      this._textures += 1;
    }
    return tex;
  }

  /** 释放全部纹理（窗口 resize / 引擎销毁时调用） */
  releaseAll() {
    this._pool.clear();
    this._textures = 0;
  }

  _trim() {
    // 简单淘汰：清掉最早插入的一半（工程上够用；后续可换 LRU）
    const entries = [...this._pool.entries()];
    const dropCount = Math.ceil(entries.length / 2);
    for (let i = 0; i < dropCount; i++) {
      this._pool.delete(entries[i][0]);
      this._textures -= 1;
    }
  }

  /**
   * 通用绘制助手：把 source 画到 target（带可选 filter / 全局透明度）。
   * @param {TextureHandle} target
   * @param {CanvasImageSource} source
   * @param {object} [opts] { filter, alpha, sx, sy, sw, sh, dx, dy, dw, dh }
   */
  blit(target, source, opts = {}) {
    const ctx = target.canvas.getContext('2d');
    const {
      filter = 'none',
      alpha = 1,
      sx = 0, sy = 0,
      sw = source.width ?? source.videoWidth ?? 0,
      sh = source.height ?? source.videoHeight ?? 0,
      dx = 0, dy = 0,
      dw = target.width, dh = target.height,
    } = opts;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.save();
    ctx.filter = filter;
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
    target.version += 1;
    return target;
  }
}
