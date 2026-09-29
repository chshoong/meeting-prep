import fs from 'node:fs';
import path from 'node:path';
import { HubError, readConfig } from './lib.js';

const ACTIONS = ['shown', 'declined', 'later'];
const KEEP_MS = 30 * 24 * 60 * 60000;
const LATER_MIN = 20;

export function nudgeFile(hubPath) {
  return path.join(hubPath, '.state', 'nudges.json');
}

export function readNudges(hubPath) {
  try {
    const s = JSON.parse(fs.readFileSync(nudgeFile(hubPath), 'utf8'));
    if (s && typeof s.sessions === 'object' && s.sessions && !Array.isArray(s.sessions)) {
      // 깨진 항목(null, 배열 등)은 제거
      const cleaned = { sessions: {} };
      for (const [id, e] of Object.entries(s.sessions)) {
        if (e && typeof e === 'object' && !Array.isArray(e)) {
          cleaned.sessions[id] = e;
        }
      }
      return cleaned;
    }
  } catch {
    // 없거나 깨짐
  }
  return { sessions: {} };
}

function writeNudges(hubPath, state, now) {
  for (const [id, e] of Object.entries(state.sessions)) {
    const times = [e.firstSeen, e.lastNudge].filter(Boolean).map(Date.parse).filter(Number.isFinite);
    if (!times.length || now.getTime() - Math.max(...times) > KEEP_MS) delete state.sessions[id];
  }
  const file = nudgeFile(hubPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}

export function nudgeMinutes(env = process.env) {
  const n = Number(readConfig(env).nudgeMinutes);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function parseLogTimestamp(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

function entryFor(state, sessionId, now) {
  if (!Object.hasOwn(state.sessions, sessionId)) state.sessions[sessionId] = { firstSeen: now.toISOString(), lastNudge: null, snoozeUntil: null };
  return state.sessions[sessionId];
}

export function recordNudge(hubPath, sessionId, action, { now = new Date(), minutes = 90 } = {}) {
  if (!ACTIONS.includes(action)) throw new HubError('BAD_ARGS', `--action 은 ${ACTIONS.join(', ')} 중 하나여야 합니다`);
  const state = readNudges(hubPath);
  const e = entryFor(state, sessionId, now);
  if (action === 'shown') {
    e.lastNudge = now.toISOString();
    e.snoozeUntil = null;
  } else if (action === 'declined') {
    e.lastNudge = now.toISOString();
    e.snoozeUntil = new Date(now.getTime() + minutes * 60000).toISOString();
  } else {
    e.lastNudge = new Date(now.getTime() - Math.max(0, minutes - LATER_MIN) * 60000).toISOString();
    e.snoozeUntil = null;
  }
  writeNudges(hubPath, state, now);
  return e;
}

export function checkNudge({ hubPath, sessionId, lastLogAt = null, now = new Date(), minutes = 90 }) {
  const state = readNudges(hubPath);
  if (!Object.hasOwn(state.sessions, sessionId)) {
    entryFor(state, sessionId, now);
    writeNudges(hubPath, state, now);
    return { due: false, idleMinutes: 0, isNew: true };
  }
  const e = state.sessions[sessionId];
  // 제안한 적이 있으면 그 시각, 없으면 처음 본 시각이 기준 ('later'는 lastNudge를 과거로 당겨 둔다)
  // lastNudge가 파싱 불가능하면 firstSeen을 사용
  const lastNudgeTime = e.lastNudge && Number.isFinite(Date.parse(e.lastNudge)) ? Date.parse(e.lastNudge) : null;
  const times = [lastNudgeTime ?? Date.parse(e.firstSeen)].filter(Number.isFinite);
  if (lastLogAt) times.push(lastLogAt.getTime());
  const base = times.length ? Math.max(...times) : now.getTime();
  const idleMinutes = (now.getTime() - base) / 60000;
  const snoozed = e.snoozeUntil && now.getTime() < Date.parse(e.snoozeUntil);
  return { due: idleMinutes >= minutes && !snoozed, idleMinutes, isNew: false };
}
