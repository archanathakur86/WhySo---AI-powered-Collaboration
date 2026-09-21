// Small dependency-free line diff (LCS) that produces a unified-diff style
// text with a few lines of context — what a PR reviewer would look at. Sending
// this to the AI instead of both full files is cheaper, faster and keeps the
// model focused on what actually changed.

const MAX_CELLS = 4_000_000; // cap for the O(n*m) table; beyond this, treat the changed block as replaced

const normalize = (text) => (text || "").replace(/\r\n/g, "\n");

const lcsOps = (a, b) => {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: " ", l: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      ops.push({ t: "-", l: a[i++] });
    } else {
      ops.push({ t: "+", l: b[j++] });
    }
  }
  while (i < n) ops.push({ t: "-", l: a[i++] });
  while (j < m) ops.push({ t: "+", l: b[j++] });
  return ops;
};

export const isSameContent = (a, b) => normalize(a) === normalize(b);

/**
 * @returns {{ diffText: string, added: number, removed: number, truncated: boolean }}
 */
export const buildLineDiff = (oldText = "", newText = "", { context = 3, maxChars = 14000 } = {}) => {
  const a = normalize(oldText).split("\n");
  const b = normalize(newText).split("\n");

  // Trim the shared head/tail so the LCS table only covers the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const middle =
    midA.length * midB.length > MAX_CELLS
      ? [...midA.map((l) => ({ t: "-", l })), ...midB.map((l) => ({ t: "+", l }))]
      : lcsOps(midA, midB);

  const ops = [
    ...a.slice(0, start).map((l) => ({ t: " ", l })),
    ...middle,
    ...a.slice(endA).map((l) => ({ t: " ", l })),
  ];

  // Line numbers for hunk headers
  let o = 1;
  let n = 1;
  for (const op of ops) {
    op.o = o;
    op.n = n;
    if (op.t !== "+") o++;
    if (op.t !== "-") n++;
  }

  const changedIdx = [];
  ops.forEach((op, i) => op.t !== " " && changedIdx.push(i));
  if (changedIdx.length === 0) return { diffText: "", added: 0, removed: 0, truncated: false };

  const ranges = [];
  for (const idx of changedIdx) {
    const s = Math.max(0, idx - context);
    const e = Math.min(ops.length - 1, idx + context);
    const last = ranges[ranges.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else ranges.push([s, e]);
  }

  let diffText = ranges
    .map(([s, e]) => {
      const slice = ops.slice(s, e + 1);
      const oldCount = slice.filter((x) => x.t !== "+").length;
      const newCount = slice.filter((x) => x.t !== "-").length;
      return `@@ -${slice[0].o},${oldCount} +${slice[0].n},${newCount} @@\n${slice.map((x) => x.t + x.l).join("\n")}`;
    })
    .join("\n");

  const added = ops.filter((x) => x.t === "+").length;
  const removed = ops.filter((x) => x.t === "-").length;

  let truncated = false;
  if (diffText.length > maxChars) {
    diffText = `${diffText.slice(0, maxChars)}\n... (diff truncated)`;
    truncated = true;
  }
  return { diffText, added, removed, truncated };
};