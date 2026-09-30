import { W, H, C, SIZE, FRAME, STATUS, SERIES, textWidth, wrapLines, fitContain, colorOf } from './style.js';
import { parseInline } from './parse.js';

const M = FRAME.margin;
const CW = W - 2 * M;

const plain = t => String(t).replace(/\*\*|==/g, '');

// strong: **…** 색(없으면 굵게만). ==…==는 항상 pink.
function runs(text, strong = null) {
  return parseInline(text).map(r => ({
    text: r.text,
    bold: r.bold || r.pink,
    color: r.pink ? C.pink : r.bold && strong ? strong : null,
  }));
}

const T = o => ({ kind: 'text', align: 'left', valign: 'top', weight: 400, color: C.ink, lineHeight: 1.4, paraSpace: 0, ...o });
const one = (text, strong) => [{ runs: runs(text, strong) }];
const card = (x, y, w, h) => ({ kind: 'rect', x, y, w, h, fill: C.white, stroke: C.line, strokeW: 1.5, radius: FRAME.radius });

function needHeight(el) {
  let lines = 0;
  for (const p of el.paras) {
    const indent = p.bullet ? 30 + (p.level ?? 0) * 30 : 0;
    lines += wrapLines(p.runs.map(r => r.text).join(''), el.w - indent, el.size, el.weight);
  }
  return lines * el.size * el.lineHeight + Math.max(0, el.paras.length - 1) * el.paraSpace;
}

function checkFit(el, where, ctx) {
  if (needHeight(el) > el.h + 1) ctx.warn(`${where} 내용이 넘칠 수 있어요. 글을 줄이거나 슬라이드를 나눠주세요`);
}

function bulletParas(items) {
  return items.map(it => ({ runs: runs(it.text), bullet: it.bullet !== false, level: it.level ?? 0 }));
}

function frame(slide, ctx, els) {
  els.push({ kind: 'rect', x: 0, y: 0, w: W, h: H, fill: C.bg });
  els.push({ kind: 'rect', x: 0, y: 0, w: W, h: FRAME.topBar, fill: C.primary });
  els.push({ kind: 'rect', x: 0, y: H - FRAME.bottomBar, w: W, h: FRAME.bottomBar, fill: C.primary });
  if (slide.section) {
    els.push({ kind: 'circle', x: M, y: FRAME.crumbY + 3, d: 26, fill: C.primary });
    els.push({ kind: 'tri', x: M + 10, y: FRAME.crumbY + 11, w: 9, h: 10, fill: C.white });
    els.push(T({ x: M + 38, y: FRAME.crumbY, w: 700, h: 32, paras: [{ runs: [{ text: slide.section }] }], size: SIZE.crumb, weight: 700, valign: 'middle' }));
  }
  if (ctx.logo?.ok) {
    els.push({ kind: 'image', ...fitContain({ x: W - M - 180, y: 28, w: 180, h: 44 }, ctx.logo.width, ctx.logo.height), img: ctx.logo });
  } else if (ctx.brand) {
    els.push(T({ x: W - M - 420, y: FRAME.crumbY + 4, w: 420, h: 24, paras: [{ runs: [{ text: ctx.brand }] }], size: SIZE.brand, weight: 700, color: C.faint, align: 'right', valign: 'middle' }));
  }
  els.push({ kind: 'line', x1: M, y1: FRAME.ruleY, x2: W - M, y2: FRAME.ruleY, color: C.line, width: 1.5 });
  const title = T({ x: M, y: FRAME.titleY, w: CW, h: FRAME.titleH, paras: one(slide.title, C.accent), size: SIZE.title, weight: 800, align: 'center', valign: 'middle', lineHeight: 1.2 });
  els.push(title);
  if (textWidth(plain(slide.title), SIZE.title, 800) > CW) ctx.warn('제목이 너무 길어요. 한 줄에 들어가게 줄여주세요');
  if (slide.subtitle) {
    const sub = T({ x: M, y: FRAME.subY, w: CW, h: FRAME.subH, paras: one(slide.subtitle), size: SIZE.sub, weight: 500, color: C.muted, align: 'center', valign: 'middle' });
    els.push(sub);
    if (textWidth(plain(slide.subtitle), SIZE.sub, 500) > CW) ctx.warn('부제가 너무 길어요');
  }
  let bottom = FRAME.bodyBottom;
  if (slide.takeaway) {
    const y = H - FRAME.takeBottom - FRAME.takeH;
    els.push({ kind: 'rect', x: M, y, w: CW, h: FRAME.takeH, fill: C.tint, radius: FRAME.takeRadius });
    els.push(T({ x: M + 24, y, w: CW - 48, h: FRAME.takeH, paras: one(slide.takeaway, C.accent), size: SIZE.take, weight: 700, align: 'center', valign: 'middle' }));
    if (textWidth(plain(slide.takeaway), SIZE.take, 700) > CW - 48) ctx.warn('결론 문장이 한 줄을 넘어요. 줄여주세요');
    bottom = y - FRAME.takeGap;
  }
  els.push(T({ x: W - M - 80, y: H - 40, w: 80, h: 22, paras: [{ runs: [{ text: String(ctx.page) }] }], size: SIZE.page, weight: 600, color: C.faint, align: 'right', valign: 'middle' }));
  return { top: FRAME.bodyTop, bottom };
}

// withCard=false: 이미 카드 안(compare)에 그릴 때 테두리 카드를 겹쳐 그리지 않는다.
function kpiCard(k, x, y, w, h, els, valueSize = SIZE.kpiValue, withCard = true) {
  if (withCard) els.push(card(x, y, w, h));
  els.push(T({ x: x + 22, y: y + 16, w: w - 44, h: 22, paras: [{ runs: [{ text: k.label }] }], size: SIZE.kpiLabel, weight: 600, color: C.muted }));
  const vy = y + 16 + 26;
  const vh = valueSize * 1.25;
  els.push(T({ x: x + 22, y: vy, w: w - 44, h: vh, paras: [{ runs: [{ text: k.value }] }], size: valueSize, weight: 800, lineHeight: 1.2, valign: 'middle' }));
  if (k.delta) {
    const dir = /^[-−▼]/.test(k.delta.trim()) ? 'down' : 'up';
    const color = dir === k.good ? C.up : C.down;
    const label = `${dir === 'up' ? '▲' : '▼'} ${k.delta.trim().replace(/^[+\-−▲▼]\s*/, '')}`;
    const dx = x + 22 + textWidth(k.value, valueSize, 800) + 12;
    els.push(T({ x: dx, y: vy, w: Math.max(60, x + w - 16 - dx), h: vh, paras: [{ runs: [{ text: label }] }], size: SIZE.kpiDelta, weight: 700, color, valign: 'middle' }));
  }
}

function legend(spec, right, y, els) {
  const items = spec.type === 'scatter'
    ? [[spec.pointName, C.baseline], ...(spec.highlightLabel ? [[spec.highlightLabel, C.accent]] : [])]
    : spec.series.map(s => [s.name, s.color]);
  if (items.length < 2) return;
  const widths = items.map(([n]) => 14 + 6 + textWidth(n, SIZE.legend, 600) + 18);
  let x = right - widths.reduce((a, b) => a + b, 0) + 18;
  items.forEach(([n, color], i) => {
    els.push({ kind: 'rect', x, y: y + 5, w: 14, h: 14, fill: color, radius: 3 });
    els.push(T({ x: x + 20, y, w: widths[i] - 20, h: 24, paras: [{ runs: [{ text: n }] }], size: SIZE.legend, weight: 600, color: C.muted, valign: 'middle' }));
    x += widths[i];
  });
}

function imageOrPlaceholder(img, src, box, els) {
  if (img?.ok) {
    els.push({ kind: 'image', ...fitContain(box, img.width, img.height), img });
    return;
  }
  els.push({ kind: 'rect', ...box, fill: C.bg, stroke: C.warn, strokeW: 1.5, radius: 8, dash: true });
  els.push(T({ ...box, paras: [{ runs: [{ text: `⚠ 그림 없음: ${src ?? ''}` }] }], size: SIZE.body, color: C.warn, align: 'center', valign: 'middle' }));
}

function colWidths(columns, rows, total) {
  const weight = i => Math.min(4, Math.max(1, Math.max(...[columns[i], ...rows.map(r => r[i])].map(t => textWidth(t, 19))) / 120));
  const ws = columns.map((_, i) => weight(i));
  const sum = ws.reduce((a, b) => a + b, 0);
  return ws.map(v => (v / sum) * total);
}

const LAYOUT = {
  title(slide, ctx, els) {
    els.push({ kind: 'rect', x: 0, y: 0, w: W, h: H, fill: C.bg });
    els.push({ kind: 'rect', x: 0, y: 0, w: W, h: FRAME.topBar, fill: C.primary });
    els.push({ kind: 'rect', x: 0, y: H - FRAME.bottomBar, w: W, h: FRAME.bottomBar, fill: C.primary });
    if (slide.kicker) els.push(T({ x: 96, y: 120, w: 680, h: 26, paras: [{ runs: [{ text: slide.kicker }] }], size: SIZE.kicker, weight: 700, color: C.faint }));
    const t = T({ x: 96, y: 164, w: 680, h: 170, paras: one(slide.title, C.accent), size: SIZE.coverTitle, weight: 800, lineHeight: 1.25 });
    els.push(t);
    checkFit(t, '표지 제목', ctx);
    if (slide.question) els.push(T({ x: 96, y: 360, w: 680, h: 64, paras: one(slide.question), size: SIZE.question, weight: 500, color: C.muted, lineHeight: 1.6 }));
    const author = slide.author || ctx.author;
    const affiliation = slide.affiliation || ctx.affiliation;
    const date = slide.date || ctx.date;
    const who = [author && { text: author, bold: true, color: null }, author && affiliation && { text: ' · ', color: null }, affiliation && { text: affiliation, color: null }].filter(Boolean);
    const paras = [];
    if (who.length) paras.push({ runs: who });
    if (date) paras.push({ runs: [{ text: date.replace(/-/g, '. '), color: C.faint }] });
    if (paras.length) els.push(T({ x: 96, y: 540, w: 680, h: 70, paras, size: SIZE.meta, color: C.text2, lineHeight: 1.7 }));
    els.push({ kind: 'circle', x: 800, y: 150, d: 380, fill: C.tint });
    [[885, 370, 46, 90, C.baseline], [950, 320, 46, 140, '8FA1F4'], [1015, 270, 46, 190, C.primary], [1080, 235, 46, 225, C.accent]]
      .forEach(([x, y, w, h, fill]) => els.push({ kind: 'rect', x, y, w, h, fill, radius: 8 }));
    [[890, 345, 965, 300], [965, 300, 1030, 260], [1030, 260, 1102, 210]]
      .forEach(([x1, y1, x2, y2]) => els.push({ kind: 'line', x1, y1, x2, y2, color: C.orange, width: 7 }));
    els.push({ kind: 'circle', x: 1091, y: 199, d: 22, fill: C.orange });
  },

  section(slide, ctx, els) {
    els.push({ kind: 'rect', x: 0, y: 0, w: W, h: H, fill: C.bg });
    els.push({ kind: 'rect', x: 0, y: 0, w: W, h: FRAME.topBar, fill: C.primary });
    els.push({ kind: 'rect', x: 0, y: H - FRAME.bottomBar, w: W, h: FRAME.bottomBar, fill: C.primary });
    if (slide.number) els.push(T({ x: 96, y: 170, w: 600, h: 150, paras: [{ runs: [{ text: slide.number }] }], size: SIZE.sectionNum, weight: 800, color: C.primary, lineHeight: 1.1 }));
    els.push(T({ x: 96, y: 340, w: 1000, h: 72, paras: one(slide.title, C.accent), size: SIZE.sectionTitle, weight: 800, lineHeight: 1.2 }));
    if (slide.subtitle) els.push(T({ x: 96, y: 424, w: 1000, h: 36, paras: one(slide.subtitle), size: SIZE.question, weight: 500, color: C.muted }));
    if (ctx.brand && !ctx.logo?.ok) els.push(T({ x: W - M - 420, y: FRAME.crumbY + 4, w: 420, h: 24, paras: [{ runs: [{ text: ctx.brand }] }], size: SIZE.brand, weight: 700, color: C.faint, align: 'right', valign: 'middle' }));
  },

  bullets(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    els.push(card(M, b.top, CW, b.bottom - b.top));
    const t = T({ x: M + 36, y: b.top + 28, w: CW - 72, h: b.bottom - b.top - 56, paras: bulletParas(slide.items), size: SIZE.body, color: C.text2, lineHeight: 1.6, paraSpace: 8 });
    els.push(t);
    checkFit(t, '본문', ctx);
  },

  chart(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const bh = b.bottom - b.top;
    const hasK = slide.kpis.length > 0;
    const cw = hasK ? 740 : CW;
    const spec = slide.chartSpec;
    els.push(card(M, b.top, cw, bh));
    if (spec.title) els.push(T({ x: M + 28, y: b.top + 20, w: cw - 56, h: 30, paras: [{ runs: [{ text: spec.title }] }], size: SIZE.cardTitle, weight: 800, valign: 'middle' }));
    legend(spec, M + cw - 28, b.top + 23, els);
    els.push({ kind: 'chart', x: M + 16, y: b.top + 60, w: cw - 32, h: bh - 72, spec });
    if (hasK) {
      const n = slide.kpis.length;
      const gap = 15;
      const kh = Math.min(120, (bh - gap * (n - 1)) / n);
      slide.kpis.forEach((k, i) => kpiCard(k, M + cw + FRAME.gap, b.top + i * (kh + gap), CW - cw - FRAME.gap, kh, els));
    }
  },

  stats(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const n = slide.kpis.length;
    const w = (CW - FRAME.gap * (n - 1)) / n;
    const h = Math.min(180, b.bottom - b.top);
    const y = b.top + Math.max(0, (b.bottom - b.top - h) / 2);
    slide.kpis.forEach((k, i) => kpiCard(k, M + i * (w + FRAME.gap), y, w, h, els, SIZE.statValue));
  },

  cards(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const n = slide.cards.length;
    const gap = slide.flow ? 64 : FRAME.gap;
    const w = (CW - gap * (n - 1)) / n;
    const h = b.bottom - b.top;
    slide.cards.forEach((c, i) => {
      const x = M + i * (w + gap);
      const color = colorOf(c.color, SERIES[i % SERIES.length]);
      els.push(card(x, b.top, w, h));
      const chipW = Math.min(w - 48, textWidth(c.title, SIZE.chip, 700) + 64);
      els.push({ kind: 'rect', x: x + 24, y: b.top + 24, w: chipW, h: 38, fill: color, radius: 8 });
      els.push({ kind: 'circle', x: x + 32, y: b.top + 30, d: 26, fill: C.white, alpha: 0.28 });
      els.push(T({ x: x + 32, y: b.top + 30, w: 26, h: 26, paras: [{ runs: [{ text: String(i + 1) }] }], size: 15, weight: 700, color: C.white, align: 'center', valign: 'middle' }));
      els.push(T({ x: x + 66, y: b.top + 24, w: chipW - 50, h: 38, paras: [{ runs: [{ text: c.title }] }], size: SIZE.chip, weight: 700, color: C.white, valign: 'middle' }));
      const t = T({ x: x + 24, y: b.top + 80, w: w - 48, h: h - 104, paras: bulletParas(c.items), size: SIZE.body, color: C.text2, lineHeight: 1.6, paraSpace: 6 });
      els.push(t);
      checkFit(t, `${i + 1}번 카드`, ctx);
      if (slide.flow && i < n - 1) els.push({ kind: 'arrow', x: x + w + 12, y: b.top + h / 2 - 12, w: gap - 24, h: 24, color: C.arrow });
    });
  },

  figure(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const bh = b.bottom - b.top;
    const noteW = slide.note ? 360 : 0;
    const cw = slide.note ? CW - noteW - FRAME.gap : CW;
    els.push(card(M, b.top, cw, bh));
    const capH = slide.caption ? 34 : 0;
    imageOrPlaceholder(slide.img, slide.image, { x: M + 20, y: b.top + 20, w: cw - 40, h: bh - 40 - capH }, els);
    if (slide.caption) els.push(T({ x: M + 20, y: b.bottom - 20 - capH, w: cw - 40, h: capH, paras: one(slide.caption), size: SIZE.caption, color: C.muted, align: 'center', valign: 'middle' }));
    if (slide.note) {
      const x = M + cw + FRAME.gap;
      els.push(card(x, b.top, noteW, bh));
      els.push({ kind: 'rect', x: x + 24, y: b.top + 28, w: 4, h: 60, fill: C.primary, radius: 2 });
      const t = T({ x: x + 40, y: b.top + 24, w: noteW - 64, h: bh - 48, paras: one(slide.note, C.accent), size: SIZE.note, color: C.text2, lineHeight: 1.6 });
      els.push(t);
      checkFit(t, '해석', ctx);
    }
  },

  table(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const headH = 46;
    const rowH = 50;
    const need = headH + rowH * slide.rows.length + 16;
    const h = Math.min(b.bottom - b.top, need);
    if (need > b.bottom - b.top) ctx.warn('표가 넘칠 수 있어요. 행을 줄이거나 슬라이드를 나눠주세요');
    els.push(card(M, b.top, CW, h));
    const w = CW - 24;
    els.push({ kind: 'table', x: M + 12, y: b.top + 8, w, colW: colWidths(slide.columns, slide.rows, w), headH, rowH,
      columns: slide.columns, rows: slide.rows, highlight: slide.highlight, size: SIZE.table, headSize: SIZE.tableHead });
  },

  checklist(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const headH = 46;
    const rowH = 56;
    const need = headH + rowH * slide.items.length + 16;
    if (need > b.bottom - b.top) ctx.warn('체크리스트가 넘칠 수 있어요. 항목을 줄이거나 슬라이드를 나눠주세요');
    const h = Math.min(b.bottom - b.top, need);
    els.push(card(M, b.top, CW, h));
    const cols = { n: M + 28, t: M + 88, s: M + 660, o: M + 850 };
    const head = [['#', cols.n, 50], ['할 일', cols.t, 560], ['상태', cols.s, 180], ['비고', cols.o, CW - 850 - 28]];
    head.forEach(([label, x, w]) => els.push(T({ x, y: b.top + 8, w, h: headH, paras: [{ runs: [{ text: label }] }], size: SIZE.tableHead, weight: 700, color: C.muted, valign: 'middle' })));
    els.push({ kind: 'line', x1: M + 16, y1: b.top + 8 + headH, x2: M + CW - 16, y2: b.top + 8 + headH, color: C.line, width: 1.5 });
    slide.items.forEach((it, i) => {
      const y = b.top + 8 + headH + i * rowH;
      if (y + rowH > b.bottom) return;
      const st = STATUS[it.status];
      els.push(T({ x: cols.n, y, w: 50, h: rowH, paras: [{ runs: [{ text: String(i + 1) }] }], size: SIZE.table, weight: 700, color: C.faint, valign: 'middle' }));
      els.push(T({ x: cols.t, y, w: 560, h: rowH, paras: one(it.text), size: SIZE.table, valign: 'middle' }));
      els.push({ kind: 'pill', x: cols.s, y: y + (rowH - 32) / 2, w: 96, h: 32, text: st.label, fill: st.bg, color: st.fg, size: SIZE.pill });
      if (it.note) els.push(T({ x: cols.o, y, w: CW - 850 - 28, h: rowH, paras: one(it.note), size: SIZE.note, color: C.muted, valign: 'middle' }));
      if (i < slide.items.length - 1) els.push({ kind: 'line', x1: M + 16, y1: y + rowH, x2: M + CW - 16, y2: y + rowH, color: C.soft, width: 1 });
    });
  },

  compare(slide, ctx, els) {
    const b = frame(slide, ctx, els);
    const w = (CW - FRAME.gap) / 2;
    const h = b.bottom - b.top;
    [slide.left, slide.right].forEach((side, i) => {
      const x = M + i * (w + FRAME.gap);
      els.push(card(x, b.top, w, h));
      if (side.label) els.push(T({ x: x + 28, y: b.top + 22, w: w - 56, h: 30, paras: one(side.label), size: SIZE.cardTitle, weight: 800, color: C.primary, valign: 'middle' }));
      const box = { x: x + 28, y: b.top + 66, w: w - 56, h: h - 90 };
      if (side.image) imageOrPlaceholder(side.img, side.image, box, els);
      else if (side.kpis.length) {
        const kh = Math.min(120, (box.h - 12 * (side.kpis.length - 1)) / side.kpis.length);
        side.kpis.forEach((k, j) => kpiCard(k, box.x - 22, box.y + j * (kh + 12), box.w + 22, kh, els, SIZE.kpiValue, false));
      } else {
        const t = T({ ...box, paras: bulletParas(side.items), size: SIZE.body, color: C.text2, lineHeight: 1.6, paraSpace: 6 });
        els.push(t);
        checkFit(t, i === 0 ? '왼쪽' : '오른쪽', ctx);
      }
    });
  },
};

export function layoutSlide(slide, ctx, page) {
  const elements = [];
  const warnings = [];
  const c = { ...ctx, page, warn: message => warnings.push({ slide: slide.index, message }) };
  LAYOUT[slide.layout](slide, c, elements);
  return { elements, notes: slide.notes ?? '', warnings };
}

export function layoutDeck(slides, ctx = {}) {
  const pages = [];
  const warnings = [];
  slides.forEach((s, i) => {
    const r = layoutSlide(s, ctx, i + 1);
    pages.push({ elements: r.elements, notes: r.notes });
    warnings.push(...r.warnings);
  });
  return { pages, warnings };
}
