import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load, dump } from 'js-yaml';

export class HubError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const TRACK_TYPES = ['research', 'project'];
export const KNOWLEDGE_TYPES = ['wiki', 'pdf'];

// ---------- 설정과 허브 위치 ----------

export function configPath(env = process.env) {
  return env.MEETING_PREP_CONFIG ?? path.join(os.homedir(), '.meeting-prep', 'config.json');
}

export function readConfig(env = process.env) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(env), 'utf8'));
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch {
    return {};
  }
}

export function writeConfig(patch, env = process.env) {
  const next = { ...readConfig(env), ...patch };
  const file = configPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function getHubPath(env = process.env) {
  if (env.MEETING_HUB) return path.resolve(env.MEETING_HUB);
  const { hubPath } = readConfig(env);
  return typeof hubPath === 'string' && hubPath ? hubPath : null;
}

export function defaultHubPath() {
  return path.join(os.homedir(), 'meeting-hub');
}

// ---------- 머리말 ----------

export function splitFrontmatter(text) {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: t };
  return { data: load(m[1]) ?? {}, body: m[2] };
}

export function readFrontmatter(file) {
  try {
    return splitFrontmatter(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e instanceof HubError || e?.code === 'ENOENT') throw e;
    throw new HubError('BAD_FRONTMATTER', `${file} 머리말(YAML) 형식 오류: ${e.reason ?? e.message}`);
  }
}

export function joinFrontmatter(data, body) {
  return `---\n${dump(data, { lineWidth: -1 })}---\n${body}`;
}

// ---------- 허브 ----------

const HUB_BODY = `# 미팅 허브

트랙은 \`tracks/research\`, \`tracks/project\` 아래에 있습니다.
위 머리말의 \`knowledge\`에 논문 정리 폴더(지식 소스)를 등록합니다. 비어 있으면 \`library/\`가 기본 지식 소스입니다.
`;

export function initHub(hubPath, env = process.env) {
  const root = path.resolve(hubPath);
  const hubMd = path.join(root, 'hub.md');
  const existed = fs.existsSync(hubMd);
  for (const d of ['library', '.tmp', path.join('tracks', 'research'), path.join('tracks', 'project')]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  if (!existed) fs.writeFileSync(hubMd, joinFrontmatter({ knowledge: [] }, HUB_BODY), 'utf8');
  writeConfig({ hubPath: root }, env);
  return { hubPath: root, created: !existed };
}

export function requireHub(env = process.env) {
  const p = getHubPath(env);
  if (!p || !fs.existsSync(path.join(p, 'hub.md'))) {
    throw new HubError('NO_HUB', '허브가 없습니다. 먼저 허브를 만들어야 합니다');
  }
  return p;
}

export function ensureHub(env = process.env) {
  const existing = getHubPath(env);
  if (existing && fs.existsSync(path.join(existing, 'hub.md'))) return { hubPath: existing, createdHub: false };
  const r = initHub(existing ?? defaultHubPath(), env);
  return { hubPath: r.hubPath, createdHub: true };
}

export function moveHub(hubPath, target, env = process.env) {
  const from = path.resolve(hubPath);
  const to = path.resolve(target);
  if (fs.existsSync(to)) throw new HubError('EXISTS', `옮길 위치에 이미 폴더가 있습니다: ${to}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (e) {
    if (e?.code !== 'EXDEV') throw e;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
  writeConfig({ hubPath: to }, env);
  return { hubPath: to };
}

// ---------- 경로 비교 ----------

function norm(p) {
  const r = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

export function samePath(a, b) {
  return norm(a) === norm(b);
}

export function isInside(child, parent) {
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p + '/');
}

export function safeName(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]/g, '-');
}

// ---------- 지식 소스 ----------

export function readKnowledge(hubPath) {
  const { data } = readFrontmatter(path.join(hubPath, 'hub.md'));
  const list = Array.isArray(data.knowledge) ? data.knowledge : [];
  return list.map(k => ({ type: k.type, path: k.path, exists: fs.existsSync(k.path) }));
}

export function addKnowledge(hubPath, { type, path: p }) {
  if (!KNOWLEDGE_TYPES.includes(type)) throw new HubError('BAD_TYPE', `지식 소스 형식은 ${KNOWLEDGE_TYPES.join(', ')} 중 하나여야 합니다`);
  if (!p) throw new HubError('MISSING_ARG', '지식 소스 경로가 필요합니다');
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new HubError('NOT_FOUND', `폴더가 없습니다: ${abs}`);
  const file = path.join(hubPath, 'hub.md');
  const { data, body } = readFrontmatter(file);
  data.knowledge = Array.isArray(data.knowledge) ? data.knowledge : [];
  if (!data.knowledge.some(k => samePath(k.path, abs))) data.knowledge.push({ type, path: abs });
  fs.writeFileSync(file, joinFrontmatter(data, body), 'utf8');
  return readKnowledge(hubPath);
}

// ---------- 트랙 ----------

export function newLogHeader(todos) {
  const list = todos.length ? todos.map(t => `- [ ] #${t.id} ${t.text}`).join('\n') : '- (없음)';
  return `# 작업 로그\n\n## 이번 사이클 할 일 (지난 미팅 피드백)\n\n${list}\n\n## 기록\n`;
}

export function listTracks(hubPath) {
  const out = [];
  for (const type of TRACK_TYPES) {
    const dir = path.join(hubPath, 'tracks', type);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const tdir = path.join(dir, e.name);
      const file = path.join(tdir, 'track.md');
      if (!fs.existsSync(file)) continue;
      const { data } = readFrontmatter(file);
      out.push({
        name: String(data.name ?? e.name),
        type,
        dir: tdir,
        sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
      });
    }
  }
  return out;
}

export function addTrack(hubPath, { name, type, sources = [], description = '' }) {
  if (!TRACK_TYPES.includes(type)) throw new HubError('BAD_TYPE', '트랙 종류는 research 또는 project여야 합니다');
  const clean = String(name ?? '').trim();
  if (!clean) throw new HubError('BAD_NAME', '트랙 이름이 필요합니다');
  if (listTracks(hubPath).some(t => t.name === clean)) throw new HubError('EXISTS', `이미 있는 트랙입니다: ${clean}`);
  const folder = safeName(clean);
  if (!folder || folder.startsWith('.')) throw new HubError('BAD_NAME', `트랙 이름으로 쓸 수 없는 이름입니다: ${clean}`);
  const dir = path.join(hubPath, 'tracks', type, folder);
  if (fs.existsSync(dir)) throw new HubError('EXISTS', `이미 같은 폴더를 쓰는 트랙이 있습니다: ${path.basename(dir)}`);
  const abs = sources.map(s => path.resolve(s));
  fs.mkdirSync(path.join(dir, 'cycles', 'next'), { recursive: true });
  const body = `# ${clean}\n\n${description || '목표와 현재 단계를 자유롭게 적어주세요.'}\n`;
  fs.writeFileSync(path.join(dir, 'track.md'), joinFrontmatter({ name: clean, type, sources: abs }, body), 'utf8');
  fs.writeFileSync(path.join(dir, 'cycles', 'next', 'log.md'), newLogHeader([]), 'utf8');
  return { name: clean, type, dir, sources: abs };
}

export function findTrack(hubPath, name) {
  const t = listTracks(hubPath).find(x => x.name === name);
  if (!t) throw new HubError('NO_TRACK', `트랙을 찾을 수 없습니다: ${name}`);
  return t;
}

export function resolveTrack(hubPath, cwd) {
  return listTracks(hubPath).filter(t => t.sources.some(s => isInside(cwd, s)));
}

export function addSource(hubPath, trackName, dir) {
  const t = findTrack(hubPath, trackName);
  const file = path.join(t.dir, 'track.md');
  const { data, body } = readFrontmatter(file);
  const sources = Array.isArray(data.sources) ? data.sources.map(String) : [];
  const abs = path.resolve(dir);
  if (!sources.some(s => samePath(s, abs))) sources.push(abs);
  fs.writeFileSync(file, joinFrontmatter({ ...data, sources }, body), 'utf8');
  return findTrack(hubPath, trackName);
}

// ---------- 날짜 ----------

const pad = n => String(n).padStart(2, '0');

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatLogHeading(d, sessionId) {
  return `## ${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} · session ${sessionId}`;
}

// ---------- 사이클 ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CYCLE_RE = /^(next|\d{4}-\d{2}-\d{2}(-\d+)?)$/;

export function getCycles(trackDir) {
  const root = path.join(trackDir, 'cycles');
  const all = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory() && CYCLE_RE.test(e.name))
      .map(e => ({ name: e.name, dir: path.join(root, e.name), closed: fs.existsSync(path.join(root, e.name, 'feedback.md')) }))
    : [];
  const open = all.filter(c => !c.closed);
  if (open.length > 1) {
    throw new HubError('MULTI_OPEN', `진행 중인 사이클이 여러 개입니다: ${open.map(c => c.name).join(', ')}. 끝난 사이클 폴더에 feedback.md를 넣어 정리해주세요`);
  }
  const closed = all.filter(c => c.closed).sort((a, b) => a.name.localeCompare(b.name));
  return { open: open[0] ?? null, closed, previous: closed.at(-1) ?? null };
}

export function openCycle(trackDir) {
  const { open } = getCycles(trackDir);
  if (open) return open;
  const dir = path.join(trackDir, 'cycles', 'next');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'log.md'), newLogHeader([]), 'utf8');
  return { name: 'next', dir, closed: false };
}

function renameOpen(trackDir, open, name) {
  const target = path.join(trackDir, 'cycles', name);
  fs.renameSync(open.dir, target);
  return { name, dir: target, closed: false };
}

export function setCycleDate(trackDir, date) {
  if (!DATE_RE.test(String(date))) throw new HubError('BAD_DATE', '날짜는 YYYY-MM-DD 형식이어야 합니다');
  const open = openCycle(trackDir);
  if (open.name === date) return open;
  if (fs.existsSync(path.join(trackDir, 'cycles', date))) throw new HubError('EXISTS', `이미 ${date} 사이클이 있습니다`);
  return renameOpen(trackDir, open, date);
}

function uniqueCycleName(trackDir, date) {
  let name = date;
  let n = 2;
  while (fs.existsSync(path.join(trackDir, 'cycles', name))) name = `${date}-${n++}`;
  return name;
}

export function parseTodos(feedbackText) {
  const todos = [];
  let inTodo = false;
  for (const line of feedbackText.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^##\s/.test(line)) {
      inTodo = /^##\s*할 일/.test(line);
      continue;
    }
    if (!inTodo) continue;
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s*#(\d+)\s+(.*)$/);
    if (m) todos.push({ id: Number(m[2]), text: m[3].trim(), done: m[1] !== ' ' });
  }
  return todos;
}

export function closeCycle(trackDir, feedbackText, { today = localDate() } = {}) {
  if (!DATE_RE.test(String(today))) throw new HubError('BAD_DATE', '날짜는 YYYY-MM-DD 형식이어야 합니다');
  let open = openCycle(trackDir);
  if (open.name === 'next') open = renameOpen(trackDir, open, uniqueCycleName(trackDir, today));
  const text = feedbackText.replace(/^\uFEFF/, '');
  fs.writeFileSync(path.join(open.dir, 'feedback.md'), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  const todos = parseTodos(text);
  const nextDir = path.join(trackDir, 'cycles', 'next');
  fs.mkdirSync(nextDir, { recursive: true });
  fs.writeFileSync(path.join(nextDir, 'log.md'), newLogHeader(todos), 'utf8');
  return { closed: open.name, opened: 'next', todos };
}

// ---------- 로그 ----------

const HEADING_RE = /^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · session (\S+)[ \t]*$/gm;

export function lastLogEntry(logText, sessionId) {
  const re = new RegExp(HEADING_RE.source, 'gm');
  let m;
  let last = null;
  const text = logText.replace(/\r\n?/g, '\n');
  while ((m = re.exec(text)) !== null) {
    if (m[2] === sessionId) last = { timestamp: m[1], sessionId: m[2] };
  }
  return last;
}

export function appendLog(trackDir, entry) {
  const open = openCycle(trackDir);
  const file = path.join(open.dir, 'log.md');
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : newLogHeader([]);
  const sep = prev.endsWith('\n\n') ? '' : prev.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(file, `${prev}${sep}${entry.trim()}\n`, 'utf8');
  return { file, cycle: open.name };
}

function readLog(dir) {
  const file = path.join(dir, 'log.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export function findLastLog(trackDir, sessionId) {
  const open = openCycle(trackDir);
  let last = lastLogEntry(readLog(open.dir), sessionId);
  let lastCycle = last ? open.name : null;
  if (!last) {
    const { previous } = getCycles(trackDir);
    if (previous) {
      last = lastLogEntry(readLog(previous.dir), sessionId);
      lastCycle = last ? previous.name : null;
    }
  }
  return { cycle: open.name, last, lastCycle };
}

export function amendLastLog(trackDir, sessionId, body) {
  const open = openCycle(trackDir);
  const file = path.join(open.dir, 'log.md');
  const text = readLog(open.dir).replace(/\r\n?/g, '\n');
  const re = new RegExp(HEADING_RE.source, 'gm');
  let m;
  let hit = null;
  while ((m = re.exec(text)) !== null) {
    if (m[2] === sessionId) hit = { headEnd: m.index + m[0].length };
  }
  if (!hit) throw new HubError('NO_ENTRY', '이 채팅에서 저장한 기록이 이번 사이클에 없습니다');
  const after = text.slice(hit.headEnd);
  const next = after.search(/\n## /);
  const rest = next === -1 ? '' : after.slice(next + 1);
  const out = `${text.slice(0, hit.headEnd)}\n${String(body).trim()}\n${rest ? `\n${rest}` : ''}`;
  fs.writeFileSync(file, out, 'utf8');
  return { file, cycle: open.name };
}

// ---------- library ----------

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'note';
}

export function listLibrary(hubPath) {
  const dir = path.join(hubPath, 'library');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const file = path.join(dir, f);
    let title = '';
    try {
      title = String(splitFrontmatter(fs.readFileSync(file, 'utf8')).data.title ?? '');
    } catch {
      // 머리말이 깨진 노트는 제목 없이
    }
    return { slug: f.slice(0, -3), title, file };
  });
}

export function addLibraryNote(hubPath, slug, text) {
  const dir = path.join(hubPath, 'library');
  fs.mkdirSync(dir, { recursive: true });
  const base = slugify(slug);
  let name = base;
  let n = 2;
  while (fs.existsSync(path.join(dir, `${name}.md`))) name = `${base}-${n++}`;
  const file = path.join(dir, `${name}.md`);
  fs.writeFileSync(file, `${text.replace(/^\uFEFF/, '').trim()}\n`, 'utf8');
  return { file, slug: name };
}

// ---------- 그림 복사 ----------

export function copyAsset(deckDir, src) {
  const abs = path.resolve(src);
  if (!fs.existsSync(abs)) throw new HubError('NOT_FOUND', `파일이 없습니다: ${abs}`);
  const dir = path.join(deckDir, 'assets');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(abs);
  const stem = path.basename(abs, ext);
  const data = fs.readFileSync(abs);
  let name = `${stem}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, name))) {
    if (fs.readFileSync(path.join(dir, name)).equals(data)) return { rel: `assets/${name}`, file: path.join(dir, name) };
    name = `${stem}-${n++}${ext}`;
  }
  fs.writeFileSync(path.join(dir, name), data);
  return { rel: `assets/${name}`, file: path.join(dir, name) };
}

// ---------- 상태 ----------

export function status(hubPath, trackName) {
  const tracks = (trackName ? [findTrack(hubPath, trackName)] : listTracks(hubPath)).map(t => {
    const c = getCycles(t.dir);
    return {
      ...t,
      open: c.open ? { name: c.open.name, dir: c.open.dir } : null,
      previous: c.previous ? { name: c.previous.name, dir: c.previous.dir } : null,
    };
  });
  return { hubPath, knowledge: readKnowledge(hubPath), libraryCount: listLibrary(hubPath).length, tracks };
}
