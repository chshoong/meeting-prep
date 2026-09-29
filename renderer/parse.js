import { load as yamlLoad } from 'js-yaml';

export const LAYOUTS = ['title', 'bullets', 'figure', 'two-column', 'table', 'checklist', 'compare'];
const STATUSES = ['done', 'doing', 'todo'];

function str(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function parseInline(text) {
  const runs = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false });
    runs.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs.length ? runs : [{ text: '', bold: false }];
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

function readSide(v, fallbackLabel, layout, fail) {
  if (layout === 'two-column') {
    if (v == null || typeof v !== 'string') return fail('two-column 레이아웃에는 left와 right 목록(문자열)이 필요합니다');
    return { label: fallbackLabel, image: null, items: parseList(v) };
  }
  if (v == null || typeof v !== 'object' || !v.label) return fail('compare 레이아웃의 left와 right에는 label이 필요합니다');
  if (!v.image && !Array.isArray(v.points)) return fail('compare 레이아웃의 left와 right에는 image 또는 points가 필요합니다');
  return {
    label: str(v.label),
    image: v.image ? str(v.image) : null,
    items: v.image ? [] : v.points.map(p => ({ text: str(p), level: 0, bullet: true })),
  };
}

function buildSlide(index, block, meta, fail) {
  const layout = meta.layout;
  if (!LAYOUTS.includes(layout)) return fail(`알 수 없는 layout '${str(layout)}'. 가능한 값: ${LAYOUTS.join(', ')}`);
  const title = str(meta.title);
  if (!title) return fail(`'${layout}' 레이아웃에는 title이 필요합니다`);
  const slide = { index, line: block.line, layout, title, notes: str(meta.notes) };

  switch (layout) {
    case 'title':
      return { ...slide, subtitle: str(meta.subtitle), date: str(meta.date), author: str(meta.author) };
    case 'bullets': {
      const items = parseList(block.body);
      if (!items.length) return fail('bullets 레이아웃에는 닫는 --- 아래에 본문 목록이 필요합니다');
      return { ...slide, items };
    }
    case 'figure':
      if (!meta.image) return fail('figure 레이아웃에는 image가 필요합니다');
      return { ...slide, image: str(meta.image), caption: str(meta.caption) };
    case 'two-column':
    case 'compare': {
      const left = readSide(meta.left, str(meta.leftTitle), layout, fail);
      if (!left) return null;
      const right = readSide(meta.right, str(meta.rightTitle), layout, fail);
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
      return { ...slide, columns: meta.columns.map(str), rows: meta.rows.map(row => row.map(str)) };
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

export function parseDeck(text) {
  const { blocks, errors } = splitSlides(text);
  const slides = [];
  blocks.forEach((block, k) => {
    const index = k + 1;
    const fail = message => { errors.push({ slide: index, line: block.line, message }); return null; };
    let meta;
    try {
      meta = yamlLoad(block.yaml) ?? {};
    } catch (e) {
      const offset = e.mark ? e.mark.line + 1 : 0;
      errors.push({ slide: index, line: block.line + offset, message: `YAML 형식 오류: ${e.reason ?? e.message}` });
      return;
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) { fail('머리말은 key: value 형식이어야 합니다'); return; }
    const slide = buildSlide(index, block, meta, fail);
    if (slide) slides.push(slide);
  });
  errors.sort((a, b) => a.slide - b.slide);
  return { slides, errors };
}
