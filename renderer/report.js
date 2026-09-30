#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseReport } from './report-parse.js';
import { loadDatasets } from './report-data.js';
import { renderReportHtml, sectionKey } from './report-html.js';
import { renderComponent } from './report-components.js';
import { findBrowser, runBrowser, browserFailure } from './pdf.js';
import { parseTodos } from '../hub/lib.js';

const DEFAULT_LIMIT = 20 * 1024 * 1024;
const STATE = '.report-state.json';

export function todoStatus(feedbackText, logText) {
  const lines = String(logText ?? '').replace(/\r\n?/g, '\n').split('\n');
  return parseTodos(String(feedbackText ?? '')).map(t => {
    let status = t.done ? 'done' : 'todo';
    for (const l of lines) {
      if (!new RegExp(`#${t.id}(?!\\d)`).test(l)) continue;
      if (/→\s*완료/.test(l)) status = 'done';
      else if (/→\s*진행 중/.test(l)) status = 'doing';
    }
    return { status, text: `#${t.id} ${t.text}`, note: '' };
  });
}

function readState(dir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, STATE), 'utf8'));
    return s && typeof s.highlights === 'object' && s.highlights ? s : { highlights: {} };
  } catch {
    return { highlights: {} };
  }
}

function sectionsWithCycle(report, cycle) {
  return report.tabs.flatMap(t => t.sections.filter(s => !s.archived && s.cycle === cycle).map(s => sectionKey(t.id, s.title)));
}

async function previews(htmlPath, dir, count, browser) {
  const outDir = path.join(dir, 'preview');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  for (let i = 1; i <= count; i++) {
    const png = path.join(outDir, `tab-${String(i).padStart(2, '0')}.png`);
    const r = await runBrowser(browser, [`--screenshot=${png}`, '--window-size=1280,2400', '--hide-scrollbars', `${pathToFileURL(htmlPath).href}?tab=${i}`]);
    if (r.timedOut || !fs.existsSync(png)) throw browserFailure(`미리보기 ${i}번 탭 이미지를 만들지 못했습니다`, r, 60000);
    files.push(png);
  }
  return files;
}

export async function renderReport(mdPath, { out, highlight, feedback, log, preview = false, browser, sizeLimit = DEFAULT_LIMIT } = {}) {
  const md = path.resolve(mdPath);
  const dir = path.dirname(md);
  const { report, errors } = parseReport(fs.readFileSync(md, 'utf8'));
  if (errors.length) return { ok: false, errors, warnings: [], outputs: {}, size: 0 };
  const { datasets, errors: dataErrors } = loadDatasets(report.datasets, dir);
  if (dataErrors.length) return { ok: false, errors: dataErrors.map(e => ({ block: 1, line: 1, message: e.message })), warnings: [], outputs: {}, size: 0 };
  const warnings = [];

  let hl;
  const state = readState(dir);
  if (highlight) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(highlight)) return { ok: false, errors: [{ block: 0, line: 0, message: '--highlight는 YYYY-MM-DD 형식이어야 해요' }], warnings, outputs: {}, size: 0 };
    const earlier = Object.keys(state.highlights).filter(c => c < highlight).sort();
    const prev = new Set(earlier.length ? state.highlights[earlier.at(-1)] : []);
    const touched = sectionsWithCycle(report, highlight);
    if (!touched.length) warnings.push('이번 사이클에 바뀐 섹션이 없어요');
    let meetingHtml = '';
    if (feedback && fs.existsSync(feedback)) {
      const items = todoStatus(fs.readFileSync(feedback, 'utf8'), log && fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');
      if (items.length) meetingHtml = `<h3>지난 피드백 반영 현황</h3>${renderComponent({ type: 'checklist', items, block: 0, line: 0, body: '' }, { datasets, baseDir: dir, nextId: () => 'mpm' }).html}`;
    }
    hl = { cycle: highlight, newKeys: new Set(touched.filter(k => !prev.has(k))), meetingHtml };
  }

  const r = renderReportHtml(report, { datasets, baseDir: dir, highlight: hl });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: [...warnings, ...r.warnings], outputs: {}, size: 0 };
  warnings.push(...r.warnings);
  const size = Buffer.byteLength(r.html, 'utf8');
  if (size > sizeLimit) warnings.push(`보고서 파일이 ${(size / 1024 / 1024).toFixed(1)}MB예요. 쓰지 않는 열을 빼거나 그림 해상도를 낮춰주세요`);

  const htmlPath = path.resolve(out ?? path.join(dir, highlight ? `report-${highlight}.html` : 'report.html'));
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, r.html, 'utf8');
  if (highlight) {
    state.highlights[highlight] = r.sections;
    fs.writeFileSync(path.join(dir, STATE), JSON.stringify(state, null, 2), 'utf8');
  }

  const outputs = { html: htmlPath };
  if (preview) {
    const b = browser === undefined ? findBrowser() : browser;
    if (!b) warnings.push('브라우저를 찾지 못해 미리보기 이미지를 건너뛰었습니다');
    else {
      try { outputs.preview = await previews(htmlPath, dir, report.tabs.length + (highlight ? 1 : 0), b); }
      catch (e) { warnings.push(`미리보기 생성 실패: ${e.message}`); }
    }
  }
  return { ok: true, errors: [], warnings, outputs, size };
}

const real = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const isMain = process.argv[1] && same(real(process.argv[1]), real(fileURLToPath(import.meta.url)));
if (isMain) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { out: { type: 'string' }, highlight: { type: 'string' }, feedback: { type: 'string' }, log: { type: 'string' }, preview: { type: 'boolean', default: false } },
    });
    if (!positionals[0]) {
      console.error('사용법: node report.js <report.md> [--out 파일] [--highlight YYYY-MM-DD] [--feedback feedback.md] [--log log.md] [--preview]');
      process.exitCode = 2;
    } else {
      const result = await renderReport(positionals[0], values);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exitCode = result.ok ? 0 : 1;
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, errors: [{ block: null, line: null, message: e.message }], warnings: [], outputs: {}, size: 0 }, null, 2) + '\n');
    process.exitCode = 1;
  }
}
