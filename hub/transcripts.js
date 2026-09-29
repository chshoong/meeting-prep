import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isInside } from './lib.js';

export function transcriptsRoot(env = process.env) {
  return env.MEETING_PREP_TRANSCRIPTS_DIR ?? path.join(os.homedir(), '.claude', 'projects');
}

export function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n');
}

const clean = t => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();

function listDirs(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(root, d.name));
  } catch {
    return null;
  }
}

export function readTranscripts({ root = transcriptsRoot(), since, paths = [], excludeSession = null, maxChars = 60000 } = {}) {
  const empty = { sessions: [], digest: '', truncated: false, skippedFiles: 0 };
  paths = Array.isArray(paths) ? paths.filter(p => typeof p === 'string' && p) : [];
  const dirs = listDirs(root);
  if (!dirs || !paths.length) return empty;
  const sinceMs = since ? Date.parse(since) : 0;
  const sessions = new Map();
  let skippedFiles = 0;

  for (const dir of dirs) {
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')); } catch { skippedFiles++; continue; }
    for (const f of files) {
      const fp = path.join(dir, f);
      let text;
      try {
        if (sinceMs && fs.statSync(fp).mtimeMs < sinceMs) continue;
        text = fs.readFileSync(fp, 'utf8');
      } catch {
        skippedFiles++;
        continue;
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (!o || typeof o !== 'object') continue;
        if (o.type !== 'user' && o.type !== 'assistant') continue;
        if (typeof o.cwd !== 'string' || !o.cwd || typeof o.sessionId !== 'string' || !o.sessionId) continue;
        if (typeof o.timestamp !== 'string' || Number.isNaN(Date.parse(o.timestamp))) continue;
        if (o.isMeta || o.isSidechain) continue;
        if (excludeSession && o.sessionId === excludeSession) continue;
        if (Date.parse(o.timestamp) < sinceMs) continue;
        if (!paths.some(p => isInside(o.cwd, p))) continue;
        const t = clean(extractText(o.message?.content));
        if (!t) continue;
        if (!sessions.has(o.sessionId)) sessions.set(o.sessionId, { sessionId: o.sessionId, cwd: o.cwd, messages: [] });
        sessions.get(o.sessionId).messages.push({ role: o.type, ts: String(o.timestamp), text: t });
      }
    }
  }

  const list = [...sessions.values()]
    .map(s => ({ ...s, messages: s.messages.sort((a, b) => a.ts.localeCompare(b.ts)) }))
    .sort((a, b) => a.messages[0].ts.localeCompare(b.messages[0].ts));

  let digest = '';
  let truncated = false;
  outer: for (const s of list) {
    const head = `### session ${s.sessionId} (${s.cwd})\n`;
    if (digest.length + head.length > maxChars) { truncated = true; break; }
    digest += head;
    for (const m of s.messages) {
      const body = m.text.length > 2000 ? `${m.text.slice(0, 2000)} …` : m.text;
      const line = `[${m.ts.slice(0, 16).replace('T', ' ')}] ${m.role === 'user' ? '사용자' : 'Claude'}: ${body}\n`;
      if (digest.length + line.length > maxChars) { truncated = true; break outer; }
      digest += line;
    }
    digest += '\n';
  }
  return {
    sessions: list.map(s => ({ sessionId: s.sessionId, cwd: s.cwd, count: s.messages.length })),
    digest: digest.trim(),
    truncated,
    skippedFiles,
  };
}
