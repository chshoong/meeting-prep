import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { findBrowser, browserCandidates, renderPdf } from '../renderer/pdf.js';
import { render } from '../renderer/render.js';
import { makeSampleDeckV2, tempDir } from './helpers.js';

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

test('HTML → PDF: 10쪽, 16:9, 한글 폰트 포함', { skip: browser ? false : '브라우저 없음', timeout: 120000 }, async () => {
  const dir = makeSampleDeckV2();
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pdf'] });
  assert.ok(r.outputs.pdf, JSON.stringify(r.warnings));
  const bytes = fs.readFileSync(r.outputs.pdf);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 10);
  const { width, height } = doc.getPage(0).getSize();
  assert.equal(Math.round(width), 960);
  assert.equal(Math.round(height), 540);
  assert.ok(bytes.toString('latin1').includes('Pretendard'));
});

test('실패한 브라우저의 출력이 오류 메시지에 들어감', async () => {
  const dir = tempDir('PDF 실패');
  const html = path.join(dir, 'deck.html');
  fs.writeFileSync(html, '<html></html>', 'utf8');
  // node는 --headless=new 같은 브라우저 옵션을 모른다고 stderr에 쓰고 종료한다
  await assert.rejects(renderPdf(html, path.join(dir, 'deck.pdf'), process.execPath), e =>
    /브라우저가 PDF를 만들지 못했습니다/.test(e.message) && /브라우저 출력: .*headless/s.test(e.message));
});

test('시간 초과는 따로 표시', async () => {
  const dir = tempDir('PDF 시간 초과');
  const html = path.join(dir, 'deck.html');
  fs.writeFileSync(html, '<html></html>', 'utf8');
  const spawnImpl = (_cmd, _args, opts) => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], opts);
  await assert.rejects(renderPdf(html, path.join(dir, 'deck.pdf'), 'fake', { timeoutMs: 300, spawnImpl }), e =>
    /시간 초과 0\.3초/.test(e.message));
});
