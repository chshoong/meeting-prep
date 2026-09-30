import { C, SIZE, FONT, niceScale, textWidth } from './style.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, d) => Number(v).toFixed(d);
const r2 = v => Math.round(v * 100) / 100;
const PAD = { l: 64, r: 20, t: 28, b: 44 };

export function chartScale(spec) {
  if (spec.type === 'scatter') return niceScale(Math.min(...spec.points.map(p => p.y)), Math.max(...spec.points.map(p => p.y)));
  const vals = spec.series.flatMap(s => s.values);
  const hi = Math.max(...vals);
  const ym = spec.yMin != null && spec.yMin < hi ? spec.yMin : null;
  const sc = niceScale(ym ?? Math.min(0, ...vals), hi);
  return ym == null ? sc : { ...sc, min: ym };
}

function text(x, y, t, { size = SIZE.axis, color = C.faint, anchor = 'middle', weight = 500 } = {}) {
  return `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" fill="#${color}" text-anchor="${anchor}" font-weight="${weight}">${esc(t)}</text>`;
}

function valueAxis(sc, x0, x1, toY, d) {
  let out = '';
  for (let v = sc.min; v <= sc.max + sc.step / 1e6; v += sc.step) {
    const y = toY(v);
    const zero = Math.abs(v) < sc.step / 1e6;
    out += `<line ${zero ? 'class="zero" ' : ''}x1="${r2(x0)}" y1="${r2(y)}" x2="${r2(x1)}" y2="${r2(y)}" stroke="#${zero ? 'C4CAD6' : C.soft}" stroke-width="1.5"/>`;
    out += text(x0 - 10, y + 5, num(v, d), { anchor: 'end' });
  }
  return out;
}

function tickDecimals(sc) {
  const s = String(sc.step);
  return s.includes('.') ? Math.min(4, s.split('.')[1].length) : 0;
}

export function chartSvg(spec, w, h) {
  let x0 = PAD.l;
  let cats = spec.categories;
  const sc = chartScale(spec);
  const td = tickDecimals(sc);
  let padR = PAD.r;
  if (spec.type === 'hbar' && spec.valueLabels) {
    const longest = Math.max(...spec.series.flatMap(s => s.values.map(v => textWidth(num(v, spec.decimals), SIZE.valueLabel, 700))));
    padR = PAD.r + longest + 12;
  }
  const x1 = w - padR;
  if (spec.type === 'hbar') {
    const want = Math.max(PAD.l, ...spec.categories.map(c => textWidth(c, 14, 700) + 16));
    const cap = Math.max(PAD.l, Math.min(want, x1 - w / 2));
    x0 = cap;
    if (want > cap) {
      cats = spec.categories.map(c => {
        if (textWidth(c, 14, 700) + 16 <= cap) return c;
        let t = Array.from(c);
        while (t.length > 1 && textWidth(t.join('') + '…', 14, 700) + 16 > cap) t.pop();
        return t.join('') + '…';
      });
    }
  }
  const y0 = PAD.t;
  const y1 = h - PAD.b;
  let body = '';

  if (spec.type === 'hbar') {
    const toX = v => x0 + ((v - sc.min) / (sc.max - sc.min)) * (x1 - x0);
    for (let v = sc.min; v <= sc.max + sc.step / 1e6; v += sc.step) {
      const x = toX(v);
      body += `<line x1="${r2(x)}" y1="${r2(y0)}" x2="${r2(x)}" y2="${r2(y1)}" stroke="#${C.soft}" stroke-width="1.5"/>` + text(x, y1 + 22, num(v, td));
    }
    const n = spec.categories.length;
    const band = (y1 - y0) / n;
    const bh = Math.min(28, (band * 0.7) / spec.series.length);
    cats.forEach((cat, i) => {
      const gy = y0 + band * i + (band - bh * spec.series.length) / 2;
      body += text(x0 - 10, y0 + band * i + band / 2 + 5, cat, { anchor: 'end', color: C.ink, weight: 700 });
      spec.series.forEach((s, k) => {
        const a = toX(Math.max(sc.min, Math.min(0, s.values[i])));
        const b = toX(Math.max(0, s.values[i]));
        const y = gy + k * bh;
        body += `<rect class="bar" x="${r2(a)}" y="${r2(y)}" width="${r2(Math.max(1, b - a))}" height="${r2(bh - 4)}" rx="5" fill="#${s.color}"/>`;
        if (spec.valueLabels) body += text(b + 8, y + bh / 2 + 3, num(s.values[i], spec.decimals), { anchor: 'start', color: s.color === C.baseline ? C.muted : s.color, weight: 700, size: SIZE.valueLabel });
      });
    });
  } else if (spec.type === 'scatter') {
    const xs = niceScale(Math.min(...spec.points.map(p => p.x)), Math.max(...spec.points.map(p => p.x)));
    const toX = v => x0 + ((v - xs.min) / (xs.max - xs.min)) * (x1 - x0);
    const toY = v => y1 - ((v - sc.min) / (sc.max - sc.min)) * (y1 - y0);
    body += valueAxis(sc, x0, x1, toY, td);
    const xd = tickDecimals(xs);
    for (let v = xs.min; v <= xs.max + xs.step / 1e6; v += xs.step) body += text(toX(v), y1 + 22, num(v, xd));
    for (const p of spec.points.filter(q => !q.hi)) body += `<circle class="pt" cx="${r2(toX(p.x))}" cy="${r2(toY(p.y))}" r="6" fill="#${C.baseline}"/>`;
    for (const p of spec.points.filter(q => q.hi)) {
      body += `<circle class="pt hi" cx="${r2(toX(p.x))}" cy="${r2(toY(p.y))}" r="8" fill="#${C.accent}"/>`;
      if (spec.highlightLabel) body += text(toX(p.x), toY(p.y) - 14, spec.highlightLabel, { color: C.accent, weight: 700, size: SIZE.valueLabel });
    }
  } else {
    const toY = v => y1 - ((v - sc.min) / (sc.max - sc.min)) * (y1 - y0);
    body += valueAxis(sc, x0, x1, toY, td);
    const n = spec.categories.length;
    const band = (x1 - x0) / n;
    spec.categories.forEach((cat, i) => { body += text(x0 + band * i + band / 2, y1 + 26, cat, { color: C.ink, weight: 700, size: 16 }); });
    if (spec.type === 'bar') {
      const bw = Math.min(90, (band * 0.72) / spec.series.length);
      spec.categories.forEach((_, i) => {
        const gx = x0 + band * i + (band - bw * spec.series.length) / 2;
        spec.series.forEach((s, k) => {
          const v = s.values[i];
          const top = toY(Math.max(v, 0));
          const bot = toY(Math.min(v, 0));
          const x = gx + k * bw;
          body += `<rect class="bar" x="${r2(x + 4)}" y="${r2(top)}" width="${r2(bw - 8)}" height="${r2(Math.max(1, bot - top))}" rx="6" fill="#${s.color}"/>`;
          if (spec.valueLabels) body += text(x + bw / 2, v >= 0 ? top - 8 : bot + 18, num(v, spec.decimals), { color: s.color === C.baseline ? C.muted : s.color, weight: 700, size: spec.valueLabelSize ?? SIZE.valueLabel });
        });
      });
    } else {
      spec.series.forEach(s => {
        const pts = s.values.map((v, i) => [x0 + band * i + band / 2, toY(v)]);
        body += `<polyline points="${pts.map(p => p.map(r2).join(',')).join(' ')}" fill="none" stroke="#${s.color}" stroke-width="3" stroke-linejoin="round"/>`;
        pts.forEach(([x, y], i) => {
          body += `<circle class="pt" cx="${r2(x)}" cy="${r2(y)}" r="5" fill="#${s.color}"/>`;
          if (spec.valueLabels) body += text(x, y - 12, num(s.values[i], spec.decimals), { color: s.color, weight: 700, size: SIZE.valueLabel });
        });
      });
    }
  }

  const axes = (spec.yLabel ? `<text x="14" y="${r2((y0 + y1) / 2)}" font-size="${SIZE.axis}" fill="#${C.muted}" text-anchor="middle" transform="rotate(-90 14 ${r2((y0 + y1) / 2)})">${esc(spec.yLabel)}</text>` : '')
    + (spec.xLabel ? text((x0 + x1) / 2, h - 4, spec.xLabel, { color: C.muted }) : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="'${FONT.face}','${FONT.fallback}',sans-serif">${body}${axes}</svg>`;
}
