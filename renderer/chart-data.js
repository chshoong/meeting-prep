import fs from 'node:fs';
import path from 'node:path';
import { seriesColors } from './style.js';

export const CHART_TYPES = ['bar', 'hbar', 'line', 'scatter'];
const MAX_SERIES = 4;
const MAX_CATS = 12;
const MAX_POINTS = 500;

export function parseCsv(text) {
  const src = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(c => c !== '')) rows.push(row); }
  const [header = [], ...body] = rows;
  return { header: header.map(h => h.trim()), rows: body };
}

const fail = msg => { throw new Error(msg); };
const list = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

function toNumber(v, col, r) {
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (String(v).trim() === '' || !Number.isFinite(n)) fail(`'${col}' 열의 ${r}번째 값이 숫자가 아니에요: ${v}`);
  return n;
}

function readTable(raw, baseDir) {
  const file = path.resolve(baseDir, String(raw.data));
  if (!fs.existsSync(file)) fail(`CSV 파일을 찾을 수 없어요: ${raw.data}`);
  const { header, rows } = parseCsv(fs.readFileSync(file, 'utf8'));
  const col = name => {
    const i = header.indexOf(String(name));
    if (i < 0) fail(`'${name}' 열이 없어요. 있는 열: ${header.join(', ')}`);
    return rows.map(r => r[i] ?? '');
  };
  return { col };
}

export function normalizeChart(raw, baseDir) {
  if (!raw || typeof raw !== 'object') fail('chart 블록이 필요해요');
  const type = String(raw.type ?? 'bar');
  if (!CHART_TYPES.includes(type)) fail(`차트 type은 ${CHART_TYPES.join(', ')} 중 하나여야 해요`);
  const base = {
    type,
    title: raw.title == null ? '' : String(raw.title),
    xLabel: raw.xLabel == null ? '' : String(raw.xLabel),
    yLabel: raw.yLabel == null ? '' : String(raw.yLabel),
    yMin: raw.yMin == null ? null : Number(raw.yMin),
    valueLabels: raw.valueLabels == null ? type === 'bar' || type === 'hbar' : Boolean(raw.valueLabels),
    decimals: raw.decimals == null ? 2 : Math.max(0, Math.min(6, Number(raw.decimals) | 0)),
  };

  if (type === 'scatter') {
    let points;
    if (raw.data) {
      const t = readTable(raw, baseDir);
      const xs = t.col(raw.x).map((v, i) => toNumber(v, raw.x, i + 1));
      const ys = t.col(raw.y).map((v, i) => toNumber(v, raw.y, i + 1));
      const hiCol = raw.highlight?.column != null ? t.col(raw.highlight.column) : null;
      points = xs.map((x, i) => ({ x, y: ys[i], hi: hiCol ? String(hiCol[i]).trim() === String(raw.highlight.value) : false }));
    } else {
      points = list(raw.points).map((p, i) => ({ x: toNumber(p?.x, 'x', i + 1), y: toNumber(p?.y, 'y', i + 1), hi: Boolean(p?.highlight) }));
    }
    if (!points.length) fail('산점도에 점이 없어요');
    if (points.length > MAX_POINTS) fail(`산점도는 점 ${MAX_POINTS}개까지예요. 복잡한 그래프는 figure로 넣어주세요`);
    return {
      ...base, categories: [], series: [], points,
      pointName: raw.pointName == null ? '구성' : String(raw.pointName),
      highlightLabel: raw.highlight?.label == null ? '' : String(raw.highlight.label),
    };
  }

  let categories;
  let series;
  if (raw.data) {
    const t = readTable(raw, baseDir);
    categories = t.col(raw.x).map(String);
    const ys = list(raw.y);
    const names = raw.names == null ? ys.map(String) : list(raw.names).map(String);
    if (names.length !== ys.length) fail('names 개수는 y 열 개수와 같아야 해요');
    series = ys.map((c, k) => ({ name: names[k], values: t.col(c).map((v, i) => toNumber(v, c, i + 1)) }));
  } else {
    categories = list(raw.categories).map(String);
    series = list(raw.series).map((s, k) => {
      const name = s?.name == null ? `계열 ${k + 1}` : String(s.name);
      return { name, values: list(s?.values).map((v, i) => toNumber(v, name, i + 1)) };
    });
  }
  if (!series.length) fail('차트에 계열이 없어요');
  if (series.length > MAX_SERIES) fail(`차트는 계열 ${MAX_SERIES}개, 항목 ${MAX_CATS}개까지예요. 복잡한 그래프는 figure로 넣어주세요`);
  if (!categories.length) fail('차트에 항목(categories)이 없어요');
  if (categories.length > MAX_CATS) fail(`차트는 계열 ${MAX_SERIES}개, 항목 ${MAX_CATS}개까지예요. 복잡한 그래프는 figure로 넣어주세요`);
  for (const s of series) {
    if (s.values.length !== categories.length) fail(`'${s.name}' 계열은 값이 ${categories.length}개여야 해요 (현재 ${s.values.length}개)`);
  }
  const colors = seriesColors(series.map(s => s.name));
  return { ...base, categories, series: series.map((s, k) => ({ ...s, color: colors[k] })), points: [], pointName: '', highlightLabel: '' };
}

export function resolveCharts(slides, baseDir) {
  const errors = [];
  for (const s of slides) {
    if (s.layout !== 'chart') continue;
    try {
      s.chartSpec = normalizeChart(s.chart, baseDir);
    } catch (e) {
      errors.push({ slide: s.index, line: s.line, message: e.message });
    }
  }
  return errors;
}
