import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { imageSize } from 'image-size';
import { renderReport, todoStatus } from '../renderer/report.js';
import { findBrowser } from '../renderer/pdf.js';
import { makeSampleReport, tempDir } from './helpers.js';

const CLI = fileURLToPath(new URL('../renderer/report.js', import.meta.url));
const browser = findBrowser();

test('todoStatus: 로그의 → 완료 / → 진행 중으로 상태', () => {
  const fb = '# 피드백\n\n## 할 일\n- [ ] #1 베이스라인\n- [ ] #2 오류 분석\n- [ ] #3 보고서\n';
  const log = '## 기록\n- 피드백 반영: #1 (베이스라인) → 완료\n- 피드백 반영: #2 (오류 분석) → 진행 중\n';
  assert.deepEqual(todoStatus(fb, log).map(t => [t.status, t.text]), [['done', '#1 베이스라인'], ['doing', '#2 오류 분석'], ['todo', '#3 보고서']]);
});

test('누적판: report.html, 크기, 경고 없음', async () => {
  const dir = makeSampleReport();
  const r = await renderReport(path.join(dir, 'report.md'), { browser: null });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.outputs.html, path.join(dir, 'report.html'));
  assert.ok(fs.existsSync(r.outputs.html));
  assert.ok(r.size > 10000);
});

test('오류: 파서·데이터·부품 오류는 ok:false', async () => {
  const dir = makeSampleReport();
  const md = path.join(dir, 'report.md');
  fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace('file: assets/results.csv', 'file: assets/none.csv'), 'utf8');
  const r = await renderReport(md, { browser: null });
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /데이터셋 'runs'/);
});

test('크기 경고', async () => {
  const dir = makeSampleReport();
  const r = await renderReport(path.join(dir, 'report.md'), { browser: null, sizeLimit: 1000 });
  assert.ok(r.warnings.some(w => /MB/.test(w)));
});

test('강조판: 처음엔 모두 NEW, 다음 사이클엔 전에 있던 섹션은 변경, 같은 사이클 재렌더는 자기 기록과 비교하지 않음', async () => {
  const dir = makeSampleReport();
  const md = path.join(dir, 'report.md');
  const fb = path.join(dir, 'fb.md');
  fs.writeFileSync(fb, '# 피드백\n\n## 할 일\n- [ ] #1 비교 표\n', 'utf8');
  const log = path.join(dir, 'log.md');
  fs.writeFileSync(log, '- 피드백 반영: #1 (비교 표) → 완료\n', 'utf8');
  const first = await renderReport(md, { highlight: '2026-10-06', feedback: fb, log, browser: null });
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.equal(path.basename(first.outputs.html), 'report-2026-10-06.html');
  const h1 = fs.readFileSync(first.outputs.html, 'utf8');
  assert.match(h1, /data-tab-btn="meeting"/);
  assert.match(h1, /badge new/);
  assert.match(h1, />완료</);
  const again = await renderReport(md, { highlight: '2026-10-06', browser: null });
  assert.match(fs.readFileSync(again.outputs.html, 'utf8'), /badge new/);
  fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace('cycle: 2026-10-06', 'cycle: 2026-10-20'), 'utf8');
  const next = await renderReport(md, { highlight: '2026-10-20', browser: null });
  const h2 = fs.readFileSync(next.outputs.html, 'utf8');
  assert.match(h2, /badge changed/);
  assert.doesNotMatch(h2, /badge new/);
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.report-state.json'), 'utf8'));
  assert.deepEqual(Object.keys(state.highlights).sort(), ['2026-10-06', '2026-10-20']);
});

test('강조판: 바뀐 섹션이 없으면 경고', async () => {
  const dir = makeSampleReport();
  const md = path.join(dir, 'report.md');
  const first = await renderReport(md, { highlight: '2026-10-06', browser: null });
  assert.ok(!first.warnings.some(w => /바뀐 섹션이 없어요/.test(w)));
  const r = await renderReport(md, { highlight: '2026-10-10', browser: null });
  assert.ok(r.warnings.some(w => /바뀐 섹션이 없어요/.test(w)));
});

test('--feedback·--log 파일이 없으면 경로와 함께 경고', async () => {
  const dir = makeSampleReport();
  const fb = path.join(dir, '없는 피드백.md');
  const log = path.join(dir, '없는 로그.md');
  const r = await renderReport(path.join(dir, 'report.md'), { highlight: '2026-10-06', feedback: fb, log, browser: null });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.warnings.some(w => w.includes('피드백 파일을 찾을 수 없') && w.includes(fb)), JSON.stringify(r.warnings));
  assert.ok(r.warnings.some(w => w.includes('로그 파일을 찾을 수 없') && w.includes(log)), JSON.stringify(r.warnings));
  const quiet = await renderReport(path.join(dir, 'report.md'), { browser: null });
  assert.ok(!quiet.warnings.some(w => /파일을 찾을 수 없/.test(w)));
});

test('강조판: 사이클은 직전 강조판 이후 ~ 이번 강조판 날짜 범위', async () => {
  const badged = html => /<h2>방법별 Test AP<span class="badge/.test(html);
  const make = () => {
    const dir = makeSampleReport();
    const md = path.join(dir, 'report.md');
    fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace('cycle: 2026-10-06', 'cycle: 2026-10-01'), 'utf8');
    return md;
  };
  const alone = await renderReport(make(), { highlight: '2026-10-06', browser: null });
  assert.equal(alone.ok, true, JSON.stringify(alone.errors));
  assert.ok(badged(fs.readFileSync(alone.outputs.html, 'utf8')));
  const md = make();
  await renderReport(md, { highlight: '2026-10-03', browser: null });
  const later = await renderReport(md, { highlight: '2026-10-06', browser: null });
  assert.ok(!badged(fs.readFileSync(later.outputs.html, 'utf8')));
  assert.ok(later.warnings.some(w => /바뀐 섹션이 없어요/.test(w)));
});

test('CLI: JSON과 종료 코드', () => {
  const dir = makeSampleReport();
  const ok = spawnSync(process.execPath, [CLI, path.join(dir, 'report.md')], { encoding: 'utf8', env: { ...process.env, MEETING_PREP_BROWSER: path.join(dir, 'none.exe') } });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).ok, true);
  const bad = spawnSync(process.execPath, [CLI, path.join(tempDir('없음'), 'x.md')], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).ok, false);
  const usage = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
});

test('미리보기: 탭마다 PNG', { skip: browser ? false : '브라우저 없음', timeout: 180000 }, async () => {
  const dir = makeSampleReport();
  const r = await renderReport(path.join(dir, 'report.md'), { preview: true });
  assert.equal(r.outputs.preview.length, 3);
  const size = imageSize(fs.readFileSync(r.outputs.preview[0]));
  assert.equal(size.width, 1280);
});

test('실행기: 준비 표시, ?tab=N, custom 스크립트 실행과 오류 격리', { skip: browser ? false : '브라우저 없음', timeout: 120000 }, async () => {
  const dir = makeSampleReport();
  const md = path.join(dir, 'report.md');
  fs.writeFileSync(md, fs.readFileSync(md, 'utf8') + '---\ncomponent: custom\n---\n<div>boom</div>\n<script>throw new Error("x")</script>\n', 'utf8');
  const r = await renderReport(md, { browser: null });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-dom-'));
  const url = `${pathToFileURL(r.outputs.html).href}?tab=2`;
  const p = spawnSync(browser, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--dump-dom', url], { encoding: 'utf8', timeout: 60000 });
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  const dom = p.stdout;
  assert.match(dom, /data-mp-ready="1"/);
  assert.match(dom, /data-ok="1"/);
  assert.match(dom, /이 부품을 그리지 못했어요/);
  assert.match(dom, /data-tab-btn="method"[^>]*aria-selected="true"/);
});
