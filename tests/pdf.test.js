import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { parseDeck } from '../renderer/parse.js';
import { resolveImages } from '../renderer/images.js';
import { renderHtml } from '../renderer/html.js';
import { findBrowser, browserCandidates, renderPdf } from '../renderer/pdf.js';
import { makeSampleDeck } from './helpers.js';

test('findBrowser: 환경 변수가 우선, 없으면 후보 중 존재하는 것', () => {
  assert.equal(findBrowser({ env: { MEETING_PREP_BROWSER: 'X:/b.exe' }, exists: p => p === 'X:/b.exe' }), 'X:/b.exe');
  assert.equal(findBrowser({ env: { MEETING_PREP_BROWSER: 'X:/b.exe' }, exists: () => false }), null);
  const env = { 'PROGRAMFILES(X86)': 'C:\\PF86' };
  const edge = browserCandidates('win32', env)[0];
  assert.match(edge, /msedge\.exe$/);
  assert.equal(findBrowser({ env, platform: 'win32', exists: p => p === edge }), edge);
  assert.equal(findBrowser({ env: {}, platform: 'linux', exists: () => false }), null);
});

const browser = findBrowser();

test('HTML → PDF: 7쪽, 16:9, 한글 폰트 포함', { skip: browser ? false : '브라우저 없음', timeout: 120000 }, async () => {
  const dir = makeSampleDeck();
  const { slides } = parseDeck(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'));
  resolveImages(slides, dir);
  const htmlPath = path.join(dir, 'deck.html');
  fs.writeFileSync(htmlPath, renderHtml(slides, { outDir: dir }), 'utf8');
  const pdfPath = path.join(dir, 'deck.pdf');
  await renderPdf(htmlPath, pdfPath, browser);
  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 7);
  const { width, height } = doc.getPage(0).getSize();
  assert.equal(Math.round(width), 960);
  assert.equal(Math.round(height), 540);
  assert.ok(bytes.toString('latin1').includes('Pretendard'), 'PDF에 Pretendard 폰트가 포함되어야 함');
});
