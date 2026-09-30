import { C, FONT } from './style.js';
import { fontFaceCss } from './fonts.js';
import { esc } from './paint-html.js';
import { chartBundleSource } from './bundle.js';
import { makeCalc } from './report-calc.js';
import { makeViews } from './report-views.js';
import { runtimeMain } from './report-runtime.js';
import { renderComponent, inlineHtml } from './report-components.js';

export const sectionKey = (tabId, title) => `${tabId}/${title}`;
const pad2 = n => String(n).padStart(2, '0');

function css() {
  return `${fontFaceCss()}
:root { --bg:#${C.bg}; --ink:#${C.ink}; --text2:#${C.text2}; --muted:#${C.muted}; --faint:#${C.faint}; --line:#${C.line}; --soft:#${C.soft};
  --primary:#${C.primary}; --accent:#${C.accent}; --pink:#${C.pink}; --violet:#${C.violet}; --orange:#${C.orange}; --green:#${C.green};
  --tint:#${C.tint}; --baseline:#${C.baseline}; --up:#${C.up}; --down:#${C.down}; --warn:#${C.warn}; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.75 '${FONT.face}', '${FONT.fallback}', sans-serif; background: var(--bg); color: var(--ink); letter-spacing: -0.01em; word-break: keep-all; }
.masthead { padding: 46px max(28px, calc((100vw - 1340px) / 2)); background: var(--ink); color: #fff; }
.masthead .kicker { font-size: 12px; letter-spacing: 1.5px; font-weight: 700; color: var(--baseline); }
.masthead h1 { font-size: 44px; letter-spacing: -1.5px; line-height: 1.2; margin: 10px 0; }
.masthead p { font-size: 19px; color: #D7E0F5; margin: 10px 0; }
.pills { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }
.pills span { font-size: 12px; border: 1px solid #5A6690; border-radius: 30px; padding: 4px 12px; }
.tabs { position: sticky; top: 0; z-index: 10; background: #fff; display: flex; justify-content: center; border-bottom: 1px solid var(--line); padding: 0 18px; overflow-x: auto; }
.tabs button { border: 0; background: none; white-space: nowrap; padding: 18px 20px; border-bottom: 3px solid transparent; font: inherit; font-weight: 700; color: var(--text2); cursor: pointer; }
.tabs button[aria-selected=true] { color: var(--primary); border-color: var(--primary); background: var(--tint); }
.tabs .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--pink); margin-right: 6px; vertical-align: 2px; }
main { max-width: 1400px; margin: auto; padding: 30px; }
.panel > h2.tab-title { display: none; }
section.sec { margin: 8px 0 40px; scroll-margin-top: 80px; }
section.sec > .kicker { font-size: 12px; letter-spacing: 1.5px; font-weight: 700; color: var(--primary); }
section.sec > h2 { font-size: 29px; letter-spacing: -0.9px; line-height: 1.4; margin: 6px 0 18px; }
.badge { display: inline-block; font-size: 12px; font-weight: 800; border-radius: 6px; padding: 2px 8px; margin-left: 10px; vertical-align: 5px; }
.badge.new { background: var(--pink); color: #fff; }
.badge.changed { background: var(--tint); color: var(--accent); }
.card { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 24px; margin: 18px 0; min-width: 0; }
.c-text { max-width: 900px; font-size: 17px; }
.c-text p { margin: 8px 0 14px; }
b.acc { color: var(--accent); } b.pink { color: var(--pink); }
code { font-family: Consolas, 'D2Coding', monospace; font-size: 0.9em; background: var(--soft); border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; word-break: break-all; }
.muted { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin: 22px 0; }
.stats article { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 6px; }
.stats small { color: var(--muted); font-size: 13px; font-weight: 600; }
.stats strong { font-size: 30px; line-height: 1.3; font-weight: 800; }
.stats span { font-size: 13px; color: var(--muted); }
.delta { font-size: 14px; font-weight: 700; margin-left: 8px; vertical-align: 4px; }
.delta.up { color: var(--up); } .delta.down { color: var(--down); }
.grid { display: grid; gap: 20px; margin: 18px 0; } .grid.g2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid.g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid .card { margin: 0; } .card h3 { font-size: 19px; margin: 0 0 10px; }
.steps { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 36px; margin: 18px 0; }
.step { position: relative; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 22px; }
.step:not(:last-child)::after { content: '→'; position: absolute; right: -28px; top: 40%; color: var(--faint); font-size: 22px; }
.step .num { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; margin-bottom: 10px; }
details.card summary, details.archive summary { cursor: pointer; font-weight: 700; }
details.archive { margin-top: 30px; border-top: 1px dashed var(--line); padding-top: 14px; }
details.archive summary { color: var(--muted); }
.callout { border-radius: 12px; padding: 14px 18px; margin: 18px 0; border-left: 4px solid var(--primary); background: var(--tint); }
.callout.warn { border-left-color: var(--warn); background: #FFF6EE; }
.chart figcaption { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.chart figcaption b { font-size: 18px; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: var(--muted); font-weight: 600; }
.lg i { display: inline-block; width: 13px; height: 13px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.chart-box svg { width: 100%; height: auto; display: block; }
.figure img { max-width: 100%; display: block; margin: auto; }
.figure figcaption { text-align: center; color: var(--muted); font-size: 14px; margin-top: 8px; }
.missing { padding: 40px; text-align: center; color: var(--warn); border: 1px dashed var(--warn); border-radius: 8px; }
.tbl-wrap { overflow-x: auto; }
.tbl-search { font: inherit; font-size: 14px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 12px; width: min(320px, 100%); }
table.rt { width: 100%; border-collapse: collapse; font-size: 15px; }
table.rt th { text-align: left; color: var(--muted); font-size: 13px; font-weight: 700; padding: 10px 14px; border-bottom: 1.5px solid var(--line); cursor: pointer; white-space: nowrap; }
table.rt th[data-dir=asc]::after { content: ' ▲'; } table.rt th[data-dir=desc]::after { content: ' ▼'; }
table.rt td { padding: 10px 14px; border-bottom: 1px solid var(--soft); }
table.rt tr.hl td { background: var(--tint); font-weight: 700; }
table.cmp th[scope=row] { color: var(--ink); cursor: default; }
table.cmp td.win { color: var(--up); font-weight: 800; }
table.cmp td.diff { font-weight: 700; }
.pill { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
.compare .cmp-sides { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.compare fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 12px; }
.compare legend { font-weight: 800; color: var(--primary); padding: 0 6px; }
label { display: inline-flex; flex-direction: column; font-size: 12px; color: var(--muted); font-weight: 700; gap: 4px; }
select { font: inherit; font-size: 14px; padding: 6px 10px; border: 1px solid #BFCFD9; border-radius: 8px; background: #fff; color: var(--ink); }
.cmp-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
button { font: inherit; font-size: 14px; background: #fff; border: 1px solid #BFCFD9; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
button:hover { background: var(--tint); }
.filter { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; margin: 12px 0; position: sticky; top: 60px; z-index: 5; }
.filter-title { font-weight: 800; color: var(--primary); margin-right: 6px; }
.empty { padding: 30px; text-align: center; }
.mp-err { color: var(--warn); font-weight: 700; }
.next { margin-top: 24px; background: var(--primary); color: #fff; border: 0; }
.next:hover { background: var(--accent); }
.meeting-list a { color: var(--accent); font-weight: 700; text-decoration: none; }
body.preview .tabs { position: static; }
@media (max-width: 900px) { .grid.g2, .grid.g3, .compare .cmp-sides { grid-template-columns: 1fr; } .steps { grid-auto-flow: row; } .step::after { display: none; } main { padding: 18px; } }
@media print { .tabs, .tbl-search, .cmp-actions, .next { display: none; } [data-tab-panel] { display: block !important; } [hidden] { display: block !important; } body { background: #fff; } }`;
}

function renderSection(tab, s, ctx, out, badge, idOf) {
  const key = sectionKey(tab.id, s.title);
  const parts = [];
  for (const c of s.components) {
    try {
      const r = renderComponent(c, ctx);
      parts.push(r.html);
      out.warnings.push(...r.warnings);
    } catch (e) {
      out.errors.push({ block: c.block, line: c.line, message: e.message });
      parts.push('<p class="mp-err">이 부품을 그리지 못했어요</p>');
    }
  }
  const b = badge ? `<span class="badge ${badge === 'new' ? 'new' : 'changed'}">${badge === 'new' ? 'NEW' : '변경'}</span>` : '';
  return `<section class="sec" id="${idOf(key)}">${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ''}<h2>${inlineHtml(s.title)}${b}</h2>${parts.join('')}</section>`;
}

export function renderReportHtml(report, { datasets, baseDir, highlight } = {}) {
  const out = { errors: [], warnings: [], sections: [] };
  let n = 0;
  const ids = new Map();
  const idOf = key => { if (!ids.has(key)) ids.set(key, `s-${ids.size + 1}`); return ids.get(key); };
  const ctx = { datasets, baseDir, nextId: () => `mpc${++n}` };
  const badgeOf = (tab, s) => {
    const key = sectionKey(tab.id, s.title);
    if (!highlight || !highlight.touched?.has(key)) return null;
    return highlight.newKeys.has(key) ? 'new' : 'changed';
  };
  const changed = [];
  const defaultId = highlight ? 'meeting' : report.tabs[0]?.id;
  const hiddenUnless = id => (id === defaultId ? '' : ' hidden');
  const tabs = report.tabs.map((tab, i) => {
    const live = tab.sections.filter(s => !s.archived);
    const old = tab.sections.filter(s => s.archived);
    const body = live.map(s => { out.sections.push(sectionKey(tab.id, s.title)); const b = badgeOf(tab, s); if (b) changed.push({ tab, s, b }); return renderSection(tab, s, ctx, out, b, idOf); }).join('')
      + (old.length ? `<details class="archive"><summary>이전 결과 (${old.length})</summary>${old.map(s => { out.sections.push(sectionKey(tab.id, s.title)); return renderSection(tab, s, ctx, out, null, idOf); }).join('')}</details>` : '');
    const nextTab = report.tabs[i + 1];
    const next = nextTab ? `<button type="button" class="next" data-go="${esc(nextTab.id)}">${esc(nextTab.title)} 보기 →</button>` : '';
    return { tab, html: `<div class="panel" data-tab-panel="${esc(tab.id)}"${hiddenUnless(tab.id)}>${body}${next}</div>`, dot: live.some(s => badgeOf(tab, s)) };
  });

  let meeting = null;
  if (highlight) {
    const listHtml = changed.length
      ? `<ul class="meeting-list">${changed.map(({ tab, s, b }) => `<li><a href="#" data-jump="${esc(tab.id)}#${idOf(sectionKey(tab.id, s.title))}">${esc(tab.title)} · ${inlineHtml(s.title)}</a> <span class="badge ${b === 'new' ? 'new' : 'changed'}">${b === 'new' ? 'NEW' : '변경'}</span></li>`).join('')}</ul>`
      : '<p class="muted">이번 사이클에 바뀐 섹션이 없어요.</p>';
    meeting = `<div class="panel" data-tab-panel="meeting"${hiddenUnless('meeting')}><section class="sec"><div class="kicker">THIS MEETING · ${esc(highlight.cycle)}</div><h2>이번 미팅</h2>${highlight.meetingHtml || ''}<div class="card"><h3>이번 사이클에 바뀐 부분</h3>${listHtml}</div></section></div>`;
  }

  const btn = (id, label, dot) => `<button type="button" role="tab" data-tab-btn="${esc(id)}" aria-selected="${id === defaultId}">${dot ? '<span class="dot"></span>' : ''}${label}</button>`;
  const nav = (meeting ? btn('meeting', '이번 미팅', false) : '')
    + tabs.map((t, i) => btn(t.tab.id, `${pad2(i + 1)} ${esc(t.tab.title)}`, t.dot)).join('');

  const pageData = Object.fromEntries(Object.entries(datasets).map(([k, d]) => [k, { dims: d.dims, metrics: d.metrics, meta: d.meta, levels: d.levels, rows: d.rows }]));
  const json = JSON.stringify(pageData).replace(/</g, '\\u003c');
  const runtime = `(${runtimeMain.toString()})((${makeCalc.toString()})(), ${chartBundleSource()}, (${makeViews.toString()})());`;
  const m = report.meta;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
<style>
${css()}
</style>
<noscript><style>[data-tab-panel]{display:block!important}.tabs{display:none}</style></noscript>
</head>
<body>
<header class="masthead">${m.kicker ? `<div class="kicker">${esc(m.kicker)}</div>` : ''}<h1>${inlineHtml(m.title)}</h1>${m.subtitle ? `<p>${inlineHtml(m.subtitle)}</p>` : ''}${m.pills.length ? `<div class="pills">${m.pills.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}</header>
<nav class="tabs" role="tablist" aria-label="보고서 목차">${nav}</nav>
<main>
${meeting ?? ''}
${tabs.map(t => t.html).join('\n')}
</main>
<script type="application/json" id="mp-data">${json}</script>
<script>${runtime.replace(/<\/(script)/gi, '<\\/$1')}</script>
</body>
</html>
`;
  return { html, ...out };
}
