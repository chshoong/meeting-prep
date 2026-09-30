#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseDeck } from './parse.js';
import { resolveImages, loadImage } from './images.js';
import { resolveCharts } from './chart-data.js';
import { layoutDeck } from './layout.js';
import { paintPptx } from './paint-pptx.js';
import { paintHtml } from './paint-html.js';
import { findBrowser, renderPdf } from './pdf.js';
import { renderPreviews } from './preview.js';
import { pretendardInstalled } from './fonts.js';
import { writePptxSafely } from './state.js';

const NO_BROWSER = 'Chrome 또는 Edge를 찾지 못해 PDF를 건너뛰었습니다 (MEETING_PREP_BROWSER 환경 변수로 경로를 지정할 수 있습니다)';

export async function render(deckPath, { formats = ['pptx', 'pdf'], outDir, browser, preview = false } = {}) {
  const deckDir = path.dirname(path.resolve(deckPath));
  const out = path.resolve(outDir ?? deckDir);
  const { deck, slides, errors } = parseDeck(fs.readFileSync(deckPath, 'utf8'));
  if (errors.length) return { ok: false, errors, warnings: [], outputs: {} };
  const chartErrors = resolveCharts(slides, deckDir);
  if (chartErrors.length) return { ok: false, errors: chartErrors, warnings: [], outputs: {} };
  fs.mkdirSync(out, { recursive: true });

  const warnings = [...resolveImages(slides, deckDir)];
  let logo = null;
  if (deck.logo) {
    logo = loadImage(deck.logo, deckDir);
    if (!logo.ok) { warnings.push({ slide: null, message: `로고 이미지를 찾을 수 없어 이름표 글자로 대신했어요: ${deck.logo}` }); logo = null; }
  }
  const { pages, warnings: lw } = layoutDeck(slides, { ...deck, logo });
  warnings.push(...lw);
  const outputs = {};

  if (formats.includes('pptx')) {
    const r = writePptxSafely(out, await paintPptx(pages));
    outputs.pptx = r.file;
    warnings.push(...r.warnings.map(message => ({ slide: null, message })));
  }

  const htmlPath = path.join(out, 'deck.html');
  const needHtml = formats.includes('html') || formats.includes('pdf') || preview;
  if (needHtml) {
    fs.writeFileSync(htmlPath, paintHtml(pages, { outDir: out, title: slides[0]?.title.replace(/\*\*|==/g, '') ?? '미팅 자료' }), 'utf8');
    if (formats.includes('html')) outputs.html = htmlPath;
  }

  const b = needHtml && (formats.includes('pdf') || preview) ? (browser === undefined ? findBrowser() : browser) : null;
  if (formats.includes('pdf')) {
    if (!b) warnings.push({ slide: null, message: NO_BROWSER });
    else {
      try { outputs.pdf = await renderPdf(htmlPath, path.join(out, 'deck.pdf'), b); }
      catch (e) { warnings.push({ slide: null, message: `PDF 생성 실패: ${e.message}` }); }
    }
  }
  if (preview) {
    if (!b) warnings.push({ slide: null, message: '브라우저를 찾지 못해 미리보기 이미지를 건너뛰었습니다' });
    else {
      try { outputs.preview = await renderPreviews(htmlPath, out, pages.length, b); }
      catch (e) { warnings.push({ slide: null, message: `미리보기 생성 실패: ${e.message}` }); }
    }
  }
  return { ok: true, errors: [], warnings, outputs, fonts: { pretendardInstalled: pretendardInstalled() } };
}

const real = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const isMain = process.argv[1] && same(real(process.argv[1]), real(fileURLToPath(import.meta.url)));
if (isMain) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { formats: { type: 'string', default: 'pptx,pdf' }, out: { type: 'string' }, preview: { type: 'boolean', default: false } },
    });
    if (!positionals[0]) {
      console.error('사용법: node render.js <deck.md> [--formats pptx,pdf,html] [--out 폴더] [--preview]');
      process.exitCode = 2;
    } else {
      const result = await render(positionals[0], {
        formats: values.formats.split(',').map(s => s.trim()).filter(Boolean),
        outDir: values.out,
        preview: values.preview,
      });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exitCode = result.ok ? 0 : 1;
    }
  } catch (e) {
    const result = { ok: false, errors: [{ slide: null, line: null, message: e.message }], warnings: [], outputs: {} };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = 1;
  }
}
