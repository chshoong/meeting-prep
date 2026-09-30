import { load } from 'js-yaml';
import { splitBlocks } from './parse.js';

export const COMPONENTS = ['text', 'stats', 'cards', 'steps', 'chart', 'table', 'compare', 'filter', 'details', 'callout', 'figure', 'checklist', 'custom'];
const WITH_BODY = new Set(['text', 'details', 'callout', 'custom']);
const STATUSES = ['done', 'doing', 'todo'];
const AGGS = ['mean', 'median', 'min', 'max', 'sum', 'count', 'sd'];

function checkFrom(type, from) {
  if (!(from.dataset && from.x && from.y)) return `${type}의 from에는 dataset, x, y가 필요해요`;
  if (from.agg != null && !AGGS.includes(from.agg)) return `${type}의 from.agg는 ${AGGS.join(', ')} 중 하나여야 해요`;
  if (type === 'table' && from.show != null && !(Array.isArray(from.show) && from.show.length && from.show.every(v => AGGS.includes(v)))) {
    return `table의 from.show는 ${AGGS.join(', ')} 중에서 고른 목록이어야 해요 (예: [mean, sd])`;
  }
  return null;
}

function str(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

const isList = (v, min, max) => Array.isArray(v) && v.length >= min && v.length <= max;

function validate(c) {
  switch (c.type) {
    case 'text': case 'custom':
      return c.body.trim() ? null : `${c.type} 부품에는 닫는 --- 아래에 본문이 필요해요`;
    case 'details':
      if (!c.title) return 'details 부품에는 title이 필요해요';
      return c.body.trim() ? null : 'details 부품에는 본문이 필요해요';
    case 'callout':
      if (c.tone != null && c.tone !== 'info' && c.tone !== 'warn') return "callout의 tone은 info 또는 warn이에요";
      return c.body.trim() ? null : 'callout 부품에는 본문이 필요해요';
    case 'stats':
      if (!isList(c.items, 1, 4)) return 'stats 부품에는 items가 1~4개 필요해요';
      return c.items.every(i => i && i.label != null && i.value != null) ? null : 'stats 항목에는 label과 value가 필요해요';
    case 'cards':
      if (!isList(c.items, 1, 6)) return 'cards 부품에는 items가 1~6개 필요해요';
      if (c.columns != null && c.columns !== 2 && c.columns !== 3) return 'cards의 columns는 2 또는 3이에요';
      return c.items.every(i => i && i.title) ? null : 'cards 항목에는 title이 필요해요';
    case 'steps':
      if (!isList(c.items, 2, 6)) return 'steps 부품에는 items가 2~6개 필요해요';
      return c.items.every(i => i && i.title) ? null : 'steps 항목에는 title이 필요해요';
    case 'chart':
      if (c.from) return checkFrom('chart', c.from);
      return null;
    case 'table':
      if (c.from) return checkFrom('table', c.from);
      if (!Array.isArray(c.columns) || !Array.isArray(c.rows)) return 'table 부품에는 columns와 rows, 또는 from이 필요해요';
      return c.rows.every(r => Array.isArray(r) && r.length === c.columns.length) ? null : `표의 모든 행은 칸이 ${c.columns.length}개여야 해요. 칸 안에 쉼표가 있으면 그 칸을 큰따옴표로 감싸세요 (예: ["A, B", "0.43"])`;
    case 'compare': case 'filter':
      return c.dataset ? null : `${c.type} 부품에는 dataset이 필요해요`;
    case 'figure':
      return c.image ? null : 'figure 부품에는 image가 필요해요';
    case 'checklist':
      if (!isList(c.items, 1, 30)) return 'checklist 부품에는 items가 필요해요';
      return c.items.every(i => i && STATUSES.includes(i.status) && i.text) ? null : `checklist 항목에는 status(${STATUSES.join(', ')})와 text가 필요해요`;
    default:
      return null;
  }
}

export function parseReport(text) {
  const { blocks, errors: splitErrors } = splitBlocks(text);
  const errors = splitErrors.map(e => ({ block: e.slide, line: e.line, message: e.message }));
  const report = { meta: { kicker: '', title: '', subtitle: '', pills: [] }, datasets: {}, tabs: [] };
  let tab = null;
  let section = null;
  let sawReport = false;

  blocks.forEach((b, k) => {
    const n = k + 1;
    const fail = message => { errors.push({ block: n, line: b.line, message }); };
    if (!b.yaml.trim()) {
      fail("머리말이 비어 있어요. 본문이 있는 부품(text, details, callout, custom) 뒤에 '---'를 두 번 쓰면 이렇게 돼요. 본문 다음에는 '---'를 한 줄만 쓰고, 그 줄이 곧 다음 블록의 시작이에요");
      return;
    }
    let meta;
    try {
      meta = load(b.yaml) ?? {};
    } catch (e) {
      errors.push({ block: n, line: b.line + (e.mark ? e.mark.line + 1 : 0), message: `YAML 형식 오류: ${e.reason ?? e.message}` });
      return;
    }
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) { fail('머리말은 key: value 형식이어야 합니다'); return; }

    if ('report' in meta) {
      if (k !== 0) { fail('report 블록은 맨 앞에만 둘 수 있어요'); return; }
      sawReport = true;
      const r = meta.report && typeof meta.report === 'object' ? meta.report : {};
      report.meta = { kicker: str(r.kicker), title: str(r.title), subtitle: str(r.subtitle), pills: Array.isArray(r.pills) ? r.pills.map(str) : [] };
      report.datasets = meta.datasets && typeof meta.datasets === 'object' ? meta.datasets : {};
      if (!report.meta.title) fail('report 블록에는 title이 필요해요');
      return;
    }
    if (!sawReport) { fail('맨 앞에는 report 블록이 있어야 해요'); sawReport = true; }

    if ('tab' in meta) {
      const id = str(meta.tab);
      if (!/^[A-Za-z][\w-]*$/.test(id)) { fail('tab은 영문으로 시작하는 id여야 해요 (예: results)'); return; }
      if (id === 'meeting') { fail("tab id 'meeting'은 강조판이 쓰는 이름이라 쓸 수 없어요"); return; }
      if (report.tabs.some(t => t.id === id)) { fail(`같은 tab id가 이미 있어요: ${id}`); return; }
      tab = { id, title: str(meta.title) || id, line: b.line, sections: [] };
      report.tabs.push(tab);
      section = null;
      return;
    }
    if ('section' in meta) {
      if (!tab) { fail('section은 tab 블록 뒤에 와야 해요'); return; }
      const cycle = str(meta.cycle);
      if (cycle && !/^\d{4}-\d{2}-\d{2}$/.test(cycle)) { fail('cycle은 YYYY-MM-DD 형식이어야 해요'); return; }
      const title = str(meta.section);
      if (!title) { fail('section에는 제목이 필요해요'); return; }
      section = { title, kicker: str(meta.kicker), cycle, archived: meta.archived === true, line: b.line, components: [] };
      tab.sections.push(section);
      return;
    }
    if ('component' in meta) {
      const type = str(meta.component);
      if (!COMPONENTS.includes(type)) { fail(`알 수 없는 component '${type}'. 가능한 값: ${COMPONENTS.join(', ')}`); return; }
      if (!section) { fail('component는 section 블록 뒤에 와야 해요'); return; }
      const c = { ...meta, type, block: n, line: b.line, body: WITH_BODY.has(type) ? b.body : '' };
      delete c.component;
      // 차트 종류(bar, line…)의 type 키는 부품 종류와 겹치므로 chart로 옮긴다
      if (type === 'chart') c.chart = meta.type == null ? 'bar' : String(meta.type);
      const err = validate(c);
      if (err) { fail(err); return; }
      section.components.push(c);
      return;
    }
    const hint = COMPONENTS.includes(String(meta.type)) ? ` 부품이라면 'component: ${meta.type}'로 시작하세요 (type: 이 아니라 component:)` : '';
    fail(`블록의 첫 키는 report, tab, section, component 중 하나여야 해요.${hint}`);
  });

  if (!report.tabs.length && !errors.length) errors.push({ block: 0, line: 1, message: '탭이 하나도 없어요' });
  return { report, errors };
}
