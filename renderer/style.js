// 슬라이드 디자인의 유일한 기준. 좌표는 1280×720px, 색은 # 없는 hex.
export const W = 1280;
export const H = 720;
export const PX_PER_IN = 96;
export const FONT = { face: 'Pretendard', fallback: 'Malgun Gothic' };

export const C = {
  bg: 'F5F7FB', ink: '1B2233', text2: '2B3346', muted: '6B7488', faint: '8B94A8',
  line: 'E1E6F0', soft: 'EEF1F6', white: 'FFFFFF',
  primary: '4F6BED', accent: '5B45D6', pink: 'E0457B', violet: '7B5BE6', orange: 'F08A3C', green: '2BA471',
  baseline: 'C9D2FA', tint: 'EEF1FD', arrow: 'A0A8BA', up: '1E9E62', down: 'D23A4F', warn: 'BC4C00',
};

export const STATUS = {
  done: { label: '완료', bg: 'E3F5EC', fg: '1E9E62' },
  doing: { label: '진행 중', bg: 'FFF3E3', fg: 'C46A12' },
  todo: { label: '미착수', bg: 'FDECEE', fg: 'D23A4F' },
};

export const SERIES = [C.primary, C.violet, C.orange, C.green];

export const SIZE = {
  coverTitle: 60, kicker: 17, question: 21, meta: 19,
  sectionNum: 120, sectionTitle: 52,
  title: 44, sub: 19, crumb: 24, brand: 15, page: 15, take: 23,
  cardTitle: 20, body: 18, chip: 18, caption: 15, note: 17,
  kpiLabel: 15, kpiValue: 40, statValue: 52, kpiDelta: 16,
  table: 19, tableHead: 15, pill: 15, axis: 14, legend: 15, valueLabel: 15,
};

export const FRAME = {
  margin: 56, topBar: 8, bottomBar: 6, crumbY: 36, ruleY: 88,
  titleY: 116, titleH: 60, subY: 182, subH: 30,
  bodyTop: 240, bodyBottom: 660, takeH: 64, takeBottom: 52, takeGap: 20,
  radius: 16, takeRadius: 14, gap: 24,
};

const BASELINE_RE = /^(baseline|베이스라인|기존|기준)/i;

export function seriesColors(names) {
  let k = 0;
  return names.map(n => (BASELINE_RE.test(String(n).trim()) ? C.baseline : SERIES[k++ % SERIES.length]));
}

export function colorOf(name, fallback) {
  if (typeof name !== 'string' || !name) return fallback;
  if (Object.hasOwn(C, name)) return C[name];
  const m = name.match(/^#?([0-9a-fA-F]{6})$/);
  return m ? m[1].toUpperCase() : fallback;
}

const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]/;

// 글꼴 측정 없이 어림한 글자 폭(px). 한글 1em, 공백 0.3em, 그 외 0.56em. 굵으면 5% 넓게.
export function textWidth(text, size, weight = 400) {
  let units = 0;
  for (const ch of String(text)) units += WIDE.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56;
  return units * size * (weight >= 700 ? 1.05 : 1);
}

export function wrapLines(text, width, size, weight = 400) {
  return Math.max(1, Math.ceil(textWidth(text, size, weight) / Math.max(1, width)));
}

export function fitContain(box, iw, ih) {
  const s = Math.min(box.w / iw, box.h / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const round = v => Number(v.toPrecision(12));

export function niceScale(min, max, ticks = 4) {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (hi === lo) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.5;
    lo -= lo === 0 ? 0 : pad;
    hi += pad;
  }
  const raw = (hi - lo) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = round([1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12));
  return { min: round(Math.floor(lo / step + 1e-9) * step), max: round(Math.ceil(hi / step - 1e-9) * step), step };
}
