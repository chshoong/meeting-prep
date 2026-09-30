import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseReport } from '../renderer/report-parse.js';
import { loadDatasets } from '../renderer/report-data.js';
import { renderReportHtml, sectionKey } from '../renderer/report-html.js';
import { makeSampleReport } from './helpers.js';

function build(opts = {}, mutate) {
  const dir = makeSampleReport();
  if (mutate) mutate(dir);
  const { report } = parseReport(fs.readFileSync(path.join(dir, 'report.md'), 'utf8'));
  const { datasets } = loadDatasets(report.datasets, dir);
  return renderReportHtml(report, { datasets, baseDir: dir, ...opts });
}

test('페이지: 머리띠, 탭 3개, 패널, 섹션, 데이터 JSON, 실행기', () => {
  const r = build();
  assert.deepEqual(r.errors, []);
  assert.match(r.html, /<header class="masthead">/);
  assert.equal((r.html.match(/data-tab-btn="/g) ?? []).length, 3);
  assert.equal((r.html.match(/data-tab-panel="/g) ?? []).length, 3);
  assert.match(r.html, />01 목표</);
  assert.match(r.html, /<script type="application\/json" id="mp-data">/);
  assert.match(r.html, /mpReady/);
  assert.deepEqual(r.sections, [sectionKey('goal', '무엇을 비교하나?'), sectionKey('method', '파이프라인'), sectionKey('results', '방법별 Test AP'), sectionKey('results', '예전 결과')]);
});

test('외부 요청 없음: http(s), // 주소가 src/href/url/@import에 없다', () => {
  const { html } = build();
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /url\(\s*["']?(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /@import/i);
  assert.match(html, /data:font\/woff2;base64,/);
});

test('보관 섹션은 "이전 결과" 접는 칸으로', () => {
  const { html } = build();
  assert.match(html, /<details class="archive">\s*<summary>이전 결과/);
  assert.ok(html.indexOf('예전 결과') > html.indexOf('<details class="archive">'));
});

test('데이터 안의 </script>가 스크립트를 끊지 않는다', () => {
  const { html } = build({}, dir => {
    const f = path.join(dir, 'assets', 'results.csv');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('A,S1,1', 'A</script><b>,S1,1'), 'utf8');
  });
  const json = html.match(/<script type="application\/json" id="mp-data">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(json, /<\/script/i);
  assert.ok(JSON.parse(json).runs.levels.method.includes('A</script><b>'));
});

test('부품 오류는 블록·줄 번호와 함께 모이고 나머지는 그려진다', () => {
  const r = build({}, dir => {
    const f = path.join(dir, 'report.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('x: scenario, y: [ap], by: method', 'x: nope, y: [ap]'), 'utf8');
  });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /'nope'/);
  assert.ok(r.errors[0].block > 0);
});

test('강조판: 이번 미팅 탭, NEW/변경 표시, 탭 점', () => {
  const r = build({ highlight: { cycle: '2026-10-06', newKeys: new Set([sectionKey('results', '방법별 Test AP')]), meetingHtml: '<p>지난 피드백</p>' } });
  assert.equal((r.html.match(/data-tab-btn="/g) ?? []).length, 4);
  assert.match(r.html, /data-tab-btn="meeting"[^>]*>이번 미팅/);
  assert.match(r.html, /<span class="badge new">NEW<\/span>/);
  assert.match(r.html, /data-tab-btn="results"[^>]*><span class="dot"><\/span>/);
  assert.match(r.html, /data-jump="results#/);
  const changed = build({ highlight: { cycle: '2026-10-06', newKeys: new Set(), meetingHtml: '' } });
  assert.match(changed.html, /<span class="badge changed">변경<\/span>/);
});
