import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parseDeck } from '../renderer/parse.js';
import { resolveImages } from '../renderer/images.js';
import { renderPptx } from '../renderer/pptx.js';
import { makeSampleDeck, tempDir, PNG_1x1 } from './helpers.js';

async function build(deckText, dir) {
  const { slides, errors } = parseDeck(deckText);
  assert.deepEqual(errors, []);
  resolveImages(slides, dir);
  const zip = await JSZip.loadAsync(await renderPptx(slides));
  const read = name => zip.file(name).async('string');
  const names = Object.keys(zip.files);
  return { zip, read, names };
}

test('샘플 덱: 7장, 텍스트·표·그림·노트가 편집 가능한 형태로 들어감', async () => {
  const dir = makeSampleDeck();
  const { read, names } = await build(fs.readFileSync(path.join(dir, 'deck.md'), 'utf8'), dir);
  assert.equal(names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 7);

  assert.match(await read('ppt/slides/slide1.xml'), /모듈 B Ablation 결과/);

  const s3 = await read('ppt/slides/slide3.xml');
  assert.match(s3, /<a:rPr[^>]*b="1"[^>]*>(?:(?!<\/a:r>)[\s\S])*<a:t>Ours 72\.4<\/a:t>/);
  assert.match(s3, /Baseline 68\.1/);

  const s4 = await read('ppt/slides/slide4.xml');
  assert.match(s4, /<p:pic>/);

  assert.match(await read('ppt/slides/slide5.xml'), /p&lt;0\.05 &amp; 유의/);

  const s6 = await read('ppt/slides/slide6.xml');
  assert.match(s6, /<a:tbl>/);
  assert.match(s6, /72\.4/);

  const notes = await Promise.all(names.filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map(read));
  assert.ok(notes.some(x => x.includes('오늘은 모듈 B 위주로 말씀드림')));
});

test('없는 그림은 경고 상자로 대체', async () => {
  const dir = tempDir('빈 덱');
  const { read } = await build('---\nlayout: figure\ntitle: 그림\nimage: nope.png\n---\n', dir);
  const s1 = await read('ppt/slides/slide1.xml');
  assert.match(s1, /그림 없음: nope\.png/);
  assert.doesNotMatch(s1, /<p:pic>/);
});

test('한글·공백 경로의 그림도 들어감', async () => {
  const dir = tempDir('그림 덱');
  fs.mkdirSync(path.join(dir, '그림 폴더'));
  fs.writeFileSync(path.join(dir, '그림 폴더', '결과 1.png'), PNG_1x1);
  const { read } = await build('---\nlayout: figure\ntitle: 그림\nimage: 그림 폴더/결과 1.png\n---\n', dir);
  assert.match(await read('ppt/slides/slide1.xml'), /<p:pic>/);
});
