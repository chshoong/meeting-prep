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

const inBox = (e, c) => { const b = boxOf(e); return !b || (b.x >= c.x - 0.5 && b.x + b.w <= c.x + c.w + 0.5 && b.y + b.h <= c.y + c.h + 0.5); };
const textBoxes = els => els.filter(e => e.kind === 'text');

test('stats: 긴 수치와 변화량도 카드 밖으로 나가지 않음', () => {
  const k = l => `  - { label: ${l}, value: "12,345건", delta: "+0.0215" }`;
  const { slides } = parseDeck(`---\nlayout: stats\ntitle: t\nkpis:\n${[k('가'), k('나'), k('다'), k('라')].join('\n')}\n---\n`);
  const { pages } = layoutDeck(slides, { brand: '' });
  const els = pages[0].elements;
  const cs = cards(els);
  assert.equal(cs.length, 4);
  for (const c of cs) {
    const inside = els.filter(e => e !== c && e.kind === 'text' && e.x >= c.x && e.x < c.x + c.w && e.y >= c.y && e.y < c.y + c.h);
    assert.ok(inside.length >= 3);
    for (const e of inside) assert.ok(e.x + e.w <= c.x + c.w + 0.5 && e.y + e.h <= c.y + c.h + 0.5 && e.x + e.w <= W);
  }
});

test('긴 계열 이름: 범례가 카드 안, 차트는 아래로, 제목과 겹치지 않음', () => {
  const { slides } = parseDeck('---\nlayout: chart\ntitle: t\nchart:\n  type: bar\n  title: 제품별 Test AP\n  data: a.csv\n  x: a\n  y: [b]\n---\n');
  slides[0].chartSpec = { type: 'bar', title: '제품별 Test AP', series: ['A', 'B', 'C', 'D'].map((s, i) => ({ name: `Very long series name ${s} with extra words`, color: ['111111', '222222', '333333', '444444'][i] })) };
  slides[0].kpis = [];
  const { pages } = layoutDeck(slides, { brand: '' });
  const els = pages[0].elements;
  const card0 = cards(els)[0];
  const swatches = els.filter(e => e.kind === 'rect' && e.w === 14 && e.h === 14);
  assert.equal(swatches.length, 4);
  assert.ok(swatches.every(s => s.x >= card0.x));
  const ch = els.find(e => e.kind === 'chart');
  assert.ok(ch.y >= card0.y + 90 && ch.y + ch.h <= card0.y + card0.h);
  const title = textBoxes(els).find(e => e.paras[0].runs[0].text === '제품별 Test AP');
  const legendTexts = textBoxes(els).filter(e => /Very long/.test(e.paras[0].runs[0].text));
  for (const t of legendTexts) assert.ok(!overlap(t, title));
});

test('cards(flow) 긴 칩 제목: 칩 안에 들어가거나 경고', () => {
  const card = t => `  - title: ${t}\n    items: [a]`;
  const { slides } = parseDeck(`---\nlayout: cards\ntitle: t\nflow: true\ncards:\n${['Data Audit and Cleaning', 'Model Selection Pipeline', 'Evaluation and Reporting', 'Deploy'].map(card).join('\n')}\n---\n`);
  const { pages, warnings } = layoutDeck(slides, { brand: '' });
  const els = pages[0].elements;
  const chips = els.filter(e => e.kind === 'rect' && e.h === 38 && e.radius === 8);
  assert.equal(chips.length, 4);
  for (const chip of chips) {
    const t = textBoxes(els).find(e => e.h === 38 && e.x > chip.x && e.x < chip.x + chip.w);
    assert.ok(t.x + t.w <= chip.x + chip.w + 0.5 || warnings.length > 0);
  }
});

test('표 20행: 카드 안에서 끝나고 경고', () => {
  const rows = Array.from({ length: 20 }, (_, i) => `  - [r${i}, a]`).join('\n');
  const { slides } = parseDeck(`---\nlayout: table\ntitle: t\ncolumns: [x, y]\nrows:\n${rows}\n---\n`);
  const { pages, warnings } = layoutDeck(slides, { brand: '' });
  const els = pages[0].elements;
  const t = els.find(e => e.kind === 'table');
  const c = cards(els)[0];
  assert.ok(t.y + t.headH + t.rowH * t.rows.length <= c.y + c.h);
  assert.ok(t.rows.length < 20);
  assert.ok(warnings.length > 0);
});

test('체크리스트: 아주 긴 항목은 경고', () => {
  const { slides } = parseDeck(`---\nlayout: checklist\ntitle: t\nitems:\n  - { text: "${'아주 긴 할 일 설명 '.repeat(20)}", status: done }\n---\n`);
  const { warnings } = layoutDeck(slides, { brand: '' });
  assert.ok(warnings.some(w => /2줄/.test(w.message)));
});
