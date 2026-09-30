import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartBundleSource } from '../renderer/bundle.js';
import { chartSvg } from '../renderer/chart-svg.js';
import { normalizeChart, decodeText } from '../renderer/chart-data.js';
import { splitBlocks } from '../renderer/parse.js';
import { makeViews, views } from '../renderer/report-views.js';

test('차트 번들은 import한 모듈과 같은 SVG를 만든다', () => {
  const lib = new Function(`return ${chartBundleSource()};`)();
  const spec = normalizeChart({ type: 'bar', categories: ['a', 'b'], series: [{ name: '베이스라인', values: [1, 2] }, { name: 'x', values: [2, 1] }] }, '.');
  assert.equal(lib.chartSvg(spec, 700, 260), chartSvg(spec, 700, 260));
  assert.deepEqual(lib.seriesColors(['베이스라인', 'x']), ['C9D2FA', '4F6BED']);
  assert.equal(typeof lib.chartScale, 'function');
});

test('번들 소스에 import/export가 남지 않는다', () => {
  const src = chartBundleSource();
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /^\s*export\s/m);
});

test('decodeText와 splitBlocks가 export된다', () => {
  assert.equal(decodeText(Buffer.from('가', 'utf8')), '가');
  const { blocks } = splitBlocks('---\na: 1\n---\nbody\n');
  assert.equal(blocks[0].body, 'body');
});

test('views: 비교 표, 표 본문, 범례, 이스케이프', () => {
  const html = views.compareTable([{ metric: 'ap', label: 'Test <AP>', decimals: 3, a: { mean: 0.42, sd: 0.02, n: 2 }, b: { mean: 0.46, sd: 0, n: 1 }, diff: -0.04, winner: 'b' }]);
  assert.match(html, /Test &lt;AP&gt;/);
  assert.match(html, /0\.420 ± 0\.020/);
  assert.match(html, /class="win"[^>]*>0\.460/);
  assert.match(html, /−0\.040/);
  const body = views.tableBody([['A', '1'], ['B', '2']], [2]);
  assert.equal((body.match(/<tr/g) ?? []).length, 2);
  assert.match(body, /<tr class="hl">/);
  assert.match(views.legend({ type: 'bar', series: [{ name: 'a', color: '111111' }, { name: 'b', color: '222222' }] }), /#222222/);
  assert.equal(views.legend({ type: 'bar', series: [{ name: 'a', color: '111111' }] }), '');
  const again = new Function(`return (${makeViews.toString()})();`)();
  assert.equal(again.esc('<'), '&lt;');
});
