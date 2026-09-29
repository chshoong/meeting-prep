import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as hub from '../hub/lib.js';
import { recordNudge } from '../hub/nudge.js';
import { sessionStartContext, promptContext, CLI_PATH } from '../hooks/context.js';
import { tempDir } from './helpers.js';

const START = fileURLToPath(new URL('../hooks/session-start.js', import.meta.url));
const PROMPT = fileURLToPath(new URL('../hooks/prompt-submit.js', import.meta.url));

function setup() {
  const root = tempDir('훅');
  const env = { MEETING_PREP_CONFIG: path.join(root, 'config.json'), MEETING_HUB: path.join(root, '허브') };
  const { hubPath } = hub.ensureHub(env);
  const proj = path.join(root, 'KAMP 폴더');
  fs.mkdirSync(proj);
  const t = hub.addTrack(hubPath, { name: 'KAMP', type: 'project', sources: [proj] });
  hub.closeCycle(t.dir, '# 피드백\n\n## 할 일\n- [ ] #1 표 정리\n- [ ] #2 오류분석\n', { today: '2026-09-22' });
  return { root, env, hubPath, proj, t };
}

const T0 = new Date(2026, 8, 30, 9, 0);
const plus = (d, min) => new Date(d.getTime() + min * 60000);

test('세션 시작: 트랙 폴더면 안내(트랙, 사이클, 할 일 수, CLI 경로, 세션 ID)', () => {
  const { env, proj } = setup();
  const text = sessionStartContext({ session_id: 'abc', cwd: path.join(proj, 'src') }, env);
  assert.match(text, /'KAMP' 프로젝트 트랙/);
  assert.match(text, /현재 사이클: next/);
  assert.match(text, /이번 사이클 할 일 2개/);
  assert.ok(CLI_PATH.endsWith('cli.js'));
  assert.doesNotMatch(text, /nudge/);
  assert.match(text, /한 채팅에서 제안은 드물게 한다/);
  assert.match(text, /💾 여기까지 기록해둘까요\?/);
});

test('세션 시작: 트랙이 아닌 폴더, 허브 없음, cwd 없음 → null', () => {
  const { env, root } = setup();
  assert.equal(sessionStartContext({ session_id: 'a', cwd: root }, env), null);
  assert.equal(sessionStartContext({ session_id: 'a' }, env), null);
  const none = tempDir('허브 없음');
  assert.equal(sessionStartContext({ session_id: 'a', cwd: none }, { MEETING_PREP_CONFIG: path.join(none, 'c.json') }), null);
});

test('프롬프트: 첫 메시지는 조용, 90분 뒤 알림, 트랙 밖은 조용', () => {
  const { env, proj, root } = setup();
  const input = { session_id: 's1', cwd: proj, prompt: '다음 실험' };
  assert.equal(promptContext(input, env, T0), null);
  assert.equal(promptContext(input, env, plus(T0, 60)), null);
  assert.match(promptContext(input, env, plus(T0, 95)), /95분 동안 기록이 없었다/);
  assert.equal(promptContext({ ...input, cwd: root }, env, plus(T0, 200)), null);
});

test('프롬프트: 알림은 창당 한 번만 (훅이 shown을 직접 기록)', () => {
  const { env, proj } = setup();
  const input = { session_id: 's9', cwd: proj, prompt: 'x' };
  promptContext(input, env, T0);
  const r = promptContext(input, env, plus(T0, 95));
  assert.match(r, /95분 동안 기록이 없었다/);
  assert.match(r, /사용자가 거절하면 다시 묻지 않는다/);
  assert.equal(promptContext(input, env, plus(T0, 100)), null);
  assert.match(promptContext(input, env, plus(T0, 186)), /91분 동안/);
});

test('프롬프트: 방금 기록했으면 조용 (로그 시각이 기준)', () => {
  const { env, proj, t } = setup();
  const input = { session_id: 's2', cwd: proj, prompt: 'x' };
  promptContext(input, env, T0);
  hub.appendLog(t.dir, `${hub.formatLogHeading(plus(T0, 80), 's2')}\n- 한 일: 기록`);
  assert.equal(promptContext(input, env, plus(T0, 100)), null);
});

test('프롬프트: 거절하면 조용, nudgeMinutes 설정 반영', () => {
  const { env, proj, hubPath } = setup();
  hub.writeConfig({ nudgeMinutes: 30 }, env);
  const input = { session_id: 's3', cwd: proj, prompt: 'x' };
  promptContext(input, env, T0);
  assert.match(promptContext(input, env, plus(T0, 31)), /31분/);
  recordNudge(hubPath, 's3', 'declined', { now: plus(T0, 31), minutes: 30 });
  assert.equal(promptContext(input, env, plus(T0, 50)), null);
});

function snapshot(dir) {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push(p + '/'); walk(p); }
      else out.push(p + (e.name === 'log.md' ? '\n' +fs.readFileSync(p, 'utf8') : ''));
    }
  };
  walk(dir);
  return out.sort();
}

test('프롬프트: 읽기 전용 — 열린 사이클이 없어도 next/를 만들지 않음', () => {
  const { env, proj, t } = setup();
  fs.rmSync(path.join(t.dir, 'cycles', 'next'), { recursive: true, force: true });
  const before = snapshot(t.dir);
  const input = { session_id: 'ro', cwd: proj, prompt: 'x' };
  for (const m of [0, 50, 100, 200]) promptContext(input, env, plus(T0, m));
  assert.deepEqual(snapshot(t.dir), before);
  assert.ok(!fs.existsSync(path.join(t.dir, 'cycles', 'next')));
});

function runHook(script, stdin, env) {
  return spawnSync(process.execPath, [script], { input: stdin, encoding: 'utf8', env: { ...process.env, ...env } });
}

test('래퍼: 훅 JSON 출력과 종료 코드 0', () => {
  const { env, proj } = setup();
  const p = runHook(START, JSON.stringify({ session_id: 'w', cwd: proj, source: 'startup' }), env);
  assert.equal(p.status, 0);
  const out = JSON.parse(p.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /KAMP/);
  const q = runHook(PROMPT, JSON.stringify({ session_id: 'w', cwd: proj, prompt: 'x' }), env);
  assert.equal(q.status, 0);
  assert.equal(q.stdout, '');
});

test('래퍼: 깨진 입력과 허브 오류에도 종료 코드 0, 출력 없음', () => {
  const { env, t, proj } = setup();
  for (const script of [START, PROMPT]) {
    const p = runHook(script, '{ 깨짐', env);
    assert.equal(p.status, 0);
    assert.equal(p.stdout, '');
  }
  fs.writeFileSync(path.join(t.dir, 'track.md'), '---\nname: [깨짐\n---\n', 'utf8');
  for (const script of [START, PROMPT]) {
    const p = runHook(script, JSON.stringify({ session_id: 'z', cwd: proj }), env);
    assert.equal(p.status, 0);
    assert.equal(p.stdout, '');
  }
});

test('hooks.json: 두 이벤트가 래퍼를 가리킴', () => {
  const cfg = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../hooks/hooks.json', import.meta.url)), 'utf8'));
  const cmd = e => cfg.hooks[e][0].hooks[0].command;
  assert.match(cmd('SessionStart'), /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/session-start\.js/);
  assert.match(cmd('UserPromptSubmit'), /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/prompt-submit\.js/);
  assert.equal(cfg.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact');
});
