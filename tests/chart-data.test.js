import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, normalizeChart, resolveCharts } from '../renderer/chart-data.js';
import { tempDir } from './helpers.js';

test('parseCsv: BOM, CRLF, 따옴표 안 쉼표와 따옴표', () => {
  const r = parseCsv('\uFEFFmodel,"note, 비고",ap\r\nA,"x ""y""",0.37\r\nB,,0.43\r\n');
  assert.deepEqual(r.header, ['model', 'note, 비고', 'ap']);
  assert.deepEqual(r.rows, [['A', 'x "y"', '0.37'], ['B', '', '0.43']]);
});

test('직접 입력한 막대 차트', () => {
  const s = normalizeChart({ type: 'bar', title: 'T', categories: ['CN7', 'RG3'], series: [
    { name: '베이스라인', values: [0.37, 0.30] }, { name: '선정 모델', values: [0.43, 0.38] }] }, '.');
  assert.equal(s.type, 'bar');
  assert.deepEqual(s.categories, ['CN7', 'RG3']);
  assert.deepEqual(s.series.map(x => x.color), ['C9D2FA', '4F6BED']);
  assert.equal(s.valueLabels, true);
  assert.equal(s.decimals, 2);
  assert.equal(s.yMin, null);
});

test('CSV 열로 만든 차트와 계열 이름 변경', () => {
  const dir = tempDir('차트 데이터');
  fs.writeFileSync(path.join(dir, 'm.csv'), 'product,baseline_ap,selected_ap\nCN7,0.37,0.43\nRG3,0.30,0.38\n', 'utf8');
  const s = normalizeChart({ type: 'line', data: 'm.csv', x: 'product', y: ['baseline_ap', 'selected_ap'], names: ['베이스라인', '선정'] }, dir);
  assert.deepEqual(s.categories, ['CN7', 'RG3']);
  assert.deepEqual(s.series.map(x => [x.name, x.values]), [['베이스라인', [0.37, 0.30]], ['선정', [0.43, 0.38]]]);
  assert.equal(s.valueLabels, false);
});

test('산점도: CSV와 강조 점', () => {
  const dir = tempDir('산점도');
  fs.writeFileSync(path.join(dir, 'p.csv'), 'cv,test,selected\n0.40,0.35,false\n0.46,0.43,true\n', 'utf8');
  const s = normalizeChart({ type: 'scatter', data: 'p.csv', x: 'cv', y: 'test', highlight: { column: 'selected', value: true, label: '선정 모델' } }, dir);
  assert.deepEqual(s.points, [{ x: 0.40, y: 0.35, hi: false }, { x: 0.46, y: 0.43, hi: true }]);
  assert.equal(s.highlightLabel, '선정 모델');
});

test('제한과 오류 메시지', () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ name: `s${i}`, values: [1] }));
  assert.throws(() => normalizeChart({ type: 'bar', categories: ['a'], series: five }, '.'), /계열 4개/);
  const cats = Array.from({ length: 13 }, (_, i) => `c${i}`);
  assert.throws(() => normalizeChart({ type: 'bar', categories: cats, series: [{ name: 'a', values: cats.map(() => 1) }] }, '.'), /항목 12개/);
  assert.throws(() => normalizeChart({ type: 'pie', categories: ['a'], series: [{ name: 'a', values: [1] }] }, '.'), /bar, hbar, line, scatter/);
  assert.throws(() => normalizeChart({ type: 'bar', categories: ['a', 'b'], series: [{ name: 'a', values: [1] }] }, '.'), /값이 2개/);
  const dir = tempDir('오류');
  fs.writeFileSync(path.join(dir, 'x.csv'), 'k,v\na,1\nb,abc\n', 'utf8');
  assert.throws(() => normalizeChart({ type: 'bar', data: 'x.csv', x: 'k', y: 'v' }, dir), /'v' 열의 2번째 값이 숫자가 아니에요: abc/);
  assert.throws(() => normalizeChart({ type: 'bar', data: 'x.csv', x: 'k', y: 'nope' }, dir), /'nope' 열이 없어요/);
  assert.throws(() => normalizeChart({ type: 'bar', data: 'none.csv', x: 'k', y: 'v' }, dir), /CSV 파일을 찾을 수 없어요/);
});

test('음수 값은 그대로 허용', () => {
  const s = normalizeChart({ type: 'bar', categories: ['a', 'b'], series: [{ name: '변화량', values: [-0.03, 0.08] }] }, '.');
  assert.deepEqual(s.series[0].values, [-0.03, 0.08]);
});

test('resolveCharts: chart 슬라이드에 chartSpec, 오류는 슬라이드 번호와 함께', () => {
  const slides = [
    { index: 1, line: 1, layout: 'chart', chart: { type: 'bar', categories: ['a'], series: [{ name: 'x', values: [1] }] } },
    { index: 2, line: 9, layout: 'chart', chart: { type: 'pie' } },
    { index: 3, line: 20, layout: 'bullets' },
  ];
  const errors = resolveCharts(slides, '.');
  assert.equal(slides[0].chartSpec.type, 'bar');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].slide, 2);
  assert.equal(errors[0].line, 9);
});
