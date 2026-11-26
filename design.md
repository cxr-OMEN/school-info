# 校园信息港 · 设计系统

定位：校园公告的「每日简报」。编辑感、纸张感、克制；信息优先，装饰退后。

## Colors

Light
- Background: #f4f1ea（暖纸）
- Surface: #fffdf8
- Surface 2: #f3eee4（分类轨道、摘要块）
- Text Primary: #1b2027
- Text Secondary: #4a5361
- Text Muted: #5f6a79（对比度 ≥ 4.5:1）
- Border: #e4ded1 / #d2cabb
- Brand（墨蓝）: #24384f；Brand Deep: #16283c
- Accent（印章红）: #a8432f；Accent Soft: #f6e6df
- Success/Live: #1f6f5c
- Category: 通知 #23608f / 校历 #0e6b60 / 竞赛 #a14a12 / 其他 #5b6473

Dark（`html[data-theme="dark"]`）
- Background: #111318；Surface: #181b22；Surface 2: #1f232c
- Text: #eceff4 / #b4bcc9 / #939cab
- Border: #2a2f3a / #3a4150
- Brand link: #a9c3e3；Primary button: #e8edf6 底 + #131820 字
- Accent: #e8756a；Category 颜色整体提亮

## Typography
- Sans: PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, system-ui, sans-serif
- Mono（日期/数字）: ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace
- Serif（仅大号日期数字）: Georgia, Songti SC, Noto Serif CJK SC, serif
- 品牌 18px/650；列表标题 18px/650；卡片标题 16.5px/600；正文 14–15px/1.65
- 辅助信息 12–12.5px；数字启用 tabular-nums

## Spacing
- 基准 4px；间距 4 / 8 / 12 / 16 / 20 / 24 / 32 / 44
- 容器 1000px；移动端左右 16px

## Components
- 圆角：卡片 18px；面板 22px；小控件 10–12px；胶囊 999px
- 阴影：1px 静置 / 18px 悬浮 / 40px 弹窗，均低透明度
- 卡片：1px 边框 + 3px 分类色左侧条；hover 上浮 3px；首条在桌面端通栏（bento）
- 按钮：最小 44×44；主按钮墨蓝；图标按钮圆形玻璃
- 输入：44px 高，focus 显示 3px 柔和 ring
- 顶栏/分类栏：半透明 + backdrop blur；分类栏 sticky
- 弹窗：桌面居中、移动端底部抽屉（拖拽把手）

## Motion
- hover 160–180ms ease；弹窗 220–240ms cubic-bezier(.2,.8,.2,1)
- NEW 圆点 2.4s 脉冲；`prefers-reduced-motion` 下全部关闭

## Accessibility
- WCAG 2.1 AA；`focus-visible` 2px 实线 + 2px offset
- 语义化 header/nav/main/section/article；tablist 键盘方向键
- 弹窗焦点圈定 + Esc 关闭；跳转主内容链接
