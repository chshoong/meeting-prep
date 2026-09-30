import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartSvg, chartScale } from '../renderer/chart-svg.js';
import { normalizeChart } from '../renderer/chart-data.js';
import { textWidth, SIZE } from '../renderer/style.js';

const bar = normalizeChart({ type: 'bar', categories: ['CN7', 'RG3'], series: [
  { name: '베이스라인', values: [0.37, 0.30] }, { name: '선정 <모델>', values: [0.43, 0.38] }] }, '.');

test('막대 수 = 계열 × 항목, 값 표시, 이스케이프', () => {
  const svg = chartSvg(bar, 700, 260);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 700 260"/);
  assert.equal((svg.match(/class="bar"/g) ?? []).length, 4);
  assert.match(svg, />0\.43</);
  assert.match(svg, /fill="#C9D2FA"/);
  assert.doesNotMatch(svg, /<모델>/);
});

test('가로 막대', () => {
  const s = normalizeChart({ type: 'hbar', categories: ['a', 'b', 'c'], series: [{ name: 'x', values: [1, 2, 3] }] }, '.');
  assert.equal((chartSvg(s, 600, 300).match(/class="bar"/g) ?? []).length, 3);
});

test('음수 막대는 0선 아래로', () => {
  const s = normalizeChart({ type: 'bar', categories: ['a', 'b'], series: [{ name: '변화량', values: [-0.03, 0.08] }] }, '.');
  const sc = chartScale(s);
  assert.ok(sc.min < 0);
  const svg = chartSvg(s, 400, 200);
  assert.equal((svg.match(/class="bar"/g) ?? []).length, 2);
  assert.match(svg, /class="zero"/);
  const zeroY = Number(svg.match(/<line class="zero"[^>]*y1="([^"]+)"/)[1]);
  const bars = [...svg.matchAll(/<rect class="bar"[^>]*y="([^"]+)"[^>]*height="([^"]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.ok(Math.abs(bars[0][0] - zeroY) < 0.02);
  assert.ok(Math.abs(bars[1][0] + bars[1][1] - zeroY) < 0.02);
});

test('선 차트: 점 수 = 계열 × 항목', () => {
  const s = normalizeChart({ type: 'line', categories: ['1', '2', '3'], series: [{ name: 'a', values: [1, 2, 3] }, { name: 'b', values: [2, 1, 0] }] }, '.');
  const svg = chartSvg(s, 500, 250);
  assert.equal((svg.match(/class="pt"/g) ?? []).length, 6);
  assert.match(svg, /<polyline/);
});

test('산점도: 강조 점은 accent 색과 이름표', () => {
  const s = normalizeChart({ type: 'scatter', points: [{ x: 0.4, y: 0.35 }, { x: 0.46, y: 0.43, highlight: true }], highlight: { label: '선정 모델' } }, '.');
  s.highlightLabel = '선정 모델';
  const svg = chartSvg(s, 500, 250);
  assert.equal((svg.match(/class="pt"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="pt hi"/g) ?? []).length, 1);
  assert.match(svg, /fill="#5B45D6"/);
  assert.match(svg, /선정 모델/);
});

test('yMin을 지정하면 축 시작이 그 값', () => {
  const s = normalizeChart({ type: 'bar', yMin: 0.2, categories: ['a'], series: [{ name: 'x', values: [0.5] }] }, '.');
  assert.equal(chartScale(s).min, 0.2);
});

test('yMin이 최댓값 이상이면 무시', () => {
  const s = normalizeChart({ type: 'bar', yMin: 0.5, categories: ['a'], series: [{ name: 'x', values: [0.3] }] }, '.');
  const sc = chartScale(s);
  assert.ok(sc.min < sc.max);
  assert.doesNotMatch(chartSvg(s, 400, 200), /NaN|Infinity/);
});

test('hbar 값 라벨이 오른쪽 끝에서 잘리지 않음', () => {
  const s = normalizeChart({ type: 'hbar', categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2] }] }, '.');
  const w = 600;
  const svg = chartSvg(s, w, 300);
  const m = [...svg.matchAll(/<text x="([^"]+)"[^>]*text-anchor="start"[^>]*>([^<]+)</g)];
  assert.ok(m.length > 0);
  for (const [, x, t] of m) assert.ok(Number(x) + textWidth(t, SIZE.valueLabel, 700) <= w);
});

test('좌표는 소수 둘째 자리까지', () => {
  const noisy = /\d\.\d{3,}/;
  assert.ok(noisy.test('1.2345'));
  const hb = normalizeChart({ type: 'hbar', categories: ['a', 'b', 'c'], series: [{ name: 'x', values: [0.1, 0.27, 0.33] }] }, '.');
  const ln = normalizeChart({ type: 'line', yLabel: 'y', xLabel: 'x', categories: ['1', '2', '3'], series: [{ name: 'a', values: [0.11, 0.27, 0.333] }] }, '.');
  const sc = normalizeChart({ type: 'scatter', points: [{ x: 0.41, y: 0.35 }, { x: 0.463, y: 0.437, highlight: true }] }, '.');
  for (const s of [bar, hb, ln, sc]) assert.ok(!noisy.test(chartSvg(s, 700, 263).replace(/>[^<]*</g, '><')), s.type); // text labels may legitimately show 3 decimals
});

test('가로 막대: 긴 항목 이름이 왼쪽에서 잘리지 않음', () => {
  const s = normalizeChart({ type: 'hbar', categories: ['CN7 도어트림', 'SP2 크래시패드'], series: [{ name: 'x', values: [1, 2] }] }, '.');
  const svg = chartSvg(s, 700, 260);
  const labels = [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="end"[^>]*font-weight="700"[^>]*>([^<]+)</g)];
  assert.ok(labels.length >= 2);
  for (const [, x, t] of labels) assert.ok(Number(x) - textWidth(t, 14, 700) >= 0, `${t} 잘림`);
});

test('빈 값(null)은 막대·값 표시를 그리지 않고, 선은 끊기며, NaN이 없다', () => {
  const spec = (type, values) => ({ type, title: '', xLabel: '', yLabel: '', yMin: null, valueLabels: true, decimals: 2, categories: ['a', 'b', 'c'],
    series: [{ name: 'x', values, color: '5B45D6' }], points: [], pointName: '', highlightLabel: '' });
  for (const type of ['bar', 'hbar']) {
    const full = chartSvg(spec(type, [0.1, 0.2, 0.3]), 600, 300);
    const gap = chartSvg(spec(type, [0.1, null, 0.3]), 600, 300);
    assert.equal((gap.match(/class="bar"/g) ?? []).length, (full.match(/class="bar"/g) ?? []).length - 1, type);
    assert.doesNotMatch(gap, /NaN|Infinity/, type);
    assert.doesNotMatch(gap, />0\.00</, type);
  }
  const line = chartSvg(spec('line', [0.1, null, 0.3]), 600, 300);
  assert.doesNotMatch(line, /NaN|Infinity/);
  assert.equal((line.match(/class="pt"/g) ?? []).length, 2);
  for (const type of ['bar', 'hbar', 'line']) {
    const none = spec(type, [null, null, null]);
    assert.doesNotThrow(() => chartScale(none));
    assert.doesNotMatch(chartSvg(none, 600, 300), /NaN|Infinity/, type);
  }
});
