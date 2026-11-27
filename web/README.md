# web/ —— 前端展示

学校信息聚合网站的静态页面。纯 HTML / CSS / JS，**零依赖、零构建**，把 `web/` 目录整个丢到任意静态托管上即可访问。

## 本地运行

数据通过 `<script>` 方式引入，不依赖接口请求，直接双击 `index.html` 也能预览。若想与线上路径行为一致，建议用本地服务器打开：

```bash
# 在仓库根目录执行（Python 3）
python -m http.server 8000
# 然后访问 http://localhost:8000/web/
```

或使用 Node：

```bash
npx serve web
```

## 数据怎么接入

数据以**脚本方式**引入，不使用 fetch（静态托管下 fetch 有跨域/路径风险，容易出现白屏）：

```html
<script src="./data/school_data.js"></script>
<script src="./js/app.js"></script>
```

`data/school_data.js` 的内容形如 `window.SCHOOL_DATA = [ ... ]`，顶层为数组。页面从 `window.SCHOOL_DATA` 读取。该文件由 `tools/crawler/crawl.mjs` 每小时增量生成（见下文），也可以手动覆盖，前端代码无需改动。

每条记录的 `audience` 字段决定展示方式：

| audience | 含义 | 展示规则 |
|---|---|---|
| `student` | 学生通知 | 主列表默认展示 |
| `unknown` | 接收对象不明 | 折叠在页面底部「更多通知」中，默认收起 |
| `teacher` | 教师通知 | 前端不展示（不进入列表、搜索和计数） |

卡片消费的字段：`title` / `date` / `summary` / `is_new` / `source_url`。字段顺序与 schema 一致，前端只读不改。
额外的分类值会自动生成对应 Tab；缺少 `summary` 时卡片自动隐藏摘要行；`source_url` 只放行 `http/https` 链接。

## 已实现的功能

- 顶部「全部 + 分类」Tab（吸顶），计数只统计学生通知与待确认通知；分类 Tab 支持键盘左右键切换
- 主列表：`student` 通知卡片（分类色条、NEW 角标、日期、60 字摘要、查看原文）
- 「更多通知」：`unknown` 通知折叠区，默认收起；点击查看即视为确认接收，确认后移出待确认列表（保存在本地）
- 本地搜索：标题 + 摘要，支持空格分隔多个关键词，命中词高亮，覆盖主列表与「更多通知」
- 详情弹窗：点击卡片或标题打开，含完整摘要与「前往官网原文」；支持 Esc / 点遮罩关闭
- 状态可见：空数据兜底、数据文件未加载提示 + 重试、页面底部「数据更新于 X」
- 响应式：手机单列、≥820px 双列；移动端弹窗为底部抽屉；触控目标 ≈44px
- 其他：`/` 聚焦搜索、回到顶部、`prefers-reduced-motion` 适配、打印样式

## 数据自动更新

`tools/crawler/crawl.mjs` 是零依赖的增量爬虫：抓取官网通知列表，只对**新文章**请求详情页，合并后重写 `web/data/school_data.js`。

```bash
node tools/crawler/crawl.mjs --pages=2        # 抓前 2 页（16 条）里的新通知
node tools/crawler/crawl.mjs --pages=2 --dry-run   # 只看结果不落盘
```

- 增量：按 `source_url` / 标题去重，已有记录不重复抓取；已有 `audience` 标签原样保留，只对新增条目按标题关键词自动判断，拿不准的一律归入 `unknown`（显示在「更多通知」）
- 摘要：取详情页正文前 60 字；`is_new` 按通知日期 3 天内自动计算；无新增时不会改写文件，页脚「数据更新于」保持上次真实变更时间
- 礼貌抓取：固定 UA、请求间隔 1 秒、失败重试 3 次；官网没有 `robots.txt`（返回 404 页面），仍建议保持低频率
- 定时任务：`.github/workflows/update-data.yml` 每小时第 17 分钟抓取并提交到仓库；本机 Qoder 自动化每小时第 25 分钟执行同样的增量抓取，发现新数据时自动重新发布 Qoder Site。爬虫写入数据后会留下 `.pending-publish` 标记，发布成功才删除，发布失败则下一小时继续重试（本机自动化需保持 Qoder 桌面端运行）

## 目录结构

```
.
├── web/
│   ├── index.html            # 页面骨架（含 school_data.js 的 script 引入）
│   ├── css/styles.css        # 全部样式（无外部字体/图片）
│   ├── js/app.js             # 数据读取、audience 分层、筛选、渲染、弹窗
│   ├── data/school_data.js   # 爬虫生成的 window.SCHOOL_DATA
│   └── README.md
├── tools/crawler/crawl.mjs   # 官网通知增量爬虫（Node ≥ 18）
└── .github/workflows/update-data.yml   # 每小时自动更新
```

## 部署

- **Qoder Sites / Vercel / Netlify**：站点根目录指向 `web`，构建命令留空；确保 `data/school_data.js` 一并上传
- **GitHub Pages**：把 `web/` 内容发布到 Pages 分支根目录
- **校园服务器**：把 `web/` 下所有文件（含 `data/school_data.js`）上传到网站目录

部署后检查两点：`index.html` 与 `data/` 同级；页面底部能显示「数据更新于 … · 共 N 条信息」。
