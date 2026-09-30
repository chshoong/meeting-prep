import PptxGenJS from 'pptxgenjs';
import { PX_PER_IN, FONT, C } from './style.js';
import { chartScale } from './chart-svg.js';

const inch = v => v / PX_PER_IN;
const pt = px => px * 0.75;
const pos = e => ({ x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h) });

function textObjects(e) {
  const out = [];
  e.paras.forEach((p, i) => {
    const last = i === e.paras.length - 1;
    p.runs.forEach((r, k) => {
      out.push({
        text: r.text,
        options: {
          bold: Boolean(r.bold) || e.weight >= 700,
          color: r.color ?? e.color,
          fontSize: pt(e.size),
          fontFace: FONT.face,
          ...(p.bullet && k === 0 ? { bullet: { indent: 18 }, indentLevel: p.level ?? 0 } : {}),
          paraSpaceAfter: last ? 0 : pt(e.paraSpace ?? 0),
          breakLine: !last && k === p.runs.length - 1,
        },
      });
    });
  });
  return out;
}

const PAINT = {
  rect(pres, s, e) {
    s.addShape(e.radius ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
      ...pos(e),
      fill: { color: e.fill, transparency: e.alpha != null ? Math.round((1 - e.alpha) * 100) : 0 },
      line: e.stroke ? { color: e.stroke, width: pt(e.strokeW ?? 1), dashType: e.dash ? 'dash' : 'solid' } : { type: 'none' },
      ...(e.radius ? { rectRadius: inch(e.radius) } : {}),
    });
  },
  circle(pres, s, e) {
    s.addShape(pres.ShapeType.ellipse, {
      x: inch(e.x), y: inch(e.y), w: inch(e.d), h: inch(e.d),
      fill: { color: e.fill, transparency: e.alpha != null ? Math.round((1 - e.alpha) * 100) : 0 }, line: { type: 'none' },
    });
  },
  tri(pres, s, e) {
    // 위를 향한 이등변삼각형을 90° 돌려 오른쪽을 향하게 한다. 회전은 중심 기준이라 폭·높이를 바꿔 넣는다.
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    s.addShape(pres.ShapeType.triangle, { x: inch(cx - e.h / 2), y: inch(cy - e.w / 2), w: inch(e.h), h: inch(e.w), rotate: 90, fill: { color: e.fill }, line: { type: 'none' } });
  },
  line(pres, s, e) {
    s.addShape(pres.ShapeType.line, {
      x: inch(Math.min(e.x1, e.x2)), y: inch(Math.min(e.y1, e.y2)),
      w: inch(Math.max(0.01, Math.abs(e.x2 - e.x1))), h: inch(Math.abs(e.y2 - e.y1)),
      flipV: (e.y2 - e.y1) * (e.x2 - e.x1) < 0,
      line: { color: e.color, width: pt(e.width) },
    });
  },
  arrow(pres, s, e) {
    s.addShape(pres.ShapeType.line, { x: inch(e.x), y: inch(e.y + e.h / 2), w: inch(e.w), h: 0, line: { color: e.color, width: 3, endArrowType: 'triangle' } });
  },
  text(pres, s, e) {
    s.addText(textObjects(e), { ...pos(e), margin: 0, align: e.align ?? 'left', valign: e.valign, lineSpacingMultiple: e.lineHeight, fontFace: FONT.face, color: e.color });
  },
  image(pres, s, e) {
    s.addImage({ data: `${e.img.mime};base64,${e.img.data.toString('base64')}`, ...pos(e) });
  },
  pill(pres, s, e) {
    s.addText(e.text, {
      ...pos(e), shape: pres.ShapeType.roundRect, rectRadius: inch(e.h / 2), fill: { color: e.fill }, line: { type: 'none' },
      color: e.color, bold: true, fontSize: pt(e.size), fontFace: FONT.face, align: 'center', valign: 'middle', margin: 0,
    });
  },
  table(pres, s, e) {
    const hl = new Set(e.highlight ?? []);
    const none = { type: 'none' };
    const head = e.columns.map(c => ({ text: c, options: { bold: true, color: C.muted, fontSize: pt(e.headSize), border: [none, none, { type: 'solid', pt: 1.5, color: C.line }, none] } }));
    const rows = e.rows.map((r, i) => r.map(c => ({
      text: c,
      options: { bold: hl.has(i + 1), fill: hl.has(i + 1) ? { color: C.tint } : undefined, border: [none, none, i === e.rows.length - 1 ? none : { type: 'solid', pt: 1, color: C.soft }, none] },
    })));
    s.addTable([head, ...rows], {
      x: inch(e.x), y: inch(e.y), w: inch(e.w), colW: e.colW.map(inch), rowH: [inch(e.headH), ...e.rows.map(() => inch(e.rowH))],
      fontFace: FONT.face, fontSize: pt(e.size), color: C.ink, valign: 'middle', margin: [0, 0.18, 0, 0.18],
    });
  },
  chart(pres, s, e) {
    const spec = e.spec;
    const sc = chartScale(spec);
    const common = {
      ...pos(e), fontFace: FONT.face, showLegend: false,
      catAxisLabelColor: C.ink, catAxisLabelFontSize: pt(16), catAxisLabelFontFace: FONT.face,
      valAxisLabelColor: C.faint, valAxisLabelFontSize: pt(14), valAxisLabelFontFace: FONT.face,
      valAxisMinVal: sc.min, valAxisMaxVal: sc.max, valAxisMajorUnit: sc.step,
      valGridLine: { color: C.soft, size: 1 }, catGridLine: { style: 'none' },
      showValue: spec.valueLabels, dataLabelFormatCode: spec.decimals ? `0.${'0'.repeat(spec.decimals)}` : '0',
      dataLabelColor: C.ink, dataLabelFontSize: pt(spec.valueLabelSize ?? 15), dataLabelFontBold: true,
      ...(spec.yLabel ? { showValAxisTitle: true, valAxisTitle: spec.yLabel, valAxisTitleColor: C.muted, valAxisTitleFontSize: pt(14) } : {}),
      ...(spec.xLabel ? { showCatAxisTitle: true, catAxisTitle: spec.xLabel, catAxisTitleColor: C.muted, catAxisTitleFontSize: pt(14) } : {}),
    };
    if (spec.type === 'scatter') {
      const xs = spec.points.map(p => p.x);
      const normal = spec.points.map(p => (p.hi ? null : p.y));
      const hi = spec.points.map(p => (p.hi ? p.y : null));
      const data = [{ name: 'X', values: xs }, { name: spec.pointName, values: normal }];
      const colors = [C.baseline];
      if (hi.some(v => v != null)) { data.push({ name: spec.highlightLabel || '강조', values: hi }); colors.push(C.accent); }
      s.addChart(pres.charts.SCATTER, data, { ...common, chartColors: colors, lineSize: 0, lineDataSymbol: 'circle', lineDataSymbolSize: 10, showValue: false });
      return;
    }
    common.catAxisLabelPos = 'low';
    const data = spec.series.map(x => ({ name: x.name, labels: spec.categories, values: x.values }));
    const colors = spec.series.map(x => x.color);
    if (spec.type === 'line') {
      s.addChart(pres.charts.LINE, data, { ...common, chartColors: colors, lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8, dataLabelPosition: 't' });
    } else {
      s.addChart(pres.charts.BAR, data, { ...common, chartColors: colors, barDir: spec.type === 'hbar' ? 'bar' : 'col', barGrouping: 'clustered', barGapWidthPct: 60, dataLabelPosition: 'outEnd' });
    }
  },
};

export const PAINTED_KINDS = Object.keys(PAINT);

export async function paintPptx(pages) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: FONT.face, bodyFontFace: FONT.face };
  for (const p of pages) {
    const s = pres.addSlide();
    for (const e of p.elements) PAINT[e.kind]?.(pres, s, e);
    if (p.notes) s.addNotes(p.notes);
  }
  return pres.write({ outputType: 'nodebuffer' });
}
