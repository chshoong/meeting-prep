import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parseDeck } from '../renderer/parse.js';
import { resolveCharts } from '../renderer/chart-data.js';
import { resolveImages } from '../renderer/images.js';
import { layoutDeck } from '../renderer/layout.js';
import { paintPptx } from '../renderer/paint-pptx.js';
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
