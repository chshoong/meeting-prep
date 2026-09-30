import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// 1x1 PNG
export const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// 한글과 공백이 들어간 임시 폴더를 만든다 (윈도우 한글 경로 검증용)
export function tempDir(label = '테스트') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label} `));
}

export function makeSampleDeck() {
  const dir = tempDir('샘플 덱');
  fs.copyFileSync(path.join(FIXTURES, 'sample-deck.md'), path.join(dir, 'deck.md'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'plot.png'), PNG_1x1);
  return dir;
}

export function makeSampleDeckV2() {
  const dir = tempDir('샘플 덱 v2');
  fs.copyFileSync(path.join(FIXTURES, 'sample-deck-v2.md'), path.join(dir, 'deck.md'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'plot.png'), PNG_1x1);
  fs.writeFileSync(path.join(dir, 'assets', 'metrics.csv'), 'product,baseline_ap,selected_ap\nCN7,0.37,0.43\nRG3,0.30,0.38\n', 'utf8');
  return dir;
}
