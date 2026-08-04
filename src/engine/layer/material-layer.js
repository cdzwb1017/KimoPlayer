/**
 * MaterialStack + MaterialLayer —— 材质层（独立渲染单元）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.5）：
 * - 材质层是独立层：输入背景纹理，输出合成纹理，UI 层只读 output；
 * - MaterialStack 支持多材质按序叠加（玻璃 + 色散 + 高光）；
 * - setSource 由引擎在背景变化时调用（sourceVersion++ → 置脏）。
 */
import { TextureHandle } from '../core/render-context.js';

export class MaterialStack {
  constructor() {
    /** @type {import('../material/material.js').Material[]} */
    this.materials = [];
  }

  push(material) {
    if (this.materials.some(m => m.type === material.type)) {
      throw new Error(`[MaterialStack] 材质 "${material.type}" 已在栈中`);
    }
    this.materials.push(material);
    material.onAttach();
    return this;
  }

  remove(type) {
    const idx = this.materials.findIndex(m => m.type === type);
    if (idx >= 0) {
      const [mat] = this.materials.splice(idx, 1);
      mat.onDetach();
    }
    return this;
  }

  clear() {
    while (this.materials.length > 0) {
      const mat = this.materials.pop();
      mat.onDetach();
    }
    return this;
  }

  get length() {
    return this.materials.length;
  }

  /** 栈内任一材质参数变化都会反映到这里（供引擎做脏判断） */
  get version() {
    return this.materials.reduce((acc, m) => acc + m.params.version, 0);
  }
}

export class MaterialLayer {
  constructor() {
    /** @type {MaterialStack} */
    this.stack = new MaterialStack();
    /** @type {TextureHandle|null} 合成结果（UI 层读取） */
    this.output = null;
    /** @type {import('../core/render-context.js').RenderContext|null} */
    this._rc = null;
    /** @type {import('./background-source.js').BackgroundSource|null} */
    this._source = null;
    this._sourceVersion = 0;
    this._stackVersion = 0;
    this._dirty = true;
    this.id = 'material-layer';
    this.zOrder = 1;
  }

  /**
   * 设置背景源（背景层内容变化时调用）。
   * @param {import('./background-source.js').BackgroundSource|null} source
   */
  setSource(source) {
    this._source = source;
    this._sourceVersion += 1;
    this._dirty = true;
    return this;
  }

  invalidate() {
    this._dirty = true;
    return this;
  }

  /** 引擎脏判断：源变化 / 栈变化 / 显式置脏 */
  get dirty() {
    if (this._dirty) return true;
    if (this.stack.version !== this._stackVersion) return true;
    if (this._source && this._source.version !== this._sourceVersion) return true;
    return false;
  }

  /**
   * 设置合成尺寸（纯叠加材质无输入时使用）。
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this._baseW = Math.max(1, Math.round(w));
    this._baseH = Math.max(1, Math.round(h));
    this._dirty = true;
    return this;
  }

  /**
   * 执行材质管线：背景纹理 → 逐材质 pass 链 → 合成输出。
   * 无输入源（纯合成叠加材质）时以透明底纹理为输入。
   * @param {import('../core/render-context.js').RenderContext} rc
   * @returns {TextureHandle|null} 合成输出（空栈时为空纹理）
   */
  render(rc) {
    this._rc = rc;

    if (!this._source) {
      // 纯合成材质（叠加层）：透明底纹理为输入
      const base = rc.getTexture('mat:base', this._baseW || 1, this._baseH || 1);
      const bctx = base.canvas.getContext('2d');
      bctx.clearRect(0, 0, base.width, base.height);
      base.version += 1;
      let input = base;
      if (this.stack.length === 0) {
        this.output = base;
      } else {
        for (const material of this.stack.materials) {
          const passes = material.getPasses(rc);
          for (const pass of passes) {
            const out = rc.getTexture(`mat:${material.type}:${pass.name}`, input.width, input.height);
            pass.draw(rc, input, out, material.params);
            input = out;
          }
        }
        this.output = input;
      }
      this._stackVersion = this.stack.version;
      this._dirty = false;
      return this.output;
    }

    const bgTexture = this._source.capture(rc);
    if (!bgTexture) return this.output;

    // 降采样由 BackgroundSource 负责（capture 已按 scale 产出小纹理）——
    // 此处不再除以 scale，避免二次放大降低模糊质量
    let input = bgTexture;

    if (this.stack.length === 0) {
      // 无材质：直通背景
      this.output = bgTexture;
    } else {
      for (const material of this.stack.materials) {
        const passes = material.getPasses(rc);
        for (const pass of passes) {
          const out = rc.getTexture(`mat:${material.type}:${pass.name}`, input.width, input.height);
          pass.draw(rc, input, out, material.params);
          input = out;
        }
      }
      this.output = input;
    }

    this._stackVersion = this.stack.version;
    this._sourceVersion = this._source.version;
    this._dirty = false;
    return this.output;
  }

  dispose() {
    this.stack.clear();
    this.output = null;
    this._source = null;
  }
}
