(function () {
  'use strict';

  var doc = document.documentElement;
  var body = document.body;
  var loader = document.getElementById('siteLoader');
  var head = document.getElementById('siteHead');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 吸顶头部高度，供筛选栏与脚本定位复用 */
  function syncHeadHeight() {
    if (head) doc.style.setProperty('--head-h', head.offsetHeight + 'px');
  }
  syncHeadHeight();
  window.addEventListener('resize', syncHeadHeight);
  if (window.ResizeObserver && head) new ResizeObserver(syncHeadHeight).observe(head);

  if (head) {
    var onScroll = function () {
      head.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function finishIntro() {
    if (!loader) {
      body.classList.add('is-ready');
      return;
    }
    loader.classList.add('is-leaving');
    body.classList.add('is-ready');
    window.setTimeout(function () {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
      body.classList.remove('loader-active');
    }, reduced ? 320 : 900);
  }

  if (loader) {
    if (location.hash.indexOf('#n=') === 0) {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
      body.classList.remove('loader-active');
      body.classList.add('is-ready');
    } else {
      window.setTimeout(finishIntro, reduced ? 550 : 1800);
    }
  } else {
    body.classList.add('is-ready');
  }

  /* 滚动显现：只作用于非吸顶的展示区块 */
  var reveals = document.querySelectorAll('.reveal');
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(reveals, function (node) { io.observe(node); });
  } else {
    Array.prototype.forEach.call(reveals, function (node) { node.classList.add('is-in'); });
  }

  /* 底部 CTA 的「搜索内容」复用顶部搜索按钮行为 */
  var ctaSearch = document.getElementById('ctaSearch');
  var heroSearch = document.getElementById('heroSearch');
  if (ctaSearch && heroSearch) {
    ctaSearch.addEventListener('click', function () { heroSearch.click(); });
  }
})();
