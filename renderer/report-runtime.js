// 브라우저에서 실행되는 보고서 실행기. 페이지에 toString()으로 넣는다 — 바깥 이름을 참조하지 않는다.
export function runtimeMain(MPCalc, MPChart, MPViews) {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const DATA = JSON.parse(($('#mp-data') || {}).textContent || '{}');
  const cfgOf = el => JSON.parse(el.getAttribute('data-mp'));
  const EMPTY = '<p class="muted empty">조건에 맞는 결과가 없어요</p>';

  const btns = $$('[data-tab-btn]');
  const panels = $$('[data-tab-panel]');
  function show(id, scroll) {
    btns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tabBtn === id)));
    panels.forEach(p => { p.hidden = p.dataset.tabPanel !== id; });
    if (scroll !== false) window.scrollTo(0, 0);
  }
  btns.forEach(b => b.addEventListener('click', () => { show(b.dataset.tabBtn); history.replaceState(null, '', '#' + b.dataset.tabBtn); }));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
  $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const parts = a.dataset.jump.split('#');
    show(parts[0], false);
    const el = document.getElementById(parts[1]);
    if (el) el.scrollIntoView();
  }));
  const params = new URLSearchParams(location.search);
  const n = parseInt(params.get('tab'), 10);
  if (Number.isFinite(n) && btns[n - 1]) { document.body.classList.add('preview'); show(btns[n - 1].dataset.tabBtn, false); }
  else if (location.hash && btns.some(b => b.dataset.tabBtn === location.hash.slice(1))) show(location.hash.slice(1), false);
  else if (btns[0]) show(btns[0].dataset.tabBtn, false);

  function filtersFor(el, dataset) {
    const panel = el.closest('[data-tab-panel]');
    const f = {};
    $$('[data-mp]', panel).forEach(x => {
      const c = cfgOf(x);
      if (c.kind === 'filter' && c.dataset === dataset) $$('select', x).forEach(s => { f[s.name] = s.value; });
    });
    return f;
  }

  function drawChart(el) {
    const c = cfgOf(el);
    const ds = DATA[c.from.dataset];
    const rows = MPCalc.where(ds.rows, filtersFor(el, c.from.dataset));
    const box = $('.chart-box', el);
    const lg = $('.legend', el);
    try {
      if (!MPCalc.where(rows, c.from.where).length) { box.innerHTML = EMPTY; if (lg) lg.innerHTML = ''; return; }
      const spec = MPCalc.specFromData(c.base, c.from, rows, ds.meta, MPChart.seriesColors);
      box.innerHTML = MPChart.chartSvg(spec, c.w, c.h);
      if (lg) lg.innerHTML = MPViews.legend(spec);
    } catch (e) {
      box.innerHTML = '<p class="muted empty">차트를 그리지 못했어요</p>';
    }
  }

  function drawTable(el) {
    const c = cfgOf(el);
    const ds = DATA[c.from.dataset];
    const rows = MPCalc.where(ds.rows, filtersFor(el, c.from.dataset));
    const t = MPCalc.tableFrom(rows, c.from, ds.meta);
    $('tbody', el).innerHTML = t.rows.length ? MPViews.tableBody(t.rows, c.highlight) : `<tr><td colspan="${t.columns.length}">${EMPTY}</td></tr>`;
    applySearch(el);
  }

  function sideValues(el, side) {
    const v = {};
    $$(`select[data-side="${side}"]`, el).forEach(s => { v[s.name] = s.value; });
    return v;
  }
  function setSide(el, side, values) {
    $$(`select[data-side="${side}"]`, el).forEach(s => { if (values[s.name] != null) s.value = String(values[s.name]); });
  }
  function drawCompare(el) {
    const c = cfgOf(el);
    const ds = DATA[c.dataset];
    const result = MPCalc.compareSides(ds.rows, sideValues(el, 'a'), sideValues(el, 'b'), c.metrics, ds.meta);
    $('.cmp-result', el).innerHTML = MPViews.compareTable(result);
  }

  function applySearch(wrap) {
    const input = $('.tbl-search', wrap);
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    $$('tbody tr', wrap).forEach(tr => { tr.hidden = q !== '' && tr.textContent.toLowerCase().indexOf(q) < 0; });
  }
  function sortBy(table, col, dir) {
    const tbody = $('tbody', table);
    const rows = $$('tr', tbody);
    const val = tr => { const t = (tr.children[col] || {}).textContent || ''; const x = parseFloat(t.replace(/[^0-9.\-−]/g, '').replace('−', '-')); return Number.isFinite(x) ? x : t; };
    rows.sort((a, b) => { const x = val(a); const y = val(b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko'); return dir * r; });
    rows.forEach(r => tbody.appendChild(r));
  }

  $$('.tbl-wrap').forEach(wrap => {
    const input = $('.tbl-search', wrap);
    if (input) input.addEventListener('input', () => applySearch(wrap));
    $$('th[data-col]', wrap).forEach(th => th.addEventListener('click', () => {
      const dir = th.dataset.dir === 'asc' ? -1 : 1;
      $$('th[data-col]', wrap).forEach(x => { delete x.dataset.dir; });
      th.dataset.dir = dir === 1 ? 'asc' : 'desc';
      sortBy($('table', wrap), Number(th.dataset.col), dir);
    }));
  });

  $$('[data-mp]').forEach(el => {
    const c = cfgOf(el);
    if (c.kind === 'filter') {
      $$('select', el).forEach(s => s.addEventListener('change', () => {
        const panel = el.closest('[data-tab-panel]');
        $$('[data-mp]', panel).forEach(x => {
          const k = cfgOf(x);
          if (k.kind === 'chart' && k.from.dataset === c.dataset) drawChart(x);
          if (k.kind === 'table' && k.from.dataset === c.dataset) drawTable(x);
        });
      }));
    }
    if (c.kind === 'compare') {
      $$('select', el).forEach(s => s.addEventListener('change', () => drawCompare(el)));
      $$('[data-act]', el).forEach(b => b.addEventListener('click', () => {
        const a = sideValues(el, 'a');
        const bb = sideValues(el, 'b');
        if (b.dataset.act === 'swap') { setSide(el, 'a', bb); setSide(el, 'b', a); }
        if (b.dataset.act === 'copy') setSide(el, 'b', a);
        drawCompare(el);
      }));
      $$('[data-preset]', el).forEach(b => b.addEventListener('click', () => {
        const p = c.presets[Number(b.dataset.preset)];
        setSide(el, 'a', p.a);
        setSide(el, 'b', p.b);
        drawCompare(el);
      }));
    }
  });

  const MP = {
    data: name => DATA[name],
    calc: MPCalc,
    chart: (el, spec) => { el.innerHTML = MPChart.chartSvg(spec, el.clientWidth || 800, 320); },
  };
  $$('script[type="text/mp-custom"]').forEach(s => {
    const el = document.getElementById(s.dataset.for);
    if (!el) return;
    try {
      new Function('el', 'MP', s.textContent)(el, MP);
    } catch (e) {
      el.insertAdjacentHTML('beforeend', '<p class="mp-err">이 부품을 그리지 못했어요</p>');
    }
  });

  document.body.dataset.mpReady = '1';
}
