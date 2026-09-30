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

test('스크립트 없이도 보인다: 기본 패널 하나만 hidden이 없고, 그 탭이 선택됨, noscript 스타일', () => {
  const visible = html => [...html.matchAll(/<div class="panel" data-tab-panel="([^"]+)"( hidden)?>/g)].filter(m => !m[2]).map(m => m[1]);
  const { html } = build();
  assert.deepEqual(visible(html), ['goal']);
  assert.match(html, /data-tab-btn="goal" aria-selected="true"/);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.match(html, /<head>[\s\S]*<noscript><style>\[data-tab-panel\]\{display:block!important\}\.tabs\{display:none\}<\/style><\/noscript>[\s\S]*<\/head>/);
  const hl = build({ highlight: { cycle: '2026-10-06', newKeys: new Set(), touched: new Set(), meetingHtml: '' } });
  assert.deepEqual(visible(hl.html), ['meeting']);
  assert.match(hl.html, /data-tab-btn="meeting" aria-selected="true"/);
  assert.equal((hl.html.match(/aria-selected="true"/g) ?? []).length, 1);
});

test('페이지에 넣은 실행기 스크립트는 문법 오류가 없다', () => {
  const { html } = build();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const body = scripts.at(-1)[1];
  assert.match(body, /mpReady/);
  assert.doesNotThrow(() => new Function(body));
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

test('섹션 앵커는 제목 앞부분이 같아도 겹치지 않고, 이동 링크는 자기 섹션을 가리킨다', () => {
  const sec = title => ({ title, kicker: '', cycle: '2026-10-06', archived: false, line: 1, components: [] });
  const report = {
    meta: { kicker: '', title: '보고서', subtitle: '', pills: [] },
    datasets: {},
    tabs: [{ id: 'results-long-tab-id', title: '결과', line: 1, sections: [sec('실험 1 결과'), sec('실험 2 결과')] }],
  };
  const r = renderReportHtml(report, { datasets: {}, baseDir: '.', highlight: { cycle: '2026-10-06', newKeys: new Set(), meetingHtml: '' } });
  const ids = [...r.html.matchAll(/<section class="sec" id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  const jumps = [...r.html.matchAll(/data-jump="results-long-tab-id#([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(jumps, ids);
});
