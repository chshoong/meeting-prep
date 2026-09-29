// 두 렌더러(PPTX, HTML)가 공유하는 유일한 레이아웃 정의. 단위: 인치, 글자 pt.
export const SLIDE = { w: 13.333, h: 7.5 };
export const FONT = { face: 'Pretendard', fallback: 'Malgun Gothic' };
export const COLOR = {
  text: '1F2328', muted: '57606A', accent: '2F5BEA', rule: 'D0D7DE', panel: 'F6F8FA',
  done: '1A7F37', doing: '9A6700', todo: 'CF222E', warn: 'BC4C00',
};
export const SIZE = { coverTitle: 40, coverSub: 22, coverMeta: 16, title: 28, body: 18, caption: 13, table: 14, label: 18 };
export const BOX = {
  coverTitle: { x: 0.8, y: 2.3, w: 11.73, h: 1.5 },
  coverSub: { x: 0.8, y: 3.9, w: 11.73, h: 0.8 },
  coverMeta: { x: 0.8, y: 5.8, w: 11.73, h: 0.6 },
  title: { x: 0.6, y: 0.4, w: 12.13, h: 0.9 },
  body: { x: 0.6, y: 1.5, w: 12.13, h: 5.6 },
  figure: { x: 0.6, y: 1.5, w: 12.13, h: 4.9 },
  caption: { x: 0.6, y: 6.5, w: 12.13, h: 0.6 },
  left: { x: 0.6, y: 1.5, w: 5.9, h: 5.6 },
  right: { x: 6.83, y: 1.5, w: 5.9, h: 5.6 },
  colLabel: 0.6,
};
export const STATUS_MARK = { done: '✅', doing: '🔄', todo: '❌' };
export const STATUS_COLOR = { done: COLOR.done, doing: COLOR.doing, todo: COLOR.todo };

export function fitContain(box, imgW, imgH) {
  const scale = Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const WIDE = /[ᄀ-ᇿ⺀-鿿가-힯＀-￯]/;

// 한글·한자는 1em, 그 외는 0.55em으로 어림잡은 줄 수
export function estimateLines(items, box, pt) {
  const em = pt / 72;
  let lines = 0;
  for (const it of items) {
    const width = box.w - 0.4 - it.level * 0.4;
    let units = 0;
    for (const ch of it.text) units += WIDE.test(ch) ? 1 : 0.55;
    lines += Math.max(1, Math.ceil((units * em) / width));
  }
  return lines;
}

export function capacityLines(box, pt, lineSpacing = 1.4) {
  return Math.floor(box.h / ((pt / 72) * lineSpacing) + 1e-9); // 부동소수점 오차로 16이 15가 되지 않게
}

export function overflows(items, box, pt) {
  return estimateLines(items, box, pt) > capacityLines(box, pt);
}
