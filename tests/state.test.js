import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writePptxSafely } from '../renderer/state.js';
import { tempDir } from './helpers.js';

const A = Buffer.from('A');
const B = Buffer.from('B');

test('처음에는 deck.pptx, 손대지 않았으면 다시 덮어씀', () => {
  const dir = tempDir('상태');
  assert.equal(path.basename(writePptxSafely(dir, A).file), 'deck.pptx');
  const r = writePptxSafely(dir, B);
  assert.equal(path.basename(r.file), 'deck.pptx');
  assert.deepEqual(r.warnings, []);
  assert.equal(fs.readFileSync(path.join(dir, 'deck.pptx'), 'utf8'), 'B');
});

test('사용자가 고친 deck.pptx는 덮어쓰지 않고 deck-v2.pptx에 저장', () => {
  const dir = tempDir('상태');
  writePptxSafely(dir, A);
  fs.writeFileSync(path.join(dir, 'deck.pptx'), '사용자 수정');
  const r = writePptxSafely(dir, B);
  assert.equal(path.basename(r.file), 'deck-v2.pptx');
  assert.match(r.warnings[0], /deck\.pptx.*직접 수정/);
  assert.equal(fs.readFileSync(path.join(dir, 'deck.pptx'), 'utf8'), '사용자 수정');
  assert.equal(path.basename(writePptxSafely(dir, A).file), 'deck-v2.pptx');
});

test('기록 없이 이미 있던 deck.pptx도 보호', () => {
  const dir = tempDir('상태');
  fs.writeFileSync(path.join(dir, 'deck.pptx'), '원래 파일');
  assert.equal(path.basename(writePptxSafely(dir, A).file), 'deck-v2.pptx');
});

test('PowerPoint에서 열려 있으면(EBUSY) 다음 버전에 저장하고 경고', () => {
  const dir = tempDir('상태');
  const writeFile = (p, b) => {
    if (path.basename(p) === 'deck.pptx') { const e = new Error('busy'); e.code = 'EBUSY'; throw e; }
    fs.writeFileSync(p, b);
  };
  const r = writePptxSafely(dir, A, { writeFile });
  assert.equal(path.basename(r.file), 'deck-v2.pptx');
  assert.match(r.warnings[0], /열려 있어/);
});
