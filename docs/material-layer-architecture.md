# 材质层架构设计（可复用 UI 渲染引擎）

> 目标：在既有 UI 系统（控件 + 统一主题管理 + 实时 UI 风格切换）之上，
> 设计一个**独立、可扩展、低耦合、高内聚**的材质层渲染引擎。
> 材质逻辑不进入任何具体控件；新增材质类型不影响现有 UI 控件与主题系统。

## 1. 分层架构与核心不变量

```
┌─────────────────────────────────────────────┐
│ Window（宿主：帧缓冲 / RenderContext 生命周期） │
│  ┌───────────────────────────────────────┐  │
│  │ UI 层（控件树，不感知材质的存在）           │  │
│  ├───────────────────────────────────────┤  │
│  │ 背景层 BackgroundLayer（图/渐变/动态源）   │  │
│  ├───────────────────────────────────────┤  │
│  │ 材质层 MaterialLayer（独立渲染单元）       │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

> **层级顺序（最终定义）**：Window → 材质层 → 背景层 → UI 层。
> 材质层位于**最底**：渲染/模拟「窗口后面的内容」；背景层叠加其上，
> 背景的透明区域露出材质层；UI 控件最上。

三条铁律：

1. **单向依赖**：Window → 材质层 → 背景层 → UI 层。UI 控件永远只把背景层/材质层合成结果当作"背景纹理"，材质逻辑零侵入控件。
2. **材质层是独立渲染单元**，不是控件属性——控件树中不存在任何材质字段。
3. **主题与材质完全解耦**：主题产 token（颜色/字体/间距）只服务控件；材质只消费背景像素 + 自身参数。

## 2. 核心类结构

### 2.1 层抽象（基础设施）

```ts
interface Layer {
  id: string;
  zOrder: number;
  readonly output: TextureHandle;   // 本层产出的纹理（帧间可缓存）
  render(ctx: RenderContext): void;
  invalidate(): void;               // 请求重绘（置脏）
}
```

### 2.2 材质抽象（核心扩展点）

```ts
abstract class Material {
  readonly type: string;                       // 注册名：'frosted-glass' | 'chromatic' ...
  readonly params: MaterialParams;             // 本材质独立参数实例

  abstract get paramSchema(): ParamSchema;     // 参数声明：默认值/范围/类型/UI 元数据
  abstract createPasses(ctx: RenderContext): Pass[];  // 生成效果链（可返回空 = 直通）
  abstract validate(p: MaterialParams): void;  // 参数钳制

  onAttach(layer: MaterialLayer): void;        // 挂载（分配资源）
  onDetach(layer: MaterialLayer): void;
  dispose(): void;                             // 释放 GPU 资源
}
```

**Pass = 单次效果计算单元**（模糊、色散、高光各是一个 pass）：

```ts
interface Pass {
  name: string;                    // 'blur' | 'dispersion' | 'highlight'
  input: TextureHandle;            // 上一 pass 的输出
  output: TextureHandle;
  draw(rc: RenderContext, params: MaterialParams): void;
  dispose(): void;
}
```

> 为什么拆 Pass 而非把整个效果写在一个 `render()` 里：
> **pass 是缓存与增量的最小单位**——模糊半径没变时模糊 pass 的输出可以复用，只有色散 pass 重算。

### 2.3 材质注册表（新增材质的唯一入口）

```ts
class MaterialRegistry {
  register(type: string, factory: () => Material): void;
  create(type: string, overrides?: object): Material;  // 按 schema 合并默认值
  getTypes(): MaterialTypeInfo[];                      // 供设置 UI 枚举展示
}
```

**新增一种材质 = 三步**：实现 `Material` → 写 pass 链 → `registry.register()`。
之后设置 UI 自动出现新选项（`getTypes()` 枚举驱动），控件、主题、管线全部零改动。

### 2.4 参数系统（与主题解耦的关键）

```ts
class MaterialParams {
  readonly values: Record<string, ParamValue>;   // 由 schema 生成：默认/范围/校验
  set(name: string, value: ParamValue): void;    // 校验+钳制 → version++
  get(name: string): ParamValue;
  readonly version: number;                      // 脏标记基础
}
```

- 每种材质**自带参数 Schema**（模糊半径、透明度、色散强度、高光强度、噪声、饱和度……），
  参数合法域由 schema 声明，`set` 自动钳制。
- **主题 ↔ 材质交汇点只有一个**：`MaterialThemeBridge`（只读映射，如"主题强调色 → 玻璃高光色调"），
  单向、可插拔、默认不启用。

### 2.5 材质层（独立层容器，支持多材质叠加）

```ts
class MaterialStack {                    // 有序材质列表，按序叠加合成
  materials: Material[];
  push(m: Material): void;
  remove(type: string): void;
  get outputVersion(): number;           // 任一材质 params.version 变化都会反映到这里
}

class MaterialLayer implements Layer {
  stack: MaterialStack;              // 多材质按序叠加（玻璃 + 色散 + 高光）
  output: TextureHandle;             // 合成结果 → UI 层读取

  setSource(tex: TextureHandle): void;   // 背景层变化时由引擎调用 → sourceVersion++ → 置脏
  render(rc): void { /* 依序执行 stack 的 pass 链 + 按 opacity 混合 */ }
  invalidate(): void;
}
```

### 2.6 引擎 / 调度器

```ts
class MaterialEngine {
  private layers: Map<string, MaterialLayer>;
  private dirty: Set<string>;         // 脏层集合（帧合并）

  update(now: number): void;          // 每帧：只重算脏层
  requestFrame(): void;               // 多次变更合并为一次渲染
}
```

## 3. 数据流

```
主题系统 ──token──► UI 控件（颜色/字体/间距）
    │
    └─(可选 MaterialThemeBridge，只读单向)──► 材质颜色类参数

背景内容变化 ──► MaterialLayer.setSource ──► 置脏
参数变更 ──────► params.set → version++ ──► 置脏
主题切换 ──────► bridge 刷新映射参数 ──► 置脏（仅颜色类参数；仅当 bridge 启用）
窗口 resize ────► 重建中间纹理（分辨率策略）──► 置脏
```

## 4. 渲染流程（单帧）

```
1. BackgroundLayer.render → bgTexture
2. MaterialLayer（仅脏层）:
   for material in stack:
     for pass in material.createPasses():
       pass.draw(input = bgTexture 或上一 pass 输出, params)
   → finalTexture（各材质按 opacity 合成）
3. UILayer.render(rc, finalTexture)   // 控件把 finalTexture 当普通背景画
```

性能策略（内置）：

- 中间纹理**降采样**（模糊/色散类默认 0.25–0.5x，UI 层读取合成结果时再放大）
- **pass 级缓存**：参数未变的 pass 输出复用
- **帧合并**：同一帧内多次 `set()` 只触发一次重算

## 5. 更新机制

| 机制 | 说明 |
|---|---|
| 三级脏标记 | `params.version` / `sourceVersion` / `layer.dirty`，任一变化 → 该层重算 |
| 实时计算 | rAF 每帧检查脏集合，只重算脏层（滑块拖动天然流畅） |
| 节流合并 | 连续参数变更只记版本号，下一帧统一重算（避免滑块每 tick 触发整条管线） |
| 增量缓存 | 模糊 pass 缓存；色散/高光 pass 单独重算；未变 pass 直通 |
| 事件源 | 背景变化 / 参数变化 / 主题切换（经 bridge）/ resize |

## 6. 扩展示例（新增"霓虹光效"材质）

```ts
class NeonMaterial extends Material {
  paramSchema = { strength: {default: 0.6, min: 0, max: 1},
                  spread:   {default: 8,   min: 0, max: 32},
                  hue:      {default: 0.55, /* ... */} };
  createPasses(rc) {
    return [ new ExtractHighlightPass(rc),   // 提取高光区
             new GaussianBlurPass(rc, this.params),  // 扩散
             new ScreenBlendPass(rc) ];      // 屏幕混合回背景
  }
}
registry.register('neon', () => new NeonMaterial());
```

完成——设置 UI 自动出现「霓虹」选项（`getTypes()` 枚举），控件与主题零改动。

## 7. 模块划分（高内聚低耦合）

```
engine/
  core/       Layer, RenderContext, TextureHandle, 帧缓冲管理
  material/   Material, Pass, MaterialParams, ParamSchema, MaterialRegistry
  layer/      MaterialLayer, MaterialStack, BackgroundLayer
  scheduler/  MaterialEngine（脏标记/帧调度/降采样策略）
  bridge/     MaterialThemeBridge（主题↔材质唯一交汇，可插拔）
  presets/    内置材质（frosted-glass.ts, chromatic.ts, glow.ts, noise.ts...）每个一文件
```

## 8. 关键设计决策

1. **材质层 = 独立渲染单元**，控件零耦合。
2. **注册表 + Schema 驱动** = 扩展机制：新材质 = 新文件 + 注册，杜绝 if-else 开关式扩散。
3. **Pass 是缓存/增量最小单位**——性能优化有明确边界。
4. **参数系统 schema 化**：默认值、范围、校验、UI 元数据一份声明搞定。
5. **主题与材质单向只读桥**解耦：主题换肤不影响材质质感，材质调参不影响主题。
6. **脏标记 + 帧合并 + 降采样 + pass 缓存**四件套保证"实时计算"不牺牲性能。
7. **`RenderContext` 抽象渲染后端**（WebGL / Canvas2D / GPU），材质只写逻辑不绑定 API。
8. **多材质堆叠**（MaterialStack）支持复合质感（玻璃+色散+高光），与 UI 风格切换（换 stack 组合）正交。

## 9. 落地到现有项目（kimoPlayer）

| 现有模块 | 对应角色 |
|---|---|
| `dynamic-bg` + `bg-blur-img` 背景层 | `BackgroundLayer` |
| 新增 `src/engine/material/` | 材质层核心（Material / Registry / Params / MaterialLayer / Engine） |
| UI 风格切换（acrylic/gaussian/liquid/solid） | 切换 `MaterialStack` 预设组合（现状为 CSS `backdrop-filter` 实现，落地需迁移） |
| 主题系统（themes.css / theme.js） | 保持原样，经 `MaterialThemeBridge` 可选映射 |
| 现有控件 | **零改动**（材质层输出即其背景） |
