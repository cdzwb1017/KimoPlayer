/**
 * MaterialEngine —— 材质引擎调度器。
 *
 * 架构定位（docs/material-layer-architecture.md §2.6 / §5）：
 * - 维护层集合与脏集合；rAF 每帧只重算脏层（帧合并）；
 * - requestFrame() 合并同帧多次变更；
 * - 渲染后端经 RenderContext 注入（Canvas2D 实现，可换 WebGL）。
 */
import { RenderContext } from '../core/render-context.js';

export class MaterialEngine {
  /**
   * @param {import('../material/material-registry.js').MaterialRegistry} registry
   * @param {object} [opts] { renderContext, maxFps }
   */
  constructor(registry, opts = {}) {
    this.registry = registry;
    /** @type {RenderContext} */
    this.rc = opts.renderContext ?? new RenderContext();
    this.maxFps = opts.maxFps ?? 60;

    /** @type {Map<string, import('../layer/material-layer.js').MaterialLayer>} */
    this.layers = new Map();
    /** @type {Set<string>} 显式置脏的层（帧合并） */
    this._dirty = new Set();
    this._rafId = null;
    this._running = false;
    this._lastFrameTime = 0;
    /** 渲染回调：把某层输出展示到 DOM（由宿主注入，如预览 canvas 容器） */
    this.onLayerOutput = null;
  }

  addLayer(id, layer) {
    this.layers.set(id, layer);
    return this;
  }

  removeLayer(id) {
    const layer = this.layers.get(id);
    if (layer) layer.dispose();
    this.layers.delete(id);
    this._dirty.delete(id);
    return this;
  }

  getLayer(id) {
    return this.layers.get(id);
  }

  /** 请求重绘（多次调用合并为一帧） */
  requestFrame() {
    if (!this._running) {
      this.start();
      return;
    }
    // 已在运行：rAF 循环自然覆盖
  }

  invalidateLayer(id) {
    const layer = this.layers.get(id);
    if (layer) {
      layer.invalidate();
      this._dirty.add(id);
    }
    return this;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  dispose() {
    this.stop();
    this.rc.releaseAll();
    for (const [, layer] of this.layers) layer.dispose();
    this.layers.clear();
    this._dirty.clear();
  }

  _loop = () => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);

    const now = performance.now();
    if (now - this._lastFrameTime < 1000 / this.maxFps) return;
    this._lastFrameTime = now;

    this.update();
  };

  /** 帧更新：重算脏层 + 触发输出回调 */
  update() {
    for (const [id, layer] of this.layers) {
      const dirty = this._dirty.has(id) || layer.dirty;
      if (!dirty) continue;
      this._dirty.delete(id);

      const output = layer.render(this.rc);
      if (this.onLayerOutput && output) {
        this.onLayerOutput(id, output);
      }
    }
  }
}
