import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { W, H, C, FONT } from './style.js';
import { chartSvg } from './chart-svg.js';
import { fontFaceCss } from './fonts.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function relUrl(fromDir, absPath) {
  const rel = path.relative(fromDir, absPath);
  if (path.isAbsolute(rel)) return pathToFileURL(absPath).href;
  return rel.split(path.sep).map(encodeURIComponent).join('/');
}

const box = e => `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;`;
const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

function textHtml(e) {
  const paras = e.paras.map((p, i) => {
    const spans = p.runs.map(r => {
      const st = `${r.color ? `color:#${r.color};` : ''}${r.bold ? 'font-weight:800;' : ''}`;
      return st ? `<span style="${st}">${esc(r.text)}</span>` : esc(r.text);
    }).join('');
    const indent = p.bullet ? 30 + (p.level ?? 0) * 30 : 0;
    const mb = i < e.paras.length - 1 ? e.paraSpace ?? 0 : 0;
    return `<p class="${p.bullet ? 'li' : ''}" style="margin:0 0 ${mb}px ${indent}px">${spans}</p>`;
  }).join('');
  return `<div class="el t" style="${box(e)}justify-content:${JUSTIFY[e.valign]};text-align:${e.align};font-size:${e.size}px;font-weight:${e.weight};color:#${e.color};line-height:${e.lineHeight};">${paras}</div>`;
}

function lineSvg(x1, y1, x2, y2, color, width, arrow = false) {
  const pad = width + 8;
  const left = Math.min(x1, x2) - pad;
  const top = Math.min(y1, y2) - pad;
  const w = Math.abs(x2 - x1) + pad * 2;
  const h = Math.abs(y2 - y1) + pad * 2;
  const head = arrow ? `<path d="M${x2 - left - 10} ${y2 - top - 8} L${x2 - left} ${y2 - top} L${x2 - left - 10} ${y2 - top + 8}" fill="none" stroke="#${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  return `<svg class="el" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px" viewBox="0 0 ${w} ${h}"><line x1="${x1 - left}" y1="${y1 - top}" x2="${x2 - left}" y2="${y2 - top}" stroke="#${color}" stroke-width="${width}" stroke-linecap="round"/>${head}</svg>`;
}

function tableHtml(e) {
  const hl = new Set(e.highlight ?? []);
  const cols = e.colW.map(w => `<col style="width:${w}px">`).join('');
  const head = e.columns.map(c => `<th style="height:${e.headH}px;font-size:${e.headSize}px">${esc(c)}</th>`).join('');
  const body = e.rows.map((r, i) => `<tr class="${hl.has(i + 1) ? 'hl' : ''}">${r.map(c => `<td style="height:${e.rowH}px">${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="el tbl" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;font-size:${e.size}px"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function elementHtml(e, outDir) {
  switch (e.kind) {
    case 'rect': {
      const border = e.stroke ? `border:${e.strokeW ?? 1}px ${e.dash ? 'dashed' : 'solid'} #${e.stroke};` : '';
      return `<div class="el" style="${box(e)}background:#${e.fill};${border}border-radius:${e.radius ?? 0}px;${e.alpha != null ? `opacity:${e.alpha};` : ''}"></div>`;
    }
    case 'circle':
      return `<div class="el" style="left:${e.x}px;top:${e.y}px;width:${e.d}px;height:${e.d}px;border-radius:50%;background:#${e.fill};${e.alpha != null ? `opacity:${e.alpha};` : ''}"></div>`;
    case 'tri':
      return `<svg class="el" style="${box(e)}" viewBox="0 0 ${e.w} ${e.h}"><polygon points="0,0 ${e.w},${e.h / 2} 0,${e.h}" fill="#${e.fill}"/></svg>`;
    case 'line':
      return lineSvg(e.x1, e.y1, e.x2, e.y2, e.color, e.width);
    case 'arrow':
      return lineSvg(e.x, e.y + e.h / 2, e.x + e.w, e.y + e.h / 2, e.color, 4, true);
    case 'text':
      return textHtml(e);
    case 'image':
      return `<img class="el" style="${box(e)}" src="${esc(relUrl(outDir, e.img.absPath))}" alt="">`;
    case 'pill':
      return `<div class="el pill" style="${box(e)}background:#${e.fill};color:#${e.color};font-size:${e.size}px;border-radius:${e.h / 2}px">${esc(e.text)}</div>`;
    case 'table':
      return tableHtml(e);
    case 'chart':
      return `<div class="el" style="${box(e)}">${chartSvg(e.spec, e.w, e.h)}</div>`;
    default:
      return '';
  }
}

function css() {
  return `${fontFaceCss()}
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e9ecef; }
body { font-family: '${FONT.face}', '${FONT.fallback}', sans-serif; color: #${C.ink}; letter-spacing: -0.01em; }
.slide { position: relative; width:${W}px; height:${H}px; overflow: hidden; background: #${C.bg}; }
.el { position: absolute; margin: 0; }
.t { display: flex; flex-direction: column; overflow: visible; word-break: keep-all; }
.t p.li { position: relative; }
.t p.li::before { content: '•'; position: absolute; left: -22px; color: #A0A8BA; }
.pill { display: flex; align-items: center; justify-content: center; font-weight: 700; }
.tbl { border-collapse: collapse; table-layout: fixed; }
.tbl th { text-align: left; color: #${C.muted}; font-weight: 700; padding: 0 18px; border-bottom: 1.5px solid #${C.line}; }
.tbl td { padding: 0 18px; border-bottom: 1px solid #${C.soft}; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl tr.hl td { background: #${C.tint}; font-weight: 700; }
.notes { display: none; }
@media screen {
  body { height: 100vh; overflow: hidden; }
  .slide { display: none; position: absolute; left: 50%; top: 50%; transform-origin: center center; }
  .slide.active { display: block; }
  body.show-notes .slide.active .notes { display: block; position: absolute; left: 0; right: 0; bottom: 0; padding: 12pt 18pt; background: rgba(31,35,40,.88); color: #fff; font-size: 14pt; white-space: pre-wrap; }
  body.single { background: transparent; }
  body.single .slide.active { left: 0; top: 0; transform: none !important; }
}
@media print {
  html, body { background: #fff; }
  .slide { display: block !important; position: relative !important; left: auto !important; top: auto !important; transform: none !important; }
  .slide:not(:last-of-type) { break-after: page; }
  .notes { display: none !important; }
}`;
}

const SCRIPT = `(() => {
  const s = [...document.querySelectorAll('.slide')];
  const params = new URLSearchParams(location.search);
  let i = 0;
  const show = n => { i = Math.max(0, Math.min(s.length - 1, n)); s.forEach((e, j) => e.classList.toggle('active', j === i)); };
  if (params.has('slide')) { document.body.classList.add('single'); show(Number(params.get('slide')) - 1); return; }
  const fit = () => { const k = Math.min(innerWidth / ${W}, innerHeight / ${H}) * 0.96; s.forEach(e => { e.style.transform = 'translate(-50%, -50%) scale(' + k + ')'; }); };
  addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(i + 1);
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) show(i - 1);
    else if (e.key === 'n') document.body.classList.toggle('show-notes');
  });
  addEventListener('resize', fit);
  show(0); fit();
})();`;

export function paintHtml(pages, { outDir, title = '미팅 자료' } = {}) {
  const body = pages.map((p, i) => `<section class="slide" data-index="${i + 1}">${p.elements.map(e => elementHtml(e, outDir)).join('')}`
    + (p.notes ? `<aside class="notes">${esc(p.notes)}</aside>` : '') + '</section>').join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
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
