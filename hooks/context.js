import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHubPath, resolveTrack, getCycles, findLastLog } from '../hub/lib.js';
import { checkNudge, nudgeMinutes, parseLogTimestamp } from '../hub/nudge.js';

export const CLI_PATH = fileURLToPath(new URL('../hub/cli.js', import.meta.url));
const TYPE_LABEL = { research: '연구', project: '프로젝트' };

function tracksFor(input, env) {
  const hubPath = getHubPath(env);
  if (!hubPath || !fs.existsSync(path.join(hubPath, 'hub.md'))) return null;
  const cwd = typeof input?.cwd === 'string' ? input.cwd : null;
  if (!cwd) return null;
  const tracks = resolveTrack(hubPath, cwd);
  return tracks.length ? { hubPath, tracks } : null;
}

function openTodoCount(cycleDir) {
  const file = path.join(cycleDir, 'log.md');
  if (!fs.existsSync(file)) return 0;
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const section = text.split(/^## 기록/m)[0];
  return (section.match(/^- \[ \] #\d+/gm) ?? []).length;
}

export function sessionStartContext(input, env = process.env) {
  const found = tracksFor(input, env);
  if (!found) return null;
  const sid = typeof input.session_id === 'string' && input.session_id ? input.session_id : '<세션 ID>';
  const lines = found.tracks.map(t => {
    const open = getCycles(t.dir).open;
    const cycle = open?.name ?? 'next';
    const todos = open ? openTodoCount(open.dir) : 0;
    return `[meeting-prep] 이 폴더는 '${t.name}' ${TYPE_LABEL[t.type] ?? t.type} 트랙이다 (현재 사이클: ${cycle}, 이번 사이클 할 일 ${todos}개).`;
  });
  return [
    ...lines,
    '- 실험·분석 결과가 나왔거나, 작업 하나가 끝났거나(커밋, 파일 완성, 버그 해결), 사용자가 마무리하는 말을 하면 답변 맨 끝에 한 줄로 기록을 제안한다:',
    '  "💾 여기까지 기록해둘까요? — <한 일 요약, 채팅에 실제로 나온 값만>"',
    '- 작업 도중(명령 실행 중, 질문에 답하는 중)에는 제안하지 않는다.',
    `- 제안했으면 \`node "${CLI_PATH}" nudge --session ${sid} --action shown\`을 실행한다. 사용자가 거절하면 \`--action declined\`, "나중에"라고 하면 \`--action later\`.`,
    '- 사용자가 "응"이라고 하면 meeting-prep:log 스킬로 바로 저장한다.',
  ].join('\n');
}

export function promptContext(input, env = process.env, now = new Date()) {
  const found = tracksFor(input, env);
  if (!found) return null;
  const sid = typeof input.session_id === 'string' && input.session_id ? input.session_id : null;
  if (!sid) return null;
  let lastLogAt = null;
  for (const t of found.tracks) {
    const { last } = findLastLog(t.dir, sid);
    const at = last ? parseLogTimestamp(last.timestamp) : null;
    if (at && (!lastLogAt || at > lastLogAt)) lastLogAt = at;
  }
  const r = checkNudge({ hubPath: found.hubPath, sessionId: sid, lastLogAt, now, minutes: nudgeMinutes(env) });
  if (!r.due) return null;
  return `[meeting-prep] 이 채팅에서 ${Math.floor(r.idleMinutes)}분 동안 기록이 없었다. 이번 답변이 결과가 나왔거나 작업이 끝난 시점이면 기록을 제안한다. 아니면 다음 적당한 순간에 제안한다.`;
}
