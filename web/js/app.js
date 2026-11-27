(function () {
  'use strict';

  /* 数据通过 <script src="./data/school_data.js"> 引入（window.SCHOOL_DATA），
     不使用 fetch：静态托管下 fetch 存在跨域/路径风险，脚本引入最稳。 */
  const DATA_URL = './data/school_data.js';

  const TOPICS = [
    '教学教务', '奖助学金', '科研竞赛', '就业实习', '校园活动',
    '心理健康', '学生事务', '安全后勤', '组织人事', '综合事务'
  ];
  const TOPIC_SHORT = {
    '教学教务': '教学',
    '奖助学金': '奖助',
    '科研竞赛': '科研',
    '就业实习': '就业',
    '校园活动': '活动',
    '心理健康': '心理',
    '学生事务': '学工',
    '安全后勤': '安全',
    '组织人事': '组织',
    '综合事务': '综合'
  };
  const TOPIC_CLASS = {
    '教学教务': 'cat-teach',
    '奖助学金': 'cat-aid',
    '科研竞赛': 'cat-research',
    '就业实习': 'cat-career',
    '校园活动': 'cat-campus',
    '心理健康': 'cat-mental',
    '学生事务': 'cat-student',
    '安全后勤': 'cat-safety',
    '组织人事': 'cat-org',
    '综合事务': 'cat-misc'
  };
  const ALL = '*';
  const CONFIRMED_KEY = 'campus-confirmed';

  /* 标题关键词分类。顺序即优先级，先命中先归类。 */
  const TOPIC_RULES = [
    ['安全后勤', /消防|防火|灭火|安全|应急|防灾|防汛|防溺水|溺水|水域|人工湖|保卫|反诈|诈骗|禁毒|毒品|交通|出行|饮食|食品|食堂|医疗|体检|疫苗|传染病|公寓安全|宿舍安全|水电|供暖|维修|后勤|校园卡|网络安全|信息化|门禁|卫生/],
    ['就业实习', /就业|求职|招聘|双选|宣讲|实习|职业生涯|职业规划|职业技能|特岗|选调生|三支一扶|西部计划|供需对接|用人单位|简历|面试|创业补贴|创业孵化|众创|就业育人/],
    ['心理健康', /心理健康|心理咨询|心理服务|心理育人|心理危机|心理测评|心理委员|心理公开课|心理/],
    ['奖助学金', /奖学金|助学金|助学贷款|国家助学|勤工助学|资助|困难学生|困难认定|绿色通道|补助|补贴|减免|奖助|助学/],
    ['学生事务', /评优|评奖|评先|表彰|优秀学生|优秀毕业生|优秀宿舍|文明宿舍|学风|班级|学生干部|军训|征兵|保险|医保|思想动态|思想状况|学生工作|辅导员|新生|迎新|离校|毕业教育|宿舍文化|家长|学生事务/],
    ['校园活动', /摄影|征文|征稿|歌曲|情景剧|短视频|诵|书法|绘画|设计大赛|微电影|动漫|海报|文艺|晚会|演出|展览|社团|运动会|文化节|艺术节|读书|典礼|升旗|联欢|汇演/],
    ['教学教务', /教务|教学|课程|教材|选课|考试|补考|重修|成绩|学籍|转专业|培养方案|毕业|学位|论文|答辩|实践教学|实验教学|实验课|四六级|普通话|期末|期中|教考|课表|学分|辅修|双学位|专升本|招生|录取|交流生|交换生|国际交流|访学|微专业|专业建设|一流专业|工程认证|师范专业|学情/],
    ['组织人事', /党建|党员|党支部|党课|党委|党总支|主题党日|干部|人事|职称|任免|公示|会议|培训|主题教育|巡察|廉政|意识形态|统战|工会|教代会|人才/],
    ['科研竞赛', /科研|课题|项目|申报|基金|自然科学|社会科学|成果|专利|竞赛|大赛|挑战赛|挑战杯|互联网\+|创新创业|创业|学科竞赛|数学建模|技能大赛|选拔赛|训练计划|科普|学术|创新年会|实验室|研发|重点研发|科技/],
    ['校园活动', /比赛|活动|讲座|报告|论坛|沙龙|志愿者|招募|艺术|音乐|舞蹈|戏剧|戏曲|朗诵|主持/]
  ];

  function topicOf(title) {
    for (let i = 0; i < TOPIC_RULES.length; i += 1) {
      if (TOPIC_RULES[i][1].test(title)) return TOPIC_RULES[i][0];
    }
    return '综合事务';
  }

  const state = {
    items: [],        // 仅保留 audience 为 student / unknown 的记录
    tab: ALL,
    query: '',
    moreOpen: false,  // 「更多通知」（unknown）默认收起
    onlyNew: false,   // 只看 7 天内的新增
    latestOnly: false,// 只看最新一天发布
    audienceOnly: null, // 'student' | null
    status: 'loading' // loading | ready | error
  };

  const confirmed = new Set(); // 已确认接收的 unknown 通知 id

  const $ = (id) => document.getElementById(id);
  const dom = {
    tabs: $('tabs'),
    totalCount: $('totalCount'),
    main: $('main'),
    listTitle: $('listTitle'),
    listHint: $('listHint'),
    list: $('list'),
    more: $('more'),
    moreToggle: $('moreToggle'),
    moreCount: $('moreCount'),
    moreNote: $('moreNote'),
    moreList: $('moreList'),
    notice: $('notice'),
    noticeText: $('noticeText'),
    retry: $('retry'),
    footerStatus: $('footerStatus'),
    q: $('q'),
    qClear: $('qClear'),
    modal: $('modal'),
    mPanel: $('mPanel'),
    mCat: $('mCat'),
    mNew: $('mNew'),
    mTitle: $('mTitle'),
    mMeta: $('mMeta'),
    mSummary: $('mSummary'),
    mHint: $('mHint'),
    mLink: $('mLink'),
    mClose: $('mClose'),
    toTop: $('toTop'),
    stats: $('stats'),
    briefDay: $('briefDay'),
    briefMonth: $('briefMonth'),
    briefWeek: $('briefWeek'),
    briefUpdated: $('briefUpdated'),
    briefUpdatedLabel: $('briefUpdatedLabel'),
    themeToggle: $('themeToggle')
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollBehavior = () => (reduceMotion.matches ? 'auto' : 'smooth');

  /* ------------------------------ 主题 ------------------------------ */

  const THEME_KEY = 'campus-theme';

  function applyTheme(theme, persist) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('themeColor');
    if (meta) meta.setAttribute('content', dark ? '#14100a' : '#f6efdf');
    if (dom.themeToggle) {
      dom.themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      dom.themeToggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
      dom.themeToggle.title = dark ? '切换到浅色模式' : '切换到深色模式';
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    }
  }

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
  }

  applyTheme(document.documentElement.dataset.theme, false);

  if (dom.themeToggle) {
    dom.themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemTheme = (e) => {
    if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light', false);
  };
  if (themeMedia.addEventListener) themeMedia.addEventListener('change', onSystemTheme);
  else if (themeMedia.addListener) themeMedia.addListener(onSystemTheme);

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function catClass(topic) {
    return TOPIC_CLASS[topic] || 'cat-misc';
  }

  function safeUrl(raw) {
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  /* ------------------------------ 数据 ------------------------------ */

  function normalize(raw) {
    const out = [];
    raw.forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      const title = String(r.title == null ? '' : r.title).trim();
      if (!title) return;

      const audience = ['student', 'unknown', 'teacher'].indexOf(r.audience) !== -1 ? r.audience : 'unknown';
      if (audience === 'teacher') return; // 教师通知不在前端展示

      const date = String(r.date == null ? '' : r.date).trim();
      out.push({
        id: String(r.id == null || r.id === '' ? 'auto-' + i : r.id),
        category: String(r.category == null ? '' : r.category).trim() || '其他',
        topic: topicOf(title),
        title: title,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
        source_url: String(r.source_url == null ? '' : r.source_url).trim(),
        summary: String(r.summary == null ? '' : r.summary).trim(),
        is_new: r.is_new === true,
        updated_at: String(r.updated_at == null ? '' : r.updated_at).trim(),
        audience: audience
      });
    });
    out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return out;
  }

  function loadConfirmed() {
    try {
      const raw = JSON.parse(localStorage.getItem(CONFIRMED_KEY) || '[]');
      if (Array.isArray(raw)) {
        raw.forEach((id) => { if (typeof id === 'string') confirmed.add(id); });
      }
    } catch (_) {}
  }

  function saveConfirmed() {
    try { localStorage.setItem(CONFIRMED_KEY, JSON.stringify(Array.from(confirmed))); } catch (_) {}
  }

  function pruneConfirmed() {
    const valid = new Set();
    state.items.forEach((it) => { if (it.audience !== 'student') valid.add(it.id); });
    let changed = false;
    Array.from(confirmed).forEach((id) => {
      if (!valid.has(id)) {
        confirmed.delete(id);
        changed = true;
      }
    });
    if (changed) saveConfirmed();
  }

  function isConfirmed(it) {
    return it.audience !== 'student' && confirmed.has(it.id);
  }

  function pendingUnknown(items) {
    const list = items || state.items;
    return list.filter((it) => it.audience !== 'student' && !confirmed.has(it.id));
  }

  function availableItems(items) {
    const list = items || state.items;
    return list.filter((it) => it.audience === 'student' || !confirmed.has(it.id));
  }

  function updateMoreNote(items) {
    if (!dom.moreNote) return;
    dom.moreNote.textContent = items.length
      ? '点击查看即视为确认接收 · 待确认 ' + items.length + ' 条'
      : '';
  }

  function confirmItem(it) {
    if (!it || it.audience === 'student' || confirmed.has(it.id)) return false;
    confirmed.add(it.id);
    saveConfirmed();
    buildTabs();
    render();
    return true;
  }

  function loadFromScript() {
    if (!Array.isArray(window.SCHOOL_DATA)) {
      showError();
      return;
    }
    state.items = normalize(window.SCHOOL_DATA);
    state.status = 'ready';
    confirmed.clear();
    loadConfirmed();
    pruneConfirmed();
    setNotice('');
    buildTabs();
    render();
    openFromHash();
  }

  function showError() {
    state.items = [];
    state.status = 'error';
    buildTabs();
    render();
    setNotice('数据文件未加载（data/school_data.js）。请确认该文件与 index.html 一起部署（位于 web/data/ 目录），然后点击「重试」。');
  }

  async function reloadScript() {
    dom.retry.disabled = true;
    setNotice('');
    dom.footerStatus.textContent = '正在重新加载数据…';
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = DATA_URL + '?t=' + Date.now();
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch (_) {
      // 交给下面的加载检查统一报错
    }
    dom.retry.disabled = false;
    loadFromScript();
  }

  /* ------------------------------ 筛选 ------------------------------ */

  function searchTerms() {
    return state.query.toLowerCase().split(/\s+/).filter(Boolean);
  }

  function newestDate() {
    let newest = '';
    state.items.forEach((it) => {
      if (it.date && it.date > newest) newest = it.date;
    });
    return newest;
  }

  function visibleMatches() {
    const terms = searchTerms();
    const newest = state.latestOnly ? newestDate() : '';
    const base = state.items.filter((it) => {
      if (state.tab !== ALL && it.topic !== state.tab) return false;
      if (state.onlyNew && !it.is_new) return false;
      if (newest && it.date !== newest) return false;
      if (state.audienceOnly === 'student' && it.audience !== 'student') return false;
      if (!terms.length) return true;
      const hay = (it.title + ' ' + it.summary).toLowerCase();
      return terms.every((t) => hay.indexOf(t) !== -1);
    });
    return {
      student: base.filter((it) => it.audience === 'student'),
      unknown: base.filter((it) => it.audience !== 'student')
    };
  }

  function latestUpdated() {
    let latest = '';
    state.items.forEach((it) => {
      if (it.updated_at > latest) latest = it.updated_at;
    });
    return latest;
  }

  function latestChecked() {
    const status = window.SCHOOL_STATUS;
    const value = status && typeof status === 'object' ? String(status.last_checked_at || '').trim() : '';
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ? value : '';
  }

  /* ------------------------------ 渲染 ------------------------------ */

  function render() {
    updateTabs();
    const result = visibleMatches();
    renderHead(result);
    renderLists(result);
    renderMore(result.unknown);
    renderFooter();
    renderBrief();
    renderStats();
  }

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function renderBrief() {
    if (!dom.briefDay) return;

    const now = new Date();
    dom.briefDay.textContent = pad2(now.getDate());
    dom.briefMonth.textContent = now.getMonth() + 1 + ' 月';
    dom.briefWeek.textContent = WEEKDAYS[now.getDay()];

    if (dom.briefUpdated) {
      const updated = state.status === 'ready' ? latestUpdated() : '';
      const checked = state.status === 'ready' ? latestChecked() : '';
      const shown = checked || updated;
      dom.briefUpdated.textContent = shown ? shown.slice(5) : '—';
      if (dom.briefUpdatedLabel) dom.briefUpdatedLabel.textContent = checked ? '最近检查' : '数据更新';
    }
  }

  /* 统计卡片图标：SVG，24×24，stroke 1.8，currentColor */
  const STAT_ICONS = {
    all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9h4"/><path d="M7 13h10"/><path d="M7 16.5h6"/></svg>',
    student: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/></svg>',
    fresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5v10"/><path d="m8 11 4 4 4-4"/><path d="M4.5 17.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1"/></svg>',
    latest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>',
    unknown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><circle cx="12" cy="15.8" r=".9" fill="currentColor" stroke="none"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z"/></svg>'
  };

  function statTile(def) {
    const clickable = typeof def.onClick === 'function' && state.status === 'ready';
    const tile = document.createElement(clickable ? 'button' : 'div');
    if (clickable) {
      tile.type = 'button';
      tile.className = 'stat stat--btn';
      tile.addEventListener('click', def.onClick);
      if (def.active) {
        tile.classList.add('is-active');
        tile.setAttribute('aria-current', 'true');
      }
    } else {
      tile.className = 'stat';
    }
    tile.setAttribute('role', 'listitem');

    const icon = document.createElement('span');
    icon.className = 'stat__icon';
    icon.innerHTML = STAT_ICONS[def.icon] || STAT_ICONS.all;

    const num = el('span', 'stat__num');
    num.textContent = String(def.value);

    const cap = el('span', 'stat__cap');
    cap.textContent = def.caption;

    tile.append(icon, num, cap);
    if (clickable) {
      tile.setAttribute('aria-label', def.a11y || def.caption + '：' + def.value + '，点击查看');
      tile.title = def.hint || '点击查看';
    }
    return tile;
  }

  /* 让页面滚到列表区域（避开吸顶头部与筛选栏） */
  function headHeight() {
    const head = document.querySelector('.site-head');
    return head ? head.offsetHeight : 0;
  }

  function scrollToList() {
    const bar = document.querySelector('.filterbar');
    const offset = (bar ? bar.offsetHeight : 56) + headHeight() + 14;
    const target = document.getElementById('feed') || dom.main;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: scrollBehavior() });
  }

  /* 数据卡是一组单选快捷视图：每次切换先清掉其它筛选，避免叠加高亮 */
  function clearSearchField() {
    state.query = '';
    if (dom.q) dom.q.value = '';
    if (dom.qClear) dom.qClear.hidden = true;
  }

  function resetQuickViews() {
    state.onlyNew = false;
    state.latestOnly = false;
    state.audienceOnly = null;
    state.moreOpen = false;
  }

  function scrollToMore() {
    if (!dom.more || dom.more.hidden) return;
    const top = dom.more.getBoundingClientRect().top + window.scrollY - headHeight() - 18;
    window.scrollTo({ top: Math.max(top, 0), behavior: scrollBehavior() });
  }

  function focusView(view) {
    const wasStudent = state.audienceOnly === 'student';
    const wasNew = state.onlyNew;
    const wasLatest = state.latestOnly;
    const wasOnlyMore = state.moreOpen && !state.onlyNew && !state.latestOnly &&
      !state.audienceOnly && !state.query;

    resetQuickViews();
    clearSearchField();
    state.tab = ALL;

    if (view === 'student') state.audienceOnly = wasStudent ? null : 'student';
    if (view === 'new') state.onlyNew = !wasNew;
    if (view === 'latest') state.latestOnly = !wasLatest;

    if (view === 'more') {
      if (wasOnlyMore) {
        render();
        scrollToList();
        return;
      }
      const pending = pendingUnknown().length;
      if (!pending) {
        flashToast('当前没有待确认的通知');
        render();
        scrollToList();
        return;
      }
      state.moreOpen = true;
      render();
      scrollToMore();
      return;
    }

    render();
    scrollToList();
  }

  function switchTabAndScroll(key) {
    // 「有内容」= 归一化后真正能展示的条目，而不是原始数据里存在的分类
    const hasData = key !== ALL && state.items.some((it) => it.topic === key);
    if (key !== ALL && !hasData) {
      flashToast('「' + key + '」暂无内容，已为你显示全部信息');
      state.tab = ALL;
      state.onlyNew = false;
      state.latestOnly = false;
      state.audienceOnly = null;
      state.moreOpen = false;
      render();
      scrollToList();
      return;
    }
    state.tab = key;
    state.onlyNew = false;
    state.latestOnly = false;
    state.audienceOnly = null;
    state.moreOpen = false;
    render();
    scrollToList();
    if (key === ALL) flashToast('已显示全部信息');
  }

  function renderStats() {
    if (!dom.stats) return;

    const ready = state.status === 'ready';
    const available = ready ? availableItems() : [];
    const student = ready ? available.filter((it) => it.audience === 'student').length : 0;
    const pending = ready ? pendingUnknown().length : 0;
    const fresh = ready ? available.filter((it) => it.is_new).length : 0;
    const latest = ready ? (latestUpdated() || '').slice(0, 10) : '';

    dom.stats.textContent = '';
    dom.stats.append(
      statTile({
        icon: 'all',
        value: ready ? available.length : '—',
        caption: '全部信息',
        active: state.tab === ALL && !state.query && !state.onlyNew &&
          !state.latestOnly && !state.audienceOnly && !state.moreOpen,
        onClick: () => focusView('all'),
        hint: '显示全部信息'
      }),
      statTile({
        icon: 'student',
        value: ready ? student : '—',
        caption: '学生通知',
        active: state.tab === ALL && !state.query && !state.onlyNew &&
          !state.latestOnly && state.audienceOnly === 'student',
        onClick: () => focusView('student'),
        hint: '只看接收对象为学生的通知'
      }),
      statTile({
        icon: 'fresh',
        value: ready ? fresh : '—',
        caption: '新增通知',
        active: state.tab === ALL && !state.query && state.onlyNew,
        onClick: () => focusView('new'),
        hint: '只看 7 天内的新通知'
      }),
      statTile({
        icon: 'latest',
        value: latest && latest !== '' ? latest.slice(5) : '—',
        caption: '最新发布',
        active: state.tab === ALL && !state.query && state.latestOnly,
        onClick: () => focusView('latest'),
        hint: '只看最新一天发布的通知'
      }),
      statTile({
        icon: 'unknown',
        value: ready ? pending : '—',
        caption: '待确认',
        active: state.tab === ALL && !state.query && !state.onlyNew &&
          !state.latestOnly && !state.audienceOnly && state.moreOpen,
        onClick: () => focusView('more'),
        hint: '展开更多通知，点击查看即视为确认接收'
      }),
      statTile({
        icon: 'site',
        value: 1,
        caption: '信息来源',
        onClick: () => {
          window.open('https://www.hist.edu.cn/', '_blank', 'noopener');
        },
        hint: '打开学校官网'
      })
    );
  }

  function buildTabs() {
    const available = availableItems();
    const counts = new Map();
    available.forEach((it) => counts.set(it.topic, (counts.get(it.topic) || 0) + 1));

    const defs = [{ key: ALL, label: '全部', count: available.length }].concat(
      TOPICS.filter((t) => counts.get(t) || t === state.tab).map((t) => ({
        key: t,
        label: TOPIC_SHORT[t] || t,
        count: counts.get(t) || 0
      }))
    );

    dom.tabs.textContent = '';
    defs.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.key = d.key;
      btn.title = d.key === ALL ? '全部分类' : d.key;
      btn.setAttribute('aria-label', (d.key === ALL ? '全部' : d.key) + '，' + d.count + ' 条');

      const label = el('span');
      label.textContent = d.label;
      const num = el('span', 'tab__n');
      num.textContent = String(d.count);

      btn.append(label, num);
      btn.addEventListener('click', () => selectTab(d.key));
      btn.addEventListener('keydown', onTabKey);
      dom.tabs.appendChild(btn);
    });

    if (!defs.some((d) => d.key === state.tab)) state.tab = ALL;
    updateTabs();
  }

  function updateTabs() {
    const box = dom.tabs;
    const boxRect = box.getBoundingClientRect();
    Array.prototype.forEach.call(box.children, (btn) => {
      const on = btn.dataset.key === state.tab;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      if (!on) return;
      const r = btn.getBoundingClientRect();
      if (r.left < boxRect.left) box.scrollLeft -= boxRect.left - r.left + 6;
      else if (r.right > boxRect.right) box.scrollLeft += r.right - boxRect.right + 6;
    });
  }

  function selectTab(key) {
    if (key === state.tab) return;
    state.tab = key;
    state.moreOpen = false;
    render();

    const bar = document.querySelector('.filterbar');
    const offset = (bar ? bar.offsetHeight : 56) + headHeight() + 10;
    const target = document.getElementById('feed') || dom.main;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: scrollBehavior() });
  }

  function onTabKey(e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    e.preventDefault();
    const tabs = Array.prototype.slice.call(dom.tabs.children);
    const idx = tabs.indexOf(e.currentTarget);
    let next = idx;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    selectTab(tabs[next].dataset.key);
    tabs[next].focus();
  }

  function renderHead(result) {
    if (state.status === 'error') {
      dom.listTitle.textContent = '正在等待数据';
      dom.listHint.textContent = '';
      dom.totalCount.textContent = '';
      return;
    }
    dom.listTitle.textContent = state.tab === ALL ? '全部信息' : state.tab;

    const parts = [];
    if (state.query) parts.push('搜索“' + state.query + '”');
    parts.push('学生通知 ' + result.student.length + ' 条');
    const pending = pendingUnknown(result.unknown).length;
    if (pending) parts.push('更多通知 ' + pending + ' 条 · 点击查看即确认接收');
    if (!state.query && result.student.length > 1) parts.push('按发布时间倒序');
    dom.listHint.textContent = parts.join(' · ');

    dom.totalCount.textContent = '共 ' + availableItems().length + ' 条';
  }

  function renderLists(result) {
    dom.list.textContent = '';

    if (state.status === 'error') {
      dom.list.appendChild(buildEmpty());
      return;
    }

    if (!result.student.length) {
      const pending = pendingUnknown(result.unknown).length;
      if (pending) {
        const note = el('p', 'list-note');
        note.textContent = '该条件下暂无学生通知；下方「更多通知」中有 ' + pending +
          ' 条待确认内容，点击查看即视为确认接收。';
        dom.list.appendChild(note);
      } else {
        dom.list.appendChild(buildEmpty());
      }
      return;
    }

    const terms = searchTerms();
    const frag = document.createDocumentFragment();
    result.student.forEach((it) => frag.appendChild(buildCard(it, terms)));
    dom.list.appendChild(frag);
  }

  function renderMore(unknownItems) {
    const pendingItems = unknownItems.filter((it) => !isConfirmed(it));
    const visible = state.status === 'ready' && pendingItems.length > 0;
    dom.more.hidden = !visible;
    dom.moreToggle.setAttribute('aria-expanded', state.moreOpen ? 'true' : 'false');
    dom.moreCount.textContent = String(pendingItems.length);
    updateMoreNote(pendingItems);
    dom.moreList.textContent = '';

    const expanded = visible && state.moreOpen;
    dom.moreList.hidden = !expanded;
    if (!expanded) return;

    const terms = searchTerms();
    const frag = document.createDocumentFragment();
    pendingItems.forEach((it) => frag.appendChild(buildCard(it, terms)));
    dom.moreList.appendChild(frag);
  }

  function buildCard(it, terms) {
    const card = el('article', 'card ' + catClass(it.topic));
    card.dataset.id = it.id;
    card.dataset.topic = it.topic;
    card.setAttribute('role', 'listitem');

    const top = el('div', 'card__top');
    const chip = el('span', 'chip');
    chip.textContent = it.topic;
    top.appendChild(chip);
    if (it.is_new) {
      const badge = el('span', 'badge-new');
      badge.textContent = 'NEW';
      top.appendChild(badge);
    }
    if (it.audience !== 'student') {
      const status = el('span', 'badge-state');
      status.textContent = '待确认';
      top.appendChild(status);
    }
    if (it.date) {
      const time = document.createElement('time');
      time.className = 'card__date';
      time.dateTime = it.date;
      time.textContent = it.date;
      top.appendChild(time);
    }
    card.appendChild(top);

    const heading = document.createElement('h3');
    heading.className = 'card__title';
    const titleLink = document.createElement('a');
    titleLink.href = noticeHash(it.id);
    titleLink.dataset.id = it.id;
    appendHighlighted(titleLink, it.title, terms);
    titleLink.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openModal(it, titleLink);
    });
    heading.appendChild(titleLink);
    card.appendChild(heading);

    if (it.summary) {
      const summary = el('p', 'card__summary');
      appendHighlighted(summary, it.summary, terms);
      card.appendChild(summary);
    }

    const foot = el('div', 'card__foot');
    const url = safeUrl(it.source_url);
    if (url) {
      const host = el('span', 'card__host');
      try {
        host.textContent = new URL(url).hostname;
      } catch (_) {
        host.textContent = '学校官网';
      }
      foot.appendChild(host);
    }

    const actions = el('span', 'card__actions');
    if (url) {
      const out = document.createElement('a');
      out.className = 'link-out';
      out.href = url;
      out.target = '_blank';
      out.rel = 'noopener noreferrer';
      out.setAttribute('aria-label', '查看原文：' + it.title + '（新窗口打开）');
      out.innerHTML = '查看原文<span aria-hidden="true">↗</span>';
      out.addEventListener('click', (e) => {
        e.stopPropagation();
        if (it.audience !== 'student') confirmItem(it);
      });
      actions.appendChild(out);
    } else {
      const none = el('span', 'link-out');
      none.style.color = 'var(--ink-3)';
      none.style.marginLeft = '0';
      none.textContent = '暂无原文链接';
      actions.appendChild(none);
    }
    foot.appendChild(actions);
    card.appendChild(foot);

    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      openModal(it, card);
    });

    return card;
  }

  function buildEmpty() {
    const isError = state.status === 'error';
    const box = el('div', 'empty');

    const icon = el('div', 'empty__icon');
    icon.innerHTML =
      '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<rect x="12" y="8" width="40" height="48" rx="6" stroke="currentColor" stroke-width="2.5"/>' +
      '<path d="M22 23h20M22 32h20M22 41h11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>';
    box.appendChild(icon);

    let titleText = '还没有可展示的信息';
    let hintText = '数据每小时自动采集，稍后再来看看。';
    if (isError) {
      titleText = '数据尚未加载';
      hintText = '请确认 data/school_data.js 已随页面部署，然后点击上方「重试」。';
    } else if (state.query) {
      titleText = '没有找到相关信息';
      hintText = '换个关键词试试，或清除当前的筛选条件。';
    } else if (state.tab !== ALL) {
      titleText = '没有找到相关信息';
      hintText = '该分类暂无内容，切换到「全部」看看其他通知。';
    } else if (state.onlyNew) {
      titleText = '没有新增通知';
      hintText = '最近 7 天内没有标记为 NEW 的通知，点「清除筛选」看全部内容。';
    } else if (state.latestOnly) {
      titleText = '没有找到相关信息';
      hintText = '最新一天没有可展示的通知，点「清除筛选」看全部内容。';
    } else if (state.audienceOnly === 'student') {
      titleText = '没有找到相关信息';
      hintText = '该条件下暂无接收对象为学生的通知，点「清除筛选」看全部内容。';
    }

    const title = el('p', 'empty__title');
    title.textContent = titleText;
    box.appendChild(title);

    const hint = el('p', 'empty__hint');
    hint.textContent = hintText;
    box.appendChild(hint);

    if (!isError && hasActiveFilter()) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'empty__action';
      action.textContent = '清除筛选';
      action.addEventListener('click', resetFilters);
      box.appendChild(action);
    }

    return box;
  }

  function renderFooter() {
    if (state.status === 'error') {
      dom.footerStatus.textContent = '数据尚未加载';
      return;
    }
    const parts = [];
    const updated = latestUpdated();
    if (updated) parts.push('数据更新于 ' + updated);
    const checked = latestChecked();
    if (checked && checked !== updated) parts.push('最近检查 ' + checked);
    parts.push('共 ' + availableItems().length + ' 条信息');
    dom.footerStatus.textContent = parts.join(' · ');
  }

  function setNotice(text) {
    dom.notice.hidden = !text;
    dom.noticeText.textContent = text || '';
  }

  function resetFilters() {
    state.query = '';
    state.tab = ALL;
    state.onlyNew = false;
    state.latestOnly = false;
    state.audienceOnly = null;
    state.moreOpen = false;
    dom.q.value = '';
    dom.qClear.hidden = true;
    render();
  }

  /* 有筛选条件时，空状态和「清除筛选」都要能找到 */
  function hasActiveFilter() {
    return Boolean(state.query) || state.tab !== ALL || state.onlyNew ||
      state.latestOnly || state.audienceOnly;
  }

  /* ------------------------------ 轻提示 ------------------------------ */

  let toastTimer = 0;

  function flashToast(text) {
    let box = document.getElementById('toast');
    if (!box) {
      box = el('div', 'toast');
      box.id = 'toast';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.remove('is-on');
    // 强制重排，保证连续点击也能重新播放动画
    void box.offsetWidth;
    box.classList.add('is-on');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => box.classList.remove('is-on'), 2600);
  }

  /* --------------------------- 搜索高亮 --------------------------- */

  function appendHighlighted(target, text, terms) {
    if (!terms.length) {
      target.textContent = text;
      return;
    }

    const lower = text.toLowerCase();
    const ranges = [];
    terms.forEach((term) => {
      let from = 0;
      while (from < lower.length) {
        const hit = lower.indexOf(term, from);
        if (hit === -1) break;
        ranges.push([hit, hit + term.length]);
        from = hit + term.length;
      }
    });

    if (!ranges.length) {
      target.textContent = text;
      return;
    }

    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    });

    let pos = 0;
    merged.forEach((r) => {
      if (r[0] > pos) target.appendChild(document.createTextNode(text.slice(pos, r[0])));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(r[0], r[1]);
      target.appendChild(mark);
      pos = r[1];
    });
    if (pos < text.length) target.appendChild(document.createTextNode(text.slice(pos)));
  }

  /* ---------------------------- 详情弹窗 ---------------------------- */

  let lastFocused = null;

  const HASH_PREFIX = '#n=';

  function noticeHash(id) {
    return HASH_PREFIX + encodeURIComponent(id);
  }

  function clearNoticeHash() {
    if (location.hash.indexOf(HASH_PREFIX) === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function openFromHash() {
    if (location.hash.indexOf(HASH_PREFIX) !== 0) return false;
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(HASH_PREFIX.length)); } catch (_) { return false; }
    if (!id) return false;
    let item = null;
    state.items.some((it) => {
      if (it.id !== id) return false;
      item = it;
      return true;
    });
    if (!item) return false;

    let link = null;
    Array.prototype.some.call(document.querySelectorAll('.card__title a'), (a) => {
      if (a.dataset.id !== id) return false;
      link = a;
      return true;
    });
    openModal(item, link || dom.main, false);
    return true;
  }

  function openModal(it, trigger, syncHash) {
    lastFocused = trigger || document.activeElement;

    if (syncHash !== false) {
      const next = noticeHash(it.id);
      if (location.hash !== next) history.replaceState(null, '', next);
    }

    const cls = catClass(it.topic);
    dom.mPanel.className = 'modal__panel ' + cls;
    dom.mCat.className = 'chip ' + cls;
    dom.mCat.textContent = it.topic;
    dom.mNew.hidden = !it.is_new;
    dom.mTitle.textContent = it.title;

    if (it.audience !== 'student') {
      confirmItem(it);
      if (dom.mHint) {
        dom.mHint.textContent = '已确认接收 · 点击查看即视为确认';
        dom.mHint.classList.add('is-ok');
      }
    } else if (dom.mHint) {
      dom.mHint.textContent = '信息采集自学校官网，请以原文为准';
      dom.mHint.classList.remove('is-ok');
    }

    const meta = [];
    meta.push(it.date ? '发布于 ' + it.date : '发布时间未知');
    if (it.updated_at) meta.push('采集于 ' + it.updated_at);
    dom.mMeta.textContent = meta.join(' · ');

    dom.mSummary.textContent = it.summary || '该条信息暂无摘要，请前往学校官网查看完整内容。';

    const url = safeUrl(it.source_url);
    dom.mLink.hidden = !url;
    if (url) dom.mLink.href = url;

    dom.modal.hidden = false;
    document.body.classList.add('modal-open');
    dom.mPanel.scrollTop = 0;
    dom.mClose.focus({ preventScroll: true });
  }

  function closeModal() {
    if (dom.modal.hidden) return;
    dom.modal.hidden = true;
    document.body.classList.remove('modal-open');
    clearNoticeHash();
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  /* ---------------------------- 事件绑定 ---------------------------- */

  dom.q.addEventListener('input', () => {
    state.query = dom.q.value.trim();
    dom.qClear.hidden = !dom.q.value;
    render();
  });

  dom.qClear.addEventListener('click', () => {
    dom.q.value = '';
    dom.qClear.hidden = true;
    state.query = '';
    dom.q.focus();
    render();
  });

  dom.retry.addEventListener('click', reloadScript);

  /* 点搜索框空白处：把焦点交给输入框 */
  const searchBox = document.getElementById('search');
  if (searchBox) {
    searchBox.addEventListener('click', (e) => {
      if (e.target === searchBox) dom.q.focus();
    });
  }

  /* 「浏览全部信息」：清掉全部筛选，滚到列表 */
  const heroBrowse = document.getElementById('heroBrowse');
  if (heroBrowse) {
    heroBrowse.addEventListener('click', () => {
      resetFilters();
      scrollToList();
      flashToast('已显示全部 ' + availableItems().length + ' 条信息');
    });
  }

  /* 「搜索内容」：滚回顶部并聚焦搜索框 */
  const heroSearch = document.getElementById('heroSearch');
  if (heroSearch) {
    heroSearch.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      window.setTimeout(() => dom.q.focus({ preventScroll: true }), 260);
    });
  }

  /* hero 里的分类 chip：直达对应分类（站点没覆盖的分类给出提示并回到全部） */
  const works = document.querySelector('.works');
  if (works) {
    works.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-jump]');
      if (!chip) return;
      switchTabAndScroll(chip.dataset.jump);
    });
  }

  dom.moreToggle.addEventListener('click', () => {
    state.moreOpen = !state.moreOpen;
    renderMore(visibleMatches().unknown);
    renderStats();
  });

  dom.mClose.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeModal();
  });

  window.addEventListener('hashchange', () => {
    if (location.hash.indexOf(HASH_PREFIX) === 0) {
      if (!openFromHash()) closeModal();
    } else {
      closeModal();
    }
  });

  dom.modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.prototype.filter.call(
      dom.mPanel.querySelectorAll('button, a[href]'),
      (node) => node.offsetParent !== null
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
      e.preventDefault();
      dom.q.focus();
    }
  });

  function isTyping(node) {
    if (!node || !node.tagName) return false;
    const tag = node.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
  }

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        dom.toTop.classList.toggle('is-visible', window.scrollY > 600);
        ticking = false;
      });
    },
    { passive: true }
  );

  dom.toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  });

  /* ------------------------------ 启动 ------------------------------ */

  const filterbar = document.querySelector('.filterbar');

  function syncFilterOffset() {
    const h = filterbar ? filterbar.offsetHeight : 56;
    document.documentElement.style.setProperty('--filter-h', (h + 8) + 'px');
  }

  syncFilterOffset();
  window.addEventListener('resize', syncFilterOffset);
  if (window.ResizeObserver && filterbar) {
    new ResizeObserver(syncFilterOffset).observe(filterbar);
  }

  loadFromScript();
})();
