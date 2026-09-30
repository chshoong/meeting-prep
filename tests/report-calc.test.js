import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calc, makeCalc } from '../renderer/report-calc.js';

const rows = [
  { method: 'A', scenario: '1', ap: 0.40, fp: 90 },
  { method: 'A', scenario: '1', ap: 0.44, fp: 86 },
  { method: 'A', scenario: '2', ap: 0.50, fp: 70 },
  { method: 'B', scenario: '1', ap: 0.46, fp: 80 },
  { method: 'B', scenario: '2', ap: 0.52, fp: 60 },
];
const meta = { ap: { label: 'Test AP', decimals: 3, better: 'up' }, fp: { label: '오탐 수', decimals: 0, better: 'down' }, method: { label: '방법' }, scenario: { label: '시나리오' } };

test('summarize: 평균·중앙값·표본 표준편차·빈 값', () => {
  const s = calc.summarize([1, 2, 3, 4, 'x', null]);
  assert.equal(s.n, 4);
  assert.equal(s.mean, 2.5);
  assert.equal(s.median, 2.5);
  assert.ok(Math.abs(s.sd - 1.2909944) < 1e-6);
  assert.deepEqual(calc.summarize([5]), { n: 1, mean: 5, median: 5, sd: 0, min: 5, max: 5, sum: 5, count: 1 });
  assert.deepEqual(calc.summarize([]), { n: 0, mean: null, median: null, sd: null, min: null, max: null, sum: 0, count: 0 });
  assert.equal(calc.agg([1, 5, 3], 'max'), 5);
  assert.equal(calc.agg([1, 5, 3], 'count'), 3);
});

test('where: 문자열 비교, 전체(*), 배열', () => {
  assert.equal(calc.where(rows, { scenario: 1 }).length, 3);
  assert.equal(calc.where(rows, { scenario: '*' }).length, 5);
  assert.equal(calc.where(rows, { method: ['A', 'B'], scenario: '2' }).length, 2);
  assert.equal(calc.where(rows, null).length, 5);
});

test('seriesFrom: x별·by별 평균, 계열 이름', () => {
  const r = calc.seriesFrom(rows, { x: 'scenario', y: ['ap'], by: 'method' }, meta);
  assert.deepEqual(r.categories, ['1', '2']);
  assert.deepEqual(r.series.map(s => s.name), ['A', 'B']);
  assert.ok(Math.abs(r.series[0].values[0] - 0.42) < 1e-9);
  assert.deepEqual(r.series[1].values, [0.46, 0.52]);
  const two = calc.seriesFrom(rows, { x: 'method', y: ['ap', 'fp'], agg: 'max' }, meta);
  assert.deepEqual(two.series.map(s => s.name), ['Test AP', '오탐 수']);
  assert.deepEqual(two.series[1].values, [90, 80]);
});

test('seriesFrom: 없는 조건 조합은 0이 아니라 null', () => {
  const unbalanced = rows.filter(r => !(r.method === 'B' && r.scenario === '2'));
  const r = calc.seriesFrom(unbalanced, { x: 'scenario', y: ['ap'], by: 'method' }, meta);
  assert.deepEqual(r.categories, ['1', '2']);
  assert.equal(r.series[1].name, 'B');
  assert.deepEqual(r.series[1].values, [0.46, null]);
  assert.equal(r.series[0].values[1], 0.5);
});

test('tableFrom: 조합별 행, 자릿수, 평균과 표준편차', () => {
  const t = calc.tableFrom(rows, { x: 'method', y: ['ap'], show: ['mean', 'sd'] }, meta);
  assert.deepEqual(t.columns, ['방법', 'Test AP (mean)', 'Test AP (sd)']);
  assert.equal(t.rows[0][0], 'A');
  assert.equal(t.rows[0][1], '0.447');
  assert.ok(Math.abs(t.raw[1][1] - 0.49) < 1e-9);
});

test('compareSides: 차이와 better 방향', () => {
  const r = calc.compareSides(rows, { method: 'A', scenario: '1' }, { method: 'B', scenario: '1' }, ['ap', 'fp'], meta);
  assert.equal(r[0].a.n, 2);
  assert.ok(Math.abs(r[0].diff - -0.04) < 1e-9);
  assert.equal(r[0].winner, 'b');
  assert.equal(r[1].diff, 8);
  assert.equal(r[1].winner, 'b');
  const empty = calc.compareSides(rows, { method: 'Z' }, { method: 'A' }, ['ap'], meta);
  assert.equal(empty[0].a.mean, null);
  assert.equal(empty[0].diff, null);
  assert.equal(empty[0].winner, null);
});

test('pointsFrom: 행마다 점, 강조 조건', () => {
  const p = calc.pointsFrom(rows, { x: 'ap', y: 'fp', highlight: { method: 'B' } });
  assert.equal(p.length, 5);
  assert.deepEqual(p.filter(q => q.hi).length, 2);
});

test('specFromData: 계열 색은 주입한 함수로', () => {
  const base = { type: 'bar', title: 'T', xLabel: '', yLabel: '', yMin: null, valueLabels: true, decimals: 3 };
  const spec = calc.specFromData(base, { x: 'scenario', y: ['ap'], by: 'method' }, rows, meta, names => names.map(() => 'ABCDEF'));
  assert.equal(spec.type, 'bar');
  assert.deepEqual(spec.series.map(s => s.color), ['ABCDEF', 'ABCDEF']);
  assert.deepEqual(spec.points, []);
});

test('makeCalc는 외부 이름을 참조하지 않는다 (toString으로 다시 만들 수 있다)', () => {
  const again = new Function(`return (${makeCalc.toString()})();`)();
  assert.deepEqual(again.summarize([1, 3]).mean, 2);
});
