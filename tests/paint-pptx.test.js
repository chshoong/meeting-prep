import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parseDeck } from '../renderer/parse.js';
import { resolveCharts } from '../renderer/chart-data.js';
import { resolveImages } from '../renderer/images.js';
import { layoutDeck } from '../renderer/layout.js';
import { paintPptx, PAINTED_KINDS } from '../renderer/paint-pptx.js';
import { makeSampleDeckV2 } from './helpers.js';

async function build(text, dir) {
  const { deck, slides } = parseDeck(text);
  resolveImages(slides, dir);
  assert.deepEqual(resolveCharts(slides, dir), []);
  const { pages } = layoutDeck(slides, { ...deck, logo: null });
  const zip = await JSZip.loadAsync(await paintPptx(pages));
  const names = Object.keys(zip.files);
  return { names, read: n => zip.file(n).async('string') };
}

test('샘플 v2: 10장, 기본 차트, 둥근 사각형, 표, 노트, 이스케이프', async () => {
  const dir = makeSampleDeckV2();
  const { names, read } = await build(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'), dir);
  assert.equal(names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 10);
  const charts = names.filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.equal(charts.length, 1);
  const cx = await read(charts[0]);
  assert.match(cx, /베이스라인/);
  assert.match(cx, /선정 모델/);
  assert.match(cx, /0\.43/);
  assert.match(cx, /C9D2FA/);
  const s3 = await read('ppt/slides/slide3.xml');
  assert.match(s3, /prst="roundRect"/);
  assert.match(s3, /테스트 AP/);
  assert.match(s3, /5B45D6/);
  const s7 = await read('ppt/slides/slide7.xml');
  assert.match(s7, /<a:tbl>/);
  assert.match(s7, /p&lt;0\.05 &amp; 유의/);
  const s8 = await read('ppt/slides/slide8.xml');
  assert.match(s8, /진행 중/);
  const notes = await Promise.all(names.filter(n => /notesSlide\d+\.xml$/.test(n)).map(read));
  assert.ok(notes.some(x => x.includes('결과 요약')));
});

test('선 차트와 산점도도 기본 차트로', async () => {
  const dir = makeSampleDeckV2();
  fs.writeFileSync(path.join(dir, 'p.csv'), 'cv,test,sel\n0.40,0.35,0\n0.46,0.43,1\n0.42,0.30,0\n', 'utf8');
  const text = [
    '---', 'layout: chart', 'title: 선', 'chart:', '  type: line', '  categories: [a, b, c]', '  series:', '    - { name: s, values: [1, 2, 3] }', '---',
    '---', 'layout: chart', 'title: 점', 'chart:', '  type: scatter', '  data: p.csv', '  x: cv', '  y: test',
    '  highlight: { column: sel, value: 1, label: 선정 }', '---', '',
  ].join('\n');
  const { names, read } = await build(text, dir);
  const charts = names.filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.equal(charts.length, 2);
  const xmls = await Promise.all(charts.map(read));
  assert.ok(xmls.some(x => /<c:lineChart>/.test(x)));
  assert.ok(xmls.some(x => /<c:scatterChart>/.test(x)));
});

test('그림이 있는 슬라이드는 <p:pic>', async () => {
  const dir = makeSampleDeckV2();
  const { read } = await build(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'), dir);
  assert.match(await read('ppt/slides/slide6.xml'), /<p:pic>/);
});

test('문단당 글머리표 하나, 정렬 명시', async () => {
  const el = { kind: 'text', x: 10, y: 10, w: 500, h: 200, size: 20, weight: 400, color: '111111', lineHeight: 1.2, valign: 'top',
    paras: [{ bullet: true, runs: [{ text: 'a' }, { text: 'b', bold: true }, { text: 'c' }] }] };
  const zip = await JSZip.loadAsync(await paintPptx([{ elements: [el] }]));
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.equal((xml.match(/<a:buChar/g) ?? []).length, 1);
  assert.match(xml, /algn="l"/);
});

test('막대 차트 범주 라벨은 low', async () => {
  const dir = makeSampleDeckV2();
  const text = ['---', 'layout: chart', 'title: 막대', 'chart:', '  type: bar', '  categories: [a, b]', '  series:', '    - { name: s, values: [-0.03, 0.08] }', '---', ''].join('\n');
  const { names, read } = await build(text, dir);
  const c = names.find(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.match(await read(c), /<c:tickLblPos val="low"\/>/);
});

test('샘플의 모든 요소 종류에 화가가 있다', () => {
  const dir = makeSampleDeckV2();
  const { deck, slides } = parseDeck(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'));
  resolveImages(slides, dir);
  resolveCharts(slides, dir);
  const { pages } = layoutDeck(slides, { ...deck, logo: null });
  for (const p of pages) for (const e of p.elements) assert.ok(PAINTED_KINDS.includes(e.kind), e.kind);
});
