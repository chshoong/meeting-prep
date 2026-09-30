import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderComponent, markdownHtml, externalUrl } from '../renderer/report-components.js';
import { loadDatasets } from '../renderer/report-data.js';
import { makeSampleReport } from './helpers.js';

function ctx() {
  const dir = makeSampleReport();
  const { datasets } = loadDatasets({ runs: { file: 'assets/results.csv', dims: ['method', 'scenario'], metrics: { ap: { label: 'Test AP', decimals: 3 }, fp: { label: '오탐 수', decimals: 0, better: 'down' } } } }, dir);
  let n = 0;
  return { datasets, baseDir: dir, nextId: () => `mp${++n}` };
}
const R = (c, x = ctx()) => renderComponent({ body: '', block: 1, line: 1, ...c }, x);

test('markdownHtml: 문단, 목록, 강조, 이스케이프', () => {
  const h = markdownHtml('a **b** ==c== <x>\n\n- 하나\n  - 둘');
  assert.match(h, /<p>a <b class="acc">b<\/b> <b class="pink">c<\/b> &lt;x&gt;<\/p>/);
  assert.equal((h.match(/<li/g) ?? []).length, 2);
});

test('정적 부품: text, stats, cards, steps, details, callout, checklist', () => {
  assert.match(R({ type: 'text', body: '안녕' }).html, /c-text/);
  const st = R({ type: 'stats', items: [{ label: 'AP', value: '0.43', delta: '+0.06' }, { label: 'FP', value: '84', delta: '-18%', good: 'down' }] }).html;
  assert.equal((st.match(/<article/g) ?? []).length, 2);
  assert.match(st, /class="delta up"[^>]*>▲ 0\.06/);
  assert.match(st, /class="delta up"[^>]*>▼ 18%/);
  assert.match(R({ type: 'cards', columns: 3, items: [{ title: 'A', text: 't' }] }).html, /grid g3/);
  assert.equal((R({ type: 'steps', items: [{ title: 'a' }, { title: 'b' }] }).html.match(/class="step"/g) ?? []).length, 2);
  assert.match(R({ type: 'details', title: '출처', body: 'x' }).html, /<details class="card"><summary>출처<\/summary>/);
  assert.match(R({ type: 'callout', tone: 'warn', body: 'x' }).html, /callout warn/);
  assert.match(R({ type: 'checklist', items: [{ status: 'doing', text: '#1 a' }] }).html, />진행 중</);
});

test('figure: 그림은 data URI로, 없으면 경고', () => {
  const x = ctx();
  assert.match(R({ type: 'figure', image: 'assets/plot.png', caption: 'c' }, x).html, /src="data:image\/png;base64,/);
  const miss = R({ type: 'figure', image: 'assets/none.png' }, x);
  assert.match(miss.html, /그림 없음/);
  assert.equal(miss.warnings.length, 1);
});

test('chart(from): 첫 화면 SVG와 data-mp 설정, 직접 입력 차트도', () => {
  const h = R({ type: 'chart', title: 'T', from: { dataset: 'runs', x: 'scenario', y: ['ap'], by: 'method' } }).html;
  assert.match(h, /data-mp="\{&quot;kind&quot;:&quot;chart&quot;/);
  assert.equal((h.match(/class="bar"/g) ?? []).length, 4);
  assert.match(h, /class="legend"/);
  assert.equal((R({ type: 'chart', chart: 'hbar', from: { dataset: 'runs', x: 'scenario', y: ['ap'] } }).html.match(/class="bar"/g) ?? []).length, 2);
  assert.throws(() => R({ type: 'chart', chart: 'pie', categories: ['a'], series: [{ name: 's', values: [1] }] }), /차트 type/);
  const direct = R({ type: 'chart', categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] }).html;
  assert.equal((direct.match(/class="bar"/g) ?? []).length, 2);
  assert.doesNotMatch(direct, /data-mp/);
  assert.throws(() => R({ type: 'chart', from: { dataset: 'none', x: 'a', y: 'b' } }), /데이터셋 'none'/);
  assert.throws(() => R({ type: 'chart', from: { dataset: 'runs', x: 'nope', y: 'ap' } }), /'nope'/);
});

test('table: 정렬·검색 가능한 표, from과 직접 입력, 강조 행', () => {
  const h = R({ type: 'table', from: { dataset: 'runs', x: 'method', y: ['ap'] } }).html;
  assert.match(h, /class="tbl-search"/);
  assert.match(h, /<th data-col="0"/);
  assert.match(h, /0\.490/);
  const d = R({ type: 'table', columns: ['a', 'b'], rows: [['1', '<2>'], ['3', '4']], highlight: [1] }).html;
  assert.match(d, /&lt;2&gt;/);
  assert.match(d, /<tr class="hl">/);
});

test('compare: 조건 선택칸, 기본 선택, 첫 결과, 버튼', () => {
  const h = R({ type: 'compare', dataset: 'runs', metrics: ['ap', 'fp'], a: { method: 'A', scenario: 'S1' }, b: { method: 'B', scenario: 'S1' }, presets: [{ label: 'S2', a: { scenario: 'S2' }, b: { scenario: 'S2' } }] }).html;
  assert.equal((h.match(/<select/g) ?? []).length, 4);
  assert.match(h, /<option value="B" selected>B<\/option>/);
  assert.match(h, /data-act="swap"/);
  assert.match(h, /data-act="copy"/);
  assert.match(h, /data-preset="0"/);
  assert.match(h, /0\.420 ± 0\.020/);
  assert.throws(() => R({ type: 'compare', dataset: 'runs', metrics: ['zzz'] }), /'zzz'/);
});

test('filter: 전체 선택지와 조건 값', () => {
  const h = R({ type: 'filter', dataset: 'runs', dims: ['scenario'] }).html;
  assert.match(h, /<option value="\*" selected>전체<\/option>/);
  assert.match(h, /<option value="S2">S2<\/option>/);
  assert.match(h, /name="scenario"/);
});

test('custom: 스크립트 분리, 외부 주소 거부', () => {
  const h = R({ type: 'custom', body: '<div>x</div><script>el.textContent = 1;</script>' }).html;
  assert.match(h, /<div class="custom" id="mp\d+"><div>x<\/div><\/div>/);
  assert.match(h, /<script type="text\/mp-custom" data-for="mp\d+">el\.textContent = 1;<\/script>/);
  for (const bad of ['<img src="https://x/a.png">', '<a href="//cdn/x">', '<div style="background:url(http://x)">', '<style>@import "https://f";</style>']) {
    assert.throws(() => R({ type: 'custom', body: bad }), /외부 주소/, bad);
  }
  assert.equal(externalUrl('<img src="data:image/png;base64,AAA">'), null);
});
