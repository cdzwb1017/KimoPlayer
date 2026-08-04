/**
 * Pass —— 单次效果计算单元（模糊/色散/高光各一个 pass）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.2）：
 * - pass 是缓存与增量的最小单位：参数未变时上一帧输出可复用；
 * - input/output 均为 TextureHandle，链式流转；
 * - draw() 只依赖 RenderContext 与参数，不感知控件。
 */

export class Pass {
  /**
   * @param {string} name 如 'blur' | 'dispersion' | 'highlight'
   */
  constructor(name) {
    this.name = name;
    this.input = null;
    this.output = null;
    /** 上次绘制时的参数版本（=0 表示从未绘制） */
    this._drawnParamsVersion = 0;
    /** 上次绘制时的输入版本 */
    this._drawnInputVersion = 0;
  }

  /**
   * 执行效果。引擎调用，内部处理增量缓存：
   * 参数与输入均未变化时直接复用输出（跳过 GPU 绘制）。
   * @param {import('../core/render-context.js').RenderContext} rc
   * @param {import('../core/render-context.js').TextureHandle} input
   * @param {import('../core/render-context.js').TextureHandle} output
   * @param {import('./material-params.js').MaterialParams} params
   * @returns {boolean} 是否实际重绘
   */
  draw(rc, input, output, params) {
    const paramsVersion = params ? params.version : 0;
    if (
      this._drawnParamsVersion === paramsVersion &&
      this._drawnInputVersion === (input ? input.version : 0) &&
      this.output === output
    ) {
      return false; // 缓存命中：无需重绘
    }
    this._render(rc, input, output, params);
    this.input = input;
    this.output = output;
    this._drawnParamsVersion = paramsVersion;
    this._drawnInputVersion = input ? input.version : 0;
    return true;
  }

  /** 子类实现实际绘制 */
  _render(rc, input, output, params) {
    // 默认直通：输入原样拷贝到输出
    rc.blit(output, input.canvas);
  }

  dispose() {
    this.input = null;
    this.output = null;
  }
}

/** 直通 pass：便于占位/调试 */
export class IdentityPass extends Pass {
  constructor() {
    super('identity');
  }
}
