// 브라우저 실행기와 Node가 같은 코드를 쓴다.
// makeCalc 안의 코드는 바깥 이름을 참조하면 안 된다 (페이지에 toString()으로 넣는다).
export function makeCalc() {
  const AGGS = ['mean', 'median', 'min', 'max', 'sum', 'count', 'sd'];

  function summarize(values) {
    const v = values.filter(x => typeof x === 'number' && Number.isFinite(x));
    const n = v.length;
    if (!n) return { n: 0, mean: null, median: null, sd: null, min: null, max: null, sum: 0, count: 0 };
    const sum = v.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const s = v.slice().sort((a, b) => a - b);
    const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const sd = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - mean) * (x - mean), 0) / (n - 1)) : 0;
    return { n, mean, median, sd, min: s[0], max: s[n - 1], sum, count: n };
  }

  function agg(values, how) {
    const s = summarize(values);
    return how === 'count' ? s.count : s[how];
  }

  function matches(row, cond) {
    if (!cond) return true;
    for (const k of Object.keys(cond)) {
      const want = cond[k];
      if (want === '*' || want == null) continue;
      const list = Array.isArray(want) ? want.map(String) : [String(want)];
      if (!list.includes(String(row[k]))) return false;
    }
    return true;
  }

  const where = (rows, cond) => rows.filter(r => matches(r, cond));

  function uniq(rows, key) {
    const seen = [];
    for (const r of rows) {
      const v = String(r[key]);
      if (!seen.includes(v)) seen.push(v);
    }
    return seen;
  }

  const labelOf = (meta, k) => (meta && meta[k] && meta[k].label) || k;
  const list = v => (Array.isArray(v) ? v : [v]);

  function seriesFrom(rows, from, meta) {
    const rs = where(rows, from.where);
    const how = from.agg || 'mean';
    const ys = list(from.y);
    const categories = uniq(rs, from.x);
    const groups = from.by ? uniq(rs, from.by) : [null];
    const series = [];
    for (const y of ys) {
      for (const g of groups) {
        const name = g == null ? labelOf(meta, y) : ys.length > 1 ? `${g} · ${labelOf(meta, y)}` : g;
        const values = categories.map(c => {
          const sub = rs.filter(r => String(r[from.x]) === c && (g == null || String(r[from.by]) === g));
          return sub.length ? agg(sub.map(r => r[y]), how) : null;
        });
        series.push({ name, values });
      }
    }
    return { categories, series };
  }

  function pointsFrom(rows, from) {
    const rs = where(rows, from.where);
    const y = list(from.y)[0];
    return rs.map(r => ({ x: r[from.x], y: r[y], hi: from.highlight ? matches(r, from.highlight) : false }));
  }

  function fmt(v, d) {
    return v == null ? '–' : Number(v).toFixed(d == null ? 2 : d);
  }

  function tableFrom(rows, from, meta) {
    const rs = where(rows, from.where);
    const ys = list(from.y);
    const keys = [from.x, from.by].filter(Boolean);
    const show = from.show || [from.agg || 'mean'];
    const combos = [];
    for (const r of rs) {
      const k = keys.map(c => String(r[c]));
      if (!combos.some(x => x.join('\u0000') === k.join('\u0000'))) combos.push(k);
    }
    const columns = [
      ...keys.map(k => labelOf(meta, k)),
      ...ys.flatMap(y => show.map(s => (show.length > 1 ? `${labelOf(meta, y)} (${s})` : labelOf(meta, y)))),
    ];
    const raw = combos.map(k => {
      const sub = rs.filter(r => keys.every((c, i) => String(r[c]) === k[i]));
      return [...k, ...ys.flatMap(y => show.map(s => agg(sub.map(r => r[y]), s)))];
    });
    const out = raw.map(r => r.map((v, i) => {
      if (i < keys.length) return v;
      const y = ys[Math.floor((i - keys.length) / show.length)];
      const d = meta && meta[y] && meta[y].decimals != null ? meta[y].decimals : 2;
      return fmt(v, d);
    }));
    return { columns, rows: out, raw };
  }

  function compareSides(rows, a, b, metrics, meta) {
    const ra = where(rows, a);
    const rb = where(rows, b);
    return metrics.map(m => {
      const sa = summarize(ra.map(r => r[m]));
      const sb = summarize(rb.map(r => r[m]));
      const diff = sa.mean == null || sb.mean == null ? null : sa.mean - sb.mean;
      const better = (meta && meta[m] && meta[m].better) || 'up';
      const winner = diff == null || diff === 0 ? null : (diff > 0) === (better === 'up') ? 'a' : 'b';
      return {
        metric: m, label: labelOf(meta, m), decimals: meta && meta[m] && meta[m].decimals != null ? meta[m].decimals : 2,
        a: { mean: sa.mean, sd: sa.sd, n: sa.n }, b: { mean: sb.mean, sd: sb.sd, n: sb.n }, diff, winner,
      };
    });
  }

  function specFromData(base, from, rows, meta, colorsFn) {
    if (base.type === 'scatter') {
      return { ...base, categories: [], series: [], points: pointsFrom(rows, from),
        pointName: from.pointName || '구성', highlightLabel: (from.highlight && from.highlightLabel) || '' };
    }
    const { categories, series } = seriesFrom(rows, from, meta);
    const colors = colorsFn(series.map(s => s.name));
    return { ...base, categories, series: series.map((s, k) => ({ ...s, color: colors[k] })), points: [], pointName: '', highlightLabel: '' };
  }

  return { AGGS, summarize, agg, matches, where, uniq, seriesFrom, pointsFrom, tableFrom, compareSides, specFromData, fmt };
}

export const calc = makeCalc();
