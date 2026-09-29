import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck } from '../renderer/parse.js';
import { resolveImages } from '../renderer/images.js';
import { renderHtml, esc, relUrl } from '../renderer/html.js';
import { fontFaceCss } from '../renderer/fonts.js';
import { makeSampleDeck, tempDir, PNG_1x1 } from './helpers.js';

function build(dir, text = fs.readFileSync(path.join(dir, 'deck.md'), 'utf8')) {
  const { slides } = parseDeck(text);
  resolveImages(slides, dir);
  return renderHtml(slides, { outDir: dir });
}

test('샘플 덱: 7장, 이스케이프, 그림, 노트', () => {
  const html = build(makeSampleDeck());
  assert.equal((html.match(/<section class="slide"/g) ?? []).length, 7);
  assert.match(html, /<title>모듈 B Ablation 결과<\/title>/);
  assert.match(html, /p&lt;0\.05 &amp; 유의/);
  assert.match(html, /<b>Ours 72\.4<\/b>/);
  assert.match(html, /src="assets\/plot\.png"/);
  assert.match(html, /<aside class="notes">오늘은 모듈 B 위주로 말씀드림<\/aside>/);
  assert.match(html, /<table/);
  assert.match(html, /@page\s*\{\s*size:\s*13\.333in 7\.5in/);
});

test('폰트: Pretendard가 base64로 포함', () => {
  const css = fontFaceCss();
  assert.match(css, /font-family:'Pretendard';font-weight:400/);
  assert.match(css, /font-weight:700/);
  assert.match(build(makeSampleDeck()), /data:font\/woff2;base64,/);
});

test('한글·공백 그림 경로는 URL 인코딩', () => {
  const dir = tempDir('그림 덱');
  fs.mkdirSync(path.join(dir, '그림 폴더'));
  fs.writeFileSync(path.join(dir, '그림 폴더', '결과 1.png'), PNG_1x1);
  const html = build(dir, '---\nlayout: figure\ntitle: 그림\nimage: 그림 폴더/결과 1.png\n---\n');
  const expected = `${encodeURIComponent('그림 폴더')}/${encodeURIComponent('결과 1.png')}`;
  assert.ok(html.includes(`src="${expected}"`));
});

test('없는 그림은 경고 상자', () => {
  const html = build(tempDir('빈 덱'), '---\nlayout: figure\ntitle: 그림\nimage: nope.png\n---\n');
  assert.match(html, /class="abs missing"[^>]*>⚠ 그림 없음: nope\.png/);
});

test('esc와 relUrl', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(relUrl(path.resolve('/a/b'), path.resolve('/a/b/c d/e.png')), 'c%20d/e.png');
});
