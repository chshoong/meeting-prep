import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fitContain, overflows, capacityLines, BOX, SIZE, SLIDE } from '../renderer/theme.js';
import { loadImage, resolveImages } from '../renderer/images.js';
import { parseDeck } from '../renderer/parse.js';
import { makeSampleDeck, tempDir, PNG_1x1 } from './helpers.js';

test('슬라이드는 16:9 와이드', () => {
  assert.deepEqual(SLIDE, { w: 13.333, h: 7.5 });
});

test('fitContain: 비율을 유지하며 가운데 정렬', () => {
  assert.deepEqual(fitContain({ x: 0, y: 0, w: 10, h: 5 }, 200, 100), { x: 0, y: 0, w: 10, h: 5 });
  assert.deepEqual(fitContain({ x: 0, y: 0, w: 10, h: 5 }, 100, 100), { x: 2.5, y: 0, w: 5, h: 5 });
});

test('overflows: 짧은 목록은 괜찮고 긴 목록은 넘침', () => {
  const short = [{ text: '짧은 항목', level: 0, bullet: true }];
  const long = Array.from({ length: 30 }, () => ({ text: '아주 긴 한국어 항목 '.repeat(8), level: 0, bullet: true }));
  assert.equal(overflows(short, BOX.body, SIZE.body), false);
  assert.equal(overflows(long, BOX.body, SIZE.body), true);
  assert.equal(capacityLines(BOX.body, SIZE.body), 16);
});

test('loadImage: 있는 그림, 없는 그림, 지원하지 않는 형식', () => {
  const dir = tempDir('그림 폴더');
  fs.writeFileSync(path.join(dir, '결과 1.png'), PNG_1x1);
  fs.writeFileSync(path.join(dir, 'x.svg'), '<svg/>');
  const ok = loadImage('결과 1.png', dir);
  assert.equal(ok.ok, true);
  assert.equal(ok.width, 1);
  assert.equal(ok.mime, 'image/png');
  assert.equal(loadImage('없음.png', dir).ok, false);
  assert.equal(loadImage('x.svg', dir).ok, false);
});

test('resolveImages: figure와 compare에 img를 붙이고 없는 그림은 경고', () => {
  const dir = makeSampleDeck();
  const { slides } = parseDeck(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'));
  slides[3].image = 'assets/없는그림.png';
  const warnings = resolveImages(slides, dir);
  assert.equal(slides[3].img.ok, false);
  assert.equal(slides[6].right.img.ok, true);
  assert.equal(slides[6].left.img, undefined);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].slide, 4);
  assert.match(warnings[0].message, /없는그림\.png/);
});
