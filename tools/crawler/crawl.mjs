#!/usr/bin/env node
// 增量抓取河南科技学院「通知公告」（全校 / 学工部、学生处 / 教务处），合并进 web/data/school_data.js
// 用法：node tools/crawler/crawl.mjs [--pages=2] [--max-new=30] [--reclassify] [--dry-run] [--data=web/data/school_data.js]
// 分众规则：data/audience_rules.json（文件不存在时使用内置默认）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTIONS = [
  { name: '全校通知', url: 'https://www.hist.edu.cn/index/tzgg.htm' },
  { name: '学工部、学生处', url: 'https://www.hist.edu.cn/index/tzgg/xgb_xsc.htm' },
  { name: '教务处', url: 'https://www.hist.edu.cn/index/tzgg/jwc.htm' }
];
const RULES_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/audience_rules.json');
const UA = 'Mozilla/5.0 (compatible; campus-info-crawler/1.0; student project)';
const MAX_DAYS_NEW = 7;
const SUMMARY_LEN = 60;

// 兜底规则：仅在 data/audience_rules.json 缺失时使用。
// 内容与 audience_rules.json 保持一致，改动时请同步两处（不一致会导致静默回退到旧表）。
const DEFAULT_RULES = {
  teacher: ['教师', '教职工', '教工', '师德', '师资', '职称', '工资', '采暖', '物业费', '绩效', '聘任', '人才引进', '博士后', '骨干教师', '班主任', '课堂教学创新', '教学名师', '研究生导师', '教改', '课改', '科研项目', '实验室建设', '学位点', '经费', '招标', '专项摸排', '科级干部', '研判', '专家库', '辅导员', '先进单位'],
  student: ['学生', '大学生', '本科生', '在校生', '研究生', '新生', '毕业生', '同学', '奖助学金', '助学金', '奖学金', '困难认定', '助学贷款', '勤工助学', '选课', '课表', '考试', '补考', '重修', '四六级', '毕业', '学位', '实习', '就业', '双选会', '挑战杯', '竞赛', '大赛', '社团', '宿舍', '心理健康', '心理咨询', '体检', '医保', '接种', '军训', '开学', '注册', '学籍', '教材', '宣传月', '诵写讲', '师范生', '教学技能大赛', '创意河南', '维普杯', '技能竞赛', '征文', '摄影比赛', '宣传教育活动', '安全教育', '思想动态', '学情', '换岗', '空缺岗位', '国奖', '传染', '讲座', '报名', '比赛', '征集'],
  teacher_strong: ['辅导员', '科级干部', '教职工', '师德', '师资', '职称', '工资', '采暖', '物业费', '绩效', '骨干教师', '课堂教学创新', '教学名师', '研究生导师', '先进单位', '专家库', '学位点', '研判', '专项摸排', '经费', '招标'],
  student_strong: ['大学生', '本科生', '在校生', '新生', '毕业生', '同学', '师范生', '奖助学金', '助学金', '奖学金', '困难认定', '助学贷款', '勤工助学', '选课', '课表', '四六级', '双选会', '挑战杯', '宿管', '心理健康', '心理咨询', '军训', '学籍', '毕业设计', '毕业论文', '国奖'],
  student_terms: ['特岗教师', '教师资格证', '教师资格考试', '教师招聘'],
  ignore: ['各学院', '各学院（书院）', '各书院', '各单位', '各部门', '全校各单位', '各研究生培养单位']
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(words) {
  const list = words.filter((w) => typeof w === 'string' && w.trim());
  return list.length ? new RegExp(list.map(escapeRegExp).join('|')) : null;
}

function loadAudienceRules() {
  let raw;
  try {
    raw = fs.readFileSync(RULES_FILE, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`读取分众规则 ${RULES_FILE} 失败：${err.message}`);
    console.log(`[crawl] 未找到 ${RULES_FILE}，使用内置分众规则`);
    return DEFAULT_RULES;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`分众规则 ${RULES_FILE} 不是合法 JSON：${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`分众规则 ${RULES_FILE} 顶层必须是对象`);
  }
  const pick = (key) => {
    if (!(key in parsed)) return DEFAULT_RULES[key];
    if (!Array.isArray(parsed[key])) throw new Error(`分众规则 ${RULES_FILE} 的 ${key} 必须是字符串数组`);
    return parsed[key];
  };
  // 规则文件存在但缺少某个 key 时会静默回退到内置表，漂移很难被发现，这里显式提示。
  const declared = ['teacher', 'student', 'ignore'];
  const optional = ['teacher_strong', 'student_strong', 'student_terms'];
  const missingRequired = declared.filter((k) => !(k in parsed));
  if (missingRequired.length) {
    console.warn(`[crawl] 警告：${RULES_FILE} 缺少 ${missingRequired.join(' / ')}，这些项回退到内置规则`);
  }
  const missingOptional = optional.filter((k) => !(k in parsed));
  if (missingOptional.length) {
    console.warn(`[crawl] 警告：${RULES_FILE} 缺少 ${missingOptional.join(' / ')}，冲突判定将退化为「两边都命中即 unknown」`);
  }
  return {
    teacher: pick('teacher'),
    student: pick('student'),
    ignore: pick('ignore'),
    teacher_strong: pick('teacher_strong'),
    student_strong: pick('student_strong'),
    student_terms: pick('student_terms')
  };
}

const RULES = loadAudienceRules();
const TEACHER_RE = buildRegex(RULES.teacher);
const STUDENT_RE = buildRegex(RULES.student);
const IGNORE_TERMS = RULES.ignore.filter((w) => typeof w === 'string' && w.trim());

function parseArgs(argv) {
  const opts = { pages: 2, maxNew: 30, dryRun: false, reclassify: false, data: 'web/data/school_data.js' };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--reclassify') opts.reclassify = true;
    else if (arg.startsWith('--pages=')) opts.pages = Math.min(10, Math.max(1, Number(arg.slice(8)) || 1));
    else if (arg.startsWith('--max-new=')) opts.maxNew = Math.min(100, Math.max(1, Number(arg.slice(10)) || 1));
    else if (arg.startsWith('--data=')) opts.data = arg.slice(7);
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
    mdash: '—', ndash: '–', middot: '·', times: '×', laquo: '《', raquo: '》'
  };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name] ?? m)
    .replace(/&nbsp;/gi, ' ');
}

async function get(url, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < tries) await sleep(1500 * i);
    }
  }
  throw lastErr;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseList(html) {
  const items = [];
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
    const block = m[1];
    if (!/<time>/i.test(block)) continue;
    const time = block.match(/<time>\s*<span>(\d{1,2})<\/span>\s*<em>(\d{4})\.(\d{1,2})<\/em>/i);
    const link = block.match(/<a[^>]+href="([^"]*\/info\/\d+\/\d+\.htm)"[^>]*>/i);
    if (!time || !link) continue;
    const titleAttr = link[0].match(/\btitle="([^"]*)"/i);
    const h3 = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = decodeEntities(titleAttr ? titleAttr[1] : h3 ? h3[1].replace(/<[^>]+>/g, '') : '').trim();
    if (!title) continue;
    const date = `${time[2]}-${pad(time[3])}-${pad(time[1])}`;
    items.push({ title, date, href: link[1] });
  }
  return items;
}

function parseNext(html) {
  const m = html.match(/class="p_next[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"/i);
  return m ? m[1] : '';
}

function findDivEnd(html, from) {
  const re = /<(\/?)div\b[^>]*>/gi;
  re.lastIndex = from;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return html.length;
}

function extractNewsText(html) {
  const open = html.match(/<div[^>]*class="[^"]*v_news_content[^"]*"[^>]*>/i);
  if (!open) return '';
  const start = open.index + open[0].length;
  const frag = html
    .slice(start, findDivEnd(html, start))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/th)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(frag).replace(/[\s\u200b-\u200d\ufeff]+/g, ' ').trim();
}

function makeSummary(text) {
  if (!text) return '';
  if (text.length <= SUMMARY_LEN) return text;
  return text.slice(0, SUMMARY_LEN).trimEnd() + '…';
}

// 强学生信号：通知明确把学生作为主体，命中时应当压过 teacher 里的宽泛词
// （例如「大学生…遴选结果」「特岗教师招聘报名」里的「遴选」「教师」）。
const STUDENT_STRONG_RE = buildRegex(RULES.student_strong || []);
// 强教师信号：命中时即使标题里出现「学生」也归教师
// （例如「关于做好学生工作的通知」发给学工队伍、「辅导员素质能力大赛」）。
const TEACHER_STRONG_RE = buildRegex(RULES.teacher_strong || []);
// 学生专有名词：这些词里的「教师」是固定搭配，不代表受众是教师。
// 例如「特岗教师招聘报名」实际面向应届毕业生报名，「教师资格证考试」面向学生。
const STUDENT_TERM_RE = buildRegex(RULES.student_terms || []);

function classifyAudience(title) {
  let text = title;
  for (const term of IGNORE_TERMS) text = text.split(term).join(' ');

  // 先把学生专有名词抹掉，避免其中的「教师」触发 teacher 判定。
  const teacherText = STUDENT_TERM_RE ? text.replace(STUDENT_TERM_RE, ' ') : text;
  const isTeacher = Boolean(TEACHER_RE && TEACHER_RE.test(teacherText));
  const isStudent = Boolean(STUDENT_RE && STUDENT_RE.test(text));
  if (!isTeacher && !isStudent) return 'unknown';
  if (isTeacher && !isStudent) return 'teacher';
  if (isStudent && !isTeacher) return 'student';

  // 两边都命中：按强信号消解冲突，仍然分不出就归到 unknown（折叠区），
  // 宁可少显示，也不把教师通知推给学生。
  const strongStudent = Boolean(STUDENT_STRONG_RE && STUDENT_STRONG_RE.test(text));
  const strongTeacher = Boolean(TEACHER_STRONG_RE && TEACHER_STRONG_RE.test(text));
  if (strongStudent && !strongTeacher) return 'student';
  if (strongTeacher && !strongStudent) return 'teacher';
  return 'unknown';
}

function todayShanghai() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function nowShanghai() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
}

function daysAgo(dateStr, todayStr) {
  const a = Date.parse(`${dateStr}T00:00:00Z`);
  const b = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.round((b - a) / 86400000);
}

function readExisting(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/window\.SCHOOL_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!m) throw new Error(`无法解析 ${file}，请确认文件格式为 window.SCHOOL_DATA = [...]`);
  const arr = JSON.parse(m[1]);
  if (!Array.isArray(arr)) throw new Error(`${file} 的顶层不是数组`);
  return arr;
}

function recordOf(o) {
  return {
    id: o.id,
    category: o.category,
    title: o.title,
    date: o.date,
    source_url: o.source_url,
    summary: o.summary,
    is_new: o.is_new,
    updated_at: o.updated_at,
    audience: o.audience
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dataFile = path.resolve(opts.data);
  const existing = readExisting(dataFile);
  const knownUrls = new Set(existing.map((r) => r.source_url));
  const knownTitles = new Set(existing.map((r) => r.title));
  console.log(`[crawl] 现有 ${existing.length} 条 · 每板块最多抓 ${opts.pages} 页 · 数据文件 ${dataFile}`);

  const listed = [];
  const listedUrls = new Set();
  for (const section of SECTIONS) {
    let pageUrl = section.url;
    for (let page = 1; page <= opts.pages && pageUrl; page++) {
      const html = await get(pageUrl);
      const items = parseList(html);
      console.log(`[crawl] ${section.name} 第 ${page} 页：${items.length} 条`);
      for (const item of items) {
        const url = new URL(item.href, pageUrl).href;
        if (listedUrls.has(url)) continue;
        listedUrls.add(url);
        listed.push({ ...item, source_url: url });
      }
      const next = parseNext(html);
      pageUrl = next ? new URL(next, pageUrl).href : '';
      if (page < opts.pages && pageUrl) await sleep(600);
    }
  }
  console.log(`[crawl] ${SECTIONS.length} 个板块按 source_url 去重后共 ${listed.length} 条`);

  const fresh = listed.filter((item) => !knownUrls.has(item.source_url) && !knownTitles.has(item.title));
  const skipped = listed.length - fresh.length;
  console.log(`[crawl] 列表 ${listed.length} 条，其中已知/重复 ${skipped} 条，待抓取详情 ${fresh.length} 条`);
  if (fresh.length > opts.maxNew) {
    console.log(`[crawl] 新条目超过 ${opts.maxNew} 条，本次只处理最新的 ${opts.maxNew} 条，其余下次继续（或调大 --pages / --max-new）`);
    fresh.length = opts.maxNew;
  }

  const today = todayShanghai();
  const stamp = nowShanghai();
  const created = [];
  let failed = 0;

  for (const item of fresh) {
    try {
      await sleep(1000);
      const html = await get(item.source_url);
      const dateFromPage = (html.match(/发布时间[：:]\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
      const date = dateFromPage || item.date;
      const metaTitle = html.match(/<meta[^>]*name="pageTitle"[^>]*content="([^"]*)"/i)
        || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="pageTitle"/i);
      const title = decodeEntities(metaTitle ? metaTitle[1] : item.title).trim() || item.title;
      const text = extractNewsText(html);
      const summary = makeSummary(text);

      const pathMatch = new URL(item.source_url).pathname.match(/^\/info\/(\d+)\/(\d+)\.htm$/);
      if (!pathMatch) throw new Error('无法解析文章栏目/编号');
      const id = `${date.replace(/-/g, '')}-${pathMatch[1]}-${pathMatch[2]}`;
      if (existing.some((r) => r.id === id)) {
        console.log(`[crawl] 跳过（ID 已存在）：${title}`);
        continue;
      }

      const audience = classifyAudience(title);
      created.push(recordOf({
        id,
        category: '通知公告',
        title,
        date,
        source_url: item.source_url,
        summary,
        is_new: daysAgo(date, today) <= MAX_DAYS_NEW,
        updated_at: stamp,
        audience
      }));
      console.log(`[crawl] 新增 [${audience}] ${date} ${title}`);
    } catch (err) {
      failed++;
      console.warn(`[crawl] 抓取失败 ${item.source_url}：${err.message}`);
    }
  }

  const merged = [...created, ...existing.map(recordOf)]
    .map((r) => ({ ...r, is_new: daysAgo(r.date, today) <= MAX_DAYS_NEW }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  let audienceChanged = false;
  if (opts.reclassify) {
    for (const r of merged) {
      const next = classifyAudience(r.title);
      if (next !== r.audience) audienceChanged = true;
      r.audience = next;
    }
    const rc = merged.reduce((acc, r) => {
      acc[r.audience] = (acc[r.audience] || 0) + 1;
      return acc;
    }, {});
    console.log(`[crawl] 重新分类完成：student ${rc.student || 0} / unknown ${rc.unknown || 0} / teacher ${rc.teacher || 0}`);
  }

  const newFlagChanged = merged.some((r) => {
    const old = existing.find((o) => o.id === r.id);
    return old && Boolean(old.is_new) !== r.is_new;
  });
  const changed = created.length > 0 || newFlagChanged || audienceChanged;

  const counts = merged.reduce((acc, r) => {
    acc[r.audience] = (acc[r.audience] || 0) + 1;
    return acc;
  }, {});
  console.log(`[crawl] 合并后共 ${merged.length} 条（student ${counts.student || 0} / unknown ${counts.unknown || 0} / teacher ${counts.teacher || 0}），失败 ${failed} 条`);

  if (!changed) {
    console.log('[crawl] 没有新内容，未修改数据文件');
    return;
  }
  if (opts.dryRun) {
    console.log(`[crawl] --dry-run：将写入 ${created.length} 条新数据，未落盘`);
    return;
  }

  const out = merged.map((r) => recordOf({ ...r, updated_at: stamp }));
  fs.writeFileSync(dataFile, `window.SCHOOL_DATA = ${JSON.stringify(out, null, 2)};\n`, 'utf8');
  const marker = path.resolve(path.dirname(dataFile), '..', '..', '.pending-publish');
  fs.writeFileSync(marker, `${stamp}\n`, 'utf8');
  console.log(`[crawl] 已写入 ${dataFile}（更新于 ${stamp}）`);
  console.log(`[crawl] 已标记待发布：${marker}`);
}

main().catch((err) => {
  console.error(`[crawl] 失败：${err.stack || err.message}`);
  process.exit(1);
});
