/**
 * MaterialThemeBridge —— 主题 ↔ 材质 唯一交汇点（只读、可插拔、默认不启用）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.4 / §8）：
 * - 主题只产 token（颜色/字体/间距）给 UI 控件；
 * - 材质默认不读主题；本桥把个别 token 只读映射为材质颜色类参数；
 * - 换肤时桥刷新映射参数（仅颜色类），材质质感参数不受影响。
 */

export class MaterialThemeBridge {
  constructor() {
    /** @type {Map<string, { layerId: string, materialType: string, param: string, token: () => string|number }>} */
    this._mappings = new Map();
    this._subscribers = new Set();
  }

  /**
   * 注册一条 token → 材质参数 的只读映射。
   * @param {object} opts { layerId, materialType, param, token: () => value }
   */
  mapToken({ layerId, materialType, param, token }) {
    const key = `${layerId}:${materialType}:${param}`;
    this._mappings.set(key, { layerId, materialType, param, token });
    return this;
  }

  unmap(layerId, materialType, param) {
    this._mappings.delete(`${layerId}:${materialType}:${param}`);
    return this;
  }

  /** 刷新全部映射到引擎中的材质（主题切换时调用） */
  apply(engine) {
    let changed = false;
    for (const mapping of this._mappings.values()) {
      const layer = engine.getLayer(mapping.layerId);
      if (!layer) continue;
      const material = layer.stack.materials.find(m => m.type === mapping.materialType);
      if (!material) continue;
      const value = mapping.token();
      if (value !== undefined && material.params.get(mapping.param) !== value) {
        material.params.set(mapping.param, value);
        changed = true;
      }
    }
    if (changed) {
      for (const cb of this._subscribers) cb();
      engine.requestFrame();
    }
    return changed;
  }

  onChange(cb) {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  clear() {
    this._mappings.clear();
    this._subscribers.clear();
  }
}
