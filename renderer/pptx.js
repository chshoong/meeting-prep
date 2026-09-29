import PptxGenJS from 'pptxgenjs';
import { SLIDE, FONT, COLOR, SIZE, BOX, STATUS_MARK, STATUS_COLOR, fitContain } from './theme.js';
import { parseInline } from './parse.js';

const BASE = { fontFace: FONT.face, color: COLOR.text, margin: 0 };

function runs(text, opts = {}) {
  return parseInline(text).map(r => ({ text: r.text, options: { ...opts, bold: Boolean(r.bold || opts.bold) } }));
}

// 문단 배열(각 문단은 run 배열)을 줄바꿈으로 이어 붙인다
function paragraphs(paras) {
  const out = [];
  paras.forEach((p, i) => {
    if (i < paras.length - 1) p[p.length - 1].options.breakLine = true;
    out.push(...p);
  });
  return out;
}

function addTitle(pres, s, title) {
  s.addText(runs(title, { fontSize: SIZE.title, bold: true }), { ...BASE, ...BOX.title, valign: 'middle' });
  s.addShape(pres.ShapeType.line, {
    x: BOX.title.x, y: BOX.title.y + BOX.title.h + 0.05, w: BOX.title.w, h: 0,
    line: { color: COLOR.rule, width: 1 },
  });
}

function addList(s, items, box) {
  if (!items.length) return;
  const paras = items.map(it => runs(it.text, {
    fontSize: SIZE.body, indentLevel: it.level, paraSpaceAfter: 6, ...(it.bullet ? { bullet: true } : {}),
  }));
  s.addText(paragraphs(paras), { ...BASE, ...box, valign: 'top' });
}

function addImage(pres, s, img, box) {
  if (img && img.ok) {
    s.addImage({ data: `${img.mime};base64,${img.data.toString('base64')}`, ...fitContain(box, img.width, img.height) });
    return;
  }
  s.addShape(pres.ShapeType.rect, { ...box, fill: { color: COLOR.panel }, line: { color: COLOR.warn, width: 1, dashType: 'dash' } });
  s.addText(`⚠ 그림 없음: ${img?.src ?? ''}`, { ...BASE, ...box, fontSize: SIZE.body, color: COLOR.warn, align: 'center', valign: 'middle' });
}

function addPanel(pres, s, side, box) {
  let target = box;
  if (side.label) {
    s.addText(runs(side.label, { fontSize: SIZE.label, bold: true, color: COLOR.accent }), { ...BASE, ...box, h: BOX.colLabel, valign: 'top' });
    target = { ...box, y: box.y + BOX.colLabel, h: box.h - BOX.colLabel };
  }
  if (side.image) addImage(pres, s, side.img ?? { src: side.image, ok: false }, target);
  else addList(s, side.items, target);
}

const BUILD = {
  title(pres, s, sl) {
    s.addText(runs(sl.title, { fontSize: SIZE.coverTitle, bold: true }), { ...BASE, ...BOX.coverTitle, valign: 'bottom' });
    if (sl.subtitle) s.addText(runs(sl.subtitle, { fontSize: SIZE.coverSub, color: COLOR.muted }), { ...BASE, ...BOX.coverSub, valign: 'top' });
    const meta = [sl.date, sl.author].filter(Boolean).join(' · ');
    if (meta) s.addText(meta, { ...BASE, ...BOX.coverMeta, fontSize: SIZE.coverMeta, color: COLOR.muted, valign: 'top' });
  },
  bullets(pres, s, sl) {
    addTitle(pres, s, sl.title);
    addList(s, sl.items, BOX.body);
  },
  figure(pres, s, sl) {
    addTitle(pres, s, sl.title);
    addImage(pres, s, sl.img ?? { src: sl.image, ok: false }, BOX.figure);
    if (sl.caption) {
      s.addText(runs(sl.caption, { fontSize: SIZE.caption, color: COLOR.muted }), { ...BASE, ...BOX.caption, align: 'center', valign: 'top' });
    }
  },
  'two-column'(pres, s, sl) {
    addTitle(pres, s, sl.title);
    addPanel(pres, s, sl.left, BOX.left);
    addPanel(pres, s, sl.right, BOX.right);
  },
  compare(pres, s, sl) {
    BUILD['two-column'](pres, s, sl);
    s.addShape(pres.ShapeType.line, { x: SLIDE.w / 2, y: BOX.left.y, w: 0, h: BOX.left.h, line: { color: COLOR.rule, width: 1 } });
  },
  table(pres, s, sl) {
    addTitle(pres, s, sl.title);
    const header = sl.columns.map(c => ({ text: c, options: { bold: true, fill: { color: COLOR.panel } } }));
    const body = sl.rows.map(row => row.map(c => ({ text: c })));
    s.addTable([header, ...body], {
      x: BOX.body.x, y: BOX.body.y, w: BOX.body.w,
      fontFace: FONT.face, fontSize: SIZE.table, color: COLOR.text,
      border: { type: 'solid', pt: 1, color: COLOR.rule }, valign: 'middle',
    });
  },
  checklist(pres, s, sl) {
    addTitle(pres, s, sl.title);
    const opt = { fontSize: SIZE.body, paraSpaceAfter: 10 };
    const paras = sl.items.map(it => [
      { text: `${STATUS_MARK[it.status]} `, options: { ...opt, color: STATUS_COLOR[it.status] } },
      ...runs(it.text, opt),
      ...(it.note ? [{ text: ` — ${it.note}`, options: { ...opt, fontSize: SIZE.body - 2, color: COLOR.muted } }] : []),
    ]);
    s.addText(paragraphs(paras), { ...BASE, ...BOX.body, valign: 'top' });
  },
};

export async function renderPptx(slides) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: FONT.face, bodyFontFace: FONT.face };
  for (const sl of slides) {
    const s = pres.addSlide();
    BUILD[sl.layout](pres, s, sl);
    if (sl.notes) s.addNotes(sl.notes);
  }
  return pres.write({ outputType: 'nodebuffer' });
}
