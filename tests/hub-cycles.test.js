import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as hub from '../hub/lib.js';
import { tempDir, PNG_1x1 } from './helpers.js';

function setup() {
  const root = tempDir('사이클 테스트');
  const hubPath = path.join(root, '허브');
  hub.initHub(hubPath, { MEETING_PREP_CONFIG: path.join(root, 'config.json') });
  const t = hub.addTrack(hubPath, { name: '논문A', type: 'research', sources: [path.join(root, 'src')] });
  return { root, hubPath, t };
}

const FEEDBACK = `# 피드백 · 2026-10-06

## 할 일
- [ ] #1 베이스라인 추가
- [ ] #2 데이터셋 B 실험

## 지적 / 우려
- 비교군이 약함

## 아이디어 / 제안
- 모듈 C도 고려
`;

test('처음에는 next 사이클 하나만 열려 있음', () => {
  const { t } = setup();
  const c = hub.getCycles(t.dir);
  assert.equal(c.open.name, 'next');
  assert.deepEqual(c.closed, []);
  assert.equal(c.previous, null);
});

test('setCycleDate: next를 날짜로 바꿈, 형식 검사', () => {
  const { t } = setup();
  assert.throws(() => hub.setCycleDate(t.dir, '10/06'), e => e.code === 'BAD_DATE');
  const c = hub.setCycleDate(t.dir, '2026-10-06');
  assert.equal(c.name, '2026-10-06');
  assert.ok(fs.existsSync(path.join(t.dir, 'cycles', '2026-10-06', 'log.md')));
  assert.equal(hub.getCycles(t.dir).open.name, '2026-10-06');
});

test('parseTodos: 할 일 섹션만 읽음', () => {
  assert.deepEqual(hub.parseTodos(FEEDBACK), [
    { id: 1, text: '베이스라인 추가', done: false },
    { id: 2, text: '데이터셋 B 실험', done: false },
  ]);
  assert.deepEqual(hub.parseTodos('## 지적 / 우려\n- [ ] #1 이건 할 일이 아님\n'), []);
});

test('closeCycle: 열린 사이클을 닫고 할 일을 새 next로 넘김', () => {
  const { t } = setup();
  const r = hub.closeCycle(t.dir, FEEDBACK, { today: '2026-10-06' });
  assert.deepEqual(r, { closed: '2026-10-06', opened: 'next', todos: hub.parseTodos(FEEDBACK) });
  const c = hub.getCycles(t.dir);
  assert.equal(c.previous.name, '2026-10-06');
  assert.equal(c.open.name, 'next');
  assert.ok(fs.readFileSync(path.join(c.previous.dir, 'feedback.md'), 'utf8').includes('비교군이 약함'));
  const log = fs.readFileSync(path.join(c.open.dir, 'log.md'), 'utf8');
  assert.match(log, /- \[ \] #1 베이스라인 추가/);
  assert.match(log, /- \[ \] #2 데이터셋 B 실험/);
});

test('closeCycle: 이미 날짜가 정해진 사이클은 그 이름 유지', () => {
  const { t } = setup();
  hub.setCycleDate(t.dir, '2026-10-08');
  assert.equal(hub.closeCycle(t.dir, FEEDBACK, { today: '2026-10-06' }).closed, '2026-10-08');
});

test('closeCycle: 할 일이 없는 피드백, 같은 날 두 번째 미팅', () => {
  const { t } = setup();
  hub.closeCycle(t.dir, FEEDBACK, { today: '2026-10-06' });
  const r = hub.closeCycle(t.dir, '# 피드백\n\n## 지적 / 우려\n- 없음\n', { today: '2026-10-06' });
  assert.equal(r.closed, '2026-10-06-2');
  assert.deepEqual(r.todos, []);
  assert.match(fs.readFileSync(path.join(t.dir, 'cycles', 'next', 'log.md'), 'utf8'), /- \(없음\)/);
});

test('getCycles: 열린 사이클이 둘이면 MULTI_OPEN', () => {
  const { t } = setup();
  fs.mkdirSync(path.join(t.dir, 'cycles', '2026-10-01'));
  assert.throws(() => hub.getCycles(t.dir), e => e.code === 'MULTI_OPEN');
});

test('appendLog와 lastLogEntry: 세션별 마지막 기록', () => {
  const { t } = setup();
  const h1 = hub.formatLogHeading(new Date(2026, 8, 30, 14, 5), 'abc');
  const h2 = hub.formatLogHeading(new Date(2026, 8, 30, 16, 40), 'xyz');
  const h3 = hub.formatLogHeading(new Date(2026, 9, 1, 9, 0), 'abc');
  assert.equal(h1, '## 2026-09-30 14:05 · session abc');
  hub.appendLog(t.dir, `${h1}\n- 한 일: 첫 실험`);
  hub.appendLog(t.dir, `${h2}\n- 한 일: 다른 채팅`);
  const r = hub.appendLog(t.dir, `${h3}\n- 한 일: 이어서`);
  assert.equal(r.cycle, 'next');
  const text = fs.readFileSync(r.file, 'utf8');
  assert.ok(text.indexOf('첫 실험') < text.indexOf('다른 채팅') && text.indexOf('다른 채팅') < text.indexOf('이어서'));
  assert.deepEqual(hub.lastLogEntry(text, 'abc'), { timestamp: '2026-10-01 09:00', sessionId: 'abc' });
  assert.deepEqual(hub.lastLogEntry(text, 'xyz'), { timestamp: '2026-09-30 16:40', sessionId: 'xyz' });
  assert.equal(hub.lastLogEntry(text, 'none'), null);
});

test('library: 슬러그 중복 시 번호, 제목 목록', () => {
  const { hubPath } = setup();
  const note = '---\ntitle: Attention Sinks\nyear: 2024\n---\n- 핵심: x\n';
  const a = hub.addLibraryNote(hubPath, '2024 Attention Sink', note);
  const b = hub.addLibraryNote(hubPath, '2024 Attention Sink', note);
  assert.equal(a.slug, '2024-attention-sink');
  assert.equal(b.slug, '2024-attention-sink-2');
  assert.deepEqual(hub.listLibrary(hubPath).map(n => n.title), ['Attention Sinks', 'Attention Sinks']);
  assert.equal(hub.slugify('한국어 논문: 제목!'), '한국어-논문-제목');
});

test('copyAsset: 한글 경로 복사, 같은 파일은 재사용, 다른 파일은 새 이름', () => {
  const { root } = setup();
  const deckDir = path.join(root, '덱');
  const src1 = path.join(root, '결과 그림', 'plot.png');
  fs.mkdirSync(path.dirname(src1), { recursive: true });
  fs.writeFileSync(src1, PNG_1x1);
  const src2 = path.join(root, '다른', 'plot.png');
  fs.mkdirSync(path.dirname(src2), { recursive: true });
  fs.writeFileSync(src2, Buffer.concat([PNG_1x1, Buffer.from('x')]));
  assert.equal(hub.copyAsset(deckDir, src1).rel, 'assets/plot.png');
  assert.equal(hub.copyAsset(deckDir, src1).rel, 'assets/plot.png');
  assert.equal(hub.copyAsset(deckDir, src2).rel, 'assets/plot-2.png');
  assert.throws(() => hub.copyAsset(deckDir, path.join(root, '없음.png')), e => e.code === 'NOT_FOUND');
});

test('status: 트랙별 열린 사이클과 직전 사이클', () => {
  const { hubPath, t } = setup();
  hub.closeCycle(t.dir, FEEDBACK, { today: '2026-10-06' });
  const s = hub.status(hubPath);
  assert.equal(s.hubPath, hubPath);
  assert.equal(s.libraryCount, 0);
  assert.equal(s.tracks[0].open.name, 'next');
  assert.equal(s.tracks[0].previous.name, '2026-10-06');
  assert.equal(hub.status(hubPath, '논문A').tracks.length, 1);
});
