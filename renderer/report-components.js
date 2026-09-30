import { esc } from './paint-html.js';
import { parseInline, parseList } from './parse.js';
import { chartSvg } from './chart-svg.js';
import { normalizeChart, CHART_TYPES } from './chart-data.js';
import { seriesColors, STATUS } from './style.js';
import { calc } from './report-calc.js';
import { views } from './report-views.js';
import { loadImage } from './images.js';

const CHART_W = 1160;
const CHART_H = 380;

export function inlineHtml(text) {
  return parseInline(String(text ?? '')).map(r => (r.bold ? `<b class="acc">${esc(r.text)}</b>` : r.pink ? `<b class="pink">${esc(r.text)}</b>` : esc(r.text))).join('');
}

export function markdownHtml(body) {
  const blocks = String(body ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
      return `<ul>${parseList(b).map(it => `<li style="margin-left:${it.level * 20}px">${inlineHtml(it.text)}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map(inlineHtml).join('<br>')}</p>`;
  }).join('');
}

const attr = obj => esc(JSON.stringify(obj));

export function externalUrl(html) {
  const m = String(html).match(/(?:\b(?:src|href|xlink:href)\s*=\s*["']?\s*|url\(\s*["']?\s*|@import\s+["']?\s*)((?:https?:)?\/\/[^\s"'()<>]*)/i);
  return m ? m[1] : null;
}

function dataset(ctx, name) {
  const d = ctx.datasets[name];
  if (!d) throw new Error(`데이터셋 '${name}'이(가) 없어요. report 블록의 datasets에 등록해주세요`);
  return d;
}

function checkFields(ds, fields) {
  const known = [...ds.dims, ...ds.metrics];
  for (const f of fields.filter(Boolean)) {
    if (!known.includes(f)) throw new Error(`'${f}'은(는) 데이터셋 '${ds.name}'의 dims나 metrics에 없어요`);
  }
}

const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

function chartBase(c) {
  const type = String(c.chart ?? 'bar');
  if (!CHART_TYPES.includes(type)) throw new Error(`차트 type은 ${CHART_TYPES.join(', ')} 중 하나여야 해요`);
  return {
    type, title: c.title == null ? '' : String(c.title), xLabel: c.xLabel == null ? '' : String(c.xLabel), yLabel: c.yLabel == null ? '' : String(c.yLabel),
    yMin: c.yMin == null ? null : Number(c.yMin), valueLabels: c.valueLabels == null ? type === 'bar' || type === 'hbar' : Boolean(c.valueLabels),
    decimals: c.decimals == null ? 2 : Number(c.decimals) | 0,
  };
}

function chartCard(spec, cfg) {
  const legend = views.legend(spec);
  return `<figure class="card chart"${cfg ? ` data-mp="${attr(cfg)}"` : ''}>`
    + `<figcaption><b>${esc(spec.title)}</b><span class="legend">${legend}</span></figcaption>`
    + `<div class="chart-box">${chartSvg(spec, CHART_W, CHART_H)}</div></figure>`;
}

function tableHtml(columns, rows, highlight, cfg) {
  const head = columns.map((c, i) => `<th data-col="${i}">${esc(c)}</th>`).join('');
  return `<div class="card tbl-wrap"${cfg ? ` data-mp="${attr(cfg)}"` : ''}>`
    + '<input class="tbl-search" type="search" placeholder="표에서 검색">'
    + `<table class="rt"><thead><tr>${head}</tr></thead><tbody>${views.tableBody(rows, highlight)}</tbody></table></div>`;
}

function deltaHtml(it) {
  if (it.delta == null || it.delta === '') return '';
  const d = String(it.delta).trim();
  const dir = /^[-−▼]/.test(d) ? 'down' : 'up';
  const good = (it.good ?? 'up') === dir;
  return `<span class="delta ${good ? 'up' : 'down'}">${dir === 'up' ? '▲' : '▼'} ${esc(d.replace(/^[+\-−▲▼]\s*/, ''))}</span>`;
}

function selects(ds, dims, chosen, side) {
  return dims.map(dim => {
    const opts = ds.levels[dim].map(v => `<option value="${esc(v)}"${String(chosen[dim]) === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
    return `<label>${esc(ds.meta[dim]?.label ?? dim)}<select name="${esc(dim)}" data-side="${side}">${opts}</select></label>`;
  }).join('');
}

const count = (s, re) => (s.match(re) ?? []).length;

// 닫히지 않은 태그가 뒤의 내용이나 실행기를 삼키지 않게 막는다
function checkClosed(body) {
  const s = String(body);
  if (count(s, /<script\b/gi) !== count(s, /<\/script/gi)) throw new Error('custom 부품의 <script> 태그가 닫히지 않았어요');
  if (count(s, /<!--/g) > count(s, /-->/g)) throw new Error('custom 부품의 <!-- 주석이 닫히지 않았어요');
  for (const tag of ['style', 'textarea', 'title', 'template']) {
    if (count(s, new RegExp(`<${tag}\\b`, 'gi')) > count(s, new RegExp(`</${tag}`, 'gi'))) throw new Error(`custom 부품의 <${tag}> 태그가 닫히지 않았어요`);
  }
}

const RENDER = {
  text: c => `<div class="c-text">${markdownHtml(c.body)}</div>`,

  stats: c => `<div class="stats">${c.items.map(it => `<article><small>${inlineHtml(it.label)}</small><strong>${esc(it.value)}${deltaHtml(it)}</strong>${it.note ? `<span>${inlineHtml(it.note)}</span>` : ''}</article>`).join('')}</div>`,

  cards: c => {
    const cols = c.columns ?? Math.min(3, Math.max(2, c.items.length));
    return `<div class="grid g${cols}">${c.items.map(it => `<article class="card"><h3>${inlineHtml(it.title)}</h3>${it.text ? `<p>${inlineHtml(it.text)}</p>` : ''}</article>`).join('')}</div>`;
  },

  steps: c => `<div class="steps">${c.items.map((it, i) => `<article class="step"><span class="num">${i + 1}</span><h3>${inlineHtml(it.title)}</h3>${it.text ? `<p>${inlineHtml(it.text)}</p>` : ''}</article>`).join('')}</div>`,

  details: c => `<details class="card"><summary>${inlineHtml(c.title)}</summary><div class="c-text">${markdownHtml(c.body)}</div></details>`,

  callout: c => `<div class="callout ${c.tone === 'warn' ? 'warn' : 'info'}">${markdownHtml(c.body)}</div>`,

  checklist: c => `<div class="card"><table class="rt check"><thead><tr><th>#</th><th>할 일</th><th>상태</th><th>비고</th></tr></thead><tbody>${c.items.map((it, i) => {
    const st = STATUS[it.status];
    return `<tr><td class="muted">${i + 1}</td><td>${inlineHtml(it.text)}</td><td><span class="pill" style="background:#${st.bg};color:#${st.fg}">${st.label}</span></td><td class="muted">${inlineHtml(it.note ?? '')}</td></tr>`;
  }).join('')}</tbody></table></div>`,

  figure: (c, ctx, warn) => {
    const img = loadImage(String(c.image), ctx.baseDir);
    if (!img.ok) {
      warn(`그림을 찾을 수 없거나 지원하지 않는 형식입니다(png, jpg, gif만 가능): ${c.image}`);
      return `<figure class="card figure"><div class="missing">⚠ 그림 없음: ${esc(c.image)}</div></figure>`;
    }
    return `<figure class="card figure"><img alt="" src="data:${img.mime};base64,${img.data.toString('base64')}">${c.caption ? `<figcaption>${inlineHtml(c.caption)}</figcaption>` : ''}</figure>`;
  },

  chart: (c, ctx) => {
    const base = chartBase(c);
    if (!c.from) {
      const spec = normalizeChart({ ...c, type: base.type }, ctx.baseDir);
      return chartCard(spec, null);
    }
    const ds = dataset(ctx, c.from.dataset);
    checkFields(ds, [c.from.x, ...list(c.from.y), c.from.by]);
    const spec = calc.specFromData(base, c.from, ds.rows, ds.meta, seriesColors);
    if (spec.series.length > 4 || spec.categories.length > 12) throw new Error('차트는 계열 4개, 항목 12개까지예요. by나 where로 줄이거나 표로 보여주세요');
    return chartCard(spec, { kind: 'chart', base, from: c.from, w: CHART_W, h: CHART_H });
  },

  table: (c, ctx) => {
    if (!c.from) return tableHtml(c.columns.map(String), c.rows.map(r => r.map(String)), c.highlight ?? [], null);
    const ds = dataset(ctx, c.from.dataset);
    checkFields(ds, [c.from.x, ...list(c.from.y), c.from.by]);
    const t = calc.tableFrom(ds.rows, c.from, ds.meta);
    return tableHtml(t.columns, t.rows, c.highlight ?? [], { kind: 'table', from: c.from, highlight: c.highlight ?? [] });
  },

  compare: (c, ctx) => {
    const ds = dataset(ctx, c.dataset);
    const dims = c.dims ? list(c.dims).map(String) : ds.dims;
    const metrics = c.metrics ? list(c.metrics).map(String) : ds.metrics;
    checkFields(ds, [...dims, ...metrics]);
    const first = Object.fromEntries(dims.map(d => [d, ds.levels[d][0]]));
    const a = { ...first, ...(c.a ?? {}) };
    const b = { ...first, ...(dims[0] && ds.levels[dims[0]][1] != null ? { [dims[0]]: ds.levels[dims[0]][1] } : {}), ...(c.b ?? {}) };
    const presets = list(c.presets).map(p => ({ label: String(p.label ?? ''), a: p.a ?? {}, b: p.b ?? {} }));
    const result = calc.compareSides(ds.rows, a, b, metrics, ds.meta);
    const buttons = '<button type="button" data-act="swap">1 ↔ 2 바꾸기</button><button type="button" data-act="copy">1의 설정을 2에 복사</button>'
      + presets.map((p, i) => `<button type="button" data-preset="${i}">${esc(p.label)}</button>`).join('');
    return `<div class="card compare" data-mp="${attr({ kind: 'compare', dataset: c.dataset, dims, metrics, presets })}">`
      + `<div class="cmp-sides"><fieldset><legend>결과 1</legend>${selects(ds, dims, a, 'a')}</fieldset><fieldset><legend>결과 2</legend>${selects(ds, dims, b, 'b')}</fieldset></div>`
      + `<div class="cmp-actions">${buttons}</div><div class="cmp-result">${views.compareTable(result)}</div></div>`;
  },

  filter: (c, ctx) => {
    const ds = dataset(ctx, c.dataset);
    const dims = c.dims ? list(c.dims).map(String) : ds.dims;
    checkFields(ds, dims);
    const sel = dims.map(d => `<label>${esc(ds.meta[d]?.label ?? d)}<select name="${esc(d)}"><option value="*" selected>전체</option>${ds.levels[d].map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('');
    return `<div class="filter" data-mp="${attr({ kind: 'filter', dataset: c.dataset, dims })}"><span class="filter-title">필터</span>${sel}</div>`;
  },

  custom: (c, ctx) => {
    checkClosed(c.body);
    const bad = externalUrl(c.body);
    if (bad) throw new Error(`custom 부품에 외부 주소가 있어요: ${bad}. 인터넷 없이 열려야 하니 파일 안의 내용만 써주세요`);
    const id = ctx.nextId();
    const scripts = [];
    const html = c.body.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, code) => { scripts.push(code); return ''; }).trim();
    return `<div class="custom" id="${id}">${html}</div>`
      + scripts.map(code => `<script type="text/mp-custom" data-for="${id}">${code.replace(/<\/(script)/gi, '<\\/$1')}</script>`).join('');
  },
};

export function renderComponent(c, ctx) {
  const warnings = [];
  const html = RENDER[c.type](c, ctx, m => warnings.push(m));
  return { html, warnings };
}
