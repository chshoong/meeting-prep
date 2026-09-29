import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { render, overflowWarnings } from '../renderer/render.js';
import { parseDeck } from '../renderer/parse.js';
import { makeSampleDeck, tempDir } from './helpers.js';

const CLI = fileURLToPath(new URL('../renderer/render.js', import.meta.url));

test('render: 기본 형식은 pptx와 pdf, 브라우저 없으면 PDF 경고 후 건너뜀', async () => {
  const dir = makeSampleDeck();
  const r = await render(path.join(dir, 'deck.md'), { browser: null });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(r.outputs.pptx));
  assert.equal(r.outputs.html, undefined);
  assert.equal(r.outputs.pdf, undefined);
  assert.ok(r.warnings.some(w => /PDF를 건너뛰었습니다/.test(w.message)));
});

test('render: 형식 선택', async () => {
  const dir = makeSampleDeck();
  const r = await render(path.join(dir, 'deck.md'), { formats: ['html'] });
  assert.deepEqual(Object.keys(r.outputs), ['html']);
  assert.equal(fs.existsSync(path.join(dir, 'deck.pptx')), false);
});

test('overflowWarnings: 넘칠 수 있는 슬라이드를 번호로 알려줌', () => {
  const many = Array.from({ length: 25 }, (_, i) => `- 항목 ${i} 한국어로 된 꽤 긴 설명이 들어갑니다 한국어로 된 꽤 긴 설명`).join('\n');
  const { slides } = parseDeck(`---\nlayout: bullets\ntitle: 짧음\n---\n- 하나\n---\nlayout: bullets\ntitle: 김\n---\n${many}\n`);
  const w = overflowWarnings(slides);
  assert.equal(w.length, 1);
  assert.equal(w[0].slide, 2);
  assert.match(w[0].message, /넘칠 수 있습니다/);
});

test('CLI: 형식 오류는 종료 코드 1과 줄 번호가 있는 JSON', () => {
  const dir = tempDir('깨진 덱');
  fs.writeFileSync(path.join(dir, 'deck.md'), '---\nlayout: pie\ntitle: x\n---\n', 'utf8');
  const p = spawnSync(process.execPath, [CLI, path.join(dir, 'deck.md'), '--formats', 'pptx'], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  const out = JSON.parse(p.stdout);
  assert.equal(out.ok, false);
  assert.equal(out.errors[0].line, 1);
});

test('CLI: 정상 덱은 종료 코드 0', () => {
  const dir = makeSampleDeck();
  const p = spawnSync(process.execPath, [CLI, path.join(dir, 'deck.md'), '--formats', 'pptx,html'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.ok(out.outputs.pptx.endsWith('deck.pptx'));
});

test('CLI: 소문자 드라이브 문자와 슬래시 경로로 호출해도 실행됨 (win32)', { skip: process.platform !== 'win32' }, () => {
  const dir = makeSampleDeck();
  const script = CLI.replace(/\\/g, '/').replace(/^[A-Za-z]:/, m => m.toLowerCase());
  assert.notEqual(script, CLI);
  const p = spawnSync(process.execPath, [script, path.join(dir, 'deck.md'), '--formats', 'html'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.equal(out.ok, true);
});

test('CLI: 없는 deck 경로는 exit 1과 ok:false JSON', () => {
  const p = spawnSync(process.execPath, [CLI, path.join(os.tmpdir(), 'no-such-dir-xyz', 'deck.md')], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.equal(JSON.parse(p.stdout).ok, false);
});
