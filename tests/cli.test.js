import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../hub/cli.js';
import { tempDir } from './helpers.js';

const CLI = fileURLToPath(new URL('../hub/cli.js', import.meta.url));

function ctx() {
  const root = tempDir('CLI 테스트');
  const env = { MEETING_PREP_CONFIG: path.join(root, 'config.json'), MEETING_PREP_TRANSCRIPTS_DIR: path.join(root, 'no-transcripts') };
  return { root, env, hubPath: path.join(root, '허브') };
}

test('허브가 없으면 NO_HUB', async () => {
  const { env } = ctx();
  const r = await run(['status'], { env });
  assert.equal(r.code, 1);
  assert.equal(r.output.code, 'NO_HUB');
});

test('init → track-add → resolve-track → status', async () => {
  const { env, hubPath, root } = ctx();
  assert.equal((await run(['init', '--path', hubPath], { env })).output.created, true);
  const src = path.join(root, '프로젝트 A');
  const add = await run(['track-add', '--name', '논문A', '--type', 'research', '--source', src, '--source', path.join(root, 'B')], { env });
  assert.equal(add.code, 0);
  assert.equal(add.output.sources.length, 2);
  const res = await run(['resolve-track', '--cwd', path.join(src, 'src')], { env });
  assert.deepEqual(res.output.matches.map(m => m.name), ['논문A']);
  const st = await run(['status', '--track', '논문A'], { env });
  assert.equal(st.output.tracks[0].open.name, 'next');
});

test('log-append와 last-log: 파일 입력, 세션별', async () => {
  const { env, hubPath, root } = ctx();
  await run(['init', '--path', hubPath], { env });
  await run(['track-add', '--name', '과제B', '--type', 'project'], { env });
  const entry = path.join(root, 'entry.md');
  fs.writeFileSync(entry, '\uFEFF- 한 일: 데모 준비\n', 'utf8');
  const a = await run(['log-append', '--track', '과제B', '--session', 'sess-1', '--file', entry], { env });
  assert.equal(a.code, 0);
  assert.match(fs.readFileSync(a.output.file, 'utf8'), /· session sess-1\n- 한 일: 데모 준비/);
  const last = await run(['last-log', '--track', '과제B', '--session', 'sess-1'], { env });
  assert.equal(last.output.last.sessionId, 'sess-1');
  assert.equal((await run(['last-log', '--track', '과제B', '--session', 'other'], { env })).output.last, null);
});

test('feedback-close, set-date, transcripts 기본 since', async () => {
  const { env, hubPath, root } = ctx();
  await run(['init', '--path', hubPath], { env });
  await run(['track-add', '--name', '논문A', '--type', 'research', '--source', root], { env });
  assert.equal((await run(['set-date', '--track', '논문A', '--date', '2026-10-06'], { env })).output.name, '2026-10-06');
  const fb = path.join(root, 'fb.md');
  fs.writeFileSync(fb, '# 피드백\n\n## 할 일\n- [ ] #1 표 정리\n', 'utf8');
  const c = await run(['feedback-close', '--track', '논문A', '--file', fb], { env });
  assert.deepEqual(c.output.todos, [{ id: 1, text: '표 정리', done: false }]);
  const t = await run(['transcripts', '--track', '논문A'], { env });
  assert.equal(t.code, 0);
  assert.equal(t.output.since, '2026-10-06');
  assert.deepEqual(t.output.sessions, []);
});

test('library-add, library-list, copy-asset, knowledge-add', async () => {
  const { env, hubPath, root } = ctx();
  await run(['init', '--path', hubPath], { env });
  const note = path.join(root, 'note.md');
  fs.writeFileSync(note, '---\ntitle: 논문 제목\n---\n- 핵심: x\n', 'utf8');
  assert.equal((await run(['library-add', '--slug', 'paper one', '--file', note], { env })).output.slug, 'paper-one');
  assert.equal((await run(['library-list'], { env })).output.notes[0].title, '논문 제목');
  const img = path.join(root, '그림.png');
  fs.writeFileSync(img, 'png');
  assert.equal((await run(['copy-asset', '--deck-dir', path.join(root, 'deck'), '--src', img], { env })).output.rel, 'assets/그림.png');
  fs.mkdirSync(path.join(root, 'wiki'));
  assert.equal((await run(['knowledge-add', '--type', 'wiki', '--path', path.join(root, 'wiki')], { env })).output.knowledge.length, 1);
});

test('필수 옵션 누락, 알 수 없는 명령, 알 수 없는 옵션', async () => {
  const { env, hubPath } = ctx();
  await run(['init', '--path', hubPath], { env });
  assert.equal((await run(['track-add', '--type', 'project'], { env })).output.code, 'MISSING_ARG');
  assert.equal((await run(['fly'], { env })).output.code, 'UNKNOWN_COMMAND');
  assert.equal((await run(['status', '--nope', 'x'], { env })).output.code, 'BAD_ARGS');
});

test('실제 프로세스: JSON 출력과 종료 코드', () => {
  const { env, hubPath } = ctx();
  const p = spawnSync(process.execPath, [CLI, 'init', '--path', hubPath], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(JSON.parse(p.stdout).ok, true);
  const q = spawnSync(process.execPath, [CLI, 'set-date', '--track', '없음', '--date', '2026-10-06'], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(q.status, 1);
  assert.equal(JSON.parse(q.stdout).code, 'NO_TRACK');
});

test('last-log는 사이클 경계를 넘어 이전 사이클을 확인한다', async () => {
  const { env, hubPath, root } = ctx();
  await run(['init', '--path', hubPath], { env });
  await run(['track-add', '--name', '논문A', '--type', 'research'], { env });
  const entry = path.join(root, 'entry.md');
  fs.writeFileSync(entry, '- 한 일: x\n', 'utf8');
  await run(['log-append', '--track', '논문A', '--session', 's', '--file', entry], { env });
  const fb = path.join(root, 'fb.md');
  fs.writeFileSync(fb, '# 피드백\n', 'utf8');
  const c = await run(['feedback-close', '--track', '논문A', '--file', fb], { env });
  const last = await run(['last-log', '--track', '논문A', '--session', 's'], { env });
  assert.equal(last.output.last.sessionId, 's');
  assert.equal(last.output.lastCycle, c.output.closed);
  assert.equal(last.output.cycle, 'next');
  const none = await run(['last-log', '--track', '논문A', '--session', 'zzz'], { env });
  assert.equal(none.output.last, null);
  assert.equal(none.output.lastCycle, null);
});

test('상속된 이름은 알 수 없는 명령, 잘못된 --max-chars는 BAD_ARGS', async () => {
  const { env, hubPath, root } = ctx();
  for (const name of ['constructor', 'toString']) {
    const r = await run([name], { env });
    assert.equal(r.code, 1);
    assert.equal(r.output.code, 'UNKNOWN_COMMAND');
  }
  await run(['init', '--path', hubPath], { env });
  await run(['track-add', '--name', 'T', '--type', 'project', '--source', root], { env });
  for (const bad of ['abc', '0', '-5', '1.5']) {
    const r = await run(['transcripts', '--track', 'T', '--max-chars=' + bad], { env });
    assert.equal(r.output.code, 'BAD_ARGS', bad);
  }
});

test('실제 프로세스: 100KB가 넘는 JSON도 잘리지 않고 출력됨', () => {
  const { root, hubPath } = ctx();
  const tdir = path.join(root, 'transcripts');
  const env = { MEETING_PREP_CONFIG: path.join(root, 'config.json'), MEETING_PREP_TRANSCRIPTS_DIR: tdir };
  const spawn = args => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(spawn(['init', '--path', hubPath]).status, 0);
  const src = path.join(root, '프로젝트');
  assert.equal(spawn(['track-add', '--name', 'T', '--type', 'project', '--source', src]).status, 0);
  fs.mkdirSync(path.join(tdir, 'p'), { recursive: true });
  const lines = [];
  for (let i = 0; i < 150; i++) {
    const ts = new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString();
    lines.push(JSON.stringify({
      type: 'user', cwd: src, sessionId: 'big', timestamp: ts,
      message: { content: '가나다라마바사'.repeat(300) },
    }));
  }
  fs.writeFileSync(path.join(tdir, 'p', 'big.jsonl'), lines.join('\n') + '\n', 'utf8');
  const p = spawn(['transcripts', '--track', 'T', '--since', '2026-01-01', '--max-chars', '200000']);
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.equal(out.ok, true);
  assert.ok(out.digest.length > 100000, String(out.digest.length));
});
