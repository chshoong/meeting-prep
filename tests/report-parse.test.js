import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseReport, COMPONENTS } from '../renderer/report-parse.js';
import { FIXTURES } from './helpers.js';

const sample = fs.readFileSync(path.join(FIXTURES, 'sample-report.md'), 'utf8');

test('샘플: 머리띠, 데이터셋, 탭·섹션·부품 구조', () => {
  const { report, errors } = parseReport(sample);
  assert.deepEqual(errors, []);
  assert.equal(report.meta.title, '불량 예측 모델 비교');
  assert.deepEqual(report.meta.pills, ['2022–2024 학습', '2025 평가', '조건별 3회 반복']);
  assert.deepEqual(Object.keys(report.datasets), ['runs']);
  assert.deepEqual(report.tabs.map(t => t.id), ['goal', 'method', 'results']);
  assert.deepEqual(report.tabs[2].sections.map(s => [s.title, s.cycle, s.archived]), [['방법별 Test AP', '2026-10-06', false], ['예전 결과', '2026-09-22', true]]);
  assert.deepEqual(report.tabs[2].sections[0].components.map(c => c.type), ['filter', 'chart', 'table', 'compare']);
  assert.match(report.tabs[0].sections[0].components[0].body, /\*\*같은 조건\*\*/);
  assert.equal(report.tabs[0].sections[0].components[1].body, '');
  const chart = report.tabs[2].sections[0].components[1];
  assert.equal(chart.type, 'chart');
  assert.equal(chart.chart, 'bar');
  assert.equal(COMPONENTS.length, 13);
});

test('오류: 구조 위반과 필드 누락, 블록·줄 번호', () => {
  const cases = [
    ['---\ntab: a\ntitle: A\n---\n', /report 블록/],
    ['---\nreport: { title: T }\n---\n---\nsection: s\n---\n', /tab 블록 뒤/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\ncomponent: text\n---\nx\n', /section 블록 뒤/],
    ['---\nreport: { title: T }\n---\n---\ntab: 결과\n---\n', /영문/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\ncycle: 10/06\n---\n', /YYYY-MM-DD/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\ncomponent: pie\n---\n', /가능한 값/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\ncomponent: compare\n---\n', /dataset/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\ncomponent: stats\nitems: []\n---\n', /items/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\ncomponent: text\n---\n', /본문/],
    ['---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\ntab: a\n---\n', /같은 tab id/],
    ['---\nreport: { title: T }\n---\n---\nfoo: 1\n---\n', /첫 키/],
    ['---\nreport: { title: T }\n---\n---\ntab: meeting\n---\n', /tab id 'meeting'은 강조판이 쓰는 이름이라 쓸 수 없어요/],
  ];
  for (const [text, re] of cases) {
    const { errors } = parseReport(text);
    assert.ok(errors.some(e => re.test(e.message)), `${re} not in ${JSON.stringify(errors)}`);
  }
  const { errors } = parseReport('---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\ncomponent: pie\n---\n');
  assert.equal(errors[0].block, 4);
  assert.equal(errors[0].line, 10);
});

test('탭이 없으면 오류', () => {
  assert.match(parseReport('---\nreport: { title: T }\n---\n').errors[0].message, /탭이 하나도/);
});

const doc = comp => `---\nreport: { title: T }\n---\n---\ntab: a\n---\n---\nsection: s\n---\n---\n${comp}\n---\n`;

test('from.agg와 table의 from.show는 정해진 값만', () => {
  const bad = [
    ['component: chart\nfrom: { dataset: runs, x: m, y: ap, agg: avg }', /from\.agg는 mean, median, min, max, sum, count, sd 중 하나/],
    ['component: table\nfrom: { dataset: runs, x: m, y: ap, agg: avg }', /from\.agg는/],
    ['component: table\nfrom: { dataset: runs, x: m, y: ap, show: sd }', /from\.show는 mean, median, min, max, sum, count, sd 중에서/],
    ['component: table\nfrom: { dataset: runs, x: m, y: ap, show: [] }', /from\.show는/],
    ['component: table\nfrom: { dataset: runs, x: m, y: ap, show: [mean, avg] }', /from\.show는/],
  ];
  for (const [comp, re] of bad) {
    const { errors } = parseReport(doc(comp));
    assert.ok(errors.some(e => re.test(e.message)), `${comp}: ${JSON.stringify(errors)}`);
  }
  for (const comp of ['component: chart\nfrom: { dataset: runs, x: m, y: ap, agg: median }', 'component: table\nfrom: { dataset: runs, x: m, y: ap, agg: count, show: [mean, sd, count] }']) {
    assert.deepEqual(parseReport(doc(comp)).errors, [], comp);
  }
});

