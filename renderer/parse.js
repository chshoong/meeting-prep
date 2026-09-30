import { load as yamlLoad } from 'js-yaml';

export const LAYOUTS = ['title', 'section', 'chart', 'stats', 'cards', 'figure', 'table', 'checklist', 'compare', 'bullets'];
const STATUSES = ['done', 'doing', 'todo'];

function str(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function parseInline(text) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  const s = String(text);
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index), bold: false, pink: false });
    runs.push(m[1] !== undefined ? { text: m[1], bold: true, pink: false } : { text: m[2], bold: false, pink: true });
    last = re.lastIndex;
  }
  if (last < s.length) runs.push({ text: s.slice(last), bold: false, pink: false });
  return runs.length ? runs : [{ text: '', bold: false, pink: false }];
}

export function parseList(src) {
  const items = [];
  for (const raw of str(src).replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (m) {
      const indent = m[1].replace(/\t/g, '  ').length;
      items.push({ text: m[2].trim(), level: Math.min(Math.floor(indent / 2), 3), bullet: true });
    } else {
      items.push({ text: raw.trim(), level: 0, bullet: false });
    }
  }
  return items;
}

function splitSlides(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  const errors = [];
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  while (i < lines.length) {
    if (lines[i].trim() !== '---') {
      errors.push({ slide: blocks.length + 1, line: i + 1, message: "슬라이드는 '---' 줄로 시작해야 합니다" });
      break;
    }
    const start = i;
    i++;
    const yamlLines = [];
    while (i < lines.length && lines[i].trim() !== '---') yamlLines.push(lines[i++]);
    if (i >= lines.length) {
      errors.push({ slide: blocks.length + 1, line: start + 1, message: "여는 '---'에 짝이 되는 닫는 '---'가 없습니다" });
      break;
    }
    i++;
    const bodyLines = [];
    while (i < lines.length && lines[i].trim() !== '---') bodyLines.push(lines[i++]);
    blocks.push({ line: start + 1, yaml: yamlLines.join('\n'), body: bodyLines.join('\n').trim() });
  }
  return { blocks, errors };
}

function asList(v) {
  if (v == null) return [];
  if (typeof v === 'string') return parseList(v);
  if (Array.isArray(v)) return v.map(x => ({ text: str(x), level: 0, bullet: true }));
  return null;
}

function readKpis(v, min, max, where, fail) {
  if (v == null) return min === 0 ? [] : fail(`${where}에는 kpis가 ${min}~${max}개 필요합니다`);
  if (!Array.isArray(v)) return fail(`${where}의 kpis는 목록이어야 합니다`);
  if (v.length < min || v.length > max) {
    return fail(min === 0 ? `${where}의 kpis는 ${max}개까지입니다` : `${where}에는 kpis가 ${min}~${max}개 필요합니다`);
  }
  const out = [];
  for (const k of v) {
    if (!k || k.label == null || k.value == null) return fail(`${where}의 kpis 항목에는 label과 value가 필요합니다`);
    const good = k.good == null ? 'up' : String(k.good);
    if (good !== 'up' && good !== 'down') return fail('kpis의 good은 up 또는 down이어야 합니다');
    out.push({ label: str(k.label), value: str(k.value), delta: str(k.delta), good });
  }
  return out;
}

function readSide(v, fallbackLabel, legacy, fail) {
  if (legacy) {
    if (v == null || typeof v !== 'string') return fail('two-column 레이아웃에는 left와 right 목록(문자열)이 필요합니다');
    return { label: fallbackLabel, image: null, items: parseList(v), kpis: [] };
  }
  if (v == null || typeof v !== 'object' || !v.label) return fail('compare 레이아웃의 left와 right에는 label이 필요합니다');
  if (v.image) return { label: str(v.label), image: str(v.image), items: [], kpis: [] };
  if (v.kpis != null) {
    const kpis = readKpis(v.kpis, 1, 3, 'compare', fail);
    return kpis ? { label: str(v.label), image: null, items: [], kpis } : null;
  }
  const items = asList(v.items ?? v.points);
  if (!items || !items.length) return fail('compare 레이아웃의 left와 right에는 items, image, kpis 중 하나가 필요합니다');
  return { label: str(v.label), image: null, items, kpis: [] };
}

function buildSlide(index, block, meta, fail) {
  let layout = meta.layout;
  const legacy = layout === 'two-column';
  if (legacy) layout = 'compare';
  if (!LAYOUTS.includes(layout)) return fail(`알 수 없는 layout '${str(meta.layout)}'. 가능한 값: ${LAYOUTS.join(', ')}`);
  const title = str(meta.title);
  if (!title) return fail(`'${layout}' 레이아웃에는 title이 필요합니다`);
  const slide = {
    index, line: block.line, layout, title,
    section: str(meta.section), subtitle: str(meta.subtitle), takeaway: str(meta.takeaway), notes: str(meta.notes),
  };

  switch (layout) {
    case 'title':
      return { ...slide, subtitle: '', kicker: str(meta.kicker), question: str(meta.question ?? meta.subtitle),
        author: str(meta.author), affiliation: str(meta.affiliation), date: str(meta.date) };
    case 'section':
      return { ...slide, number: str(meta.number) };
    case 'chart': {
      if (!meta.chart || typeof meta.chart !== 'object') return fail('chart 레이아웃에는 chart 블록이 필요합니다');
      const kpis = readKpis(meta.kpis, 0, 3, 'chart', fail);
      return kpis ? { ...slide, chart: meta.chart, kpis } : null;
    }
    case 'stats': {
      const kpis = readKpis(meta.kpis, 2, 4, 'stats', fail);
      return kpis ? { ...slide, kpis } : null;
    }
    case 'cards': {
      if (!Array.isArray(meta.cards) || meta.cards.length < 2 || meta.cards.length > 4) return fail('cards 레이아웃에는 cards가 2~4개 필요합니다');
      const cards = [];
      for (const c of meta.cards) {
        if (!c || !c.title) return fail('cards 항목에는 title이 필요합니다');
        const items = asList(c.items);
        if (!items) return fail('cards 항목의 items는 목록이어야 합니다');
        cards.push({ title: str(c.title), color: c.color == null ? null : str(c.color), items });
      }
      return { ...slide, cards, flow: meta.flow === true };
    }
    case 'bullets': {
      const items = parseList(block.body);
      if (!items.length) return fail('bullets 레이아웃에는 닫는 --- 아래에 본문 목록이 필요합니다');
      return { ...slide, items };
    }
    case 'figure':
      if (!meta.image) return fail('figure 레이아웃에는 image가 필요합니다');
      return { ...slide, image: str(meta.image), caption: str(meta.caption), note: str(meta.note) };
    case 'compare': {
      const left = readSide(meta.left, str(meta.leftTitle), legacy, fail);
      if (!left) return null;
      const right = readSide(meta.right, str(meta.rightTitle), legacy, fail);
      if (!right) return null;
      return { ...slide, left, right };
    }
    case 'table': {
      if (!Array.isArray(meta.columns) || !meta.columns.length) return fail('table 레이아웃에는 columns 목록이 필요합니다');
      if (!Array.isArray(meta.rows)) return fail('table 레이아웃에는 rows 목록이 필요합니다');
      const n = meta.columns.length;
      for (let r = 0; r < meta.rows.length; r++) {
        const row = meta.rows[r];
        if (!Array.isArray(row) || row.length !== n) {
          return fail(`표의 ${r + 1}번째 행은 칸이 ${n}개여야 합니다 (현재 ${Array.isArray(row) ? row.length : 0}개)`);
        }
      }
      const highlight = Array.isArray(meta.highlight) ? meta.highlight.filter(x => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= meta.rows.length) : [];
      return { ...slide, columns: meta.columns.map(str), rows: meta.rows.map(row => row.map(str)), highlight };
    }
    case 'checklist': {
      if (!Array.isArray(meta.items) || !meta.items.length) return fail('checklist 레이아웃에는 items 목록이 필요합니다');
      const items = [];
      for (const it of meta.items) {
        if (!it || !STATUSES.includes(it.status)) return fail(`checklist 항목의 status는 ${STATUSES.join(', ')} 중 하나여야 합니다`);
        if (!it.text) return fail('checklist 항목에는 text가 필요합니다');
        items.push({ status: it.status, text: str(it.text), note: str(it.note) });
      }
      return { ...slide, items };
    }
  }
  return null;
}

const EMPTY_DECK = { brand: '', logo: '', author: '', affiliation: '', date: '' };

export function parseDeck(text) {
  const { blocks, errors } = splitSlides(text);
  const slides = [];
  let deck = { ...EMPTY_DECK };
  let section = '';
  let n = 0;
  blocks.forEach((block, k) => {
    const index = n + 1;
    const fail = message => { errors.push({ slide: index, line: block.line, message }); return null; };
    let meta;
    try {
      meta = yamlLoad(block.yaml) ?? {};
    } catch (e) {
      n++;
      const offset = e.mark ? e.mark.line + 1 : 0;
      errors.push({ slide: index, line: block.line + offset, message: `YAML 형식 오류: ${e.reason ?? e.message}` });
      return;
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) { n++; fail('머리말은 key: value 형식이어야 합니다'); return; }
    if ('deck' in meta && meta.layout == null) {
      if (k !== 0) { fail('deck 블록은 맨 앞에만 둘 수 있어요'); return; }
      const d = meta.deck && typeof meta.deck === 'object' ? meta.deck : {};
      deck = { brand: str(d.brand), logo: str(d.logo), author: str(d.author), affiliation: str(d.affiliation), date: str(d.date) };
      return;
    }
    n++;
    const slide = buildSlide(index, block, meta, fail);
    if (!slide) return;
    if (slide.layout === 'section') section = slide.title.replace(/\*\*|==/g, '');
    else if (slide.section) section = slide.section;
    else if (slide.layout !== 'title') slide.section = section;
    slides.push(slide);
  });
  errors.sort((a, b) => a.slide - b.slide);
  return { deck, slides, errors };
}
