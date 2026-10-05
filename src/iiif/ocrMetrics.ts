/** 参照との一致度。文字認識の正確さや原画像の校合完了を判定しない。 */
function agreement(reference: string, candidate: string) {
  const a = Array.from(reference), b = Array.from(candidate);
  if ((a.length + 1) * (b.length + 1) > 4_000_000)
    throw new Error("文字比較の計算上限を超えます。対応する小さい領域で評価してください");
  let previous = Array.from({ length: 4 }, () => new Uint32Array(b.length + 1));
  let current = Array.from({ length: 4 }, () => new Uint32Array(b.length + 1));
  for (let j = 0; j <= b.length; j++) previous[0][j] = previous[3][j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0][0] = current[2][0] = i; current[1][0] = current[3][0] = 0;
    for (let j = 1; j <= b.length; j++) {
      const equal = a[i - 1] === b[j - 1];
      const substitution = previous[0][j - 1] + (equal ? 0 : 1);
      const deletion = previous[0][j] + 1, insertion = current[0][j - 1] + 1;
      const source = substitution <= deletion && substitution <= insertion ? previous : deletion <= insertion ? previous : current;
      const index = substitution <= deletion && substitution <= insertion ? j - 1 : j;
      const edit = substitution <= deletion && substitution <= insertion ? (equal ? 0 : 1) : deletion <= insertion ? 2 : 3;
      const sourceIndex = edit === 3 ? j - 1 : index;
      for (let k = 0; k < 4; k++) current[k][j] = source[k][sourceIndex] + (edit !== 0 && (k === 0 || k === edit) ? 1 : 0);
    }
    [previous, current] = [current, previous];
  }
  const counts = new Map<string, number>();
  for (const c of a) counts.set(c, (counts.get(c) ?? 0) + 1);
  let matches = 0;
  for (const c of b) { const remaining = counts.get(c) ?? 0; if (remaining) { matches++; counts.set(c, remaining - 1); } }
  return { reference_characters: a.length, candidate_characters: b.length,
    distance: previous[0][b.length], substitutions: previous[1][b.length], deletions: previous[2][b.length], insertions: previous[3][b.length],
    cer: a.length ? previous[0][b.length] / a.length : null, matched_characters: matches,
    precision: b.length ? matches / b.length : null, recall: a.length ? matches / a.length : null,
    f1: a.length ? 2 * matches / (a.length + b.length) : null };
}
export function compareOcrText(reference: string, candidate: string) {
  const layout = (s: string) => s.normalize("NFC").replace(/\p{White_Space}/gu, "");
  return { strict: agreement(reference, candidate), without_layout_whitespace: agreement(layout(reference), layout(candidate)) };
}
