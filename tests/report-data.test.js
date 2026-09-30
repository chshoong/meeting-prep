import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadDatasets } from '../renderer/report-data.js';
import { tempDir, SAMPLE_RESULTS_CSV } from './helpers.js';

function dirWith(csv) {
  const dir = tempDir('데이터');
  fs.writeFileSync(path.join(dir, 'r.csv'), csv, 'utf8');
  return dir;
}

const raw = { runs: { file: 'r.csv', dims: ['method', 'scenario'], metrics: { ap: { label: 'Test AP', decimals: 3 }, fp: { label: '오탐', better: 'down', decimals: 0 } } } };

test('정돈된 행: dims는 문자열, metrics는 숫자, 쓰지 않는 열 제거', () => {
  const { datasets, errors } = loadDatasets(raw, dirWith(SAMPLE_RESULTS_CSV));
  assert.deepEqual(errors, []);
  const d = datasets.runs;
  assert.equal(d.rows.length, 12);
  assert.deepEqual(d.rows[0], { method: 'A', scenario: 'S1', ap: 0.4, fp: 90 });
  assert.deepEqual(d.levels, { method: ['A', 'B'], scenario: ['S1', 'S2'] });
  assert.deepEqual(d.meta.fp, { label: '오탐', decimals: 0, better: 'down', unit: '' });
  assert.deepEqual(d.meta.ap.better, 'up');
  assert.deepEqual(d.meta.method, { label: 'method' });
});

test('숫자처럼 보이는 조건 값도 문자열', () => {
  const { datasets } = loadDatasets({ r: { file: 'r.csv', dims: ['s'], metrics: { v: {} } } }, dirWith('s,v\n1,0.5\n2,0.6\n'));
  assert.deepEqual(datasets.r.levels.s, ['1', '2']);
  assert.equal(typeof datasets.r.rows[0].s, 'string');
});

test('오류: 파일 없음, 열 없음, 숫자 아님 — 데이터셋 이름과 함께', () => {
  const dir = dirWith('method,ap\nA,x\n');
  const r1 = loadDatasets({ a: { file: 'none.csv', dims: [], metrics: {} } }, dir);
  assert.match(r1.errors[0].message, /데이터셋 'a'.*찾을 수 없어요/);
  const r2 = loadDatasets({ b: { file: 'r.csv', dims: ['scenario'], metrics: {} } }, dir);
  assert.match(r2.errors[0].message, /'scenario' 열이 없어요/);
  const r3 = loadDatasets({ c: { file: 'r.csv', dims: ['method'], metrics: { ap: {} } } }, dir);
  assert.match(r3.errors[0].message, /'ap' 열의 1번째 값이 숫자가 아니에요: x/);
  const r4 = loadDatasets({ d: {} }, dir);
  assert.match(r4.errors[0].message, /file/);
});
