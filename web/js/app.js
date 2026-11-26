(function () {
  'use strict';

  /* 数据通过 <script src="./data/school_data.js"> 引入（window.SCHOOL_DATA），
     不使用 fetch：静态托管下 fetch 存在跨域/路径风险，脚本引入最稳。 */
  const DATA_URL = './data/school_data.js';

  const CATEGORIES = ['通知公告'];
  const CAT_CLASS = {
    '通知公告': 'cat-notice'
  };
  const ALL = '*';

  const state = {
    items: [],        // 仅保留 audience 为 student / unknown 的记录
    tab: ALL,
    query: '',
    moreOpen: false,  // 「更多通知」（unknown）默认收起
    status: 'loading' // loading | ready | error
  };

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
    mLink: $('mLink'),
    mClose: $('mClose'),
    toTop: $('toTop'),
    briefDay: $('briefDay'),
    briefMonth: $('briefMonth'),
    briefWeek: $('briefWeek'),
    briefLine: $('briefLine'),
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
    if (meta) meta.setAttribute('content', dark ? '#111318' : '#f4f1ea');
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

  function catClass(category) {
    return CAT_CLASS[category] || 'cat-other';
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

  function loadFromScript() {
    if (!Array.isArray(window.SCHOOL_DATA)) {
      showError();
      return;
    }
    state.items = normalize(window.SCHOOL_DATA);
    state.status = 'ready';
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

  function visibleMatches() {
    const terms = searchTerms();
    const base = state.items.filter((it) => {
      if (state.tab !== ALL && it.category !== state.tab) return false;
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

  /* ------------------------------ 渲染 ------------------------------ */

  function render() {
    updateTabs();
    const result = visibleMatches();
    renderHead(result);
    renderLists(result);
    renderMore(result.unknown);
    renderFooter();
    renderBrief();
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

    if (state.status === 'error') {
      dom.briefLine.classList.remove('is-stats');
      dom.briefLine.textContent = '数据加载失败，请检查数据文件后重试';
      return;
    }
    if (state.status !== 'ready') {
      dom.briefLine.classList.remove('is-stats');
      dom.briefLine.textContent = '正在统计…';
      return;
    }

    const student = state.items.filter((it) => it.audience === 'student').length;
    const unknown = state.items.length - student;
    const fresh = state.items.filter((it) => it.is_new).length;

    dom.briefLine.textContent = '';
    const parts = [
      ['学生通知', student, ' 条'],
      ['待确认', unknown, ' 条'],
      ['新增', fresh, ' 条']
    ];
    parts.forEach((part) => {
      const stat = el('span', 'brief__stat');
      const key = el('span', 'brief__k');
      key.textContent = part[0];
      const val = el('span', 'brief__v');
      const num = document.createElement('b');
      num.textContent = String(part[1]);
      val.append(num, document.createTextNode(part[2]));
      stat.append(key, val);
      dom.briefLine.appendChild(stat);
    });
    dom.briefLine.classList.add('is-stats');
  }

  function buildTabs() {
    const counts = new Map();
    state.items.forEach((it) => counts.set(it.category, (counts.get(it.category) || 0) + 1));

    const extras = [...counts.keys()].filter((c) => !CATEGORIES.includes(c)).sort();
    const defs = [{ key: ALL, label: '全部', count: state.items.length }].concat(
      CATEGORIES.concat(extras).map((c) => ({ key: c, label: c, count: counts.get(c) || 0 }))
    );

    dom.tabs.textContent = '';
    defs.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.key = d.key;

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
    render();

    const bar = document.querySelector('.filterbar');
    const offset = (bar ? bar.offsetHeight : 56) + 10;
    const top = dom.main.getBoundingClientRect().top + window.scrollY - offset;
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
    if (result.unknown.length) parts.push('更多通知 ' + result.unknown.length + ' 条');
    if (!state.query && result.student.length > 1) parts.push('按发布时间倒序');
    dom.listHint.textContent = parts.join(' · ');

    dom.totalCount.textContent = '共 ' + state.items.length + ' 条';
  }

  function renderLists(result) {
    dom.list.textContent = '';

    if (state.status === 'error') {
      dom.list.appendChild(buildEmpty());
      return;
    }

    if (!result.student.length) {
      if (result.unknown.length) {
        const note = el('p', 'list-note');
        note.textContent = '该条件下暂无学生通知；下方「更多通知」中有 ' + result.unknown.length + ' 条待确认内容。';
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
    const visible = state.status === 'ready' && unknownItems.length > 0;
    dom.more.hidden = !visible;
    dom.moreToggle.setAttribute('aria-expanded', state.moreOpen ? 'true' : 'false');
    dom.moreCount.textContent = String(unknownItems.length);
    dom.moreList.textContent = '';

    const expanded = visible && state.moreOpen;
    dom.moreList.hidden = !expanded;
    if (!expanded) return;

    const terms = searchTerms();
    const frag = document.createDocumentFragment();
    unknownItems.forEach((it) => frag.appendChild(buildCard(it, terms)));
    dom.moreList.appendChild(frag);
  }

  function buildCard(it, terms) {
    const card = el('article', 'card ' + catClass(it.category));
    card.setAttribute('role', 'listitem');

    const top = el('div', 'card__top');
    const chip = el('span', 'chip');
    chip.textContent = it.category;
    top.appendChild(chip);
    if (it.is_new) {
      const badge = el('span', 'badge-new');
      badge.textContent = 'NEW';
      top.appendChild(badge);
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

      const out = document.createElement('a');
      out.className = 'link-out';
      out.href = url;
      out.target = '_blank';
      out.rel = 'noopener noreferrer';
      out.setAttribute('aria-label', '查看原文：' + it.title + '（新窗口打开）');
      out.innerHTML = '查看原文<span aria-hidden="true">↗</span>';
      out.addEventListener('click', (e) => e.stopPropagation());
      foot.appendChild(out);
    } else {
      const none = el('span', 'link-out');
      none.style.color = 'var(--ink-3)';
      none.style.marginLeft = '0';
      none.textContent = '暂无原文链接';
      foot.appendChild(none);
    }
    card.appendChild(foot);

    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
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
    }

    const title = el('p', 'empty__title');
    title.textContent = titleText;
    box.appendChild(title);

    const hint = el('p', 'empty__hint');
    hint.textContent = hintText;
    box.appendChild(hint);

    if (!isError && (state.query || state.tab !== ALL)) {
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
    parts.push('共 ' + state.items.length + ' 条信息');
    dom.footerStatus.textContent = parts.join(' · ');
  }

  function setNotice(text) {
    dom.notice.hidden = !text;
    dom.noticeText.textContent = text || '';
  }

  function resetFilters() {
    state.query = '';
    state.tab = ALL;
    dom.q.value = '';
    dom.qClear.hidden = true;
    render();
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

    const cls = catClass(it.category);
    dom.mPanel.className = 'modal__panel ' + cls;
    dom.mCat.className = 'chip ' + cls;
    dom.mCat.textContent = it.category;
    dom.mNew.hidden = !it.is_new;
    dom.mTitle.textContent = it.title;

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

  dom.moreToggle.addEventListener('click', () => {
    state.moreOpen = !state.moreOpen;
    renderMore(visibleMatches().unknown);
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
