/**
 * MaterialRegistry —— 材质注册表（新增材质的唯一入口）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.3）：
 * - register(type, factory) 注册；
 * - create(type, overrides) 按 schema 合并默认值实例化；
 * - getTypes() 供设置 UI 枚举（新增材质后 UI 自动出现选项）。
 */

export class MaterialRegistry {
  constructor() {
    /** @type {Map<string, () => import('./material.js').Material>} */
    this._factories = new Map();
  }

  /**
   * @param {string} type
   * @param {() => import('./material.js').Material} factory
   */
  register(type, factory) {
    if (this._factories.has(type)) {
      throw new Error(`[MaterialRegistry] 材质类型 "${type}" 已注册`);
    }
    if (typeof factory !== 'function') {
      throw new Error(`[MaterialRegistry] "${type}" 的 factory 必须是函数`);
    }
    this._factories.set(type, factory);
  }

  unregister(type) {
    this._factories.delete(type);
  }

  /**
   * 创建材质实例。
   * @param {string} type
   * @param {Record<string, unknown>} [overrides] 初始参数覆盖（自动钳制）
   * @returns {import('./material.js').Material}
   */
  create(type, overrides = {}) {
    const factory = this._factories.get(type);
    if (!factory) {
      throw new Error(`[MaterialRegistry] 未注册的材质类型 "${type}"（已注册：${this.getTypes().map(t => t.type).join(', ')}）`);
    }
    const mat = factory();
    if (overrides && Object.keys(overrides).length > 0) {
      mat.params.patch(overrides);
    }
    return mat;
  }

  has(type) {
    return this._factories.has(type);
  }

  /** 已注册类型清单（供设置 UI 枚举） */
  getTypes() {
    return [...this._factories.entries()].map(([type, factory]) => {
      const sample = factory();
      return {
        type,
        paramSchema: sample.paramSchema,
        get defaultParams() {
          return sample.params.values;
        },
      };
    });
  }
}
