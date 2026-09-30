import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, decodeText } from './chart-data.js';

function loadOne(name, d, baseDir) {
  if (!d || !d.file) throw new Error('file이 필요해요');
  const file = path.resolve(baseDir, String(d.file));
  if (!fs.existsSync(file)) throw new Error(`CSV 파일을 찾을 수 없어요: ${d.file}`);
  const { header, rows } = parseCsv(decodeText(fs.readFileSync(file)));
  const dims = Array.isArray(d.dims) ? d.dims.map(String) : [];
  const metrics = d.metrics && typeof d.metrics === 'object' ? d.metrics : {};
  const metricNames = Object.keys(metrics);
  for (const c of [...dims, ...metricNames]) {
    if (!header.includes(c)) throw new Error(`'${c}' 열이 없어요. 있는 열: ${header.join(', ')}`);
  }
  const meta = {};
  for (const m of metricNames) {
    const v = metrics[m] ?? {};
    meta[m] = {
      label: String(v.label ?? m),
      decimals: Number.isInteger(v.decimals) ? v.decimals : 2,
      better: v.better === 'down' ? 'down' : 'up',
      unit: v.unit ? String(v.unit) : '',
    };
  }
  for (const c of dims) meta[c] = { label: String(d.labels?.[c] ?? c) };
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = rows.map((r, i) => {
    const o = {};
    for (const c of dims) o[c] = String(r[idx[c]] ?? '').trim();
    for (const m of metricNames) {
      const s = String(r[idx[m]] ?? '').trim();
      const n = Number(s);
      if (s === '' || !Number.isFinite(n)) throw new Error(`'${m}' 열의 ${i + 1}번째 값이 숫자가 아니에요: ${r[idx[m]] ?? ''}`);
      o[m] = n;
    }
    return o;
  });
  const levels = Object.fromEntries(dims.map(c => [c, [...new Set(out.map(o => o[c]))]]));
  return { name, dims, metrics: metricNames, meta, levels, rows: out };
}

export function loadDatasets(raw, baseDir) {
  const datasets = {};
  const errors = [];
  for (const [name, d] of Object.entries(raw ?? {})) {
    try {
      datasets[name] = loadOne(name, d, baseDir);
    } catch (e) {
      errors.push({ dataset: name, message: `데이터셋 '${name}': ${e.message}` });
    }
  }
  return { datasets, errors };
}
