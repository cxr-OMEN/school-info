# 校园信息港 · 设计系统

定位：校园公告的「每日简报」。视觉方向为 **麦田暗金（Wheat & Harvest Dark）**：
深色土壤底 + 麦穗金光晕 + 毛玻璃卡片 + 金色渐变标题。保留「信息优先、克制装饰」的信息层级。

## Colors

主色板（小麦 / 稻草 / 土壤）
- 麦穗金 Wheat（主色）: #e8c46a；高光 #f4d98f；深麦金 #c9a03f
- 麦秆橙 Straw（次色）: #d9b36c；熟麦褐橙 #b8843f
- 新芽绿 Sprout（点缀，仅用于「在线/实时」）: #8cc46e
- 土壤底 Soil: #1a1408

Dark（默认，`html[data-theme="dark"]`）
- Background: #100c06
- Card/Glass: rgba(38, 29, 15, .55)；Hover: rgba(52, 40, 21, .64)
- Nav/Filterbar Glass: rgba(26, 20, 10, .74) + 1px rgba(255,236,190,.11)
- Chip/Input: rgba(40, 31, 16, .86)；Tabs 槽: rgba(14, 10, 5, .58)
- Text: #f5ecd9 / #cdbb9a / #9c8b6d
- 按钮渐变: #f4d98f → #c9a03f，文字 #231a07（深棕，保证 8:1 以上）
- 环境光：麦金 rgba(232,196,106,.42) / 褐橙 rgba(184,132,63,.5)，blur 90px

Light（麦收纸感）
- Background: #faf4e6；Surface: #fffdf6；Card: rgba(255,253,246,.92)
- Text: #241b0d / #5a4a30 / #7a6849
- 主色改用更深的 #8a6316 / #a87b21（浅色底上文字对比度 ≥ 4.5:1）

Category（深色）
- 通知公告 #e8c46a（麦金）/ 校历考试 #8cc46e（新芽绿）/ 竞赛比赛 #d9b36c（麦秆橙）/ 其他 #a89a80

## Typography
- Sans: PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, system-ui, sans-serif
- Mono（日期 / 数字 / 数据条）: ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace
- Hero 主标题 `clamp(34px, 5vw, 50px)` / 700；副标题行 `clamp(26px, 3.6vw, 40px)` / 700
- 统计数字 22px / 700（等宽数字）；卡片标题 16.5px / 600；正文 14–15px / 1.65

## Spacing
- 基准 4px；间距 4 / 8 / 12 / 16 / 20 / 24 / 32 / 44
- 容器 1000px；移动端左右 16px

## Components
- 圆角：卡片 18px；统计卡 14px；胶囊导航 / 筛选条 999px；按钮 10px
- 玻璃卡阴影 `0 18px 40px -30px #000` + `inset 0 1px 0 rgba(255,236,190,.045)`
- 顶栏：58px 高胶囊，`backdrop-filter: blur(18px) saturate(140%)`；右侧 actions 分组（主题切换）
- 筛选栏：sticky 胶囊，选中项金色渐变 + 金色外发光
- 统计卡：6 列（移动 3 列 / ≤379px 2 列），**全部可点击**，见下节
- 按钮：主按钮金色渐变 + 悬停光泽扫过（`::after` 115° 高光，0.55s）；次按钮玻璃描边，悬停转金色
- 分类 chip：可点击，悬停上浮 + 圆点放大发光
- 轻提示 toast：底部居中胶囊，金色描边，2.6s 自动消失

## 交互约定（按键都有实际作用）
| 控件 | 行为 |
|---|---|
| 浏览全部信息 | 清空搜索 / 分类 / 所有开关 → 滚动到列表 → toast「已显示全部 N 条信息」 |
| 搜索内容 | 滚回顶部并聚焦搜索框（带 `/` 快捷键提示） |
| 分类 chip（通知公告 / 校历考试 / 竞赛比赛 / 全部信息） | 直达该分类；无数据时 toast 提示并回到全部 |
| 统计卡 · 全部信息 | 回到全部并清除筛选，卡片高亮 |
| 统计卡 · 学生通知 | 切换「只看学生通知」，卡片高亮 |
| 统计卡 · 新增通知 | 切换「只看 NEW」（7 天内），卡片高亮 |
| 统计卡 · 最新发布 | 只看最新一天的通知 |
| 统计卡 · 待确认 | 展开「更多通知」并滚到该区块 |
| 统计卡 · 信息来源 | 新窗口打开学校官网 |
| 主题切换（月亮/太阳） | 深色 ↔ 浅色，写入 localStorage |

## Motion
- hover 160–180ms ease；卡片上浮 3px；弹窗 220–240ms cubic-bezier(.2,.8,.2,1)
- 按钮光泽、统计卡顶部金线 `transform: scaleX` 过渡
- `prefers-reduced-motion` 下关闭光泽与位移

## Accessibility
- WCAG 2.1 AA；`focus-visible` 2px 实线 + 2px offset
- 统计卡为原生 `<button>`，带 `aria-label`；激活态 `aria-current="true"`
- 语义化 header/nav/main/section/article；tablist 键盘方向键；弹窗焦点圈定 + Esc 关闭
- toast 使用 `role="status"` + `aria-live="polite"`

## 变更记录
- 2026-11-26（早）：由「暖纸编辑感」切换为「深色玻璃拟态」，新增 hero 与统计卡，筛选栏改胶囊玻璃
- 2026-11-26（晚）：配色切换为小麦 / 稻草 / 土壤色板（深色 + 浅色双主题）；
  按钮、分类 chip、统计卡全部接入交互；新增 toast 提示；修复浅色主题变量被深色覆盖的问题