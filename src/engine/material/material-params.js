/**
 * MaterialParams —— 材质参数系统（Schema 驱动）。
 *
 * 架构定位（docs/material-layer-architecture.md §2.4）：
 * - 每种材质自带参数 Schema（默认值/范围/类型/UI 元数据）；
 * - set() 自动校验与钳制，成功后 version++（脏标记基础）；
 * - 主题系统不直接接触这里——颜色类参数经 MaterialThemeBridge 只读映射。
 */

/** Schema 项声明 */
const PARAM_TYPES = ['number', 'boolean', 'string'];

/**
 * 校验并规范化一份 paramSchema。
 * @param {Record<string, object>} schema
 * @returns {Record<string, object>} 规范化后的 schema
 */
export function normalizeSchema(schema) {
  const out = {};
  for (const [name, def] of Object.entries(schema || {})) {
    const type = def.type ?? (typeof def.default === 'number' ? 'number'
      : typeof def.default === 'boolean' ? 'boolean' : 'string');
    if (!PARAM_TYPES.includes(type)) {
      throw new Error(`[MaterialParams] 未知参数类型 "${type}"（参数 ${name}）`);
    }
    out[name] = {
      ...def,
      name,
      type,
      default: def.default ?? (type === 'number' ? 0 : type === 'boolean' ? false : ''),
      min: def.min ?? -Infinity,
      max: def.max ?? Infinity,
      step: def.step ?? 1,
      label: def.label ?? name,
    };
  }
  return out;
}

export class MaterialParams {
  /**
   * @param {Record<string, object>} schema
   * @param {Record<string, unknown>} [initial] 初始覆盖值
   */
  constructor(schema, initial = {}) {
    this.schema = normalizeSchema(schema);
    this.values = {};
    for (const [name, def] of Object.entries(this.schema)) {
      this.values[name] = def.default;
    }
    this.version = 0;
    for (const [name, value] of Object.entries(initial)) {
      this.set(name, value);
    }
  }

  /**
   * 设置参数：校验类型 + 数值钳制到 [min, max]。
   * 无效类型抛错（避免静默吞掉调用方 bug）；数值越界钳制。
   * @param {string} name
   * @param {unknown} value
   */
  set(name, value) {
    const def = this.schema[name];
    if (!def) {
      throw new Error(`[MaterialParams] 未声明参数 "${name}"`);
    }
    let v = value;
    if (def.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) throw new Error(`[MaterialParams] "${name}" 需要有限数值，收到 ${value}`);
      v = Math.max(def.min, Math.min(def.max, v));
    } else if (def.type === 'boolean') {
      v = Boolean(v);
    } else {
      v = String(v);
    }
    if (this.values[name] !== v) {
      this.values[name] = v;
      this.version += 1;
    }
    return this;
  }

  /**
   * 批量设置（滑块连续输入等场景）：只记版本，由引擎帧合并。
   * @param {Record<string, unknown>} patch
   */
  patch(patch) {
    for (const [k, v] of Object.entries(patch)) this.set(k, v);
    return this;
  }

  get(name) {
    return this.values[name];
  }

  /** 参数声明（供设置 UI 自动生成控件） */
  getSchemaEntries() {
    return Object.values(this.schema);
  }
}
