import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, H, C, SERIES, seriesColors, colorOf, textWidth, wrapLines, fitContain, niceScale, FRAME, SIZE } from '../renderer/style.js';

test('기본 크기와 색', () => {
  assert.equal(W, 1280);
  assert.equal(H, 720);
  assert.equal(C.primary, '4F6BED');
  assert.equal(C.accent, '5B45D6');
  assert.deepEqual(SERIES, ['4F6BED', '7B5BE6', 'F08A3C', '2BA471']);
  assert.equal(FRAME.margin, 56);
  assert.equal(SIZE.title, 44);
});

test('seriesColors: 기준 계열은 연한 파랑, 나머지는 순서대로', () => {
  assert.deepEqual(seriesColors(['베이스라인', '선정 모델']), ['C9D2FA', '4F6BED']);
  assert.deepEqual(seriesColors(['A', 'Baseline', 'B', 'C', 'D']), ['4F6BED', 'C9D2FA', '7B5BE6', 'F08A3C', '2BA471']);
  assert.deepEqual(seriesColors(['기존 방법', '기준선']), ['C9D2FA', 'C9D2FA']);
});

test('colorOf: 이름, hex, 기본값', () => {
  assert.equal(colorOf('orange', '000000'), 'F08A3C');
  assert.equal(colorOf('#12ab34', '000000'), '12AB34');
  assert.equal(colorOf('없는색', '4F6BED'), '4F6BED');
  assert.equal(colorOf(undefined, '4F6BED'), '4F6BED');
});

test('textWidth와 wrapLines: 한글은 영문보다 넓다', () => {
  assert.ok(textWidth('가나다라', 20) > textWidth('abcd', 20));
  assert.ok(textWidth('abc', 20, 800) > textWidth('abc', 20, 400));
  assert.equal(wrapLines('짧다', 500, 18), 1);
  assert.ok(wrapLines('아주 긴 한국어 문장이 들어갑니다 '.repeat(10), 300, 18) > 3);
});

test('fitContain: 비율 유지, 가운데', () => {
  assert.deepEqual(fitContain({ x: 0, y: 0, w: 200, h: 100 }, 100, 100), { x: 50, y: 0, w: 100, h: 100 });
});

test('niceScale: 보기 좋은 눈금, 같은 값·0뿐·음수 처리', () => {
  assert.deepEqual(niceScale(0, 0.43), { min: 0, max: 0.6, step: 0.2 });
  const same = niceScale(5, 5);
  assert.ok(same.max > same.min && same.step > 0);
  const zero = niceScale(0, 0);
  assert.ok(zero.max > 0 && zero.step > 0);
  const neg = niceScale(-0.03, 0.08);
  assert.ok(neg.min <= -0.03 && neg.max >= 0.08);
});
