import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import { render } from '../renderer/render.js';
import { findBrowser } from '../renderer/pdf.js';
import { pretendardInstalled } from '../renderer/fonts.js';
import { makeSampleDeckV2 } from './helpers.js';

const browser = findBrowser();

test('미리보기: 슬라이드마다 1280×720 PNG', { skip: browser ? false : '브라우저 없음', timeout: 180000 }, async () => {
  const dir = makeSampleDeckV2();
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pptx'], preview: true });
  assert.equal(r.ok, true);
  assert.equal(r.outputs.preview.length, 10);
  const size = imageSize(fs.readFileSync(r.outputs.preview[0]));
  assert.equal(size.width, 1280);
  assert.equal(size.height, 720);
  assert.match(path.basename(r.outputs.preview[9]), /^slide-10\.png$/);
});

test('미리보기: 브라우저가 없으면 경고만', async () => {
  const dir = makeSampleDeckV2();
  const r = await render(path.join(dir, 'deck.md'), { formats: ['pptx'], preview: true, browser: null });
  assert.equal(r.ok, true);
  assert.equal(r.outputs.preview, undefined);
  assert.ok(r.warnings.some(w => /미리보기/.test(w.message)));
});

test('pretendardInstalled: 윈도우 글꼴 폴더 확인', () => {
  const env = { WINDIR: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' };
  assert.equal(pretendardInstalled({ env, platform: 'win32', readdir: d => (d.includes('Local') ? ['Pretendard-Regular.otf'] : []) }), true);
  assert.equal(pretendardInstalled({ env, platform: 'win32', readdir: () => ['arial.ttf'] }), false);
  assert.equal(pretendardInstalled({ env, platform: 'linux' }), null);
});
