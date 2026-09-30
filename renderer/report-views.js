// 서버(첫 화면)와 브라우저(갱신)가 같은 HTML 조각을 쓴다.
// makeViews 안의 코드는 바깥 이름을 참조하면 안 된다 (페이지에 `toString()`으로 넣는다).
export function makeViews() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v, d) => (v == null ? '–' : Number(v).toFixed(d));
  const signed = (v, d) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`);

  function compareTable(result) {
    const rows = result.map(r => {
      const cell = (side, s) => {
        const txt = s.n ? `${num(s.mean, r.decimals)} ± ${num(s.sd, r.decimals)} <small>(n=${s.n})</small>` : '<span class="muted">결과 없음</span>';
        return `<td class="${r.winner === side ? 'win' : ''}" data-side="${side}">${txt}</td>`;
      };
      return `<tr><th scope="row">${esc(r.label)}</th>${cell('a', r.a)}${cell('b', r.b)}<td class="diff">${signed(r.diff, r.decimals)}</td></tr>`;
    }).join('');
    return `<table class="rt cmp"><thead><tr><th>지표</th><th>결과 1</th><th>결과 2</th><th>차이 (1−2)</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function tableBody(rows, highlight) {
    const hl = new Set(highlight || []);
    return rows.map((r, i) => `<tr${hl.has(i + 1) ? ' class="hl"' : ''}>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  }

  function legend(spec) {
    const items = spec.type === 'scatter'
      ? [[spec.pointName, 'C9D2FA'], ...(spec.highlightLabel ? [[spec.highlightLabel, '5B45D6']] : [])]
      : spec.series.map(s => [s.name, s.color]);
    if (items.length < 2) return '';
    return items.map(([n, c]) => `<span class="lg"><i style="background:#${c}"></i>${esc(n)}</span>`).join('');
  }

  return { esc, num, compareTable, tableBody, legend };
}

export const views = makeViews();
