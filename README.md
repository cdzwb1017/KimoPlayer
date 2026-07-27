# KiomPlayer

基于 Tauri 2 的 Windows 本地音乐播放器。前端使用原生 HTML/CSS/JS，后端由 Rust 提供文件扫描、音频元数据、歌词匹配和系统集成功能。

## 功能特性

- 本地音乐播放与管理，支持 MP3/FLAC/WAV/APE/M4A/OGG
- 卡拉OK 逐字歌词同步、编辑与 AI 强制对齐
- 多平台评论聚合（网易云/QQ音乐/酷我/酷狗）
- 桌面歌词与沉浸全屏模式
- 系统托盘集成与播放控制
- 玻璃材质 UI，支持深色/浅色/灰色主题

## 开发环境

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (通过 rustup 安装)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发模式（前端 + Rust 热重载）
npm run tauri dev

# 仅启动前端开发服务器
npm run dev

# 构建前端产物
npm run build

# 构建 Tauri 发布包
npm run tauri build
```

## 目录结构

```
src/                    前端源码
├── main.js             主入口
├── core/               窗口控制
├── features/           业务功能（评论、歌单、设置等）
├── player/             音频播放控制器
├── lyrics/             歌词动画与同步
├── search/             搜索与歌词索引
├── storage/            数据持久化
├── ui/                 主题、过渡、右键菜单等
└── utils/              工具函数

src-tauri/              Tauri + Rust 后端
ai-service/            本地 AI 歌词识别服务（Python）
```

## 入口文件

| 文件 | 说明 |
|------|------|
| `index.html` | 主播放器页面 |
| `src/main.js` | 前端主逻辑 |
| `src/player/playback-controller.js` | 播放控制器 |
| `src-tauri/src/lib.rs` | Rust 后端命令 |
| `ai-service/app.py` | AI 服务（可选） |

## 许可证

MIT
