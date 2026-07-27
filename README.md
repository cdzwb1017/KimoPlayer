# KiomPlayer

KiomPlayer 是一款基于 Tauri 2 的 Windows 本地音乐播放器，使用原生 HTML、CSS 和 JavaScript 构建界面，并由 Rust 提供文件扫描、音频元数据、歌词缓存和系统集成功能。

当前版本：`1.3.0-beta0722-03`

## 开发命令

```powershell
npm install
npm run tauri dev
```

前端单独调试：

```powershell
npm run dev
```

正式打包：

```powershell
.\build-opt.ps1
```

## 目录结构

- `src/`：当前前端源码，入口为 `main.js`
  - `src/core/`：桌面窗口等应用壳层逻辑
  - `src/features/`：本地音乐、发现页、最近播放、设置页、歌单服务和播放列表面板等业务功能
  - `src/player/`：音频播放器模块
  - `src/search/`：搜索控制器、歌词索引与后台搜索 Worker
  - `src/storage/`：歌单和歌词索引持久化
  - `src/ui/`：主题和界面过渡模块
  - `src/utils/`：封面、颜色和时间格式等通用工具
- `src-tauri/`：Tauri 与 Rust 后端源码
- `ai-service/`：本地 AI 歌词识别与强制对齐服务
- `assets/branding/`：Logo 与品牌图片源文件
- `references/`：仅供实现对照的外部参考代码，不参与项目构建
- `docs/changelog/`：版本更新日志
- `docs/design/`：Logo 和视觉设计说明
- `archive/legacy-source/`：未被当前入口引用的历史源码备份
- `dist/`：Vite 前端构建产物
- `dist-exe/`：压缩后的 Windows 可执行文件

## 当前入口

- 主页面：`index.html`
- 前端逻辑：`src/main.js`
- 播放控制器：`src/player/playback-controller.js`
- 歌词解析：`src/lyrics.js`
- Rust 命令：`src-tauri/src/lib.rs`
- AI 服务：`ai-service/app.py`

历史源码仅用于追溯，不应直接作为新功能的修改入口。

`references/audio-player.js` 是外部参考文件，不属于当前项目实现；项目实际使用的播放控制器是 `src/player/playback-controller.js`。
