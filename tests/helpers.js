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

export const SAMPLE_RESULTS_CSV = [
  'method,scenario,rep,ap,fp',
  'A,S1,1,0.40,90', 'A,S1,2,0.42,88', 'A,S1,3,0.44,86',
  'A,S2,1,0.50,70', 'A,S2,2,0.48,72', 'A,S2,3,0.49,71',
  'B,S1,1,0.46,80', 'B,S1,2,0.47,79', 'B,S1,3,0.45,81',
  'B,S2,1,0.52,60', 'B,S2,2,0.53,61', 'B,S2,3,0.51,62',
].join('\n') + '\n';

export function makeSampleReport() {
  const dir = tempDir('샘플 보고서');
  fs.copyFileSync(path.join(FIXTURES, 'sample-report.md'), path.join(dir, 'report.md'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'results.csv'), SAMPLE_RESULTS_CSV, 'utf8');
  fs.writeFileSync(path.join(dir, 'assets', 'plot.png'), PNG_1x1);
  return dir;
}
