import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck } from '../renderer/parse.js';
import { resolveCharts } from '../renderer/chart-data.js';
import { resolveImages } from '../renderer/images.js';
import { layoutDeck } from '../renderer/layout.js';
import { W, H, C } from '../renderer/style.js';
import { makeSampleDeckV2 } from './helpers.js';

function build() {
  const dir = makeSampleDeckV2();
  const { deck, slides } = parseDeck(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'));
  resolveImages(slides, dir);
  assert.deepEqual(resolveCharts(slides, dir), []);
  return layoutDeck(slides, { ...deck, logo: null });
}

const boxOf = e => (e.kind === 'line' ? null : e.kind === 'circle' ? { x: e.x, y: e.y, w: e.d, h: e.d } : { x: e.x, y: e.y, w: e.w, h: e.h ?? 0 });
const cards = els => els.filter(e => e.kind === 'rect' && e.fill === C.white && e.stroke);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('모든 페이지: 요소가 슬라이드 안, 카드끼리 겹치지 않음', () => {
  const { pages } = build();
  assert.equal(pages.length, 10);
  pages.forEach((p, i) => {
    for (const e of p.elements) {
      const b = boxOf(e);
      if (!b) continue;
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W + 0.5 && b.y + b.h <= H + 0.5, `page ${i + 1} ${e.kind} out of bounds`);
    }
    const cs = cards(p.elements);
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      assert.ok(!overlap(cs[a], cs[b]), `page ${i + 1} cards ${a} and ${b} overlap`);
    }
  });
});

test('공통 뼈대: 섹션 표시, 이름표, 쪽 번호, 결론 띠', () => {
  const { pages } = build();
  const texts = p => p.elements.filter(e => e.kind === 'text').map(e => e.paras.map(q => q.runs.map(r => r.text).join('')).join('\n'));
  const p3 = texts(pages[2]);
  assert.ok(p3.includes('주요 결과'));
  assert.ok(p3.includes('KAMP PROJECT'));
  assert.ok(p3.includes('3'));
  assert.ok(pages[2].elements.some(e => e.kind === 'rect' && e.fill === C.tint));
  assert.equal(pages[2].notes, '결과 요약');
});

test('제목의 **강조**는 accent 색, 결론 띠의 ==분홍==은 pink', () => {
  const { pages } = build();
  const runs = pages[2].elements.filter(e => e.kind === 'text').flatMap(e => e.paras.flatMap(p => p.runs));
  assert.ok(runs.some(r => r.text === '테스트 AP' && r.color === C.accent));
  assert.ok(runs.some(r => r.text === '테스트에서도' && r.color === C.pink));
});

test('chart + kpis: 차트 요소 하나, 수치 카드 3개, 하락이 좋은 지표는 초록', () => {
  const { pages } = build();
  const els = pages[2].elements;
  assert.equal(els.filter(e => e.kind === 'chart').length, 1);
  assert.equal(cards(els).length, 4);
  const deltas = els.filter(e => e.kind === 'text' && /^[▲▼]/.test(e.paras[0].runs[0].text));
  assert.deepEqual(deltas.map(d => [d.paras[0].runs[0].text, d.color]), [['▲ 21%', C.up], ['▲ 0.02', C.up], ['▼ 18%', C.up]]);
});

test('cards(flow): 카드 3개 사이에 화살표 2개', () => {
  const { pages } = build();
  assert.equal(cards(pages[4].elements).length, 3);
  assert.equal(pages[4].elements.filter(e => e.kind === 'arrow').length, 2);
});

test('checklist: 상태 알약 3개와 색', () => {
  const { pages } = build();
  const pills = pages[7].elements.filter(e => e.kind === 'pill');
  assert.deepEqual(pills.map(p => [p.text, p.fill]), [['완료', 'E3F5EC'], ['진행 중', 'FFF3E3'], ['미착수', 'FDECEE']]);
});

test('table: 강조 행 전달', () => {
  const { pages } = build();
  const t = pages[6].elements.find(e => e.kind === 'table');
  assert.deepEqual(t.highlight, [2]);
  assert.equal(t.colW.length, 4);
  assert.ok(Math.abs(t.colW.reduce((a, b) => a + b, 0) - t.w) < 1);
});

test('넘침 경고: 긴 제목, 많은 글머리표', () => {
  const long = `---\nlayout: bullets\ntitle: ${'아주 긴 제목 '.repeat(20)}\n---\n${Array.from({ length: 30 }, (_, i) => `- 항목 ${i} 한국어로 된 꽤 긴 설명이 들어갑니다`).join('\n')}\n`;
  const { slides } = parseDeck(long);
  const { warnings } = layoutDeck(slides, { brand: '' });
  assert.ok(warnings.some(w => w.slide === 1 && /제목/.test(w.message)));
  assert.ok(warnings.some(w => w.slide === 1 && /본문/.test(w.message)));
});

test('그림이 없으면 경고 상자', () => {
  const { slides } = parseDeck('---\nlayout: figure\ntitle: t\nimage: nope.png\n---\n');
  resolveImages(slides, '.');
  const { pages } = layoutDeck(slides, { brand: '' });
  assert.ok(pages[0].elements.some(e => e.kind === 'rect' && e.dash));
  assert.ok(pages[0].elements.some(e => e.kind === 'text' && /그림 없음: nope\.png/.test(e.paras[0].runs[0].text)));
});
