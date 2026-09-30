import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck } from '../renderer/parse.js';
import { resolveCharts } from '../renderer/chart-data.js';
import { resolveImages } from '../renderer/images.js';
import { layoutDeck } from '../renderer/layout.js';
import { paintHtml, relUrl } from '../renderer/paint-html.js';
import { makeSampleDeckV2 } from './helpers.js';

function html() {
  const dir = makeSampleDeckV2();
  const { deck, slides } = parseDeck(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'));
  resolveImages(slides, dir);
  resolveCharts(slides, dir);
  const { pages } = layoutDeck(slides, { ...deck, logo: null });
  return { pages, out: paintHtml(pages, { outDir: dir, title: '미팅 자료' }) };
}

test('슬라이드 수, 크기, 인쇄 설정, 글꼴', () => {
  const { out } = html();
  assert.equal((out.match(/<section class="slide"/g) ?? []).length, 10);
  assert.match(out, /\.slide \{[^}]*width:1280px;[^}]*height:720px/);
  assert.match(out, /@page\s*\{\s*size:\s*13\.333in 7\.5in/);
  assert.match(out, /\.slide:not\(:last-of-type\)\s*\{\s*break-after:\s*page/);
  assert.match(out, /data:font\/woff2;base64,/);
});

test('차트 SVG, 알약, 표, 이미지, 노트', () => {
  const { out } = html();
  assert.equal((out.match(/class="bar"/g) ?? []).length, 4);
  assert.match(out, />진행 중</);
  assert.match(out, /<table/);
  assert.match(out, /p&lt;0\.05 &amp; 유의/);
  assert.match(out, /src="assets\/plot\.png"/);
  assert.match(out, /<aside class="notes">결과 요약<\/aside>/);
});

test('강조 색이 span으로', () => {
  const { out } = html();
  assert.match(out, /<span style="[^"]*color:#5B45D6[^"]*">테스트 AP<\/span>/);
  assert.match(out, /<span style="[^"]*color:#E0457B[^"]*">테스트에서도<\/span>/);
});

test('요소 수: 배치도의 text 요소마다 div 하나', () => {
  const { pages, out } = html();
  const texts = pages.flatMap(p => p.elements).filter(e => e.kind === 'text').length;
  assert.equal((out.match(/class="el t"/g) ?? []).length, texts);
});

test('?slide=N 단일 슬라이드 모드 스크립트', () => {
  const { out } = html();
  assert.match(out, /URLSearchParams\(location\.search\)/);
  assert.match(out, /body\.single/);
});

test('relUrl: 공백·한글 인코딩', () => {
  assert.equal(relUrl(path.resolve('/a/b'), path.resolve('/a/b/c d/그림.png')), `c%20d/${encodeURIComponent('그림.png')}`);
});
