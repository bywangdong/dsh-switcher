# DSH Switcher

- 本项目独立于同级 dshMagicShortcuts；Switcher 的新代码写在这里。
- 正式宿主适配在 `src/plugin/`，设计基线与历史方案继续保留。不要把浏览器原型验证称为 DSH 插件验证；验证范围见 `design/integration.md`。
- 当前默认视觉为 2026-11-13 引入的 DSH 原生中性灰蓝状态优先方案 **02「器物」**（`状态 → 两行标题 → 项目轻胶囊`，凝练 136px 卡高，选中滑框与「动静异律」状态图标动效），同时在 DSH 插件详情页（`plugins.bundle.config`）提供配置开关，可随时在 `02 器物`、`01 素笺`、`03 界尺`、`04 墨韵`、`B2 轻胶囊` 与历史基线 `01 分签`（及 5 种动效模式）之间即时切换体验。`01 分签`（`design/archive/session-split-0.1.10/`）、`B2`（`design/archive/session-unified-pill/`）、B「轻透」及 05 亮色 / 05 raised 暗色均完整归档保留。
- `design/archive/` 保留历史方案；当前开发使用 `src/`，示例背景放在 `demo/`。
- 主入口不能引用同级项目、绝对本机路径或本仓库之外的资源。
- 使用 `npm run check` 验证语法和资源引用。UI 变化需在浏览器验证明暗主题与窄窗口。
