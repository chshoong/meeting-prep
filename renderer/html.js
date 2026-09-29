import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SLIDE, FONT, COLOR, SIZE, BOX, STATUS_MARK, STATUS_COLOR, fitContain } from './theme.js';
import { parseInline } from './parse.js';
import { fontFaceCss } from './fonts.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function relUrl(fromDir, absPath) {
  const rel = path.relative(fromDir, absPath);
  if (path.isAbsolute(rel)) return pathToFileURL(absPath).href; // 다른 드라이브
  return rel.split(path.sep).map(encodeURIComponent).join('/');
}

const inline = t => parseInline(t).map(r => (r.bold ? `<b>${esc(r.text)}</b>` : esc(r.text))).join('');
const pos = b => `left:${b.x}in;top:${b.y}in;width:${b.w}in;height:${b.h}in;`;

function titleHtml(title) {
  const rule = { x: BOX.title.x, y: BOX.title.y + BOX.title.h + 0.05, w: BOX.title.w, h: 0 };
  return `<div class="abs title" style="${pos(BOX.title)}">${inline(title)}</div><div class="abs rule" style="${pos(rule)}"></div>`;
}

function listHtml(items, box) {
  const ps = items.map(it => {
    const indent = it.level * 0.4 + (it.bullet ? 0.3 : 0);
    return `<p class="${it.bullet ? 'li' : 'para'}" style="margin-left:${indent}in">${inline(it.text)}</p>`;
  }).join('');
  return `<div class="abs list" style="${pos(box)}">${ps}</div>`;
}

function imageHtml(img, box, outDir) {
  if (img && img.ok) {
    const r = fitContain(box, img.width, img.height);
    return `<img class="abs" style="${pos(r)}" src="${esc(relUrl(outDir, img.absPath))}" alt="">`;
  }
  return `<div class="abs missing" style="${pos(box)}">⚠ 그림 없음: ${esc(img?.src ?? '')}</div>`;
}

function panelHtml(side, box, outDir) {
  let h = '';
  let target = box;
  if (side.label) {
    h += `<div class="abs label" style="${pos({ ...box, h: BOX.colLabel })}">${inline(side.label)}</div>`;
    target = { ...box, y: box.y + BOX.colLabel, h: box.h - BOX.colLabel };
  }
  h += side.image ? imageHtml(side.img ?? { src: side.image, ok: false }, target, outDir) : listHtml(side.items, target);
  return h;
}

const BUILD = {
  title(sl) {
    const meta = [sl.date, sl.author].filter(Boolean).join(' · ');
    return `<div class="abs cover-title" style="${pos(BOX.coverTitle)}">${inline(sl.title)}</div>`
      + (sl.subtitle ? `<div class="abs cover-sub" style="${pos(BOX.coverSub)}">${inline(sl.subtitle)}</div>` : '')
      + (meta ? `<div class="abs cover-meta" style="${pos(BOX.coverMeta)}">${esc(meta)}</div>` : '');
  },
  bullets(sl) {
    return titleHtml(sl.title) + listHtml(sl.items, BOX.body);
  },
  figure(sl, outDir) {
    return titleHtml(sl.title) + imageHtml(sl.img ?? { src: sl.image, ok: false }, BOX.figure, outDir)
      + (sl.caption ? `<div class="abs caption" style="${pos(BOX.caption)}">${inline(sl.caption)}</div>` : '');
  },
  'two-column'(sl, outDir) {
    return titleHtml(sl.title) + panelHtml(sl.left, BOX.left, outDir) + panelHtml(sl.right, BOX.right, outDir);
  },
  compare(sl, outDir) {
    const v = { x: SLIDE.w / 2, y: BOX.left.y, w: 0, h: BOX.left.h };
    return BUILD['two-column'](sl, outDir) + `<div class="abs vrule" style="${pos(v)}"></div>`;
  },
  table(sl) {
    const head = sl.columns.map(c => `<th>${esc(c)}</th>`).join('');
    const body = sl.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    return titleHtml(sl.title)
      + `<table class="abs tbl" style="left:${BOX.body.x}in;top:${BOX.body.y}in;width:${BOX.body.w}in"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  },
  checklist(sl) {
    const ps = sl.items.map(it => `<p class="check"><span style="color:#${STATUS_COLOR[it.status]}">${STATUS_MARK[it.status]}</span> ${inline(it.text)}`
      + (it.note ? ` <span class="muted">— ${esc(it.note)}</span>` : '') + '</p>').join('');
    return titleHtml(sl.title) + `<div class="abs list" style="${pos(BOX.body)}">${ps}</div>`;
  },
};

function css() {
  return `${fontFaceCss()}
@page { size: ${SLIDE.w}in ${SLIDE.h}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e9ecef; }
body { font-family: '${FONT.face}', '${FONT.fallback}', sans-serif; color: #${COLOR.text}; }
.slide { position: relative; width: ${SLIDE.w}in; height: ${SLIDE.h}in; background: #fff; overflow: hidden; }
.abs { position: absolute; margin: 0; }
.title { font-size: ${SIZE.title}pt; font-weight: 700; display: flex; align-items: center; }
.rule { border-top: 1px solid #${COLOR.rule}; }
.vrule { border-left: 1px solid #${COLOR.rule}; }
.cover-title { font-size: ${SIZE.coverTitle}pt; font-weight: 700; display: flex; align-items: flex-end; }
.cover-sub { font-size: ${SIZE.coverSub}pt; color: #${COLOR.muted}; }
.cover-meta { font-size: ${SIZE.coverMeta}pt; color: #${COLOR.muted}; }
.list p { margin: 0 0 6pt 0; font-size: ${SIZE.body}pt; line-height: 1.4; }
.list p.check { margin-bottom: 10pt; }
.li { position: relative; }
.li::before { content: '•'; position: absolute; left: -0.3in; }
.muted { color: #${COLOR.muted}; font-size: ${SIZE.body - 2}pt; }
.label { font-size: ${SIZE.label}pt; font-weight: 700; color: #${COLOR.accent}; }
.caption { font-size: ${SIZE.caption}pt; color: #${COLOR.muted}; text-align: center; }
.missing { display: flex; align-items: center; justify-content: center; background: #${COLOR.panel}; border: 1px dashed #${COLOR.warn}; color: #${COLOR.warn}; font-size: ${SIZE.body}pt; }
.tbl { border-collapse: collapse; font-size: ${SIZE.table}pt; }
.tbl th, .tbl td { border: 1px solid #${COLOR.rule}; padding: 6pt 8pt; text-align: left; }
.tbl th { background: #${COLOR.panel}; font-weight: 700; }
.notes { display: none; }
@media screen {
  body { height: 100vh; overflow: hidden; }
  .slide { display: none; position: absolute; left: 50%; top: 50%; transform-origin: center center; }
  .slide.active { display: block; }
  body.show-notes .slide.active .notes { display: block; position: absolute; left: 0; right: 0; bottom: 0; padding: 12pt 18pt; background: rgba(31,35,40,.88); color: #fff; font-size: 14pt; white-space: pre-wrap; }
}
@media print {
  html, body { background: #fff; }
  .slide { display: block !important; position: relative !important; left: auto !important; top: auto !important; transform: none !important; }
  .slide:not(:last-child) { break-after: page; }
  .notes { display: none !important; }
}`;
}

const SCRIPT = `(() => {
  const s = [...document.querySelectorAll('.slide')];
  const W = ${SLIDE.w * 96}, H = ${SLIDE.h * 96};
  let i = 0;
  const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H) * 0.96; s.forEach(e => { e.style.transform = 'translate(-50%, -50%) scale(' + k + ')'; }); };
  const show = n => { i = Math.max(0, Math.min(s.length - 1, n)); s.forEach((e, j) => e.classList.toggle('active', j === i)); };
  addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(i + 1);
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) show(i - 1);
    else if (e.key === 'n') document.body.classList.toggle('show-notes');
  });
  addEventListener('click', () => show(i + 1));
  addEventListener('resize', fit);
  show(0); fit();
})();`;

export function renderHtml(slides, { outDir, title } = {}) {
  const docTitle = title ?? slides[0]?.title ?? '미팅 자료';
  const body = slides.map(sl => `<section class="slide" data-index="${sl.index}">${BUILD[sl.layout](sl, outDir)}`
    + (sl.notes ? `<aside class="notes">${esc(sl.notes)}</aside>` : '') + '</section>').join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<style>
${css()}
</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
