#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as hub from './lib.js';
import { readTranscripts, transcriptsRoot } from './transcripts.js';
import { recordNudge, nudgeMinutes } from './nudge.js';

const OPTIONS = {
  path: { type: 'string' }, type: { type: 'string' }, name: { type: 'string' },
  source: { type: 'string', multiple: true }, description: { type: 'string' },
  cwd: { type: 'string' }, track: { type: 'string' }, date: { type: 'string' },
  session: { type: 'string' }, file: { type: 'string' }, slug: { type: 'string' },
  'deck-dir': { type: 'string' }, src: { type: 'string' }, action: { type: 'string' },
  since: { type: 'string' }, exclude: { type: 'string' }, 'max-chars': { type: 'string' },
};

function need(v, ...keys) {
  for (const k of keys) {
    if (v[k] == null || v[k] === '') throw new hub.HubError('MISSING_ARG', `--${k} 옵션이 필요합니다`);
  }
}

function readInput(file, cwd) {
  const raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(cwd, file), 'utf8');
  return raw.replace(/^\uFEFF/, '');
}

const COMMANDS = {
  init: (v, c) => hub.initHub(v.path != null ? path.resolve(c.cwd, v.path) : (hub.getHubPath(c.env) ?? hub.defaultHubPath()), c.env),
  status: (v, c) => hub.status(hub.requireHub(c.env), v.track),
  'knowledge-add': (v, c) => {
    need(v, 'type', 'path');
    return { knowledge: hub.addKnowledge(hub.requireHub(c.env), { type: v.type, path: path.resolve(c.cwd, v.path) }) };
  },
  'track-add': (v, c) => {
    need(v, 'name', 'type');
    return hub.addTrack(hub.requireHub(c.env), {
      name: v.name, type: v.type, description: v.description ?? '',
      sources: (v.source ?? []).map(s => path.resolve(c.cwd, s)),
    });
  },
  'resolve-track': (v, c) => ({ matches: hub.resolveTrack(hub.requireHub(c.env), path.resolve(c.cwd, v.cwd ?? '.')) }),
  'set-date': (v, c) => {
    need(v, 'track', 'date');
    return hub.setCycleDate(hub.findTrack(hub.requireHub(c.env), v.track).dir, v.date);
  },
  'last-log': (v, c) => {
    need(v, 'track', 'session');
    return hub.findLastLog(hub.findTrack(hub.requireHub(c.env), v.track).dir, v.session);
  },
  'log-append': (v, c) => {
    need(v, 'track', 'session', 'file');
    const t = hub.findTrack(hub.requireHub(c.env), v.track);
    const body = readInput(v.file, c.cwd).trim();
    return hub.appendLog(t.dir, `${hub.formatLogHeading(new Date(), v.session)}\n${body}`);
  },
  ensure: (v, c) => {
    const r = hub.ensureHub(c.env);
    return { ...r, tracks: hub.resolveTrack(r.hubPath, path.resolve(c.cwd, v.cwd ?? '.')) };
  },
  'source-add': (v, c) => {
    need(v, 'track', 'path');
    return hub.addSource(hub.requireHub(c.env), v.track, path.resolve(c.cwd, v.path));
  },
  'hub-move': (v, c) => {
    need(v, 'path');
    return hub.moveHub(hub.requireHub(c.env), path.resolve(c.cwd, v.path), c.env);
  },
  nudge: (v, c) => {
    need(v, 'session', 'action');
    return recordNudge(hub.requireHub(c.env), v.session, v.action, { minutes: nudgeMinutes(c.env) });
  },
  'log-amend': (v, c) => {
    need(v, 'track', 'session', 'file');
    const t = hub.findTrack(hub.requireHub(c.env), v.track);
    return hub.amendLastLog(t.dir, v.session, readInput(v.file, c.cwd));
  },
  'feedback-close': (v, c) => {
    need(v, 'track', 'file');
    const t = hub.findTrack(hub.requireHub(c.env), v.track);
    return hub.closeCycle(t.dir, readInput(v.file, c.cwd), v.date ? { today: v.date } : {});
  },
  'library-list': (v, c) => ({ notes: hub.listLibrary(hub.requireHub(c.env)) }),
  'library-add': (v, c) => {
    need(v, 'slug', 'file');
    return hub.addLibraryNote(hub.requireHub(c.env), v.slug, readInput(v.file, c.cwd));
  },
  'copy-asset': (v, c) => {
    need(v, 'deck-dir', 'src');
    return hub.copyAsset(path.resolve(c.cwd, v['deck-dir']), path.resolve(c.cwd, v.src));
  },
  transcripts: (v, c) => {
    need(v, 'track');
    if (v['max-chars'] != null && !/^[1-9]\d*$/.test(v['max-chars'])) {
      throw new hub.HubError('BAD_ARGS', '--max-chars 는 양의 정수여야 합니다');
    }
    const t = hub.findTrack(hub.requireHub(c.env), v.track);
    const { previous } = hub.getCycles(t.dir);
    const since = v.since ?? (previous ? previous.name.slice(0, 10) : hub.localDate(new Date(Date.now() - 14 * 864e5)));
    const r = readTranscripts({
      root: transcriptsRoot(c.env), since, paths: t.sources, excludeSession: v.exclude ?? null,
      maxChars: v['max-chars'] ? Number(v['max-chars']) : 20000,
    });
    return { since, ...r };
  },
};

export async function run(argv, { env = process.env, cwd = process.cwd() } = {}) {
  const [command, ...rest] = argv;
  const fn = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
  if (!fn) {
    return { code: 1, output: { ok: false, code: 'UNKNOWN_COMMAND', error: `알 수 없는 명령입니다: ${command ?? '(없음)'}. 가능한 명령: ${Object.keys(COMMANDS).join(', ')}` } };
  }
  let values;
  try {
    ({ values } = parseArgs({ args: rest, options: OPTIONS, strict: true }));
  } catch (e) {
    return { code: 1, output: { ok: false, code: 'BAD_ARGS', error: e?.message ?? String(e) } };
  }
  try {
    const result = await fn(values, { env, cwd });
    return { code: 0, output: { ...result, ok: true } };
  } catch (e) {
    return { code: 1, output: { ok: false, code: e?.code ?? 'ERROR', error: e?.message ?? String(e) } };
  }
}

const real = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const isMain = process.argv[1] && same(real(process.argv[1]), real(fileURLToPath(import.meta.url)));
if (isMain) {
  const { code, output } = await run(process.argv.slice(2));
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exitCode = code;
}
