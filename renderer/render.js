#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseDeck } from './parse.js';
import { resolveImages } from './images.js';
import { renderPptx } from './pptx.js';
import { renderHtml } from './html.js';
import { findBrowser, renderPdf } from './pdf.js';
import { writePptxSafely } from './state.js';
import { BOX, SIZE, overflows } from './theme.js';

export function overflowWarnings(slides) {
  const out = [];
  const warn = (s, where) => out.push({ slide: s.index, message: `${where} 내용이 슬라이드를 넘칠 수 있습니다. 항목을 줄이거나 슬라이드를 나눠주세요` });
  const panel = { ...BOX.left, h: BOX.left.h - BOX.colLabel };
  for (const s of slides) {
    if (s.layout === 'bullets' && overflows(s.items, BOX.body, SIZE.body)) warn(s, '본문');
    if (s.layout === 'two-column' || s.layout === 'compare') {
      if (!s.left.image && overflows(s.left.items, panel, SIZE.body)) warn(s, '왼쪽');
      if (!s.right.image && overflows(s.right.items, panel, SIZE.body)) warn(s, '오른쪽');
    }
    if (s.layout === 'checklist') {
      const items = s.items.map(i => ({ text: `${i.text} ${i.note}`, level: 0 }));
      if (overflows(items, BOX.body, SIZE.body)) warn(s, '체크리스트');
    }
    if (s.layout === 'table' && s.rows.length > 12) warn(s, '표');
  }
  return out;
}

export async function render(deckPath, { formats = ['pptx', 'html', 'pdf'], outDir, browser } = {}) {
  const deckDir = path.dirname(path.resolve(deckPath));
  const out = path.resolve(outDir ?? deckDir);
  fs.mkdirSync(out, { recursive: true });
  const { slides, errors } = parseDeck(fs.readFileSync(deckPath, 'utf8'));
  if (errors.length) return { ok: false, errors, warnings: [], outputs: {} };

  const warnings = [...resolveImages(slides, deckDir), ...overflowWarnings(slides)];
  const outputs = {};

  if (formats.includes('pptx')) {
    const r = writePptxSafely(out, await renderPptx(slides));
    outputs.pptx = r.file;
    warnings.push(...r.warnings.map(message => ({ slide: null, message })));
  }

  const htmlPath = path.join(out, 'deck.html');
  if (formats.includes('html') || formats.includes('pdf')) {
    fs.writeFileSync(htmlPath, renderHtml(slides, { outDir: out }), 'utf8');
    if (formats.includes('html')) outputs.html = htmlPath;
  }

  if (formats.includes('pdf')) {
    const b = browser === undefined ? findBrowser() : browser;
    if (!b) {
      warnings.push({ slide: null, message: 'Chrome 또는 Edge를 찾지 못해 PDF를 건너뛰었습니다 (MEETING_PREP_BROWSER 환경 변수로 경로를 지정할 수 있습니다)' });
    } else {
      try {
        outputs.pdf = await renderPdf(htmlPath, path.join(out, 'deck.pdf'), b);
      } catch (e) {
        warnings.push({ slide: null, message: `PDF 생성 실패: ${e.message}` });
      }
    }
  }
  return { ok: true, errors: [], warnings, outputs };
}

const real = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const isMain = process.argv[1] && same(real(process.argv[1]), real(fileURLToPath(import.meta.url)));
if (isMain) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { formats: { type: 'string', default: 'pptx,html,pdf' }, out: { type: 'string' } },
  });
  if (!positionals[0]) {
    console.error('사용법: node render.js <deck.md> [--formats pptx,html,pdf] [--out 폴더]');
    process.exitCode = 2;
  } else {
  const result = await render(positionals[0], {
    formats: values.formats.split(',').map(s => s.trim()).filter(Boolean),
    outDir: values.out,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.ok ? 0 : 1;
  }
}
