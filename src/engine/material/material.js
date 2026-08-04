/**
 * Material —— 材质抽象基类（核心扩展点）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.2）：
 * - 每种材质自带参数 Schema + 效果链（pass 列表）；
 * - 新增材质 = 继承 Material + 注册到 MaterialRegistry，控件/主题零改动；
 * - onAttach/onDetach 用于资源分配与释放（挂载时创建 pass 等）。
 */
import { MaterialParams } from './material-params.js';

export class Material {
  /**
   * @param {string} type 注册名（唯一）
   * @param {Record<string, object>} paramSchema
   */
  constructor(type, paramSchema = {}) {
    this.type = type;
    this.paramSchema = paramSchema;
    /** @type {MaterialParams} 惰性创建（首次访问） */
    this._params = null;
    /** @type {import('../core/render-context.js').RenderContext|null} */
    this._rc = null;
    /** @type {import('./pass.js').Pass[]} */
    this._passes = null;
  }

  /** 参数实例（首次访问时按 schema 创建） */
  get params() {
    if (!this._params) this._params = new MaterialParams(this.paramSchema);
    return this._params;
  }

  /** 效果链：惰性构建一次，由 RenderContext 创建 pass 资源 */
  getPasses(rc) {
    if (!this._passes) {
      this._rc = rc;
      this._passes = this.createPasses(rc);
    }
    return this._passes;
  }

  /**
   * 生成效果链（子类实现；返回空数组 = 直通）。
   * @param {import('../core/render-context.js').RenderContext} rc
   * @returns {import('./pass.js').Pass[]}
   */
  createPasses(rc) {
    return [];
  }

  /** 挂载到材质层：分配资源（默认无操作） */
  onAttach() {}

  /** 从材质层卸载：释放资源 */
  onDetach() {
    if (this._passes) {
      for (const p of this._passes) p.dispose();
      this._passes = null;
    }
    this._rc = null;
  }

  /** 完全释放 */
  dispose() {
    this.onDetach();
    this._params = null;
  }
}
