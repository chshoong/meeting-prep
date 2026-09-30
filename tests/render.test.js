import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { render } from '../renderer/render.js';
import { makeSampleDeck, makeSampleDeckV2, tempDir } from './helpers.js';

const CLI = fileURLToPath(new URL('../renderer/render.js', import.meta.url));

test('render: 기본 형식 pptx·pdf, 브라우저 없으면 PDF 경고', async () => {
  const dir = makeSampleDeckV2();
  const r = await render(path.join(dir, 'deck.md'), { browser: null });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(r.outputs.pptx));
  assert.equal(r.outputs.html, undefined);
  assert.ok(r.warnings.some(w => /PDF를 건너뛰었습니다/.test(w.message)));
  assert.ok('pretendardInstalled' in r.fonts);
});

test('render: 옛 7종 덱도 오류 없이', async () => {
  const dir = makeSampleDeck();
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pptx', 'html'] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(fs.existsSync(r.outputs.html));
});

test('render: 차트 오류는 ok:false와 슬라이드 번호', async () => {
  const dir = tempDir('차트 오류');
  fs.writeFileSync(path.join(dir, 'deck.md'), '---\nlayout: chart\ntitle: t\nchart: { type: pie }\n---\n', 'utf8');
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pptx'] });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].slide, 1);
});

test('render: 넘침 경고가 결과에 들어감', async () => {
  const dir = tempDir('넘침');
  const many = Array.from({ length: 30 }, (_, i) => `- 항목 ${i} 한국어로 된 꽤 긴 설명이 들어갑니다`).join('\n');
  fs.writeFileSync(path.join(dir, 'deck.md'), `---\nlayout: bullets\ntitle: 짧음\n---\n${many}\n`, 'utf8');
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pptx'] });
  assert.ok(r.warnings.some(w => w.slide === 1 && /넘칠 수/.test(w.message)));
});

test('render: 로고 없음 경고, 사용자가 고친 PPTX 보호', async () => {
  const dir = makeSampleDeckV2();
  const deck = path.join(dir, 'deck.md');
  fs.writeFileSync(deck, fs.readFileSync(deck, 'utf8').replace('brand: KAMP PROJECT', 'brand: KAMP PROJECT\n  logo: assets/none.png'), 'utf8');
  const first = await render(deck, { formats: ['pptx'] });
  assert.ok(first.warnings.some(w => /로고/.test(w.message)));
  fs.writeFileSync(first.outputs.pptx, 'edited');
  const second = await render(deck, { formats: ['pptx'] });
  assert.match(path.basename(second.outputs.pptx), /deck-v2\.pptx/);
});

test('CLI: 형식 오류는 종료 코드 1과 JSON', () => {
  const dir = tempDir('깨진 덱');
  fs.writeFileSync(path.join(dir, 'deck.md'), '---\nlayout: pie\ntitle: x\n---\n', 'utf8');
  const p = spawnSync(process.execPath, [CLI, path.join(dir, 'deck.md'), '--formats', 'pptx'], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.equal(JSON.parse(p.stdout).errors[0].line, 1);
});

test('CLI: 정상 덱은 종료 코드 0, --preview 플래그 허용', () => {
  const dir = makeSampleDeckV2();
  const p = spawnSync(process.execPath, [CLI, path.join(dir, 'deck.md'), '--formats', 'pptx', '--preview'], { encoding: 'utf8', env: { ...process.env, MEETING_PREP_BROWSER: path.join(dir, 'no-browser.exe') } });
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.ok(out.outputs.pptx.endsWith('deck.pptx'));
});

test('CLI: 없는 덱 경로는 JSON 오류', () => {
  const p = spawnSync(process.execPath, [CLI, path.join(tempDir('없음'), 'nope.md')], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.equal(JSON.parse(p.stdout).ok, false);
});
